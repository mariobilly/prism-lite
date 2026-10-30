import { getEffect } from '../effects/registry';
import type { EffectInstance } from '../state/types';
import { blitTarget, clearTarget, createProgram, createTarget, deleteTarget, pickFormat, type Program, type Target, type TexFormat } from './gl';
import { PARTICLES_SOURCE, SPECTRUM_SOURCE, WAVEFORM_SOURCE } from './audioVisuals';
import { PRESENT_SHADER, PROCEDURAL_SHADER, SOURCE_SHADER } from './shaders';

/** Built-in generated sources, by id. */
const PROCEDURAL_SOURCES: Record<string, string> = {
  noise: PROCEDURAL_SHADER,
  spectrum: SPECTRUM_SOURCE,
  waveform: WAVEFORM_SOURCE,
  particles: PARTICLES_SOURCE,
};

export type SourceFrame =
  | { kind: 'procedural'; proc: string }
  | { kind: 'element'; el: TexImageSource; dynamic: boolean; version: number };

export interface Globals {
  time: number;
  seed: number;
  low: number;
  mid: number;
  high: number;
  energy: number;
  beat: number;
  /** Time that runs faster with louder music (drives particle flight). */
  flow: number;
}

export interface RenderInput {
  source: SourceFrame;
  effects: EffectInstance[];
  /** Final param values per uid (after modulation). */
  values: Map<string, Record<string, number>>;
  globals: Globals;
  /** Show the unprocessed source (A/B compare). */
  bypass: boolean;
  /** Internal render scale: 1 = Full, 0.5 = Draft. */
  scale: number;
  /** Freeze the previously presented frame for a crossfade (call on the frame the look changes). */
  captureCrossfade?: boolean;
  /** Weight of the frozen frame in the output, 0..1. */
  crossfade?: number;
  /** Source crop for media: [scaleX, scaleY, offsetX, offsetY] in UV units. */
  crop?: [number, number, number, number];
}

/**
 * WebGL2 effect chain: source → ping-pong framebuffers through each enabled effect → screen.
 * Feedback effects own a persistent framebuffer holding their previous output.
 */
export class Renderer {
  readonly gl: WebGL2RenderingContext;
  private fmt: TexFormat;
  private vao: WebGLVertexArrayObject;
  private programs = new Map<string, Program | null>();
  private sourceProg: Program;
  private presentProg: Program;
  private procProgs = new Map<string, Program | null>();
  private audioTex: WebGLTexture;
  private xfade: Target | null = null;
  private lastOut: Target | null = null;
  private ping: [Target, Target] | null = null;
  private feedback = new Map<string, Target>();
  private srcTex: WebGLTexture;
  private srcVersion = -1;
  private internalW = 0;
  private internalH = 0;
  onShaderError: (effectName: string, err: Error) => void = () => {};

  constructor(readonly canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;
    this.fmt = pickFormat(gl);
    this.vao = gl.createVertexArray()!;
    this.sourceProg = createProgram(gl, SOURCE_SHADER);
    this.presentProg = createProgram(gl, PRESENT_SHADER);
    this.procProgs.set('noise', createProgram(gl, PROCEDURAL_SHADER));
    this.audioTex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.audioTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 256, 2, 0, gl.RED, gl.UNSIGNED_BYTE, new Uint8Array(512));
    gl.activeTexture(gl.TEXTURE0);
    this.srcTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  }

  get renderSize(): { width: number; height: number } {
    return { width: this.internalW, height: this.internalH };
  }

  /** Compiles effect programs up front so the first use doesn't hitch. */
  warmUp(ids: string[]): void {
    for (const id of ids) this.program(id);
    for (const id of Object.keys(PROCEDURAL_SOURCES)) this.procProgram(id);
  }

  /** Spectrum + waveform bytes (see AudioEngine.vis), available to every shader as uAudio. */
  setAudioData(data: Uint8Array): void {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.audioTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 2, gl.RED, gl.UNSIGNED_BYTE, data);
    gl.activeTexture(gl.TEXTURE0);
  }

  private procProgram(id: string): Program | null {
    if (this.procProgs.has(id)) return this.procProgs.get(id)!;
    let prog: Program | null = null;
    try {
      prog = createProgram(this.gl, PROCEDURAL_SOURCES[id] ?? PROCEDURAL_SHADER);
    } catch (err) {
      this.onShaderError(`${id} source`, err as Error);
    }
    this.procProgs.set(id, prog);
    return prog;
  }

  private program(id: string): Program | null {
    if (this.programs.has(id)) return this.programs.get(id)!;
    const def = getEffect(id);
    let prog: Program | null = null;
    if (def) {
      try {
        const decls = def.params.map((p) => `uniform float u_${p.key};\n`).join('');
        prog = createProgram(this.gl, def.shader, decls);
      } catch (err) {
        this.onShaderError(def.name, err as Error);
      }
    }
    this.programs.set(id, prog);
    return prog;
  }

  private ensureTargets(w: number, h: number): void {
    const gl = this.gl;
    if (this.ping && this.internalW === w && this.internalH === h) return;
    if (this.ping) this.ping.forEach((t) => deleteTarget(gl, t));
    this.ping = [createTarget(gl, w, h, this.fmt), createTarget(gl, w, h, this.fmt)];
    this.lastOut = null;
    if (this.xfade) {
      const next = createTarget(gl, w, h, this.fmt);
      blitTarget(gl, this.xfade, next);
      deleteTarget(gl, this.xfade);
      this.xfade = next;
    }
    // Keep feedback history across resolution changes (e.g. Draft ↔ Full) by rescaling it.
    for (const [uid, old] of this.feedback) {
      const next = createTarget(gl, w, h, this.fmt);
      blitTarget(gl, old, next);
      deleteTarget(gl, old);
      this.feedback.set(uid, next);
    }
    this.internalW = w;
    this.internalH = h;
  }

  resetFeedback(uid: string): void {
    const t = this.feedback.get(uid);
    if (t) clearTarget(this.gl, t);
  }

  private setGlobals(p: Program, g: Globals): void {
    const gl = this.gl;
    const u = p.uniforms;
    const f = (name: string, v: number) => {
      const loc = u.get(name);
      if (loc) gl.uniform1f(loc, v);
    };
    const res = u.get('uResolution');
    if (res) gl.uniform2f(res, this.internalW, this.internalH);
    f('uTime', g.time);
    f('uSeed', g.seed);
    f('uLow', g.low);
    f('uMid', g.mid);
    f('uHigh', g.high);
    f('uEnergy', g.energy);
    f('uBeat', g.beat);
    f('uFlow', g.flow);
    const inp = u.get('uInput');
    if (inp) gl.uniform1i(inp, 0);
    const prev = u.get('uPrev');
    if (prev) gl.uniform1i(prev, 1);
    const audio = u.get('uAudio');
    if (audio) gl.uniform1i(audio, 2);
  }

  private draw(p: Program, target: Target | null, input: WebGLTexture, g: Globals, w: number, h: number): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(p.program);
    this.setGlobals(p, g);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, input);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  render(input: RenderInput): void {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    const outW = this.canvas.width;
    const outH = this.canvas.height;
    const w = Math.max(2, Math.round(outW * input.scale));
    const h = Math.max(2, Math.round(outH * input.scale));
    this.ensureTargets(w, h);
    const ping = this.ping!;
    if (input.captureCrossfade && this.lastOut) {
      if (!this.xfade) this.xfade = createTarget(gl, w, h, this.fmt);
      blitTarget(gl, this.lastOut, this.xfade);
    }
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    // Stage 0: source into ping[0].
    const src = input.source;
    if (src.kind === 'procedural') {
      const prog = this.procProgram(src.proc) ?? this.procProgram('noise');
      if (prog) this.draw(prog, ping[0], this.srcTex, input.globals, w, h);
    } else {
      if (src.dynamic || src.version !== this.srcVersion) {
        gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        try {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src.el);
          this.srcVersion = src.version;
        } catch {
          /* video frame not ready yet; keep the previous frame */
        }
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      }
      const c = input.crop ?? [1, 1, 0, 0];
      gl.useProgram(this.sourceProg.program);
      const cl = this.sourceProg.uniforms.get('uCrop');
      if (cl) gl.uniform4f(cl, c[0], c[1], c[2], c[3]);
      this.draw(this.sourceProg, ping[0], this.srcTex, input.globals, w, h);
    }

    let cur = 0;
    if (!input.bypass) {
      for (const e of input.effects) {
        if (!e.enabled) continue;
        const def = getEffect(e.type);
        const prog = def && this.program(e.type);
        if (!def || !prog) continue;
        const inT = ping[cur];
        const outT = ping[1 - cur];

        gl.useProgram(prog.program);
        const vals = input.values.get(e.uid) ?? e.params;
        for (const p of def.params) {
          const loc = prog.uniforms.get(`u_${p.key}`);
          if (loc) gl.uniform1f(loc, vals[p.key] ?? p.default);
        }

        if (def.needsMips) {
          gl.bindTexture(gl.TEXTURE_2D, inT.tex);
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        }
        let fb: Target | undefined;
        if (def.feedback) {
          fb = this.feedback.get(e.uid);
          if (!fb) {
            fb = createTarget(gl, w, h, this.fmt);
            this.feedback.set(e.uid, fb);
          }
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, fb.tex);
        }
        this.draw(prog, outT, inT.tex, input.globals, w, h);
        if (fb) {
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, null);
          gl.activeTexture(gl.TEXTURE0);
          blitTarget(gl, outT, fb);
        }
        if (def.needsMips) {
          gl.bindTexture(gl.TEXTURE_2D, inT.tex);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
        cur = 1 - cur;
      }
    }

    // Present (with optional crossfade from the frozen previous look).
    const xf = this.xfade && input.crossfade ? Math.min(1, Math.max(0, input.crossfade)) : 0;
    gl.useProgram(this.presentProg.program);
    const xloc = this.presentProg.uniforms.get('uXfade');
    if (xloc) gl.uniform1f(xloc, xf);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, xf > 0 ? this.xfade!.tex : null);
    gl.activeTexture(gl.TEXTURE0);
    this.draw(this.presentProg, null, ping[cur].tex, input.globals, outW, outH);
    this.lastOut = ping[cur];

    // Free feedback buffers of effects that no longer exist.
    if (this.feedback.size) {
      const alive = new Set(input.effects.map((e) => e.uid));
      for (const [uid, t] of this.feedback) {
        if (!alive.has(uid)) {
          deleteTarget(gl, t);
          this.feedback.delete(uid);
        }
      }
    }
  }
}

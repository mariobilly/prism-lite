import type { EffectDef } from './types';

export const crt: EffectDef = {
  id: 'crt',
  name: 'CRT Screen',
  category: 'Finishing',
  description: 'Curved tube, scanlines, RGB mask and flicker.',
  tags: ['retro', 'arcade', 'tv', 'scanlines', 'vhs', 'monitor'],
  params: [
    { key: 'scan', label: 'Scanlines', min: 0, max: 1, default: 0.45, step: 0.01, rand: [0.2, 0.7] },
    { key: 'curve', label: 'Curvature', min: 0, max: 1, default: 0.35, step: 0.01, rand: [0.1, 0.6] },
    { key: 'mask', label: 'RGB Mask', min: 0, max: 1, default: 0.35, step: 0.01, rand: [0.1, 0.6] },
    { key: 'flicker', label: 'Flicker', min: 0, max: 1, default: 0.2, step: 0.01, rand: [0, 0.4] },
  ],
  shader: /* glsl */ `
void main() {
  vec2 uv = vUv * 2.0 - 1.0;
  uv *= 1.0 + u_curve * 0.12 * vec2(uv.y * uv.y, uv.x * uv.x);
  uv = uv * 0.5 + 0.5;
  vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  vec3 c = texture(uInput, uv).rgb;
  float lines = 0.5 + 0.5 * sin(uv.y * 540.0 * PI);
  c *= mix(1.0, 0.55 + 0.45 * lines, u_scan) * (1.0 + u_scan * 0.35);
  float k = mod(gl_FragCoord.x, 3.0);
  vec3 m = k < 1.0 ? vec3(1.0, 0.72, 0.72) : k < 2.0 ? vec3(0.72, 1.0, 0.72) : vec3(0.72, 0.72, 1.0);
  c *= mix(vec3(1.0), m * 1.2, u_mask);
  c *= 1.0 - u_flicker * 0.18 * hash12(vec2(floor(uTime * 30.0), 3.1));
  // Rounded dark corners of the tube.
  vec2 e = min(uv, 1.0 - uv);
  float edge = smoothstep(0.0, 0.02 + u_curve * 0.03, min(e.x, e.y));
  fragColor = vec4(c * edge * inside.x * inside.y, 1.0);
}`,
};

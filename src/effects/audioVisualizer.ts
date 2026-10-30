import { AV_GLSL } from '../engine/audioVisuals';
import type { EffectDef } from './types';

export const audioVisualizer: EffectDef = {
  id: 'audioVisualizer',
  name: 'Audio Visualizer',
  category: 'Generate',
  description: 'Layers spectrum bars, a waveform ring or beat particles over the image.',
  tags: ['spectrum', 'waveform', 'equalizer', 'particles', 'music', 'overlay', 'bars'],
  params: [
    { key: 'visual', label: 'Visual', min: 0, max: 2, default: 0, step: 1, options: ['Spectrum', 'Waveform', 'Particles'] },
    { key: 'blend', label: 'Blend', min: 0, max: 2, default: 0, step: 1, options: ['Add', 'Screen', 'Replace'] },
    { key: 'mix', label: 'Mix', min: 0, max: 1, default: 0.9, step: 0.01, rand: [0.6, 1] },
    { key: 'scale', label: 'Scale', min: 0.3, max: 1.8, default: 1, step: 0.01, rand: [0.7, 1.3] },
    { key: 'hue', label: 'Color', min: 0, max: 1, default: 0.5, step: 0.005 },
  ],
  shader:
    AV_GLSL +
    /* glsl */ `
void main() {
  vec3 src = texture(uInput, vUv).rgb;
  int v = int(u_visual + 0.5);
  vec3 a = v == 0 ? avSpectrum(vUv, u_hue, u_scale) : v == 1 ? avWaveform(vUv, u_hue, u_scale) : avParticles(vUv, u_hue, u_scale);
  int b = int(u_blend + 0.5);
  vec3 outc = b == 0 ? src + a
            : b == 1 ? 1.0 - (1.0 - clamp(src, 0.0, 1.0)) * (1.0 - clamp(a, 0.0, 1.0))
            : a;
  fragColor = vec4(mix(src, outc, u_mix), 1.0);
}`,
};

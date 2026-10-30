import { AV_GLSL } from '../engine/audioVisuals';
import type { EffectDef } from './types';

export const starfield: EffectDef = {
  id: 'starfield',
  name: 'Starfield',
  category: 'Generate',
  description: 'Stars or glowing particles flying toward you, added over the image.',
  tags: ['space', 'particles', 'stars', 'warp', 'cosmic', 'overlay'],
  params: [
    { key: 'amount', label: 'Amount', min: 0, max: 2, default: 1, step: 0.01, rand: [0.5, 1.5] },
    { key: 'speed', label: 'Speed', min: 0, max: 3, default: 0.6, step: 0.01, rand: [0.2, 1.5] },
    { key: 'density', label: 'Density', min: 0, max: 1, default: 0.5, step: 0.01, rand: [0.3, 0.8] },
    { key: 'hue', label: 'Color', min: 0, max: 1, default: 0.58, step: 0.005 },
    { key: 'colorful', label: 'Colorful', min: 0, max: 1, default: 0.4, step: 0.01, rand: [0, 1] },
  ],
  shader:
    AV_GLSL +
    /* glsl */ `
void main() {
  vec3 src = texture(uInput, vUv).rgb;
  vec2 p = (vUv - 0.5) * aspect();
  vec3 s = starfield(p, uTime * u_speed * 0.1, u_density, u_hue, u_colorful);
  fragColor = vec4(src + s * u_amount, 1.0);
}`,
};

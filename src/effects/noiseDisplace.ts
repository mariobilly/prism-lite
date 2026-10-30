import type { EffectDef } from './types';

export const noiseDisplace: EffectDef = {
  id: 'noiseDisplace',
  name: 'Noise Displace',
  category: 'Distortion',
  description: 'Flowing organic warp driven by fractal noise.',
  tags: ['liquid', 'warp', 'flow', 'melt', 'organic', 'trippy'],
  params: [
    { key: 'amount', label: 'Amount', min: 0, max: 0.25, default: 0.04, step: 0.001, rand: [0.01, 0.12] },
    { key: 'scale', label: 'Scale', min: 0.3, max: 12, default: 2.5, step: 0.01, rand: [0.8, 6] },
    { key: 'speed', label: 'Speed', min: 0, max: 3, default: 0.35, step: 0.01, rand: [0.05, 1.2] },
  ],
  shader: /* glsl */ `
void main() {
  vec2 p = vUv * u_scale * aspect();
  float t = uTime * u_speed;
  float s = fract(uSeed * 0.013) * 100.0;
  vec2 d = vec2(fbm(p + vec2(s, t)), fbm(p + vec2(5.2 - t, 1.3 + s)));
  vec2 uv = vUv + d * u_amount / aspect();
  fragColor = vec4(texture(uInput, mirrorUv(uv)).rgb, 1.0);
}`,
};

import type { EffectDef } from './types';

export const lensWarp: EffectDef = {
  id: 'lensWarp',
  name: 'Lens Warp',
  category: 'Distortion',
  description: 'Barrel (fisheye) or pincushion lens distortion.',
  tags: ['fisheye', 'barrel', 'bulge', 'lens', 'retro'],
  params: [
    { key: 'amount', label: 'Amount', min: -1, max: 1, default: 0.3, step: 0.01, rand: [-0.5, 0.7] },
  ],
  shader: /* glsl */ `
void main() {
  vec2 asp = aspect();
  vec2 p = (vUv - 0.5) * asp / asp.x * 2.0;
  float r2 = dot(p, p);
  float k = u_amount * 0.6;
  // Positive = barrel (bulges outwards), negative = pincushion. Normalized so the center scale stays ~1.
  p *= (1.0 - k * r2) / (1.0 - max(k, 0.0) * 0.55);
  vec2 uv = p * asp.x * 0.5 / asp + 0.5;
  fragColor = vec4(texture(uInput, mirrorUv(uv)).rgb, 1.0);
}`,
};

import type { EffectDef } from './types';

export const swirl: EffectDef = {
  id: 'swirl',
  name: 'Swirl',
  category: 'Distortion',
  description: 'Twists the center like a whirlpool.',
  tags: ['twist', 'vortex', 'whirl', 'liquid', 'trippy'],
  params: [
    { key: 'strength', label: 'Strength', min: -12, max: 12, default: 3, step: 0.01, rand: [-6, 6] },
    { key: 'radius', label: 'Radius', min: 0.05, max: 1.2, default: 0.5, step: 0.01, rand: [0.2, 0.9] },
  ],
  shader: /* glsl */ `
void main() {
  vec2 asp = aspect();
  vec2 p = (vUv - 0.5) * asp;
  float r = length(p);
  float k = smoothstep(u_radius, 0.0, r);
  p = rot2(u_strength * k * k) * p;
  fragColor = vec4(texture(uInput, mirrorUv(p / asp + 0.5)).rgb, 1.0);
}`,
};

import type { EffectDef } from './types';

export const posterize: EffectDef = {
  id: 'posterize',
  name: 'Posterize',
  category: 'Stylize',
  description: 'Reduces colors to flat bands.',
  tags: ['bands', 'flat', 'screenprint', 'retro', 'pop art', 'cartoon'],
  params: [
    { key: 'levels', label: 'Levels', min: 2, max: 16, default: 5, step: 1, rand: [3, 8] },
    { key: 'gamma', label: 'Gamma', min: 0.4, max: 2.5, default: 1, step: 0.01, rand: [0.7, 1.5] },
  ],
  shader: /* glsl */ `
void main() {
  vec3 c = pow(clamp(texture(uInput, vUv).rgb, 0.0, 1.0), vec3(u_gamma));
  float n = floor(u_levels + 0.5) - 1.0;
  c = floor(c * n + 0.5) / n;
  fragColor = vec4(pow(c, vec3(1.0 / u_gamma)), 1.0);
}`,
};

import type { EffectDef } from './types';

export const filmGrain: EffectDef = {
  id: 'filmGrain',
  name: 'Film Grain',
  category: 'Finishing',
  description: 'Animated photographic grain with optional vignette.',
  tags: ['noise', 'film', 'analog', 'texture', 'retro', 'vhs'],
  params: [
    { key: 'amount', label: 'Amount', min: 0, max: 0.5, default: 0.08, step: 0.005, rand: [0.03, 0.18] },
    { key: 'vignette', label: 'Vignette', min: 0, max: 1, default: 0.25, step: 0.01, rand: [0, 0.6] },
  ],
  shader: /* glsl */ `
void main() {
  vec3 c = texture(uInput, vUv).rgb;
  float frame = floor(uTime * 24.0);
  vec2 px = floor(vUv * uResolution);
  float n = hash12(px + vec2(frame * 17.13, frame * 3.71) + uSeed) +
            hash12(px * 1.37 + vec2(frame * 5.3, uSeed)) - 1.0;
  float l = luma(c);
  // Grain is strongest in midtones, like real film.
  c += n * u_amount * (0.35 + 0.65 * (1.0 - abs(l * 2.0 - 1.0)));
  vec2 v = (vUv - 0.5) * 1.6;
  c *= 1.0 - u_vignette * smoothstep(0.3, 1.0, dot(v, v));
  fragColor = vec4(c, 1.0);
}`,
};

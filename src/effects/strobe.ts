import type { EffectDef } from './types';

export const strobe: EffectDef = {
  id: 'strobe',
  name: 'Beat Strobe',
  category: 'Finishing',
  description: 'Flashes, inverts or tints the frame on every detected beat.',
  tags: ['flash', 'beat', 'club', 'rave', 'invert', 'pulse'],
  params: [
    { key: 'amount', label: 'Amount', min: 0, max: 1, default: 0.5, step: 0.01, rand: [0.2, 0.8] },
    { key: 'mode', label: 'Mode', min: 0, max: 2, default: 0, step: 1, options: ['Flash', 'Invert', 'Color'] },
    { key: 'hue', label: 'Color', min: 0, max: 1, default: 0.85, step: 0.005 },
  ],
  shader: /* glsl */ `
void main() {
  vec3 c = texture(uInput, vUv).rgb;
  float k = uBeat * u_amount;
  int m = int(u_mode + 0.5);
  if (m == 0) c = mix(c, vec3(1.0), k * 0.85);
  else if (m == 1) c = mix(c, 1.0 - clamp(c, 0.0, 1.0), step(0.5, k));
  else c = mix(c, hsv2rgb(vec3(u_hue, 0.8, 1.0)) * (0.4 + luma(c)), k);
  fragColor = vec4(c, 1.0);
}`,
};

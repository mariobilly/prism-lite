import type { EffectDef } from './types';

export const hueCycle: EffectDef = {
  id: 'hueCycle',
  name: 'Hue Cycle',
  category: 'Color',
  description: 'Continuously rotates colors around the wheel.',
  tags: ['rainbow', 'trippy', 'psychedelic', 'color', 'animate'],
  params: [
    { key: 'speed', label: 'Speed', min: 0, max: 3, default: 0.6, step: 0.01, rand: [0.1, 1.5] },
    { key: 'amount', label: 'Amount', min: 0, max: 1, default: 1, step: 0.01, rand: [0.4, 1] },
    { key: 'spread', label: 'Spread', min: 0, max: 2, default: 0.3, step: 0.01, rand: [0, 1] },
  ],
  shader: /* glsl */ `
void main() {
  vec3 c = texture(uInput, vUv).rgb;
  vec3 h = rgb2hsv(max(c, 0.0));
  float shift = uTime * u_speed * 0.1 + length(vUv - 0.5) * u_spread;
  h.x = fract(h.x + shift * u_amount);
  h.y = min(h.y * (1.0 + 0.25 * u_amount), 1.0);
  fragColor = vec4(hsv2rgb(h), 1.0);
}`,
};

import type { EffectDef } from './types';

export const glitch: EffectDef = {
  id: 'glitch',
  name: 'Glitch Blocks',
  category: 'Stylize',
  description: 'Digital corruption: displaced blocks, torn lines and color shifts.',
  tags: ['glitch', 'datamosh', 'digital', 'corrupt', 'vhs', 'broken'],
  params: [
    { key: 'amount', label: 'Amount', min: 0, max: 1, default: 0.35, step: 0.01, rand: [0.15, 0.7] },
    { key: 'block', label: 'Block Size', min: 8, max: 240, default: 60, step: 1, rand: [20, 120], unit: 'px' },
    { key: 'speed', label: 'Rate', min: 0, max: 30, default: 8, step: 0.1, rand: [3, 15], unit: '/s' },
    { key: 'color', label: 'Color Shift', min: 0, max: 0.05, default: 0.012, step: 0.0005, rand: [0.004, 0.025] },
  ],
  shader: /* glsl */ `
void main() {
  float t = floor(uTime * u_speed) + 1.0;
  float k = uResolution.y / 1080.0;
  vec2 px = vUv * uResolution / k;
  vec2 bs = vec2(u_block * 2.5, u_block);
  vec2 cell = floor(px / bs);
  float r = hash12(cell + t * 13.1 + uSeed);
  float row = hash12(vec2(floor(px.y / max(u_block * 0.3, 2.0)), t * 7.7));
  float on = step(1.0 - u_amount * 0.45, r);
  float line = step(1.0 - u_amount * 0.25, row);
  vec2 uv = vUv;
  uv.x += on * (hash12(cell * 1.7 + t) - 0.5) * 0.25 * u_amount;
  uv.y += on * (hash12(cell * 2.3 + t) - 0.5) * 0.04 * u_amount;
  uv.x += line * (row - 0.5) * 0.12 * u_amount;
  float cs = u_color * (0.3 + on + line * 0.6);
  vec3 c;
  c.r = texture(uInput, mirrorUv(uv + vec2(cs, 0.0))).r;
  c.g = texture(uInput, mirrorUv(uv)).g;
  c.b = texture(uInput, mirrorUv(uv - vec2(cs, 0.0))).b;
  // A few inverted or posterized blocks.
  float x = hash12(cell + t * 3.3);
  if (on > 0.5 && x > 0.85) c = 1.0 - c;
  else if (on > 0.5 && x > 0.7) c = floor(c * 3.0 + 0.5) / 3.0;
  fragColor = vec4(c, 1.0);
}`,
};

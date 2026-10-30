import type { EffectDef } from './types';

export const rgbSplit: EffectDef = {
  id: 'rgbSplit',
  name: 'RGB Split',
  category: 'Finishing',
  description: 'Chromatic aberration: offsets the color channels.',
  tags: ['glitch', 'chromatic', 'aberration', 'vhs', 'retro'],
  params: [
    { key: 'amount', label: 'Amount', min: 0, max: 0.06, default: 0.005, step: 0.0005, rand: [0.002, 0.02] },
    { key: 'angle', label: 'Angle', min: 0, max: 360, default: 0, step: 1, unit: '°' },
    { key: 'radial', label: 'Radial', min: 0, max: 1, default: 0.3, step: 0.01, rand: [0, 1] },
  ],
  shader: /* glsl */ `
void main() {
  float a = radians(u_angle);
  vec2 dir = vec2(cos(a), sin(a)) / aspect();
  dir = mix(dir, (vUv - 0.5) * 2.0, u_radial) * u_amount;
  float r = texture(uInput, vUv + dir).r;
  float g = texture(uInput, vUv).g;
  float b = texture(uInput, vUv - dir).b;
  fragColor = vec4(r, g, b, 1.0);
}`,
};

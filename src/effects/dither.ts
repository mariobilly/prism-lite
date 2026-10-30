import type { EffectDef } from './types';

export const dither: EffectDef = {
  id: 'dither',
  name: 'Dither',
  category: 'Stylize',
  description: 'Ordered (Bayer) dithering: 1-bit, limited color or handheld-console green.',
  tags: ['1bit', 'retro', 'game', 'pixel', '8bit', 'print'],
  params: [
    { key: 'levels', label: 'Levels', min: 2, max: 8, default: 2, step: 1, rand: [2, 4] },
    { key: 'scale', label: 'Pixel Size', min: 1, max: 8, default: 3, step: 1, rand: [2, 5], unit: 'px' },
    { key: 'mode', label: 'Palette', min: 0, max: 2, default: 0, step: 1, options: ['Color', 'Mono', 'Handheld'] },
  ],
  shader: /* glsl */ `
float bayer4(vec2 p) {
  const float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  ivec2 i = ivec2(mod(p, 4.0));
  return (m[i.x + i.y * 4] + 0.5) / 16.0;
}
void main() {
  float sc = max(1.0, u_scale * uResolution.y / 1080.0);
  vec2 cell = floor(vUv * uResolution / sc);
  vec2 uv = (cell + 0.5) * sc / uResolution;
  vec3 c = clamp(texture(uInput, uv).rgb, 0.0, 1.0);
  float th = bayer4(cell) - 0.5;
  float n = floor(u_levels + 0.5) - 1.0;
  int mode = int(u_mode + 0.5);
  if (mode == 0) {
    c = clamp(floor(c * n + th + 0.5) / n, 0.0, 1.0);
  } else {
    float l = clamp(floor(luma(c) * n + th + 0.5) / n, 0.0, 1.0);
    c = mode == 1 ? vec3(l)
      : mix(mix(vec3(0.06, 0.22, 0.06), vec3(0.19, 0.38, 0.19), smoothstep(0.0, 0.34, l)),
            mix(vec3(0.55, 0.67, 0.06), vec3(0.61, 0.74, 0.06), smoothstep(0.66, 1.0, l)), smoothstep(0.3, 0.7, l));
  }
  fragColor = vec4(c, 1.0);
}`,
};

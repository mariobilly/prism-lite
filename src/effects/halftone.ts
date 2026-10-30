import type { EffectDef } from './types';

export const halftone: EffectDef = {
  id: 'halftone',
  name: 'Halftone',
  category: 'Stylize',
  description: 'CMY print dots on paper.',
  tags: ['print', 'comic', 'dots', 'newspaper', 'retro', 'pop art'],
  params: [
    { key: 'size', label: 'Dot Size', min: 2, max: 40, default: 8, step: 0.1, rand: [4, 16], unit: 'px' },
    { key: 'angle', label: 'Angle', min: 0, max: 90, default: 15, step: 0.5, unit: '°' },
    { key: 'mix', label: 'Mix', min: 0, max: 1, default: 1, step: 0.01, rand: [0.7, 1] },
  ],
  shader: /* glsl */ `
float dotLayer(float ang, int ch, float size) {
  mat2 R = rot2(radians(ang));
  vec2 q = R * (vUv * uResolution);
  vec2 cell = (floor(q / size) + 0.5) * size;
  vec2 centerUv = (transpose(R) * cell) / uResolution;
  vec3 c = clamp(texture(uInput, centerUv).rgb, 0.0, 1.0);
  float ink = 1.0 - c[ch];
  float rad = sqrt(ink) * size * 0.62;
  float d = length(q - cell);
  return 1.0 - smoothstep(rad - 0.9, rad + 0.9, d);
}
void main() {
  // Dot size is defined relative to a 1080p frame so Draft mode and exports look the same.
  float size = max(u_size * uResolution.y / 1080.0, 2.0);
  float cy = dotLayer(u_angle, 0, size);
  float mg = dotLayer(u_angle + 30.0, 1, size);
  float yl = dotLayer(u_angle + 60.0, 2, size);
  vec3 paper = vec3(0.97, 0.95, 0.9);
  vec3 printed = paper * vec3(1.0 - cy * 0.9, 1.0 - mg * 0.9, 1.0 - yl * 0.9);
  vec3 src = texture(uInput, vUv).rgb;
  fragColor = vec4(mix(src, printed, u_mix), 1.0);
}`,
};

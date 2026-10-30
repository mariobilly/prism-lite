import type { EffectDef } from './types';

export const colorAdjust: EffectDef = {
  id: 'colorAdjust',
  name: 'Color Adjust',
  category: 'Color',
  description: 'Exposure, contrast, saturation and hue.',
  tags: ['grade', 'brightness', 'levels', 'tone', 'vivid'],
  params: [
    { key: 'exposure', label: 'Exposure', min: -3, max: 3, default: 0, step: 0.01, rand: [-0.6, 0.8], unit: 'EV' },
    { key: 'contrast', label: 'Contrast', min: 0, max: 2, default: 1, step: 0.01, rand: [0.8, 1.5] },
    { key: 'saturation', label: 'Saturation', min: 0, max: 2, default: 1, step: 0.01, rand: [0.4, 1.8] },
    { key: 'hue', label: 'Hue Shift', min: -180, max: 180, default: 0, step: 1, unit: '°' },
  ],
  shader: /* glsl */ `
void main() {
  vec3 c = texture(uInput, vUv).rgb * exp2(u_exposure);
  c = (c - 0.5) * u_contrast + 0.5;
  float l = luma(c);
  c = max(mix(vec3(l), c, u_saturation), 0.0);
  if (abs(u_hue) > 0.01) {
    vec3 h = rgb2hsv(c);
    h.x = fract(h.x + u_hue / 360.0);
    c = hsv2rgb(h);
  }
  fragColor = vec4(c, 1.0);
}`,
};

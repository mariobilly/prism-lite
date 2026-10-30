import type { EffectDef } from './types';

export const lightLeaks: EffectDef = {
  id: 'lightLeaks',
  name: 'Light Leaks',
  category: 'Generate',
  description: 'Drifting warm film light leaks washing in from the edges.',
  tags: ['film', 'analog', 'warm', 'dreamy', 'glow', 'retro'],
  params: [
    { key: 'intensity', label: 'Intensity', min: 0, max: 1.5, default: 0.6, step: 0.01, rand: [0.3, 1] },
    { key: 'speed', label: 'Speed', min: 0, max: 2, default: 0.3, step: 0.01, rand: [0.1, 0.8] },
    { key: 'hue', label: 'Color', min: 0, max: 1, default: 0.04, step: 0.005 },
    { key: 'size', label: 'Size', min: 0.2, max: 1.5, default: 0.8, step: 0.01, rand: [0.5, 1.2] },
  ],
  shader: /* glsl */ `
void main() {
  vec3 src = texture(uInput, vUv).rgb;
  vec2 p = (vUv - 0.5) * aspect();
  float t = uTime * u_speed;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 c = vec2(sin(t * 0.7 + fi * 2.1) * 0.85, cos(t * 0.53 + fi * 1.37) * 0.55);
    vec2 d = p - c;
    float b = exp(-dot(d, d) / (u_size * u_size * 0.18));
    acc += hsv2rgb(vec3(fract(u_hue + fi * 0.06), 0.75, 1.0)) * b;
  }
  acc *= 0.35 + smoothstep(0.15, 0.9, length(p));
  vec3 leak = clamp(acc * u_intensity, 0.0, 1.0);
  fragColor = vec4(1.0 - (1.0 - clamp(src, 0.0, 1.0)) * (1.0 - leak), 1.0);
}`,
};

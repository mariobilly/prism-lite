import type { EffectDef } from './types';

export const zoomBlur: EffectDef = {
  id: 'zoomBlur',
  name: 'Zoom Blur',
  category: 'Finishing',
  description: 'Radial motion blur rushing toward (or away from) a center point.',
  tags: ['speed', 'motion', 'radial', 'rush', 'warp', 'blur'],
  params: [
    { key: 'strength', label: 'Strength', min: -0.5, max: 0.5, default: 0.12, step: 0.005, rand: [0.04, 0.25] },
    { key: 'cx', label: 'Center X', min: -0.5, max: 0.5, default: 0, step: 0.01, rand: [-0.15, 0.15] },
    { key: 'cy', label: 'Center Y', min: -0.5, max: 0.5, default: 0, step: 0.01, rand: [-0.15, 0.15] },
  ],
  shader: /* glsl */ `
void main() {
  vec2 c = vec2(0.5) + vec2(u_cx, u_cy);
  vec2 d = vUv - c;
  float jitter = hash12(gl_FragCoord.xy + fract(uTime) * 100.0);
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 24; i++) {
    float f = (float(i) + jitter) / 24.0;
    float w = 1.0 - f * 0.6;
    acc += texture(uInput, mirrorUv(c + d * (1.0 - u_strength * f))).rgb * w;
    wsum += w;
  }
  fragColor = vec4(acc / wsum, 1.0);
}`,
};

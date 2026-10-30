import type { EffectDef } from './types';

export const ripple: EffectDef = {
  id: 'ripple',
  name: 'Ripple',
  category: 'Distortion',
  description: 'Concentric water ripples from the center.',
  tags: ['water', 'wave', 'liquid', 'pulse'],
  params: [
    { key: 'frequency', label: 'Frequency', min: 1, max: 80, default: 22, step: 0.1, rand: [6, 50] },
    { key: 'amplitude', label: 'Amplitude', min: 0, max: 0.05, default: 0.008, step: 0.0005, rand: [0.002, 0.025] },
    { key: 'speed', label: 'Speed', min: 0, max: 12, default: 3, step: 0.01, rand: [0.5, 6] },
  ],
  shader: /* glsl */ `
void main() {
  vec2 asp = aspect();
  vec2 p = (vUv - 0.5) * asp;
  float r = length(p);
  float w = sin(r * u_frequency - uTime * u_speed);
  vec2 dir = r > 1e-4 ? p / r : vec2(0.0);
  vec2 uv = vUv + dir / asp * w * u_amplitude;
  vec3 c = texture(uInput, mirrorUv(uv)).rgb;
  // Subtle light catch on wave crests.
  c *= 1.0 + w * u_amplitude * 6.0;
  fragColor = vec4(c, 1.0);
}`,
};

import type { EffectDef } from './types';

export const feedbackTrails: EffectDef = {
  id: 'feedbackTrails',
  name: 'Feedback Trails',
  category: 'Temporal',
  description: 'Blends in the previous frame, transformed: tunnels and liquid trails.',
  tags: ['tunnel', 'trails', 'echo', 'liquid', 'trippy', 'psychedelic', 'motion'],
  feedback: true,
  params: [
    { key: 'decay', label: 'Decay', min: 0.5, max: 0.995, default: 0.92, step: 0.001, rand: [0.8, 0.97] },
    { key: 'zoom', label: 'Zoom', min: 0.9, max: 1.1, default: 1.015, step: 0.001, rand: [0.98, 1.05] },
    { key: 'rotation', label: 'Rotation', min: -5, max: 5, default: 0.4, step: 0.01, rand: [-1.5, 1.5], unit: '°' },
    { key: 'offsetX', label: 'Offset X', min: -0.02, max: 0.02, default: 0, step: 0.0005, rand: [-0.005, 0.005] },
    { key: 'offsetY', label: 'Offset Y', min: -0.02, max: 0.02, default: 0, step: 0.0005, rand: [-0.005, 0.005] },
    { key: 'mix', label: 'Mix', min: 0, max: 1, default: 0.85, step: 0.01, rand: [0.6, 1] },
  ],
  shader: /* glsl */ `
void main() {
  vec3 cur = texture(uInput, vUv).rgb;
  vec2 asp = aspect();
  vec2 p = (vUv - 0.5) * asp;
  p = rot2(radians(u_rotation)) * p;
  p /= u_zoom;
  vec2 uv = p / asp + 0.5 - vec2(u_offsetX, u_offsetY);
  vec3 prev = texture(uPrev, uv).rgb * u_decay;
  // Samples from outside the previous frame fade to black instead of smearing the border.
  vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  prev *= inside.x * inside.y;
  fragColor = vec4(mix(cur, max(cur, prev), u_mix), 1.0);
}`,
};

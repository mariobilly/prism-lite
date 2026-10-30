import type { EffectDef } from './types';

export const kaleidoscope: EffectDef = {
  id: 'kaleidoscope',
  name: 'Kaleidoscope',
  category: 'Distortion',
  description: 'Mirrors the image into radial segments.',
  tags: ['mirror', 'symmetry', 'mandala', 'trippy', 'psychedelic'],
  params: [
    { key: 'segments', label: 'Segments', min: 2, max: 16, default: 6, step: 1, rand: [3, 12] },
    { key: 'rotation', label: 'Rotation', min: -180, max: 180, default: 0, step: 0.5, unit: '°' },
    { key: 'zoom', label: 'Zoom', min: 0.25, max: 4, default: 1, step: 0.01, rand: [0.6, 2] },
    { key: 'spin', label: 'Spin', min: -1, max: 1, default: 0.05, step: 0.01, rand: [-0.3, 0.3] },
  ],
  shader: /* glsl */ `
void main() {
  vec2 asp = aspect();
  vec2 p = (vUv - 0.5) * asp;
  float r = length(p);
  float a = atan(p.y, p.x) + radians(u_rotation) + uTime * u_spin;
  float seg = TAU / floor(u_segments + 0.5);
  a = mod(a, seg);
  a = abs(a - seg * 0.5);
  p = vec2(cos(a), sin(a)) * r / u_zoom;
  vec2 uv = p / asp + 0.5;
  fragColor = vec4(texture(uInput, mirrorUv(uv)).rgb, 1.0);
}`,
};

import type { EffectDef } from './types';

export const mirrorTile: EffectDef = {
  id: 'mirrorTile',
  name: 'Mirror / Tile',
  category: 'Distortion',
  description: 'Mirror halves or quarters, or repeat the image as scrolling tiles.',
  tags: ['symmetry', 'repeat', 'grid', 'pattern', 'trippy'],
  params: [
    { key: 'mode', label: 'Mode', min: 0, max: 3, default: 2, step: 1, options: ['Mirror X', 'Mirror Y', 'Quad', 'Tile'] },
    { key: 'tiles', label: 'Tiles', min: 1, max: 8, default: 3, step: 1, rand: [2, 5] },
    { key: 'zoom', label: 'Zoom', min: 0.5, max: 2.5, default: 1, step: 0.01, rand: [0.8, 1.6] },
    { key: 'scroll', label: 'Scroll', min: -1, max: 1, default: 0.04, step: 0.01, rand: [-0.2, 0.2] },
  ],
  shader: /* glsl */ `
void main() {
  int m = int(u_mode + 0.5);
  vec2 uv = (vUv - 0.5) / u_zoom + 0.5;
  vec2 s = uTime * u_scroll * vec2(1.0, 0.6);
  if (m == 0) uv.x = 0.5 - abs(uv.x - 0.5);
  else if (m == 1) uv.y = 0.5 - abs(uv.y - 0.5);
  else if (m == 2) uv = 0.5 - abs(uv - 0.5);
  else uv = (uv - 0.5) * floor(u_tiles + 0.5) + 0.5;
  fragColor = vec4(texture(uInput, mirrorUv(uv + s)).rgb, 1.0);
}`,
};

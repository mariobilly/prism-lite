import type { EffectDef } from './types';

export const pixelate: EffectDef = {
  id: 'pixelate',
  name: 'Pixelate',
  category: 'Stylize',
  description: 'Chunky square pixels.',
  tags: ['8bit', 'mosaic', 'blocks', 'retro', 'game'],
  params: [
    { key: 'size', label: 'Block Size', min: 1, max: 128, default: 12, step: 1, rand: [4, 40], unit: 'px' },
  ],
  shader: /* glsl */ `
void main() {
  // Block size is defined relative to a 1080p frame so Draft mode and exports look the same.
  vec2 bs = vec2(max(u_size * uResolution.y / 1080.0, 1.0));
  vec2 px = vUv * uResolution;
  vec2 uv = (floor(px / bs) + 0.5) * bs / uResolution;
  fragColor = vec4(texture(uInput, uv).rgb, 1.0);
}`,
};

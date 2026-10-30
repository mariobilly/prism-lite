import type { EffectDef } from './types';

export const gradientMap: EffectDef = {
  id: 'gradientMap',
  name: 'Gradient Map',
  category: 'Color',
  description: 'Remaps brightness onto a color palette.',
  tags: ['palette', 'duotone', 'tint', 'colorize', 'retro', 'neon'],
  params: [
    { key: 'palette', label: 'Palette', min: 0, max: 4, default: 0, step: 1, options: ['Sunset', 'Ocean', 'Neon', 'Gold', 'Infrared'] },
    { key: 'mix', label: 'Mix', min: 0, max: 1, default: 1, step: 0.01, rand: [0.5, 1] },
    { key: 'offset', label: 'Offset', min: -0.5, max: 0.5, default: 0, step: 0.01, rand: [-0.2, 0.2] },
  ],
  shader: /* glsl */ `
vec3 hex(float r, float g, float b) { return vec3(r, g, b) / 255.0; }
void stops(int p, out vec3 a, out vec3 b, out vec3 c, out vec3 d) {
  if (p == 0) { a = hex(26.,6.,51.); b = hex(122.,31.,92.); c = hex(240.,100.,60.); d = hex(255.,224.,138.); }
  else if (p == 1) { a = hex(2.,11.,31.); b = hex(10.,74.,122.); c = hex(47.,179.,201.); d = hex(217.,255.,245.); }
  else if (p == 2) { a = hex(10.,0.,20.); b = hex(106.,0.,255.); c = hex(255.,47.,179.); d = hex(125.,252.,255.); }
  else if (p == 3) { a = hex(11.,9.,6.); b = hex(74.,58.,28.); c = hex(201.,154.,61.); d = hex(255.,244.,214.); }
  else { a = hex(5.,1.,15.); b = hex(91.,26.,140.); c = hex(232.,69.,44.); d = hex(255.,233.,107.); }
}
void main() {
  vec3 src = texture(uInput, vUv).rgb;
  float t = clamp(luma(src) + u_offset, 0.0, 1.0) * 3.0;
  vec3 a, b, c, d;
  stops(int(u_palette + 0.5), a, b, c, d);
  vec3 g = t < 1.0 ? mix(a, b, smoothstep(0.0, 1.0, t))
         : t < 2.0 ? mix(b, c, smoothstep(1.0, 2.0, t))
         : mix(c, d, smoothstep(2.0, 3.0, t));
  fragColor = vec4(mix(src, g, u_mix), 1.0);
}`,
};

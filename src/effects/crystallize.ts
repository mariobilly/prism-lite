import type { EffectDef } from './types';

export const crystallize: EffectDef = {
  id: 'crystallize',
  name: 'Crystallize',
  category: 'Stylize',
  description: 'Shifting stained-glass cells (Voronoi) with dark leading.',
  tags: ['voronoi', 'cells', 'glass', 'mosaic', 'shatter'],
  params: [
    { key: 'size', label: 'Cell Size', min: 4, max: 160, default: 36, step: 1, rand: [14, 70], unit: 'px' },
    { key: 'edge', label: 'Edges', min: 0, max: 1, default: 0.5, step: 0.01, rand: [0.1, 0.8] },
    { key: 'jitter', label: 'Jitter', min: 0, max: 1, default: 0.9, step: 0.01, rand: [0.5, 1] },
    { key: 'speed', label: 'Drift', min: 0, max: 3, default: 0.4, step: 0.01, rand: [0, 1.2] },
  ],
  shader: /* glsl */ `
void main() {
  float sz = max(2.0, u_size * uResolution.y / 1080.0);
  vec2 p = vUv * uResolution / sz;
  vec2 ip = floor(p);
  vec2 fp = fract(p);
  float d1 = 8.0, d2 = 8.0;
  vec2 best = ip;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash22(ip + g + uSeed * 0.01);
      o = 0.5 + 0.5 * sin(uTime * u_speed + TAU * o);
      o = mix(vec2(0.5), o, u_jitter);
      vec2 r = g + o - fp;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; best = ip + g + o; }
      else if (d < d2) { d2 = d; }
    }
  }
  vec3 c = texture(uInput, best * sz / uResolution).rgb;
  float e = sqrt(d2) - sqrt(d1);
  c *= mix(1.0, smoothstep(0.0, 0.09, e), u_edge);
  fragColor = vec4(c, 1.0);
}`,
};

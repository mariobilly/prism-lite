import type { EffectDef } from './types';

export const bloom: EffectDef = {
  id: 'bloom',
  name: 'Bloom',
  category: 'Finishing',
  description: 'Soft light halo around bright areas.',
  tags: ['glow', 'dreamy', 'light', 'soft', 'haze'],
  needsMips: true,
  params: [
    { key: 'threshold', label: 'Threshold', min: 0, max: 1, default: 0.55, step: 0.01, rand: [0.3, 0.8] },
    { key: 'intensity', label: 'Intensity', min: 0, max: 3, default: 0.9, step: 0.01, rand: [0.4, 1.6] },
    { key: 'radius', label: 'Radius', min: 0, max: 1, default: 0.55, step: 0.01, rand: [0.3, 0.9] },
  ],
  shader: /* glsl */ `
void main() {
  vec3 src = texture(uInput, vUv).rgb;
  // Wide blur for free: sample several levels of the input's mip chain.
  float maxLod = 1.0 + u_radius * 6.0;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    float lod = mix(1.0, maxLod, float(i) / 4.0);
    vec2 px = exp2(lod) / uResolution;
    vec3 s = textureLod(uInput, vUv, lod).rgb * 2.0;
    s += textureLod(uInput, vUv + vec2( px.x,  px.y), lod).rgb;
    s += textureLod(uInput, vUv + vec2(-px.x,  px.y), lod).rgb;
    s += textureLod(uInput, vUv + vec2( px.x, -px.y), lod).rgb;
    s += textureLod(uInput, vUv + vec2(-px.x, -px.y), lod).rgb;
    s /= 6.0;
    float k = smoothstep(u_threshold, u_threshold + 0.35, luma(s));
    acc += s * k;
  }
  vec3 b = acc / 5.0 * u_intensity * 1.6;
  // Screen-style add keeps highlights from clipping harshly.
  fragColor = vec4(src + b * (1.0 - clamp(src, 0.0, 1.0) * 0.5), 1.0);
}`,
};

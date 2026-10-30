import type { EffectDef } from './types';

export const glowingEdges: EffectDef = {
  id: 'glowingEdges',
  name: 'Glowing Edges',
  category: 'Stylize',
  description: 'Traces contours as glowing neon lines.',
  tags: ['glow', 'neon', 'outline', 'edge', 'sketch', 'tron'],
  needsMips: true,
  params: [
    { key: 'threshold', label: 'Threshold', min: 0, max: 1, default: 0.12, step: 0.01, rand: [0.03, 0.35] },
    { key: 'width', label: 'Glow Width', min: 0, max: 4, default: 1.2, step: 0.01, rand: [0.3, 2.5] },
    { key: 'hue', label: 'Color', min: 0, max: 1, default: 0.52, step: 0.005 },
    { key: 'intensity', label: 'Intensity', min: 0, max: 4, default: 1.6, step: 0.01, rand: [0.8, 2.5] },
    { key: 'source', label: 'Source Mix', min: 0, max: 1, default: 0, step: 0.01, rand: [0, 0.4] },
  ],
  shader: /* glsl */ `
float edgeAt(float lod) {
  vec2 px = exp2(lod) / uResolution;
  float tl = luma(textureLod(uInput, vUv + vec2(-px.x,  px.y), lod).rgb);
  float t  = luma(textureLod(uInput, vUv + vec2( 0.0,   px.y), lod).rgb);
  float tr = luma(textureLod(uInput, vUv + vec2( px.x,  px.y), lod).rgb);
  float l  = luma(textureLod(uInput, vUv + vec2(-px.x,  0.0), lod).rgb);
  float r  = luma(textureLod(uInput, vUv + vec2( px.x,  0.0), lod).rgb);
  float bl = luma(textureLod(uInput, vUv + vec2(-px.x, -px.y), lod).rgb);
  float b  = luma(textureLod(uInput, vUv + vec2( 0.0,  -px.y), lod).rgb);
  float br = luma(textureLod(uInput, vUv + vec2( px.x, -px.y), lod).rgb);
  float gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
  float gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;
  return length(vec2(gx, gy));
}
void main() {
  vec3 src = texture(uInput, vUv).rgb;
  float lod = u_width;
  float core = smoothstep(u_threshold, u_threshold + 0.2, edgeAt(lod));
  float halo = smoothstep(u_threshold * 0.6, u_threshold + 0.4, edgeAt(lod + 1.5));
  vec3 col = hsv2rgb(vec3(u_hue, 0.75, 1.0));
  vec3 glow = col * (core + halo * 0.55) * u_intensity + vec3(1.0) * core * core * 0.25 * u_intensity;
  fragColor = vec4(src * u_source + glow, 1.0);
}`,
};

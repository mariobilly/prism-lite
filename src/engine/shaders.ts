export const VERTEX_SHADER = /* glsl */ `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

/** Prepended to every fragment shader: global uniforms + shared helpers. */
export const FRAGMENT_HEADER = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uInput;
uniform sampler2D uPrev;
uniform sampler2D uAudio;
uniform vec2 uResolution;
uniform float uTime;
uniform float uSeed;
uniform float uLow;
uniform float uMid;
uniform float uHigh;
uniform float uEnergy;
uniform float uBeat;
uniform float uFlow;

const float PI = 3.14159265359;
const float TAU = 6.28318530718;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
// Gradient noise in roughly [-1, 1].
float gnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = dot(hash22(i) * 2.0 - 1.0, f);
  float b = dot(hash22(i + vec2(1.0, 0.0)) * 2.0 - 1.0, f - vec2(1.0, 0.0));
  float c = dot(hash22(i + vec2(0.0, 1.0)) * 2.0 - 1.0, f - vec2(0.0, 1.0));
  float d = dot(hash22(i + vec2(1.0, 1.0)) * 2.0 - 1.0, f - vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) * 1.4;
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * gnoise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return s;
}
float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
vec2 mirrorUv(vec2 uv) { return 1.0 - abs(mod(uv, 2.0) - 1.0); }
vec2 aspect() { return vec2(uResolution.x / uResolution.y, 1.0); }
mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
`;

export const COPY_SHADER = /* glsl */ `
void main() {
  fragColor = vec4(texture(uInput, vUv).rgb, 1.0);
}`;

/** Media into the chain, cropped to the output aspect: xy = scale, zw = offset (pan). */
export const SOURCE_SHADER = /* glsl */ `
uniform vec4 uCrop;
void main() {
  vec2 uv = (vUv - 0.5) * uCrop.xy + 0.5 + uCrop.zw;
  fragColor = vec4(texture(uInput, clamp(uv, 0.0, 1.0)).rgb, 1.0);
}`;

/** Final pass to the screen: optional crossfade with a frozen previous look, clamped. */
export const PRESENT_SHADER = /* glsl */ `
uniform float uXfade;
void main() {
  vec3 c = texture(uInput, vUv).rgb;
  if (uXfade > 0.0) c = mix(c, texture(uPrev, vUv).rgb, uXfade);
  fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

/** Built-in source shown when no media is loaded: slow, colorful domain-warped noise. */
export const PROCEDURAL_SHADER = /* glsl */ `
void main() {
  vec2 p = (vUv - 0.5) * aspect() * 2.2;
  float t = uTime * 0.12;
  vec2 q = vec2(fbm(p * 0.9 + vec2(t, -t * 0.6)), fbm(p * 0.9 + vec2(4.1 - t * 0.4, 2.7 + t)));
  float n = fbm(p * 1.3 + q * 1.8 + vec2(-t * 0.3, t * 0.2));
  vec3 col = 0.5 + 0.5 * cos(TAU * (vec3(0.02, 0.28, 0.55) + n * 0.75 + q.x * 0.35 + t * 0.25));
  col *= 0.35 + 0.9 * smoothstep(-0.55, 0.65, n);
  // A few soft highlights so glow / edge effects have something to catch.
  float hl = smoothstep(0.35, 0.62, n + 0.25 * q.y);
  col += vec3(1.0, 0.92, 0.85) * hl * 0.35;
  fragColor = vec4(col, 1.0);
}`;

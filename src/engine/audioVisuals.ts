/**
 * Shared GLSL for audio-reactive visuals. `uAudio` is a 256×2 texture:
 * row 0 = log-spaced spectrum (0..1), row 1 = waveform (0.5 = silence).
 * Prepend AV_GLSL to any shader body that uses these functions.
 */
export const AV_GLSL = /* glsl */ `
float specAt(float x) { return texture(uAudio, vec2(clamp(x, 0.0, 1.0), 0.25)).r; }
float waveAt(float x) { return texture(uAudio, vec2(clamp(x, 0.0, 1.0), 0.75)).r * 2.0 - 1.0; }

// Mirrored spectrum bars rising from a baseline, with a soft reflection.
vec3 avSpectrum(vec2 uv, float hue, float scale) {
  float x = abs(uv.x - 0.5) * 2.0;
  const float BARS = 48.0;
  float bi = floor(x * BARS);
  float bx = fract(x * BARS);
  float v = specAt(pow((bi + 0.5) / BARS, 1.15));
  float h = v * 0.5 * scale + 0.004;
  float y = uv.y - 0.34;
  float gap = smoothstep(0.1, 0.2, bx) * smoothstep(0.9, 0.8, bx);
  float bar = step(0.0, y) * step(y, h) * gap;
  float grad = clamp(y / h, 0.0, 1.0);
  float refl = step(y, 0.0) * smoothstep(-h * 0.6, 0.0, y) * gap * 0.28;
  float halo = gap * exp(-abs(y - h) * 60.0) * 0.5;
  vec3 col = hsv2rgb(vec3(fract(hue + x * 0.4 - grad * 0.06), 0.75, 1.0));
  return col * (bar * (0.45 + 0.75 * grad) + refl + halo * v);
}

// Circular oscilloscope that swells with the bass.
vec3 avWaveform(vec2 uv, float hue, float scale) {
  vec2 p = (uv - 0.5) * aspect();
  float r = length(p);
  float a = atan(p.y, p.x) / TAU + 0.5;
  float w = waveAt(abs(a * 2.0 - 1.0));
  float target = (0.2 + uLow * 0.07 + uBeat * 0.02) * scale + w * 0.09 * scale;
  float d = abs(r - target);
  float line = smoothstep(0.005, 0.0, d);
  float glow = 0.0006 / (d * d + 0.0006) * 0.3;
  float inner = smoothstep(target, target - 0.1 * scale, r) * (0.05 + 0.15 * uEnergy);
  vec3 col = hsv2rgb(vec3(fract(hue + a * 0.5 + uTime * 0.03), 0.7, 1.0));
  // A second, fainter ring for depth.
  float d2 = abs(r - target * 1.35 - w * 0.03);
  float ring2 = 0.0003 / (d2 * d2 + 0.0003) * 0.12;
  return col * (line + glow + inner) + hsv2rgb(vec3(fract(hue + 0.5), 0.5, 1.0)) * ring2;
}

// Layers of points flying toward the viewer. t advances the flight.
vec3 starfield(vec2 p, float t, float density, float hue, float colorful) {
  vec3 col = vec3(0.0);
  for (int i = 0; i < 5; i++) {
    float fi = float(i);
    float z = fract(fi / 5.0 + t);
    float scale = mix(16.0, 0.9, z);
    float fade = smoothstep(0.0, 0.35, z) * smoothstep(1.0, 0.8, z);
    vec2 q = p * scale + fi * 17.31;
    vec2 ip = floor(q);
    vec2 fp = fract(q);
    float h = hash12(ip + fi * 31.7);
    vec2 pos = hash22(ip + fi * 7.13) * 0.7 + 0.15;
    float d = length(fp - pos);
    float on = step(1.0 - density, h);
    float core = smoothstep(0.09, 0.0, d) * 1.4;
    float glow = 0.004 / (d * d + 0.004) * 0.22;
    vec3 c = mix(vec3(1.0), hsv2rgb(vec3(fract(hue + h * 0.35), 0.7, 1.0)), colorful);
    col += c * (core + glow) * on * fade * z;
  }
  return col;
}

vec3 avParticles(vec2 uv, float hue, float scale) {
  vec2 p = (uv - 0.5) * aspect() / scale;
  return starfield(p, uFlow * 0.07, 0.7 + 0.25 * uEnergy, hue, 0.9) * (1.5 + uBeat * 1.5);
}
`;

const BG = /* glsl */ `
vec3 avBackground(vec2 uv, float hue) {
  vec2 p = (uv - 0.5) * aspect();
  vec3 a = hsv2rgb(vec3(fract(hue + 0.6), 0.6, 0.10));
  vec3 b = hsv2rgb(vec3(fract(hue + 0.75), 0.5, 0.02));
  float n = fbm(p * 1.5 + uTime * 0.03) * 0.5 + 0.5;
  return mix(b, a, n * (1.0 - length(p) * 0.8) + uEnergy * 0.15);
}
`;

/** Built-in audio-reactive sources (idle animation when no audio plays). */
export const SPECTRUM_SOURCE = AV_GLSL + BG + /* glsl */ `
void main() {
  float hue = 0.52 + uTime * 0.01;
  vec3 col = avBackground(vUv, hue) + avSpectrum(vUv, hue, 1.0);
  fragColor = vec4(col, 1.0);
}`;

export const WAVEFORM_SOURCE = AV_GLSL + BG + /* glsl */ `
void main() {
  float hue = 0.8 + uTime * 0.01;
  vec2 p = (vUv - 0.5) * aspect();
  vec3 col = avBackground(vUv, hue) + avWaveform(vUv, hue, 1.0) + starfield(p, uFlow * 0.03, 0.25, hue, 0.4) * 0.35;
  fragColor = vec4(col, 1.0);
}`;

export const PARTICLES_SOURCE = AV_GLSL + BG + /* glsl */ `
void main() {
  float hue = 0.05 + uTime * 0.015;
  vec3 col = avBackground(vUv, hue) * 0.7 + avParticles(vUv, hue, 1.0);
  fragColor = vec4(col, 1.0);
}`;

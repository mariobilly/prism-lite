import type { EffectDef } from './types';

export const tunnel: EffectDef = {
  id: 'tunnel',
  name: 'Tunnel',
  category: 'Distortion',
  description: 'Wraps the image around an endless tunnel you fly through.',
  tags: ['tunnel', 'wormhole', 'trippy', 'psychedelic', 'demoscene', 'speed'],
  params: [
    { key: 'speed', label: 'Speed', min: -2, max: 2, default: 0.35, step: 0.01, rand: [-0.8, 0.8] },
    { key: 'twist', label: 'Twist', min: -2, max: 2, default: 0.3, step: 0.01, rand: [-1, 1] },
    { key: 'depth', label: 'Depth', min: 0.1, max: 2, default: 0.5, step: 0.01, rand: [0.3, 1] },
    { key: 'fog', label: 'Fog', min: 0, max: 1, default: 0.6, step: 0.01, rand: [0.3, 0.9] },
  ],
  shader: /* glsl */ `
void main() {
  vec2 p = (vUv - 0.5) * aspect();
  float r = max(length(p), 1e-3);
  float a = atan(p.y, p.x) / TAU + 0.5;
  a += u_twist * 0.05 / r + uTime * u_twist * 0.02;
  vec2 uv = vec2(abs(fract(a) * 2.0 - 1.0), u_depth * 0.25 / r + uTime * u_speed * 0.3);
  vec3 c = texture(uInput, mirrorUv(uv)).rgb;
  c *= mix(1.0, smoothstep(0.0, 0.45, r), u_fog);
  fragColor = vec4(c, 1.0);
}`,
};

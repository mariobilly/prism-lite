import { createInstance, sanitizeEffects } from './store';
import { newUid, type Binding, type EffectInstance, type Preset } from './types';

const bind = (source: Binding['source'], amount: number, smoothing = 0.3, invert = false): Binding => ({
  source,
  amount,
  smoothing,
  invert,
});
/** LFO binding: `rate` in Hz. */
const lfo = (source: Binding['source'], amount: number, rate: number): Binding => ({ source, amount, smoothing: 0, invert: false, rate });

function fx(type: string, params: Record<string, number> = {}, bindings: Record<string, Binding> = {}): EffectInstance {
  return createInstance(type, params, bindings);
}

/** Built-in starting points. Built lazily so each load gets fresh instances. */
export function builtInPresets(): Preset[] {
  return [
    {
      id: 'liquid-portrait',
      name: 'Liquid Portrait',
      description: 'Melting, flowing warp in sunset tones. Bass pushes the melt.',
      builtIn: true,
      effects: [
        fx('noiseDisplace', { amount: 0.035, scale: 2.2, speed: 0.3 }, { amount: bind('low', 0.28, 0.35) }),
        fx('gradientMap', { palette: 0, mix: 0.8, offset: 0.02 }),
        fx('bloom', { threshold: 0.5, intensity: 0.9, radius: 0.6 }),
      ],
    },
    {
      id: 'psychedelic-tunnel',
      name: 'Psychedelic Tunnel',
      description: 'Kaleidoscopic feedback tunnel that surges on every beat.',
      builtIn: true,
      effects: [
        fx('kaleidoscope', { segments: 8, zoom: 1.4, spin: 0.08 }),
        fx('hueCycle', { speed: 0.8, amount: 1, spread: 0.6 }),
        fx('feedbackTrails', { decay: 0.955, zoom: 1.03, rotation: 0.8, mix: 0.95 }, { zoom: bind('beat', 0.3, 0.1) }),
      ],
    },
    {
      id: 'reactive-album-art',
      name: 'Reactive Album Art',
      description: 'Gentle ripples and grain; highs tear the color channels apart.',
      builtIn: true,
      effects: [
        fx('ripple', { frequency: 26, amplitude: 0.005, speed: 2.5 }, { amplitude: bind('low', 0.2, 0.3) }),
        fx('rgbSplit', { amount: 0.003, radial: 0.6 }, { amount: bind('high', 0.35, 0.2) }),
        fx('filmGrain', { amount: 0.07, vignette: 0.35 }),
      ],
    },
    {
      id: 'neon-outline',
      name: 'Neon Outline',
      description: 'Glowing contour lines with a short, electric afterglow.',
      builtIn: true,
      effects: [
        fx('glowingEdges', { threshold: 0.1, width: 1, hue: 0.52, intensity: 1.8, source: 0.08 }, { intensity: bind('energy', 0.2, 0.3) }),
        fx('bloom', { threshold: 0.35, intensity: 1.2, radius: 0.5 }),
        fx('feedbackTrails', { decay: 0.8, zoom: 1.005, rotation: 0, mix: 0.9 }),
      ],
    },
    {
      id: 'retro-print',
      name: 'Retro Print',
      description: 'Flat poster colors printed as CMY halftone dots.',
      builtIn: true,
      effects: [
        fx('posterize', { levels: 5, gamma: 1 }),
        fx('halftone', { size: 9, angle: 15, mix: 1 }),
        fx('colorAdjust', { exposure: 0.1, contrast: 1.15, saturation: 1.25 }),
      ],
    },
    // ---- more animated looks: all keep moving without music, and react when it plays
    {
      id: 'aurora-drift',
      name: 'Aurora Drift',
      description: 'Slow northern-lights flow in cool ocean tones; glow swells with the mix.',
      builtIn: true,
      effects: [
        fx('noiseDisplace', { amount: 0.06, scale: 1.2, speed: 0.25 }, { amount: bind('low', 0.12, 0.5) }),
        fx('gradientMap', { palette: 1, mix: 0.75, offset: 0.02 }),
        fx('colorAdjust', { exposure: 0.05, contrast: 1.25, saturation: 1.15, hue: -35 }),
        fx('bloom', { threshold: 0.5, intensity: 0.8, radius: 0.75 }, { intensity: bind('energy', 0.25, 0.4) }),
      ],
    },
    {
      id: 'vortex-pulse',
      name: 'Vortex Pulse',
      description: 'A spinning whirlpool that twists harder on the bass.',
      builtIn: true,
      effects: [
        fx('swirl', { strength: 3.5, radius: 0.75 }, { strength: bind('low', 0.2, 0.3) }),
        fx('kaleidoscope', { segments: 6, zoom: 1.1, spin: 0.15 }),
        fx('feedbackTrails', { decay: 0.9, zoom: 1.01, rotation: 1.5, mix: 0.8 }),
        fx('bloom', { threshold: 0.5, intensity: 0.9, radius: 0.6 }),
      ],
    },
    {
      id: 'liquid-chrome',
      name: 'Liquid Chrome',
      description: 'Molten metal: high-contrast monochrome warp with a warm sheen.',
      builtIn: true,
      effects: [
        fx('noiseDisplace', { amount: 0.08, scale: 1.8, speed: 0.5 }, { amount: bind('low', 0.1, 0.4) }),
        fx('colorAdjust', { exposure: 0.55, contrast: 1.45, saturation: 0 }),
        fx('gradientMap', { palette: 3, mix: 0.35 }),
        fx('bloom', { threshold: 0.62, intensity: 1.2, radius: 0.45 }),
      ],
    },
    {
      id: 'neon-rain',
      name: 'Neon Rain',
      description: 'Magenta outlines that drip downward; highs shimmer the color channels.',
      builtIn: true,
      effects: [
        fx('glowingEdges', { threshold: 0.16, width: 0.5, hue: 0.87, intensity: 1.1, source: 0.03 }),
        fx('feedbackTrails', { decay: 0.84, zoom: 1, rotation: 0, offsetY: 0.005, mix: 0.9 }),
        fx('rgbSplit', { amount: 0.003, radial: 0.2 }, { amount: bind('high', 0.3, 0.2) }),
        fx('bloom', { threshold: 0.55, intensity: 0.6, radius: 0.45 }),
      ],
    },
    {
      id: 'hypno-rings',
      name: 'Hypno Rings',
      description: 'Concentric rainbow rings rippling out of a slowly turning mandala.',
      builtIn: true,
      effects: [
        fx('ripple', { frequency: 40, amplitude: 0.014, speed: 5 }, { amplitude: bind('beat', 0.25, 0.2) }),
        fx('kaleidoscope', { segments: 12, zoom: 1.2, spin: 0.2 }),
        fx('hueCycle', { speed: 1.2, amount: 1, spread: 1.4 }),
        fx('bloom', { threshold: 0.55, intensity: 0.8, radius: 0.5 }),
      ],
    },
    {
      id: 'mandala-bloom',
      name: 'Mandala Bloom',
      description: 'A breathing neon mandala that flares on every beat.',
      builtIn: true,
      effects: [
        fx('noiseDisplace', { amount: 0.03, scale: 3, speed: 0.4 }),
        fx('kaleidoscope', { segments: 10, zoom: 0.8, spin: -0.1 }, { zoom: bind('low', 0.08, 0.4) }),
        fx('gradientMap', { palette: 2, mix: 1 }),
        fx('bloom', { threshold: 0.45, intensity: 0.9, radius: 0.65 }, { intensity: bind('beat', 0.4, 0.15) }),
      ],
    },
    {
      id: 'vhs-dream',
      name: 'VHS Dream',
      description: 'Warped tape nostalgia: wobble, color fringing and grain that jolt on beats.',
      builtIn: true,
      effects: [
        fx('noiseDisplace', { amount: 0.008, scale: 6, speed: 1.6 }),
        fx('lensWarp', { amount: 0.25 }),
        fx('rgbSplit', { amount: 0.004, angle: 0, radial: 0.7 }, { amount: bind('beat', 0.2, 0.1) }),
        fx('colorAdjust', { exposure: 0.05, contrast: 1.1, saturation: 1.35 }),
        fx('filmGrain', { amount: 0.14, vignette: 0.5 }),
      ],
    },
    {
      id: 'infrared-heat',
      name: 'Infrared Heat',
      description: 'Thermal-camera palette with rising heat shimmer.',
      builtIn: true,
      effects: [
        fx('noiseDisplace', { amount: 0.012, scale: 8, speed: 1.5 }, { amount: bind('energy', 0.06, 0.4) }),
        fx('gradientMap', { palette: 4, mix: 1, offset: 0.05 }),
        fx('bloom', { threshold: 0.6, intensity: 0.8, radius: 0.5 }),
        fx('filmGrain', { amount: 0.05, vignette: 0.3 }),
      ],
    },
    {
      id: 'pixel-party',
      name: 'Pixel Party',
      description: 'Chunky 8-bit color bands cycling fast; blocks shrink on every beat.',
      builtIn: true,
      effects: [
        fx('pixelate', { size: 18 }, { size: bind('beat', -0.08, 0.1) }),
        fx('posterize', { levels: 4, gamma: 1 }),
        fx('hueCycle', { speed: 2, amount: 1, spread: 0.5 }),
        fx('rgbSplit', { amount: 0.002, radial: 0 }),
      ],
    },
    {
      id: 'warp-speed',
      name: 'Warp Speed',
      description: 'Hyperspace streaks racing out from the center; energy hits the throttle.',
      builtIn: true,
      effects: [
        fx('lensWarp', { amount: 0.4 }),
        fx('hueCycle', { speed: 0.5, amount: 0.6, spread: 1 }),
        fx('feedbackTrails', { decay: 0.93, zoom: 1.05, rotation: 0, mix: 1 }, { zoom: bind('energy', 0.15, 0.3) }),
        fx('bloom', { threshold: 0.5, intensity: 1, radius: 0.6 }),
      ],
    },
    {
      id: 'cosmic-swirl',
      name: 'Cosmic Swirl',
      description: 'A slowly spiralling galaxy of neon light with long echoes.',
      builtIn: true,
      effects: [
        fx('swirl', { strength: -5, radius: 0.9 }, { strength: bind('mid', 0.12, 0.5) }),
        fx('gradientMap', { palette: 2, mix: 0.85 }),
        fx('feedbackTrails', { decay: 0.95, zoom: 0.99, rotation: -2, mix: 0.9 }),
        fx('bloom', { threshold: 0.45, intensity: 1.1, radius: 0.7 }),
      ],
    },
    {
      id: 'pop-comic',
      name: 'Pop Comic',
      description: 'Bold flat colors, print dots and inked outlines, gently wobbling to the bass.',
      builtIn: true,
      effects: [
        fx('ripple', { frequency: 12, amplitude: 0.003, speed: 2 }, { amplitude: bind('low', 0.15, 0.3) }),
        fx('posterize', { levels: 4, gamma: 1.1 }),
        fx('colorAdjust', { contrast: 1.2, saturation: 1.6 }),
        fx('halftone', { size: 6, angle: 20, mix: 0.55 }),
        fx('glowingEdges', { threshold: 0.18, width: 0.3, hue: 0.0, intensity: 0.5, source: 1 }),
      ],
    },
    {
      id: 'ghost-echo',
      name: 'Ghost Echo',
      description: 'Pale, drifting afterimages: best with webcam or video.',
      builtIn: true,
      effects: [
        fx('colorAdjust', { exposure: 0.15, contrast: 1.1, saturation: 0.25 }),
        fx('noiseDisplace', { amount: 0.01, scale: 2, speed: 0.3 }),
        fx('feedbackTrails', { decay: 0.97, zoom: 1.003, rotation: 0.1, offsetX: 0.002, mix: 0.9 }),
        fx('bloom', { threshold: 0.55, intensity: 0.8, radius: 0.8 }, { intensity: bind('energy', 0.2, 0.4) }),
        fx('filmGrain', { amount: 0.06, vignette: 0.45 }),
      ],
    },
    {
      id: 'kaleido-ocean',
      name: 'Kaleido Ocean',
      description: 'Rippling turquoise symmetry, like looking up through water.',
      builtIn: true,
      effects: [
        fx('ripple', { frequency: 18, amplitude: 0.008, speed: 2 }),
        fx('kaleidoscope', { segments: 6, zoom: 1.3, spin: 0.08 }, { zoom: bind('low', 0.06, 0.4) }),
        fx('gradientMap', { palette: 1, mix: 1 }),
        fx('bloom', { threshold: 0.5, intensity: 0.9, radius: 0.6 }),
      ],
    },
    // ---- showcase for the effects pack, LFOs and audio visuals
    {
      id: 'spectrum-glow',
      name: 'Spectrum Glow',
      description: 'Glowing equalizer bars over your image, smearing upward with the music.',
      builtIn: true,
      effects: [
        fx('audioVisualizer', { visual: 0, blend: 1, mix: 0.95, scale: 1, hue: 0.5 }, { hue: lfo('saw', 1, 0.03) }),
        fx('feedbackTrails', { decay: 0.86, zoom: 1.006, rotation: 0, offsetY: -0.002, mix: 0.85 }),
        fx('bloom', { threshold: 0.45, intensity: 1, radius: 0.6 }),
      ],
    },
    {
      id: 'wormhole',
      name: 'Wormhole',
      description: 'Fly through an endless tunnel that twists back and forth on its own.',
      builtIn: true,
      effects: [
        fx('tunnel', { speed: 0.5, twist: 0, depth: 0.5, fog: 0.7 }, { twist: lfo('sine', 0.35, 0.07), speed: bind('energy', 0.15, 0.4) }),
        fx('hueCycle', { speed: 0.4, amount: 0.8, spread: 1.2 }),
        fx('bloom', { threshold: 0.5, intensity: 0.9, radius: 0.6 }),
      ],
    },
    {
      id: 'hyperspace',
      name: 'Hyperspace',
      description: 'Stars streaking past with a radial rush that kicks on every beat.',
      builtIn: true,
      effects: [
        fx('colorAdjust', { exposure: -0.6, contrast: 1.2, saturation: 1.2 }),
        fx('starfield', { amount: 1.3, speed: 0.8, density: 0.6, hue: 0.58, colorful: 0.5 }, { speed: bind('energy', 0.2, 0.3) }),
        fx('zoomBlur', { strength: 0.1 }, { strength: bind('beat', 0.15, 0.1) }),
        fx('bloom', { threshold: 0.4, intensity: 1, radius: 0.55 }),
      ],
    },
    {
      id: 'glitch-storm',
      name: 'Glitch Storm',
      description: 'Corrupted blocks and torn scanlines that erupt on the beat.',
      builtIn: true,
      effects: [
        fx('glitch', { amount: 0.2, block: 60, speed: 10, color: 0.012 }, { amount: bind('beat', 0.5, 0.1) }),
        fx('rgbSplit', { amount: 0.003, radial: 0.2 }, { amount: bind('high', 0.3, 0.2) }),
        fx('crt', { scan: 0.3, curve: 0.15, mask: 0.2, flicker: 0.3 }),
        fx('filmGrain', { amount: 0.08, vignette: 0.3 }),
      ],
    },
    {
      id: 'arcade-crt',
      name: 'Arcade CRT',
      description: 'Dithered 8-bit color on a curved, flickering tube.',
      builtIn: true,
      effects: [
        fx('colorAdjust', { exposure: 0.2, contrast: 1.2, saturation: 1.5 }),
        fx('dither', { levels: 3, scale: 3, mode: 0 }),
        fx('crt', { scan: 0.5, curve: 0.4, mask: 0.4, flicker: 0.15 }),
        fx('bloom', { threshold: 0.55, intensity: 0.7, radius: 0.4 }),
      ],
    },
    {
      id: 'handheld',
      name: 'Handheld',
      description: 'Four shades of green, like a 1989 pocket console.',
      builtIn: true,
      effects: [
        fx('colorAdjust', { exposure: 0.1, contrast: 1.3 }),
        fx('dither', { levels: 4, scale: 4, mode: 2 }),
        fx('lensWarp', { amount: 0.08 }),
      ],
    },
    {
      id: 'stained-glass',
      name: 'Stained Glass',
      description: 'Drifting crystal cells that slowly grow and shrink, lit by warm leaks.',
      builtIn: true,
      effects: [
        fx('crystallize', { size: 34, edge: 0.6, jitter: 0.9, speed: 0.5 }, { size: lfo('triangle', 0.15, 0.05) }),
        fx('colorAdjust', { contrast: 1.15, saturation: 1.4 }),
        fx('lightLeaks', { intensity: 0.5, speed: 0.25, hue: 0.06, size: 0.8 }),
      ],
    },
    {
      id: 'dream-leak',
      name: 'Dream Leak',
      description: 'Soft, hazy film memories with drifting warm light: lovely on photos.',
      builtIn: true,
      effects: [
        fx('noiseDisplace', { amount: 0.012, scale: 1.5, speed: 0.2 }),
        fx('lightLeaks', { intensity: 0.75, speed: 0.3, hue: 0.03, size: 0.9 }, { intensity: bind('energy', 0.2, 0.5) }),
        fx('bloom', { threshold: 0.5, intensity: 0.9, radius: 0.8 }),
        fx('filmGrain', { amount: 0.07, vignette: 0.45 }),
      ],
    },
    {
      id: 'mirror-world',
      name: 'Mirror World',
      description: 'Four-way mirrored reality slowly wringing itself out.',
      builtIn: true,
      effects: [
        fx('mirrorTile', { mode: 2, zoom: 1.2, scroll: 0.03 }),
        fx('swirl', { strength: 0, radius: 0.9 }, { strength: lfo('sine', 0.3, 0.06) }),
        fx('hueCycle', { speed: 0.3, amount: 0.7, spread: 0.8 }),
        fx('bloom', { threshold: 0.55, intensity: 0.7, radius: 0.5 }),
      ],
    },
    {
      id: 'rave-strobe',
      name: 'Rave Strobe',
      description: 'Spinning kaleidoscope with colored flashes on every beat.',
      builtIn: true,
      effects: [
        fx('kaleidoscope', { segments: 8, zoom: 1.1, spin: 0.25 }),
        fx('hueCycle', { speed: 1.5, amount: 1, spread: 0.8 }),
        fx('strobe', { amount: 0.8, mode: 2, hue: 0.85 }),
        fx('bloom', { threshold: 0.5, intensity: 0.9, radius: 0.5 }),
      ],
    },
    {
      id: 'blank',
      name: 'Blank',
      description: 'An empty stack: start from scratch.',
      builtIn: true,
      effects: [],
    },
  ];
}

const STORAGE_KEY = 'prism-lite:user-presets';

export function loadUserPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Preset[];
    if (!Array.isArray(list)) return [];
    return list
      .filter((p) => p && typeof p.name === 'string')
      .map((p) => ({ id: p.id || newUid('preset'), name: p.name, description: p.description || 'User preset', effects: sanitizeEffects(p.effects) }));
  } catch {
    return [];
  }
}

export function saveUserPresets(list: Preset[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

import type { Category, EffectDef } from './types';
import { colorAdjust } from './colorAdjust';
import { gradientMap } from './gradientMap';
import { hueCycle } from './hueCycle';
import { noiseDisplace } from './noiseDisplace';
import { ripple } from './ripple';
import { kaleidoscope } from './kaleidoscope';
import { swirl } from './swirl';
import { lensWarp } from './lensWarp';
import { glowingEdges } from './glowingEdges';
import { pixelate } from './pixelate';
import { halftone } from './halftone';
import { posterize } from './posterize';
import { bloom } from './bloom';
import { rgbSplit } from './rgbSplit';
import { filmGrain } from './filmGrain';
import { feedbackTrails } from './feedbackTrails';
import { mirrorTile } from './mirrorTile';
import { tunnel } from './tunnel';
import { glitch } from './glitch';
import { dither } from './dither';
import { crystallize } from './crystallize';
import { zoomBlur } from './zoomBlur';
import { crt } from './crt';
import { strobe } from './strobe';
import { starfield } from './starfield';
import { lightLeaks } from './lightLeaks';
import { audioVisualizer } from './audioVisualizer';

/** Every available effect. To add one: create a file exporting an EffectDef and list it here. */
export const EFFECTS: EffectDef[] = [
  colorAdjust, gradientMap, hueCycle,
  noiseDisplace, ripple, kaleidoscope, swirl, lensWarp, mirrorTile, tunnel,
  glowingEdges, pixelate, halftone, posterize, glitch, dither, crystallize,
  bloom, rgbSplit, filmGrain, zoomBlur, crt, strobe,
  starfield, lightLeaks, audioVisualizer,
  feedbackTrails,
];

export const CATEGORIES: Category[] = ['Color', 'Distortion', 'Stylize', 'Finishing', 'Generate', 'Temporal'];

const byId = new Map(EFFECTS.map((e) => [e.id, e]));

export function getEffect(id: string): EffectDef | undefined {
  return byId.get(id);
}

export function defaultParams(def: EffectDef): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of def.params) out[p.key] = p.default;
  return out;
}

export type Category = 'Color' | 'Distortion' | 'Stylize' | 'Finishing' | 'Generate' | 'Temporal';

export interface ParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  default: number;
  step: number;
  /** Optional sub-range used by Randomize so random looks stay tasteful. */
  rand?: [number, number];
  /** When set, the param is an index into these named options (rendered as a select). */
  options?: string[];
  unit?: string;
}

export interface EffectDef {
  id: string;
  name: string;
  category: Category;
  description: string;
  /** Extra search words ("glow", "liquid", "trippy", ...). */
  tags: string[];
  params: ParamDef[];
  /**
   * GLSL body. Receives the common header (uInput, uPrev, globals, helpers) and one
   * `uniform float u_<key>;` per param. Must define `void main()` writing `fragColor`.
   */
  shader: string;
  /** Input texture gets a mip chain before this pass (for cheap wide blurs). */
  needsMips?: boolean;
  /** Effect keeps its own persistent framebuffer, bound as uPrev. */
  feedback?: boolean;
}

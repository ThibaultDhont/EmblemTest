import type { Pos } from '../core/types.ts';

// Actions indépendantes du périphérique : souris aujourd'hui, clavier / tactile / manette plus tard.
export type Action =
  | { type: 'setCursor'; pos: Pos }
  | { type: 'confirm' }
  | { type: 'cancel' }
  | { type: 'scroll'; lines: number }; // molette : positif vers le bas

export type ActionHandler = (action: Action) => void;

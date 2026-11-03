import type { Pos } from '../core/types.ts';

// Actions indépendantes du périphérique : souris aujourd'hui, clavier / tactile / manette plus tard.
export type Action =
  | { type: 'setCursor'; pos: Pos }
  | { type: 'confirm' }
  | { type: 'cancel' };

export type ActionHandler = (action: Action) => void;

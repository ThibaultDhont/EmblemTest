import type { Pos } from '../core/types.ts';

// Actions indépendantes du périphérique : souris aujourd'hui, tactile plus tard.
export type Action =
  | { type: 'pointer'; pos: Pos } // case de l'écran (pas de la carte) sous le pointeur
  | { type: 'confirm' }
  | { type: 'cancel' }
  | { type: 'scroll'; lines: number; columns: number } // molette : positif vers le bas et vers la droite
  | { type: 'pan'; dx: number; dy: number }; // le pointeur reste au bord de l'écran : la caméra avance d'une tuile

export type ActionHandler = (action: Action) => void;

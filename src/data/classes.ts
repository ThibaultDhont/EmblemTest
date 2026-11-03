import type { ClassId } from '../core/types.ts';

export interface ClassDef {
  mov: number; // points de mouvement
}

export const CLASSES: Record<ClassId, ClassDef> = {
  swordsman: { mov: 5 },
  lancer: { mov: 4 },
  archer: { mov: 5 },
  fighter: { mov: 5 },
};

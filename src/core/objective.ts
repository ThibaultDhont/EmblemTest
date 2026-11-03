import type { GameState, Unit } from './types.ts';

function isMet(state: GameState, fallen: Unit | undefined): boolean {
  const objective = state.objective;
  const everyone = [...state.units, ...state.reserve]; // la réserve compte : un renfort attendu n'est pas vaincu
  switch (objective.type) {
    case 'boss':
      return fallen?.role === 'boss' && !everyone.some((unit) => unit.role === 'boss');
    case 'rout':
      return !everyone.some((unit) => unit.team === 'enemy');
    case 'survive':
      return state.turn > objective.turns;
  }
}

// Vérifie l'objectif et, s'il est atteint, déclare la victoire. À appeler après chaque mort (avec l'unité
// tombée) et à la fin de chaque phase ennemie. Une issue déjà décidée ne change plus.
export function updateOutcome(state: GameState, fallen?: Unit): void {
  if (state.outcome === 'playing' && isMet(state, fallen)) state.outcome = 'victory';
}

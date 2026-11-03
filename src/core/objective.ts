import type { GameState, Objective, Pos, Unit } from './types.ts';

// La case que l'objectif demande d'atteindre, s'il en a une.
export function objectiveTarget(objective: Objective): Pos | undefined {
  return objective.type === 'reach' || objective.type === 'escort' ? { x: objective.x, y: objective.y } : undefined;
}

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
    case 'reach':
      return state.units.some((unit) => unit.team === 'player' && unit.pos.x === objective.x && unit.pos.y === objective.y);
    case 'escort':
      return state.units.some(
        (unit) => unit.id === objective.unit && unit.team === 'player' && unit.pos.x === objective.x && unit.pos.y === objective.y,
      );
  }
}

// Vérifie l'objectif et, s'il est atteint, déclare la victoire. À appeler après chaque mort (avec l'unité
// tombée), à la fin de chaque phase ennemie et quand une unité du joueur finit un déplacement. Une issue
// déjà décidée ne change plus.
export function updateOutcome(state: GameState, fallen?: Unit): void {
  if (state.outcome === 'playing' && isMet(state, fallen)) state.outcome = 'victory';
}

import { updateOutcome } from './objective.ts';
import type { GameState } from './types.ts';

// Fin de la phase joueur : les ennemis jouent à leur tour.
export function endPlayerPhase(state: GameState): void {
  state.phase = 'enemy';
  for (const unit of state.units) {
    if (unit.team === 'enemy') unit.acted = false;
  }
}

// Fin de la phase ennemie : le tour suivant commence et tout le monde peut de nouveau agir.
// C'est aussi le moment où un objectif de survie peut être atteint.
export function endEnemyPhase(state: GameState): void {
  state.phase = 'player';
  state.turn += 1;
  for (const unit of state.units) unit.acted = false;
  updateOutcome(state);
}

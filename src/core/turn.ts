import type { GameState } from './types.ts';

// Pour l'instant la phase ennemie est vide : le tour suivant commence directement.
export function endTurn(state: GameState): void {
  state.turn += 1;
  for (const unit of state.units) unit.acted = false;
}

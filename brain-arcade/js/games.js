// The games. Each draws the answers as part of its world and plays its own game around them;
// the play screen (play.js) does everything else. Long answers (sentences) are shown as cards by
// the play screen, and the game just plays its reward.
// Balloon Pop (balloons.js): a right balloon lets out bubbles to pop.
// Chess (chess-ui.js): a real game of chess, each right answer earns a move.
// Monster Munch (monster.js): a pet monster to raise, fed by right answers.
// Rocket Ride (rocket.js): a trip across a star map, fuelled by right answers.

import { Balloons } from './balloons.js';
import { ChessGame } from './chess-ui.js';
import { MonsterGame } from './monster.js';
import { RocketGame } from './rocket.js';

export const GAMES = {
  balloons: { name: 'Balloon Pop', icon: '🎈', make: (stage, o) => new Balloons(stage, o) },
  chess: { name: 'Chess', icon: '♞', make: (stage, o) => new ChessGame(stage, o) },
  monster: { name: 'Monster Munch', icon: '🍪', make: (stage, o) => new MonsterGame(stage, o) },
  rocket: { name: 'Rocket Ride', icon: '🚀', make: (stage, o) => new RocketGame(stage, o) },
};

// Stickers kids collect: a new one every few stars. Grouped into pages for the sticker book.
export const STICKER_PAGES = [
  { name: 'Animals', items: ['🦊', '🐼', '🐯', '🦁', '🐸', '🐵', '🐨', '🐧', '🦉', '🦄', '🐢', '🦒', '🐘', '🦘', '🦥', '🦦', '🐿️', '🦔', '🐇', '🦩', '🦚', '🐝', '🦋', '🐞'] },
  { name: 'Sea', items: ['🐳', '🐬', '🐙', '🦈', '🐠', '🦀', '🦞', '🦑', '🐡', '🐚', '🦭', '🐋'] },
  { name: 'Dinosaurs & dragons', items: ['🦖', '🦕', '🐉', '🐲', '🐊', '🦎'] },
  { name: 'Space', items: ['🚀', '🛸', '🪐', '🌙', '⭐', '🌟', '☄️', '🌍', '👽', '🛰️', '🔭', '🌈'] },
  { name: 'Chess', items: ['♔', '♕', '♖', '♗', '♘', '♙', '♚', '♛', '♜', '♝', '♞', '♟'] },
  { name: 'Treats', items: ['🍦', '🍩', '🧁', '🍪', '🍭', '🍉', '🍓', '🍕', '🥨', '🍿', '🥞', '🍒'] },
  { name: 'Things that go', items: ['🚂', '🚁', '⛵', '🏎️', '🚲', '🛴', '🚒', '🚜', '🛶', '🎈', '🪁', '🛹'] },
  { name: 'Fun & games', items: ['⚽', '🏀', '🎨', '🎸', '🥁', '🎯', '🧩', '🎲', '🪀', '🎪', '🏆', '👑'] },
];
export const STICKERS = STICKER_PAGES.flatMap((p) => p.items);

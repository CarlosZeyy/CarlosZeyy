// Sprites pequenos como grades de caracteres (cores em palette.js, '.' = transparente).
// O personagem não fica aqui: é gerado em character.js. O cenário é desenhado em world.js.
import { COLORS } from './palette.js';

export const SPRITES = {
  // chip de skill (coletável) 12x12
  chip: [
    '...Y.Y.Y.Y..',
    '..KKKKKKKKK.',
    '.YKgggggggKY',
    '..KgdddddgK.',
    '.YKgdXgggdKY',
    '..KgdgggddK.',
    '.YKgdgggddKY',
    '..KgdddddgK.',
    '.YKgggggddKY',
    '..KKKKKKKKK.',
    '...Y.Y.Y.Y..',
    '............',
  ],
};

// Converte uma grade em retângulos [x, y, w, 1, cor] (um por sequência horizontal de mesma cor).
export function gridRects(grid, ox = 0, oy = 0) {
  const out = [];
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const ch = row[x];
      let n = 1; while (x + n < row.length && row[x + n] === ch) n++;
      if (ch !== '.') out.push([ox + x, oy + y, n, 1, COLORS[ch]]);
      x += n;
    }
  });
  return out;
}

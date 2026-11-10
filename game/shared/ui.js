// Interface (HUD, painel SYSTEM.INFO, título, faixas) como listas de retângulos [x, y, w, h, cor].
// Coordenadas de tela (384x216). Usado pelo jogo e pelo SVG do README.
import { textRects, shadowText, textWidth, LINE_H, CHAR_W } from './font.js';
import { ZONES, COLS, rowSegments } from './content.js';
import { gridRects, SPRITES } from './sprites.js';

const VIEW_W = 384, VIEW_H = 216;
export const DLG = { x: 6, y: 20, w: 372, pad: 6, bg: '#0c0c1e' };
const SEG_COLOR = { label: '#8ae8ff', dots: '#3c4070', value: '#f6f6fa' };
const center = (str, scale = 1) => Math.round((VIEW_W - textWidth(str, scale)) / 2);

export const rowY = i => DLG.y + 25 + i * LINE_H;
export const dialogHeight = (nRows, hint) => 25 + nRows * LINE_H + (hint ? LINE_H + 3 : 0) + 4;

// moldura + barra de título do painel
export function dialogFrame(title, nRows, hint) {
  const { x, y, w } = DLG, h = dialogHeight(nRows, hint);
  return [
    [x + 2, y + 3, w, h, 'rgba(8,6,24,0.45)'],
    [x, y, w, h, '#f6f6fa'], [x + 1, y + 1, w - 2, h - 2, '#2a2a5a'], [x + 2, y + 2, w - 4, h - 4, DLG.bg],
    [x + 2, y + 2, w - 4, 15, '#1c1c44'], [x + 2, y + 17, w - 4, 1, '#5a5aa0'],
    ...textRects(`SYSTEM.INFO > ${title}`, x + 7, y + 6, '#ffd860'),
    ...textRects('● LIVE', x + w - 7 - textWidth('● LIVE'), y + 6, '#ff5a5a'),
  ];
}

// uma linha do painel; maxChars limita os caracteres (efeito máquina de escrever no jogo)
export function rowRects(row, i, maxChars = Infinity) {
  const out = [];
  let col = 0;
  for (const [text, kind] of rowSegments(row)) {
    const left = maxChars - col;
    if (left <= 0) break;
    out.push(...textRects(text, DLG.x + DLG.pad + col * CHAR_W, rowY(i), SEG_COLOR[kind], 1, left));
    col += text.length;
  }
  return out;
}
export const rowLength = row => rowSegments(row).reduce((n, [t]) => n + t.length, 0);
export const rowCover = i => [DLG.x + DLG.pad, rowY(i) - 2, COLS * CHAR_W, LINE_H, DLG.bg];

export function hintRects(text, nRows) {
  const y = rowY(nRows) + 3;
  return [[DLG.x + 2, y - 4, DLG.w - 4, 1, '#2a2a5a'], ...textRects(text, DLG.x + DLG.w - 7 - textWidth(text), y, '#a8b0ff')];
}

export function hudZone(i) {
  return shadowText(`FASE ${i + 1}/4 · ${ZONES[i].name}`, 8, 7, '#f6f6fa');
}
export function hudChips(count, total) {
  const str = `${String(count).padStart(2, '0')}/${String(total).padStart(2, '0')}`;
  const x = VIEW_W - 8 - textWidth(str);
  return [...gridRects(SPRITES.chip, x - 16, 4), ...shadowText(str, x, 7, count === total ? '#ffd860' : '#f6f6fa')];
}

export function titleRects() {
  const a = 'CARLOS MOISES', b = 'FULL-STACK QUEST', c = 'UM README JOGÁVEL';
  return [
    [0, 0, VIEW_W, VIEW_H, 'rgba(10,8,30,0.5)'],
    [0, 40, VIEW_W, 82, 'rgba(10,8,30,0.93)'], [0, 40, VIEW_W, 1, '#ffd860'], [0, 121, VIEW_W, 1, '#ffd860'],
    ...textRects(a, center(a, 3) + 2, 52 + 2, '#7a3a10', 3), ...textRects(a, center(a, 3), 52, '#ffd860', 3),
    ...textRects(a, center(a, 3), 52, '#fff4b0', 3).filter(r => r[1] < 52 + 9),
    ...textRects(b, center(b, 2) + 2, 82 + 2, '#14101a', 2), ...textRects(b, center(b, 2), 82, '#f6f6fa', 2),
    ...textRects(c, center(c), 106, '#8ae8ff'),
  ];
}
export function centerText(str, y, color, scale = 1) {
  const s = scale;
  return [...textRects(str, center(str, s) + s, y + s, '#14101a', s), ...textRects(str, center(str, s), y, color, s)];
}
// faixa central: uma linha pequena em cima e uma grande embaixo
export function messageRects(small, big, color) {
  return [
    [0, 70, VIEW_W, 46, 'rgba(10,8,30,0.6)'], [0, 70, VIEW_W, 1, color], [0, 115, VIEW_W, 1, color],
    ...centerText(small, 78, '#f6f6fa'), ...centerText(big, 91, color, 2),
  ];
}
export const bannerRects = (i, color) => messageRects(`FASE ${i + 1}`, ZONES[i].name, color);
export function promptRects(x, y) {
  return [
    [x - 6, y, 13, 13, '#14101a'], [x - 5, y + 1, 11, 11, '#f6f6fa'], [x - 5, y + 10, 11, 2, '#b8b8c0'],
    [x - 1, y + 13, 3, 2, '#14101a'], [x, y + 15, 1, 1, '#14101a'],
    ...textRects('E', x - 2, y + 3, '#14101a'),
  ];
}

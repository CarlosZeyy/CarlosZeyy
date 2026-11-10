// Personagem 16-bit gerado por um esqueleto articulado.
// A cabeça é desenhada à mão (é o que dá a semelhança); corpo, braços e pernas são cápsulas
// rasterizadas a partir dos ângulos de cada pose, com sombreamento e contorno automáticos.
// Saída: grades de caracteres no mesmo formato de sprites.js (cores em palette.js).

export const PLAYER_W = 48;
export const PLAYER_H = 64;
const CX = 21;            // x do quadril (âncora horizontal do sprite)
const FLOOR = 63;         // coordenada y do chão dentro do sprite
const THIGH = 12, SHIN = 11, UPPER = 9, FORE = 8, TORSO = 17;

// tons [claro, médio, escuro] de cada material
const MAT = {
  skin: ['A', 'S', 's'],
  shirtL: ['V', 'T', 'v'],
  shirtD: ['z', 't', 'Z'],
  pants: ['p', 'P', 'J'],
  shoe: ['X', 'W', 'x'],
};

// cabeça 14x15, virada para a direita
const HEAD = [
  '....HHHHHHH...',
  '..HHhhhhhhHH..',
  '.HHhHHHHHHHHH.',
  '.HHHHHAAAAAAS.',
  'HHHHHAAAAAASS.',
  'HHHHGGGGGGGGGG',
  'HHHSsGXLGAGXLG',
  'HHHSsGLEGAGLEG',
  '.HHSSGGGGSGGGG',
  '.HHbSSSSSSAAs.',
  '..HBbSSBBBBBB.',
  '...BBbSBMMMBB.',
  '...BBBBBBBBBB.',
  '....BBBBBBBB..',
  '.....bBBBBb...',
];

const rad = d => (d * Math.PI) / 180;
const dir = a => ({ x: Math.sin(a), y: Math.cos(a) }); // ângulo 0 = para baixo, positivo = para a frente
const add = (p, v, k = 1) => ({ x: p.x + v.x * k, y: p.y + v.y * k });

function capsule(cv, a, b, ra, rb, part, matFn, opt = {}) {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy, len = Math.sqrt(len2) || 1;
  const pad = Math.max(ra, rb) + 2;
  const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) - pad)), x1 = Math.min(PLAYER_W - 1, Math.ceil(Math.max(a.x, b.x) + pad));
  const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y) - pad)), y1 = Math.min(PLAYER_H - 1, Math.ceil(Math.max(a.y, b.y) + pad));
  const hits = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const px = x + 0.5, py = y + 0.5;
    const t = len2 ? Math.min(1, Math.max(0, ((px - a.x) * dx + (py - a.y) * dy) / len2)) : 0;
    const d = Math.hypot(px - (a.x + dx * t), py - (a.y + dy * t));
    const r = ra + (rb - ra) * t;
    const u = ((px - a.x) * dy - (py - a.y) * dx) / len; // lado em relação ao eixo
    if (d <= r) hits.push([x, y, t, u]);
    else if (opt.sep && d <= r + 1 && cv[y][x] && cv[y][x].part !== part) cv[y][x].force = true; // sombra de separação
  }
  for (const [x, y, t, u] of hits) cv[y][x] = { m: matFn(t, u, x, y), part, back: !!opt.back, wide: !!opt.wide, force: !!opt.force };
}

function legGeom(thighDeg, bendDeg) {
  const th = rad(thighDeg), sh = rad(thighDeg - bendDeg);
  const knee = add({ x: 0, y: 0 }, dir(th), THIGH);
  const ankle = add(knee, dir(sh), SHIN);
  const tilt = sh * 0.6;
  const heel = { x: ankle.x - 1.2, y: ankle.y + 1.2 };
  const toe = { x: heel.x + Math.cos(tilt) * 5, y: heel.y - Math.sin(tilt) * 5 };
  return { knee, ankle, heel, toe, bottom: Math.max(heel.y, toe.y) + 1.9 };
}
const STAND_HIP = Math.round(FLOOR - legGeom(0, 0).bottom);

function drawLeg(cv, hip, g, part, opt) {
  const at = p => add(hip, p);
  capsule(cv, hip, at(g.knee), 3.3, 2.7, part, () => 'pants', opt);
  capsule(cv, at(g.knee), at(g.ankle), 2.6, 2.0, part, () => 'pants', opt);
  capsule(cv, at(g.heel), at(g.toe), 1.9, 1.6, part + 'Shoe', () => 'shoe', { ...opt, sep: true });
}

function drawArm(cv, sh, armDeg, elbowDeg, part, opt) {
  const a = rad(armDeg), f = rad(armDeg + elbowDeg);
  const elbow = add(sh, dir(a), UPPER), wrist = add(elbow, dir(f), FORE);
  capsule(cv, sh, elbow, 2.7, 2.3, part, t => (t < 0.62 ? 'shirtD' : 'skin'), opt);
  capsule(cv, elbow, wrist, 2.1, 1.8, part, () => 'skin', opt);
  capsule(cv, wrist, add(wrist, dir(f), 1.5), 2.1, 2.0, part, () => 'skin', opt);
}

// linha de 1 px por linha de tela (de cima para baixo)
function line(cv, a, b, ch, parts) {
  const y0 = Math.floor(a.y), y1 = Math.floor(b.y);
  for (let y = y0; y <= y1; y++) {
    const x = Math.floor(a.x + ((b.x - a.x) * (y - y0)) / Math.max(1, y1 - y0));
    const c = cv[y] && cv[y][x];
    if (c && parts.includes(c.part)) cv[y][x] = { ch, part: c.part };
  }
}

function render(p) {
  const cv = Array.from({ length: PLAYER_H }, () => Array(PLAYER_W).fill(null));
  const near = legGeom(p.nearThigh, p.nearKnee), far = legGeom(p.farThigh, p.farKnee);
  const hipY = p.air ? STAND_HIP : Math.round(FLOOR - Math.max(near.bottom, far.bottom));
  const hx = CX, lean = p.lean || 0;
  const sy = hipY - TORSO + (p.breath || 0);          // altura dos ombros
  const chest = { x: hx + lean, y: sy + 5.5 }, waist = { x: hx + 0.3, y: hipY - 2.5 };
  const neck = { x: chest.x + 1, y: sy - 0.5 };

  // de trás para a frente
  drawArm(cv, { x: chest.x + 3.5, y: sy + 3.5 }, p.farArm, p.farElbow, 'armF', { back: true });
  drawLeg(cv, { x: hx + 2, y: hipY }, far, 'legF', { back: true });
  capsule(cv, { x: hx - 1.5, y: hipY - 1 }, { x: hx + 2, y: hipY - 1 }, 3.6, 3.6, 'legN', () => 'pants', { sep: true });
  drawLeg(cv, { x: hx - 1.5, y: hipY }, near, 'legN', { sep: true });
  capsule(cv, chest, waist, 6.5, 5.3, 'torso', (t, u, x, y) => {
    if (Math.hypot(x + 0.5 - neck.x, y + 0.5 - neck.y) < 3.6) return 'shirtD'; // gola
    return u > 2.6 || u < -4.4 ? 'shirtD' : 'shirtL';                        // laterais escuras, painel claro
  }, { sep: true, wide: true });
  capsule(cv, { x: neck.x, y: sy + 1.5 }, { x: neck.x + 0.5, y: sy - 3 }, 2.3, 2.3, 'neck', () => 'skin', { force: true });

  // corrente
  const tip = { x: neck.x + 0.5, y: sy + 9 };
  line(cv, { x: neck.x - 3, y: sy + 1 }, tip, 'C', ['torso']);
  line(cv, { x: neck.x + 4, y: sy + 1 }, tip, 'C', ['torso']);
  line(cv, { x: tip.x, y: tip.y + 1 }, { x: tip.x, y: tip.y + 2 }, 'q', ['torso']); // pingente

  // cabeça
  const hx0 = Math.round(chest.x - 4), hy0 = Math.round(sy - 16);
  HEAD.forEach((row, gy) => [...row].forEach((ch, gx) => {
    if (ch === '.') return;
    const x = hx0 + gx, y = hy0 + gy;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y + 1]]) {
      const c = cv[ny] && cv[ny][nx];
      if (c && c.part !== 'head') c.force = true;
    }
    cv[y][x] = { ch, part: 'head' };
  }));

  drawArm(cv, { x: chest.x - 2.5, y: sy + 3.5 }, p.nearArm, p.nearElbow, 'armN', { sep: true });

  // tons
  const same = (c, x, y) => cv[y] && cv[y][x] && cv[y][x].part === c.part;
  const out = cv.map((row, y) => row.map((c, x) => {
    if (!c) return '.';
    if (c.ch) return c.ch;
    let tone = 1;
    if (!same(c, x - 1, y) || !same(c, x, y + 1)) tone = 2;
    else if (!same(c, x + 1, y) || !same(c, x, y - 1)) tone = 0;
    else if (c.wide && !same(c, x - 2, y)) tone = 2;
    if (c.force) tone = 2;
    if (c.back) tone = Math.min(2, tone + 1);
    if (c.m === 'shoe' && !same(c, x, y + 1)) return 'q'; // sola
    return MAT[c.m][tone];
  }));

  // contorno
  return out.map((row, y) => row.map((ch, x) => {
    if (ch !== '.') return ch;
    const f = (xx, yy) => out[yy] && out[yy][xx] && out[yy][xx] !== '.';
    return f(x - 1, y) || f(x + 1, y) || f(x, y - 1) || f(x, y + 1) ? 'K' : '.';
  }).join(''));
}

const WALK_FRAMES = 8;
function walkPose(i) {
  const ph = (i / WALK_FRAMES) * Math.PI * 2;
  const leg = a => ({ thigh: 30 * Math.sin(a), knee: 5 + 50 * Math.max(0, Math.cos(a)) });
  const arm = s => ({ arm: -24 * s, elbow: 15 + 20 * Math.max(0, -s) });
  const n = leg(ph), f = leg(ph + Math.PI), an = arm(Math.sin(ph)), af = arm(-Math.sin(ph));
  return {
    nearThigh: n.thigh, nearKnee: n.knee, farThigh: f.thigh, farKnee: f.knee,
    nearArm: an.arm, nearElbow: an.elbow, farArm: af.arm, farElbow: af.elbow, lean: 1,
  };
}
const STAND = { nearThigh: -5, nearKnee: 3, farThigh: 7, farKnee: 3, nearArm: -4, nearElbow: 10, farArm: 6, farElbow: 10 };

export function buildPlayer() {
  return {
    w: PLAYER_W, h: PLAYER_H, footX: CX, floorY: FLOOR,
    idle: [render(STAND), render({ ...STAND, breath: 1 })],
    walk: Array.from({ length: WALK_FRAMES }, (_, i) => render(walkPose(i))),
    jump: render({ nearThigh: 55, nearKnee: 75, farThigh: -20, farKnee: 35, nearArm: 85, nearElbow: 50, farArm: -35, farElbow: 30, lean: 1, air: true }),
    // apontando para o objeto (painel aberto) e comemorando (final)
    point: render({ ...STAND, nearArm: 62, nearElbow: 38 }),
    cheer: [
      render({ ...STAND, nearArm: 205, nearElbow: -25, farArm: 150, farElbow: 25 }),
      render({ ...STAND, nearArm: 222, nearElbow: -30, farArm: 130, farElbow: 35, breath: 1 }),
    ],
    fall: render({ nearThigh: 22, nearKnee: 25, farThigh: -12, farKnee: 30, nearArm: 55, nearElbow: 30, farArm: -50, farElbow: 20, air: true }),
  };
}

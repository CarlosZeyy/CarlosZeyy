// Gera assets/hero-dark.svg e assets/hero-light.svg a partir de mask.json
const fs = require('fs');
const path = require('path');
const mask = JSON.parse(fs.readFileSync(path.join(__dirname, 'mask.json'), 'utf8'));
const { GW, GH } = mask;
const OUTDIR = process.argv[2] || path.join(__dirname, 'out');
fs.mkdirSync(OUTDIR, { recursive: true });

// PRNG determinístico para o resultado ser reproduzível
let seed = 20250923;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Paleta monocromática (preto e branco)
const THEMES = {
  dark: {
    outer: '#000000', panelA: '#0A0A0A', panelB: '#0E0E0E', bar: '#111111', line: 'rgba(255,255,255,0.10)',
    muted: '#7A7A7A', accent: '#A3A3A3', accentRGBA: 'rgba(255,255,255,0.18)', boxFill: '#0A0A0A',
    pixel: '#E5E5E5', value: '#FFFFFF', leader: 'rgba(255,255,255,0.18)', pillBg: '#FFFFFF', pillFg: '#000000',
    live: '#FFFFFF', lights: ['#3F3F3F', '#5A5A5A', '#7A7A7A'], grad: ['#333333', '#FFFFFF', '#333333'],
  },
  light: {
    outer: '#E5E5E5', panelA: '#FFFFFF', panelB: '#FAFAFA', bar: '#F5F5F5', line: 'rgba(0,0,0,0.10)',
    muted: '#8A8A8A', accent: '#525252', accentRGBA: 'rgba(0,0,0,0.20)', boxFill: '#FFFFFF',
    pixel: '#171717', value: '#000000', leader: 'rgba(0,0,0,0.22)', pillBg: '#171717', pillFg: '#FFFFFF',
    live: '#000000', lights: ['#C4C4C4', '#A8A8A8', '#8A8A8A'], grad: ['#D4D4D4', '#171717', '#D4D4D4'],
  },
};

// ---------- conteúdo ----------
const TITLE = 'carloszeyy@github:~ % ./profile.sh --live';
const PILL = 'carlosmoisesdev@gmail.com';
const ROWS = [
  ['Subject', 'Carlos Moises Mariano Lopes Ferreira'],
  ['Role', 'Full-Stack Developer & Analista de Sistemas'],
  ['Origin', 'Santo André, SP, Brasil'],
  ['Work', 'Analista de Sistemas @ Systelos'],
  ['Education', 'Tecnólogo em ADS · Estácio (2025–2027)'],
  ['Shipping', 'Enfermex · MV Vidros · Systelos'],
  ['ToolChain', 'VS Code, Git, Docker, Jest, Postman, Jira'],
  ['Core.Lang', 'TypeScript, JavaScript, Java, SQL'],
  ['Core.Frontend', 'React, Next.js, Vite, Tailwind CSS'],
  ['Core.Backend', 'Node.js, Express, Java, Spring Boot, REST'],
  ['Core.Database', 'PostgreSQL, Supabase, MySQL, MongoDB'],
  ['Core.Infra', 'Docker, GitHub Actions, Azure, Linux, Vercel'],
  ['- Contact', null],
  ['Grid.Mail', 'carlosmoisesdev@gmail.com'],
  ['Grid.Portfolio', 'carlosmoises.dev'],
  ['Grid.LinkedIn', 'in/carlosmoisesdev'],
  ['Grid.GitHub', '@CarlosZeyy'],
];
const FOOTER = 'Mais sobre mim & projetos abaixo no README';
const COLS = 78;              // caracteres por linha (monoespaçado)
const TEXT_W = 655;           // largura forçada da linha

// ---------- geometria ----------
const W = 1180, H = 610;
const BOX = { x: 36, y: 84, w: 400, h: 492 };
const SC = 1.2;
const TX = BOX.x + (BOX.w - GW * SC) / 2, TY = BOX.y + (BOX.h - GH * SC) / 2;
const LOOP = 13.9, START = 3.2;
const KT = [0, 0.194, 0.288, 0.432, 0.525, 0.669, 0.763, 0.906, 1].map(v => v.toFixed(3)).join(';');

// ---------- pixels -> runs ----------
// tema escuro usa "rows" (claros viram pontos); tema claro usa "rowsLight" (escuros viram pontos)
function pixelsOf(rows) {
  const runs = [], onPixels = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < GW) {
      if (row[x] === '1') {
        let n = 1; while (x + n < GW && row[x + n] === '1') n++;
        runs.push({ x, y, n }); for (let k = 0; k < n; k++) onPixels.push([x + k, y]); x += n;
      } else x++;
    }
  });
  return { runs, onPixels };
}
const PIXELS = { dark: pixelsOf(mask.rows), light: pixelsOf(mask.rowsLight || mask.rows) };
const runPath = rs => rs.map(r => `M${r.x} ${r.y}h${r.n}v1h-${r.n}z`).join('');

// ---------- formas para os pontos viajantes ----------
const N = 750;
const CX = GW / 2, CY = GH * 0.46;
function samplePolylines(segs, n, jitter) {
  // segs: [[x0,y0,x1,y1], ...]  -> n pontos proporcionais ao comprimento
  const lens = segs.map(([a, b, c, d]) => Math.hypot(c - a, d - b));
  const total = lens.reduce((s, l) => s + l, 0);
  const pts = [];
  segs.forEach(([a, b, c, d], i) => {
    const k = Math.round(n * lens[i] / total);
    for (let j = 0; j < k; j++) {
      const t = (j + 0.5) / k;
      pts.push([CX + a + (c - a) * t + (rnd() - 0.5) * 2 * jitter, CY + b + (d - b) * t + (rnd() - 0.5) * 2 * jitter]);
    }
  });
  while (pts.length < n) pts.push(pts[(rnd() * pts.length) | 0]);
  return pts.slice(0, n);
}
function curve(fn, t0, t1, steps) {
  const s = []; let p = fn(t0);
  for (let i = 1; i <= steps; i++) { const q = fn(t0 + (t1 - t0) * i / steps); s.push([p[0], p[1], q[0], q[1]]); p = q; }
  return s;
}

// 1) átomo do React
function reactShape() {
  const segs = [];
  for (let k = 0; k < 3; k++) {
    const a = (k * 60) * Math.PI / 180;
    segs.push(...curve(t => {
      const x = 105 * Math.cos(t), y = 40 * Math.sin(t);
      return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
    }, 0, Math.PI * 2, 90));
  }
  const pts = samplePolylines(segs, N - 50, 1.2);
  for (let i = 0; i < 50; i++) { const r = 10 * Math.sqrt(rnd()), t = rnd() * Math.PI * 2; pts.push([CX + r * Math.cos(t), CY + r * Math.sin(t)]); }
  return shuffle(pts);
}
// 2) glifo </>
function codeShape() {
  const segs = [
    [-95, 0, -40, -62], [-95, 0, -40, 62],
    [95, 0, 40, -62], [95, 0, 40, 62],
    [-22, 80, 22, -80],
  ];
  return shuffle(samplePolylines(segs, N, 3));
}
// 3) xícara de café (Java)
function javaShape() {
  const segs = [];
  segs.push(...curve(t => [62 * Math.cos(t), -20 + 12 * Math.sin(t)], 0, Math.PI * 2, 60));               // borda superior
  segs.push([-62, -20, -50, 55], [62, -20, 50, 55]);                                                        // laterais
  segs.push(...curve(t => [50 * Math.cos(t), 55 + 12 * Math.sin(t)], 0, Math.PI, 30));                     // fundo
  segs.push(...curve(t => [62 + 26 * Math.cos(t), 15 + 30 * Math.sin(t)], -Math.PI / 2, Math.PI / 2, 30)); // alça
  segs.push(...curve(t => [88 * Math.cos(t), 74 + 10 * Math.sin(t)], 0, Math.PI * 2, 60));                  // pires
  for (const sx of [-26, 0, 26]) segs.push(...curve(t => [sx + 6 * Math.sin(t * 4), -42 - 55 * t], 0, 1, 24)); // vapor
  return shuffle(samplePolylines(segs, N, 1.6));
}
const shapes = [reactShape(), codeShape(), javaShape()];

// ---------- montagem do SVG ----------
function build(theme) {
  const T = THEMES[theme];
  const { runs, onPixels } = PIXELS[theme];
  seed = 777; // mesma sequência aleatória para os dois temas
  const starts = shuffle(onPixels.slice()).slice(0, N);
  const f = v => (Math.round(v * 10) / 10).toString();
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace" role="img" aria-label="Carlos Moises — profile.sh --live">`);
  out.push(`<title>Carlos Moises — desenvolvedor full stack</title>`);
  out.push(`<defs>
<linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="${T.grad[0]}"><animate attributeName="stop-color" values="${T.grad[0]};${T.grad[1]};${T.grad[2]};${T.grad[0]}" dur="10s" repeatCount="indefinite"/></stop>
  <stop offset="0.5" stop-color="${T.grad[1]}"><animate attributeName="stop-color" values="${T.grad[1]};${T.grad[2]};${T.grad[0]};${T.grad[1]}" dur="10s" repeatCount="indefinite"/></stop>
  <stop offset="1" stop-color="${T.grad[2]}"><animate attributeName="stop-color" values="${T.grad[2]};${T.grad[0]};${T.grad[1]};${T.grad[2]}" dur="10s" repeatCount="indefinite"/></stop>
</linearGradient>
<linearGradient id="panelGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${T.panelA}"/><stop offset="1" stop-color="${T.panelB}"/></linearGradient>
<filter id="glow8" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="8"/></filter>
<filter id="glow3" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="txtGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="0.9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<clipPath id="winClip"><rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="18"/></clipPath>
<clipPath id="boxClip"><rect x="${BOX.x}" y="${BOX.y}" width="${BOX.w}" height="${BOX.h}" rx="10"/></clipPath>
<rect id="tv" width="2.2" height="2" rx="0.6" fill="${T.pixel}"/>
</defs>`);
  // janela
  out.push(`<rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="18" fill="${T.outer}"/>`);
  out.push(`<g clip-path="url(#winClip)">`);
  out.push(`<rect x="2" y="2" width="${W - 4}" height="${H - 4}" fill="url(#panelGrad)"/>`);
  out.push(`<rect x="2" y="2" width="${W - 4}" height="46" fill="${T.bar}"/>`);
  out.push(`<line x1="2" y1="48" x2="${W - 2}" y2="48" stroke="${T.line}"/>`);
  out.push(`<circle cx="30" cy="25" r="5.5" fill="${T.lights[0]}"/><circle cx="50" cy="25" r="5.5" fill="${T.lights[1]}"/><circle cx="70" cy="25" r="5.5" fill="${T.lights[2]}"/>`);
  out.push(`<text x="${W / 2}" y="29" text-anchor="middle" font-size="12" fill="${T.muted}">${esc(TITLE)}</text>`);
  // caixa do retrato
  out.push(`<text x="38" y="74" font-size="10" letter-spacing="3" fill="${T.muted}">VISUAL.MAP</text>`);
  out.push(`<rect x="${BOX.x}" y="${BOX.y}" width="${BOX.w}" height="${BOX.h}" rx="10" fill="none" stroke="${T.accent}" stroke-width="2" opacity="0.45" filter="url(#glow3)"/>`);
  out.push(`<rect x="${BOX.x}" y="${BOX.y}" width="${BOX.w}" height="${BOX.h}" rx="10" fill="${T.boxFill}" stroke="${T.accentRGBA}"/>`);
  const c = 14, { x, y, w, h } = BOX;
  out.push(`<!-- cantos -->`);
  out.push(`<path d="M ${x} ${y + c} L ${x} ${y} L ${x + c} ${y}" fill="none" stroke="${T.accent}" stroke-width="2" opacity="0.8"/>`);
  out.push(`<path d="M ${x + w - c} ${y} L ${x + w} ${y} L ${x + w} ${y + c}" fill="none" stroke="${T.accent}" stroke-width="2" opacity="0.8"/>`);
  out.push(`<path d="M ${x} ${y + h - c} L ${x} ${y + h} L ${x + c} ${y + h}" fill="none" stroke="${T.accent}" stroke-width="2" opacity="0.8"/>`);
  out.push(`<path d="M ${x + w - c} ${y + h} L ${x + w} ${y + h} L ${x + w} ${y + h - c}" fill="none" stroke="${T.accent}" stroke-width="2" opacity="0.8"/>`);

  out.push(`<g clip-path="url(#boxClip)">`);
  const G = `transform="translate(${f(TX)},${f(TY)}) scale(${SC})"`;
  // Camada 1: shimmer de entrada (0 -> 3.2s)
  out.push(`<!-- Camada 1: shimmer de entrada -->`);
  out.push(`<g ${G} fill="${T.pixel}" shape-rendering="crispEdges">`);
  out.push(`<set attributeName="opacity" to="0" begin="${START}s"/>`);
  const NG = 30, groups = Array.from({ length: NG }, () => []);
  runs.forEach(r => groups[(rnd() * NG) | 0].push(r));
  groups.forEach((g, i) => {
    const b = (0.20 + i * 0.027).toFixed(2);
    out.push(`<g opacity="0"><animate attributeName="opacity" values="0;1" dur="0.9s" begin="${b}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".4 0 .2 1"/><path d="${runPath(g)}"/></g>`);
  });
  out.push(`</g>`);
  // Camada 2: retrato em faixas com glitch (loop)
  out.push(`<!-- Camada 2: retrato em faixas (loop) -->`);
  out.push(`<g ${G} fill="${T.pixel}" shape-rendering="crispEdges" opacity="0">`);
  out.push(`<set attributeName="opacity" to="1" begin="${START}s"/>`);
  const BH = 4;
  for (let y0 = 0; y0 < GH; y0 += BH) {
    const band = runs.filter(r => r.y >= y0 && r.y < y0 + BH);
    if (!band.length) continue;
    const dx = Math.round((rnd() - 0.5) * 90), dy = Math.round((rnd() - 0.5) * 90);
    const tr = `0 0;0 0;${dx} ${dy};${dx} ${dy};${dx} ${dy};${dx} ${dy};${dx} ${dy};${dx} ${dy};0 0`;
    out.push(`<g opacity="1"><animate attributeName="opacity" values="1;1;0;0;0;0;0;0;1" keyTimes="${KT}" dur="${LOOP}s" begin="${START}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="${tr}" keyTimes="${KT}" dur="${LOOP}s" begin="${START}s" repeatCount="indefinite"/><path d="${runPath(band)}"/></g>`);
  }
  out.push(`</g>`);
  // Camada 3: pontos viajantes (retrato -> React -> </> -> Java -> retrato)
  out.push(`<!-- Camada 3: pontos viajantes (React -> code -> Java) -->`);
  out.push(`<g ${G}>`);
  for (let i = 0; i < N; i++) {
    const s = starts[i], p1 = shapes[0][i], p2 = shapes[1][i], p3 = shapes[2][i];
    const P = p => `${f(p[0])} ${f(p[1])}`;
    const tr = `${P(s)};${P(s)};${P(p1)};${P(p1)};${P(p2)};${P(p2)};${P(p3)};${P(p3)};${P(s)}`;
    out.push(`<use href="#tv" xlink:href="#tv" opacity="0"><animate attributeName="opacity" values="0;0;1;1;1;1;1;1;0" keyTimes="${KT}" dur="${LOOP}s" begin="${START}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="${tr}" keyTimes="${KT}" dur="${LOOP}s" begin="${START}s" repeatCount="indefinite"/></use>`);
  }
  out.push(`</g>`);
  out.push(`</g>`); // boxClip

  // Painel SYSTEM.INFO
  const PX = 470, PR = 1125;
  out.push(`<!-- SYSTEM.INFO -->`);
  out.push(`<text x="${PX}" y="106" font-size="13" letter-spacing="2" fill="${T.accent}" filter="url(#txtGlow)">SYSTEM.INFO</text>`);
  out.push(`<line x1="566" y1="102" x2="1061" y2="102" stroke="${T.line}"/>`);
  out.push(`<text x="${PR}" y="106" text-anchor="end" font-size="12" fill="${T.live}" font-weight="700"><tspan>&#9679;</tspan> LIVE<animate attributeName="opacity" values="1;0.25;1" dur="1.6s" repeatCount="indefinite"/></text>`);
  const pillW = Math.round(PILL.length * 7.9 + 18);
  out.push(`<rect x="${PX}" y="122" width="${pillW}" height="20" rx="4" fill="${T.pillBg}"/>`);
  out.push(`<text x="${PX + 9}" y="136" font-size="13" font-weight="700" fill="${T.pillFg}">${esc(PILL)}</text>`);
  out.push(`<line x1="${PX + pillW + 10}" y1="130" x2="${PR}" y2="130" stroke="${T.line}"/>`);
  const pitch = ROWS.length > 17 ? 23 : 24.5;
  ROWS.forEach(([label, value], i) => {
    const yy = f(162 + i * pitch), b = (0.8 + i * 0.1).toFixed(2);
    let inner;
    if (value === null) {
      const dashes = '-'.repeat(Math.max(0, COLS - label.length - 1));
      inner = `<tspan fill="${T.muted}">${esc(label)} </tspan><tspan fill="${T.leader}">${dashes}</tspan>`;
    } else {
      const dots = '.'.repeat(Math.max(3, COLS - label.length - value.length - 2));
      inner = `<tspan fill="${T.accent}">${esc(label)} </tspan><tspan fill="${T.leader}">${dots}</tspan><tspan fill="${T.value}" font-weight="600"> ${esc(value)}</tspan>`;
    }
    out.push(`<g opacity="0"><animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="${b}s" fill="freeze"/><animateTransform attributeName="transform" type="translate" values="-8 0;0 0" dur="0.4s" begin="${b}s" fill="freeze"/><text x="${PX}" y="${yy}" font-size="14" textLength="${TEXT_W}" lengthAdjust="spacingAndGlyphs" xml:space="preserve">${inner}</text></g>`);
  });
  out.push(`<text x="${PX}" y="577" font-size="14" fill="${T.muted}">&#9656; ${esc(FOOTER)} &#8595; <tspan fill="${T.accent}">&#9608;<animate attributeName="fill-opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/></tspan></text>`);
  out.push(`</g>`); // winClip
  // borda com gradiente animado
  out.push(`<rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="17" fill="none" stroke="url(#accent)" stroke-width="3" opacity="0.35" filter="url(#glow8)"/>`);
  out.push(`<rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="17" fill="none" stroke="url(#accent)" stroke-width="1.6"/>`);
  out.push(`</svg>`);
  return out.join('\n');
}

for (const theme of ['dark', 'light']) {
  const svg = build(theme);
  const file = path.join(OUTDIR, `hero-${theme}.svg`);
  fs.writeFileSync(file, svg);
  console.log(`${file}: ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
}

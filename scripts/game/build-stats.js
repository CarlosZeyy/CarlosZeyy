// Gera um card "PLAYER STATS" em SVG, no estilo do jogo, com dados da API do GitHub.
// Uso: GITHUB_TOKEN=... node build-stats.js <saida.svg> [login]
// Roda no GitHub Actions (workflow snake.yml) e publica no branch output.
import fs from 'node:fs';
import path from 'node:path';
import { textRects, textWidth, CHAR_W, LINE_H } from '../../game/shared/font.js';
import { buildPlayer } from '../../game/shared/character.js';
import { gridRects } from '../../game/shared/sprites.js';
import { rectsToPaths } from './raster.js';

const OUT = path.resolve(process.argv[2] || 'stats.svg');
const LOGIN = process.argv[3] || process.env.GITHUB_REPOSITORY_OWNER || 'CarlosZeyy';
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) { console.error('defina GITHUB_TOKEN'); process.exit(1); }

const QUERY = `query($login: String!) {
  user(login: $login) {
    createdAt
    followers { totalCount }
    pullRequests { totalCount }
    issues { totalCount }
    contributionsCollection {
      totalCommitContributions
      restrictedContributionsCount
      contributionCalendar { totalContributions }
    }
    repositories(ownerAffiliations: OWNER, isFork: false, first: 100, orderBy: { field: PUSHED_AT, direction: DESC }) {
      totalCount
      nodes {
        stargazerCount
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name color } } }
      }
    }
  }
}`;

const res = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: { Authorization: `bearer ${TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'profile-stats-card' },
  body: JSON.stringify({ query: QUERY, variables: { login: LOGIN } }),
});
const json = await res.json();
if (!res.ok || json.errors || !json.data?.user) { console.error('falha na API do GitHub:', JSON.stringify(json.errors || json).slice(0, 400)); process.exit(1); }
const u = json.data.user;

const langs = new Map();
let stars = 0;
for (const repo of u.repositories.nodes) {
  stars += repo.stargazerCount;
  for (const { size, node } of repo.languages.edges) {
    const l = langs.get(node.name) || { name: node.name, color: node.color || '#8a84c0', size: 0 };
    l.size += size; langs.set(node.name, l);
  }
}
const totalSize = [...langs.values()].reduce((n, l) => n + l.size, 0) || 1;
const top = [...langs.values()].sort((a, b) => b.size - a.size).slice(0, 6).map(l => ({ ...l, pct: (l.size / totalSize) * 100 }));
const cc = u.contributionsCollection;
const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const years = Math.max(1, Math.floor((Date.now() - new Date(u.createdAt)) / (365.25 * 24 * 3600 * 1000)));
const rows = [
  ['CONTRIBUIÇÕES · ANO', fmt(cc.contributionCalendar.totalContributions)],
  ['COMMITS · ANO', fmt(cc.totalCommitContributions + cc.restrictedContributionsCount)],
  ['PULL REQUESTS', fmt(u.pullRequests.totalCount)],
  ['ISSUES', fmt(u.issues.totalCount)],
  ['REPOSITÓRIOS', fmt(u.repositories.totalCount)],
  stars > 0 ? ['STARS', fmt(stars)] : ['SEGUIDORES', fmt(u.followers.totalCount)],
];

// ---------- desenho ----------
const VW = 384, PADX = 8, TOP = 26, VH = TOP + rows.length * LINE_H + 8;
const BG = '#0c0c1e';
const r = [];
r.push([0, 0, VW, VH, '#f6f6fa'], [1, 1, VW - 2, VH - 2, '#2a2a5a'], [2, 2, VW - 4, VH - 4, BG]);
r.push([2, 2, VW - 4, 15, '#1c1c44'], [2, 17, VW - 4, 1, '#5a5aa0']);
r.push(...textRects(`SYSTEM.INFO > PLAYER STATS · LVL ${String(years).padStart(2, '0')}`, PADX, 6, '#ffd860'));
r.push(...textRects('● LIVE', VW - PADX - textWidth('● LIVE'), 6, '#ff5a5a'));

// personagem à esquerda, recortado da cintura para cima
const P = buildPlayer();
const bust = gridRects(P.idle[0].slice(0, 40), 2 - 10, TOP - 6).filter(([x]) => x >= 2);
r.push([2, 18, 34, VH - 20, '#14143a'], [36, 18, 1, VH - 20, '#2a2a5a']);
r.push(...bust.filter(([, y]) => y < VH - 2));

// coluna de números
const LX = 44, LCOLS = 28;
rows.forEach(([label, value], i) => {
  const y = TOP + i * LINE_H;
  const dots = '.'.repeat(Math.max(2, LCOLS - label.length - value.length - 2));
  r.push(...textRects(label, LX, y, '#8ae8ff'));
  r.push(...textRects(dots, LX + (label.length + 1) * CHAR_W, y, '#3c4070'));
  r.push(...textRects(value, LX + (LCOLS - value.length) * CHAR_W, y, '#f6f6fa'));
});

// coluna de linguagens: nome, barra, porcentagem
const RX = LX + LCOLS * CHAR_W + 12, NAME = 10, BAR_X = RX + NAME * CHAR_W + 4, BAR_W = VW - PADX - BAR_X - 6 * CHAR_W;
const maxPct = Math.max(...top.map(l => l.pct), 1);
r.push([RX - 7, 22, 1, VH - 28, '#2a2a5a']);
top.forEach((l, i) => {
  const y = TOP + i * LINE_H, pct = `${l.pct.toFixed(1)}%`;
  r.push(...textRects(l.name.slice(0, NAME), RX, y, '#f6f6fa'));
  r.push([BAR_X, y, BAR_W, 7, '#1c1c44']);
  const w = Math.max(2, Math.round((l.pct / maxPct) * BAR_W));
  r.push([BAR_X, y, w, 7, l.color], [BAR_X, y, w, 1, 'rgba(255,255,255,0.35)'], [BAR_X, y + 6, w, 1, 'rgba(0,0,0,0.3)']);
  r.push(...textRects(pct, VW - PADX - textWidth(pct), y, '#a8b0ff'));
});

const SX = 8, SY = 22, W = VW + SX * 2, H = VH + SY + 8;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * 3}" height="${H * 3}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges" role="img" aria-label="Estatísticas do GitHub de ${LOGIN}">
<title>Estatísticas do GitHub de ${LOGIN}</title>
<desc>${rows.map(([a, b]) => `${a}: ${b}`).join('; ')}. Linguagens: ${top.map(l => `${l.name} ${l.pct.toFixed(1)}%`).join(', ')}.</desc>
<style>@keyframes live{0%{opacity:1}50%{opacity:.25}100%{opacity:1}}.live{animation:live 1.6s linear infinite}</style>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="7" fill="#0a0816" stroke="#3a3470" shape-rendering="geometricPrecision"/>
<g shape-rendering="geometricPrecision"><circle cx="14" cy="11" r="2.6" fill="#ff5a5a"/><circle cx="23" cy="11" r="2.6" fill="#ffd860"/><circle cx="32" cy="11" r="2.6" fill="#58f090"/>
<text x="${W / 2}" y="13.5" text-anchor="middle" font-family="ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace" font-size="6.5" fill="#8a84c0">carloszeyy@github:~ % ./stats.sh --live</text></g>
<g transform="translate(${SX},${SY})">${rectsToPaths(r)}<rect class="live" x="${VW - PADX - textWidth('● LIVE') - 1}" y="5" width="7" height="9" fill="#1c1c44"/></g>
</svg>
`;
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, svg);
console.log(`${OUT}: ${(svg.length / 1024).toFixed(0)} KB · ${rows.map(([a, b]) => `${a}=${b}`).join(' · ')} · ${top.map(l => l.name).join(', ')}`);

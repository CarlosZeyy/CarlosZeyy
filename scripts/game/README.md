# Ferramentas do Full-Stack Quest

O jogo fica em `game/` (publicado no GitHub Pages) e não tem build nem dependências.
Tudo o que é desenhado sai de `game/shared/`, usado tanto pelo jogo quanto pelo SVG do README:

| Arquivo | O que tem |
|---|---|
| `content.js` | Textos: fases, paradas (placas, prédios, terminais), skills e links |
| `world.js` | Cenário das 4 fases em retângulos, mais fontes de luz, luzes que piscam, carros e a camada de primeiro plano |
| `character.js` | Personagem: cabeça desenhada à mão + corpo articulado por poses |
| `ui.js` | HUD, painel SYSTEM.INFO, tela de título |
| `font.js` | Fonte bitmap 5x7 com acentos |
| `palette.js`, `sprites.js` | Cores e sprites pequenos |

Comandos, rodados nesta pasta (só Node, sem `npm install`):

- `node build-svg.js` gera `assets/game.svg`, o hero animado do README.
  Depois de gerar, aumente o `?v=` da URL no `README.md` para furar o cache do GitHub.
- `node serve.js` sobe o jogo em `http://127.0.0.1:4173/game/` (módulos ES não abrem via `file://`).
- `GITHUB_TOKEN=$(gh auth token) node build-stats.js out/stats.svg` gera o card PLAYER STATS (no GitHub Actions ele roda sozinho a cada 12 h).
- `node preview.js` gera `out/sprites.png` (folha do personagem) e `out/walk.html` (animação).
- `node shots.js` gera `out/shot-*.png`, quadros estáticos de cada fase.

Para mudar um texto ou link, edite `content.js` e rode `node build-svg.js`; o jogo já lê o mesmo arquivo.

## Como o visual é montado

O pixel art é desenhado em 384x216 e ampliado sem suavização. Em volta dele, `game/game.js` compõe em alta
resolução o céu em degradê com sol e lua, a névoa de profundidade, o brilho das fontes de luz, o reflexo no
chão, o clima de cada fase (chuva, partículas, neblina), o bloom e a vinheta. O SVG do README repete o que dá
para fazer sem JavaScript: degradês, brilhos, névoa, chuva e vinheta, e é gerado sem a granulação fina
(`buildWorld({ texture: false })`) para o arquivo ficar leve.

## Ideias para depois

- Decidir se `scripts/hero/` e `assets/hero-*.svg` (hero antigo, fora de uso) podem ser apagados.
- Música ou som ambiente opcional; hoje só há efeitos curtos.
- Mais poses do personagem (digitar, acenar) e inimigos ou desafios opcionais na fase de skills.
- Versão em inglês dos textos de `content.js`.

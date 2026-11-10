# Ferramentas do Full-Stack Quest

O jogo fica em `game/` (publicado no GitHub Pages) e não tem build nem dependências.
Tudo o que é desenhado sai de `game/shared/`, usado tanto pelo jogo quanto pelo SVG do README:

| Arquivo | O que tem |
|---|---|
| `content.js` | Textos: fases, paradas (placas, prédios, terminais), skills e links |
| `world.js` | Cenário das 4 fases, em retângulos |
| `character.js` | Personagem: cabeça desenhada à mão + corpo articulado por poses |
| `ui.js` | HUD, painel SYSTEM.INFO, tela de título |
| `font.js` | Fonte bitmap 5x7 com acentos |
| `palette.js`, `sprites.js` | Cores e sprites pequenos |

Comandos, rodados nesta pasta (só Node, sem `npm install`):

- `node build-svg.js` gera `assets/game.svg`, o hero animado do README.
  Depois de gerar, aumente o `?v=` da URL no `README.md` para furar o cache do GitHub.
- `node serve.js` sobe o jogo em `http://127.0.0.1:4173/game/` (módulos ES não abrem via `file://`).
- `node preview.js` gera `out/sprites.png` (folha do personagem) e `out/walk.html` (animação).
- `node shots.js` gera `out/shot-*.png`, quadros estáticos de cada fase.

Para mudar um texto ou link, edite `content.js` e rode `node build-svg.js`; o jogo já lê o mesmo arquivo.

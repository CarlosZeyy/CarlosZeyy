# Gerador do hero animado

Dois passos, rodados dentro desta pasta (`npm install` antes, uma vez):

1. `node dither.js <caminho-da-foto.png> mask.json`
   Remove o fundo (precisa ser liso), reamostra para 310x406 e aplica dithering.
   Gera `mask.json` com duas máscaras (tema escuro e tema claro, esta invertida) e as prévias `mask-dark.png` e `mask-light.png`.
2. `node build.js ../../assets`
   Monta `hero-dark.svg` e `hero-light.svg` com as animações e o painel SYSTEM.INFO.

Para mudar textos do painel, edite `ROWS`, `TITLE`, `PILL` e `FOOTER` em `build.js` e rode só o passo 2.
Depois de trocar os SVGs, aumente o `?v=` das URLs no README para furar o cache do GitHub.

# PLANO — Biblioteca de Epubs

Gestor de biblioteca de epubs organizada por séries. Aplicação desktop (Electron) para Linux, empacotada em AppImage.

## Objetivo
- O utilizador aponta para uma pasta raiz contendo subpastas (séries), cada uma com vários volumes `.epub`.
- A app lista as pastas como séries, mostrando a capa do primeiro volume.
- Ao clicar numa série, lista todos os volumes disponíveis.
- Cada volume pode ser marcado como **lido / não lido / pendente**.
- O estado de leitura é persistente (JSON em `userData`).

## Decisões
- **Electron** — AppImage para Linux; Node.js já instalado (Tauri exigiria Rust).
- **Persistência**: JSON (`userData/biblioteca.json`).
- **Capas**: extraídas de dentro do EPUB; estratégia em camadas com fallback total (meta cover → properties="cover-image" → item nomeado cover → cover xhtml → maior imagem no manifest → pickCoverFromZip). Guardadas em cache em `userData/covers`.
- **Parser XML**: `@xmldom/xmldom` — manipula bem namespaces (`ns0:`, `opf:`) e BOM (replaced xml2js).
- **Leitura de EPUB**: `adm-zip` (ZIP).
- **Estado de leitura**: armazenado por volume, keyed por hash do caminho do ficheiro.

## Estrutura
```
biblioteca/
├── package.json          # config Electron + electron-builder (AppImage)
├── src/
│   ├── main.js           # processo principal: scan, capas, persistência
│   ├── preload.js        # ponte contextBridge (window.api)
│   └── renderer/
│       ├── index.html
│       ├── styles.css
│       └── renderer.js   # UI: grid de séries, detalhe da série
├── PLANO.md
└── TODO.md
```

## Registro de Alterações
- **[2026-08-12]** Estrutura inicial criada; scan de séries/volumes; extração de capas; estado lido/não lido/pendente persistente; UI base (grid + detalhe).
- **[2026-08-12]** Refactor: lógica de scan movida para `src/library.js` (testável com Node puro). Testes automáticos com Node e hooks de screenshot/estado via env vars (`TEST_SCREENSHOT`, `TEST_ROOT`, `TEST_USERDATA`). Verificado: scan, capas, persistência de estado.
- **[2026-08-12]** Teste de execução em ambiente gráfico: app arranca com `--disable-gpu` (GPU não disponível no ambiente de teste; não é problema em máquinas normais).
- **[2026-08-12]** **AppImage gerado** com electron-builder: `dist/BibliotecaEpub-1.0.0.AppImage` (verificado a arrancar com `--appimage-extract-and-run`). Ícone gerado em `build/icon.png`.

## Notas de Teste
- Gerar biblioteca de exemplo: `node test/generate-test-library.js <destino>`.
- Testar scan: `node -e "..."` com `require('./src/library')`.
- Testar UI: `TEST_SCREENSHOT=/tmp/s.png TEST_ROOT=<pasta> TEST_USERDATA=/tmp/ud npx electron . --no-sandbox --disable-gpu`.


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
- **[2026-08-14]** **Plano v1.1.2**: Memory cache para capas (3-4h), Lazy-load via Intersection Observer (2-3h), Throttling para bibliotecas >500 volumes (4-5h). Implementação priorizada: cache + lazy-load juntos. Estimativa total: ~15h.
- **[2026-08-14]** **Fix capas não-image (SVG/XML)**: Validação pós-extração com `IMAGE_MIME_RE`. Se `coverHref` aponta para XHTML/XML inválido, fluxo faz fallback para `<img>` em XHTML, depois `pickCoverFromZip`. Aplicado a "Asterisk War - Volume 01.epub" onde meta/properties apontam para o item certo mas o href final resolvia para XML.
- **[2026-08-15]** **v1.2.0 — Performance**: memory cache LRU (50 capas, 126ms→0ms); lazy-load de capas via `IntersectionObserver` (`rootMargin: 200px`); throttling com `setImmediate` a cada 20 volumes. Fix bug `module.exports` que sobrescrevia `exports.*` (funções de cover nunca eram exportadas).
- **[2026-08-15]** **v1.2.0 — Fix capas XML real**: a app usava `scanVolume` sem a validação MIME — guardava XML (1049B) em vez da imagem (230KB). Extraída lógica partilhada `extractCoverData(zip, entries, zipObj, opfPath)` usada por `scanVolume` e `extractVolumeCover`. Adicionado **cache em disco** com validação de conteúdo MIME em `scanVolume` (1º scan ~20s → 2º scan ~0.5s). Cache antigo corrompido é detetado e reextraído.
- **[2026-08-15]** **v1.2.0 — Progresso**: `scanLibrary` aceita `onProgress({done,total})`; `main.js` envia via `webContents.send('library:progress')`; `preload.js` expõe `window.api.onProgress`; renderer mostra `A digitalizar biblioteca… X% (done/total)` + spinner.

## Notas de Teste
- Gerar biblioteca de exemplo: `node test/generate-test-library.js <destino>`.
- Testar scan: `node -e "..."` com `require('./src/library')`.
- Testar capa individual: `node test/test-volume.js <ficheiro.epub>`.
- Testar UI: `TEST_SCREENSHOT=/tmp/s.png TEST_ROOT=<pasta> TEST_USERDATA=/tmp/ud npx electron . --no-sandbox --disable-gpu`.


## 🛡️ Backup e Remote
- Backup base preservado: `BibliotecaEpub-1.0.0.base.AppImage` (`v1.0.0-base` tag)
- Remote configurado: `https://github.com/ribaudequin/epub-library-manager.git`
- Ficheiros do agente (`MEMORY.md`, `PLANO.md`, `TODO.md`) só localmente
- Backup de segurança em `~/backups/biblioteca/` (persistente)


- **[2026-08-15]** **v1.2.1 — UI/UX**: barra visual de carregamento (0%→100%) durante scan, barra de progresso de leitura na grid de séries, botão "Marcar tudo como lido/não lido" no detalhe da série (IPC `library:bulk-status`).
- **[2026-08-15]** **v1.3.0 — Metadados & Estado**: extração do Autor (`dc:creator`); data do volume mais recente (mtime) convertida em data relativa ("há X dias/meses/anos"); estado da série (Ongoing/Acabada/Cancelada/Hiatus) persistido com badges coloridos na estante e botões no detalhe da série.
- **[2026-08-15]** **v1.3.0 — Listagem por nome do ficheiro**: a alternância entre "Nome do Ficheiro" e "Título do EPUB" foi implementada e depois **removida** — a UI lista sempre pelo nome do ficheiro (comportamento mais simples e previsível). AppImage v1.3.0 gerado e com backup em `~/backups/biblioteca/`; tag git `v1.3.0`.
 - **[2026-08-15]** **v1.3.0 — Auditoria UI (Web Interface Guidelines)**: skill `web-design-guidelines` (Vercel) instalada em `.agents/skills/`. Corrigido `color-scheme: dark`, `<meta name="theme-color">`, `:focus-visible`, `prefers-reduced-motion`, `aria-live`, truncagem de nomes, `tabular-nums`, a11y de teclado nos cards, `transition: all` removido.
- **[2026-08-15]** **v1.3.0 — Tint dos cards pelas capas**: cor dominante de cada capa (média em canvas 8×12) aplicada como gradiente no card via `--card-tint`. Bloqueio inicial resolvido com IPC `cover:read` (bytes → `data:` URL, evita canvas tainted por `file://`). Boost de saturação ×1.35; gradiente cobre o card todo (0.6→1.0) + `box-shadow` hover.
- **[2026-08-15]** **v1.3.0 (@UI Designer audit) — 7 melhorias aplicadas**: badges WCAG (rgba+cor texto); sticky back button; gradiente tint reforçado + micro-hover box-shadow; skeleton-grid + shimmer; hierarquia tipográfica (h3 bold, autor accent); `:focus-visible`; `tabular-nums`.
- **[2026-08-15]** **v1.3.0 (@UI Designer audit) — 7 melhorias aplicadas**: badges WCAG (rgba+cor texto); sticky back button; gradiente tint reforçado + micro-hover box-shadow; skeleton-grid + shimmer; hierarquia tipográfica (h3 bold, autor accent); `:focus-visible`; `tabular-nums`.
- **[2026-08-16]** **v1.3.0 FINAL — tint também no detalhe da série**: `#series-detail` passa a ter `background: linear-gradient(160deg, rgba(var(--serie-tint),0.15 / 0.08 / transparent))` + `border: 1px solid rgba(var(--serie-tint),0.3)`. Commit `0372a9a` no GitHub; AppImage + backup atualizados.

## 🔖 v1.4.0 — Ordenação & Pesquisa (Implementada)
- **Search bar (Ctrl+K)**: `<input type="search" id="search-input">` no header. Fuzzy match sobre `name + author`; debounce 300ms (`DEBOUNCE_MS`); indicador "X de N resultados" (#search-info aria-live polite); Escape limpa input + info. Atalho global `Ctrl+K` foca.
- **Dropdown ordenação**: native `<select id="sort-select">` (A→Z, Z→A, Progresso %, Última atualização) + persiste `sortKey` em `localStorage`. Aplica `SORT_FNS` sobre `currentSeries` e re-renderiza.
- **Skeleton grid**: classe `.skeleton` em `#series-grid` + `@keyframes skeleton-shimmer` durante scan (0.5s → remove após render).
- **Tooltips WCAG**: `title` attr em badges estado `.series-state-badge` + `.state-badge` (ex: "Ongoing — nova atualização esperada").
- **Correção data/autor**: removido `display:none` duplicado em `.series-author/.series-meta` (voltou a mostrar na grid).
- **Refinamento data relativa (pt-PT)**: threshold `diffMonths <= 23` → "há 21 meses" (não "há 1 ano"); acento `mês` só no singular, `meses` no plural.
- **Filtro mtime futuro**: `lastModified: Math.max(...volumes.map(v=>v.mtime).filter(t => t <= Date.now()))` — descarta ficheiros com timestamp absurdo (ex: 2107 de Full Metal Panic! Short Stories → usa Volume 04 de 2025). Commit `6d0eaa3`, tag `v1.4.0` push no GitHub.

### Notas de implementação
- Ordenação/filtro puramente client-side (overlay sobre `currentSeries`) — sem alterações ao `scanLibrary` ou IPC.
- `filteredSeries` array separado; `renderSeriesGrid` itera sobre `filteredSeries` não `currentSeries`.

## 🛠️ Troubleshooting
- **Canvas "tainted" em `file://`**: ler bytes via IPC (`cover:red`) → devolver `data:` URL (mesma origem, sem taint). Exportar `getMimeType` de `library.js`.
- **AppImage não roda no WSL2**: usar `./AppRun --no-sandbox --disable-gpu` em headless. Em máquinas reais (com GPU) não precisa.

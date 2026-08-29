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
│   ├── library.js        # lógica pura de scan/estado (testável com Node)
│   └── renderer/
│       ├── index.html
│       ├── styles.css
│       ├── translations.js   # motor i18n (t(), setLocale, getLocale)
│       ├── renderer.js   # UI: grid de séries, detalhe da série
│       └── locales/
│           ├── pt.json    # chaves de tradução PT (sincronizado com translations.js)
│           └── en.json    # chaves de tradução EN (sincronizado com translations.js)
├── PLANO.md
└── TODO.md
```

## Registro de Alterações
- **[2026-08-12]** Estrutura inicial criada; scan de séries/volumes; extração de capas; estado lido/não lido/pendente persistente; UI base (grid + detalhe).
- **[2026-08-12]** Refactor: lógica de scan movida para `src/library.js` (testável com Node puro). Testes automáticos com Node e hooks de screenshot/estado via env vars (`TEST_SCREENSHOT`, `TEST_ROOT`, `TEST_USERDATA`). Verificado: scan, capas, persistência de estado.
- **[2026-08-12]** Teste de execução em ambiente gráfico: app arranca com `--disable-gpu` (não é problema em máquinas normais).
- **[2026-08-12]** **AppImage gerado** com electron-builder: `dist/BibliotecaEpub-1.0.0.AppImage`. Ícone em `build/icon.png`.
- **[2026-08-14]** **v1.1.0** — lazy-load, memory cache, throttling (detalhes técnicos na secção abaixo).
- **[2026-08-14]** **Fix capas não-image (SVG/XML)**: Validação pós-extração com `IMAGE_MIME_RE`. Fallback para XHTML + `pickCoverFromZip`. Aplicado a "Asterisk War - Volume 01.epub".
- **[2026-08-15]** **v1.2.0 — Performance**: memory cache LRU, lazy-load IntersectionObserver, throttling, fix `module.exports`.
- **[2026-08-15]** **v1.2.0 — Fix capas XML real**: cache em disco com validação MIME (`scanVolume` + `extractVolumeCover` partilham `extractCoverData`). 1º scan ~20s → 2º ~0.5s.
- **[2026-08-15]** **v1.2.0 — Progresso**: `scanLibrary` aceita `onProgress({done,total})`; IPC `library:progress`; renderer mostra progresso + spinner.
- **[2026-08-15]** **v1.2.1** — Barra visual de carregamento, barra de progresso de leitura na grid, botão "Marcar tudo como lido/não lido" (IPC library:bulk-status).
- **[2026-08-15]** **v1.3.0** — Metadados (dc:creator), data relativa mtime, estados de série (4 states). Tint dos cards pela cor dominante. Auditoria UI.
- **[2026-08-16]** **v1.3.0 FINAL** — Tint no `#series-detail`. Commit `0372a9a`.
- **[2026-08-16]** **v1.4.0** — Search Ctrl+K, dropdown sort, skeleton grid, tooltips WCAG, correção data mtime futuro. Commit `6d0eaa3`.
- **[2026-08-19]** **v1.5.0** — Cache scan localStorage (`biblioteca-cache-<sha1(rootPath)>`, validado por rootMtime recursivo). Commit + tag `v1.5.0`.
- **[2026-08-20]** **v1.6.0 — Final**: i18n corrigido (conflito preload), data relativa localizada, build AppImage v1.6.0 gerado e uploaded para GitHub Release. Commit `af8ecf2`, tag `v1.6.0`.
- **[2026-08-20]** **v1.6.0 bugfix — preload placeholder i18n**: `preload.js` tinha `contextBridge.exposeInMainWorld('i18n', placeholder)` que sobrescrevia `translations.js`, fazendo todas as keys aparecerem. Removido. Commit `e949f47`.
- **[2026-08-20]** **v1.6.0 bugfix — formatRelativeDate hardcoded**: strings "hoje", "há", "mês" eram PT fixas. Agora usa `window.i18n.getLocale()` + chaves `date_today`, `date_ago`, `unit_day/days/...`. Commit `ac7a52a`.
- **[2026-08-20]** **Cleanup**: Eliminadas funções duplicadas `updateUI`/`updateI18nLabels`/`initLocale`; strings hardcoded substituídas por `t()`.
- **[2026-08-20]** **Windows Port COMPLETED**: package.json updated (build.win/nsis); icon.ico generated; Windows build validated via Wine. Feasibility study concluído. Windows 11 tested — covers load, file watcher works, state persists. Release v1.6.0 public with both Linux + Windows builds.
- **[2026-08-20]** **v1.8.0 Planning**: `PLAN-LIGHT-THEME-STATS.md` created with full design spec (CSS vars, layout mockups, WCAG contrast ratios, component hierarchy), technical plan (file changes, data structures, code samples), effort estimate (~19h), and risk matrix. Branch `v1.7.0-light-theme` created from master at `88485a5`.
- **[2026-08-20]** **v1.8.0 — FINAL**: Light theme toggle + statistics dashboard. Implementado via 6 sub-agentes faseados (CSS, HTML, JS theme, JS stats, i18n, QA). Commits `ae82402` + `ccf8427`. Tag `v1.8.0`. AppImage 103MB gerado e backed up.
- **[2026-08-20]** **v1.8.0 WCAG fixes**: Button contrast (accent darkened, white text, status/state-btn), detail tint gradient boosted, state badges darkened for white cards. Commit `adb047c`.
- **[2026-08-20]** **v1.8.0 toolbar**: Stats/select/scan buttons changed to ghost style (transparent + border) matching theme toggle. Commit `dc1ef12`.
- **[2026-08-20]** **v1.8.0 Windows + README**: NSIS installer + portable .exe built and uploaded to GitHub Release. README.md updated for v1.8.0 (features, Windows install, build commands). Commit `24025ac`.

## Notas de Implementação (v1.8.0)

### Light Theme
- **CSS Variables**: `:root` (dark, default) + `:root[data-theme="light"]` — 12 variáveis cada (`--bg`, `--bg-card`, `--text`, `--accent`, etc.)
- **Anti-flash**: inline `<script>` no `<head>` lê `localStorage.getItem('theme')` e aplica `data-theme` antes do CSS parse
- **Toggle**: botão ☀️/🌙 (`#btn-theme-toggle`) no header `.actions`, persiste em `localStorage`
- **Componentes**: overrides para `.series-card`, `.volume-row`, `header`, `.spinner`, `.loading-bar`, `.progress-bar`, `#series-detail`
- **i18n**: chaves `theme_toggle_light`, `theme_toggle_dark`

### WCAG Light Theme Fixes (v1.8.0 bugfix)
- **Accent color**: `#4a78d4` → `#3a6bc5` (5.0:1 com branco em botões primários)
- **Base button**: `color: #ffffff` no light theme (override specificity (0,2,1))
- **Status buttons (detail)**: inactive `#6b6b80` on `#f0f0f2` (4.68:1), active lido `#14141f` on `#3d9a42` (5.31:1), active não lido `#fff` on `#d43d50` (4.68:1), active pendente `#14141f` on `#c08a30` (6.04:1)
- **State badges (grid)**: darker versions — ongoing `#2a7a30` (5.36:1), completed `#2b5398` (7.53:1), cancelled `#b02030` (6.79:1), hiatus `#8a5a10` (5.95:1)
- **Detail tint**: gradient boosted (0.15→0.35 dark, 0.40→0.20 light) — was overwritten by flat `background`
- **Toggle-all-status border**: hardcoded dark tint → `rgba(58,107,197,0.3)`
- **Btn-back**: added `border: 1px solid var(--border)` in light mode
- **Form inputs**: search/sort `border-color: rgba(0,0,0,0.12)`
- **Cleanup**: removed duplicate `button` CSS block
- **Toolbar buttons**: `#btn-theme-toggle`, `#btn-stats`, `#btn-select`, `#btn-scan` — shared ghost style (transparent bg, border, hover accent)

### Statistics Dashboard
- **Modal**: `#stats-modal` com `role="dialog"`, `tabindex="-1"`, focus management, Escape para fechar
- **Summary cards**: 4 metricas (Séries, Volumes, Lidos, Progresso) em grid `repeat(4, 1fr)`
- **State breakdown**: barras horizontais CSS com cores por estado (green/active, accent/completed, red/cancelled, yellow/hiatus)
- **Largest series**: top 5 por volume count, barras proporcionais
- **Activity timeline**: SVG bar chart 30 dias, dados de `lastModified` timestamps
- **Dados**: todos computados client-side de `window.currentSeries` — sem IPC adicional
- **i18n**: 14 chaves (stats_title, stats_total_*, chart_*, state_*)
- **WCAG**: `role="img"` + `aria-label` + `<title>` no SVG

### Ficheiros alterados
| Ficheiro | Alterações |
|---|---|
| `src/renderer/styles.css` | CSS vars dark/light, component overrides, stats modal + chart styles |
| `src/renderer/index.html` | Anti-flash script, theme toggle button, stats button, stats modal markup |
| `src/renderer/renderer.js` | `applyTheme/toggleTheme`, `computeStats/renderStats` + 3 chart renderers, event listeners |
| `src/renderer/translations.js` | 14 novas chaves PT/EN |
| `src/renderer/locales/pt.json` | 14 novas chaves |
| `src/renderer/locales/en.json` | 14 novas chaves |
| `package.json` | version 1.6.0 → 1.8.0 |
| `README.md` | v1.8.0 features, Windows install, build commands |

## Próximos Passos (v1.9.0)
- [x] Planeamento detalhado (PLAN-LIGHT-THEME-STATS.md)
- [x] Light theme toggle (CSS custom properties + data-theme + localStorage)
- [x] Statistics dashboard (modal com CSS/SVG charts)
- [x] i18n keys para tema + estatísticas
- [x] Ajuste de card tint para light mode
- [ ] Keyboard nav global (arrows in grid, Esc in detail)
- [ ] Windows CI (GitHub Actions `windows-latest`)
- [ ] Code signing (Authentic code signing cert ~$200-400/ano)
- [x] Flathub — manifesto, metadata, desktop entry, build workflow, documento de instalação

## Próximos Passos (v2.0.0)
- [ ] External metadata enrichment (Open Library API integration for cover art and descriptions)
- [ ] Reading goals and streaks tracking
- [ ] Custom tags and collections
- [ ] Reading time estimation based on word count

## 📦 Flathub (Planeamento Futuro)

### Viabilidade: ✅ ALTA
- App open source (MIT), sem módulos nativos, 100% offline, Electron 31 compatível
- App ID proposto: `io.github.marcelo.bibliotecaepub`

### Ficheiros necessários
| Ficheiro | Descrição |
|----------|-----------|
| `io.github.marcelo.bibliotecaepub.yml` | Manifest Flatpak (runtime, BaseApp, build, finish-args) |
| `io.github.marcelo.bibliotecaepub.metainfo.xml` | AppStream metadata (nome, descrição, screenshots, releases) |
| `io.github.marcelo.bibliotecaepub.desktop` | Desktop entry (Exec, Icon, Categories) |
| `generated-sources.json` | NPM deps pre-downloaded (flatpak-node-generator) |
| `run.sh` | Wrapper script (zypak-wrapper.sh) |

### Stack técnica Flatpak
```yaml
runtime: org.freedesktop.Platform (24.08)
base: org.electronjs.Electron2.BaseApp (stable)
sdk-extensions: org.freedesktop.Sdk.Extension.node24
```

### Estado atual
- **Phase 1-2**: Manifest + supporting files CREATED ✅
- **Phase 3**: `npm run dist:flatpak` build successful (dir mode) ✅
- **Phase 4**: Manifest YAML validated ✅
- **Phase 4**: GitHub Actions workflow (`build-flatpak.yml`) created ✅
- **Phase 5**: Flatpak bundle (`BibliotecaEpub-1.8.1-flatpak.tar.gz`) created + uploaded ✅
- **Phase 6**: README.md updated with Flatpak install instructions ✅
- **Status**: DONE — Release v1.8.1 with 4 assets (AppImage + NSIS + portable + Flatpak)

### Fix necessário antes de submeter
- **P0**: Redirect `getVolumeCoverPath()` para escrever em `userData/covers/` em vez do dir do epub
- **P2**: Aceitar degradação do `fs.watch` (inotify não funciona no sandbox) — já funciona graceful

### Permissões (finish-args)
```yaml
- --socket=wayland
- --socket=fallback-x11
- --socket=pulseaudio
- --share=ipc
- --device=all
- --env=XCURSOR_PATH=/run/host/user-share/icons:/run/host/share/icons
- --env=ELECTRON_TRASH=gio
# Sem --share=network (app offline)
# Sem --filesystem=host (usar portais)
```

### Processo de submissão
1. Fork `flathub/flathub` → branch `new-pr`
2. Criar ficheiros na pasta `io.github.marcelo.bibliotecaepub/`
3. `flatpak-builder` test local
4. PR contra `new-pr` branch
5. Review + merge → publicação

### Esforço estimado
- Preparação: ~6-8h
- Testing + submissão: ~2-3h
- Review Flathub: 1-2 semanas

## Notas de Implementação (v1.6.0)

### i18n
- **Detecção de idioma**: `main.js` IPC `app:getLocale` → `app.getLocale()` do Electron → retorna `pt-PT`, `en-US`, etc.
- **Carregamento de traduções**: `renderer.js` `initLocale()` → chama `window.api.getLocale()` → `window.i18n.setLocale(lang)` (pt/en).
- **Motor de tradução**: `translations.js` — função `t(key, vars={})` com substituição de placeholders `{count}`, `{pct}`, etc.
- **27 chaves** (v1.6.0) + **14 chaves** (v1.8.0 stats/theme) = **41 chaves no total**: UI labels, mensagens de estado, tooltips, status names, theme toggle, statistics.
- **Fallback**: se detecção falhar, default a `pt`.
  - **Limitação atual**: tradução é aplicada uma vez no startup. Mudança de idioma exigirá restart (não há `navigator.languages` listener).
  - **IMPORTANTE**: `translations.js` (inline) é a fonte de verdade. `locales/*.json` são ficheiros de referência mantidos sincronizados manualmente. **NÃO usar `fetch()`** para carregar JSON em `file://` — usa `FileURLLoader` que falha. `translations.js` é carregado via `<script src>` normal.

### File watcher / Auto-refresh
- **Watcher**: `fs.watch(rootPath, {recursive:true})` no main.js com debounce de 2s.
- **IPC**: `library:watch` (inicia), `library:unwatch` (para).
- **Renderer**: `startWatching()` após scan/cache load → `onLibraryChanged` → `stopWatching()` + `scanAndRender()`.
- **Root cause cache stale**: `getRecursiveMtime` ignorava timestamps futuros (2107). Corrigido: `if (s.mtimeMs > 0 && s.mtimeMs <= now)`.

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

## 🛠️ Troubleshooting
- **Canvas "tainted" em `file://`**: ler bytes via IPC (`cover:red`) → devolver `data:` URL (mesma origem, sem taint). Exportar `getMimeType` de `library.js`.
- **AppImage não roda no WSL2**: usar `./AppRun --no-sandbox --disable-gpu`.
- **File watcher não dispara**: verificar se a pasta raiz é válida (não pode estar em drive de rede montado via SSH/SMB). `fs.watch` não funciona bem em mounts remotos.
- **i18n não aplica**: o `fetch('./locales/...')` não funciona em `file://` protocol — solução: usar `window.i18n.t()` com traduções carregadas via IPC no startup.
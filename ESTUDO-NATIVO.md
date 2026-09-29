# Estudo — Alternativa ao Electron / App Nativo

## 1. Estado Atual (baseado em `package.json`, `.github/workflows/`, `src/`)

- **App**: EPUB Shelf (Electron 31.0.0)
- **Arquitetura**: `main.js` (processo principal) + `preload.js` (contextBridge) + `renderer/` (HTML/CSS/JS web)
- **Binários gerados pelo GitHub Actions**:
  - Linux: `AppImage`, `deb`, `dir` (Flatpak), `rpm` (não usado mas configurado)
  - Windows: `NSIS` (`.exe`), `portable` (`.zip`)
  - macOS: `dmg`
  - Flatpak: bundle `.flatpak` (`build-flatpak.yml`)
- **Workflows**:
  - `.github/workflows/release.yml`: `ubuntu-latest`, `windows-latest`, `macos-latest` → `electron-builder`
  - `.github/workflows/build-flatpak.yml`: manifest Flatpak (`io.github.ribaudequin.epub-library-manager`)
- **Dependências principais**:
  - `electron` + `electron-builder`
  - `adm-zip` (leitura EPUB)
  - `@xmldom/xmldom` (parsing XML de capas/metadados)
- **Acesso ao sistema nativo** (via IPC em `preload.js`):
  - `dialog` (seleção de pasta raiz)
  - `fs.watch` (file watcher recursivo com debounce 2s)
  - `fs.readFile` / `fs.writeFile` (persistência `biblioteca.json` e cache `covers/`)
  - `shell.openExternal`
  - `Menu.setApplicationMenu(null)`
- **UI**: 100% web (`index.html` + `renderer.js` ~970 linhas, `styles.css`, `translations.js`, `locales/*.json`)
- **Tamanho aproximado do binário atual**: AppImage ~103MB (v1.8.0) — Electron embute Chromium + Node runtime.

---

## 2. Objetivo do Estudo

Avaliar se é viável e vantajoso:
- **A)** Substituir Electron por uma alternativa mais leve (Tauri, Wails, Neutralino) mantendo a UI web e os mesmos alvos de binário.
- **B)** Tornar o app "nativo" (reconstruir UI com toolkit nativo: GTK4/libadwaita, Qt, Flutter, etc.) abandonando a stack web atual.
- **C)** Manter Electron mas otimizar o empacotamento e reduzir tamanho (ex.: `electron-builder` com `asar`, `compression`, `nodeModules` trimming).

---

## 3. Alternativas Avaliadas

### 3.1 Tauri (Rust + WebView2/WebKit/WebKitGTK)

**Estado no projeto**: Já mencionado em `PLAN.md` ("Tauri exigiria Rust" — descartado inicialmente porque o time preferia Node).

| Critério | Avaliação |
|---|---|
| **UI atual** | Reutiliza `renderer/` quase integralmente. Só precisa de um `tauri.conf.json` + `src-tauri/src/main.rs`. |
| **IPC** | Tauri tem `invoke()` / `listen()` nativo — substitui `contextBridge` com menos overhead. |
| **File system / watch / ZIP / XML** | Tauri expõe APIs nativas (`fs`, `dialog`, `watch`) via Rust. Pode-se manter `library.js` em JS (se usar `tauri` com `window.__TAURI__`) ou migrar `library.js` para Rust (maior esforço). Se manter `adm-zip` + `xmldom`, continua funcionando no frontend via `fs.readFile` (base64) ou via comando Rust. |
| **Binários** | Tauri gera `.deb`, `.AppImage`, `.dmg`, `.msi`/`.nsis`, `.bundle` (Flatpak via `tauri-apps/tauri-action`). Os workflows do GitHub Actions precisariam de `tauri-action` em vez de `electron-builder`. |
| **Tamanho** | Binário típico Tauri: **5–15MB** (sem Chromium embutido — usa WebView do SO). Redução de ~85–90% vs. Electron. |
| **Memória** | Uso de RAM significativamente menor (~30–60MB vs. 200–400MB do Electron). |
| **Manutenção CI** | Requer `rust-toolchain` + `tauri-cli`. Os 3 runners (`ubuntu`, `windows`, `macos`) continuam válidos. Flatpak requer manifest diferente (`io.tauri` base). |
| **Esforço estimado** | **Médio-alto** (2–4 semanas para migração completa se reescrever `library.js` em Rust; **baixo-médio** se manter `library.js` no frontend e apenas trocar a ponte IPC). |

**Veredito**: Melhor alternativa se o objetivo é reduzir tamanho e manter a UI web. Requer investimento em Rust para a parte de sistema (ou aceita uma ponte híbrida JS/Rust).

---

### 3.2 Wails (Go + WebView)

| Critério | Avaliação |
|---|---|
| **UI atual** | Reutiliza `renderer/` integralmente (`wails` usa frontend web). |
| **IPC** | `wails.Bind` (Go) expõe métodos ao JS. Substitui `preload.js`. |
| **File system / watch / ZIP / XML** | `library.js` pode ser mantido no frontend via `wails` (se expor `fs.readFile` via Go) ou reescrito em Go. Go tem `archive/zip` nativo (substitui `adm-zip`) e `encoding/xml` (substitui `@xmldom/xmldom`). |
| **Binários** | `wails build` gera `.deb`, `.AppImage`, `.exe`, `.msi`, `.dmg`. Flatpak não é nativo, mas pode ser feito com `flatpak-builder` a partir do `.AppImage`/dir. |
| **Tamanho** | Binário típico Wails: **~10–25MB** (Go + WebView nativo). Redução significativa vs. Electron. |
| **Manutenção CI** | Requer `go` + `wails` CLI. Os runners continuam válidos. |
| **Esforço estimado** | **Médio** (1–3 semanas). Go tem excelente suporte a ZIP/XML, facilitando a migração de `library.js`. |

**Veredito**: Alternativa viável. Go é mais acessível que Rust para a maioria dos devs Node. A migração da lógica de scan/EPUB para Go seria relativamente direta.

---

### 3.3 Neutralinojs

| Critério | Avaliação |
|---|---|
| **UI atual** | Reutiliza `renderer/`. |
| **IPC** | Modelo de `neutralino.js` — mais simples, mas menos maduro. |
| **Binários** | Gera binários leves, mas comunidade menor que Tauri/Wails. |
| **Tamanho** | Muito leve (~2–5MB), mas sem suporte robusto a Flatpak/Windows installer. |
| **Esforço** | Baixo, mas risco alto por falta de ecossistema. |

**Veredito**: Não recomendado para produção com múltiplos alvos (AppImage, Flatpak, NSIS, DMG) devido à maturidade limitada.

---

### 3.4 Flutter Desktop

| Critério | Avaliação |
|---|---|
| **UI atual** | **Não reutiliza**. Toda a UI (`renderer/`, `styles.css`, `translations.js`) teria que ser reescrita em Dart/Flutter (`Column`, `GridView`, `Text`, `ThemeData`). |
| **Lógica de EPUB** | Pode ser feita em Dart (`archive` package para ZIP, `xml` para parsing). |
| **Binários** | Flutter gera `.deb`, `.appimage`, `.exe`, `.dmg`, `.msi`. Flatpak requer manifest customizado. |
| **Manutenção CI** | Requer `flutter` SDK nos runners. |
| **Esforço** | **Muito alto** (4–8 semanas). Reescrever 970+ linhas de JS de UI + CSS + i18n. |

**Veredito**: Só faz sentido se o objetivo for uma UI completamente nativa com animações e widgets próprios. Não justifica o esforço apenas para substituir Electron.

---

### 3.5 GTK4 / libadwaita (Linux nativo) + Electron/alternativa para Windows/macOS

| Critério | Avaliação |
|---|---|
| **UI atual** | **Não reutiliza** para Linux. Seria uma app nativa GTK4 (`PyGObject`, `Rust` com `gtk-rs`, `C` com `gtk4`). Para Windows/macOS, precisaria de outra stack ou manter Electron/Wails. |
| **Manutenção** | Duas bases de código (GTK para Linux, outra para Windows/macOS) — inviável para um projeto pequeno. |

**Veredito**: Não recomendado se o objetivo é manter multiplataforma com um único código de UI.

---

### 3.6 Manter Electron + Otimizações

| Otimização | Impacto |
|---|---|
| `electron-builder` com `compression: maximum` e `asar: true` (já é padrão) | Redução de ~10–20% no tamanho. |
| Remover módulos não usados (`devDependencies` no build final) | Já feito (`electron-builder` só inclui `dependencies`). |
| Usar `electron-updater` ou `Squirrel` (Windows) para updates | Não reduz tamanho inicial, mas melhora UX. |
| Migrar para `electron` `v35+` com melhor performance | Impacto marginal no tamanho. |

**Veredito**: Não resolve o problema fundamental (tamanho grande, consumo de RAM, overhead do Chromium). É uma mitigação, não uma solução.

---

## 4. Impacto nos Workflows do GitHub Actions

### 4.1 `release.yml`

| Alternativa | Mudança necessária |
|---|---|
| **Tauri** | Substituir `npx electron-builder` por `tauri-action` (`tauri-apps/tauri-action@v0`). Os artefatos (`.deb`, `.AppImage`, `.dmg`, `.exe`, `.msi`, `.bundle`) continuam sendo gerados automaticamente pelo `tauri build`. |
| **Wails** | Substituir por `wails build` + `wails package`. Os formatos são `.deb`, `.AppImage`, `.dmg`, `.exe`/`.msi`. Flatpak requer passo extra (`wails` não gera flatpak nativo — precisa de `flatpak-builder` com o `.AppImage`/dir). |
| **Electron (otimizado)** | Nenhuma mudança no workflow. |

### 4.2 `build-flatpak.yml`

- **Electron atual**: Usa `electron-builder --linux dir` + `run.sh` + manifest `org.freedesktop.Platform` + `org.electronjs.Electron2.BaseApp`.
- **Tauri**: Há templates de Flatpak para Tauri (`tauri-apps/tauri-action` pode gerar `.flatpak` se configurado, ou usa `flatpak-builder` com um runtime `org.freedesktop.Platform` + `org.gtk.Gtk3` ou `org.electronjs` substituído por `org.gnome.Platform`). Requer reescrever `io.github.ribaudequin.epub-library-manager.yml`.
- **Wails**: Similar — usa `flatpak-builder` com runtime base (`org.gnome.Platform` ou `org.freedesktop.Platform`). Não usa `Electron2.BaseApp`.

---

## 5. Comparação Resumida dos Alvos de Binário

| Alvo | Electron (atual) | Tauri | Wails | Flutter | GTK4 (nativo Linux) |
|---|---|---|---|---|---|
| Linux AppImage | ✅ `electron-builder` | ✅ `tauri build` | ✅ `wails build` | ✅ `flutter build` | ❌ (precisa `AppImage` manual) |
| Linux `.deb` | ✅ | ✅ | ✅ | ✅ | ❌ |
| Linux `.rpm` | ✅ (configurado) | ✅ | ❌ (não nativo) | ❌ | ❌ |
| Flatpak `.flatpak` | ✅ (`build-flatpak.yml`) | ✅ (manifest adaptado) | ⚠️ (manual via `flatpak-builder`) | ✅ (manual) | ✅ (nativo para Linux) |
| Windows `.exe` (NSIS) | ✅ | ✅ (`.msi`/`.nsis`) | ✅ (`.msi`/`.nsis`) | ✅ (`.exe`/`.msi`) | ❌ |
| Windows Portable `.zip` | ✅ | ⚠️ (não nativo — precisa zip manual) | ⚠️ | ⚠️ | ❌ |
| macOS `.dmg` | ✅ | ✅ | ✅ | ✅ | ❌ |

---

## 6. Recomendação

### Opção A — Prioridade Alta: Tauri (migração gradual)

**Justificativa**:
- Redução drástica do tamanho do binário (~103MB → ~10–20MB).
- Redução de consumo de memória (WebView nativo do SO em vez de Chromium embutido).
- Mantém a UI web existente (`renderer/`), minimizando retrabalho visual e funcional.
- Suporte oficial a todos os alvos de binário atuais (`.deb`, `.AppImage`, `.dmg`, `.msi`/`.nsis`, Flatpak via `tauri-action`).
- A comunidade Tauri já cobre cases como file watcher (`tauri::api::path` + `tauri::api::file_system`), diálogos (`tauri::api::dialog`), e leitura de arquivos.

**Estratégia de migração sugerida** (para minimizar risco):
1. **Fase 1 (1–2 semanas)**: Manter `library.js` no frontend. Criar um projeto Tauri mínimo que carrega `renderer/index.html` e expõe um `preload` equivalente (`tauri.conf.json` + `src-tauri`). Migrar o `preload.js` para `tauri` (`invoke`) — apenas a ponte IPC.
2. **Fase 2 (2–3 semanas)**: Substituir `electron-builder` por `tauri build` nos workflows. Adaptar `release.yml` para usar `tauri-action`. Adaptar `build-flatpak.yml` para manifest Tauri.
3. **Fase 3 (opcional, 2–4 semanas)**: Migrar `library.js` (scan EPUB, ZIP, XML) para Rust (`src-tauri/src/`) para eliminar `adm-zip` e `@xmldom/xmldom` do bundle. Isso reduz ainda mais dependências e melhora performance do scan.

**Riscos**:
- Requer aprender Rust (se for migrar `library.js`). Se manter `library.js` no JS, o risco é baixo.
- Alguns módulos do `electron` não têm equivalente direto no Tauri (`Menu.setApplicationMenu` — Tauri usa `CustomMenuEvent` ou simplesmente não mostra menu por padrão, o que já é o comportamento atual).
- `fs.watch` recursivo em Tauri: pode ser feito via `tauri::api::path::watch` ou via comando Rust que chama `notify` crate.

---

### Opção B — Prioridade Média: Wails

**Justificativa**:
- Similar ao Tauri em termos de tamanho e arquitetura (web frontend + backend Go).
- Go tem `archive/zip` e `encoding/xml` nativos, facilitando a migração de `library.js` se necessário.
- Menor ecossistema que Tauri para desktop, mas estável.

**Contra**:
- Flatpak não é nativo no `wails build` — exigiria manutenção manual do workflow `build-flatpak.yml`.
- A comunidade é menor que Tauri; atualizações futuras podem ser menos previsíveis.

---

### Opção C — Prioridade Baixa/Nula: Manter Electron

**Justificativa**: Só se o custo de migração for proibitivo e o tamanho do binário não for um problema real para o usuário final. Dado que o app é distribuído via GitHub Release e Flatpak, um binário de 103MB é um ponto negativo (download lento, uso de disco, RAM).

---

## 7. Próximos Passos Sugeridos

1. **Validar a viabilidade de Tauri** com um protótipo de 1–2 dias:
   - Criar `tauri-app` vazio.
   - Copiar `src/renderer/` para `tauri-app/src/`.
   - Implementar um `preload` básico (`invoke`) que expõe `library:scan` (chamando `library.js` do frontend, não Rust, para validar rapidamente).
   - Executar `npm run tauri build` e verificar se os binários (`AppImage`, `.deb`, `.dmg`, `.exe`) são gerados corretamente.
2. **Medir impacto real**: Comparar o tamanho do `.AppImage` gerado pelo protótipo Tauri com o atual (`dist/*.AppImage`).
3. **Decisão**: Se o protótipo funcionar e o tamanho for significativamente menor, iniciar a migração gradual (Fase 1, 2, 3).
4. **Atualizar `PLAN.md`** e `TODO.md` com o roteiro de migração, incluindo estimativas de esforço e milestones.

---

*Documento gerado em 2026-09-29 com base na análise de `package.json`, `.github/workflows/release.yml`, `.github/workflows/build-flatpak.yml`, `src/main.js`, `src/preload.js`, `src/renderer/`, `PLAN.md` e `MEMORY.md`.*

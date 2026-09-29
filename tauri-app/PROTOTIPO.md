# Prototipo Tauri — Fase 1 (Opção A do ESTUDO-NATIVO.md)

## O que foi feito

- Criado branch `migracao-tauri`
- Criado `tauri-app/` com:
  - `src/` (renderer copiado do Electron): `index.html`, `renderer.js`, `styles.css`, `translations.js`, `locales/`
  - `src/library.js` (lógica pura — ainda no frontend)
  - `src/preload.js` — stub que expõe `window.api` via `invoke` (compatível com `renderer.js`)
  - `tauri.conf.json` básico (v1)
  - `src-tauri/Cargo.toml` + `main.rs` (stub)

## Status

- [x] Estrutura básica criada
- [x] Renderer reutilizado sem alterações
- [ ] `library.js` ainda no frontend (não migrado para Rust)
- [ ] Workflows CI (`release.yml`, `build-flatpak.yml`) ainda apontam para Electron
- [ ] `tauri build` não testado (CLI não instalado no ambiente)

## Próximos passos (conforme ESTUDO-NATIVO.md)

1. Testar `npm run tauri dev` / `tauri build` em ambiente com `tauri-cli` instalado.
2. Se funcionar, adaptar `release.yml` para usar `tauri-action`.
3. Adaptar `build-flatpak.yml` para manifest Tauri (`org.gnome.Platform` em vez de `org.electronjs.Electron2.BaseApp`).
4. (Opcional) Migrar `library.js` para Rust (`src-tauri/src/`) para eliminar `adm-zip` + `xmldom`.

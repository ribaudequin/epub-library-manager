# Memória de Longo Prazo do Assistente

## 🎯 Perfil e Preferências do Usuário
* (Fatos importantes sobre o usuário, estilo de escrita, stack de tecnologia, etc.)
- Nome: Marcelo Salvador
- Preferências de comunicação:
  - Ao tarefas de coding, writing, editing ou summarizing: fazer até 4 perguntas de clarificação antes de executar. Tarefas simples ou conversacionais → responder diretamente.
  - Antes de compactar a sessão, atualizar o MEMORY.md primeiro.
- Nível técnico: medio / avançado
- idade: 46 anos
- Idioma: Português PT-PT / Inglês

## 🛠️ Regras de Escopo e Padrões do Projeto
* (Diretrizes de arquitetura, padrões de código, regras de negócio recorrentes)
* Antes de compactar a sessão, sempre atualizar o MEMORY.md primeiro.
* Comando `+data`: quando o utilizador enviar `+data`, verificar a data atual pelo sistema e responder com ela.
* Comando `+memoria`: quando o utilizador enviar `+memoria`, atualizar o MEMORY.md com o que foi aprendido na sessão.
* Ao criar um novo projeto de programação, criar também `PLANO.md` (plano do projeto e registo de alterações) e `TODO.md` (milestones e progresso).

## 📌 Histórico de Decisões e Contexto Atual
* (O que foi decidido em sessões passadas e qual é o foco do trabalho atual)
- Projeto ativo: **Biblioteca de Epubs** (Electron) — gestor de biblioteca de epubs por séries. Pasta raiz → subpastas (séries) → volumes `.epub`. Lista séries com capa do 1º volume; detalhe com volumes e estado lido/não lido/pendente persistente.
- Decisões técnicas: Electron para AppImage (Node já instalado, Tauri exigiria Rust). Persistência JSON (`userData/biblioteca.json`). Capas extraídas do EPUB. Lógica de scan isolada em `src/library.js`. `adm-zip` + `@xmldom/xmldom`.
- Status: **v1.4.0** (Estável). Search Ctrl+K + sort dropdown + WCAG tooltips + skeleton grid. Próximo: cache scan localStorage, keyboard nav global, tema claro.
- Versões AppImage: 1.0.0 (base), 1.1.0, 1.1.1, 1.2.0, 1.2.1, 1.3.0, 1.4.0. Regra: A=major (upgrade), B=feature, C=bugfix (zera B), D=código (zera C).
- GitHub: `https://github.com/ribaudequin/epub-library-manager` (remote `origin`). Tags: `v1.2.1`, `v1.3.0`, `v1.4.0`.
- Proteção contra acidentes: `npm test`/lint + git hooks + backups em `~/backups/biblioteca/` (persistente).
- Testes: env vars `TEST_SCREENSHOT`/`TEST_ROOT`/`TEST_USERDATA`; `test/generate-test-library.js`; `test/test-volume.js`; `test/validate-modules.js` (bloqueia xml2js); `test/lint.js`.
- Em ambiente de teste a app precisa de `--disable-gpu` (não é problema em máquinas normais).
- Agentes globais: **100+ @agentes** em `~/.config/opencode/agents/` (UI Designer, UX Researcher, Security Architect, DevOps, Product Manager, etc.) — usar a notação `@Agente` para delegar tarefas especializadas.

## 🪵 Log de Atualizações Recentes
* A memória foi inicializada.
* 2026-08-12: Projeto Biblioteca de Epubs. Fase 1 concluída. Scan: 247 séries/2417 volumes em ~12s. Capas: 0/2417 sem capa.
* 2026-08-12: xml2js → @xmldom/xmldom. AppImage regenerado sem erro de módulo. `npm test` + git init.
* 2026-08-13: **v1.1.0** — lazy-load: scanLibraryFast (0.09s), UI 3.9s. Capas via IPC + cache.
* 2026-08-14: **v1.2.0** — memory cache LRU (capas 126ms→0ms), lazy-load IntersectionObserver, throttling (yield 20 vols), fix exportação `library.js` (module.exports sobrescrevia exports.*), fix capas XML (extractCoverData partilhado, Asterisk War 1049B XML→230KB JPEG), cache disco com validação MIME (1º scan 20s→2º 0.5s), progresso percentual no scan, spinner loading.
* 2026-08-14: GitHub configurado (`ribaudequin/epub-library-manager`). Ficheiros do agente (.md, .agents, promps) fora do repo.
* 2026-08-15: **v1.2.1** — UI/UX: barra visual de carregamento (0%→100%) durante scan, barra de progresso de leitura na grid de séries, botão "Marcar tudo como lido/não lido" no detalhe da série (IPC library:bulk-status). Tag git v1.2.1 criada.
* 2026-08-15: **v1.3.0 (Planeado)** — Adição de metadados (Autor, Sinopse), cálculo de data de última atualização (mtime mais recente), estado da série (Ongoing/Acabada/Cancelada/Hiatus) com botões e badges.
* 2026-08-15: **v1.3.0 (Concluído)** — Metadados (Autor via `dc:creator`, data relativa do volume mais recente via mtime: "há X dias/meses/anos"), estados de série com badges coloridos na estante e botões no detalhe. Alternância de nome (Ficheiro vs Título) foi implementada e depois **removida por ser supérflua** — a lista mostra sempre o nome do ficheiro. Build AppImage v1.3.0, tag git `v1.3.0` e backup em `~/backups/biblioteca/`.
* 2026-08-15: **Auditoria UI — Web Interface Guidelines (Vercel)**: instalada skill `web-design-guidelines` (`.agents/skills/web-design-guidelines`). Corrigido: `color-scheme: dark`, `<meta name="theme-color">`, `:focus-visible` em botões/cards, `prefers-reduced-motion`, `aria-live` no loading, truncagem `.volume-name` + `min-width:0`, `tabular-nums`, teclado (Enter/Espaço) + `role="button"`/`tabindex` nos cards de séries, remoção de `transition: all`.
* 2026-08-15: **v1.3.0 — Tint dos cards pela cor da capa**: cor dominante da capa (média em canvas 8×12). Canvas ficava "tainted" com `file://` → Fix: IPC `cover:read` (bytes → data URL) + `getMimeType` em `library.js`. Boost saturação ×1.35; gradiente cobrindo todo o card. Commit `d53c3a2`.
* 2026-08-15: **v1.3.0 (Audit @UI Designer) — 7 melhorias aplicadas**: (1) badges WCAG-friendly [rgba fundo 0.2 + cor texto]; (2) back button `sticky top:0` para lists >15 volumes; (3) gradiente tint reforçado 0.6→0.85 (hover) + box-shadow hover `0 8px 24px rgba(tint,0.2)`; (4) boost saturação 1.35→2 + canvas tainted fix (IPC cover:red); (5) skeleton-grid + shimmer animation durante scan (classe `.skeleton` em `#series-grid`); (6) hierarquia tipográfica (h3 font-weight 700 letter-spacing -0.01em; `.series-author` cor `--accent`); (7) `:focus-visible` outline em cards.
* 2026-08-16: **v1.3.0 FINAL — Tint aplicado a DETALHE da série também**: `#series-detail { background: linear-gradient(160deg, rgba(var(--serie-tint),0.15 / 0.08 / transparent)); border: 1px solid rgba(var(--serie-tint),0.3) }`. Commit `0372a9a`, tag `v1.3.0` push OK. AppImage + backup atualizados.
* 2026-08-16: **v1.4.0 (Concluído) — Pesquisa & Ordenação**: Search bar Ctrl+K (fuzzy match nome/autor, debounce 300ms, "X de N resultados", Escape limpa); dropdown sort nativo (A→Z/Z→A, Progresso, Última atualização) + localStorage; skeleton-grid shimmer; tooltips WCAG em badges; correção bug display:none que escondia autor/data; refinamento data relativa (threshold meses até 23); filtro mtime futuro (descarta 2107 → usa volume válido mais recente). Commit `6d0eaa3`, tag `v1.4.0` no GitHub (push OK). AppImage + backup `~/backups/biblioteca/`.
* 2026-08-16: **Agentes globais**: **100+ agentes @** em `~/.config/opencode/agents/` (UI Designer, UX Researcher, Accessibility Auditor, Security Architect, DevOps, Product Manager, etc.).

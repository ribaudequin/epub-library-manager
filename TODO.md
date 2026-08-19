# TODO — Biblioteca de Epubs

## Milestones
- [x] Estrutura do projeto Electron
- [x] Scan de séries/volumes `.epub` na pasta raiz
- [x] Extração e cache de capas
- [x] Estado de leitura persistente (JSON)
- [x] UI: grid de séries com capa do 1º volume
- [x] UI: detalhe da série + marcar lido/não lido/pendente
- [x] **v1.2.0** Memory cache LRU + lazy-load (IntersectionObserver) + throttling
- [x] **v1.2.0** Fix capas XML (extractCoverData partilhado + cache disco MIME-validado)
- [x] **v1.2.0** Progresso percentual de scan (IPC library:progress + spinner)
- [x] **v1.2.1** Barra visual de carregamento (0%→100%) durante scan
- [x] **v1.2.1** Barra de progresso de leitura na grid de séries
- [x] **v1.2.1** Botão "Marcar tudo como lido/não lido" no detalhe (IPC library:bulk-status)

## ✅ v1.3.0 — Metadados & Estado da Série (Concluído)
- [x] 1. Metadados: extrair Autor (`dc:creator`) do volume 1
- [x] 2. Última atualização: calcular data do volume mais recente + diff relativo ("há 3 meses")
- [x] 3. Estado da série: botões (Ongoing/Acabada/Cancelada/Hiatus) + badges visíveis na estante
- [x] ~~4. Alternância nome~~ — **removido** (supérfluo); a UI lista sempre pelo nome do ficheiro
- [x] 5. Auditoria UI (Web Interface Guidelines Vercel): a11y, focus-visible, reduced-motion, aria-live, color-scheme
- [x] 6. Tint dos cards pela cor dominante da capa (IPC cover:red, gradiente + boost saturação)
- [x] 6b. Tint **também no detalhe da série** (#series-detail: --serie-tint gradiente + border)
- [x] 7. Melhorias de UX (@UI Designer audit): badges WCAG, sticky back, skeleton grid, hierarquia tipográfica, micro-hover
- [x] Build AppImage v1.3.0 + tag `v1.3.0` no GitHub (push OK) + backup ~/backups/biblioteca/

## 🔨 Próximos passos (v1.4.0)
- [x] 1. Dropdown ordenação (nome A→Z/Z→A, progresso, data atualização) + persiste em localStorage
- [x] 2. Search bar Ctrl+K (fuzzy match name+author, debounce 300ms, Escape limpa)
- [x] 3. Combinação search+sort (filtra sobre array ordenado; indicador "X de N resultados")
- [x] Skeleton grid + shimmer durante scan
- [x] WCAG tooltips nos badges de estado (title attr)
- [ ] Cache scan localStorage (evitar re-scan ao reabrir)
- [ ] Keyboard nav global (setas na grid, Esc no detail)
- [ ] Tema claro (toggle persistente)
- [ ] Teste em máquina real (sem `--disable-gpu`)

## Progresso
- **v1.4.0**: search Ctrl+K + dropdown sort (localStorage) + skeleton grid + tooltips WCAG + fix data relativa + filtro mtime futuro
- **Testado**: scan, persistência de estado, capas, cache, AppImage arranca, search/sort/tooltip/date fix confirmados
- **Foco atual**: v1.5.0 — cache localStorage scan, keyboard nav global, tema claro

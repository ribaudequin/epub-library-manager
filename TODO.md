# TODO — Biblioteca de Epubs

## Milestones
- [x] Estrutura do projeto Electron
- [x] Scan de séries/volumes `.epub` na pasta raiz
- [x] Extração e cache de capas
- [x] Estado de leitura persistente (JSON)
- [x] UI: grid de séries com capa do 1º volume
- [x] UI: detalhe da série + marcar lido/não lido/pendente

## Próximos passos
- [ ] Regenerar AppImage com `@xmldom/xmldom`
- [ ] Melhorias (lazy-load de capas via IPC; ordenação, pesquisa, tema)
- [ ] Teste em máquina real (sem `--disable-gpu`)

## Progresso
- **Concluído**: fase 1 + correção de capas (0/2417 sem capa)
- **Testado**: scan, persistência de estado, AppImage arranca

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
- Projeto ativo: **Biblioteca de Epubs** (Electron) — gestor de biblioteca de epubs organizada por séries. Pasta raiz com subpastas (séries) contendo volumes `.epub`; lista séries com capa do 1º volume; detalhe da série com volumes e estado lido/não lido/pendente persistente.
- Decisões técnicas: Electron (AppImage para Linux — Node já instalado, Tauri exigiria Rust). Persistência em JSON (`userData/biblioteca.json`). Capas extraídas de dentro do EPUB via container.xml → content.opf. Lógica de scan isolada em `src/library.js` para testes com Node puro. `adm-zip` + `xml2js` para leitura.
- Testes: hooks via env vars `TEST_SCREENSHOT`, `TEST_ROOT`, `TEST_USERDATA`; biblioteca de exemplo em `test/generate-test-library.js`.
- Em ambiente de teste a app precisa de `--disable-gpu` (GPU indisponível; não é problema em máquinas normais).

## 🪵 Log de Atualizações Recentes
* A memória foi inicializada.
* 2026-08-12: Projeto Biblioteca de Epubs em curso. Fase 1 concluída (scan, capas, estado persistente, UI). AppImage gerado em `dist/BibliotecaEpub-1.0.0.AppImage`.
* 2026-08-12: Correção total de capas (0/2417 sem capa): trocado xml2js por `@xmldom/xmldom` para melhor manipulação de namespaces; fallback total (`meta cover` → `properties="cover-image"` → item nomeado → cover xhtml → maior imagem → `pickCoverFromZip`). Scan: 247 séries/2417 volumes em ~12s. Próximo: regenerar AppImage.

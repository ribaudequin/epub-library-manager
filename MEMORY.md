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
- Status: AppImage funcional (`dist/BibliotecaEpub-1.0.0.AppImage`, 107MB). 0/2417 volumes sem capa.
- Proteção contra acidentes: `npm test` valida módulos (bloqueia importar xml2js). Git init.
- Testes: env vars `TEST_SCREENSHOT`/`TEST_ROOT`/`TEST_USERDATA`; `test/generate-test-library.js`.
- Em ambiente de teste a app precisa de `--disable-gpu` (não é problema em máquinas normais).

## 🪵 Log de Atualizações Recentes
* A memória foi inicializada.
* 2026-08-12: Projeto Biblioteca de Epubs. Fase 1 concluída. Scan: 247 séries/2417 volumes em ~12s. Capas: 0/2417 sem capa.
* 2026-08-12: xml2js → @xmldom/xmldom. AppImage regenerado sem erro de módulo. `npm test` + git init.

# Inventário de Agentes e Skills — Claude Code

> Arquivo de memória: lista todos os agentes e skills disponíveis nesta sessão, com função, capacidades, uso esperado e nível de profissionalismo.
> Atualizado em: 2026-05-19

---

## AGENTES (`Agent` tool — subagent_type)

Os agentes são invocados via a ferramenta `Agent`. Cada um tem um conjunto de ferramentas próprio e um foco específico. Use-os para delegar trabalho especializado ou para proteger o contexto principal de resultados extensos.

---

### `claude` — Agente Geral (Catch-all)

**Função:** Agente de propósito geral. Usado quando nenhum agente especializado se encaixa na tarefa.

**Capacidades:**
- Acesso total a todas as ferramentas disponíveis (`*`)
- Pode executar qualquer tipo de tarefa: escrever código, pesquisar, editar arquivos, fazer chamadas de API, etc.
- Ponto de entrada padrão do FleetView quando nenhum nome de agente é especificado

**Uso esperado:** Tarefas diversas que não se enquadram em um agente especializado. Fallback seguro para qualquer demanda.

**Nível de profissionalismo:** Alto — capaz de lidar com tarefas complexas e multidisciplinares.

---

### `claude-code-guide` — Guia do Claude Code / SDK / API

**Função:** Responde perguntas sobre o próprio Claude Code (CLI), o Claude Agent SDK e a Claude API (Anthropic API).

**Capacidades:**
- Ferramentas disponíveis: `Bash`, `Read`, `WebFetch`, `WebSearch`
- Responde dúvidas sobre: hooks, slash commands, servidores MCP, configurações, integrações com IDEs, atalhos de teclado
- Explica uso da API, tool use, Anthropic SDK
- Não escreve código de implementação; foca em orientação e documentação

**Uso esperado:** Perguntas do tipo "Como funciona X no Claude Code?", "Como configuro um hook?", "Como uso tool use na API?".

**Nível de profissionalismo:** Alto — especialista em documentação e orientação técnica, não em implementação.

> ⚠️ Antes de criar um novo, verificar se já existe um em execução para continuar via `SendMessage`.

---

### `Explore` — Explorador de Código (Read-only)

**Função:** Agente de busca rápida no código. Localiza arquivos, símbolos, padrões e referências.

**Capacidades:**
- Ferramentas: todas, exceto `Agent`, `ExitPlanMode`, `Edit`, `Write`, `NotebookEdit`
- Busca por padrão de arquivo (ex.: `src/components/**/*.tsx`)
- Grep de símbolos ou palavras-chave (ex.: "API endpoints")
- Responde "onde X está definido" ou "quais arquivos referenciam Y"
- Breadth configurável: `quick` (busca única), `medium` (exploração moderada), `very thorough` (múltiplos locais e convenções de nome)

**Uso esperado:** Localizar código rapidamente. NÃO usar para revisão de código, auditoria de design, verificações de consistência entre arquivos ou análise aberta — lê trechos, não arquivos completos.

**Nível de profissionalismo:** Médio-alto — eficiente e preciso para buscas, mas limitado a leitura parcial.

---

### `general-purpose` — Agente de Propósito Geral (Pesquisa e Multietapas)

**Função:** Pesquisa questões complexas, busca código e executa tarefas com múltiplas etapas.

**Capacidades:**
- Acesso total a todas as ferramentas (`*`)
- Melhor que `Explore` quando há incerteza sobre onde encontrar o resultado
- Ideal para tarefas que exigem raciocínio, combinação de fontes e múltiplos passos
- Pode escrever e editar código, além de pesquisar

**Uso esperado:** Quando a busca por uma keyword ou arquivo provavelmente não será resolvida nas primeiras tentativas. Tarefas de pesquisa profunda ou com múltiplas dependências.

**Nível de profissionalismo:** Alto — generalista robusto com capacidade de síntese.

---

### `Plan` — Arquiteto de Software

**Função:** Desenha planos de implementação antes de escrever código.

**Capacidades:**
- Ferramentas: todas, exceto `Agent`, `ExitPlanMode`, `Edit`, `Write`, `NotebookEdit`
- Produz planos passo a passo
- Identifica arquivos críticos e dependências
- Avalia trade-offs arquiteturais
- Não escreve código — apenas planeja

**Uso esperado:** Antes de iniciar uma implementação complexa. Ideal para tarefas que envolvem decisões arquiteturais, refatorações grandes ou adição de funcionalidades que afetam múltiplas camadas.

**Nível de profissionalismo:** Alto — foco em estratégia e arquitetura, não em execução.

---

### `statusline-setup` — Configurador de Status Line

**Função:** Configura a status line do Claude Code nas preferências do usuário.

**Capacidades:**
- Ferramentas: `Read`, `Edit`
- Modifica configurações da status line (exibição de informações no terminal)
- Escopo muito restrito e específico

**Uso esperado:** Somente quando o usuário quer configurar ou personalizar a status line do Claude Code.

**Nível de profissionalismo:** Baixo-médio — ferramenta pontual com escopo muito específico.

---

## SKILLS (`Skill` tool)

Skills são invocadas via a ferramenta `Skill` com `/nome-da-skill`. Cada skill carrega instruções especializadas que o Claude executa diretamente na conversa principal. Usar somente skills listadas — nunca inventar nomes.

---

### `session-start-hook` — Hook de Inicialização de Sessão

**Função:** Cria e configura hooks de startup para o Claude Code na web.

**Capacidades:**
- Configura um `SessionStart` hook no repositório
- Garante que testes e linters possam rodar durante sessões web
- Prepara o ambiente do projeto para uso com Claude Code na web

**Uso esperado:** Quando o usuário quer preparar um repositório para Claude Code na web, garantindo que o ambiente esteja pronto ao iniciar uma sessão.

**Nível de profissionalismo:** Alto — essencial para produtividade em sessões remotas.

---

### `update-config` — Atualizador de Configurações

**Função:** Configura o harness do Claude Code via `settings.json`.

**Capacidades:**
- Cria e modifica hooks (comportamentos automáticos: "sempre que X", "antes/depois de X")
- Gerencia permissões ("permitir comando X", "adicionar permissão Y")
- Define variáveis de ambiente
- Resolve problemas com hooks
- Altera `settings.json` e `settings.local.json`

**Uso esperado:** Automações ("sempre que Claude parar, mostre X"), permissões de ferramentas, variáveis de ambiente, troubleshooting de hooks. Para configurações simples como tema/modelo, preferir `/config`.

**Nível de profissionalismo:** Alto — controla comportamentos persistentes do Claude Code.

---

### `keybindings-help` — Configurador de Atalhos de Teclado

**Função:** Personaliza atalhos de teclado do Claude Code.

**Capacidades:**
- Modifica `~/.claude/keybindings.json`
- Rebind de teclas, adição de chord bindings, alteração da tecla de submit
- Qualquer personalização de keybinding

**Uso esperado:** Quando o usuário quer mudar atalhos, criar combinações de teclas ou personalizar a experiência de teclado no Claude Code.

**Nível de profissionalismo:** Médio — especialista em um aspecto específico da configuração.

---

### `simplify` — Simplificador de Código

**Função:** Revisa código alterado em busca de oportunidades de reutilização, qualidade e eficiência, corrigindo problemas encontrados.

**Capacidades:**
- Analisa código recém-escrito ou modificado
- Identifica duplicação, abstrações prematuras, código desnecessário
- Aplica correções diretas no código

**Uso esperado:** Após implementar uma funcionalidade, para garantir que o código está limpo, eficiente e sem redundâncias. Equivalente a um "cleanup pass" automatizado.

**Nível de profissionalismo:** Alto — melhora a qualidade do código produzido.

---

### `fewer-permission-prompts` — Redutor de Prompts de Permissão

**Função:** Analisa transcrições de sessões e cria uma allowlist de ferramentas para reduzir interrupções por prompts de permissão.

**Capacidades:**
- Varre transcrições em busca de chamadas Bash e MCP read-only frequentes
- Adiciona uma allowlist priorizada ao `.claude/settings.json` do projeto

**Uso esperado:** Quando o usuário está sendo interrompido com muitos prompts de permissão para ações que já aprovou antes. Executar após algumas sessões para que haja dados suficientes para análise.

**Nível de profissionalismo:** Alto — melhora a experiência de uso sem comprometer segurança.

---

### `loop` — Executor de Tarefa Recorrente

**Função:** Executa um prompt ou slash command em intervalos regulares.

**Capacidades:**
- Sintaxe: `/loop <intervalo> <comando>` (ex.: `/loop 5m /foo`, padrão: 10m)
- Útil para polling de status, verificações periódicas, babysitting de deploys/PRs

**Uso esperado:** Tarefas recorrentes como "verificar o deploy a cada 5 minutos", "manter rodando /babysit-prs". NÃO usar para tarefas únicas (one-off).

**Nível de profissionalismo:** Médio — ferramenta de automação de ciclo, simples mas eficaz.

---

### `claude-api` — Desenvolvedor de Apps com Claude API

**Função:** Constrói, depura e otimiza aplicações usando a Claude API / Anthropic SDK.

**Capacidades:**
- Implementa apps com a API da Anthropic incluindo prompt caching obrigatório
- Migra código entre versões de modelos Claude (4.5 → 4.6 → 4.7, modelos aposentados)
- Trabalha com: caching, thinking, compaction, tool use, batch, files, citations, memory
- Configura e otimiza chamadas para modelos Opus, Sonnet e Haiku

**Uso esperado:** Quando o código importa `anthropic` / `@anthropic-ai/sdk`, quando o usuário pede funcionalidades da API (caching, tool use, etc.) ou quer migrar para um modelo mais novo. IGNORAR quando o arquivo usa `openai` ou outro provider.

**Nível de profissionalismo:** Muito alto — especialista de ponta em integração com a Anthropic.

---

### `init` — Inicializador de CLAUDE.md

**Função:** Cria um arquivo `CLAUDE.md` com documentação do codebase para o projeto.

**Capacidades:**
- Analisa a estrutura do projeto
- Gera documentação inicial sobre arquitetura, convenções e contexto relevante para o Claude Code

**Uso esperado:** No início de um projeto novo ou ao adotar o Claude Code em um projeto existente. Cria a "memória de projeto" que o Claude carrega automaticamente.

**Nível de profissionalismo:** Alto — essencial para onboarding e consistência em projetos maiores.

---

### `review` — Revisor de Pull Request

**Função:** Revisa um pull request completo.

**Capacidades:**
- Analisa todas as mudanças de um PR
- Verifica qualidade de código, bugs, inconsistências e boas práticas
- Produz feedback estruturado

**Uso esperado:** Quando o usuário quer uma revisão de código de um PR antes de fazer merge.

**Nível de profissionalismo:** Alto — equivalente a um code review de um desenvolvedor sênior.

---

### `security-review` — Revisor de Segurança

**Função:** Realiza uma revisão de segurança completa das mudanças pendentes na branch atual.

**Capacidades:**
- Analisa mudanças na branch em busca de vulnerabilidades (OWASP Top 10 e além)
- Identifica: injection, XSS, autenticação fraca, exposição de dados, etc.
- Foca nas mudanças do branch, não no projeto inteiro

**Uso esperado:** Antes de fazer merge de funcionalidades que envolvem autenticação, entrada de usuário, acesso a dados ou qualquer superfície de ataque. Passo obrigatório em features críticas.

**Nível de profissionalismo:** Muito alto — especialista em segurança de aplicações.

---

## RESUMO RÁPIDO — QUANDO USAR O QUÊ

| Necessidade | Ferramenta |
|---|---|
| Tarefa genérica / não classificada | Agente `claude` |
| Dúvida sobre Claude Code / API / SDK | Agente `claude-code-guide` |
| Localizar arquivo ou símbolo | Agente `Explore` |
| Pesquisa profunda ou multietapas | Agente `general-purpose` |
| Planejar implementação complexa | Agente `Plan` |
| Configurar status line | Agente `statusline-setup` |
| Preparar repo para sessão web | Skill `session-start-hook` |
| Configurar hooks / permissões / env | Skill `update-config` |
| Personalizar atalhos de teclado | Skill `keybindings-help` |
| Limpar e simplificar código | Skill `simplify` |
| Reduzir prompts de permissão | Skill `fewer-permission-prompts` |
| Tarefa recorrente / polling | Skill `loop` |
| Desenvolver com Claude API | Skill `claude-api` |
| Criar CLAUDE.md do projeto | Skill `init` |
| Revisar pull request | Skill `review` |
| Auditoria de segurança do branch | Skill `security-review` |

---

## O QUE AINDA NÃO TEMOS (gaps identificados)

- **Agente de testes**: não há agente especializado em rodar, diagnosticar ou escrever testes automatizados.
- **Agente de banco de dados**: sem agente focado em migrações, queries ou modelagem de dados.
- **Agente de deploy/infra**: as tools MCP de Vercel e Netlify existem, mas não há um agente orquestrador de deploy.
- **Skill de changelog/release notes**: não há skill para gerar changelogs automaticamente a partir de commits.
- **Skill de documentação de API**: nada para gerar documentação OpenAPI/Swagger automaticamente.
- **Skill de benchmark**: sem skill para medir performance e comparar resultados.

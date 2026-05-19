# Skill: /calendario — Calendário Editorial

Você é o Produtor responsável pelo calendário editorial.

## Repositório de dados
- **owner**: `beareisfarma` | **repo**: `Projetos` | **branch**: `main`
- `creator-agent/data/pipeline.json` → campo `conteudos[]`

## Formas de uso
```
/calendario                              → Visão geral do pipeline
/calendario planejar                     → Sessão interativa de planejamento semanal
/calendario novo "Título" nicho plat     → Adicionar novo conteúdo ao pipeline
/calendario avançar "Título" status      → Atualizar status de um conteúdo
/calendario publicar "Título" url        → Marcar como publicado com a URL
```

---

## Leitura do pipeline

Em todos os comandos, leia o arquivo atual:
`mcp__github__get_file_contents` com `owner="beareisfarma"`, `repo="Projetos"`, `path="creator-agent/data/pipeline.json"`, `ref="refs/heads/main"`.
Decodifique base64 se necessário e parse o JSON.

---

## `/calendario` — Visão geral

Após ler o pipeline, apresente em formato kanban:
```
IDEIA (X)         ROTEIRO (X)      GRAVADO (X)    EDITADO (X)    PUBLICADO (X)
────────────────  ───────────────  ─────────────  ─────────────  ─────────────
• Título 1        • Título 3       • Título 5     • Título 7     • Título 9
  Pets|TikTok       IA|Reels         Farm|Reels     Pets|TikTok    IA|Reels
  Prev: xx/xx       Prev: xx/xx                                    xx/xx
```
Destaque ⚠ itens com `data_prevista` anterior a hoje.

---

## `/calendario planejar`

Com o pipeline lido, faça perguntas em sequência:
1. "Quantos vídeos quer publicar essa semana?"
2. "Quais dias pode gravar?"
3. Para cada vídeo planejado, sugira a melhor ideia aprovada.

Monte e exiba o calendário semanal.

---

## `/calendario novo "Título" nicho plataforma`

Crie item com `id` = timestamp (`YYYYMMDDHHMMSS`), `status="Ideia"`.
Adicione ao array e salve com `mcp__github__push_files`:
- `owner`: `beareisfarma`, `repo`: `Projetos`, `branch`: `main`
- `message`: `"calendario: adicionar [Título]"`
- `files`: `[{"path": "creator-agent/data/pipeline.json", "content": <JSON_ATUALIZADO>}]`

Valores válidos — nicho: `IA` | `Farmácia` | `Pets` | plataforma: `TikTok` | `Reels` | `YouTube` | `Shorts`

Confirme: "✅ **Título** adicionado ao pipeline como Ideia."

---

## `/calendario avançar "Título" status`

Localize por `titulo`, atualize `status`, salve com `push_files`.
Status válidos: `Ideia` → `Roteiro Pronto` → `Gravado` → `Editado` → `Publicado` → `Arquivado`
Confirme: "✅ **Título** avançou para **Status**."

---

## `/calendario publicar "Título" url`

Localize, atualize `status="Publicado"`, `data_publicacao` (hoje, YYYY-MM-DD), `url`.
Salve com `push_files`. Confirme: "✅ Publicado! Use `/analisar \"Título\"` para registrar métricas."

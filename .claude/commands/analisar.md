# Skill: /analisar — Análise de Performance

Você é o Analista de Performance.

## Repositório de dados
- **owner**: `beareisfarma` | **repo**: `Projetos` | **branch**: `main`
- `creator-agent/data/pipeline.json` → campo `conteudos[]`

## Formas de uso
```
/analisar "Título"                                       → Análise com métricas salvas
/analisar "Título" views:45k likes:3.2k saves:890 ...  → Análise com métricas manuais
/analisar youtube VIDEO_ID                              → Buscar stats do YouTube
/analisar comparar                                      → Comparar últimos 30 dias
```

---

## `/analisar "Título"` sem métricas

Leia `creator-agent/data/pipeline.json` via `mcp__github__get_file_contents`.
Localize o vídeo pelo `titulo`.
- Se `views > 0`: use as métricas salvas para análise completa.
- Se `views = 0`: pergunte "Qual o ID do vídeo no YouTube? Ou cole as métricas."

---

## `/analisar "Título"` com métricas fornecidas

Converta valores (ex: 45k → 45000).
Calcule `taxa_engajamento = (likes + comentarios + shares + saves) / views`.

Leia o pipeline, localize o item, atualize as métricas e salve com `mcp__github__push_files`:
- `owner`: `beareisfarma`, `repo`: `Projetos`, `branch`: `main`
- `message`: `"analisar: métricas de [Título]"`
- `files`: `[{"path": "creator-agent/data/pipeline.json", "content": <JSON_ATUALIZADO>}]`

Campos: `views`, `likes`, `saves`, `comentarios`, `shares`, `taxa_engajamento`

---

## Formato da análise completa

```
## 📊 Análise: "Título"
Nicho: X | Plataforma: X | Publicado: DD/MM/AAAA

### Números
| Métrica          | Valor  | Benchmark | Avaliação |
|------------------|--------|-----------|----------|
| Views            | 45.000 | ~20.000   | ⬆ Acima  |
| Taxa engajamento | 9,2%   | ~5%       | ⬆ Acima  |
| Saves            | 890    | ~400      | ⬆ Acima  |

### O que funcionou
### O que pode melhorar
### Recomendação de replicação
```

---

## `/analisar youtube VIDEO_ID`

```bash
python3 creator-agent/scripts/youtube_api.py video VIDEO_ID
```

Apresente no formato de análise completa.

---

## `/analisar comparar`

Leia o pipeline, filtre `status="Publicado"`, ordene por `views` decrescente.

```
## 📊 Comparativo

### Ranking por Views
1. "Título A" — 89k — Pets/TikTok — 11.2% eng

### Por Nicho
| Nicho   | Média Views | Média Eng |
|---------|-------------|-----------|
| Pets    | 45.000      | 10.1%     |

### Próximo conteúdo recomendado
[nicho, formato e gancho ideal]
```

## Benchmarks
- **TikTok**: eng bom 5-8% | excelente >8% | save >1%
- **Reels**: eng bom 3-6% | excelente >6% | save >0.8%

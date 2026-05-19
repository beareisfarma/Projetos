# Skill: /analisar — Análise de Performance de Conteúdo

Você é o Analista de Performance. Analise métricas de vídeos para identificar o que funcionou e como replicar o sucesso.

## IDs dos bancos de dados Notion
- **Conteúdos**: `7571f848a767473fb2219ceb89d58c5e`

## Formas de uso

```
/analisar "Título do vídeo"                    → Análise de um vídeo (busca métricas salvas)
/analisar "Título" views:45k likes:3.2k saves:890 comentarios:145 shares:340
                                               → Análise com métricas coladas manualmente
/analisar youtube VIDEO_ID                     → Buscar stats do YouTube por ID
/analisar comparar                             → Comparar todos os vídeos publicados recentes
```

---

## Comportamento: `/analisar "Título"`

### Se não houver métricas fornecidas:

Busque o vídeo no Notion via `mcp__notion__API-query-data-source`:
- `data_source_id`: `7571f848a767473fb2219ceb89d58c5e`
- `filter`: `{"and": [{"property": "Status", "select": {"equals": "Publicado"}}, {"property": "Data Publicação", "date": {"on_or_after": "DATA_30DIAS"}}]}`

Filtre pelo título. Se encontrar métricas salvas (Views > 0), use-as para análise.

Se não houver métricas, pergunte: "Qual o ID do vídeo no YouTube? Ou cole as métricas diretamente."

### Se métricas forem fornecidas manualmente:

Converta valores (ex: 45k → 45000) e salve no Notion.

Busque o `page_id` do vídeo e use `mcp__notion__API-patch-page` com:
- `properties`:
```json
{
  "Views": {"number": N},
  "Likes": {"number": N},
  "Saves": {"number": N},
  "Comentários": {"number": N},
  "Shares": {"number": N},
  "Taxa Engajamento": {"number": 0.092}
}
```
(Taxa Engajamento em decimal: 9.2% = 0.092)

Calcule a Taxa de Engajamento como: `(likes + comentarios + shares + saves) / views`

---

## Análise completa

Apresente neste formato:

```
## 📊 Análise: "Título do Vídeo"
Nicho: Pets | Plataforma: TikTok | Publicado: DD/MM/AAAA

### Números
| Métrica           | Valor   | Benchmark nicho | Avaliação |
|-------------------|---------|-----------------|-----------|
| Views             | 45.000  | ~20.000         | ⬆ Acima   |
| Taxa engajamento  | 9,2%    | ~5%             | ⬆ Acima   |
| Saves             | 890     | ~400            | ⬆ Acima   |
| Compartilhamentos | 340     | ~150            | ⬆ Acima   |
| Comentários       | 145     | ~200            | ⬇ Abaixo  |

### O que funcionou
[2-3 fatores que contribuíram para o resultado]

### O que pode melhorar
[Baseado nos números abaixo da média]

### Padrão identificado
Compare com outros vídeos do mesmo nicho. Identifique:
- Melhor horário de publicação
- Tipo de gancho que mais converteu

### Recomendação de replicação
O que deste vídeo deve ser replicado no próximo conteúdo do mesmo nicho.
```

---

## Comportamento: `/analisar youtube VIDEO_ID`

```bash
python3 scripts/youtube_api.py video VIDEO_ID
```

Analise e apresente no formato acima.

---

## Comportamento: `/analisar comparar`

Use `mcp__notion__API-query-data-source`:
- `data_source_id`: `7571f848a767473fb2219ceb89d58c5e`
- `filter`: `{"and": [{"property": "Status", "select": {"equals": "Publicado"}}, {"property": "Data Publicação", "date": {"on_or_after": "DATA_30DIAS"}}]}`
- `sorts`: `[{"property": "Views", "direction": "descending"}]`

Faça análise comparativa:

```
## 📊 Comparativo — Últimos 30 dias

### Ranking por Views
1. "Título A" — 89k views — Pets/TikTok — 11.2% eng
2. "Título B" — 45k views — IA/Reels — 9.2% eng

### Por Nicho
| Nicho     | Média Views | Média Eng | Melhor Formato |
|-----------|-------------|-----------|----------------|
| Pets      | 45.000      | 10.1%     | TikTok         |
| IA        | 31.000      | 8.4%      | Reels          |
| Farmácia  | 18.000      | 7.2%      | Reels          |

### Insights estratégicos
[3 conclusões acionáveis]

### Próximo conteúdo recomendado
Qual nicho, formato e gancho maximiza o alcance agora.
```

---

## Benchmarks por plataforma

### TikTok
- Engajamento bom: 5-8% | excelente: >8%
- Save rate boa: >1% | excelente: >2%

### Instagram Reels
- Engajamento bom: 3-6% | excelente: >6%
- Save rate boa: >0.8% | excelente: >1.5%

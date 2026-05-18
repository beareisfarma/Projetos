# Skill: /analisar — Análise de Performance de Conteúdo

Você é o Analista de Performance. Analise métricas de vídeos para identificar o que funcionou, o que não funcionou, e como replicar o sucesso.

## Formas de uso

```
/analisar "Título do vídeo"                    → Análise de um vídeo (busca métricas via API)
/analisar "Título" views:45k likes:3.2k saves:890 comentarios:145 shares:340
                                               → Análise com métricas coladas manualmente
/analisar instagram MEDIA_ID                   → Buscar insights do Instagram por ID
/analisar youtube VIDEO_ID                     → Buscar stats do YouTube por ID
/analisar comparar                             → Comparar todos os vídeos publicados recentes
```

---

## Comportamento: `/analisar "Título"`

### Se não houver métricas fornecidas:
1. Busque no Notion:
```bash
python scripts/notion_api.py publicados --dias=30
```
Filtre pelo título. Se encontrar métricas salvas, use-as.

2. Se não houver métricas no Notion, pergunte:
"Qual o ID do vídeo no Instagram ou YouTube? Ou cole as métricas diretamente."

### Se métricas forem fornecidas manualmente:
Converta os valores (ex: 45k → 45000) e salve no Notion:
```bash
python scripts/notion_api.py update-metrics '{"titulo": "TITULO", "views": N, "likes": N, "saves": N, "comentarios": N, "shares": N}'
```

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
[Analise os dados e liste 2-3 fatores que contribuíram para o resultado]
Exemplo:
- Alto volume de saves (1,9%) indica conteúdo utilitário que as pessoas guardam para consultar
- Taxa de engajamento 84% acima do benchmark do nicho sugere que o gancho reteve bem
- Ratio likes/views de 7% é excelente para TikTok (média: 3-5%)

### O que pode melhorar
[Baseado nos números abaixo da média]
Exemplo:
- Comentários abaixo do esperado: o vídeo pode não ter feito uma pergunta clara ao final
- Sugestão: termine com "Você já passou por isso? Conta aqui nos comentários"

### Padrão identificado
Compare com outros vídeos do mesmo nicho se disponível. Identifique:
- Melhor horário de publicação
- Tipo de gancho que mais converteu
- Duração ideal para o nicho

### Recomendação de replicação
O que deste vídeo deve ser replicado no próximo conteúdo do mesmo nicho.
Inclua: tipo de gancho, formato, duração, elemento que gerou saves.
```

---

## Comportamento: `/analisar instagram MEDIA_ID`

Execute:
```bash
python scripts/instagram_api.py insights MEDIA_ID
```

Análise os resultados e apresente no formato acima.

---

## Comportamento: `/analisar youtube VIDEO_ID`

Execute:
```bash
python scripts/youtube_api.py video VIDEO_ID
```

Analise e apresente no formato acima.

---

## Comportamento: `/analisar comparar`

Execute:
```bash
python scripts/notion_api.py publicados --dias=30
```

Faça análise comparativa:

```
## 📊 Comparativo — Últimos 30 dias

### Ranking por Views
1. "Título A" — 89k views — Pets/TikTok — 11.2% eng
2. "Título B" — 45k views — IA/Reels — 9.2% eng
3. "Título C" — 23k views — Farmácia/TikTok — 6.8% eng

### Por Nicho
| Nicho     | Média Views | Média Eng | Melhor Formato |
|-----------|-------------|-----------|----------------|
| Pets      | 45.000      | 10.1%     | TikTok         |
| IA        | 31.000      | 8.4%      | Reels          |
| Farmácia  | 18.000      | 7.2%      | Reels          |

### Insights estratégicos
[3 conclusões acionáveis baseadas na comparação]

### Próximo conteúdo recomendado
Baseado nos dados: qual nicho, formato e tipo de gancho maximiza o alcance agora.
```

---

## Benchmarks de referência por plataforma

### TikTok
- Taxa de engajamento boa: 5-8% | excelente: >8%
- Save rate boa: >1% | excelente: >2%
- Ratio likes/views médio: 3-5%

### Instagram Reels
- Taxa de engajamento boa: 3-6% | excelente: >6%
- Save rate boa: >0.8% | excelente: >1.5%
- Share rate média: 0.5-1%

# Skill: /relatorio — Relatório Semanal de Performance

Você é o Diretor de Marketing gerando o relatório semanal completo. Compile dados, identifique padrões, gere insights e salve o relatório no Notion.

## IDs dos bancos de dados Notion
- **Conteúdos**: `7571f848a767473fb2219ceb89d58c5e`
- **Relatórios**: `f8d4bcfa883f41708cb9a8c5520d8ac4`

## Uso

```
/relatorio          → Gerar relatório da semana atual
/relatorio passada  → Gerar relatório da semana passada
```

---

## O que fazer

### 1. Obter data atual
```bash
python3 -c "
from datetime import datetime, timedelta
d = datetime.now()
inicio = (d - timedelta(days=d.weekday())).strftime('%Y-%m-%d')
fim = d.strftime('%Y-%m-%d')
inicio_14 = (d - timedelta(days=14)).strftime('%Y-%m-%d')
print(f'INICIO_SEMANA={inicio}')
print(f'FIM_SEMANA={fim}')
print(f'DATA_14DIAS={inicio_14}')
"
```

### 2. Buscar publicados da semana

Use `mcp__notion__API-query-data-source` com:
- `data_source_id`: `7571f848a767473fb2219ceb89d58c5e`
- `filter`: `{"and": [{"property": "Status", "select": {"equals": "Publicado"}}, {"property": "Data Publicação", "date": {"on_or_after": "INICIO_SEMANA"}}]}`
- `sorts`: `[{"property": "Views", "direction": "descending"}]`

Para `/relatorio passada`, use `DATA_14DIAS` e filtre pelos 7-14 dias anteriores.

### 3. Buscar estado do pipeline

Use `mcp__notion__API-query-data-source` com:
- `data_source_id`: `7571f848a767473fb2219ceb89d58c5e`
- `filter`: `{"property": "Status", "select": {"does_not_equal": "Arquivado"}}`

### 4. Buscar ideias aprovadas

Use `mcp__notion__API-query-data-source` com:
- `data_source_id`: `a830e289afa24a3aa8518c87d1143a7c`
- `filter`: `{"property": "Status", "select": {"equals": "Aprovada"}}`
- `sorts`: `[{"property": "Potencial Viral", "direction": "descending"}]`

---

## Formato do relatório

```
╔══════════════════════════════════════════════════════════════╗
║         RELATÓRIO SEMANAL — DD/MM a DD/MM/AAAA              ║
╚══════════════════════════════════════════════════════════════╝

## 📊 NÚMEROS DA SEMANA

| Métrica                  | Esta semana | Meta    | Status  |
|--------------------------|-------------|---------|---------|
| Vídeos publicados        | X           | X       | ✅/⚠️   |
| Total de views           | X.XXX       | X.XXX   | ✅/⚠️   |
| Média de engajamento     | X.X%        | X%      | ✅/⚠️   |
| Saves totais             | X.XXX       | —       | —       |
| Melhor taxa engajamento  | X.X%        | —       | —       |

---

## 🏆 DESTAQUE DA SEMANA

**Vídeo: "Título do Melhor Vídeo"**
Plataforma: X | Nicho: X | Publicado: DD/MM
Views: XX.XXX | Likes: X.XXX | Saves: XXX | Eng: X.X%

Por que performou bem:
→ [análise do que fez esse vídeo se destacar]

---

## 📈 ANÁLISE POR NICHO

| Nicho     | Vídeos | Views  | Eng Médio | Destaque               |
|-----------|--------|--------|-----------|------------------------|
| Pets      | X      | XX.XXX | X.X%      | "Título..."            |
| IA        | X      | XX.XXX | X.X%      | "Título..."            |
| Farmácia  | X      | XX.XXX | X.X%      | "Título..."            |

**Nicho da semana:** [nicho com melhor performance]

---

## 🔍 PADRÕES IDENTIFICADOS

1. **[Padrão sobre tipo de conteúdo]**
2. **[Padrão sobre nicho ou plataforma]**
3. **[Padrão sobre timing ou formato]**

---

## ⚙️ ESTADO DO PIPELINE

| Etapa          | Quantidade | Ação necessária               |
|----------------|------------|-------------------------------|
| Ideia          | X          | Avaliar e aprovar melhores    |
| Roteiro Pronto | X          | Priorizar gravação            |
| Gravado        | X          | Editar esta semana            |
| Editado        | X          | Publicar conforme calendário  |

⚠️ **Atenção:** [conteúdos atrasados ou sem data definida]

---

## 🚀 PRÓXIMA SEMANA

### Ideias aprovadas com maior potencial:
1. ⭐⭐⭐⭐⭐ "Título A" (Pets) — Gancho: "..."
2. ⭐⭐⭐⭐  "Título B" (IA) — Gancho: "..."

### Recomendação estratégica:
[1-2 parágrafos com recomendação baseada nos dados]

---

## ✅ CHECKLIST DA PRÓXIMA SEMANA

- [ ] Gravar X vídeos (Roteiro Pronto: X disponíveis)
- [ ] Editar X vídeos (Gravados: X disponíveis)
- [ ] Publicar X vídeos conforme calendário
- [ ] Avaliar X ideias novas no banco de ideias
- [ ] Rodar /trends para radar de tendências da semana
```

---

## Salvar no Notion

Após exibir o relatório, salve automaticamente com `mcp__notion__API-post-page`:
- `parent`: `{"database_id": "f8d4bcfa883f41708cb9a8c5520d8ac4"}`
- `properties`:
```json
{
  "Título": {"title": [{"type": "text", "text": {"content": "Semana de DD/MM a DD/MM"}}]},
  "Período": {"date": {"start": "AAAA-MM-DD", "end": "AAAA-MM-DD"}},
  "Total Publicados": {"number": N},
  "Total Views": {"number": N},
  "Melhor Vídeo": {"rich_text": [{"type": "text", "text": {"content": "Título — Xk views, X% eng"}}]},
  "Insights": {"rich_text": [{"type": "text", "text": {"content": "resumo dos padrões"}}]},
  "Próximos Passos": {"rich_text": [{"type": "text", "text": {"content": "resumo das recomendações"}}]}
}
```

Confirme: "✅ Relatório salvo no Notion."

---

## Ao final, sempre pergunte:
"Quer que eu gere os roteiros para os top 2 conteúdos da próxima semana? Use `/roteiro "Título" mercado plataforma`."

# Skill: /relatorio — Relatório Semanal

Você é o Diretor de Marketing gerando o relatório semanal.

## Repositório de dados
- **owner**: `beareisfarma` | **repo**: `Projetos` | **branch**: `main`
- `creator-agent/data/pipeline.json` e `creator-agent/data/ideias.json`

## Uso
```
/relatorio          → Semana atual
/relatorio passada  → Semana passada
```

---

## O que fazer

### 1. Obter datas
```bash
python3 -c "
from datetime import datetime, timedelta
d = datetime.now()
print(f'INICIO={(d-timedelta(days=d.weekday())).strftime(\"%Y-%m-%d\")}')
print(f'FIM={d.strftime(\"%Y-%m-%d\")}')
print(f'INICIO_14={(d-timedelta(days=14)).strftime(\"%Y-%m-%d\")}')
"
```

### 2. Ler dados

Use `mcp__github__get_file_contents` em paralelo:
- `path`: `creator-agent/data/pipeline.json`, `ref`: `refs/heads/main`
- `path`: `creator-agent/data/ideias.json`, `ref`: `refs/heads/main`

- **Publicados da semana**: `status="Publicado"` e `data_publicacao >= INICIO`
- **Pipeline**: todos não-arquivados
- **Ideias aprovadas**: `status="Aprovada"`

---

## Formato do relatório

```
╔══════════════════════════════════════════════════════════════╗
║       RELATÓRIO SEMANAL — DD/MM a DD/MM/AAAA                ║
╚══════════════════════════════════════════════════════════════╝

## 📊 NÚMEROS DA SEMANA
| Métrica              | Valor  |
|----------------------|--------|
| Vídeos publicados    | X      |
| Total de views       | X.XXX  |
| Média de engajamento | X.X%   |

## 🏆 DESTAQUE
**"Título"** — Plataforma: X | Nicho: X | DD/MM
Views: X | Eng: X.X%
→ Por que performou: [análise]

## 📈 POR NICHO
| Nicho    | Vídeos | Views  | Eng Médio |
|----------|--------|--------|-----------|
| Pets     | X      | XX.XXX | X.X%      |

## 🔍 PADRÕES
1. [padrão]
2. [padrão]
3. [padrão]

## ⚙️ PIPELINE
| Etapa   | Qtd | Ação          |
|---------|-----|---------------|
| Ideia   | X   | Avaliar       |
| Roteiro | X   | Gravar        |
| Editado | X   | Publicar      |

## 🚀 PRÓXIMA SEMANA
1. ⭐⭐⭐⭐⭐ "Título A" (Pets) — Gancho: "..."
[Recomendação estratégica]

## ✅ CHECKLIST
- [ ] Gravar X vídeos
- [ ] Publicar X vídeos
- [ ] Rodar /trends
```

---

## Ao final:
"Quer que eu gere os roteiros para os top 2 da próxima semana?"

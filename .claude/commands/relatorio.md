# Skill: /relatorio — Relatório Semanal

Você é o Diretor de Marketing gerando o relatório semanal.

## Repositório de dados
- **owner**: `beareisfarma` | **repo**: `Projetos` | **branch**: `main`
- `data/pipeline.json` e `data/ideias.json`

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
inicio = (d - timedelta(days=d.weekday())).strftime('%Y-%m-%d')
fim = d.strftime('%Y-%m-%d')
print(f'INICIO={inicio}')
print(f'FIM={fim}')
print(f'INICIO_14={(d-timedelta(days=14)).strftime(\"%Y-%m-%d\")}')
"
```

### 2. Ler dados

Use `mcp__github__get_file_contents` para ler ambos os arquivos em paralelo:
- `data/pipeline.json` (owner=beareisfarma, repo=Projetos, ref=refs/heads/main)
- `data/ideias.json`

Decodifique e parse como JSON.

- **Publicados da semana**: `status="Publicado"` e `data_publicacao >= INICIO`
- **Pipeline atual**: todos os conteúdos não-arquivados
- **Ideias aprovadas**: `ideias[]` com `status="Aprovada"`

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
| Melhor engajamento   | X.X%   |

## 🏆 DESTAQUE DA SEMANA
**"Título"** — Plataforma: X | Nicho: X | DD/MM
Views: X | Eng: X.X%
→ Por que performou bem: [análise]

## 📈 ANÁLISE POR NICHO
| Nicho    | Vídeos | Views  | Eng Médio |
|----------|--------|--------|-----------|
| Pets     | X      | XX.XXX | X.X%      |
| IA       | X      | XX.XXX | X.X%      |
| Farmácia | X      | XX.XXX | X.X%      |

## 🔍 PADRÕES IDENTIFICADOS
1. [padrão tipo de conteúdo]
2. [padrão nicho/plataforma]
3. [padrão timing/formato]

## ⚙️ ESTADO DO PIPELINE
| Etapa  | Qtd | Ação |
|--------|-----|------|
| Ideia  | X   | Avaliar |
| Roteiro| X   | Gravar |
| Gravado| X   | Editar |
| Editado| X   | Publicar |

## 🚀 PRÓXIMA SEMANA
1. ⭐⭐⭐⭐⭐ "Título A" (Pets) — Gancho: "..."
2. ⭐⭐⭐⭐  "Título B" (IA) — Gancho: "..."

[Recomendação estratégica]

## ✅ CHECKLIST
- [ ] Gravar X vídeos
- [ ] Editar X vídeos
- [ ] Publicar X vídeos
- [ ] Rodar /trends
```

---

## Ao final, sempre pergunte:
"Quer que eu gere os roteiros para os top 2 da próxima semana?"

# Skill: /ideia — Banco de Ideias

Você é o Analista de Conteúdo responsável por capturar, avaliar e organizar ideias de vídeo.

## Formas de uso

```
/ideia "Título da ideia"                 → Avaliar e salvar nova ideia
/ideia listar                            → Ver banco de ideias por prioridade
/ideia listar pets                       → Filtrar por mercado (ia | farmacia | pets)
/ideia aprovar "Título"                  → Mover ideia para Aprovada (pronta para gravar)
/ideia descartar "Título"               → Arquivar ideia descartada
```

---

## Comportamento: `/ideia "Título"`

### Passo 1 — Identificar o mercado
Analise o título e pergunte se não for óbvio:
- É sobre **IA**, **Farmácia/Saúde** ou **Pets**?

### Passo 2 — Pontuar o potencial viral (1 a 5)

Use estes critérios para calcular a pontuação:

| Critério | Peso | Perguntas |
|----------|------|-----------|
| Curiosidade / Dúvida comum | 25% | Muita gente já quis saber isso? |
| Emoção / Identificação | 20% | Gera emoção, raiva, surpresa ou alívio? |
| Potencial de compartilhamento | 20% | As pessoas vão querer mandar para alguém? |
| Timing / Tendência | 20% | Está em alta agora ou é perene? |
| Contra-intuitivo / Surpresa | 15% | Contradiz algo que as pessoas achavam? |

Calcule a nota e apresente justificativa.

### Passo 3 — Sugerir o gancho e ângulo
Com base no mercado e no tom correto:
- **IA:** provocador, impacto na vida real
- **Farmácia:** desmistificador, confiável
- **Pets:** afetivo, identificação do tutor

Sugira:
1. Gancho principal (3 segundos)
2. Por que essa ideia vai funcionar (2-3 linhas)

### Passo 4 — Salvar no Notion
Execute:
```bash
echo '{
  "titulo": "TITULO",
  "mercado": "MERCADO",
  "potencial": NOTA,
  "fonte": "FONTE",
  "gancho": "GANCHO_SUGERIDO",
  "porque_funciona": "JUSTIFICATIVA"
}' | python scripts/notion_api.py add-ideia
```

Substituir:
- FONTE: Trends | Pesquisa | Comentários | Pessoal

### Passo 5 — Apresentar resultado
```
✅ Ideia salva no Banco de Ideias!

📋 TÍTULO DA IDEIA
   Mercado: Pets | Potencial: ⭐⭐⭐⭐ (4/5)
   
🎬 Gancho sugerido:
   "Todo tutor já viu isso, mas ninguém sabe por quê."

💡 Por que vai funcionar:
   Alta identificação — 80% dos tutores passam por isso e ficam sem resposta.
   Potencial de salvar alto: conteúdo útil que as pessoas guardam para consultar.

▶ Próximos passos:
   - Use /ideia aprovar "Título" quando quiser colocar em produção
   - Use /roteiro "Título" pets reels para gerar o script
```

---

## Comportamento: `/ideia listar [mercado]`

Execute:
```bash
python scripts/notion_api.py ideias --status=Nova
# ou com filtro de mercado:
python scripts/notion_api.py ideias --status=Nova --mercado=Pets
```

Também busque aprovadas:
```bash
python scripts/notion_api.py ideias --status=Aprovada
```

Apresente em duas seções:

```
### 🟢 Aprovadas — Prontas para Produção
⭐⭐⭐⭐⭐ Título A (Pets) — "Gancho..."
⭐⭐⭐⭐  Título B (IA) — "Gancho..."

### 🔵 Novas — Aguardando avaliação/aprovação  
⭐⭐⭐⭐  Título C (Farmácia) — "Gancho..."
⭐⭐⭐   Título D (Pets) — "Gancho..."
```

Ao final, sugira: "Quer aprovar alguma para produção? Use `/ideia aprovar "Título"`."

---

## Comportamento: `/ideia aprovar "Título"`

Execute:
```bash
python scripts/notion_api.py update-status '{"titulo": "TITULO", "status": "Aprovada"}'
```

Confirme e sugira próximo passo:
```
✅ Ideia aprovada para produção!
Próximo passo: /roteiro "Título" mercado reels
Ou adicione ao pipeline: /calendario novo "Título" mercado plataforma
```

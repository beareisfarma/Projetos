# Como enviar o painel de médicos

Coloque aqui o arquivo do painel (ex.: `painel.csv`). Três formas de me enviar:

1. **Subir o arquivo pelo GitHub** (recomendado): abra esta pasta no GitHub,
   clique em **Add file > Upload files**, suba seu `.csv` ou `.xlsx` e confirme.
   Depois é só me dizer o nome do arquivo.
2. **Colar os dados no chat**: cole a tabela (ou o conteúdo do CSV) e eu salvo
   aqui como `.csv` para você.
3. **Exportar do Excel/Sheets como CSV** e usar a opção 1 ou 2. CSV é o formato
   ideal; `.xlsx` também funciona.

## Colunas esperadas (perfil agenda por frequência)

Use `Roteirizador/modelo_painel_medicos.csv` como modelo. Os nomes das colunas
são flexíveis (aceitam acento, espaço, `_` ou `-`):

| Coluna | Obrigatória | Exemplo | Se vazia |
|--------|:-----------:|---------|----------|
| `nome` | sim | Dr. Ana Cardoso | — |
| `especialidade` | não | Cardiologia | sem prioridade especial |
| `frequencia` | **sim** | 4 | médico é ignorado |
| `endereco` | não | Av. Paulista 1000, São Paulo - SP | sem refino de proximidade |
| `bairro` | não | Bela Vista | "(sem bairro)" |
| `melhor_dia` | não | seg,qua / "seg a sex" | segunda a sexta |
| `turno` | não | manhã / tarde | manhã e tarde |
| `dias_desde_a_ultima_visita` | não | 45 | 0 |
| `cat` | não | A | (em branco) |

Depois de enviar, me diga o período do ciclo e os feriados/pontes, ou cole um
bloco `REGRAS:` (veja a skill `/roteirizador`).

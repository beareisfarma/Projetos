/**
 * Ajustes: dados da escolinha, chave Pix, backup e o exemplo.
 *
 * O aviso sobre onde os dados moram fica aqui em cima e não em letra miúda:
 * enquanto não houver servidor, o backup é a ÚNICA cópia. Esconder isso seria
 * entregar uma armadilha para um negócio de verdade.
 */
import { estado, salvar, substituir, backupJson, nomeDoBackup, lerBackup, apagarTudo } from '../estado.js';
import { esc, recado, baixar, confirmar } from '../ui.js';
import { atualizar, ir } from '../rota.js';
import { escolinhaDeExemplo } from '../exemplo.js';
import { caixaEmCsv, mensalidadesEmCsv, nomeDoCsv } from '../planilha.js';
import { telefoneBonito, plural } from '../formato.js';

export function render(alvo) {
  const e = estado.escola;
  const total = estado.atletas.length + estado.mensalidades.length + estado.lancamentos.length;

  alvo.innerHTML = `
    <h2>Ajustes</h2>
    <p class="legenda">Dados da escolinha, Pix da cobrança e a cópia de segurança.</p>

    <div class="faixa"><strong>Seus dados moram neste navegador.</strong>
      Não há servidor ainda: limpar os dados do site, trocar de celular ou usar outro navegador
      começa do zero. Baixe o backup com frequência — é a única cópia.</div>

    <h3>A escolinha</h3>
    <label class="campo"><span>Nome</span><input id="nome" value="${esc(e.nome)}" placeholder="Escolinha Saque e Viagem"></label>
    <div class="dupla">
      <label class="campo"><span>Responsável</span><input id="responsavel" value="${esc(e.responsavel)}"></label>
      <label class="campo"><span>WhatsApp</span><input id="telefone" inputmode="tel" value="${esc(telefoneBonito(e.telefone))}"></label>
    </div>

    <h3>Pix da cobrança</h3>
    <p class="legenda">Com a chave preenchida, toda cobrança sai com o código copia e cola já no valor certo.</p>
    <label class="campo"><span>Chave Pix</span>
      <input id="pixChave" value="${esc(e.pixChave)}" placeholder="CNPJ, e-mail, telefone ou chave aleatória"></label>
    <div class="dupla">
      <label class="campo"><span>Nome do recebedor</span>
        <input id="pixNome" value="${esc(e.pixNome)}" placeholder="como está na conta" maxlength="25"></label>
      <label class="campo"><span>Cidade</span><input id="pixCidade" value="${esc(e.pixCidade)}" maxlength="15"></label>
    </div>
    <label class="campo"><span>Vencimento padrão (dia do mês)</span>
      <input id="vencimentoPadrao" type="number" min="1" max="31" value="${esc(e.vencimentoPadrao || 10)}"></label>
    <div class="acoes"><button class="btn cheio" id="gravar">Gravar dados da escolinha</button></div>

    <h3>Cópia de segurança</h3>
    <div class="cartao">
      <div style="font-size:.85rem;color:var(--tinta2);margin-bottom:.7rem">
        ${total} registro(s) guardados. O backup é um arquivo JSON com tudo dentro.
      </div>
      <div class="acoes" style="margin:0">
        <button class="btn cheio" id="backup">Baixar backup</button>
        <button class="btn" id="restaurar">Restaurar de um arquivo</button>
      </div>
    </div>
    <input type="file" id="arquivo" accept="application/json,.json" hidden>

    <h3>Levar para a planilha</h3>
    <div class="cartao">
      <div style="font-size:.85rem;color:var(--tinta2);margin-bottom:.7rem">
        Abre direto no Excel e no Google Planilhas. Serve para mandar ao contador
        — e para você não ficar preso a esta ferramenta.
      </div>
      <div class="acoes" style="margin:0">
        <button class="btn" id="csv-caixa">Caixa em CSV</button>
        <button class="btn" id="csv-mensalidades">Mensalidades em CSV</button>
      </div>
    </div>

    <h3>Começar</h3>
    <div class="cartao">
      <div style="font-size:.85rem;color:var(--tinta2);margin-bottom:.7rem">
        Carregue uma escolinha de exemplo para ver tudo funcionando — três times, quinze atletas,
        mensalidades em atraso, caixa com movimento e jogos escalados.
      </div>
      <div class="acoes" style="margin:0">
        <button class="btn" id="exemplo">Carregar exemplo</button>
        <button class="btn perigo" id="zerar">Apagar tudo</button>
      </div>
    </div>

    <h3>Sobre</h3>
    <p class="legenda">Quadra v1 · funciona offline · pode ser instalado na tela de início
      (no iPhone: Compartilhar → Adicionar à Tela de Início).</p>`;

  alvo.querySelector('#gravar').addEventListener('click', async () => {
    Object.assign(estado.escola, {
      nome: alvo.querySelector('#nome').value.trim(),
      responsavel: alvo.querySelector('#responsavel').value.trim(),
      telefone: alvo.querySelector('#telefone').value.replace(/\D/g, ''),
      pixChave: alvo.querySelector('#pixChave').value.trim(),
      pixNome: alvo.querySelector('#pixNome').value.trim(),
      pixCidade: alvo.querySelector('#pixCidade').value.trim(),
      vencimentoPadrao: Number(alvo.querySelector('#vencimentoPadrao').value) || 10,
    });
    await salvar(); recado('Dados gravados.'); atualizar();
  });

  alvo.querySelector('#backup').addEventListener('click', () => {
    baixar(nomeDoBackup(), backupJson());
    recado('Backup baixado.');
  });

  alvo.querySelector('#csv-caixa').addEventListener('click', () => {
    if (!estado.lancamentos.length) { recado('Nenhum lançamento para exportar.'); return; }
    baixar(nomeDoCsv(estado.escola, 'caixa'), caixaEmCsv(estado.lancamentos), 'text/csv;charset=utf-8');
    recado('Caixa exportado.');
  });

  alvo.querySelector('#csv-mensalidades').addEventListener('click', () => {
    if (!estado.mensalidades.length) { recado('Nenhuma mensalidade para exportar.'); return; }
    baixar(nomeDoCsv(estado.escola, 'mensalidades'),
      mensalidadesEmCsv(estado.mensalidades, estado.atletas, estado.times), 'text/csv;charset=utf-8');
    recado('Mensalidades exportadas.');
  });

  const arquivo = alvo.querySelector('#arquivo');
  alvo.querySelector('#restaurar').addEventListener('click', () => arquivo.click());
  arquivo.addEventListener('change', async () => {
    const f = arquivo.files?.[0];
    if (!f) return;
    try {
      const dados = lerBackup(await f.text());
      if (!confirmar(`Restaurar ${plural(dados.atletas.length, 'atleta')} de "${dados.escola.nome || 'sem nome'}"?\n\nTudo que está aqui agora é substituído.`)) return;
      substituir(dados);
      await salvar(); recado('Backup restaurado.'); ir('painel');
    } catch (erro) {
      recado(erro.message || 'Não consegui ler esse arquivo.');
    } finally {
      arquivo.value = '';
    }
  });

  alvo.querySelector('#exemplo').addEventListener('click', async () => {
    if (estado.atletas.length && !confirmar('Isto substitui o que já está no app pelo exemplo. Continuar?')) return;
    substituir(escolinhaDeExemplo());
    await salvar(); recado('Exemplo carregado.'); ir('painel');
  });

  alvo.querySelector('#zerar').addEventListener('click', async () => {
    if (!confirmar('Apagar TUDO deste navegador?\n\nNão dá para desfazer. Baixe o backup antes.')) return;
    await apagarTudo(); recado('Tudo apagado.'); ir('painel');
  });
}

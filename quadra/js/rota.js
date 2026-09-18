/**
 * Um roteador minúsculo, separado do app.js só para as telas poderem chamar
 * `ir()` e `atualizar()` sem importar o app — o que fecharia um ciclo de
 * importação (app importa tela, tela importa app) e quebra em módulo nativo.
 */
let irPara = () => {};
let redesenhar = () => {};

export const configurarRota = (fnIr, fnRedesenhar) => { irPara = fnIr; redesenhar = fnRedesenhar; };

/** Troca de tela. `params` chega na tela — é assim que "em atraso" abre já filtrado. */
export const ir = (tela, params = {}) => irPara(tela, params);

/** Redesenha a tela atual sem mudar de aba. Chamado depois de toda gravação. */
export const atualizar = () => redesenhar();

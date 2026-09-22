/*
 * Endereço do projeto Supabase e a chave PUBLICÁVEL.
 *
 * Esta chave é feita para ficar no navegador: sozinha ela não lê nada. O que
 * protege os dados é o Row Level Security no banco — cada linha só é entregue a
 * quem provou ser o dono dela (`usuario = auth.uid()`).
 *
 * A chave que realmente abre tudo (service_role) NÃO está aqui e não existe
 * neste repositório: ela vive apenas dentro da Edge Function `cadastrar`, no
 * ambiente do Supabase.
 */
export const CONFIG = {
  url: "https://lbphkvbucukfptdutmmp.supabase.co",
  chave: "sb_publishable_WZBeUIK5-ePQuFk_nZcydA_oAQavLnc",
};

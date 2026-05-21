#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Agenda de visitacao por frequencia (perfil "visitacao medica" / Cluster F).

Diferente do roteirizador.py (rota geografica diaria), este modulo resolve um
problema de AGENDAMENTO PERIODICO: distribuir, ao longo de um ciclo, exatamente
'frequencia' visitas por medico, respeitando:
  - periodo do ciclo, com fins de semana e datas bloqueadas (feriados/pontes);
  - capacidade fixa por dia em slots de horario (manha e tarde);
  - intervalo minimo entre visitas do mesmo medico (>=7 dias; >=4 se freq alta);
  - melhor dia / turno do medico (flexibilizados quando inviavel);
  - prioridade por especialidade e criterios de desempate;
  - agrupamento geografico por bairro (bairro foco + proximos) e sequencia de
    medicos no mesmo endereco.

Usa a biblioteca padrao + helpers de roteirizador.py. Saida em .xlsx (se
openpyxl estiver disponivel) ou em .csv (fallback).

Exemplo (Cluster F):
    python3 agenda_visitacao.py --arquivo painel.csv \
        --inicio-ciclo 2026-04-20 --fim-ciclo 2026-06-10 \
        --bloqueios 21/04,23/04,01/05,04/06,05/06
"""

import argparse
import csv
import os
import sys
from datetime import date, datetime, timedelta

from roteirizador import (normalizar, parse_dias, haversine_km, geocodificar,
                          _linhas_do_arquivo)

DIAS_PT = ["Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado", "Domingo"]

SLOTS_MANHA_PADRAO = ["08:00", "09:00", "10:00", "11:00"]
SLOTS_TARDE_PADRAO = ["13:30", "14:30", "15:30", "16:30"]


# ---------------------------------------------------------------------------
# Parsers
# ---------------------------------------------------------------------------

def parse_turno(texto):
    """Retorna conjunto {'M','T'}. Vazio -> ambos."""
    n = normalizar(texto)
    if not n or "amb" in n or ("manha" in n and "tarde" in n):
        return {"M", "T"}
    s = set()
    if "manha" in n or n == "m":
        s.add("M")
    if "tarde" in n or n == "t":
        s.add("T")
    return s or {"M", "T"}


def parse_inteiro(texto, padrao=0):
    import re
    achados = re.findall(r"-?\d+", str(texto))
    return int(achados[0]) if achados else padrao


def parse_data(texto, ano_padrao=None):
    """Aceita AAAA-MM-DD, DD/MM/AAAA ou DD/MM (usa ano_padrao)."""
    t = str(texto).strip()
    if not t:
        return None
    if "-" in t:
        return datetime.strptime(t, "%Y-%m-%d").date()
    partes = t.split("/")
    if len(partes) == 3:
        return date(int(partes[2]), int(partes[1]), int(partes[0]))
    if len(partes) == 2 and ano_padrao:
        return date(ano_padrao, int(partes[1]), int(partes[0]))
    raise ValueError("Data invalida: {}".format(texto))


def parse_bloqueios(texto, ano_padrao):
    if not texto:
        return set()
    return {parse_data(p, ano_padrao) for p in texto.split(",") if p.strip()}


def prioridade_especialidade(esp):
    """Prioridade Cluster F (1 = maior)."""
    e = normalizar(esp)
    if "cardio" in e or "endocrin" in e:
        return 1
    if "geriatr" in e:
        return 2
    if "clinic" in e and "geral" in e:
        return 3
    return 4


# ---------------------------------------------------------------------------
# Leitura do painel
# ---------------------------------------------------------------------------

_ALIASES = {
    "nome": ["nome", "medico", "nome do medico", "nome medico", "profissional"],
    "especialidade": ["especialidade", "espec"],
    "freq": ["frequencia", "freq", "visitas", "frequencia painel", "frequencia alvo"],
    "endereco": ["endereco", "endereco completo", "logradouro", "address"],
    "bairro": ["bairro", "regiao", "zona"],
    "melhor_dia": ["melhor dia", "melhordia", "dia", "dias", "dias preferenciais"],
    "turno": ["turno", "periodo", "periodo preferencial"],
    "dias_ultima": ["dias desde a ultima visita", "dias desde ultima visita",
                    "dias ultima visita", "dias_ultima", "dias sem visita"],
    "cat": ["cat", "categoria", "classificacao"],
}


def _canon(s):
    """Normaliza nome de coluna: sem acento, minusculo, _/-/espacos unificados."""
    import re
    return re.sub(r"[\s_\-]+", " ", normalizar(s)).strip()


def _mapear(cabecalho):
    norm = {_canon(c): c for c in cabecalho}
    mapa = {}
    for campo, nomes in _ALIASES.items():
        for nome in nomes:
            if _canon(nome) in norm:
                mapa[campo] = norm[_canon(nome)]
                break
    return mapa


def ler_painel(caminho, ciclo_inicio, geocodificar_enderecos):
    linhas = [l for l in _linhas_do_arquivo(caminho) if any(str(c).strip() for c in l)]
    if len(linhas) < 2:
        sys.exit("ERRO: painel vazio ou sem dados.")
    cabecalho = [str(c) for c in linhas[0]]
    mapa = _mapear(cabecalho)
    if "nome" not in mapa:
        mapa["nome"] = cabecalho[0]
    if "freq" not in mapa:
        sys.exit("ERRO: o painel precisa de uma coluna de Frequencia.\n"
                 "Colunas encontradas: {}".format(", ".join(cabecalho)))
    idx = {c: cabecalho.index(col) for c, col in mapa.items()}

    medicos = []
    for n, linha in enumerate(linhas[1:], start=2):
        def val(c):
            i = idx.get(c)
            return str(linha[i]).strip() if i is not None and i < len(linha) else ""

        freq = parse_inteiro(val("freq"), 0)
        if freq <= 0:
            continue  # sem frequencia, nao demanda visita
        coord = None
        if geocodificar_enderecos and val("endereco"):
            coord = geocodificar(val("endereco"))
        medicos.append({
            "nome": val("nome") or "Medico {}".format(n),
            "especialidade": val("especialidade"),
            "freq": freq,
            "endereco": val("endereco"),
            "bairro": val("bairro") or "(sem bairro)",
            "dias": parse_dias(val("melhor_dia")) or {0, 1, 2, 3, 4},
            "turnos": parse_turno(val("turno")),
            "dias_ultima": parse_inteiro(val("dias_ultima"), 0),
            "cat": val("cat"),
            "prioridade": prioridade_especialidade(val("especialidade")),
            "coord": coord,
        })
    return medicos


# ---------------------------------------------------------------------------
# Calendario
# ---------------------------------------------------------------------------

def dias_uteis(inicio, fim, bloqueios):
    dias, d = [], inicio
    while d <= fim:
        if d.weekday() < 5 and d not in bloqueios:
            dias.append(d)
        d += timedelta(days=1)
    return dias


# ---------------------------------------------------------------------------
# Planejamento (heuristica construtiva + reparo)
# ---------------------------------------------------------------------------

class P:  # parametros
    pass


def _min_dias(med, p):
    return p.espacamento_alto if med["freq"] >= p.freq_alto else p.espacamento


def _centroides_bairro(medicos):
    acc = {}
    for m in medicos:
        if m["coord"]:
            b = normalizar(m["bairro"])
            la, lo, c = acc.get(b, (0.0, 0.0, 0))
            acc[b] = (la + m["coord"][0], lo + m["coord"][1], c + 1)
    return {b: (la / c, lo / c) for b, (la, lo, c) in acc.items() if c}


def planejar(medicos, dias, p):
    cap_m, cap_t = len(p.slots_manha), len(p.slots_tarde)
    inicio, fim = dias[0], dias[-1]
    fim_semana1 = inicio + timedelta(days=6)
    centroides = _centroides_bairro(medicos)

    for m in medicos:
        m["restantes"] = m["freq"]
        m["datas"] = []
        m["min_dias"] = _min_dias(m, p)
        m["next_elig"] = inicio + timedelta(days=max(0, m["min_dias"] - m["dias_ultima"]))

    agenda = {d: {"M": [], "T": []} for d in dias}

    def urgencia(m, dia):
        base = max(dia, m["next_elig"])
        if base > fim:
            return -999  # ja inviavel -> tratar como urgentissimo (sera reportado)
        disp = (fim - base).days
        max_possivel = disp // m["min_dias"] + 1
        return max_possivel - m["restantes"]  # menor = mais urgente

    def colocar(dia, idx_dia, flex_dia, flex_turno):
        if (cap_m - len(agenda[dia]["M"])) <= 0 and (cap_t - len(agenda[dia]["T"])) <= 0:
            return
        ja = {a["med"]["nome"] for a in agenda[dia]["M"] + agenda[dia]["T"]}
        cand = [m for m in medicos if m["restantes"] > 0 and dia >= m["next_elig"]
                and m["nome"] not in ja and (flex_dia or dia.weekday() in m["dias"])]
        if not cand:
            return
        prim = inicio <= dia <= fim_semana1
        progresso = (idx_dia + 1) / len(dias)

        def chave_prio(m):
            db30 = 1 if (prim and m["dias_ultima"] > 30) else 0
            adiantado = 1 if (m["freq"] - m["restantes"]) >= m["freq"] * progresso else 0
            return (urgencia(m, dia), adiantado, -m["freq"], -db30,
                    -m["dias_ultima"], m["prioridade"], m["freq"] - m["restantes"])

        # bairro foco = do candidato de maior prioridade
        foco = min(cand, key=chave_prio)["bairro"]
        foco_n = normalizar(foco)
        dens = {}
        for m in cand:
            dens[normalizar(m["bairro"])] = dens.get(normalizar(m["bairro"]), 0) + 1

        def dist_foco(m):
            if m["coord"] and foco_n in centroides:
                return haversine_km(m["coord"], centroides[foco_n])
            return 0.0

        def chave_geo(m):
            mesmo = 0 if normalizar(m["bairro"]) == foco_n else 1
            return (urgencia(m, dia), mesmo, dist_foco(m),
                    -dens.get(normalizar(m["bairro"]), 0)) + chave_prio(m)

        for m in sorted(cand, key=chave_geo):
            livres_m = cap_m - len(agenda[dia]["M"])
            livres_t = cap_t - len(agenda[dia]["T"])
            if livres_m <= 0 and livres_t <= 0:
                break
            obs = []
            if dia.weekday() not in m["dias"]:
                obs.append("dia flexibilizado")
            destino = None
            if "M" in m["turnos"] and livres_m > 0:
                destino = "M"
            elif "T" in m["turnos"] and livres_t > 0:
                destino = "T"
            elif flex_turno and livres_m > 0:
                destino, _ = "M", obs.append("turno flexibilizado")
            elif flex_turno and livres_t > 0:
                destino, _ = "T", obs.append("turno flexibilizado")
            if destino is None:
                continue
            agenda[dia][destino].append({"med": m, "obs": obs})
            m["restantes"] -= 1
            m["datas"].append(dia)
            m["next_elig"] = dia + timedelta(days=m["min_dias"])

    # Passe 1: estrito (melhor dia + turno preferido)
    for i, dia in enumerate(dias):
        colocar(dia, i, flex_dia=False, flex_turno=False)
    # Passe 2: flexibiliza dia (reparo de frequencia)
    if any(m["restantes"] > 0 for m in medicos):
        for i, dia in enumerate(dias):
            colocar(dia, i, flex_dia=True, flex_turno=False)
    # Passe 3: flexibiliza turno
    if any(m["restantes"] > 0 for m in medicos):
        for i, dia in enumerate(dias):
            colocar(dia, i, flex_dia=True, flex_turno=True)

    return agenda


# ---------------------------------------------------------------------------
# Montagem das saidas
# ---------------------------------------------------------------------------

def _ordenar_geo(itens):
    """Ordena itens de um turno por bairro (mais denso primeiro) e endereco."""
    dens = {}
    for it in itens:
        b = normalizar(it["med"]["bairro"])
        dens[b] = dens.get(b, 0) + 1
    return sorted(itens, key=lambda it: (-dens[normalizar(it["med"]["bairro"])],
                                         normalizar(it["med"]["bairro"]),
                                         normalizar(it["med"]["endereco"]),
                                         it["med"]["nome"]))


def montar_agenda(agenda, dias, p):
    linhas = []
    vagas = []
    for d in dias:
        for periodo, slots in (("M", p.slots_manha), ("T", p.slots_tarde)):
            itens = _ordenar_geo(agenda[d][periodo])
            for i, slot in enumerate(slots):
                if i < len(itens):
                    m = itens[i]["med"]
                    obs = itens[i]["obs"]
                    linhas.append({
                        "data": d.strftime("%d/%m/%Y"),
                        "dia": DIAS_PT[d.weekday()],
                        "horario": slot,
                        "periodo": "Manha" if periodo == "M" else "Tarde",
                        "cat": m["cat"],
                        "frequencia": m["freq"],
                        "medico": m["nome"],
                        "especialidade": m["especialidade"],
                        "bairro": m["bairro"],
                        "observacoes": "; ".join(obs),
                    })
                else:
                    vagas.append({"data": d, "periodo": periodo, "horario": slot})
    return linhas, vagas


def montar_cobertura(medicos):
    cob = []
    for m in sorted(medicos, key=lambda x: (x["prioridade"], -x["freq"], x["nome"])):
        planejada = m["freq"] - m["restantes"]
        cob.append({
            "medico": m["nome"],
            "especialidade": m["especialidade"],
            "bairro": m["bairro"],
            "prioridade": m["prioridade"],
            "freq_alvo": m["freq"],
            "freq_planejada": planejada,
            "status": "OK" if planejada == m["freq"] else "FALTOU {}".format(m["freq"] - planejada),
        })
    return cob


def montar_sugestoes(vagas, medicos, agenda, p):
    """Para cada slot vago, sugere medicos que poderiam aumentar frequencia ali."""
    sug = []
    for v in vagas:
        d, periodo = v["data"], v["periodo"]
        ja = {a["med"]["nome"] for a in agenda[d]["M"] + agenda[d]["T"]}
        cands = []
        for m in medicos:
            if m["nome"] in ja:
                continue
            if periodo not in m["turnos"]:
                continue
            if d.weekday() not in m["dias"]:
                continue
            if m["datas"] and min(abs((d - x).days) for x in m["datas"]) < m["min_dias"]:
                continue
            cands.append(m)
        cands.sort(key=lambda m: (m["prioridade"], -m["freq"], -m["dias_ultima"]))
        sug.append({
            "data": d.strftime("%d/%m/%Y"),
            "dia": DIAS_PT[d.weekday()],
            "horario": v["horario"],
            "periodo": "Manha" if periodo == "M" else "Tarde",
            "sugestoes": ", ".join("{} ({}, {})".format(m["nome"], m["especialidade"], m["bairro"])
                                   for m in cands[:3]) or "(nenhum medico elegivel)",
        })
    return sug


def montar_resumo(medicos, dias, vagas, p):
    cap_total = len(dias) * (len(p.slots_manha) + len(p.slots_tarde))
    demandadas = sum(m["freq"] for m in medicos)
    planejadas = sum(m["freq"] - m["restantes"] for m in medicos)
    faltantes = [(m["nome"], m["restantes"]) for m in medicos if m["restantes"] > 0]
    return {
        "dias_uteis": len(dias),
        "capacidade_total": cap_total,
        "visitas_demandadas": demandadas,
        "visitas_planejadas": planejadas,
        "slots_vagos": len(vagas),
        "medicos_incompletos": faltantes,
    }


# ---------------------------------------------------------------------------
# Validacao (hard constraints)
# ---------------------------------------------------------------------------

def validar(medicos, agenda, dias, p):
    erros = []
    # capacidade por turno
    for d in dias:
        if len(agenda[d]["M"]) > len(p.slots_manha):
            erros.append("Capacidade manha excedida em {}".format(d))
        if len(agenda[d]["T"]) > len(p.slots_tarde):
            erros.append("Capacidade tarde excedida em {}".format(d))
    # espacamento minimo
    for m in medicos:
        ds = sorted(m["datas"])
        for a, b in zip(ds, ds[1:]):
            if (b - a).days < m["min_dias"]:
                erros.append("Intervalo minimo violado: {} ({} -> {}, min {})".format(
                    m["nome"], a, b, m["min_dias"]))
        if len(ds) > m["freq"]:
            erros.append("Excesso de visitas: {} ({} > {})".format(m["nome"], len(ds), m["freq"]))
    return erros


# ---------------------------------------------------------------------------
# Escrita (xlsx ou csv)
# ---------------------------------------------------------------------------

def _escrever_csv(caminho, cabecalho, linhas):
    with open(caminho, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(cabecalho)
        for l in linhas:
            w.writerow([l.get(c, "") for c in cabecalho])


def escrever_saidas(prefixo, agenda_rows, resumo, cobertura, sugestoes):
    abas = {
        "Agenda Diaria": (["data", "dia", "horario", "periodo", "cat", "frequencia",
                           "medico", "especialidade", "bairro", "observacoes"], agenda_rows),
        "Cobertura por Medico": (["medico", "especialidade", "bairro", "prioridade",
                                  "freq_alvo", "freq_planejada", "status"], cobertura),
        "Sugestoes (+Freq)": (["data", "dia", "horario", "periodo", "sugestoes"], sugestoes),
    }
    resumo_rows = [
        {"indicador": "Dias uteis", "valor": resumo["dias_uteis"]},
        {"indicador": "Capacidade total (slots)", "valor": resumo["capacidade_total"]},
        {"indicador": "Visitas demandadas", "valor": resumo["visitas_demandadas"]},
        {"indicador": "Visitas planejadas", "valor": resumo["visitas_planejadas"]},
        {"indicador": "Slots vagos", "valor": resumo["slots_vagos"]},
        {"indicador": "Medicos incompletos",
         "valor": "; ".join("{} (faltam {})".format(n, r) for n, r in resumo["medicos_incompletos"]) or "nenhum"},
    ]
    try:
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = "Resumo"
        ws.append(["indicador", "valor"])
        for r in resumo_rows:
            ws.append([r["indicador"], r["valor"]])
        for titulo, (cab, dados) in abas.items():
            ws = wb.create_sheet(titulo[:31])
            ws.append(cab)
            for l in dados:
                ws.append([l.get(c, "") for c in cab])
        caminho = prefixo + ".xlsx"
        wb.save(caminho)
        return caminho
    except ImportError:
        _escrever_csv(prefixo + "_resumo.csv", ["indicador", "valor"], resumo_rows)
        for titulo, (cab, dados) in abas.items():
            nome = titulo.lower().replace(" ", "_").replace("(", "").replace(")", "").replace("+", "")
            _escrever_csv("{}_{}.csv".format(prefixo, nome), cab, dados)
        return prefixo + "_*.csv (openpyxl ausente; gerados CSVs separados)"


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main(argv=None):
    a = argparse.ArgumentParser(description="Agenda de visitacao por frequencia.")
    a.add_argument("--arquivo", required=True, help="painel (.csv ou .xlsx)")
    a.add_argument("--inicio-ciclo", required=True, help="AAAA-MM-DD")
    a.add_argument("--fim-ciclo", required=True, help="AAAA-MM-DD")
    a.add_argument("--bloqueios", default="", help="datas bloqueadas: 21/04,01/05,...")
    a.add_argument("--slots-manha", default=",".join(SLOTS_MANHA_PADRAO))
    a.add_argument("--slots-tarde", default=",".join(SLOTS_TARDE_PADRAO))
    a.add_argument("--espacamento", type=int, default=7, help="intervalo minimo padrao (dias)")
    a.add_argument("--espacamento-alto", type=int, default=4, help="intervalo minimo p/ freq alta")
    a.add_argument("--freq-alto", type=int, default=6, help="limiar de frequencia alta")
    a.add_argument("--geocodificar", action="store_true", help="geocodifica enderecos p/ refinar proximidade")
    a.add_argument("--saida", default="Roteirizador/agenda_visitacao", help="prefixo do arquivo de saida")
    args = a.parse_args(argv)

    inicio = parse_data(args.inicio_ciclo)
    fim = parse_data(args.fim_ciclo)
    p = P()
    p.slots_manha = [s.strip() for s in args.slots_manha.split(",") if s.strip()]
    p.slots_tarde = [s.strip() for s in args.slots_tarde.split(",") if s.strip()]
    p.espacamento = args.espacamento
    p.espacamento_alto = args.espacamento_alto
    p.freq_alto = args.freq_alto

    bloqueios = parse_bloqueios(args.bloqueios, inicio.year)
    dias = dias_uteis(inicio, fim, bloqueios)
    if not dias:
        sys.exit("ERRO: nenhum dia util no periodo informado.")

    medicos = ler_painel(args.arquivo, inicio, args.geocodificar)
    if not medicos:
        sys.exit("ERRO: nenhum medico com frequencia > 0 no painel.")

    agenda = planejar(medicos, dias, p)
    agenda_rows, vagas = montar_agenda(agenda, dias, p)
    resumo = montar_resumo(medicos, dias, vagas, p)
    cobertura = montar_cobertura(medicos)
    sugestoes = montar_sugestoes(vagas, medicos, agenda, p)
    erros = validar(medicos, agenda, dias, p)

    # relatorio no terminal
    print("\n" + "=" * 66)
    print("  AGENDA DE VISITACAO — {} a {}".format(inicio.strftime("%d/%m/%Y"),
                                                   fim.strftime("%d/%m/%Y")))
    print("=" * 66)
    print("  Dias uteis: {} | Capacidade: {} slots ({}+{}/dia)".format(
        resumo["dias_uteis"], resumo["capacidade_total"],
        len(p.slots_manha), len(p.slots_tarde)))
    print("  Visitas demandadas: {} | planejadas: {} | slots vagos: {}".format(
        resumo["visitas_demandadas"], resumo["visitas_planejadas"], resumo["slots_vagos"]))
    if resumo["medicos_incompletos"]:
        print("\n  ATENCAO — medicos abaixo da frequencia alvo:")
        for n, r in resumo["medicos_incompletos"]:
            print("    - {} (faltam {} visita(s))".format(n, r))
    else:
        print("  Frequencia planejada = frequencia do painel para TODOS os medicos. OK")
    if erros:
        print("\n  ERROS DE VALIDACAO (NAO deveriam ocorrer):")
        for e in erros:
            print("    ! " + e)

    caminho = escrever_saidas(args.saida, agenda_rows, resumo, cobertura, sugestoes)
    print("\n  Saida: {}".format(caminho))
    print("=" * 66 + "\n")


if __name__ == "__main__":
    main()

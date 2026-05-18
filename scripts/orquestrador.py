#!/usr/bin/env python3
"""Master state aggregator — gathers everything needed for the orchestrator to decide what to do."""
import os
import json
import sys
from datetime import datetime, timedelta

try:
    from notion_client import Client
    from notion_client.errors import APIResponseError
    NOTION_OK = True
except ImportError:
    NOTION_OK = False

TOKEN = os.environ.get("NOTION_TOKEN")
CONTEUDOS_DB = os.environ.get("NOTION_CONTEUDOS_DB")
IDEIAS_DB = os.environ.get("NOTION_IDEIAS_DB")
RELATORIOS_DB = os.environ.get("NOTION_RELATORIOS_DB")

DIAS_PT = {0: "Segunda-feira", 1: "Terça-feira", 2: "Quarta-feira",
           3: "Quinta-feira", 4: "Sexta-feira", 5: "Sábado", 6: "Domingo"}


def get_client():
    if not NOTION_OK:
        return None, "notion-client não instalado"
    if not TOKEN:
        return None, "NOTION_TOKEN não configurado"
    return Client(auth=TOKEN), None


def _title(prop):
    t = prop.get("title", [])
    return t[0]["text"]["content"] if t else ""

def _select(prop):
    s = prop.get("select") or {}
    return s.get("name", "")

def _multi_select(prop):
    return [i["name"] for i in prop.get("multi_select", [])]

def _date(prop):
    d = prop.get("date") or {}
    return d.get("start", "")

def _number(prop):
    return prop.get("number")

def _rich_text(prop):
    t = prop.get("rich_text", [])
    return t[0]["text"]["content"] if t else ""


def get_pipeline(client):
    if not CONTEUDOS_DB:
        return {}, "NOTION_CONTEUDOS_DB não configurado"
    try:
        results = client.databases.query(
            database_id=CONTEUDOS_DB,
            filter={"property": "Status", "select": {"does_not_equal": "Arquivado"}},
            sorts=[{"property": "Data Prevista", "direction": "ascending"}]
        )
        hoje = datetime.now().date()
        pipe = {}
        atrasados = []
        for page in results["results"]:
            props = page["properties"]
            status = _select(props.get("Status", {})) or "Sem Status"
            data_prev = _date(props.get("Data Prevista", {}))
            titulo = _title(props.get("Nome", {}))
            item = {
                "id": page["id"],
                "titulo": titulo,
                "nicho": _select(props.get("Nicho", {})),
                "plataforma": _multi_select(props.get("Plataforma", {})),
                "data_prevista": data_prev,
                "gancho": _rich_text(props.get("Gancho", {})),
                "atrasado": False,
            }
            if data_prev and status != "Publicado":
                try:
                    data_obj = datetime.strptime(data_prev, "%Y-%m-%d").date()
                    if data_obj < hoje:
                        item["atrasado"] = True
                        atrasados.append({"titulo": titulo, "status": status, "data_prevista": data_prev})
                except ValueError:
                    pass
            pipe.setdefault(status, []).append(item)
        return {"pipeline": pipe, "atrasados": atrasados}, None
    except APIResponseError as e:
        return {}, str(e)


def get_ideias(client):
    if not IDEIAS_DB:
        return [], "NOTION_IDEIAS_DB não configurado"
    try:
        results = client.databases.query(
            database_id=IDEIAS_DB,
            filter={"or": [
                {"property": "Status", "select": {"equals": "Aprovada"}},
                {"property": "Status", "select": {"equals": "Nova"}},
            ]},
            sorts=[{"property": "Potencial Viral", "direction": "descending"}]
        )
        ideias = []
        for page in results["results"]:
            props = page["properties"]
            ideias.append({
                "titulo": _title(props.get("Título", {})),
                "mercado": _select(props.get("Mercado", {})),
                "potencial": _number(props.get("Potencial Viral", {})),
                "status": _select(props.get("Status", {})),
                "gancho": _rich_text(props.get("Gancho Sugerido", {})),
            })
        return ideias, None
    except APIResponseError as e:
        return [], str(e)


def get_publicados(client, dias=7):
    if not CONTEUDOS_DB:
        return [], "NOTION_CONTEUDOS_DB não configurado"
    data_limite = (datetime.now() - timedelta(days=dias)).strftime("%Y-%m-%d")
    try:
        results = client.databases.query(
            database_id=CONTEUDOS_DB,
            filter={"and": [
                {"property": "Status", "select": {"equals": "Publicado"}},
                {"property": "Data Publicação", "date": {"on_or_after": data_limite}}
            ]},
            sorts=[{"property": "Data Publicação", "direction": "descending"}]
        )
        videos = []
        for page in results["results"]:
            props = page["properties"]
            views = _number(props.get("Views", {})) or 0
            likes = _number(props.get("Likes", {})) or 0
            saves = _number(props.get("Saves", {})) or 0
            comentarios = _number(props.get("Comentários", {})) or 0
            shares = _number(props.get("Shares", {})) or 0
            sem_metricas = views == 0 and likes == 0
            videos.append({
                "titulo": _title(props.get("Nome", {})),
                "nicho": _select(props.get("Nicho", {})),
                "plataforma": _multi_select(props.get("Plataforma", {})),
                "data_publicacao": _date(props.get("Data Publicação", {})),
                "views": views, "likes": likes, "saves": saves,
                "comentarios": comentarios, "shares": shares,
                "taxa_engajamento": _number(props.get("Taxa Engajamento", {})),
                "url": props.get("URL", {}).get("url", ""),
                "sem_metricas": sem_metricas,
            })
        return videos, None
    except APIResponseError as e:
        return [], str(e)


def compute_urgencias(pipeline_data, publicados):
    urgencias = []

    # Conteúdos editados há mais de 2 dias sem publicar
    editados = pipeline_data.get("pipeline", {}).get("Editado", [])
    hoje = datetime.now().date()
    for item in editados:
        dp = item.get("data_prevista")
        if dp:
            try:
                d = datetime.strptime(dp, "%Y-%m-%d").date()
                if d <= hoje:
                    urgencias.append({
                        "tipo": "PRONTO_PARA_PUBLICAR",
                        "titulo": item["titulo"],
                        "descricao": f"Está Editado e a data prevista ({dp}) chegou — publicar hoje!"
                    })
            except ValueError:
                pass

    # Conteúdos atrasados
    for a in pipeline_data.get("atrasados", []):
        if a["status"] != "Editado":  # editados já tratados acima
            urgencias.append({
                "tipo": "ATRASADO",
                "titulo": a["titulo"],
                "descricao": f"Status '{a['status']}' — previsto para {a['data_prevista']}"
            })

    # Vídeos publicados sem métricas há mais de 2 dias
    for v in publicados:
        if v["sem_metricas"] and v["data_publicacao"]:
            try:
                dp = datetime.strptime(v["data_publicacao"], "%Y-%m-%d").date()
                if (hoje - dp).days >= 2:
                    urgencias.append({
                        "tipo": "SEM_METRICAS",
                        "titulo": v["titulo"],
                        "descricao": f"Publicado em {v['data_publicacao']} sem métricas registradas"
                    })
            except ValueError:
                pass

    return urgencias


def compute_agenda_dia(dia_semana, pipeline_data, ideias, publicados, urgencias):
    """Return what should be done today based on day of week and state."""
    pipe = pipeline_data.get("pipeline", {})
    agenda = []

    # Urgências sempre primeiro
    if urgencias:
        agenda.append({
            "prioridade": 0,
            "tipo": "URGENTE",
            "acoes": urgencias
        })

    if dia_semana == 0:  # Segunda
        agenda.append({"prioridade": 1, "tipo": "BRIEFING_SEMANAL",
                        "descricao": "Início de semana: avaliar performance, planejar gravações"})
        agenda.append({"prioridade": 2, "tipo": "PESQUISA_TRENDS",
                        "descricao": "Rodar /trends para capturar oportunidades da semana"})
        roteiros_prontos = pipe.get("Roteiro Pronto", [])
        if roteiros_prontos:
            agenda.append({"prioridade": 3, "tipo": "PLANEJAR_GRAVACOES",
                            "conteudos": roteiros_prontos[:3],
                            "descricao": "Definir quais gravar esta semana"})

    elif dia_semana == 1:  # Terça
        ideias_aprovadas = [i for i in ideias if i["status"] == "Aprovada"]
        if ideias_aprovadas:
            agenda.append({"prioridade": 1, "tipo": "GERAR_ROTEIROS",
                            "ideias": ideias_aprovadas[:2],
                            "descricao": "Gerar roteiros para as top ideias aprovadas"})
        ideias_novas = [i for i in ideias if i["status"] == "Nova"]
        if ideias_novas:
            agenda.append({"prioridade": 2, "tipo": "AVALIAR_IDEIAS",
                            "quantidade": len(ideias_novas),
                            "descricao": f"{len(ideias_novas)} ideias novas aguardam avaliação"})

    elif dia_semana == 2:  # Quarta
        gravados = pipe.get("Gravado", [])
        agenda.append({"prioridade": 1, "tipo": "DIA_GRAVACAO",
                        "descricao": "Dia de gravação — checar roteiros prontos e gravar"})
        if gravados:
            agenda.append({"prioridade": 2, "tipo": "INICIAR_EDICAO",
                            "conteudos": gravados,
                            "descricao": f"{len(gravados)} vídeo(s) gravados aguardam edição"})

    elif dia_semana == 3:  # Quinta
        gravados = pipe.get("Gravado", [])
        editados = pipe.get("Editado", [])
        if gravados:
            agenda.append({"prioridade": 1, "tipo": "AVANCAR_STATUS",
                            "conteudos": gravados, "novo_status": "Editado",
                            "descricao": "Atualizar vídeos gravados para Editado"})
        if editados:
            agenda.append({"prioridade": 2, "tipo": "REVISAR_EDITADOS",
                            "conteudos": editados,
                            "descricao": "Revisar conteúdos editados prontos para publicar"})

    elif dia_semana == 4:  # Sexta
        editados = pipe.get("Editado", [])
        if editados:
            agenda.append({"prioridade": 1, "tipo": "PUBLICAR",
                            "conteudos": editados,
                            "descricao": "Publicar conteúdos editados e registrar URLs"})
        sem_metricas = [v for v in publicados if v["sem_metricas"]]
        if sem_metricas:
            agenda.append({"prioridade": 2, "tipo": "COLETAR_METRICAS",
                            "conteudos": sem_metricas,
                            "descricao": "Coletar e registrar métricas dos vídeos publicados"})

    elif dia_semana == 5:  # Sábado
        sem_metricas = [v for v in publicados if v["sem_metricas"]]
        agenda.append({"prioridade": 1, "tipo": "ANALISE_SEMANA",
                        "descricao": "Analisar performance dos vídeos da semana"})
        if sem_metricas:
            agenda.append({"prioridade": 2, "tipo": "COLETAR_METRICAS",
                            "conteudos": sem_metricas,
                            "descricao": "Registrar métricas que ainda faltam"})

    elif dia_semana == 6:  # Domingo
        agenda.append({"prioridade": 1, "tipo": "RELATORIO_SEMANAL",
                        "descricao": "Gerar relatório semanal completo e salvar no Notion"})
        agenda.append({"prioridade": 2, "tipo": "PLANEJAR_SEMANA",
                        "descricao": "Planejar conteúdos e calendário da próxima semana"})

    return sorted(agenda, key=lambda x: x["prioridade"])


def main():
    hoje = datetime.now()
    dia_semana = hoje.weekday()
    client, err = get_client()

    state = {
        "data": hoje.strftime("%Y-%m-%d"),
        "hora": hoje.strftime("%H:%M"),
        "dia_semana": DIAS_PT[dia_semana],
        "dia_numero": dia_semana,
        "notion_ok": client is not None,
        "notion_erro": err,
    }

    if client:
        pipeline_data, pipe_err = get_pipeline(client)
        ideias, ideias_err = get_ideias(client)
        publicados, pub_err = get_publicados(client, dias=7)

        state["pipeline"] = pipeline_data.get("pipeline", {})
        state["atrasados"] = pipeline_data.get("atrasados", [])
        state["ideias"] = ideias
        state["publicados_semana"] = publicados
        state["urgencias"] = compute_urgencias(pipeline_data, publicados)
        state["agenda_hoje"] = compute_agenda_dia(dia_semana, pipeline_data, ideias, publicados, state["urgencias"])

        # Resumo do pipeline
        state["resumo_pipeline"] = {
            status: len(items)
            for status, items in state["pipeline"].items()
        }

        # Performance snapshot
        if publicados:
            views_list = [v["views"] for v in publicados if v["views"]]
            eng_list = [v["taxa_engajamento"] for v in publicados if v["taxa_engajamento"]]
            state["performance_semana"] = {
                "total_videos": len(publicados),
                "total_views": sum(views_list),
                "media_views": int(sum(views_list) / len(views_list)) if views_list else 0,
                "media_engajamento": round(sum(eng_list) / len(eng_list), 2) if eng_list else 0,
                "melhor_video": max(publicados, key=lambda v: v["views"])["titulo"] if views_list else None,
            }
        else:
            state["performance_semana"] = {"total_videos": 0}

        if pipe_err:
            state["avisos"] = state.get("avisos", []) + [f"Pipeline: {pipe_err}"]
        if ideias_err:
            state["avisos"] = state.get("avisos", []) + [f"Ideias: {ideias_err}"]
        if pub_err:
            state["avisos"] = state.get("avisos", []) + [f"Publicados: {pub_err}"]
    else:
        state["pipeline"] = {}
        state["urgencias"] = []
        state["agenda_hoje"] = []
        state["performance_semana"] = {"total_videos": 0}

    print(json.dumps(state, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

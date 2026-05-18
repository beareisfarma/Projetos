#!/usr/bin/env python3
"""Notion API client for content management."""
import os
import json
import sys
import argparse
from datetime import datetime, timedelta

try:
    from notion_client import Client
    from notion_client.errors import APIResponseError
except ImportError:
    print(json.dumps({"error": "notion-client not installed. Run: pip install notion-client"}))
    sys.exit(1)

TOKEN = os.environ.get("NOTION_TOKEN")
CONTEUDOS_DB = os.environ.get("NOTION_CONTEUDOS_DB")
IDEIAS_DB = os.environ.get("NOTION_IDEIAS_DB")
RELATORIOS_DB = os.environ.get("NOTION_RELATORIOS_DB")


def get_client():
    if not TOKEN:
        print(json.dumps({"error": "NOTION_TOKEN not set"}))
        sys.exit(1)
    return Client(auth=TOKEN)


def pipeline(client):
    if not CONTEUDOS_DB:
        return {"error": "NOTION_CONTEUDOS_DB not set"}
    try:
        results = client.databases.query(
            database_id=CONTEUDOS_DB,
            sorts=[{"property": "Data Prevista", "direction": "ascending"}]
        )
        pipe = {}
        for page in results["results"]:
            props = page["properties"]
            status = props.get("Status", {}).get("select") or {}
            status_name = status.get("name", "Sem Status")
            item = {
                "id": page["id"],
                "titulo": _get_title(props.get("Nome", {})),
                "nicho": _get_select(props.get("Nicho", {})),
                "plataforma": _get_multi_select(props.get("Plataforma", {})),
                "data_prevista": _get_date(props.get("Data Prevista", {})),
                "gancho": _get_rich_text(props.get("Gancho", {})),
            }
            pipe.setdefault(status_name, []).append(item)
        return {"pipeline": pipe}
    except APIResponseError as e:
        return {"error": str(e)}


def ideias(client, status=None, mercado=None):
    if not IDEIAS_DB:
        return {"error": "NOTION_IDEIAS_DB not set"}
    filters = []
    if status:
        filters.append({"property": "Status", "select": {"equals": status}})
    if mercado:
        filters.append({"property": "Mercado", "select": {"equals": mercado}})
    query_params = {
        "database_id": IDEIAS_DB,
        "sorts": [{"property": "Potencial Viral", "direction": "descending"}]
    }
    if len(filters) == 1:
        query_params["filter"] = filters[0]
    elif len(filters) > 1:
        query_params["filter"] = {"and": filters}
    try:
        results = client.databases.query(**query_params)
        lista = []
        for page in results["results"]:
            props = page["properties"]
            lista.append({
                "id": page["id"],
                "titulo": _get_title(props.get("Título", {})),
                "mercado": _get_select(props.get("Mercado", {})),
                "potencial": _get_number(props.get("Potencial Viral", {})),
                "fonte": _get_select(props.get("Fonte", {})),
                "status": _get_select(props.get("Status", {})),
                "gancho": _get_rich_text(props.get("Gancho Sugerido", {})),
                "porque_funciona": _get_rich_text(props.get("Por que funciona", {})),
            })
        return {"ideias": lista}
    except APIResponseError as e:
        return {"error": str(e)}


def add_conteudo(client, data):
    if not CONTEUDOS_DB:
        return {"error": "NOTION_CONTEUDOS_DB not set"}
    properties = {
        "Nome": {"title": [{"text": {"content": data["titulo"]}}]},
        "Nicho": {"select": {"name": data.get("nicho", "")}},
        "Plataforma": {"multi_select": [{"name": p} for p in data.get("plataforma", [])]},
        "Status": {"select": {"name": data.get("status", "Ideia")}},
        "Gancho": {"rich_text": [{"text": {"content": data.get("gancho", "")}}]},
    }
    if data.get("data_prevista"):
        properties["Data Prevista"] = {"date": {"start": data["data_prevista"]}}
    try:
        page = client.pages.create(parent={"database_id": CONTEUDOS_DB}, properties=properties)
        return {"success": True, "id": page["id"], "titulo": data["titulo"]}
    except APIResponseError as e:
        return {"error": str(e)}


def add_ideia(client, data):
    if not IDEIAS_DB:
        return {"error": "NOTION_IDEIAS_DB not set"}
    properties = {
        "Título": {"title": [{"text": {"content": data["titulo"]}}]},
        "Mercado": {"select": {"name": data.get("mercado", "")}},
        "Potencial Viral": {"number": data.get("potencial", 3)},
        "Fonte": {"select": {"name": data.get("fonte", "Pessoal")}},
        "Status": {"select": {"name": "Nova"}},
        "Gancho Sugerido": {"rich_text": [{"text": {"content": data.get("gancho", "")}}]},
        "Por que funciona": {"rich_text": [{"text": {"content": data.get("porque_funciona", "")}}]},
    }
    try:
        page = client.pages.create(parent={"database_id": IDEIAS_DB}, properties=properties)
        return {"success": True, "id": page["id"], "titulo": data["titulo"]}
    except APIResponseError as e:
        return {"error": str(e)}


def update_status(client, data):
    if not CONTEUDOS_DB:
        return {"error": "NOTION_CONTEUDOS_DB not set"}
    try:
        results = client.databases.query(
            database_id=CONTEUDOS_DB,
            filter={"property": "Nome", "title": {"equals": data["titulo"]}}
        )
        if not results["results"]:
            return {"error": f"Conteúdo '{data['titulo']}' não encontrado"}
        page_id = results["results"][0]["id"]
        properties = {"Status": {"select": {"name": data["status"]}}}
        if data.get("data_publicacao"):
            properties["Data Publicação"] = {"date": {"start": data["data_publicacao"]}}
        if data.get("url"):
            properties["URL"] = {"url": data["url"]}
        client.pages.update(page_id=page_id, properties=properties)
        return {"success": True, "titulo": data["titulo"], "novo_status": data["status"]}
    except APIResponseError as e:
        return {"error": str(e)}


def update_metrics(client, data):
    if not CONTEUDOS_DB:
        return {"error": "NOTION_CONTEUDOS_DB not set"}
    try:
        results = client.databases.query(
            database_id=CONTEUDOS_DB,
            filter={"property": "Nome", "title": {"equals": data["titulo"]}}
        )
        if not results["results"]:
            return {"error": f"Conteúdo '{data['titulo']}' não encontrado"}
        page_id = results["results"][0]["id"]
        properties = {}
        for key, prop_name in [("views", "Views"), ("likes", "Likes"), ("saves", "Saves"),
                                ("comentarios", "Comentários"), ("shares", "Shares")]:
            if key in data:
                properties[prop_name] = {"number": data[key]}
        views = data.get("views", 0)
        if views > 0:
            total_eng = sum(data.get(k, 0) for k in ["likes", "saves", "comentarios", "shares"])
            properties["Taxa Engajamento"] = {"number": round((total_eng / views) * 100, 2)}
        client.pages.update(page_id=page_id, properties=properties)
        return {"success": True, "titulo": data["titulo"], "metricas": list(properties.keys())}
    except APIResponseError as e:
        return {"error": str(e)}


def publicados(client, dias=7):
    if not CONTEUDOS_DB:
        return {"error": "NOTION_CONTEUDOS_DB not set"}
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
            views = _get_number(props.get("Views", {})) or 0
            likes = _get_number(props.get("Likes", {})) or 0
            saves = _get_number(props.get("Saves", {})) or 0
            comentarios = _get_number(props.get("Comentários", {})) or 0
            shares = _get_number(props.get("Shares", {})) or 0
            videos.append({
                "titulo": _get_title(props.get("Nome", {})),
                "nicho": _get_select(props.get("Nicho", {})),
                "plataforma": _get_multi_select(props.get("Plataforma", {})),
                "data_publicacao": _get_date(props.get("Data Publicação", {})),
                "views": views, "likes": likes, "saves": saves,
                "comentarios": comentarios, "shares": shares,
                "taxa_engajamento": _get_number(props.get("Taxa Engajamento", {})),
                "url": props.get("URL", {}).get("url", ""),
            })
        return {"publicados": videos, "total": len(videos), "periodo_dias": dias}
    except APIResponseError as e:
        return {"error": str(e)}


def add_relatorio(client, data):
    if not RELATORIOS_DB:
        return {"error": "NOTION_RELATORIOS_DB not set"}
    properties = {
        "Título": {"title": [{"text": {"content": data["titulo"]}}]},
        "Total Publicados": {"number": data.get("total_publicados", 0)},
        "Total Views": {"number": data.get("total_views", 0)},
        "Melhor Vídeo": {"rich_text": [{"text": {"content": data.get("melhor_video", "")}}]},
        "Insights": {"rich_text": [{"text": {"content": data.get("insights", "")}}]},
        "Próximos Passos": {"rich_text": [{"text": {"content": data.get("proximos_passos", "")}}]},
    }
    if data.get("periodo_inicio") and data.get("periodo_fim"):
        properties["Período"] = {"date": {"start": data["periodo_inicio"], "end": data["periodo_fim"]}}
    try:
        page = client.pages.create(parent={"database_id": RELATORIOS_DB}, properties=properties)
        return {"success": True, "id": page["id"]}
    except APIResponseError as e:
        return {"error": str(e)}


def _get_title(prop):
    t = prop.get("title", [])
    return t[0]["text"]["content"] if t else ""

def _get_select(prop):
    s = prop.get("select") or {}
    return s.get("name", "")

def _get_multi_select(prop):
    return [item["name"] for item in prop.get("multi_select", [])]

def _get_rich_text(prop):
    t = prop.get("rich_text", [])
    return t[0]["text"]["content"] if t else ""

def _get_date(prop):
    d = prop.get("date") or {}
    return d.get("start", "")

def _get_number(prop):
    return prop.get("number")


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command")
    sub.add_parser("pipeline")
    p_ideias = sub.add_parser("ideias")
    p_ideias.add_argument("--status")
    p_ideias.add_argument("--mercado")
    sub.add_parser("add-conteudo")
    sub.add_parser("add-ideia")
    p_us = sub.add_parser("update-status")
    p_us.add_argument("data")
    p_um = sub.add_parser("update-metrics")
    p_um.add_argument("data")
    p_pub = sub.add_parser("publicados")
    p_pub.add_argument("--dias", type=int, default=7)
    sub.add_parser("add-relatorio")
    args = parser.parse_args()
    client = get_client()

    if args.command == "pipeline":
        result = pipeline(client)
    elif args.command == "ideias":
        result = ideias(client, getattr(args, "status", None), getattr(args, "mercado", None))
    elif args.command == "add-conteudo":
        result = add_conteudo(client, json.load(sys.stdin))
    elif args.command == "add-ideia":
        result = add_ideia(client, json.load(sys.stdin))
    elif args.command == "update-status":
        result = update_status(client, json.loads(args.data))
    elif args.command == "update-metrics":
        result = update_metrics(client, json.loads(args.data))
    elif args.command == "publicados":
        result = publicados(client, args.dias)
    elif args.command == "add-relatorio":
        result = add_relatorio(client, json.load(sys.stdin))
    else:
        result = {"error": "Comando não reconhecido"}

    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

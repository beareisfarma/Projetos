#!/usr/bin/env python3
"""Validate API connections and environment configuration."""
import os
import json


REQUIRED_VARS = {
    "NOTION_TOKEN":          "Token de integração do Notion",
    "NOTION_CONTEUDOS_DB":   "ID do banco de dados Conteúdos no Notion",
    "NOTION_IDEIAS_DB":      "ID do banco de dados Banco de Ideias no Notion",
    "NOTION_RELATORIOS_DB":  "ID do banco de dados Relatórios no Notion",
    "YOUTUBE_API_KEY":       "Chave da YouTube Data API v3",
    "YOUTUBE_CHANNEL_ID":    "ID do canal no YouTube",
    "INSTAGRAM_ACCESS_TOKEN": "Token de acesso da Instagram Graph API",
    "INSTAGRAM_USER_ID":     "ID do usuário no Instagram",
}

PACKAGES = {
    "notion_client":      "notion-client",
    "googleapiclient":    "google-api-python-client",
    "requests":           "requests",
}


def check_packages():
    result = {}
    for module, package in PACKAGES.items():
        try:
            __import__(module)
            result[package] = {"ok": True}
        except ImportError:
            result[package] = {"ok": False, "fix": f"pip install {package}"}
    return result


def check_env():
    result = {}
    for var, desc in REQUIRED_VARS.items():
        val = os.environ.get(var)
        result[var] = {
            "ok": bool(val),
            "descricao": desc,
            "preview": f"{val[:10]}..." if val and len(val) > 10 else ("configurado" if val else "NÃO CONFIGURADO"),
        }
    return result


def check_notion():
    token = os.environ.get("NOTION_TOKEN")
    if not token:
        return {"ok": False, "erro": "NOTION_TOKEN não configurado"}
    try:
        from notion_client import Client
        client = Client(auth=token)
        client.users.me()
        return {"ok": True, "mensagem": "Notion conectado com sucesso"}
    except ImportError:
        return {"ok": False, "erro": "notion-client não instalado"}
    except Exception as e:
        return {"ok": False, "erro": str(e)}


def check_youtube():
    api_key = os.environ.get("YOUTUBE_API_KEY")
    if not api_key:
        return {"ok": False, "erro": "YOUTUBE_API_KEY não configurado"}
    try:
        from googleapiclient.discovery import build
        service = build("youtube", "v3", developerKey=api_key)
        service.videos().list(part="snippet", id="dQw4w9WgXcQ").execute()
        return {"ok": True, "mensagem": "YouTube API conectada com sucesso"}
    except ImportError:
        return {"ok": False, "erro": "google-api-python-client não instalado"}
    except Exception as e:
        return {"ok": False, "erro": str(e)}


def check_instagram():
    token = os.environ.get("INSTAGRAM_ACCESS_TOKEN")
    user_id = os.environ.get("INSTAGRAM_USER_ID")
    if not token or not user_id:
        missing = [v for v in ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_USER_ID"] if not os.environ.get(v)]
        return {"ok": False, "erro": f"Não configurado: {', '.join(missing)}"}
    try:
        import requests
        resp = requests.get(
            f"https://graph.instagram.com/v18.0/{user_id}",
            params={"fields": "username", "access_token": token},
            timeout=10
        )
        if resp.status_code == 200:
            username = resp.json().get("username", "")
            return {"ok": True, "mensagem": f"Instagram conectado (@{username})"}
        return {"ok": False, "erro": resp.json().get("error", {}).get("message", "Erro na API")}
    except ImportError:
        return {"ok": False, "erro": "requests não instalado"}
    except Exception as e:
        return {"ok": False, "erro": str(e)}


if __name__ == "__main__":
    print(json.dumps({
        "pacotes": check_packages(),
        "variaveis": check_env(),
        "conexoes": {
            "notion":    check_notion(),
            "youtube":   check_youtube(),
            "instagram": check_instagram(),
        }
    }, ensure_ascii=False, indent=2))

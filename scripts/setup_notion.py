#!/usr/bin/env python3
"""Create all 3 Notion databases under the Creator Agent page."""
import os
import json
from notion_client import Client

TOKEN = os.environ["NOTION_TOKEN"]
PAGE_ID = os.environ["NOTION_PAGE_ID"]

client = Client(auth=TOKEN)


def create_conteudos():
    db = client.databases.create(
        parent={"type": "page_id", "page_id": PAGE_ID},
        title=[{"type": "text", "text": {"content": "Conteúdos"}}],
        properties={
            "Nome": {"title": {}},
            "Status": {"select": {"options": [
                {"name": "Ideia", "color": "gray"},
                {"name": "Roteiro Pronto", "color": "blue"},
                {"name": "Gravado", "color": "yellow"},
                {"name": "Editado", "color": "orange"},
                {"name": "Publicado", "color": "green"},
                {"name": "Arquivado", "color": "red"},
            ]}},
            "Nicho": {"select": {"options": [
                {"name": "IA", "color": "purple"},
                {"name": "Farmácia", "color": "pink"},
                {"name": "Pets", "color": "green"},
            ]}},
            "Plataforma": {"multi_select": {"options": [
                {"name": "TikTok", "color": "gray"},
                {"name": "Reels", "color": "pink"},
                {"name": "YouTube", "color": "red"},
                {"name": "Shorts", "color": "orange"},
            ]}},
            "Data Prevista": {"date": {}},
            "Data Publicação": {"date": {}},
            "Gancho": {"rich_text": {}},
            "URL": {"url": {}},
            "Views": {"number": {"format": "number"}},
            "Likes": {"number": {"format": "number"}},
            "Saves": {"number": {"format": "number"}},
            "Comentários": {"number": {"format": "number"}},
            "Shares": {"number": {"format": "number"}},
            "Taxa Engajamento": {"number": {"format": "percent"}},
        }
    )
    return db["id"].replace("-", "")


def create_ideias():
    db = client.databases.create(
        parent={"type": "page_id", "page_id": PAGE_ID},
        title=[{"type": "text", "text": {"content": "Banco de Ideias"}}],
        properties={
            "Título": {"title": {}},
            "Mercado": {"select": {"options": [
                {"name": "IA", "color": "purple"},
                {"name": "Farmácia", "color": "pink"},
                {"name": "Pets", "color": "green"},
            ]}},
            "Potencial Viral": {"number": {"format": "number"}},
            "Fonte": {"select": {"options": [
                {"name": "Trends", "color": "blue"},
                {"name": "Pesquisa", "color": "purple"},
                {"name": "Comentários", "color": "yellow"},
                {"name": "Pessoal", "color": "gray"},
            ]}},
            "Status": {"select": {"options": [
                {"name": "Nova", "color": "gray"},
                {"name": "Aprovada", "color": "green"},
                {"name": "Em Produção", "color": "blue"},
                {"name": "Descartada", "color": "red"},
            ]}},
            "Gancho Sugerido": {"rich_text": {}},
            "Por que funciona": {"rich_text": {}},
        }
    )
    return db["id"].replace("-", "")


def create_relatorios():
    db = client.databases.create(
        parent={"type": "page_id", "page_id": PAGE_ID},
        title=[{"type": "text", "text": {"content": "Relatórios"}}],
        properties={
            "Título": {"title": {}},
            "Período": {"date": {}},
            "Total Publicados": {"number": {"format": "number"}},
            "Total Views": {"number": {"format": "number"}},
            "Melhor Vídeo": {"rich_text": {}},
            "Insights": {"rich_text": {}},
            "Próximos Passos": {"rich_text": {}},
        }
    )
    return db["id"].replace("-", "")


if __name__ == "__main__":
    print("Criando databases no Notion...")
    ids = {
        "NOTION_CONTEUDOS_DB": create_conteudos(),
        "NOTION_IDEIAS_DB": create_ideias(),
        "NOTION_RELATORIOS_DB": create_relatorios(),
    }
    print(json.dumps(ids, indent=2))
    print("\nDatabases criados com sucesso!")

#!/usr/bin/env python3
"""Instagram Graph API client for content insights."""
import os
import json
import sys
import argparse

try:
    import requests
except ImportError:
    print(json.dumps({"error": "requests not installed. Run: pip install requests"}))
    sys.exit(1)

ACCESS_TOKEN = os.environ.get("INSTAGRAM_ACCESS_TOKEN")
USER_ID = os.environ.get("INSTAGRAM_USER_ID")
BASE_URL = "https://graph.instagram.com/v18.0"


def api_get(endpoint, params=None):
    if not ACCESS_TOKEN:
        return {"error": "INSTAGRAM_ACCESS_TOKEN not set"}
    p = dict(params or {})
    p["access_token"] = ACCESS_TOKEN
    resp = requests.get(f"{BASE_URL}/{endpoint}", params=p)
    if resp.status_code != 200:
        return {"error": resp.json().get("error", {}).get("message", "API error")}
    return resp.json()


def get_recent_media(limit=10):
    if not USER_ID:
        return {"error": "INSTAGRAM_USER_ID not set"}
    data = api_get(f"{USER_ID}/media", {
        "fields": "id,caption,media_type,timestamp,permalink",
        "limit": limit
    })
    if "error" in data:
        return data
    posts = [{
        "id": item["id"],
        "tipo": item.get("media_type", ""),
        "caption": (item.get("caption", "") or "")[:100],
        "publicado_em": item.get("timestamp", "")[:10],
        "url": item.get("permalink", ""),
    } for item in data.get("data", [])]
    return {"posts": posts, "total": len(posts)}


def get_media_insights(media_id):
    metrics = "reach,impressions,saved,video_views,likes,comments,shares,plays"
    data = api_get(f"{media_id}/insights", {"metric": metrics})
    if "error" in data:
        metrics = "reach,impressions,saved,likes,comments,shares"
        data = api_get(f"{media_id}/insights", {"metric": metrics})
    if "error" in data:
        return data
    insights = {}
    for item in data.get("data", []):
        insights[item["name"]] = item["values"][0]["value"] if item.get("values") else item.get("value", 0)
    reach = insights.get("reach", 0)
    total_eng = sum(insights.get(k, 0) for k in ["likes", "comments", "shares", "saved"])
    return {
        "media_id": media_id,
        "alcance": reach,
        "impressoes": insights.get("impressions", 0),
        "plays": insights.get("plays", insights.get("video_views", 0)),
        "likes": insights.get("likes", 0),
        "comentarios": insights.get("comments", 0),
        "compartilhamentos": insights.get("shares", 0),
        "salvamentos": insights.get("saved", 0),
        "taxa_engajamento": round((total_eng / reach * 100), 2) if reach > 0 else 0,
    }


def get_account_summary():
    if not USER_ID:
        return {"error": "INSTAGRAM_USER_ID not set"}
    data = api_get(USER_ID, {"fields": "username,name,followers_count,follows_count,media_count"})
    if "error" in data:
        return data
    return {
        "username": data.get("username", ""),
        "nome": data.get("name", ""),
        "seguidores": data.get("followers_count", 0),
        "seguindo": data.get("follows_count", 0),
        "total_posts": data.get("media_count", 0),
    }


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command")
    p_rec = sub.add_parser("recentes")
    p_rec.add_argument("--limit", type=int, default=10)
    p_ins = sub.add_parser("insights")
    p_ins.add_argument("media_id")
    sub.add_parser("perfil")
    args = parser.parse_args()
    if args.command == "recentes":
        result = get_recent_media(args.limit)
    elif args.command == "insights":
        result = get_media_insights(args.media_id)
    elif args.command == "perfil":
        result = get_account_summary()
    else:
        result = {"error": "Use: recentes | insights MEDIA_ID | perfil"}
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

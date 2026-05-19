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
        "likes": insights.get("likes", 0),
        "comentarios": insights.get("comments", 0),
        "compartilhamentos": insights.get("shares", 0),
        "salvamentos": insights.get("saved", 0),
        "taxa_engajamento": round((total_eng / reach * 100), 2) if reach > 0 else 0,
    }


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command")
    p_ins = sub.add_parser("insights")
    p_ins.add_argument("media_id")
    args = parser.parse_args()
    if args.command == "insights":
        result = get_media_insights(args.media_id)
    else:
        result = {"error": "Use: insights MEDIA_ID"}
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

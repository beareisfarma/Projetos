#!/usr/bin/env python3
"""YouTube Data API v3 client for video statistics."""
import os
import json
import sys
import argparse

try:
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError:
    print(json.dumps({"error": "google-api-python-client not installed. Run: pip install google-api-python-client"}))
    sys.exit(1)

API_KEY = os.environ.get("YOUTUBE_API_KEY")
CHANNEL_ID = os.environ.get("YOUTUBE_CHANNEL_ID")


def get_service():
    if not API_KEY:
        print(json.dumps({"error": "YOUTUBE_API_KEY not set"}))
        sys.exit(1)
    return build("youtube", "v3", developerKey=API_KEY)


def get_video_stats(service, video_id):
    try:
        response = service.videos().list(
            part="snippet,statistics,contentDetails",
            id=video_id
        ).execute()
        if not response["items"]:
            return {"error": f"Vídeo {video_id} não encontrado"}
        item = response["items"][0]
        snippet = item["snippet"]
        stats = item["statistics"]
        views = int(stats.get("viewCount", 0))
        likes = int(stats.get("likeCount", 0))
        comments = int(stats.get("commentCount", 0))
        total_eng = likes + comments
        return {
            "video_id": video_id,
            "titulo": snippet["title"],
            "publicado_em": snippet["publishedAt"][:10],
            "views": views,
            "likes": likes,
            "comentarios": comments,
            "taxa_engajamento": round((total_eng / views * 100), 2) if views > 0 else 0,
            "url": f"https://youtube.com/watch?v={video_id}",
        }
    except HttpError as e:
        return {"error": str(e)}


def get_channel_videos(service, max_results=10):
    if not CHANNEL_ID:
        return {"error": "YOUTUBE_CHANNEL_ID not set"}
    try:
        search_resp = service.search().list(
            channelId=CHANNEL_ID, part="snippet",
            order="date", maxResults=max_results, type="video"
        ).execute()
        video_ids = [item["id"]["videoId"] for item in search_resp.get("items", [])]
        if not video_ids:
            return {"videos": [], "total": 0}
        stats_resp = service.videos().list(
            part="snippet,statistics", id=",".join(video_ids)
        ).execute()
        videos = []
        for item in stats_resp["items"]:
            stats = item["statistics"]
            views = int(stats.get("viewCount", 0))
            likes = int(stats.get("likeCount", 0))
            comments = int(stats.get("commentCount", 0))
            videos.append({
                "video_id": item["id"],
                "titulo": item["snippet"]["title"],
                "publicado_em": item["snippet"]["publishedAt"][:10],
                "views": views, "likes": likes, "comentarios": comments,
                "taxa_engajamento": round(((likes + comments) / views * 100), 2) if views > 0 else 0,
                "url": f"https://youtube.com/watch?v={item['id']}",
            })
        return {"videos": sorted(videos, key=lambda x: x["views"], reverse=True), "total": len(videos)}
    except HttpError as e:
        return {"error": str(e)}


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command")
    p_video = sub.add_parser("video")
    p_video.add_argument("video_id")
    p_canal = sub.add_parser("canal")
    p_canal.add_argument("--max", type=int, default=10)
    args = parser.parse_args()
    service = get_service()
    if args.command == "video":
        result = get_video_stats(service, args.video_id)
    elif args.command == "canal":
        result = get_channel_videos(service, args.max)
    else:
        result = {"error": "Use: video VIDEO_ID | canal [--max N]"}
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

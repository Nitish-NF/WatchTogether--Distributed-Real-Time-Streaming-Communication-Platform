#!/bin/bash
# ─────────────────────────────────────────────────────────────
# WatchTogether — Optimized HLS Conversion Script
# Usage:
#   ./convert.sh <input_file> <output_name>
#
# Example:
#   ./convert.sh ../uploads/interstellar.mp4 interstellar
# ─────────────────────────────────────────────────────────────

set -e
FFMPEG="/mnt/c/ffmpeg/bin/ffmpeg.exe"

INPUT="$1"
NAME="$2"

OUTPUT_DIR="../output/${NAME}"
THUMB_DIR="../thumbnails"

if [ -z "$INPUT" ] || [ -z "$NAME" ]; then
  echo "Usage: $0 <input_file> <output_name>"
  exit 1
fi

if [ ! -f "$INPUT" ]; then
  echo "Error: Input file '$INPUT' not found"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"
mkdir -p "$THUMB_DIR"

echo "🎬 Starting HLS conversion..."
echo "Input: $INPUT"
echo "Output: $OUTPUT_DIR"

# ─────────────────────────────────────────────────────────────
# Generate thumbnail
# ─────────────────────────────────────────────────────────────
echo "📸 Generating thumbnail..."

"$FFMPEG" -y -i "$INPUT" \
  -ss 00:00:05 \
  -vframes 1 \
  "${THUMB_DIR}/${NAME}.jpg"

# ─────────────────────────────────────────────────────────────
# HLS Conversion
# ─────────────────────────────────────────────────────────────
echo "⚡ Converting video to adaptive HLS..."

"$FFMPEG" -y -i "$INPUT" \
  -filter_complex \
    "[v:0]split=3[v1][v2][v3]; \
     [v1]scale=w=640:h=360[v360]; \
     [v2]scale=w=1280:h=720[v720]; \
     [v3]scale=w=1920:h=1080[v1080]" \
  \
  -map "[v360]"  -c:v:0 libx264 -preset veryfast -b:v:0 800k  -maxrate:v:0 856k  -bufsize:v:0 1200k \
  -map "[v720]"  -c:v:1 libx264 -preset veryfast -b:v:1 2800k -maxrate:v:1 2996k -bufsize:v:1 4200k \
  -map "[v1080]" -c:v:2 libx264 -preset veryfast -b:v:2 5000k -maxrate:v:2 5350k -bufsize:v:2 7500k \
  \
  -map a:0? -c:a:0 aac -b:a:0 96k  -ac 2 \
  -map a:0? -c:a:1 aac -b:a:1 128k -ac 2 \
  -map a:0? -c:a:2 aac -b:a:2 192k -ac 2 \
  \
  -f hls \
  -hls_time 6 \
  -hls_playlist_type vod \
  -hls_flags independent_segments \
  -hls_segment_type mpegts \
  -master_pl_name index.m3u8 \
  -hls_segment_filename "${OUTPUT_DIR}/%v/segment_%03d.ts" \
  -var_stream_map "v:0,a:0,name:360p v:1,a:1,name:720p v:2,a:2,name:1080p" \
  "${OUTPUT_DIR}/%v/index.m3u8"

echo ""
echo "✅ Conversion Complete!"
echo ""
echo "📂 HLS Output:"
echo "   ${OUTPUT_DIR}/"
echo ""
echo "🎞 Master Playlist:"
echo "   ${OUTPUT_DIR}/index.m3u8"
echo ""
echo "🖼 Thumbnail:"
echo "   ${THUMB_DIR}/${NAME}.jpg"
echo ""
echo "🌐 Stream URL:"
echo "   /hls/${NAME}/index.m3u8"
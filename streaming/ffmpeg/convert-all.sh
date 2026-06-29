#!/bin/bash

UPLOAD_DIR="../uploads"

for file in "$UPLOAD_DIR"/*.mp4
do
    filename=$(basename -- "$file")
    name="${filename%.*}"

    echo ""
    echo "🎬 Processing: $filename"

    ./convert.sh "$file" "$name"

    echo "✅ Finished: $name"
done

echo ""
echo "🚀 All videos converted successfully!"
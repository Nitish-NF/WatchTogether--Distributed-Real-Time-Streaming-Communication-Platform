import yt_dlp
import os

# Video URL
url = input("Enter video URL: ")

# Folder location where you want to save videos
save_path = r"D:/Watchtogether/streaming/uploads"   # Change this path

# Create folder if it does not exist
os.makedirs(save_path, exist_ok=True)

# yt-dlp options
ydl_opts = {
    'outtmpl': os.path.join(save_path, '%(title)s.%(ext)s'),
    'format': 'bestvideo+bestaudio/best',
    'merge_output_format': 'mp4',
}

try:
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])

    print(f"Video downloaded successfully in: {save_path}")

except Exception as e:
    print("Error:", e)
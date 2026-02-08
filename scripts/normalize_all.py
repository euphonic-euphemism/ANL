import os
import subprocess
import sys

def check_ffmpeg():
    try:
        subprocess.run(['ffmpeg', '-version'], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Error: ffmpeg is not installed or not in PATH.")
        sys.exit(1)

def normalize_file(file_path):
    if not os.path.exists(file_path):
        print(f"Skipping (not found): {file_path}")
        return

    print(f"Normalizing {file_path} to -23 LUFS...")
    
    # We use a temporary file to store the normalized output
    temp_file = file_path + ".temp.flac"
    
    # FFmpeg command for 2-pass Loudness Normalization (using loudnorm)
    # Target Integrated Loudness: -23.0 LUFS
    # Target True Peak: -1.0 dBTP
    # Loudness Range: 7.0 LU
    
    cmd = [
        'ffmpeg', '-y', '-i', file_path,
        '-af', 'loudnorm=I=-23:TP=-1.0:LRA=7',
        temp_file
    ]

    try:
        subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        # Replace original with normalized
        os.replace(temp_file, file_path)
        print(f"Successfully normalized {file_path}")
    except subprocess.CalledProcessError as e:
        print(f"Error normalizing {file_path}: {e}")
        if os.path.exists(temp_file):
            os.remove(temp_file)

def main():
    check_ffmpeg()

    audio_dir = "public/audio"
    files_to_normalize = [
        "anl_speech.flac",
        "4-talker_babble.flac",
        "history_glass.flac",
        "history_bicycle.flac",
        "history_pencil.flac",
        "history_umbrella.flac"
    ]

    for f in files_to_normalize:
        normalize_file(os.path.join(audio_dir, f))

if __name__ == "__main__":
    main()

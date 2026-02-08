
import os
import subprocess
import sys

def check_ffmpeg():
    try:
        subprocess.run(['ffmpeg', '-version'], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Error: ffmpeg is not installed or not in PATH.")
        sys.exit(1)

def apply_shout_eq(file_path):
    if not os.path.exists(file_path):
        print(f"Skipping (not found): {file_path}")
        return

    print(f"Applying shout EQ to {file_path}...")
    temp_file = file_path + ".temp.flac"
    backup_file = file_path + ".bak"
    
    # Backup original
    if not os.path.exists(backup_file):
        print(f"Creating backup: {backup_file}")
        # Copy file content to backup
        import shutil
        shutil.copy2(file_path, backup_file)

    # Filter chain:
    # 1. High-pass filter at 250 Hz (remove boominess)
    # 2. Boost 1000 Hz by +3 dB (body)
    # 3. Boost 3000 Hz by +6 dB (shout/presence)
    # 4. Loudness Normalization to -23 LUFS (standard)
    
    filter_complex = "highpass=f=250,equalizer=f=1000:width_type=q:width=1.0:g=3,equalizer=f=3000:width_type=q:width=1.0:g=6,loudnorm=I=-23:TP=-1.0:LRA=7"
    
    cmd = [
        'ffmpeg', '-y', '-i', file_path,
        '-af', filter_complex,
        temp_file
    ]
    
    try:
        subprocess.run(cmd, check=True) # stdout/stderr specific handling not required unless debugging
        os.replace(temp_file, file_path)
        print(f"Successfully processed {file_path}")
    except subprocess.CalledProcessError as e:
        print(f"Error processing {file_path}: {e}")
        if os.path.exists(temp_file):
            os.remove(temp_file)

def main():
    check_ffmpeg()
    
    audio_dir = "public/audio"
    files = [
        "history_glass.flac",
        "history_bicycle.flac",
        "history_pencil.flac",
        "history_umbrella.flac"
    ]
    
    for f in files:
        apply_shout_eq(os.path.join(audio_dir, f))

if __name__ == "__main__":
    main()

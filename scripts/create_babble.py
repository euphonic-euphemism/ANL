import os
import subprocess
import sys

def check_ffmpeg():
    try:
        subprocess.run(['ffmpeg', '-version'], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Error: ffmpeg is not installed or not in PATH.")
        sys.exit(1)

def main():
    check_ffmpeg()

    source_dir = "dist/audio"
    output_dir = "public/audio"
    output_file = os.path.join(output_dir, "4-talker_babble.flac")
    backup_file = os.path.join(output_dir, "4-talker_babble.flac.bak")

    # Define source files
    sources = [
        "Babble Voice - Adam - Concrete.wav",
        "Babble Voice - Aria - Honey Bee Colonies.wav",
        "Babble Voice - Ethan - Types of Soil.wav",
        "Babble Voice - Gigi Noir - Cloud Formation.wav"
    ]
    
    source_paths = [os.path.join(source_dir, f) for f in sources]

    # Verify source files exist
    for p in source_paths:
        if not os.path.exists(p):
            print(f"Error: Source file not found: {p}")
            sys.exit(1)

    # Backup existing file
    if os.path.exists(output_file):
        print(f"Backing up existing {output_file} to {backup_file}...")
        if os.path.exists(backup_file):
            os.remove(backup_file)
        os.rename(output_file, backup_file)

    print("Generating 4-talker babble...")

    # FFmpeg command
    # 1. Input 4 files
    # 2. Normalize each to -23 LUFS (EBU R128)
    # 3. Mix them (amix)
    # 4. Trim to 120 seconds
    # 5. Output as FLAC
    
    cmd = ['ffmpeg', '-y']
    for p in source_paths:
        cmd.extend(['-i', p])

    filter_complex = (
        "[0:a]loudnorm=I=-23:TP=-1.0:LRA=7[a0];"
        "[1:a]loudnorm=I=-23:TP=-1.0:LRA=7[a1];"
        "[2:a]loudnorm=I=-23:TP=-1.0:LRA=7[a2];"
        "[3:a]loudnorm=I=-23:TP=-1.0:LRA=7[a3];"
        "[a0][a1][a2][a3]amix=inputs=4:duration=first:dropout_transition=0,volume=2[mix];"
        "[mix]atrim=0:120[out]"
    )

    cmd.extend(['-filter_complex', filter_complex, '-map', '[out]', output_file])

    try:
        subprocess.run(cmd, check=True)
        print(f"Successfully created {output_file}")
    except subprocess.CalledProcessError as e:
        print(f"Error running ffmpeg: {e}")
        # Restore backup if failed
        if os.path.exists(backup_file):
            print("Restoring backup...")
            if os.path.exists(output_file):
                os.remove(output_file)
            os.rename(backup_file, output_file)
        sys.exit(1)

if __name__ == "__main__":
    main()

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
    
    # Map source filename to output filename (base only)
    files = {
        "History of Glass.wav": "history_glass.flac",
        "History of the Bicycle.wav": "history_bicycle.flac",
        "History of the Pencil.wav": "history_pencil.flac",
        "History of the Umbrella.wav": "history_umbrella.flac"
    }

    print("Processing speech files...")

    for src_name, dest_name in files.items():
        src_path = os.path.join(source_dir, src_name)
        dest_path = os.path.join(output_dir, dest_name)

        if not os.path.exists(src_path):
            print(f"Error: Source file not found: {src_path}")
            continue

        print(f"Processing {src_name} -> {dest_name}...")

        # standard ffmpeg command to trim to 120s and convert to flac
        # We also normalize to -23 LUFS (optional but good practice)
        # Actually user just said "trim to 120s". 
        # But previous babble was normalized. Let's consistency normalize speech too?
        # The user said "voices need normalized" for babble. Did not explicitly say for speech.
        # But "Arizona Travelogue" replacement implies it should be standard level.
        # I'll stick to just trimming and converting to FLAC to minimize changes to the source material's dynamic range unless requested.
        # Wait, previous task user said "voices need normalized before mixing".
        # Use simple copy or re-encode? wav->flac needs re-encode.
        
        cmd = [
            'ffmpeg', '-y',
            '-i', src_path,
            '-t', '120',
            dest_path
        ]

        try:
            subprocess.run(cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            print(f"Saved {dest_path}")
        except subprocess.CalledProcessError as e:
            print(f"Error processing {src_name}: {e}")

if __name__ == "__main__":
    main()

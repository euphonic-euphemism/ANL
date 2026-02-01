import os
import subprocess
import re

# --- CONFIGURATION ---
OUTPUT_DIR = "/home/marks/Development/Acceptable Noise Level Test/accept-noise-level/dist/audio"
FILENAME = "speech.flac"
TEMP_WAV = os.path.join(os.getcwd(), "temp_speech_raw.wav")

# Ensure the directory exists
if not os.path.exists(OUTPUT_DIR):
    try:
        os.makedirs(OUTPUT_DIR)
        print(f"Created directory: {OUTPUT_DIR}")
    except OSError as e:
        print(f"Error creating directory: {e}")
        exit(1)

# Full output path
final_output_path = os.path.join(OUTPUT_DIR, FILENAME)

# --- THE TEXT MATERIAL ---
text_material = """
Glass is a non-crystalline, often transparent amorphous solid, that has widespread
practical, technological, and decorative use in, for example, window panes, tableware,
and optics. Glass is most often formed by rapid cooling of the molten form; some glasses
such as volcanic glass are naturally occurring. The most familiar, and historically
the oldest, types of manufactured glass are "silicate glasses" based on the chemical
compound silica, the primary constituent of sand. The term glass, in scientific usage,
is often defined in a broader sense, encompassing every solid that possesses a
non-crystalline, that is, amorphous, structure at the atomic scale and that exhibits
a glass transition when heated towards the liquid state.

Porcelain and many high-temperature polymer thermoplastics are glasses in this sense.
The glass transition is the gradual and reversible transition in amorphous materials
from a hard and relatively brittle "glassy" state into a viscous or rubbery state
as the temperature is increased.
"""

# We generate one copy and loop it with ffmpeg
full_text = text_material 
LOOP_COUNT = 5 # +1 original = 6 total (~4 mins)

# --- GENERATION ---
print("Generating raw audio using espeak...")
try:
    # Use espeak directly via subprocess
    # -w: output file
    # -s: speed (words per minute)
    # -v: voice (en-us)
    cmd_tts = [
        "espeak",
        "-w", TEMP_WAV,
        "-s", "145",
        "-v", "en-us",
        full_text
    ]
    subprocess.run(cmd_tts, check=True)
    
    if os.path.exists(TEMP_WAV):
        print(f"Success: Raw audio generated at {TEMP_WAV}")
    else:
        print("Error: espeak finished but file was not found.")
        exit(1)

except subprocess.CalledProcessError as e:
    print(f"Error running espeak: {e}")
    exit(1)

# --- CONVERSION & SAVING ---
if os.path.exists(TEMP_WAV):
    print("Converting to FLAC using ffmpeg (Looping)...")
    try:
        # Convert to FLAC (Mono, 44.1kHz) and Loop
        # -stream_loop 5 means loop 5 times (total 6 plays)
        cmd_convert = [
            "ffmpeg", "-y",
            "-stream_loop", str(LOOP_COUNT),
            "-i", TEMP_WAV,
            "-ac", "1",
            "-ar", "44100",
            final_output_path
        ]
        
        # Suppress output unless error
        subprocess.run(cmd_convert, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

        # Calculate RMS using ffmpeg volumedetect
        print("Calculating RMS amplitude...")
        cmd_analyze = [
            "ffmpeg",
            "-i", final_output_path,
            "-af", "volumedetect",
            "-f", "null",
            "/dev/null"
        ]
        
        result = subprocess.run(cmd_analyze, capture_output=True, text=True)
        stderr = result.stderr
        
        # Parse mean_volume
        match = re.search(r"mean_volume: ([\-\d\.]+) dB", stderr)
        rms_db = match.group(1) if match else "Unknown"

        # Cleanup
        os.remove(TEMP_WAV)
        print(f"Removed temp file: {TEMP_WAV}")

        # Verification
        print(f"Success! File saved to: {final_output_path}")
        print(f"Final RMS Amplitude (Mean Volume): {rms_db} dB")

    except subprocess.CalledProcessError as e:
        print(f"Error during ffmpeg conversion: {e}")
        if e.stderr:
            print(f"FFmpeg Output: {e.stderr.decode()}")
        # Cleanup on error too
        if os.path.exists(TEMP_WAV):
             os.remove(TEMP_WAV)
    except Exception as e:
        print(f"Unexpected error: {e}")
else:
    print("Error: Temporary WAV file was not created.")

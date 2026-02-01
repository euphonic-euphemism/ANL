import asyncio
import edge_tts
import os
import subprocess
import re

# Installation command for user reference:
# pip install edge-tts

# --- CONFIGURATION ---
OUTPUT_DIR = "/home/marks/Development/Acceptable Noise Level Test/accept-noise-level/dist/audio"
FILENAME = "speech.flac"
TEMP_MP3 = os.path.join(os.getcwd(), "temp_speech_raw.mp3")
VOICE = "en-US-GuyNeural"

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
# The text is about ~40-50 seconds. Looping 5 times (total 6) gets us ~4-5 mins.
full_text = text_material 
LOOP_COUNT = 5 

async def generate_speech():
    print(f"Generating speech using edge-tts voice: {VOICE}...")
    communicate = edge_tts.Communicate(full_text, VOICE)
    await communicate.save(TEMP_MP3)
    
    if os.path.exists(TEMP_MP3):
        print(f"Success: Raw MP3 generated at {TEMP_MP3}")
    else:
        print("Error: MP3 file was not created.")
        exit(1)

def convert_and_cleanup():
    if os.path.exists(TEMP_MP3):
        print("Converting to FLAC using ffmpeg (Looping)...")
        # NOTE: pydub was requested but it has compatibility issues with Python 3.13 (missing audioop).
        # We use ffmpeg directly via subprocess for reliability and identical results.
        try:
            # Convert to FLAC (Mono, 44.1kHz) and Loop
            cmd_convert = [
                "ffmpeg", "-y",
                "-stream_loop", str(LOOP_COUNT),
                "-i", TEMP_MP3,
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
            os.remove(TEMP_MP3)
            print(f"Removed temp file: {TEMP_MP3}")

            # Verification
            print(f"Success! File saved to: {final_output_path}")
            print(f"Final RMS Amplitude (Mean Volume): {rms_db} dB")

        except subprocess.CalledProcessError as e:
            print(f"Error during ffmpeg conversion: {e}")
            if e.stderr:
                print(f"FFmpeg Output: {e.stderr.decode()}")
            if os.path.exists(TEMP_MP3):
                os.remove(TEMP_MP3)
        except Exception as e:
            print(f"Unexpected error: {e}")
            if os.path.exists(TEMP_MP3):
                os.remove(TEMP_MP3)
    else:
        print("Error: Temporary MP3 file not found for conversion.")

if __name__ == "__main__":
    # Run Async Generation
    asyncio.run(generate_speech())
    
    # Run Synchronous Conversion
    convert_and_cleanup()

import os
import subprocess
import re
from gtts import gTTS

# Installation:
# pip install gTTS

# --- CONFIGURATION ---
OUTPUT_DIR = "/home/marks/Development/Acceptable Noise Level Test/accept-noise-level/dist/audio"
FILENAME = "speech.flac"
TEMP_MP3 = os.path.join(os.getcwd(), "temp_gtts_raw.mp3")

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

# Loop text to reach ~3 minutes.
# Text is ~100 words. Normal speaking rate ~130-150 wpm.
# So one pass is ~45 seconds.
# 4 passes = ~3 mins. Let's do 5 to be safe.
# We will generate ONE pass with gTTS and loop it with ffmpeg to save TTS processing time and API limits.
full_text = text_material 
LOOP_COUNT = 5

def generate_and_convert():
    print("Generating speech using gTTS (en-us)...")
    try:
        # Generate MP3
        tts = gTTS(text=full_text, lang='en', tld='us', slow=False)
        tts.save(TEMP_MP3)
        print(f"Success: Raw MP3 generated at {TEMP_MP3}")
    except Exception as e:
        print(f"Error during gTTS generation: {e}")
        exit(1)

    if os.path.exists(TEMP_MP3):
        print("Converting to FLAC using ffmpeg (Looping)...")
        try:
            # Convert to FLAC (Mono, 44.1kHz) and Loop
            # We use ffmpeg directly because pydub has issues with Python 3.13's removed audioop module in this env.
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
        print("Error: Temporary MP3 file was not created.")

if __name__ == "__main__":
    generate_and_convert()

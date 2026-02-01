import pyttsx3
import os
from pydub import AudioSegment

# --- CONFIGURATION ---
OUTPUT_DIR = "/home/marks/Development/Acceptable Noise Level Test/accept-noise-level/dist/audio"
FILENAME = "speech.flac"
TEMP_WAV = "temp_speech_raw.wav"

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
# (Boring, factual, repetitive to ensure consistent level)
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
# Loop to approx 3 minutes
full_text = text_material * 6

# --- GENERATION ---
print("Initializing TTS Engine...")
engine = pyttsx3.init()
engine.setProperty('rate', 145) # Slower, clinical pace

print(f"Generating raw audio to {TEMP_WAV}...")
engine.save_to_file(full_text, TEMP_WAV)
engine.runAndWait()

# --- CONVERSION & SAVING ---
if os.path.exists(TEMP_WAV):
    print("Converting to FLAC...")
    sound = AudioSegment.from_wav(TEMP_WAV)

    # Optional: Force Mono and 44.1kHz for standard web playback
    sound = sound.set_channels(1)
    sound = sound.set_frame_rate(44100)

    # Export to the specific 'dist' folder
    sound.export(final_output_path, format="flac")

    # Calculate RMS for your reference
    print(f"Success! File saved to: {final_output_path}")
    print(f"Final RMS Amplitude: {sound.dBFS:.

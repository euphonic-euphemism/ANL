import numpy as np
import os
import subprocess
import sys

def check_ffmpeg():
    try:
        subprocess.run(['ffmpeg', '-version'], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("Error: ffmpeg is not installed or not in PATH.")
        sys.exit(1)

def generate_warble_tone(duration_sec, sample_rate=44100, carrier_freq=1000, mod_freq=5, mod_percent=0.05, target_db_rms=-23):
    t = np.linspace(0, duration_sec, int(sample_rate * duration_sec), endpoint=False)
    
    # Warble parameters
    deviation = carrier_freq * mod_percent # +/- 5% = 50Hz
    
    # FM Synthesis
    modulation_index = deviation / mod_freq
    audio = np.sin(2 * np.pi * carrier_freq * t + modulation_index * np.sin(2 * np.pi * mod_freq * t))
    
    # Normalize to Target RMS
    current_rms = np.sqrt(np.mean(audio**2))
    target_rms = 10 ** (target_db_rms / 20)
    gain = target_rms / current_rms
    audio_normalized = audio * gain
    
    return audio_normalized

def save_flac_via_ffmpeg(audio, sample_rate, filename):
    # Convert numpy float32/64 (-1.0 to 1.0) to int16 PCM for simple piping
    # or float32le. Let's use float32le.
    audio_bytes = audio.astype(np.float32).tobytes()
    
    cmd = [
        'ffmpeg', '-y',
        '-f', 'f32le', '-ar', str(sample_rate), '-ac', '1', '-i', 'pipe:0',
        '-c:a', 'flac', filename
    ]
    
    process = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    stdout, stderr = process.communicate(input=audio_bytes)
    
    if process.returncode != 0:
        print(f"Error saving {filename}: {stderr.decode()}")
    else:
        print(f"Saved {filename}")

def main():
    check_ffmpeg()
    output_dir = "public/audio"
    
    # Parameters
    duration = 60 # 60 seconds
    
    print(f"Generating 1000Hz Warble Tone (+/- 5%) at -23dB RMS...")
    audio = generate_warble_tone(duration, mod_freq=5)
    
    # Save as Right and Left channel files
    save_flac_via_ffmpeg(audio, 44100, os.path.join(output_dir, "cal_warble_L.flac"))
    save_flac_via_ffmpeg(audio, 44100, os.path.join(output_dir, "cal_warble_R.flac"))

if __name__ == "__main__":
    main()

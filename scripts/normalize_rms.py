
import os
import soundfile as sf
import numpy as np
import math

def calculate_rms(data):
    """Calculates RMS amplitude of the audio data."""
    # Ensure data is floating point
    if data.dtype != np.float64 and data.dtype != np.float32:
        data = data.astype(np.float64)
    
    return np.sqrt(np.mean(data**2))

def db_to_linear(db_value):
    return 10 ** (db_value / 20)

def normalize_file(file_path, target_db_rms=-23.0):
    print(f"Processing {file_path}...")
    
    # Load audio
    data, samplerate = sf.read(file_path)
    
    # Handle multi-channel (calculate RMS of all channels combined or per channel? 
    # Usually for SNR validation, we want the global power to match. 
    # If stereo, we treat the whole signal.
    # But let's check shapes.
    
    current_rms = calculate_rms(data)
    if current_rms == 0:
        print(f"Warning: Silent file {file_path}")
        return

    current_db = 20 * math.log10(current_rms)
    gain_db = target_db_rms - current_db
    gain_linear = db_to_linear(gain_db)
    
    print(f"  Current RMS: {current_db:.2f} dB")
    print(f"  Target RMS:  {target_db_rms:.2f} dB")
    print(f"  Gain needed: {gain_db:.2f} dB (x{gain_linear:.4f})")
    
    # Apply gain
    normalized_data = data * gain_linear
    
    # Check for clipping
    peak = np.max(np.abs(normalized_data))
    if peak > 1.0:
        print(f"  WARNING: Signal will clip! Peak: {peak:.2f}")
        # Optional: Limiter or reduce target? 
        # For now, just warn.
    
    # Save
    # Backup first
    backup_path = file_path + ".bak_rms.flac"
    if not os.path.exists(backup_path):
         # If simpler backup exists, don't overwrite it? 
         # Or maybe we rely on previous .bak
         # Let's make a specific pre-rms backup if one doesn't exist
         sf.write(backup_path, data, samplerate)
    
    sf.write(file_path, normalized_data, samplerate)
    print(f"  Saved normalized file to {file_path}")

def main():
    target_rms = -23.0
    files = [
        "public/audio/4-talker_babble.flac",
        "public/audio/history_glass.flac",
        "public/audio/history_bicycle.flac",
        "public/audio/history_pencil.flac",
        "public/audio/history_umbrella.flac"
    ]
    
    print(f"Normalizing to Target RMS: {target_rms} dB")
    for f in files:
        if os.path.exists(f):
            normalize_file(f, target_rms)
        else:
            print(f"File not found: {f}")

if __name__ == "__main__":
    main()

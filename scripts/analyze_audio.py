
import soundfile as sf
import numpy as np
import os
import math

def calculate_rms(file_path):
    try:
        data, samplerate = sf.read(file_path)
        # Handle multi-channel: convert to mono by averaging if needed, or take first channel
        # Usually ANL files might be mono. If stereo, RMS of whole or channel?
        # let's map to mono for RMS calculation of "loudness"
        if len(data.shape) > 1:
            data = np.mean(data, axis=1)
        
        rms = np.sqrt(np.mean(data**2))
        db_fs = 20 * math.log10(rms) if rms > 0 else -np.inf
        return db_fs, rms
    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return None, None

files = [
    'public/audio/anl_speech.flac',
    'public/audio/4-talker_babble.flac',
    'public/audio/history_glass.flac',
    'public/audio/history_bicycle.flac',
    'public/audio/history_pencil.flac',
    'public/audio/history_umbrella.flac',
    'public/audio/cal_pulse_R.flac' # using Right channel which is Tone in standard mode often
]

results = []

print("--- Audio Level Verification ---")
for f in files:
    if os.path.exists(f):
        db, rms = calculate_rms(f)
        if db is not None:
             print(f"File: {f}")
             print(f"  RMS Level: {db:.4f} dBFS")
             print(f"  Linear RMS: {rms:.6f}")
             results.append({'file': f, 'db': db, 'rms': rms})
    else:
        print(f"File not found: {f}")

if len(results) >= 2:
    print("\n--- Comparison ---")
    base = results[0]
    print(f"Baseline: {base['file']} ({base['db']:.4f} dBFS)")
    
    max_diff = 0
    for r in results[1:]:
        diff = r['db'] - base['db']
        print(f"vs {r['file']}: {diff:+.4f} dB")
        if abs(diff) > max_diff:
            max_diff = abs(diff)
            
    if max_diff > 0.5:
        print("\n[WARNING] Levels differ by > 0.5 dB!")
        print("Normalization recommended.")
    else:
        print("\n[OK] Levels are matched within 0.5 dB.")

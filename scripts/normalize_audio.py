
import subprocess
import re
import os

files = [
    'public/audio/anl_speech.flac',
    'public/audio/4-talker_babble.flac',
    'public/audio/cal_pulse_R.flac',
    'public/audio/cal_pulse_L.flac',
    'public/audio/cal_warble_L.flac',
    'public/audio/cal_warble_R.flac'
]

def get_mean_volume(file_path):
    cmd = ['ffmpeg', '-i', file_path, '-filter:a', 'volumedetect', '-f', 'null', '/dev/null']
    result = subprocess.run(cmd, stderr=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    
    # Parse mean_volume: -17.0 dB
    match = re.search(r'mean_volume:\s+([-\d\.]+)\s+dB', result.stderr)
    if match:
        return float(match.group(1))
    return None

print("--- Audio Normalization (Target: Lowest RMS) ---")

levels = {}
for f in files:
    if os.path.exists(f):
        vol = get_mean_volume(f)
        if vol is not None:
            levels[f] = vol
            print(f"{f}: {vol} dB")
        else:
            print(f"{f}: Failed to detect volume")

if not levels:
    print("No levels detected.")
    exit(1)

min_vol = min(levels.values())
target_file = [f for f, v in levels.items() if v == min_vol][0]
print(f"\nTarget Level: {min_vol} dB (from {target_file})")

for f, vol in levels.items():
    diff = vol - min_vol
    if abs(diff) > 0.05: # Threshold 0.05 dB
        print(f"\nNormalizing {f}...")
        print(f"Current: {vol} dB, Target: {min_vol} dB, Attenuate by: {diff:.2f} dB")
        
        # FFmpeg filter: volume=-XdB
        # We want to SUBTRACT the difference because louder numbers are higher (closer to 0).
        # e.g. -15.1 (louder) - (-17.0) = +1.9.
        # adjustment = -1.9dB.
        
        adjustment = -diff
        output_file = f + ".temp.flac"
        
        cmd = [
            'ffmpeg', '-y', '-i', f,
            '-filter:a', f'volume={adjustment}dB',
            output_file
        ]
        
        try:
            subprocess.run(cmd, check=True, stderr=subprocess.PIPE)
            os.replace(output_file, f)
            print(f"Success: {f} updated.")
        except subprocess.CalledProcessError as e:
            print(f"Error normalizing {f}: {e}")
    else:
        print(f"\n{f} is already at target level (diff {diff:.2f} dB).")

print("\n--- Verification ---")
for f in levels.keys():
    vol = get_mean_volume(f)
    print(f"{f}: {vol} dB")

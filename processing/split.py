import librosa
import soundfile as sf
import json
import sys
import os
import numpy as np

def main():
    if len(sys.argv) < 3:
        print("Usage: python split.py <input_wav> <segments_json> [output_dir]")
        sys.exit(1)

    input_wav = sys.argv[1]
    segments_json = sys.argv[2]
    
    if len(sys.argv) > 3:
        output_dir = sys.argv[3]
    else:
        # Default to input filename directory + basename + _chunks
        base = os.path.splitext(os.path.basename(input_wav))[0]
        output_dir = os.path.join(os.path.dirname(input_wav), base + "_chunks")

    if not os.path.exists(input_wav):
        print(f"Error: Input wav not found: {input_wav}")
        sys.exit(1)
    
    if not os.path.exists(segments_json):
        print(f"Error: Segments JSON not found: {segments_json}")
        sys.exit(1)

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Created output directory: {output_dir}")

    print(f"Loading audio: {input_wav}")
    # Load with original SR to match segment precision or default?
    # Silero used 16k usually, but segments are in seconds. Librosa load resamples to 22050 by default.
    # We should probably use original SR to avoid quality loss, or specific target.
    # Let's use native SR.
    try:
        y, sr = librosa.load(input_wav, sr=None)
    except Exception as e:
        print(f"Error loading audio: {e}")
        sys.exit(1)

    print(f"Loaded audio. SR={sr}, Duration={len(y)/sr:.2f}s")
    
    with open(segments_json, 'r') as f:
        segments = json.load(f)

    print(f"Processing {len(segments)} segments...")

    for i, seg in enumerate(segments):
        start_sec = seg['start']
        end_sec = seg['end']
        
        start_sample = int(start_sec * sr)
        end_sample = int(end_sec * sr)
        
        # Clamp to bounds
        start_sample = max(0, start_sample)
        end_sample = min(len(y), end_sample)
        
        if end_sample <= start_sample:
            continue
            
        chunk = y[start_sample:end_sample]
        
        # Output filename: <basename>_<start>_<end>.wav
        # Use simple index or timestamps in filename?
        # Filename safe timestamps?
        
        # Let's use index and timestamp for clarity
        base_name = os.path.splitext(os.path.basename(input_wav))[0]
        out_name = f"{base_name}_{i:04d}_{start_sec:.2f}-{end_sec:.2f}.wav"
        out_path = os.path.join(output_dir, out_name)
        
        sf.write(out_path, chunk, sr)
        
        if i % 100 == 0:
           print(f"Saved {i}/{len(segments)}: {out_name}")

    print(f"Done. Saved chunks to {output_dir}")

if __name__ == "__main__":
    main()

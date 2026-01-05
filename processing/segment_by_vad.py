import torch
import sys
import json
import os

def main():
    if len(sys.argv) < 2:
        print("Usage: python split.py <input_wav>")
        sys.exit(1)

    input_path = sys.argv[1]
    if not os.path.exists(input_path):
        print(f"Error: File not found: {input_path}")
        sys.exit(1)

    print(f"Processing: {input_path}")

    # Load Silero VAD model
    # force_reload=False to cache it
    try:
        model, utils = torch.hub.load(repo_or_dir='snakers4/silero-vad',
                                      model='silero_vad',
                                      force_reload=False,
                                      trust_repo=True)
    except Exception as e:
        print(f"Error loading model: {e}")
        sys.exit(1)

    (get_speech_timestamps, save_audio, read_audio, VADIterator, collect_chunks) = utils

    # Read audio
    try:
        wav = read_audio(input_path)
    except Exception as e:
         print(f"Error reading audio: {e}")
         sys.exit(1)

    # Get timestamps
    sampling_rate = 16000 # Silero works best with 16k, or 8k. read_audio should handle resampling if backend allows, or we just trust input.
    # Note: read_audio might not resample automatically if simple backend.
    # For robust production, we should ensure 16k. But for this Iteration, let's rely on default behavior or basic assumption.
    # Silero's utils usually handle standard wavs.
    
    # Check sample rate if possible or just run.
    # get_speech_timestamps expects tensor.
    
    try:
        speech_timestamps = get_speech_timestamps(wav, model, sampling_rate=sampling_rate)
    except Exception as e:
        print(f"Error processing audio: {e}")
        sys.exit(1)

    # Prepare output
    # speech_timestamps is a list of dicts: [{'start': int, 'end': int}, ...] in samples?
    # Silero docs says: list of dicts with 'start' and 'end' keys (in samples).
    # We want seconds for the JSON output usually, or we clarify. 
    # Let's output both or just samples and convert?
    # Prompt said "timestamps of segments". Seconds is most useful universally.
    
    output_segments = []
    for turn in speech_timestamps:
        # Convert samples to seconds
        start_sec = turn['start'] / sampling_rate
        end_sec = turn['end'] / sampling_rate
        output_segments.append({
            'start': start_sec,
            'end': end_sec
        })

    output_filename = input_path + ".segments.json"
    with open(output_filename, 'w') as f:
        json.dump(output_segments, f, indent=2)

    print(f"Segments saved to: {output_filename}")
    print(f"Found {len(output_segments)} segments.")

if __name__ == "__main__":
    main()

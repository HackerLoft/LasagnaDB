# Audio Processing Pipeline

This directory contains scripts for processing audio files, specifically for Voice Activity Detection (VAD) based segmentation and splitting.

## Prerequisite

This project uses `uv` for dependency management.

```bash
# Install dependencies
uv sync
```

## Workflows

### 1. Segmentation (VAD)

Detects speech segments in an audio file using Silero VAD.

**Command:**
```bash
uv run segment_by_vad.py <input_wav>
```

**Output:**
Generates a JSON file with timestamps: `<input_wav>.segments.json`.

**Example:**
```bash
uv run segment_by_vad.py ../data/interview.wav
```

### 2. Splitting

Splits the audio file into chunks based on the JSON timestamps generated in the previous step.

**Command:**
```bash
uv run split.py <input_wav> <segments_json> [output_dir]
```

**Arguments:**
- `<input_wav>`: Path to original audio file.
- `<segments_json>`: Path to the segments JSON file.
- `[output_dir]` (Optional): Directory to save chunks. Defaults to `<input_basename>_chunks`.

**Example:**
```bash
uv run split.py ../data/interview.wav ../data/interview.wav.segments.json ../data/interview_chunks
```

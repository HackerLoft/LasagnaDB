# Lasagna

Lasagna is a local audio storage system implemented in Go. It allows you to store `.wav` files in a simplified appended container format with a sidecar index for retrieval.

## Installation

```bash
go build -o lt main.go
```

## Usage

### Create Storage

Initialize a new storage container and index.

```bash
./lt storage create <storage_name>
```

Example:
```bash
./lt storage create my_music
# Creates my_music.ls and my_music.ls.idx
```

### 3. Add Audio
Add a `.wav` file or a directory of `.wav` files to the storage. Returns the assigned UUID(s).

```bash
lt storage add <storage_name> <wav_file_or_directory> [--parent <uuid>]
```

**Options:**
*   `--parent <uuid>`: (Optional) Specify the UUID of the parent file. If adding a directory, this parent UUID applies to all files.

**Examples:**
```bash
# Add single file
lt storage add my_music song.wav

# Add directory (bulk)
lt storage add my_music ./album_folder --parent 019b8673-4e8b...
```

### Get Audio

Retrieve an audio file by its UUID.

```bash
./lt storage get <storage_name> <UUID> <output_wav_file>
```

Example:
```bash
./lt storage get my_music 019b8566-67c7-715f-a8a4-a1191ee26e02 retrieved.wav
```

### Describe Storage

Show the number of audio files currently stored, or details about a specific file.

```bash
./lt storage describe <storage_name> [UUID] [--ancestry]
```

Example 1: Describe Storage
```bash
./lt storage describe my_music
# Output: Stored audio files: 1
```

Example 2: Describe File
```bash
./lt storage describe my_music 019b8566-67c7-715f-a8a4-a1191ee26e02
# Output:
# UUID: 019b8566-67c7-715f-a8a4-a1191ee26e02
# Length: 44100
# Offset: 44164
# Parent: None
```

Example 3: Show Ancestry
```bash
./lt storage describe my_music 019b8566... --ancestry
# Output:
# ... details ...
# --- Ancestry Tree ---
# 1. 019b8566... (Parent: ...)
# 2. ...
```

### List Storage

List all UUIDs of stored audio files.

```bash
./lt storage list <storage_name>
```

Example:
```bash
./lt storage list my_music
# Output:
# 019b8566-67c7-715f-a8a4-a1191ee26e02
# ...
```

## Storage Format

-   **Container (`.ls`)**: Sequential blocks of `[Audio Data][64-byte Footer]`.
-   **Index (`.ls.idx`)**: Text file mapping `UUID:Offset` (where Offset points to the start of the Footer).


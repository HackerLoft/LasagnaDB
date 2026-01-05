# Development Documentation

## Iteration 1 Implementation

This document describes the technical implementation of Iteration 1 for the Lasagna audio storage system.

### System Overview

Lasagna is designed as a local, append-only audio storage system. It focuses on simplicity and write performance.
The core components are:
1.  **Storage File (`.ls`)**: A monolithic binary file containing concatenated audio data.
2.  **Index File (`.ls.idx`)**: A sidecar text file mapping UUIDs to file offsets.
3.  **CLI Tool (`lt`)**: The interface for interacting with the storage.

### File Formats

#### Storage Container (`.ls`)

The storage file is a sequence of **Records**.
Each Record consists of:
1.  **Audio Data**: Raw bytes of the audio file (variable length).
2.  **Footer**: Fixed 64-byte metadata block.

**Footer Structure (64 bytes):**
-   **Bytes 0-3**: Magic Number (`0x14159265`) - Used to validate the footer.
-   **Bytes 4-11**: Audio Length (UInt64, Big Endian) - The size of the preceding audio data in bytes.
-   **Bytes 12-27**: Parent UUID (16 bytes) - The UUID of the parent file, or zeros if none.
-   **Bytes 28-63**: Padding (`0x00`) - Reserved for future use.

**Layout:**
```text
[   Audio Data 1   ][ Footer 1 ][   Audio Data 2   ][ Footer 2 ] ...
```

#### Index File (`.ls.idx`)

The index is a newline-delimited text file.
Each line represents a key-value pair:
```text
<UUID>:<Offset>
```
-   **UUID**: Version 7 UUID string.
-   **Offset**: The file offset (in bytes) pointing to the **start of the Footer** for that record.

**Why point to the Footer?**
To retrieve a file, we seek to the footer, read the length, and then seek backward to read the audio. This allows us to verify the record (Magic Number) before reading potentially large data.

### CLI Commands

#### `lt storage create <name>`
-   Creates `<name>.ls` (empty) and `<name>.ls.idx` (empty).
-   Fails if files already exist.

#### `lt storage add <name> <wav_file>`
1.  Reads the input `.wav` file into memory.
2.  Opens `<name>.ls` in append mode.
3.  Writes the raw audio bytes.
4.  Constructs and writes the 64-byte Footer.
5.  Calculates the `FooterOffset`.
6.  Generates a new UUID (v7).
7.  Appends `UUID:FooterOffset` to `<name>.ls.idx`.

#### `lt storage get <name> <UUID> <out_file>`
1.  Loads the entire index into memory (`map[string]int64`).
2.  Lookups the offset for the given UUID.
3.  Opens `<name>.ls`.
4.  Seeks to the `Offset`.
5.  Reads and validates the Footer.
6.  Calculates `DataStart = Offset - AudioLength`.
7.  Seeks to `DataStart`.
8.  Reads `AudioLength` bytes.
9.  Writes bytes to `<out_file>`.

#### `lt storage describe <name>`
-   Loads the index into memory.
-   Returns the count of entries.

#### `lt storage list <name>`
-   Loads the index into memory.
-   Prints all UUID keys.

### Limitations (Iteration 1)
-   **Memory Usage**: `Get` reads the entire file into RAM. `Index` is fully loaded into RAM.
-   **Concurrency**: No file locking. Concurrent writes will corrupt data.
-   **Atomicity**: No write-ahead logging. Crash during `add` can leave orphaned data in `.ls`.

package storage

import (
	"encoding/binary"
	"fmt"
	"io"
	"lasagna/index"
	"math"
	"os"

	"github.com/google/uuid"
)

const (
	// MagicNumber is the first 4 bytes of the footer.
	// 3.14159... -> just picking a constant for now as per spec "generated from for example Pi number"
	// integer representation of first 4 bytes of fractional part of pi: 14159265 ?
	// Let's use 0x14159265
	MagicNumber uint32 = 0x14159265
	FooterSize  int64  = 64
)

// Create initializes a new storage file.
func Create(name string) error {
	filename := name + ".ls"
	_, err := os.Stat(filename)
	if err == nil {
		return fmt.Errorf("storage already exists: %s", filename)
	}
	if !os.IsNotExist(err) {
		return err
	}

	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()
	return nil
}

// Add appends a wav file to the storage and returns the new UUID.
func Add(storageName string, wavPath string, parentUUID string) (string, error) {
	// Read wav file
	wavData, err := os.ReadFile(wavPath)
	if err != nil {
		return "", fmt.Errorf("failed to read wav file: %w", err)
	}

	storageFilename := storageName + ".ls"
	f, err := os.OpenFile(storageFilename, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		return "", fmt.Errorf("failed to open storage file: %w", err)
	}
	defer f.Close()

	// Capture current offset (start of this record's footer will be after data)
	// We need the offset of the footer start.
	// Since we are appending, we can get current size.
	// However, O_APPEND writes to end.
	// Careful: We need the offset *after* writing the wav data?
	// Spec: "UUID -> offset". Spec says: "move the offset the top of the header".
	// Implementation Plan says: Offset points to start of Footer.

	// Let's get current file size before writing.
	stat, err := f.Stat()
	if err != nil {
		return "", err
	}
	startOffset := stat.Size()

	// Write Audio
	n, err := f.Write(wavData)
	if err != nil {
		return "", fmt.Errorf("failed to write audio data: %w", err)
	}
	if n != len(wavData) {
		return "", fmt.Errorf("short write of audio data")
	}

	// Calculate Footer Offset
	footerOffset := startOffset + int64(n)

	// Create Footer
	footer := make([]byte, FooterSize)
	binary.BigEndian.PutUint32(footer[0:4], MagicNumber)
	binary.BigEndian.PutUint64(footer[4:12], uint64(len(wavData)))

	// Parent UUID handling
	if parentUUID != "" {
		parentID, err := uuid.Parse(parentUUID)
		if err != nil {
			return "", fmt.Errorf("invalid parent UUID: %w", err)
		}
		copy(footer[12:28], parentID[:])
	}
	// Rest is 0 due to make()

	// Write Footer
	if _, err := f.Write(footer); err != nil {
		return "", fmt.Errorf("failed to write footer: %w", err)
	}

	// Generate UUID
	id, err := uuid.NewV7()
	if err != nil {
		return "", fmt.Errorf("failed to generate UUID: %w", err)
	}
	idStr := id.String()

	// Update Index
	if err := index.Append(storageName, idStr, footerOffset); err != nil {
		return "", fmt.Errorf("failed to update index: %w", err)
	}

	return idStr, nil
}

// Get retrieves an audio file by UUID.
func Get(storageName, idStr, outPath string) error {
	idx, err := index.Load(storageName)
	if err != nil {
		return fmt.Errorf("failed to load index: %w", err)
	}

	offset, ok := idx[idStr]
	if !ok {
		return fmt.Errorf("UUID not found: %s", idStr)
	}

	f, err := os.Open(storageName + ".ls")
	if err != nil {
		return fmt.Errorf("failed to open storage file: %w", err)
	}
	defer f.Close()

	// Seek to footer
	if _, err := f.Seek(offset, 0); err != nil {
		return fmt.Errorf("failed to seek to footer: %w", err)
	}

	// Read Footer
	footer := make([]byte, FooterSize)
	if _, err := io.ReadFull(f, footer); err != nil {
		return fmt.Errorf("failed to read footer: %w", err)
	}

	// Validate Magic
	magic := binary.BigEndian.Uint32(footer[0:4])
	if magic != MagicNumber {
		return fmt.Errorf("invalid magic number at offset %d", offset)
	}

	// Get Length
	length := binary.BigEndian.Uint64(footer[4:12])
	if length > math.MaxInt64 {
		return fmt.Errorf("invalid length: %d", length)
	}

	// Seek back to data start
	dataStart := offset - int64(length)
	if dataStart < 0 {
		return fmt.Errorf("invalid data start calculated: %d", dataStart)
	}

	if _, err := f.Seek(dataStart, 0); err != nil {
		return fmt.Errorf("failed to seek to data start: %w", err)
	}

	// Read Data
	// For large files we might want to stream, but ReadFile used memory so writing back is fine with memory for now given "wav_file" context usually implies small-ish clips or manageable RAM.
	// Step 1 iteration allows simplicity.
	data := make([]byte, length)
	if _, err := io.ReadFull(f, data); err != nil {
		return fmt.Errorf("failed to read audio data: %w", err)
	}

	// Write to output
	if err := os.WriteFile(outPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write output file: %w", err)
	}

	return nil
}

// Describe returns the number of items in the storage.
func Describe(storageName string) (int, error) {
	idx, err := index.Load(storageName)
	if err != nil {
		return 0, err
	}
	return len(idx), nil
}

// List returns a slice of all UUIDs in the storage.
func List(storageName string) ([]string, error) {
	idx, err := index.Load(storageName)
	if err != nil {
		return nil, err
	}
	keys := make([]string, 0, len(idx))
	for k := range idx {
		keys = append(keys, k)
	}
	return keys, nil
}

// Metadata contains information about a stored file.
type Metadata struct {
	Length     uint64
	ParentUUID string
	Offset     int64
}

// GetMetadata retrieves metadata for an audio file by UUID.
func GetMetadata(storageName, idStr string) (*Metadata, error) {
	idx, err := index.Load(storageName)
	if err != nil {
		return nil, fmt.Errorf("failed to load index: %w", err)
	}

	offset, ok := idx[idStr]
	if !ok {
		return nil, fmt.Errorf("UUID not found: %s", idStr)
	}

	f, err := os.Open(storageName + ".ls")
	if err != nil {
		return nil, fmt.Errorf("failed to open storage file: %w", err)
	}
	defer f.Close()

	// Seek to footer
	if _, err := f.Seek(offset, 0); err != nil {
		return nil, fmt.Errorf("failed to seek to footer: %w", err)
	}

	// Read Footer
	footer := make([]byte, FooterSize)
	if _, err := io.ReadFull(f, footer); err != nil {
		return nil, fmt.Errorf("failed to read footer: %w", err)
	}

	// Validate Magic
	magic := binary.BigEndian.Uint32(footer[0:4])
	if magic != MagicNumber {
		return nil, fmt.Errorf("invalid magic number at offset %d", offset)
	}

	// Parse fields
	length := binary.BigEndian.Uint64(footer[4:12])

	// Parse Parent UUID (12-28)
	var parentID uuid.UUID
	copy(parentID[:], footer[12:28])

	parentUUID := ""
	if parentID != uuid.Nil {
		parentUUID = parentID.String()
	}

	return &Metadata{
		Length:     length,
		ParentUUID: parentUUID,
		Offset:     offset,
	}, nil
}

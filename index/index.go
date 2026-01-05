package index

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Index represents the in-memory map of UUIDs to offsets.
type Index map[string]int64

// Load reads the index file for the given storage name and returns an Index map.
// The index file is expected to be named <storageName>.ls.idx.
func Load(storageName string) (Index, error) {
	idxPath := storageName + ".ls.idx"
	file, err := os.Open(idxPath)
	if os.IsNotExist(err) {
		// If index file doesn't exist, return empty index
		return make(Index), nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to open index file: %w", err)
	}
	defer file.Close()

	idx := make(Index)
	scanner := bufio.NewScanner(file)
	lineNum := 0
	for scanner.Scan() {
		lineNum++
		line := scanner.Text()
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue // skip malformed lines
		}
		uuid := strings.TrimSpace(parts[0])
		offsetStr := strings.TrimSpace(parts[1])
		offset, err := strconv.ParseInt(offsetStr, 10, 64)
		if err != nil {
			return nil, fmt.Errorf("invalid offset on line %d: %w", lineNum, err)
		}
		idx[uuid] = offset
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading index file: %w", err)
	}

	return idx, nil
}

// Append adds a new entry to the index file and updates the in-memory index usually?
// Ideally this just writes to disk. The verification step says "keep this index in memory",
// but for the 'add' command we mainly just need to append to the file.
func Append(storageName string, uuid string, offset int64) error {
	idxPath := storageName + ".ls.idx"
	file, err := os.OpenFile(idxPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return fmt.Errorf("failed to open index file for writing: %w", err)
	}
	defer file.Close()

	entry := fmt.Sprintf("%s:%d\n", uuid, offset)
	if _, err := file.WriteString(entry); err != nil {
		return fmt.Errorf("failed to write to index file: %w", err)
	}
	return nil
}

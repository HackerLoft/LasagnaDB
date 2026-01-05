#!/bin/bash
set -e

# Setup
echo "Running Integration Tests..."
TEST_DIR="./tmp"
rm -rf ${TEST_DIR}
mkdir -p ${TEST_DIR}

STORAGE_NAME="${TEST_DIR}/test_integration"
# Wav files inside tmp
WAV1="${TEST_DIR}/f1.wav"
WAV2="${TEST_DIR}/f2.wav"
WAV3="${TEST_DIR}/f3.wav"

echo "Creating dummy wav files..."
echo "parent" > ${WAV1}
echo "child" > ${WAV2}
echo "grandchild" > ${WAV3}

# 1. Build
echo "[1/5] Building..."
go build -o lt main.go

# 2. Create Storage
echo "[2/5] Creating Storage..."
# Note: storage name is a path now: tmp/test_integration
./lt storage create ${STORAGE_NAME}

# 3. Add Files
echo "[3/5] Adding Files..."
# Add Parent
UUID1=$(./lt storage add ${STORAGE_NAME} ${WAV1})
echo "Added Parent: $UUID1"

# Add Child
UUID2=$(./lt storage add ${STORAGE_NAME} ${WAV2} --parent $UUID1)
echo "Added Child: $UUID2"

# Add Grandchild
UUID3=$(./lt storage add ${STORAGE_NAME} ${WAV3} --parent $UUID2)
echo "Added Grandchild: $UUID3"

# 4. Verification
echo "[4/5] Verifying..."

# List
echo "Listing UUIDs..."
./lt storage list ${STORAGE_NAME}

# Describe Ancestry
echo "Checking Ancestry for Grandchild..."
ANCESTRY_OUTPUT=$(./lt storage describe ${STORAGE_NAME} $UUID3 --ancestry)
echo "$ANCESTRY_OUTPUT"

# Simple assertions
if [[ "$ANCESTRY_OUTPUT" != *"$UUID1"* ]]; then
  echo "Error: Ancestry tree missing Grandparent UUID ($UUID1)"
  exit 1
fi
if [[ "$ANCESTRY_OUTPUT" != *"$UUID2"* ]]; then
  echo "Error: Ancestry tree missing Parent UUID ($UUID2)"
  exit 1
fi

# Bulk Add Verification
echo "Testing Bulk Add..."
BULK_STORAGE="${TEST_DIR}/test_bulk"
./lt storage create ${BULK_STORAGE}
BULK_DIR="${TEST_DIR}/bulk_wavs"
mkdir -p ${BULK_DIR}
echo "b1" > ${BULK_DIR}/b1.wav
echo "b2" > ${BULK_DIR}/b2.wav
echo "b3" > ${BULK_DIR}/b3.wav

./lt storage add ${BULK_STORAGE} ${BULK_DIR} --parent $UUID1
COUNT=$(./lt storage describe ${BULK_STORAGE} | awk '{print $4}')
if [ "$COUNT" != "3" ]; then
    echo "Error: Bulk add failed, expected 3 files, got '$COUNT'"
    exit 1
fi
echo "Bulk Add Passed: Added 3 files."

echo "[5/5] Cleanup..."
# Keep tmp for inspection if needed, or clean? "clean" target in Makefile handles it.
# Let's clean up if successful to keep things tidy, OR leave it for manual check.
# User asked "in tests, create storage files in tmp directory".
# Usually tests clean up after themselves.
rm -rf ${TEST_DIR}
rm -f lt

echo "SUCCESS: All tests passed."


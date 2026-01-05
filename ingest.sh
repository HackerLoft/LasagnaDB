#!/bin/bash
set -e

STORAGE_NAME="lasagna_demo"
PARENT_FILE="data/Lex_Fridman_Podcast-episode_475–Demis_Hassabis.wav"
CHUNKS_DIR="data/chunks_test"

echo "Building..."
go build -o lt main.go

echo "Creating storage '$STORAGE_NAME'..."
rm -f ${STORAGE_NAME}.ls ${STORAGE_NAME}.ls.idx
./lt storage create ${STORAGE_NAME}

echo "Adding Parent file..."
PARENT_UUID=$(./lt storage add ${STORAGE_NAME} "${PARENT_FILE}")
echo "Parent UUID: $PARENT_UUID"

echo "Adding Chunks from ${CHUNKS_DIR}..."
./lt storage add ${STORAGE_NAME} "${CHUNKS_DIR}" --parent $PARENT_UUID

echo "Ingestion Complete."
COUNT=$(./lt storage describe ${STORAGE_NAME})
echo "Total files stored: $COUNT"

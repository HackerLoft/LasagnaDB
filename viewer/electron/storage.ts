import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

const FOOTER_SIZE = 64;
const MAGIC_NUMBER = 0x14159265;

export interface StorageEntry {
    uuid: string;
    offset: number;
}

export interface AudioMetadata {
    length: number;
    parentUUID: string;
}

export interface AncestryItem {
    uuid: string;
    parentUUID: string;
}

export class StorageReader {
    private basePath: string;
    private name: string;
    private indexCache: Map<string, number> | null = null;
    private orderedUUIDs: string[] = [];

    constructor(storagePath: string) {
        // storagePath is full path to .ls file or just the name prefix?
        // "i.e ./lasagna_demo.ls" -> likely the full path to .ls file.
        // The CLI uses name prefix. "lt storage list <name>".
        // If user selects "./lasagna_demo.ls", we assume that's the storage file.
        // And index is "./lasagna_demo.ls.idx".

        // We'll strip extension if present to get "name" but really we just need the paths.
        if (storagePath.endsWith('.ls')) {
            this.name = storagePath.substring(0, storagePath.length - 3);
            this.basePath = storagePath;
        } else {
            this.name = storagePath;
            this.basePath = storagePath + '.ls';
        }
    }

    async loadIndex(): Promise<void> {
        const idxPath = this.basePath + '.idx';
        try {
            const content = await fs.promises.readFile(idxPath, 'utf-8');
            this.indexCache = new Map();
            this.orderedUUIDs = [];

            const lines = content.split('\n');
            for (const line of lines) {
                if (!line.trim()) continue;
                const parts = line.split(':', 2);
                if (parts.length === 2) {
                    const uuid = parts[0].trim();
                    const offset = parseInt(parts[1].trim(), 10);
                    if (!isNaN(offset)) {
                        this.indexCache.set(uuid, offset);
                        this.orderedUUIDs.push(uuid);
                    }
                }
            }
        } catch (error) {
            console.error('Failed to load index:', error);
            throw new Error(`Failed to load index file: ${idxPath}`);
        }
    }

    async listFiles(page: number, pageSize: number): Promise<{ items: string[], total: number }> {
        if (!this.indexCache) {
            await this.loadIndex();
        }

        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const items = this.orderedUUIDs.slice(start, end);

        return {
            items,
            total: this.orderedUUIDs.length
        };
    }

    async getAudio(uuid: string): Promise<Buffer> {
        if (!this.indexCache) {
            await this.loadIndex();
        }

        const offset = this.indexCache?.get(uuid);
        if (offset === undefined) {
            throw new Error(`UUID not found: ${uuid}`);
        }

        const fd = await fs.promises.open(this.basePath, 'r');
        try {
            // Read Footer
            const footerBuffer = Buffer.alloc(FOOTER_SIZE);
            await fd.read(footerBuffer, 0, FOOTER_SIZE, offset);

            const magic = footerBuffer.readUInt32BE(0);
            if (magic !== MAGIC_NUMBER) {
                throw new Error(`Invalid magic number at offset ${offset}`);
            }

            // Length is at offset 4 (8 bytes, uint64)
            // JS doesn't support uint64 precisely for all values, but audio size fits in safe integer usually.
            const lengthBigInt = footerBuffer.readBigUInt64BE(4);
            const length = Number(lengthBigInt);

            // Calculate Data Start
            const dataStart = offset - length;

            // Read Data
            const dataBuffer = Buffer.alloc(length);
            await fd.read(dataBuffer, 0, length, dataStart);

            return dataBuffer;

        } finally {
            await fd.close();
        }
    }

    async getMetadata(uuid: string): Promise<AudioMetadata> {
        if (!this.indexCache) {
            await this.loadIndex();
        }

        const offset = this.indexCache?.get(uuid);
        if (offset === undefined) {
            throw new Error(`UUID not found: ${uuid}`);
        }

        const fd = await fs.promises.open(this.basePath, 'r');
        try {
            const footerBuffer = Buffer.alloc(FOOTER_SIZE);
            await fd.read(footerBuffer, 0, FOOTER_SIZE, offset);

            const magic = footerBuffer.readUInt32BE(0);
            if (magic !== MAGIC_NUMBER) {
                throw new Error(`Invalid magic number at offset ${offset}`);
            }

            const lengthBigInt = footerBuffer.readBigUInt64BE(4);
            const length = Number(lengthBigInt);

            // Parent UUID is at offset 12 (16 bytes)
            const parentBytes = footerBuffer.subarray(12, 28);
            // Check if nil (all zeros)
            let isNil = true;
            for (let b of parentBytes) {
                if (b !== 0) { isNil = false; break; }
            }

            let parentUUID = "";
            if (!isNil) {
                // Convert to UUID string
                // 8-4-4-4-12
                const hex = parentBytes.toString('hex');
                parentUUID = `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
            }

            return { length, parentUUID };
        } finally {
            await fd.close();
        }
    }

    async getAncestry(uuid: string): Promise<AncestryItem[]> {
        const ancestry: AncestryItem[] = [];
        let currentUUID = uuid;

        // Safety limits
        const MAX_DEPTH = 100;
        let depth = 0;

        while (currentUUID && depth < MAX_DEPTH) {
            try {
                const meta = await this.getMetadata(currentUUID);
                ancestry.push({ uuid: currentUUID, parentUUID: meta.parentUUID });

                if (!meta.parentUUID) break;
                currentUUID = meta.parentUUID;
                depth++;
            } catch (e) {
                // If we can't find a parent, stop traversing
                console.warn(`Could not find ancestor ${currentUUID}`, e);
                break;
            }
        }
        return ancestry;
    }
}

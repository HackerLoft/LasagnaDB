
const fs = require('fs');
const path = require('path');

const FOOTER_SIZE = 64;
const MAGIC_NUMBER = 0x14159265;

class StorageReader {
    constructor(storagePath) {
        if (storagePath.endsWith('.ls')) {
            this.name = storagePath.substring(0, storagePath.length - 3);
            this.basePath = storagePath;
        } else {
            this.name = storagePath;
            this.basePath = storagePath + '.ls';
        }
    }

    async loadIndex() {
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
            console.log(`Loaded index with ${this.orderedUUIDs.length} items.`);
        } catch (error) {
            console.error('Failed to load index:', error);
            throw error;
        }
    }

    async getMetadata(uuid) {
        if (!this.indexCache) await this.loadIndex();

        const offset = this.indexCache.get(uuid);
        if (offset === undefined) throw new Error(`UUID not found: ${uuid}`);

        console.log(`Reading metadata for ${uuid} at offset ${offset}`);

        const fd = await fs.promises.open(this.basePath, 'r');
        try {
            const footerBuffer = Buffer.alloc(FOOTER_SIZE);
            await fd.read(footerBuffer, 0, FOOTER_SIZE, offset);

            const magic = footerBuffer.readUInt32BE(0);
            if (magic !== MAGIC_NUMBER) throw new Error(`Invalid magic number at offset ${offset}`);

            const lengthBigInt = footerBuffer.readBigUInt64BE(4);
            const length = Number(lengthBigInt);

            const parentBytes = footerBuffer.subarray(12, 28);
            let isNil = true;
            for (let b of parentBytes) {
                if (b !== 0) { isNil = false; break; }
            }

            let parentUUID = "";
            if (!isNil) {
                const hex = parentBytes.toString('hex');
                parentUUID = `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
            }

            console.log(`Length: ${length}, Parent: ${parentUUID}`);
            return { length, parentUUID };
        } finally {
            await fd.close();
        }
    }
}

async function run() {
    const reader = new StorageReader('../lasagna_demo.ls');
    await reader.loadIndex();
    const first = reader.orderedUUIDs[0];
    await reader.getMetadata(first);

    // Test random other one
    if (reader.orderedUUIDs.length > 5) {
        await reader.getMetadata(reader.orderedUUIDs[5]);
    }
}

run().catch(console.error);

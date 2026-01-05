var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { app, BrowserWindow, ipcMain } from "electron";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const FOOTER_SIZE = 64;
const MAGIC_NUMBER = 336958053;
class StorageReader {
  constructor(storagePath) {
    __publicField(this, "basePath");
    __publicField(this, "name");
    __publicField(this, "indexCache", null);
    __publicField(this, "orderedUUIDs", []);
    if (storagePath.endsWith(".ls")) {
      this.name = storagePath.substring(0, storagePath.length - 3);
      this.basePath = storagePath;
    } else {
      this.name = storagePath;
      this.basePath = storagePath + ".ls";
    }
  }
  async loadIndex() {
    const idxPath = this.basePath + ".idx";
    try {
      const content = await fs.promises.readFile(idxPath, "utf-8");
      this.indexCache = /* @__PURE__ */ new Map();
      this.orderedUUIDs = [];
      const lines = content.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        const parts = line.split(":", 2);
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
      console.error("Failed to load index:", error);
      throw new Error(`Failed to load index file: ${idxPath}`);
    }
  }
  async listFiles(page, pageSize) {
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
  async getAudio(uuid) {
    var _a;
    if (!this.indexCache) {
      await this.loadIndex();
    }
    const offset = (_a = this.indexCache) == null ? void 0 : _a.get(uuid);
    if (offset === void 0) {
      throw new Error(`UUID not found: ${uuid}`);
    }
    const fd = await fs.promises.open(this.basePath, "r");
    try {
      const footerBuffer = Buffer.alloc(FOOTER_SIZE);
      await fd.read(footerBuffer, 0, FOOTER_SIZE, offset);
      const magic = footerBuffer.readUInt32BE(0);
      if (magic !== MAGIC_NUMBER) {
        throw new Error(`Invalid magic number at offset ${offset}`);
      }
      const lengthBigInt = footerBuffer.readBigUInt64BE(4);
      const length = Number(lengthBigInt);
      const dataStart = offset - length;
      const dataBuffer = Buffer.alloc(length);
      await fd.read(dataBuffer, 0, length, dataStart);
      return dataBuffer;
    } finally {
      await fd.close();
    }
  }
  async getMetadata(uuid) {
    var _a;
    if (!this.indexCache) {
      await this.loadIndex();
    }
    const offset = (_a = this.indexCache) == null ? void 0 : _a.get(uuid);
    if (offset === void 0) {
      throw new Error(`UUID not found: ${uuid}`);
    }
    const fd = await fs.promises.open(this.basePath, "r");
    try {
      const footerBuffer = Buffer.alloc(FOOTER_SIZE);
      await fd.read(footerBuffer, 0, FOOTER_SIZE, offset);
      const magic = footerBuffer.readUInt32BE(0);
      if (magic !== MAGIC_NUMBER) {
        throw new Error(`Invalid magic number at offset ${offset}`);
      }
      const lengthBigInt = footerBuffer.readBigUInt64BE(4);
      const length = Number(lengthBigInt);
      const parentBytes = footerBuffer.subarray(12, 28);
      let isNil = true;
      for (let b of parentBytes) {
        if (b !== 0) {
          isNil = false;
          break;
        }
      }
      let parentUUID = "";
      if (!isNil) {
        const hex = parentBytes.toString("hex");
        parentUUID = `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}`;
      }
      return { length, parentUUID };
    } finally {
      await fd.close();
    }
  }
  async getAncestry(uuid) {
    const ancestry = [];
    let currentUUID = uuid;
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
        console.warn(`Could not find ancestor ${currentUUID}`, e);
        break;
      }
    }
    return ancestry;
  }
}
createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs")
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  createWindow();
  let activeStorage = null;
  ipcMain.handle("storage:open", async (_, path2) => {
    activeStorage = new StorageReader(path2);
    await activeStorage.loadIndex();
    return true;
  });
  ipcMain.handle("storage:list", async (_, page, pageSize) => {
    if (!activeStorage) throw new Error("No storage open");
    return await activeStorage.listFiles(page, pageSize);
  });
  ipcMain.handle("storage:get-audio", async (_, uuid) => {
    if (!activeStorage) throw new Error("No storage open");
    const buffer = await activeStorage.getAudio(uuid);
    return buffer;
  });
  ipcMain.handle("storage:get-ancestry", async (_, uuid) => {
    if (!activeStorage) throw new Error("No storage open");
    return await activeStorage.getAncestry(uuid);
  });
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};

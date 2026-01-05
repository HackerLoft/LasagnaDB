/// <reference types="vite/client" />

interface Window {
    ipcRenderer: {
        on(channel: string, func: (...args: any[]) => void): () => void;
        off(channel: string, func: (...args: any[]) => void): void;
        send(channel: string, ...args: any[]): void;
        invoke(channel: string, ...args: any[]): Promise<any>;
        lasagna: {
            openStorage(path: string): Promise<boolean>;
            listFiles(page: number, pageSize: number): Promise<{ items: string[], total: number }>;
            getAudio(uuid: string): Promise<Uint8Array>;
            getAncestry(uuid: string): Promise<{ uuid: string, parentUUID: string }[]>;
        }
    }
}

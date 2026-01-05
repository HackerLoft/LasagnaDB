"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("ipcRenderer", {
  on(...args) {
    const [channel, listener] = args;
    return electron.ipcRenderer.on(channel, (event, ...args2) => listener(event, ...args2));
  },
  off(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.off(channel, ...omit);
  },
  send(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.send(channel, ...omit);
  },
  invoke(...args) {
    const [channel, ...omit] = args;
    return electron.ipcRenderer.invoke(channel, ...omit);
  },
  // Lasagna Storage API
  lasagna: {
    openStorage: (path) => electron.ipcRenderer.invoke("storage:open", path),
    listFiles: (page, pageSize) => electron.ipcRenderer.invoke("storage:list", page, pageSize),
    getAudio: (uuid) => electron.ipcRenderer.invoke("storage:get-audio", uuid),
    getAncestry: (uuid) => electron.ipcRenderer.invoke("storage:get-ancestry", uuid)
  }
});

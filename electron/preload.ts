import { contextBridge, ipcRenderer, shell } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getPort: () => 3001,
  openExternal: (url: string) => shell.openExternal(url),
  getVersion: () => process.env.npm_package_version || "1.0.0",
  platform: process.platform,
});

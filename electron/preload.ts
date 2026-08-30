import { contextBridge, ipcRenderer } from 'electron';

// API expuesta al renderer de forma segura (contextIsolation).
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  updater: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install'),
    onStatus: (cb: (payload: Record<string, unknown>) => void) => {
      const listener = (_e: unknown, payload: Record<string, unknown>) => cb(payload);
      ipcRenderer.on('update:status', listener);
      return () => ipcRenderer.removeListener('update:status', listener);
    },
  },
  qz: {
    getSecurity: () => ipcRenderer.invoke('qz:get-security'),
    sign: (toSign: string) => ipcRenderer.invoke('qz:sign', toSign),
  },
});

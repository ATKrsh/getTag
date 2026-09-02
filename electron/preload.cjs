const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onWindowStateChange: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('window:state-changed', handler);
    return () => {
      ipcRenderer.removeListener('window:state-changed', handler);
    };
  },
  openVideoFiles: () => ipcRenderer.invoke('dialog:openVideoFiles'),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  scanFolders: (paths) => ipcRenderer.invoke('fs:scanFolders', paths),
  saveExport: (options) => ipcRenderer.invoke('dialog:saveExport', options),
  autoSaveTagsTxt: (content, folderPath) => ipcRenderer.invoke('fs:autoSaveTagsTxt', { content, folderPath }),
  openTagsTxt: (filePath) => ipcRenderer.invoke('fs:openTagsTxt', filePath),
  loadAutoSavedTags: () => ipcRenderer.invoke('fs:loadAutoSavedTags'),
  revealInExplorer: (filePath) => ipcRenderer.invoke('fs:reveal', filePath),
  logCrash: (info) => ipcRenderer.invoke('crash:log', info),
  isElectron: true,
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

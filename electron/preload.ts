import { contextBridge, ipcRenderer } from 'electron';

export interface FileItem {
  name: string;
  path: string;
  size: number;
}

export interface ElectronAPI {
  minimizeWindow: () => Promise<boolean>;
  maximizeWindow: () => Promise<boolean>;
  closeWindow: () => Promise<boolean>;
  isMaximized: () => Promise<boolean>;
  openVideoFiles: () => Promise<FileItem[]>;
  openFolder: () => Promise<FileItem[]>;
  scanFolders: (paths: string[]) => Promise<FileItem[]>;
  saveExport: (options: { defaultName: string; content: string }) => Promise<string | false>;
  autoSaveTagsTxt: (content: string, folderPath?: string) => Promise<{ success: boolean; filePath: string }>;
  openTagsTxt: (filePath?: string) => Promise<boolean>;
  loadAutoSavedTags: () => Promise<string>;
  revealInExplorer: (filePath: string) => Promise<boolean>;
  logCrash?: (info: string) => Promise<boolean>;
  isElectron: boolean;
}

const electronAPI: ElectronAPI = {
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  openVideoFiles: () => ipcRenderer.invoke('dialog:openVideoFiles'),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  scanFolders: (paths: string[]) => ipcRenderer.invoke('fs:scanFolders', paths),
  saveExport: (options) => ipcRenderer.invoke('dialog:saveExport', options),
  autoSaveTagsTxt: (content: string, folderPath?: string) => ipcRenderer.invoke('fs:autoSaveTagsTxt', { content, folderPath }),
  openTagsTxt: (filePath?: string) => ipcRenderer.invoke('fs:openTagsTxt', filePath),
  loadAutoSavedTags: () => ipcRenderer.invoke('fs:loadAutoSavedTags'),
  revealInExplorer: (filePath: string) => ipcRenderer.invoke('fs:reveal', filePath),
  logCrash: (info: string) => ipcRenderer.invoke('crash:log', info),
  isElectron: true,
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

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
  onWindowStateChange?: (callback: (state: { isMaximized: boolean }) => void) => () => void;
  openVideoFiles: () => Promise<FileItem[]>;
  openFolder: () => Promise<FileItem[]>;
  scanFolders: (paths: string[]) => Promise<FileItem[]>;
  saveExport: (options: { defaultName: string; content: string }) => Promise<string | false>;
  autoSaveTagsTxt: (content: string, folderPath?: string) => Promise<{ success: boolean; filePath?: string }>;
  openTagsTxt: (filePath?: string) => Promise<boolean>;
  loadAutoSavedTags: () => Promise<string | null>;
  revealInExplorer: (filePath: string) => Promise<boolean>;
  logCrash?: (info: string) => Promise<boolean>;
  isElectron?: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

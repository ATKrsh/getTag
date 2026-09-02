import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
let mainWindow: BrowserWindow | null = null;

// Force Local 'dump' Folder for Portable Mode (No C-Drive %APPDATA% pollution)
const dumpPath = isDev 
  ? path.join(__dirname, '..', 'dump') 
  : path.join(path.dirname(app.getPath('exe')), 'dump');

try {
  if (!fs.existsSync(dumpPath)) {
    fs.mkdirSync(dumpPath, { recursive: true });
  }
  app.setPath('userData', dumpPath);
} catch (err) {
  console.error('[getTag] Failed to set dump path:', err);
}

function writeCrashLog(type: string, message: string, stack?: string) {
  try {
    const logPath = path.join(dumpPath, 'crash.log');
    const timestamp = new Date().toISOString();
    const logEntry = `\n[${timestamp}] [${type}] ${message}\n${stack || ''}\n`;
    fs.appendFileSync(logPath, logEntry, 'utf8');
  } catch (err) {
    console.error('Failed to write crash log:', err);
  }
}

// Global process exception handlers to prevent any unexpected silent crashes
process.on('uncaughtException', (error) => {
  console.error('[getTag] Uncaught Exception:', error);
  writeCrashLog('MainProcess_UncaughtException', error.message, error.stack);
});

process.on('unhandledRejection', (reason) => {
  console.error('[getTag] Unhandled Rejection:', reason);
  writeCrashLog('MainProcess_UnhandledRejection', String(reason), reason instanceof Error ? reason.stack : undefined);
});

app.on('render-process-gone', (event, webContents, details) => {
  writeCrashLog('RenderProcessGone', `Reason: ${details.reason}, ExitCode: ${details.exitCode}`);
});

app.on('child-process-gone', (event, details) => {
  writeCrashLog('ChildProcessGone', `Type: ${details.type}, Reason: ${details.reason}, ExitCode: ${details.exitCode}, Name: ${details.name}`);
});

// Windows performance and stability flags
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('no-sandbox');
// 8GB RAM Allocation to prevent V8 GC Out-Of-Memory crashes on 50,000+ files
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=8192');

const SYSTEM_FILES_TO_IGNORE = new Set([
  'thumbs.db', '.ds_store', 'desktop.ini', 'folder.jpg', 'icon\r'
]);

function shouldIgnoreFile(filename: string): boolean {
  if (!filename) return true;
  const lower = filename.toLowerCase();
  return lower.startsWith('.') || SYSTEM_FILES_TO_IGNORE.has(lower);
}

async function scanDirectoryRecursive(dirPath: string): Promise<Array<{ name: string; path: string; size: number }>> {
  const results: Array<{ name: string; path: string; size: number }> = [];

  async function walk(dir: string) {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          // Skip system/hidden folders
          if (!entry.name.startsWith('.') && entry.name !== '$RECYCLE.BIN' && entry.name !== 'System Volume Information' && entry.name !== 'node_modules') {
            await walk(fullPath);
          }
        } else if (entry.isFile() && !shouldIgnoreFile(entry.name)) {
          try {
            const stat = await fs.promises.stat(fullPath);
            results.push({
              name: entry.name,
              path: fullPath,
              size: stat.size,
            });
          } catch (_) {
            results.push({
              name: entry.name,
              path: fullPath,
              size: 0,
            });
          }
        }
      }
    } catch (err) {
      console.warn(`[getTag] Failed to read dir: ${dir}`, err);
    }
  }

  try {
    await walk(dirPath);
  } catch (_) {}
  return results;
}

function getIndexHtmlPath(): string {
  const possiblePaths = [
    path.join(app.getAppPath(), 'dist', 'index.html'),
    path.join(__dirname, '..', 'dist', 'index.html'),
    path.join(__dirname, 'dist', 'index.html'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(__dirname, '..', 'dist', 'index.html');
}

function getPreloadPath(): string {
  const cjsPath = path.join(__dirname, 'preload.cjs');
  if (fs.existsSync(cjsPath)) return cjsPath;
  return path.join(__dirname, 'preload.js');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 840,
    minHeight: 580,
    frame: false,
    backgroundColor: '#05070d',
    title: 'getTag',
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5174').catch(() => {
      mainWindow?.loadFile(getIndexHtmlPath());
    });
  } else {
    mainWindow.loadFile(getIndexHtmlPath());
  }

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:state-changed', { isMaximized: true });
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:state-changed', { isMaximized: false });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupIPC() {
  ipcMain.handle('crash:log', (_event, errorInfo: string) => {
    writeCrashLog('RendererProcessError', errorInfo);
    return true;
  });

  // Window controls
  ipcMain.handle('window:minimize', () => {
    try {
      const win = mainWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      win?.minimize();
      return true;
    } catch (_) {
      return false;
    }
  });

  ipcMain.handle('window:maximize', () => {
    try {
      const win = mainWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if (win) {
        if (win.isMaximized()) {
          win.unmaximize();
          return false;
        } else {
          win.maximize();
          return true;
        }
      }
    } catch (_) {}
    return false;
  });

  ipcMain.handle('window:close', () => {
    try {
      const win = mainWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      win?.close();
      return true;
    } catch (_) {
      return false;
    }
  });

  ipcMain.handle('window:isMaximized', () => {
    try {
      const win = mainWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      return win ? win.isMaximized() : false;
    } catch (_) {
      return false;
    }
  });

  // Dialog: Select Video Files
  ipcMain.handle('dialog:openVideoFiles', async () => {
    try {
      const win = mainWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      const res = win 
        ? await dialog.showOpenDialog(win, {
            title: 'Select Video Files',
            properties: ['openFile', 'multiSelections'],
          })
        : await dialog.showOpenDialog({
            title: 'Select Video Files',
            properties: ['openFile', 'multiSelections'],
          });
      if (res.canceled || !res.filePaths || res.filePaths.length === 0) return [];
      return res.filePaths.map(filePath => ({
        name: path.basename(filePath),
        path: filePath,
        size: 0
      }));
    } catch (err) {
      console.error('[getTag] Error in dialog:openVideoFiles:', err);
      return [];
    }
  });

  // Dialog: Select Folder
  ipcMain.handle('dialog:openFolder', async () => {
    try {
      const win = mainWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      const res = win
        ? await dialog.showOpenDialog(win, {
            title: 'Select Video Folder to Scan',
            properties: ['openDirectory', 'multiSelections'],
          })
        : await dialog.showOpenDialog({
            title: 'Select Video Folder to Scan',
            properties: ['openDirectory', 'multiSelections'],
          });
      if (res.canceled || !res.filePaths || res.filePaths.length === 0) return [];
      const allResults: Array<{ name: string; path: string; size: number }> = [];
      for (const dirPath of res.filePaths) {
        const found = await scanDirectoryRecursive(dirPath);
        for (let i = 0; i < found.length; i++) {
          allResults.push(found[i]);
        }
      }
      return allResults;
    } catch (err) {
      console.error('[getTag] Error in dialog:openFolder:', err);
      return [];
    }
  });

  // Scan Specific Folder Paths or Files
  ipcMain.handle('fs:scanFolders', async (_event, folderPaths: string[]) => {
    const allResults: Array<{ name: string; path: string; size: number }> = [];
    if (!Array.isArray(folderPaths)) return allResults;
    for (const fPath of folderPaths) {
      try {
        const stats = await fs.promises.stat(fPath).catch(() => null);
        if (stats?.isDirectory()) {
          const found = await scanDirectoryRecursive(fPath);
          for (let i = 0; i < found.length; i++) {
            allResults.push(found[i]);
          }
        } else if (stats?.isFile()) {
          allResults.push({
            name: path.basename(fPath),
            path: fPath,
            size: stats.size
          });
        }
      } catch (_) {}
    }
    return allResults;
  });

  // Save Export File Dialog
  ipcMain.handle('dialog:saveExport', async (_event, { defaultName, content }: { defaultName: string; content: string }) => {
    try {
      const win = mainWindow || BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      const res = await dialog.showSaveDialog(win!, {
        title: 'Save Tag List Export',
        defaultPath: defaultName || 'tags_export.txt',
        filters: [
          { name: 'Text Document', extensions: ['txt'] },
          { name: 'JSON Document', extensions: ['json'] },
          { name: 'CSV Document', extensions: ['csv'] }
        ]
      });
      if (res.canceled || !res.filePath) return false;
      await fs.promises.writeFile(res.filePath, content || '', 'utf8');
      return res.filePath;
    } catch (err) {
      console.warn('[getTag] Error in dialog:saveExport:', err);
      return false;
    }
  });

  // Auto-Save all generated tags to tags.txt automatically
  ipcMain.handle('fs:autoSaveTagsTxt', async (_event, { content, folderPath }: { content: string; folderPath?: string }) => {
    try {
      const outputLocations = [
        path.join(process.cwd(), 'tags.txt'),
        path.join(app.getPath('userData'), 'tags.txt'),
      ];

      if (folderPath && fs.existsSync(folderPath)) {
        const stats = await fs.promises.stat(folderPath).catch(() => null);
        if (stats?.isDirectory()) {
          outputLocations.unshift(path.join(folderPath, 'tags.txt'));
        }
      }

      let primarySavedPath = outputLocations[0];
      for (const loc of outputLocations) {
        try {
          await fs.promises.writeFile(loc, content || '', 'utf8');
        } catch (_) {}
      }

      return { success: true, filePath: primarySavedPath };
    } catch (err) {
      console.error('[getTag] Auto-save tags.txt error:', err);
      return { success: false, filePath: '' };
    }
  });

  // Open tags.txt in text editor or Notepad
  ipcMain.handle('fs:openTagsTxt', async (_event, targetPath?: string) => {
    try {
      const possiblePaths = [
        targetPath,
        path.join(process.cwd(), 'tags.txt'),
        path.join(app.getPath('userData'), 'tags.txt'),
        path.join(app.getPath('documents'), 'tags.txt'),
      ].filter(Boolean) as string[];

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          const err = await shell.openPath(p);
          if (!err) return true;
          // Fallback on Windows
          const { spawn } = await import('child_process');
          spawn('notepad.exe', [p], { detached: true, stdio: 'ignore' }).unref();
          return true;
        }
      }

      // If file doesn't exist yet, create one
      const fallbackPath = path.join(process.cwd(), 'tags.txt');
      await fs.promises.writeFile(fallbackPath, '# getTag Keyword Extraction List\n', 'utf8');
      shell.openPath(fallbackPath);
      return true;
    } catch (err) {
      console.error('[getTag] Open tags.txt error:', err);
      return false;
    }
  });

  // Load auto-saved tags from tags.txt on startup
  ipcMain.handle('fs:loadAutoSavedTags', async () => {
    try {
      const possiblePaths = [
        path.join(process.cwd(), 'tags.txt'),
        path.join(app.getPath('userData'), 'tags.txt'),
      ];
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          const text = await fs.promises.readFile(p, 'utf8');
          if (text && text.trim()) return text;
        }
      }
    } catch (_) {}
    return '';
  });

  // Reveal in Windows Explorer
  ipcMain.handle('fs:reveal', async (_event, filePath: string) => {
    try {
      if (filePath && fs.existsSync(filePath)) {
        shell.showItemInFolder(filePath);
        return true;
      }
    } catch (_) {}
    return false;
  });
}

// Single Instance Lock to prevent duplicate conflicting instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    setupIPC();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

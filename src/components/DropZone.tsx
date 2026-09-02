import React, { useState, useRef } from 'react';
import { UploadCloud, FolderPlus, FileVideo, PlusCircle } from 'lucide-react';

interface DropZoneProps {
  onAddFiles: (files: Array<{ name: string; path?: string }>) => void;
  isProcessing: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onAddFiles,
  isProcessing,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [showPasteInput, setShowPasteInput] = useState(false);

  // Hidden inputs for failproof 100% environment compatibility
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles: Array<{ name: string; path?: string }> = [];

    // Native Electron / Web File Drop Handling
    if (window.electronAPI && e.dataTransfer.files.length > 0) {
      const rawPaths: string[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const f = e.dataTransfer.files[i] as any;
        if (f.path) rawPaths.push(f.path);
        else droppedFiles.push({ name: f.name });
      }

      if (rawPaths.length > 0) {
        try {
          const scanned = await window.electronAPI.scanFolders(rawPaths);
          if (scanned && scanned.length > 0) {
            onAddFiles(scanned);
            return;
          }
        } catch (_) {}
      }
    }

    // Web fallback for dropped files
    if (e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const file = e.dataTransfer.files[i];
        if (file && file.name) {
          droppedFiles.push({ name: file.name, path: (file as any).path || file.name });
        }
      }
      if (droppedFiles.length > 0) {
        onAddFiles(droppedFiles);
      }
    }
  };

  const handleSelectFilesClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (window.electronAPI?.openVideoFiles) {
      try {
        const files = await window.electronAPI.openVideoFiles();
        if (files && files.length > 0) {
          onAddFiles(files);
        }
        return; // Prevent HTML5 fallback since Electron API worked
      } catch (err) {
        console.warn('[getTag] Electron openVideoFiles fallback:', err);
      }
    }
    // Fallback: Trigger native HTML5 file selector
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleSelectFolderClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (window.electronAPI?.openFolder) {
      try {
        const files = await window.electronAPI.openFolder();
        if (files && files.length > 0) {
          onAddFiles(files);
        }
        return; // Prevent HTML5 fallback since Electron API worked
      } catch (err) {
        console.warn('[getTag] Electron openFolder fallback:', err);
      }
    }
    // Fallback: Trigger native HTML5 folder selector
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
      folderInputRef.current.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected: Array<{ name: string; path?: string }> = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const f = e.target.files[i] as any;
        if (f && f.name) {
          selected.push({
            name: f.name,
            path: f.path || f.name,
          });
        }
      }
      if (selected.length > 0) {
        onAddFiles(selected);
      }
    }
  };

  const handleManualAdd = () => {
    if (!pastedText.trim()) return;
    const lines = pastedText.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);
    const files = lines.map(name => ({ name }));
    if (files.length > 0) {
      onAddFiles(files);
    }
    setPastedText('');
    setShowPasteInput(false);
  };

  return (
    <div className="w-full app-no-drag" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      {/* Hidden File Inputs for universal fallback */}
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleFileInputChange}
        className="hidden"
      />
      <input
        type="file"
        multiple
        {...({ webkitdirectory: '', directory: '' } as any)}
        ref={folderInputRef}
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Drop Zone Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed transition-all duration-200 p-6 rounded-xl flex flex-col items-center justify-center text-center ${
          isDragging
            ? 'border-accent-neon bg-accent-neon/10 shadow-[0_0_25px_rgba(0,245,212,0.25)] scale-[1.01]'
            : 'border-white/[0.12] bg-surface-elevated/60 hover:bg-surface-elevated/90 hover:border-white/20'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent-neon mb-3 shadow-glow-cyan">
          <UploadCloud className="w-6 h-6 animate-pulse-glow" />
        </div>

        <h2 className="text-base font-semibold text-white tracking-wide mb-1">
          Drop Video Files or Folders Here
        </h2>
        <p className="text-xs font-mono text-slate-400 max-w-md mb-4 font-light">
          Drag & drop single or multiple video files (.mp4, .mkv, .webm, .avi, etc.) to instantly extract & deduplicate words.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleSelectFilesClick}
            disabled={isProcessing}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-mono font-medium rounded-lg shadow-glow-accent transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer app-no-drag"
          >
            <FileVideo className="w-4 h-4 text-accent-neon" />
            <span>Select Video Files</span>
          </button>

          <button
            type="button"
            onClick={handleSelectFolderClick}
            disabled={isProcessing}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="flex items-center gap-2 px-4 py-2 bg-surface-card hover:bg-white/10 text-slate-200 border border-white/[0.15] text-xs font-mono font-medium rounded-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50 cursor-pointer app-no-drag"
          >
            <FolderPlus className="w-4 h-4 text-accent-cyan" />
            <span>Scan Folder</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setShowPasteInput(!showPasteInput);
            }}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
            className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.04] hover:bg-white/10 text-slate-300 text-xs font-mono rounded-lg transition-colors border border-white/10 cursor-pointer app-no-drag"
          >
            <PlusCircle className="w-3.5 h-3.5 text-accent-magenta" />
            <span>{showPasteInput ? 'Hide Paste Box' : 'Paste Filenames'}</span>
          </button>
        </div>

        {/* Optional Filename Text Input / Paste Box */}
        {showPasteInput && (
          <div className="w-full max-w-xl mt-4 p-3 bg-black/60 border border-white/15 rounded-lg space-y-2 text-left animate-in fade-in app-no-drag">
            <label className="text-[11px] font-mono text-slate-300 block font-semibold flex items-center justify-between">
              <span>Paste one or multiple video filenames (one per line):</span>
              <span className="text-[10px] text-slate-500 font-normal">e.g. The.Matrix.1999.1080p.mkv</span>
            </label>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Avengers.Endgame.2019.2160p.HEVC.mp4&#10;How.To.Build.React.App.In.2026.mkv"
              rows={3}
              className="w-full bg-black/70 border border-white/10 p-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-accent-neon rounded"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPasteInput(false)}
                className="px-3 py-1 text-xs font-mono text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleManualAdd}
                disabled={!pastedText.trim()}
                className="px-4 py-1 bg-accent text-white text-xs font-mono font-medium rounded hover:bg-accent-hover disabled:opacity-40 transition-colors"
              >
                Extract Words
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

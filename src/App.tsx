import React, { useState, useEffect, useRef, useCallback, Component, ErrorInfo, ReactNode } from 'react';
import { Header } from './components/Header';
import { DropZone } from './components/DropZone';
import { ProgressBar } from './components/ProgressBar';
import { StatsBar } from './components/StatsBar';
import { TagDashboard } from './components/TagDashboard';
import { TagAccumulator, ExtractedTag, FileProcessResult } from './utils/tagExtractor';
import { AlertTriangle, RefreshCw, FileText, CheckCircle2, ExternalLink } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[getTag UI Error]:', error, errorInfo);
    if (window.electronAPI?.logCrash) {
      window.electronAPI.logCrash(`React Boundary: ${error.message}\n${error.stack}\n${errorInfo.componentStack}`);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-background flex flex-col items-center justify-center p-6 text-center font-mono">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-4 shadow-lg">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Something went wrong</h2>
          <p className="text-xs text-slate-400 max-w-md mb-6 font-light">
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem('gettag_master_list');
                localStorage.removeItem('gettag_files_processed_count');
              } catch (_) {}
              window.location.reload();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-xs rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reset & Reload App</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export const AppContent: React.FC = () => {
  // Master tag accumulator (100% case-insensitive, optimized for 50,000+ files)
  const accumulatorRef = useRef<TagAccumulator>(new TagAccumulator());
  const loadedFilesRef = useRef<Array<{ name: string; path?: string }>>([]);
  const [tags, setTags] = useState<ExtractedTag[]>([]);

  // Telemetry & Batch Processing State
  const [isProcessing, setIsProcessing] = useState(false);
  const [totalFilesProcessed, setTotalFilesProcessed] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [currentFileName, setCurrentFileName] = useState('');
  const [currentStepLabel, setCurrentStepLabel] = useState('');
  const [currentStepNumber, setCurrentStepNumber] = useState(1);
  const [lastExtractedWords, setLastExtractedWords] = useState<string[]>([]);
  const [processingTimeSec, setProcessingTimeSec] = useState(0);
  const [savedTxtPath, setSavedTxtPath] = useState<string>('');

  const isProcessingRef = useRef<boolean>(false);
  const startTimeRef = useRef<number>(0);
  const lastUiUpdateRef = useRef<number>(0);

  // Load persisted tags & auto-saved tags.txt on startup
  useEffect(() => {
    // 0. Global Window Crash Loggers
    const handleGlobalError = (e: ErrorEvent) => {
      window.electronAPI?.logCrash?.(`Window Error: ${e.message}\n${e.error?.stack}`);
    };
    const handleGlobalRejection = (e: PromiseRejectionEvent) => {
      window.electronAPI?.logCrash?.(`Unhandled Rejection: ${e.reason}`);
    };
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleGlobalRejection);

    async function loadStartupData() {
      try {
        let loadedTagsCount = 0;

        // 1. Try loading from tags.txt directly via Electron
        if (window.electronAPI?.loadAutoSavedTags) {
          const txtContent = await window.electronAPI.loadAutoSavedTags();
          if (txtContent && txtContent.trim()) {
            loadedTagsCount = accumulatorRef.current.ingestFromTxt(txtContent);
          }
        }

        // 2. Load from localStorage if available
        if (loadedTagsCount === 0) {
          const savedTags = localStorage.getItem('gettag_master_list');
          if (savedTags) {
            const parsed = JSON.parse(savedTags);
            if (Array.isArray(parsed) && parsed.length > 0) {
              accumulatorRef.current = new TagAccumulator(parsed);
            }
          }
        }

        const savedCount = localStorage.getItem('gettag_files_processed_count');
        const count = savedCount ? parseInt(savedCount, 10) : accumulatorRef.current.getProcessedFilesCount();

        setTotalFilesProcessed(Math.max(count, accumulatorRef.current.getProcessedFilesCount()));
        setTags(accumulatorRef.current.getTags('order'));
      } catch (err) {
        console.warn('[getTag] Failed to parse startup data:', err);
      }
    }
    loadStartupData();
  }, []);

  // Auto-Save all generated tags to tags.txt file automatically
  const autoSaveToTxtFile = useCallback(async (folderPath?: string) => {
    try {
      const txtContent = accumulatorRef.current.toTxtString('order');
      if (window.electronAPI?.autoSaveTagsTxt) {
        const res = await window.electronAPI.autoSaveTagsTxt(txtContent, folderPath);
        if (res.success && res.filePath) {
          setSavedTxtPath(res.filePath);
        }
      }
      
      // Also save lightweight metadata to localStorage
      const all = accumulatorRef.current.getTags('order');
      const lean = all.slice(0, 500).map(t => ({
        word: t.word,
        count: t.count,
        sources: (t.sources || []).slice(0, 5),
        firstSeenIndex: t.firstSeenIndex,
      }));
      localStorage.setItem('gettag_master_list', JSON.stringify(lean));

      const fileCount = accumulatorRef.current.getProcessedFilesCount();
      localStorage.setItem('gettag_files_processed_count', fileCount.toString());
      setTotalFilesProcessed(fileCount);
    } catch (err) {
      console.warn('[getTag] Auto-save tags.txt error:', err);
    }
  }, []);

  /**
   * High-Performance Chunked Processor: Handles 4,000+ to 50,000+ files with zero lag
   */
  const processFilesBatch = useCallback(async (files: Array<{ name: string; path?: string }>) => {
    if (!files || !Array.isArray(files) || files.length === 0 || isProcessingRef.current) return;

    loadedFilesRef.current = files;
    isProcessingRef.current = true;
    setIsProcessing(true);
    startTimeRef.current = Date.now();
    lastUiUpdateRef.current = 0;

    const count = files.length;
    setBatchTotal(count);
    setProcessedCount(0);
    setCurrentFileName('');
    setProcessingTimeSec(0);

    const timerInterval = setInterval(() => {
      if (isProcessingRef.current) {
        setProcessingTimeSec((Date.now() - startTimeRef.current) / 1000);
      }
    }, 100);

    // Micro-batch slicing for high-speed processing
    const CHUNK_SIZE = count > 1000 ? 50 : (count > 200 ? 20 : 5);
    let sampleFolderPath = '';

    try {
      for (let i = 0; i < count; i += CHUNK_SIZE) {
        const chunkEnd = Math.min(i + CHUNK_SIZE, count);

        // Process chunk synchronously in pure memory
        let lastResult: FileProcessResult | null = null;
        for (let j = i; j < chunkEnd; j++) {
          const file = files[j];
          if (!file || typeof file.name !== 'string' || !file.name.trim()) continue;
          if (!sampleFolderPath && file.path && file.path.includes('\\')) {
            sampleFolderPath = file.path.substring(0, file.path.lastIndexOf('\\'));
          }
          lastResult = accumulatorRef.current.processFile(file.name, file.path || '');
        }

        const now = Date.now();
        const shouldUpdateUi = (now - lastUiUpdateRef.current > 75) || chunkEnd === count;

        if (shouldUpdateUi && lastResult) {
          lastUiUpdateRef.current = now;
          setCurrentFileName(lastResult.fileName);
          setCurrentStepNumber(5);
          setCurrentStepLabel(`Processed ${chunkEnd} / ${count} files (Tags: ${accumulatorRef.current.getUniqueCount()})`);
          setLastExtractedWords(lastResult.extractedWords);
          setProcessedCount(chunkEnd);
          setTotalFilesProcessed(accumulatorRef.current.getProcessedFilesCount());

          // Yield to browser event loop and V8 Garbage Collector to prevent OOM crashes
          await new Promise(r => setTimeout(r, 5));
        }
      }
    } catch (err) {
      console.error('[getTag] Batch processing error:', err);
    } finally {
      clearInterval(timerInterval);
      isProcessingRef.current = false;
      setProcessingTimeSec((Date.now() - startTimeRef.current) / 1000);
      setProcessedCount(count);
      const totalCount = accumulatorRef.current.getProcessedFilesCount();
      setTotalFilesProcessed(totalCount);
      setTags(accumulatorRef.current.getTags('order'));
      setIsProcessing(false);
      setCurrentFileName('');
      setCurrentStepLabel(`All ${count} files processed successfully.`);

      // Auto-save all generated tags to tags.txt file automatically!
      setTimeout(() => autoSaveToTxtFile(sampleFolderPath), 50);
    }
  }, [autoSaveToTxtFile]);

  // Discard old data and reprocess tag generation again from scratch
  const handleDiscardAndReprocess = useCallback(() => {
    const activeFiles = [...loadedFilesRef.current];
    if (activeFiles.length === 0) return;

    // 1. Clear previous data
    accumulatorRef.current.clear();
    setTags([]);
    setTotalFilesProcessed(0);
    setBatchTotal(activeFiles.length);
    setProcessedCount(0);
    setProcessingTimeSec(0);
    setLastExtractedWords([]);
    try {
      localStorage.removeItem('gettag_master_list');
      localStorage.removeItem('gettag_files_processed_count');
    } catch (_) {}

    // 2. Reprocess all files from scratch
    setTimeout(() => {
      processFilesBatch(activeFiles);
    }, 50);
  }, [processFilesBatch]);

  const handleOpenTagsTxt = async () => {
    try {
      if (window.electronAPI?.openTagsTxt) {
        const res = await window.electronAPI.openTagsTxt(savedTxtPath || undefined);
        if (res) return;
      }
      // Browser fallback: trigger immediate direct file save/view
      const txt = accumulatorRef.current.toTxtString('order');
      const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tags.txt';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('[getTag] Error in handleOpenTagsTxt:', err);
    }
  };

  const handleRemoveTag = (word: string) => {
    accumulatorRef.current.removeTag(word);
    setTags(accumulatorRef.current.getTags('order'));
    setTimeout(() => autoSaveToTxtFile(), 50);
  };

  const handleClearAll = () => {
    accumulatorRef.current.clear();
    loadedFilesRef.current = [];
    setTags([]);
    setTotalFilesProcessed(0);
    setBatchTotal(0);
    setProcessedCount(0);
    setProcessingTimeSec(0);
    setLastExtractedWords([]);
    setSavedTxtPath('');
    try {
      localStorage.removeItem('gettag_master_list');
      localStorage.removeItem('gettag_files_processed_count');
    } catch (_) {}
    autoSaveToTxtFile();
  };

  const totalOccurrences = accumulatorRef.current.getTotalOccurrences();
  const uniqueWordsCount = accumulatorRef.current.getUniqueCount();
  const hasLoadedFiles = loadedFilesRef.current.length > 0;

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-slate-100 overflow-hidden font-sans border border-white/10 select-none">
      {/* 1. Frameless Window Header */}
      <Header
        totalFiles={totalFilesProcessed}
        uniqueTagsCount={uniqueWordsCount}
        isProcessing={isProcessing}
      />

      {/* 2. Main Content Viewport */}
      <main className="flex-1 flex flex-col p-4 gap-4 overflow-hidden min-w-0">
        {/* Top Drop & Upload Area */}
        <DropZone
          onAddFiles={processFilesBatch}
          isProcessing={isProcessing}
        />

        {/* Auto-Saved tags.txt Banner & Quick Open */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-lg text-xs font-mono">
          <div className="flex items-center gap-2 text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              All tags auto-stored in <strong>tags.txt</strong> ({uniqueWordsCount} unique keywords)
            </span>
          </div>
          <button
            type="button"
            onClick={handleOpenTagsTxt}
            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-500/40 text-emerald-200 text-[11px] rounded transition-colors cursor-pointer"
          >
            <FileText className="w-3 h-3" />
            <span>Open tags.txt</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
          </button>
        </div>

        {/* Dual Progress Bars (Overall & Per-File) */}
        <ProgressBar
          isProcessing={isProcessing}
          totalFiles={batchTotal}
          processedCount={processedCount}
          currentFileName={currentFileName}
          currentStepLabel={currentStepLabel}
          currentStepNumber={currentStepNumber}
          totalSteps={5}
          lastExtractedWords={lastExtractedWords}
        />

        {/* Stats Telemetry Bar */}
        <StatsBar
          totalFiles={totalFilesProcessed}
          uniqueWordsCount={uniqueWordsCount}
          totalOccurrences={totalOccurrences}
          processingTimeSec={processingTimeSec}
        />

        {/* Live Extracted Word Dashboard */}
        <TagDashboard
          tags={tags}
          onRemoveTag={handleRemoveTag}
          onClearAll={handleClearAll}
          onReprocessAll={handleDiscardAndReprocess}
          hasLoadedFiles={hasLoadedFiles}
        />
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
};

export default App;

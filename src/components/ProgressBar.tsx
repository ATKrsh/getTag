import React from 'react';
import { Activity, FileVideo, Sparkles, CheckCircle2, Zap } from 'lucide-react';

interface ProgressBarProps {
  isProcessing: boolean;
  totalFiles: number;
  processedCount: number;
  currentFileName?: string;
  currentStepLabel?: string;
  currentStepNumber: number;
  totalSteps: number;
  lastExtractedWords: string[];
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  isProcessing,
  totalFiles,
  processedCount,
  currentFileName,
  currentStepLabel,
  currentStepNumber,
  totalSteps = 5,
  lastExtractedWords,
}) => {
  if (!isProcessing && processedCount === 0) {
    return null;
  }

  const overallPercent = totalFiles > 0
    ? Math.min(100, Math.round((processedCount / totalFiles) * 100))
    : 0;

  const fileStepPercent = Math.min(100, Math.round((currentStepNumber / totalSteps) * 100));

  return (
    <div className="w-full bg-surface-elevated/90 border border-white/[0.12] p-4 rounded-xl space-y-3 font-mono shadow-xl backdrop-blur-xl">
      {/* 1. Overall Progress Header & Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-white font-semibold">
            {isProcessing ? (
              <Activity className="w-4 h-4 text-accent-cyan animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            )}
            <span>
              {isProcessing ? 'Batch Processing Progress' : 'Batch Extraction Complete'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-slate-400 text-[11px]">
              <strong className="text-white font-bold">{processedCount}</strong> / {totalFiles} files
            </span>
            <span className="px-2 py-0.5 bg-accent/20 border border-accent/40 text-accent-neon font-bold text-xs rounded">
              {overallPercent}%
            </span>
          </div>
        </div>

        {/* Master Progress Bar */}
        <div className="h-2 w-full bg-black/60 border border-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-accent via-accent-cyan to-accent-neon transition-all duration-200 shadow-[0_0_12px_rgba(0,240,255,0.5)]"
            style={{ width: `${overallPercent}%` }}
          />
        </div>
      </div>

      {/* 2. Active File Sub-Progress (Per-File Progress Bar) */}
      {isProcessing && currentFileName && (
        <div className="p-3 bg-black/50 border border-accent-cyan/20 rounded-lg space-y-2 text-xs animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-slate-300 min-w-0 flex-1 pr-2">
              <FileVideo className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
              <span className="text-[11px] truncate text-sky-200 font-medium">
                {currentFileName}
              </span>
            </div>
            <span className="text-[10px] text-accent-neon font-semibold flex-shrink-0">
              Step {currentStepNumber}/{totalSteps}
            </span>
          </div>

          {/* Per-File Progress Bar */}
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent-magenta to-accent-cyan transition-all duration-150"
              style={{ width: `${fileStepPercent}%` }}
            />
          </div>

          {/* Current Step Label & Real-Time Extracted Word Badges */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
            <span className="text-accent-cyan truncate">
              &bull; {currentStepLabel || 'Extracting filename and eliminating fillers...'}
            </span>

            {lastExtractedWords.length > 0 && (
              <div className="flex items-center gap-1 overflow-hidden flex-shrink-0">
                <span className="text-slate-500 text-[9px]">Words found:</span>
                {lastExtractedWords.slice(0, 3).map((w, idx) => (
                  <span key={idx} className="px-1.5 py-0.2 bg-accent/30 text-accent-neon rounded border border-accent/40 text-[9px]">
                    {w}
                  </span>
                ))}
                {lastExtractedWords.length > 3 && (
                  <span className="text-slate-400 text-[9px]">+{lastExtractedWords.length - 3}</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

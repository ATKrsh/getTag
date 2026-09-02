import React from 'react';
import { Files, Layers, Hash, FilterX, Clock } from 'lucide-react';

interface StatsBarProps {
  totalFiles: number;
  uniqueWordsCount: number;
  totalOccurrences: number;
  processingTimeSec: number;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  totalFiles,
  uniqueWordsCount,
  totalOccurrences,
  processingTimeSec,
}) => {
  const duplicatesIgnored = Math.max(0, totalOccurrences - uniqueWordsCount);
  const deduplicationRate = totalOccurrences > 0
    ? Math.round((duplicatesIgnored / totalOccurrences) * 100)
    : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
      {/* 1. Files Analyzed */}
      <div className="p-3 bg-surface-elevated/70 border border-white/[0.08] rounded-xl flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
          <Files className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-400 font-medium">Files Processed</p>
          <p className="text-base font-bold text-white">{totalFiles}</p>
        </div>
      </div>

      {/* 2. Unique Words (Master List) */}
      <div className="p-3 bg-surface-elevated/70 border border-accent-neon/30 rounded-xl flex items-center gap-3 shadow-[0_0_15px_rgba(0,245,212,0.1)]">
        <div className="w-9 h-9 rounded-lg bg-accent-neon/15 border border-accent-neon/30 flex items-center justify-center text-accent-neon">
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-400 font-medium">Unique Words</p>
          <p className="text-base font-bold text-accent-neon">{uniqueWordsCount}</p>
        </div>
      </div>

      {/* 3. Duplicates Ignored */}
      <div className="p-3 bg-surface-elevated/70 border border-white/[0.08] rounded-xl flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-accent-magenta/15 border border-accent-magenta/30 flex items-center justify-center text-accent-magenta">
          <FilterX className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-400 font-medium">Duplicates Ignored</p>
          <p className="text-base font-bold text-slate-200">
            {duplicatesIgnored} <span className="text-[10px] text-slate-500">({deduplicationRate}%)</span>
          </p>
        </div>
      </div>

      {/* 4. Processing Time */}
      <div className="p-3 bg-surface-elevated/70 border border-white/[0.08] rounded-xl flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <Clock className="w-4 h-4" />
        </div>
        <div>
          <p className="text-[10px] uppercase text-slate-400 font-medium">Processing Time</p>
          <p className="text-base font-bold text-slate-200">
            {processingTimeSec > 0 ? `${processingTimeSec.toFixed(2)}s` : '0.00s'}
          </p>
        </div>
      </div>
    </div>
  );
};

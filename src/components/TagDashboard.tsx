import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Copy, 
  Check, 
  Download, 
  Trash2, 
  Layers, 
  X, 
  FileText,
  ChevronDown,
  RotateCcw,
  Flame,
  ShieldAlert
} from 'lucide-react';
import { ExtractedTag, isNsfwWord } from '../utils/tagExtractor';

interface TagDashboardProps {
  tags: ExtractedTag[];
  onRemoveTag: (word: string) => void;
  onClearAll: () => void;
  onReprocessAll?: () => void;
  hasLoadedFiles?: boolean;
}

const PAGE_SIZE = 250;

export const TagDashboard: React.FC<TagDashboardProps> = ({
  tags,
  onRemoveTag,
  onClearAll,
  onReprocessAll,
  hasLoadedFiles = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'order' | 'alpha' | 'frequency'>('order');
  const [nsfwOnly, setNsfwOnly] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [selectedTagDetail, setSelectedTagDetail] = useState<ExtractedTag | null>(null);
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);

  // Count total NSFW tags in master dataset
  const totalNsfwCount = useMemo(() => {
    return tags.filter(t => isNsfwWord(t.word)).length;
  }, [tags]);

  // Fast Binary Sort & Filter Pipeline (with NSFW filter & Case-Insensitivity)
  const filteredTags = useMemo(() => {
    let list = [...tags];

    if (nsfwOnly) {
      list = list.filter(t => isNsfwWord(t.word));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(t => t.word && t.word.includes(q));
    }

    if (sortBy === 'alpha') {
      list.sort((a, b) => (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
    } else if (sortBy === 'frequency') {
      list.sort((a, b) => b.count - a.count || (a.word < b.word ? -1 : a.word > b.word ? 1 : 0));
    } else {
      list.sort((a, b) => a.firstSeenIndex - b.firstSeenIndex);
    }

    return list;
  }, [tags, searchQuery, sortBy, nsfwOnly]);

  const visibleTags = useMemo(() => {
    return filteredTags.slice(0, displayLimit);
  }, [filteredTags, displayLimit]);

  const handleCopyAll = async () => {
    const text = filteredTags.map(t => t.word).join(', ');
    await navigator.clipboard.writeText(text);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopySingle = async (e: React.MouseEvent, word: string) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(word);
    setCopiedTag(word);
    setTimeout(() => setCopiedTag(null), 1500);
  };

  const handleExport = async (format: 'txt' | 'json' | 'csv') => {
    let content = '';
    const prefix = nsfwOnly ? 'getTag_nsfw_' : 'getTag_list_';
    let defaultName = `${prefix}${Date.now()}.${format}`;

    if (format === 'txt') {
      content = filteredTags.map(t => t.word).join('\n');
    } else if (format === 'json') {
      content = JSON.stringify(filteredTags, null, 2);
    } else if (format === 'csv') {
      content = 'Word,OccurrenceCount,IsNSFW,SourceFiles\n' + filteredTags.map(t =>
        `"${t.word}",${t.count},${isNsfwWord(t.word) ? 'YES' : 'NO'},"${(t.sources || []).join('; ')}"`
      ).join('\n');
    }

    if (window.electronAPI?.saveExport) {
      await window.electronAPI.saveExport({ defaultName, content });
    } else {
      // Browser blob download fallback
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = defaultName;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-surface border border-white/[0.1] rounded-xl overflow-hidden shadow-2xl font-mono min-h-0">
      {/* 1. Dashboard Controls Bar */}
      <div className="p-3 bg-surface-elevated border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
        {/* Left: Search Bar & Count */}
        <div className="flex items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex items-center bg-black/50 border border-white/[0.12] rounded-lg px-2.5 h-8 flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setDisplayLimit(PAGE_SIZE);
              }}
              placeholder="Search words (case-insensitive)..."
              className="w-full bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <span className="text-xs text-slate-400 hidden sm:inline">
            Showing <strong className="text-accent-neon">{filteredTags.length}</strong> unique words
          </span>
        </div>

        {/* Right: NSFW Button, Reprocess Button, Sort & Actions */}
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          {/* 🔞 NSFW Filter Button */}
          <button
            type="button"
            onClick={() => {
              setNsfwOnly(!nsfwOnly);
              setDisplayLimit(PAGE_SIZE);
            }}
            className={`flex items-center gap-1.5 px-3 h-8 text-xs font-bold rounded-lg border transition-all cursor-pointer shadow-sm ${
              nsfwOnly
                ? 'bg-gradient-to-r from-rose-600 to-pink-600 border-rose-400 text-white shadow-glow-rose ring-1 ring-rose-400'
                : 'bg-rose-950/30 hover:bg-rose-900/40 border-rose-500/30 text-rose-300 hover:text-white'
            }`}
            title="Filter out only Adult, Porn & NSFW keywords"
          >
            <Flame className={`w-3.5 h-3.5 ${nsfwOnly ? 'animate-bounce text-yellow-300' : 'text-rose-400'}`} />
            <span>NSFW</span>
            {totalNsfwCount > 0 && (
              <span className={`px-1.5 py-0.2 text-[10px] rounded-full font-extrabold ${
                nsfwOnly ? 'bg-black/40 text-yellow-300' : 'bg-rose-500/30 text-rose-200'
              }`}>
                {totalNsfwCount}
              </span>
            )}
          </button>

          {/* Destroy Data & Reprocess Button */}
          {onReprocessAll && hasLoadedFiles && (
            <button
              type="button"
              onClick={onReprocessAll}
              className="flex items-center gap-1.5 px-3 h-8 bg-accent-magenta/20 hover:bg-accent-magenta/35 border border-accent-magenta/50 text-accent-magenta text-xs font-semibold rounded transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-glow-magenta"
              title="Destroy local cached data and force app to reprocess all files from scratch"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Destroy Data & Force Reprocess</span>
            </button>
          )}

          {/* Sort Selector */}
          <div className="flex items-center bg-black/50 p-0.5 border border-white/[0.1] rounded text-xs">
            <button
              type="button"
              onClick={() => setSortBy('order')}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                sortBy === 'order' ? 'bg-accent text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
              title="Sort by order added"
            >
              Order
            </button>
            <button
              type="button"
              onClick={() => setSortBy('alpha')}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                sortBy === 'alpha' ? 'bg-accent text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
              title="Sort Alphabetically A-Z"
            >
              A-Z
            </button>
            <button
              type="button"
              onClick={() => setSortBy('frequency')}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                sortBy === 'frequency' ? 'bg-accent text-white font-semibold' : 'text-slate-400 hover:text-white'
              }`}
              title="Sort by most frequent occurrences"
            >
              Top Freq
            </button>
          </div>

          {/* Copy All */}
          <button
            type="button"
            onClick={handleCopyAll}
            disabled={filteredTags.length === 0}
            className="flex items-center gap-1 px-3 h-8 bg-surface-card hover:bg-white/10 border border-white/15 text-xs text-slate-200 rounded transition-all disabled:opacity-40 cursor-pointer"
            title="Copy all visible words as comma-separated text"
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-accent-cyan" />}
            <span className="text-[11px]">{copiedAll ? 'Copied!' : 'Copy All'}</span>
          </button>

          {/* Export Dropdown / Buttons */}
          <div className="flex items-center bg-surface-card border border-white/15 rounded overflow-hidden h-8">
            <button
              type="button"
              onClick={() => handleExport('txt')}
              disabled={filteredTags.length === 0}
              className="px-2.5 h-full text-xs text-slate-300 hover:text-white hover:bg-white/10 border-r border-white/10 disabled:opacity-40 cursor-pointer"
              title="Export as clean TXT list"
            >
              TXT
            </button>
            <button
              type="button"
              onClick={() => handleExport('json')}
              disabled={filteredTags.length === 0}
              className="px-2.5 h-full text-xs text-slate-300 hover:text-white hover:bg-white/10 border-r border-white/10 disabled:opacity-40 cursor-pointer"
              title="Export as JSON"
            >
              JSON
            </button>
            <button
              type="button"
              onClick={() => handleExport('csv')}
              disabled={filteredTags.length === 0}
              className="px-2.5 h-full text-xs text-slate-300 hover:text-white hover:bg-white/10 disabled:opacity-40 cursor-pointer"
              title="Export as CSV with file sources"
            >
              CSV
            </button>
          </div>

          {/* Clear Master List */}
          <button
            type="button"
            onClick={onClearAll}
            disabled={tags.length === 0}
            className="p-1.5 h-8 w-8 flex items-center justify-center bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 text-red-300 rounded transition-colors disabled:opacity-40 cursor-pointer"
            title="Clear all extracted tags"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Tag Pill Grid View (Virtualized Chunk Rendering) */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {filteredTags.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mb-3 shadow-inner ${
              nsfwOnly ? 'bg-rose-950/40 border-rose-500/30 text-rose-400' : 'bg-surface-elevated border-white/10 text-slate-400'
            }`}>
              {nsfwOnly ? <Flame className="w-7 h-7" /> : <Layers className="w-7 h-7" />}
            </div>
            <h3 className="text-sm font-semibold text-white mb-1">
              {nsfwOnly
                ? 'No adult / NSFW keywords detected in loaded files'
                : (tags.length === 0 ? 'No words extracted yet' : 'No matching words found')}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm">
              {nsfwOnly
                ? 'All extracted words appear safe. Toggle off NSFW filter to view all keywords.'
                : (tags.length === 0 ? 'Drop video files or select a folder above to start extracting clean keywords.' : 'Try adjusting your search query.')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 content-start">
              {visibleTags.map((tag) => {
                const isCopied = copiedTag === tag.word;
                const isAdult = isNsfwWord(tag.word);
                return (
                  <div
                    key={tag.word}
                    onClick={() => setSelectedTagDetail(tag)}
                    className={`tag-pill group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer shadow-sm border transition-all ${
                      isAdult
                        ? 'bg-rose-950/40 hover:bg-rose-900/60 border-rose-500/40 hover:border-rose-400 text-rose-200'
                        : 'bg-surface-elevated/90 hover:bg-surface-card border-white/[0.1] hover:border-accent-cyan/60 text-slate-200'
                    }`}
                  >
                    {isAdult && (
                      <Flame className="w-3 h-3 text-rose-400 flex-shrink-0" />
                    )}

                    <span className={`font-medium transition-colors ${
                      isAdult ? 'group-hover:text-rose-300' : 'group-hover:text-accent-neon'
                    }`}>
                      {tag.word}
                    </span>

                    {/* Frequency badge if found in multiple files */}
                    {tag.count > 1 && (
                      <span className={`px-1.5 py-0.2 text-[10px] rounded font-bold border ${
                        isAdult 
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-300' 
                          : 'bg-accent/25 border border-accent/40 text-accent-cyan'
                      }`}>
                        {tag.count}x
                      </span>
                    )}

                    {/* Quick Copy button */}
                    <button
                      type="button"
                      onClick={(e) => handleCopySingle(e, tag.word)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-accent-neon transition-opacity"
                      title="Copy word to clipboard"
                    >
                      {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveTag(tag.word);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-red-400 transition-opacity"
                      title="Remove from list"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Load More Button for large datasets */}
            {filteredTags.length > displayLimit && (
              <div className="flex justify-center pt-2 pb-4">
                <button
                  type="button"
                  onClick={() => setDisplayLimit(prev => prev + PAGE_SIZE)}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-elevated hover:bg-surface-card border border-white/15 text-xs text-accent-neon rounded-lg transition-colors cursor-pointer"
                >
                  <ChevronDown className="w-4 h-4" />
                  <span>Show More ({filteredTags.length - displayLimit} remaining)</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Bottom Detail Drawer */}
      {selectedTagDetail && (
        <div className="p-3 bg-black/95 border-t border-accent-cyan/30 flex items-center justify-between text-xs animate-in slide-in-from-bottom-2 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 pr-3">
            <span className={`px-2 py-0.5 font-bold rounded flex items-center gap-1 ${
              isNsfwWord(selectedTagDetail.word)
                ? 'bg-rose-600 text-white'
                : 'bg-accent text-white'
            }`}>
              {isNsfwWord(selectedTagDetail.word) && <Flame className="w-3 h-3" />}
              {selectedTagDetail.word}
            </span>
            <span className="text-slate-400 text-[11px] truncate">
              Found in <strong className="text-white">{selectedTagDetail.count}</strong> file(s):{' '}
              <span className="text-slate-300">{(selectedTagDetail.sources || []).join(', ')}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(selectedTagDetail.word);
                setSelectedTagDetail(null);
              }}
              className="px-2.5 py-1 bg-accent/20 hover:bg-accent/40 border border-accent/40 text-accent-neon rounded text-[11px] cursor-pointer"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => setSelectedTagDetail(null)}
              className="p-1 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

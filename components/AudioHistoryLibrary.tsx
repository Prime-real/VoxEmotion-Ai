'use client';

import React, { useState, useMemo } from 'react';
import { AudioTrackMetadata } from './AudioWorkstationPlayer';
import {
  History,
  Play,
  Download,
  Trash2,
  Clock,
  FileAudio,
  Zap,
  Loader2,
  Check,
} from 'lucide-react';
import {
  AutoDownloadConfig,
  triggerAudioDownload,
} from '@/lib/audio-storage';

interface AudioHistoryLibraryProps {
  currentTrack: AudioTrackMetadata | null;
  history: AudioTrackMetadata[];
  onSelectTrack: (track: AudioTrackMetadata) => void;
  onDeleteTrack: (timestamp?: number) => void;
  onClearHistory: () => void;
  autoDownloadConfig?: AutoDownloadConfig;
  onUpdateAutoDownloadConfig?: (config: AutoDownloadConfig) => void;
}

export default function AudioHistoryLibrary({
  currentTrack,
  history,
  onSelectTrack,
  onDeleteTrack,
  onClearHistory,
  autoDownloadConfig,
  onUpdateAutoDownloadConfig,
}: AudioHistoryLibraryProps) {
  const [filterLang, setFilterLang] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isBatchExporting, setIsBatchExporting] = useState(false);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);

  // Optimized memoized filtered tracks and languages
  const uniqueLanguages = useMemo(() => {
    return Array.from(new Set(history.map((h) => h.language))).filter(Boolean);
  }, [history]);

  const filteredTracks = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return history.filter((item) => {
      const matchesLang =
        filterLang === 'All' ||
        item.language.toLowerCase() === filterLang.toLowerCase();
      if (!matchesLang) return false;
      if (!q) return true;
      return (
        (item.textSnippet && item.textSnippet.toLowerCase().includes(q)) ||
        item.voice.toLowerCase().includes(q) ||
        (item.style && item.style.toLowerCase().includes(q))
      );
    });
  }, [history, filterLang, searchQuery]);

  const handleDownloadTrack = async (track: AudioTrackMetadata) => {
    try {
      await triggerAudioDownload(
        track,
        autoDownloadConfig?.format || 'wav',
        autoDownloadConfig?.bitrate || '192k'
      );
    } catch (e) {
      console.error(e);
    }
  };

  // Bulk download all tracks in filtered list with staggered timers
  const handleBatchDownloadAll = async () => {
    if (filteredTracks.length === 0 || isBatchExporting) return;
    setIsBatchExporting(true);
    setBatchNotice(`Starting batch export of ${filteredTracks.length} voices...`);

    const format = autoDownloadConfig?.format || 'wav';
    const bitrate = autoDownloadConfig?.bitrate || '192k';

    let successCount = 0;
    for (let i = 0; i < filteredTracks.length; i++) {
      const track = filteredTracks[i];
      setBatchNotice(`Exporting (${i + 1}/${filteredTracks.length}): ${track.voice}...`);
      try {
        await triggerAudioDownload(track, format, bitrate);
        successCount++;
        // Short pause between browser file downloads
        if (i < filteredTracks.length - 1) {
          await new Promise((r) => setTimeout(r, 400));
        }
      } catch (err) {
        console.error('Batch export item error:', err);
      }
    }

    setBatchNotice(`Successfully exported ${successCount} of ${filteredTracks.length} voices!`);
    setIsBatchExporting(false);
    setTimeout(() => setBatchNotice(null), 3500);
  };

  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center backdrop-blur-xl">
        <FileAudio className="mx-auto h-8 w-8 text-slate-600" />
        <h4 className="mt-2 text-sm font-semibold text-slate-300">
          Audio Library Empty
        </h4>
        <p className="mt-1 text-xs text-slate-500">
          Every synthesized voice track will automatically appear here for
          instant replay and WAV export.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3 mb-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">
            Audio Studio Library ({history.length})
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Instant Search Bar */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search script, voice..."
            className="rounded-lg border border-slate-700 bg-slate-800/90 px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-32 sm:w-40"
          />

          {/* Language filter */}
          {uniqueLanguages.length > 1 && (
            <select
              value={filterLang}
              onChange={(e) => setFilterLang(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="All">All Languages</option>
              {uniqueLanguages.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          )}

          {/* Bulk Download / Export All Button */}
          <button
            onClick={handleBatchDownloadAll}
            disabled={isBatchExporting || filteredTracks.length === 0}
            title={`Export all ${filteredTracks.length} voices in ${
              autoDownloadConfig?.format.toUpperCase() || 'WAV'
            } format`}
            className="flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-950/50 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:bg-indigo-900/60 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
          >
            {isBatchExporting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            <span>Download All Voiceovers ({filteredTracks.length})</span>
          </button>

          {/* Auto-download status badge */}
          {autoDownloadConfig?.enabled && (
            <span className="hidden md:inline-flex items-center gap-1 rounded bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 text-[10px] text-cyan-300 font-mono">
              <Zap className="h-2.5 w-2.5 fill-cyan-400" />
              Auto-DL {autoDownloadConfig.format.toUpperCase()}
            </span>
          )}

          <button
            onClick={() => {
              if (confirm('Clear all saved audio history?')) {
                onClearHistory();
              }
            }}
            className="text-xs text-slate-500 hover:text-rose-400 transition-colors cursor-pointer ml-1"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* Batch notice toast */}
      {batchNotice && (
        <div className="mb-3 rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-3 py-1.5 text-xs text-cyan-200 flex items-center justify-between">
          <span>{batchNotice}</span>
          {isBatchExporting && <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />}
        </div>
      )}

      {/* Track list */}
      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
        {filteredTracks.map((item, index) => {
          const isCurrent =
            currentTrack?.timestamp &&
            currentTrack.timestamp === item.timestamp;
          const formattedDate = item.timestamp
            ? new Date(item.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '';

          return (
            <div
              key={item.timestamp || index}
              className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition-all ${
                isCurrent
                  ? 'border-indigo-500/50 bg-indigo-950/30 ring-1 ring-indigo-400/30'
                  : 'border-slate-800/80 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  onClick={() => onSelectTrack(item)}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg shadow transition-transform hover:scale-105 cursor-pointer ${
                    isCurrent
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-indigo-600 text-white'
                  }`}
                  title="Play in workstation"
                >
                  <Play className="h-4 w-4 fill-current ml-0.5" />
                </button>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-xs text-white truncate">
                      {item.voice}
                    </span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[10px] text-indigo-300 font-mono">
                      {item.language}
                    </span>
                    {formattedDate && (
                      <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {formattedDate}
                      </span>
                    )}
                  </div>
                  {item.textSnippet && (
                    <p className="mt-0.5 text-xs text-slate-400 truncate">
                      &ldquo;{item.textSnippet}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleDownloadTrack(item)}
                  title="Download Voiceover file"
                  className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-800/90 hover:bg-emerald-600 hover:border-emerald-500 px-2.5 py-1 text-xs font-medium text-slate-200 hover:text-white transition-all cursor-pointer shadow-sm"
                >
                  <Download className="h-3.5 w-3.5 text-emerald-400 group-hover:text-white" />
                  <span className="hidden sm:inline">Download Voiceover</span>
                </button>
                <button
                  onClick={() => onDeleteTrack(item.timestamp)}
                  title="Delete from history"
                  className="rounded-lg p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

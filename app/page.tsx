'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Users,
  History,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Film,
  Dna,
  Download,
  Zap,
  Sparkles,
  ChevronRight,
  X,
  CheckCircle2,
  Radio,
  Sliders,
  PanelLeft,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import SoloVoiceStudio from '@/components/SoloVoiceStudio';
import DialogueVoiceStudio from '@/components/DialogueVoiceStudio';
import AudioHistoryLibrary from '@/components/AudioHistoryLibrary';
import VoiceCloningStudio from '@/components/VoiceCloningStudio';
import VideoDubbingStudio from '@/components/VideoDubbingStudio';
import { AudioTrackMetadata } from '@/components/AudioWorkstationPlayer';
import { VOICES, VoiceOption } from '@/lib/tts-constants';
import {
  dbSaveTrack,
  dbGetTracks,
  dbDeleteTrack,
  dbClearTracks,
  dbSaveClonedVoice,
  dbGetClonedVoices,
  dbDeleteClonedVoice,
  AutoDownloadConfig,
  getAutoDownloadConfig,
  saveAutoDownloadConfig,
  triggerAudioDownload,
} from '@/lib/audio-storage';

export type TabType = 'videodub' | 'solo' | 'dialogue' | 'cloning' | 'library';

export default function HomePage() {
  // Always active single feature view
  const [activeTab, setActiveTab] = useState<TabType>('videodub');

  // Open / Close Left Sidebar panel state
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem('vox_sidebar_open');
      if (saved !== null) return saved === 'true';
    } catch {}
    return true;
  });

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('vox_sidebar_open', String(next));
      } catch {}
      return next;
    });
  };

  // Currently playing track & mini-player state
  const [activePlaybackTrack, setActivePlaybackTrack] =
    useState<AudioTrackMetadata | null>(null);
  const [isPlayingMiniPlayer, setIsPlayingMiniPlayer] = useState(false);
  const [miniPlayerTime, setMiniPlayerTime] = useState(0);
  const [miniPlayerDuration, setMiniPlayerDuration] = useState(0);
  const [miniPlayerVolume, setMiniPlayerVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const miniAudioRef = useRef<HTMLAudioElement | null>(null);

  // Audio history state (IndexedDB backed)
  const [history, setHistory] = useState<AudioTrackMetadata[]>([]);

  // Cloned voices state (IndexedDB backed)
  const [clonedVoices, setClonedVoices] = useState<VoiceOption[]>([]);
  const [activeVoiceOverride, setActiveVoiceOverride] =
    useState<VoiceOption | null>(null);

  // Auto-Download config
  const [autoDownloadConfig, setAutoDownloadConfig] = useState<AutoDownloadConfig>(
    () => getAutoDownloadConfig()
  );
  const [autoDownloadNotice, setAutoDownloadNotice] = useState<string | null>(null);

  // Sidebar voice audition preview
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewVoiceId, setPreviewVoiceId] = useState<string | null>(null);

  // Load persistence on startup
  useEffect(() => {
    dbGetTracks().then((tracks) => {
      if (tracks.length > 0) {
        setHistory(tracks);
      }
    });

    dbGetClonedVoices().then((voices) => {
      if (voices.length > 0) {
        setClonedVoices(voices);
      }
    });
  }, []);

  const handleUpdateAutoDownloadConfig = (config: AutoDownloadConfig) => {
    setAutoDownloadConfig(config);
    saveAutoDownloadConfig(config);
  };

  const handleAudioGenerated = async (track: AudioTrackMetadata) => {
    setHistory((prev) => {
      const filtered = prev.filter((t) => t.timestamp !== track.timestamp);
      return [track, ...filtered];
    });
    dbSaveTrack(track);

    // Auto-download if enabled
    if (autoDownloadConfig.enabled && track.audioBase64) {
      try {
        const savedFilename = await triggerAudioDownload(
          track,
          autoDownloadConfig.format,
          autoDownloadConfig.bitrate
        );
        setAutoDownloadNotice(`⬇ Downloaded: ${savedFilename}`);
        setTimeout(() => setAutoDownloadNotice(null), 4000);
      } catch (err: any) {
        console.error('Auto download failed:', err);
      }
    }
  };

  const handleSaveClonedVoice = (voice: VoiceOption) => {
    setClonedVoices((prev) => [voice, ...prev.filter((v) => v.id !== voice.id)]);
    dbSaveClonedVoice(voice);
  };

  const handleDeleteClonedVoice = (id: string) => {
    setClonedVoices((prev) => prev.filter((v) => v.id !== id));
    dbDeleteClonedVoice(id);
  };

  const handleSelectClonedVoiceForStudio = (voice: VoiceOption) => {
    setActiveVoiceOverride(voice);
    setActiveTab('solo');
  };

  const handleDeleteHistoryTrack = (timestamp?: number) => {
    if (!timestamp) return;
    setHistory((prev) => prev.filter((t) => t.timestamp !== timestamp));
    dbDeleteTrack(timestamp);
    if (activePlaybackTrack?.timestamp === timestamp) {
      handleCloseMiniPlayer();
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    dbClearTracks();
    handleCloseMiniPlayer();
  };

  // Play track in bottom mini-player
  const handlePlayTrack = (track: AudioTrackMetadata) => {
    if (!track.audioBase64) return;
    setActivePlaybackTrack(track);
    setIsPlayingMiniPlayer(true);

    if (miniAudioRef.current) {
      miniAudioRef.current.src = `data:${track.mimeType || 'audio/wav'};base64,${track.audioBase64}`;
      miniAudioRef.current.play().catch(console.error);
    }
  };

  const handleToggleMiniPlay = () => {
    if (!miniAudioRef.current) return;
    if (isPlayingMiniPlayer) {
      miniAudioRef.current.pause();
      setIsPlayingMiniPlayer(false);
    } else {
      miniAudioRef.current.play().catch(console.error);
      setIsPlayingMiniPlayer(true);
    }
  };

  const handleCloseMiniPlayer = () => {
    if (miniAudioRef.current) {
      miniAudioRef.current.pause();
    }
    setIsPlayingMiniPlayer(false);
    setActivePlaybackTrack(null);
  };

  // Sidebar Voice Audition Preview
  const handleAuditionSidebarVoice = async (voice: VoiceOption) => {
    if (isPlayingPreview && previewAudio && previewVoiceId === voice.id) {
      previewAudio.pause();
      setIsPlayingPreview(false);
      setPreviewVoiceId(null);
      return;
    }

    if (previewAudio) {
      previewAudio.pause();
    }

    try {
      setPreviewVoiceId(voice.id);
      setIsPlayingPreview(true);
      const res = await fetch('/api/tts/preview-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: voice.id,
          baseVoice: voice.baseVoice || voice.id,
          style: voice.sampleEmotion,
          personaPrompt: voice.personaPrompt || '',
          auditionQuote: voice.auditionQuote,
        }),
      });

      const data = await res.json();
      if (data.audioBase64) {
        const audio = new Audio(
          `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`
        );
        setPreviewAudio(audio);
        audio.onended = () => {
          setIsPlayingPreview(false);
          setPreviewVoiceId(null);
        };
        audio.onerror = () => {
          setIsPlayingPreview(false);
          setPreviewVoiceId(null);
        };
        audio.play();
      } else {
        setIsPlayingPreview(false);
        setPreviewVoiceId(null);
      }
    } catch (err) {
      console.error('Sidebar voice audition error:', err);
      setIsPlayingPreview(false);
      setPreviewVoiceId(null);
    }
  };

  const featuredVoice = VOICES[0]; // Kore

  const navItems: {
    id: TabType;
    label: string;
    sublabel: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    badge?: string;
  }[] = [
    {
      id: 'videodub',
      label: 'AI Video Dubber',
      sublabel: 'Dub, translate & extract scripts',
      icon: Film,
      accentColor: 'text-cyan-400 group-hover:text-cyan-300',
      badge: 'Flagship',
    },
    {
      id: 'solo',
      label: 'Solo Voiceover',
      sublabel: 'Neural TTS & emotion inflections',
      icon: Mic,
      accentColor: 'text-indigo-400 group-hover:text-indigo-300',
      badge: '30+ Lang',
    },
    {
      id: 'dialogue',
      label: 'Dialogue Studio',
      sublabel: 'Multi-character scenes & podcasts',
      icon: Users,
      accentColor: 'text-violet-400 group-hover:text-violet-300',
    },
    {
      id: 'cloning',
      label: 'Voice Cloning',
      sublabel: 'Calibrate acoustic personas',
      icon: Dna,
      accentColor: 'text-fuchsia-400 group-hover:text-fuchsia-300',
      badge: clonedVoices.length > 0 ? `${clonedVoices.length}` : undefined,
    },
    {
      id: 'library',
      label: 'Audio Library',
      sublabel: 'Saved clips & batch export',
      icon: History,
      accentColor: 'text-emerald-400 group-hover:text-emerald-300',
      badge: history.length > 0 ? `${history.length}` : undefined,
    },
  ];

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#08090d] text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-white">
      {/* Mobile Backdrop Overlay when sidebar is open */}
      {isSidebarOpen && (
        <div
          onClick={toggleSidebar}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-25 lg:hidden"
        />
      )}

      {/* ============================================================ */}
      {/* LEFT SIDEBAR PANEL (With Open/Close Toggle Icon) */}
      {/* ============================================================ */}
      {isSidebarOpen && (
        <aside className="w-full lg:w-72 xl:w-80 shrink-0 border-b lg:border-b-0 lg:border-r border-white/[0.08] bg-[#090b11] lg:h-screen lg:sticky lg:top-0 flex flex-col justify-between z-30 transition-all duration-300 ease-in-out">
          <div className="p-4 sm:p-5 space-y-5 overflow-y-auto">
            {/* Brand Header with Close Icon */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-white/20">
                  <Volume2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-base font-bold tracking-tight text-white truncate">
                      VoxEmotion AI
                    </h1>
                    <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <p className="text-[11px] font-mono text-slate-400 truncate">
                    Gemini 3.8 Speech Engine
                  </p>
                </div>
              </div>

              {/* Close Sidebar Icon Button */}
              <button
                onClick={toggleSidebar}
                title="Close sidebar panel"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] border border-white/[0.06] transition-colors cursor-pointer"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

          {/* Navigation Menu (Single Feature Focus) */}
          <nav aria-label="Main features" className="space-y-1.5 pt-1">
            <div className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Studio Features
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`group relative flex items-center justify-between w-full rounded-xl px-3 py-2.5 text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600/30 via-indigo-600/20 to-transparent border border-indigo-500/50 text-white shadow-md shadow-indigo-950/50'
                      : 'text-slate-300 hover:bg-white/[0.04] hover:text-white border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-900 border border-white/[0.06] text-slate-400 group-hover:text-slate-200'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold leading-tight truncate">
                        {item.label}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                        {item.sublabel}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pl-2">
                    {item.badge && (
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase tracking-wider ${
                          isActive
                            ? 'bg-indigo-500/40 text-indigo-200 border border-indigo-400/40'
                            : 'bg-white/[0.05] text-slate-400 border border-white/[0.05]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                    {isActive && (
                      <ChevronRight className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                    )}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Quick Voice Cast Showcase */}
          <div className="rounded-xl border border-white/[0.07] bg-slate-900/40 p-3 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1">
                <Radio className="h-3 w-3 text-indigo-400" />
                <span>Featured Voice</span>
              </span>
              <span className="text-[10px] text-slate-400">
                {featuredVoice.gender} • {featuredVoice.tone}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 font-bold text-xs border border-indigo-500/30">
                  {featuredVoice.name.slice(0, 1)}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">
                    {featuredVoice.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    Warm, articulate, natural cadence
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleAuditionSidebarVoice(featuredVoice)}
                title="Audition featured voice"
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors cursor-pointer ${
                  isPlayingPreview && previewVoiceId === featuredVoice.id
                    ? 'bg-indigo-600 text-white animate-pulse'
                    : 'bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white'
                }`}
              >
                {isPlayingPreview && previewVoiceId === featuredVoice.id ? (
                  <Pause className="h-3 w-3" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
              </button>
            </div>
          </div>

          {/* Quick Recent Generations */}
          {history.length > 0 && (
            <div className="rounded-xl border border-white/[0.07] bg-slate-900/40 p-3 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <span className="flex items-center gap-1">
                  <History className="h-3 w-3 text-cyan-400" />
                  <span>Recent Audio</span>
                </span>
                <button
                  onClick={() => setActiveTab('library')}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
                >
                  All ({history.length}) →
                </button>
              </div>

              <div className="space-y-1.5">
                {history.slice(0, 2).map((item) => (
                  <div
                    key={item.timestamp}
                    onClick={() => handlePlayTrack(item)}
                    className="group flex items-center justify-between rounded-lg p-2 text-left transition-all border border-transparent hover:border-white/[0.08] hover:bg-white/[0.03] cursor-pointer"
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="text-xs font-medium text-white truncate">
                        {item.voice} • {item.language || 'English'}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {item.textSnippet}
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerAudioDownload(item, 'mp3', '192k');
                      }}
                      title="Download MP3"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-800 text-slate-300 hover:bg-indigo-600 hover:text-white transition-colors"
                    >
                      <Download className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Footer info */}
        <div className="p-4 border-t border-white/[0.06] bg-[#07080c]/60 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span>Studio Engine Active</span>
          </span>
          <span className="font-mono text-[10px] text-slate-600">v3.8-Flash</span>
        </div>
      </aside>
      )}

      {/* ============================================================ */}
      {/* MAIN DEDICATED WORKSPACE (SINGLE FEATURE FOCUS) */}
      {/* ============================================================ */}
      <main className="flex-1 min-w-0 bg-[#08090d] flex flex-col justify-between overflow-y-auto">
        {/* Top Header Bar with Open/Close Sidebar Icon and Feature Status */}
        <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#08090d]/85 backdrop-blur-xl px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Open / Close Sidebar Button with Icon */}
            <button
              onClick={toggleSidebar}
              title={isSidebarOpen ? 'Close sidebar panel' : 'Open sidebar panel'}
              className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                isSidebarOpen
                  ? 'border-white/[0.08] bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800'
                  : 'border-indigo-500/50 bg-indigo-950/80 text-indigo-300 shadow-md shadow-indigo-950/50 ring-1 ring-indigo-500/40 hover:bg-indigo-900'
              }`}
            >
              {isSidebarOpen ? (
                <>
                  <PanelLeftClose className="h-4 w-4 text-slate-400" />
                  <span className="hidden sm:inline">Close Sidebar</span>
                </>
              ) : (
                <>
                  <PanelLeftOpen className="h-4 w-4 text-indigo-400" />
                  <span>Open Sidebar</span>
                </>
              )}
            </button>

            <div className="h-4 w-[1px] bg-white/[0.08] hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">
                Active Studio:
              </span>
              <span className="flex items-center gap-1.5 rounded-md bg-indigo-500/15 border border-indigo-500/30 px-2.5 py-0.5 text-xs font-bold text-indigo-300">
                {navItems.find((n) => n.id === activeTab)?.label || 'Studio'}
              </span>
            </div>
          </div>

          {/* Quick Notice if active */}
          {autoDownloadNotice && (
            <div className="flex items-center gap-1.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 px-3 py-1 text-xs text-cyan-300 shadow-md">
              <Zap className="h-3 w-3 text-cyan-400 animate-pulse" />
              <span>{autoDownloadNotice}</span>
            </div>
          )}
        </header>

        {/* Feature Container (ONLY ONE FEATURE OPEN AT A TIME) */}
        <div className="p-4 sm:p-6 lg:p-8 flex-1 w-full max-w-7xl mx-auto">
          {activeTab === 'videodub' && (
            <section aria-label="Video Dubbing Studio">
              <VideoDubbingStudio
                customClonedVoices={clonedVoices}
                onAudioGenerated={handleAudioGenerated}
              />
            </section>
          )}

          {activeTab === 'solo' && (
            <section aria-label="Solo Voice Synthesis Studio">
              <SoloVoiceStudio
                onAudioGenerated={handleAudioGenerated}
                customClonedVoices={clonedVoices}
                activeVoiceOverride={activeVoiceOverride}
                autoDownloadConfig={autoDownloadConfig}
                onUpdateAutoDownloadConfig={handleUpdateAutoDownloadConfig}
              />
            </section>
          )}

          {activeTab === 'dialogue' && (
            <section aria-label="Dual Speaker Dialogue Studio">
              <DialogueVoiceStudio
                onAudioGenerated={handleAudioGenerated}
                customClonedVoices={clonedVoices}
                autoDownloadConfig={autoDownloadConfig}
                onUpdateAutoDownloadConfig={handleUpdateAutoDownloadConfig}
              />
            </section>
          )}

          {activeTab === 'cloning' && (
            <section aria-label="Voice Cloning Studio">
              <VoiceCloningStudio
                clonedVoices={clonedVoices}
                onSaveClonedVoice={handleSaveClonedVoice}
                onDeleteClonedVoice={handleDeleteClonedVoice}
                onSelectForStudio={handleSelectClonedVoiceForStudio}
              />
            </section>
          )}

          {activeTab === 'library' && (
            <section aria-label="Audio History Library">
              <AudioHistoryLibrary
                currentTrack={activePlaybackTrack}
                history={history}
                onSelectTrack={handlePlayTrack}
                onDeleteTrack={handleDeleteHistoryTrack}
                onClearHistory={handleClearHistory}
                autoDownloadConfig={autoDownloadConfig}
                onUpdateAutoDownloadConfig={handleUpdateAutoDownloadConfig}
              />
            </section>
          )}
        </div>

        {/* Minimal Footer */}
        <footer className="border-t border-white/[0.06] bg-[#07080c]/60 py-3.5 px-4 sm:px-6 text-center text-xs text-slate-500 mt-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto">
            <span>VoxEmotion AI Studio • Gemini 3.8 Flash Neural Speech</span>
            <span>Ultra-Optimized Dark Architecture • 1-Click Video &amp; Voice Export</span>
          </div>
        </footer>
      </main>

      {/* ============================================================ */}
      {/* FLOATING LIGHTWEIGHT MINI AUDIO PLAYER (Only when playing) */}
      {/* ============================================================ */}
      {activePlaybackTrack && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-[420px] z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-3 rounded-2xl border border-indigo-500/40 bg-[#090b14]/95 p-3 text-xs shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
            {/* Play/Pause Button */}
            <button
              onClick={handleToggleMiniPlay}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-colors cursor-pointer"
            >
              {isPlayingMiniPlayer ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 fill-white" />
              )}
            </button>

            {/* Track Info */}
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-white truncate">
                  {activePlaybackTrack.voice}
                </span>
                <span className="rounded bg-indigo-500/20 px-1 py-0.2 text-[9px] font-mono text-indigo-300">
                  {activePlaybackTrack.language || 'English'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {activePlaybackTrack.textSnippet || 'Neural voiceover synthesis'}
              </p>
            </div>

            {/* Quick Download Button */}
            <button
              onClick={() => triggerAudioDownload(activePlaybackTrack, 'mp3', '192k')}
              title="Download MP3"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
            </button>

            {/* Close Button */}
            <button
              onClick={handleCloseMiniPlayer}
              title="Close mini player"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Hidden Native Audio Element */}
            <audio
              ref={miniAudioRef}
              src={`data:${activePlaybackTrack.mimeType || 'audio/wav'};base64,${activePlaybackTrack.audioBase64}`}
              onEnded={() => setIsPlayingMiniPlayer(false)}
              onError={() => setIsPlayingMiniPlayer(false)}
              onTimeUpdate={(e) => setMiniPlayerTime(e.currentTarget.currentTime)}
              onLoadedMetadata={(e) => setMiniPlayerDuration(e.currentTarget.duration)}
              autoPlay
            />
          </div>
        </div>
      )}
    </div>
  );
}

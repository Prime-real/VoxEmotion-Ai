'use client';

import React, { useState, useEffect } from 'react';
import {
  Mic,
  Users,
  History,
  Sparkles,
  Volume2,
  Globe,
  Sliders,
  Headphones,
  Zap,
  Dna,
  Film,
  PanelLeft,
  LayoutGrid,
  ChevronRight,
  Download,
  Play,
  Pause,
  Layers,
  Settings,
  CheckCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import AudioWorkstationPlayer, {
  AudioTrackMetadata,
} from '@/components/AudioWorkstationPlayer';
import SoloVoiceStudio from '@/components/SoloVoiceStudio';
import DialogueVoiceStudio from '@/components/DialogueVoiceStudio';
import AudioHistoryLibrary from '@/components/AudioHistoryLibrary';
import ShowcasePresetBar, {
  ShowcasePreset,
} from '@/components/ShowcasePresetBar';
import VoiceCloningStudio from '@/components/VoiceCloningStudio';
import VideoDubbingStudio from '@/components/VideoDubbingStudio';
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

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<
    'solo' | 'videodub' | 'dialogue' | 'cloning' | 'library'
  >('solo');
  const [currentTrack, setCurrentTrack] = useState<AudioTrackMetadata | null>(
    null
  );
  const [activeVoiceOverride, setActiveVoiceOverride] =
    useState<VoiceOption | null>(null);

  // Sidebar Card Mode layout toggle (default true for modern simplified workstation)
  const [sidebarCardMode, setSidebarCardMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const saved = localStorage.getItem('vox_sidebar_card_mode');
      if (saved !== null) return saved === 'true';
    } catch {
      // ignore
    }
    return true;
  });

  // Audio history state (IndexedDB backed)
  const [history, setHistory] = useState<AudioTrackMetadata[]>([]);

  // Cloned voices state (IndexedDB backed)
  const [clonedVoices, setClonedVoices] = useState<VoiceOption[]>([]);

  // Auto-Download Exported Voice State (synced with localStorage)
  const [autoDownloadConfig, setAutoDownloadConfig] = useState<AutoDownloadConfig>(
    () => getAutoDownloadConfig()
  );
  const [autoDownloadNotice, setAutoDownloadNotice] = useState<string | null>(null);

  // Mini preview audition audio player for the sidebar
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const handleUpdateAutoDownloadConfig = (config: AutoDownloadConfig) => {
    setAutoDownloadConfig(config);
    saveAutoDownloadConfig(config);
  };

  // Load from IndexedDB on startup
  useEffect(() => {
    dbGetTracks().then((tracks) => {
      if (tracks.length > 0) {
        setHistory(tracks);
        setCurrentTrack((prev) => prev || tracks[0]);
      }
    });

    dbGetClonedVoices().then((voices) => {
      if (voices.length > 0) {
        setClonedVoices(voices);
      }
    });
  }, []);

  const toggleSidebarCardMode = () => {
    const nextMode = !sidebarCardMode;
    setSidebarCardMode(nextMode);
    try {
      localStorage.setItem('vox_sidebar_card_mode', String(nextMode));
    } catch {
      // ignore
    }
  };

  const [isSynthesizingShowcase, setIsSynthesizingShowcase] = useState(false);
  const [showcaseNotice, setShowcaseNotice] = useState<string | null>(null);

  const handleAudioGenerated = async (track: AudioTrackMetadata) => {
    setCurrentTrack(track);
    setHistory((prev) => {
      const filtered = prev.filter((t) => t.timestamp !== track.timestamp);
      return [track, ...filtered];
    });
    // Async background IndexedDB persist
    dbSaveTrack(track);

    // Automatic download of exported voice if enabled!
    if (autoDownloadConfig.enabled && track.audioBase64) {
      try {
        const savedFilename = await triggerAudioDownload(
          track,
          autoDownloadConfig.format,
          autoDownloadConfig.bitrate
        );
        setAutoDownloadNotice(`⬇ Automatically downloaded: ${savedFilename}`);
        setTimeout(() => setAutoDownloadNotice(null), 4000);
      } catch (err: any) {
        console.error('Auto download failed:', err);
      }
    }
  };

  const handleSaveClonedVoice = (voice: VoiceOption) => {
    setClonedVoices((prev) => {
      const updated = [voice, ...prev.filter((v) => v.id !== voice.id)];
      return updated;
    });
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
  };

  const handleClearHistory = () => {
    setHistory([]);
    dbClearTracks();
  };

  // One-click audition preset handler
  const handleSelectShowcase = async (preset: ShowcasePreset) => {
    setIsSynthesizingShowcase(true);
    setShowcaseNotice(
      `Synthesizing "${preset.title}" with voice ${preset.voice}...`
    );

    try {
      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'solo',
          text: preset.text,
          voice: preset.voice,
          style: preset.stylePrompt,
          language: preset.language,
          model: 'gemini-3.8-flash-tts',
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to synthesize showcase clip.');
      }

      const generatedTrack: AudioTrackMetadata = {
        audioBase64: data.audioBase64,
        mimeType: data.mimeType || 'audio/wav',
        voice: preset.voice,
        language: preset.language,
        style: preset.stylePrompt,
        model: 'gemini-3.8-flash-tts',
        textSnippet: preset.text,
        timestamp: Date.now(),
      };

      handleAudioGenerated(generatedTrack);
      setShowcaseNotice(null);
    } catch (err: any) {
      console.error(err);
      setShowcaseNotice('Showcase generation error: ' + err.message);
      setTimeout(() => setShowcaseNotice(null), 4000);
    } finally {
      setIsSynthesizingShowcase(false);
    }
  };

  // Sidebar Voice Audition Preview
  const handleAuditionSidebarVoice = async (voice: VoiceOption) => {
    if (isPlayingPreview && previewAudio) {
      previewAudio.pause();
      setIsPlayingPreview(false);
      return;
    }

    try {
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
        audio.onended = () => setIsPlayingPreview(false);
        audio.play();
        setIsPlayingPreview(true);
      }
    } catch (err) {
      console.error('Sidebar voice audition error:', err);
    }
  };

  // Determine current active voice object
  const currentVoiceObj =
    activeVoiceOverride ||
    clonedVoices.find((v) => v.name === currentTrack?.voice) ||
    VOICES.find((v) => v.id === currentTrack?.voice || v.name === currentTrack?.voice) ||
    VOICES[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 text-white shadow-lg shadow-indigo-600/30">
              <Volume2 className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">
                  VoxEmotion AI
                </h1>
                <span className="hidden sm:inline-flex rounded-full bg-indigo-500/15 px-2 py-0.5 text-[11px] font-semibold text-indigo-300 border border-indigo-500/20">
                  Gemini 3.8 Speech Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden xs:block">
                Multilingual AI Voice Studio • Video Dubber &amp; Script Extractor
              </p>
            </div>
          </div>

          {/* Top Right Controls & Layout Switcher */}
          <div className="flex items-center gap-2">
            {/* Auto-Download Status Indicator */}
            {autoDownloadConfig.enabled && (
              <span className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-cyan-950/80 border border-cyan-500/30 px-2.5 py-1 text-[11px] font-mono text-cyan-300">
                <Zap className="h-3 w-3 text-cyan-400 fill-cyan-400 animate-pulse" />
                <span>Auto-DL ({autoDownloadConfig.format.toUpperCase()})</span>
              </span>
            )}

            {/* Sidebar Card Mode Toggle Button */}
            <button
              onClick={toggleSidebarCardMode}
              title={
                sidebarCardMode
                  ? 'Switch to Wide Stacked Mode'
                  : 'Switch to Sidebar Card Mode'
              }
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                sidebarCardMode
                  ? 'border-indigo-500/50 bg-indigo-950/70 text-indigo-300 shadow-sm ring-1 ring-indigo-500/40'
                  : 'border-slate-800 bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <PanelLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sidebar Mode:</span>
              <span className="font-semibold text-white">
                {sidebarCardMode ? 'Card Mode' : 'Wide View'}
              </span>
            </button>
          </div>
        </div>

        {/* Horizontal Navigation Pills (Always available on small screens or when wide view is active) */}
        {!sidebarCardMode && (
          <div className="border-t border-slate-800/60 bg-slate-950/60 px-4 py-2">
            <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto text-xs font-medium">
              <button
                onClick={() => setActiveTab('solo')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'solo'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Mic className="h-3.5 w-3.5" />
                <span>Solo Studio</span>
              </button>

              <button
                onClick={() => setActiveTab('videodub')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'videodub'
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Film className="h-3.5 w-3.5 text-cyan-400" />
                <span>Video Dubber</span>
              </button>

              <button
                onClick={() => setActiveTab('dialogue')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'dialogue'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Dual Screenplay</span>
              </button>

              <button
                onClick={() => setActiveTab('cloning')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'cloning'
                    ? 'bg-fuchsia-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Dna className="h-3.5 w-3.5 text-fuchsia-400" />
                <span>Voice Cloning ({clonedVoices.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('library')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'library'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <History className="h-3.5 w-3.5" />
                <span>Library ({history.length})</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Container */}
      <div className="mx-auto max-w-7xl flex-1 px-4 py-5 sm:px-6 w-full">
        {/* Showcase Notice Banner */}
        {showcaseNotice && (
          <div className="mb-4 rounded-xl border border-cyan-500/40 bg-cyan-950/40 p-3 text-xs text-cyan-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400 animate-spin" />
              <span>{showcaseNotice}</span>
            </div>
            {isSynthesizingShowcase && (
              <span className="font-mono text-[11px] text-cyan-300 animate-pulse">
                Processing audio...
              </span>
            )}
          </div>
        )}

        {/* Auto-Download notification banner */}
        {autoDownloadNotice && (
          <div className="mb-4 rounded-xl border border-cyan-500/40 bg-cyan-950/70 p-3 text-xs text-cyan-200 flex items-center justify-between shadow-lg shadow-cyan-950/40">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-cyan-400 fill-cyan-400 animate-pulse" />
              <span>{autoDownloadNotice}</span>
            </div>
            <span className="font-mono text-[10px] text-cyan-300 bg-cyan-900/60 px-2 py-0.5 rounded border border-cyan-500/30">
              Auto-DL Active ({autoDownloadConfig.format.toUpperCase()})
            </span>
          </div>
        )}

        {/* Layout Mode Branch: Sidebar Card Mode vs Wide Mode */}
        {sidebarCardMode ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* ============================================================ */}
            {/* LEFT SIDEBAR CARD HUB (4 cols on lg, 3 cols on xl) */}
            {/* ============================================================ */}
            <aside className="lg:col-span-4 xl:col-span-3 space-y-4">
              {/* Card 1: Studio Modes Navigator */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5 backdrop-blur-xl shadow-xl">
                <div className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Studio Modes</span>
                  <span className="text-[10px] font-normal text-indigo-400">
                    5 Studios
                  </span>
                </div>

                <div className="space-y-1">
                  {/* Solo Studio */}
                  <button
                    onClick={() => setActiveTab('solo')}
                    className={`flex items-center justify-between w-full rounded-xl p-2.5 text-left transition-all cursor-pointer ${
                      activeTab === 'solo'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          activeTab === 'solo'
                            ? 'bg-white/20 text-white'
                            : 'bg-indigo-950/60 text-indigo-400 border border-indigo-500/20'
                        }`}
                      >
                        <Mic className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold">Solo Studio</div>
                        <div
                          className={`text-[10px] ${
                            activeTab === 'solo'
                              ? 'text-indigo-100'
                              : 'text-slate-400'
                          }`}
                        >
                          Voiceover &amp; Emotions
                        </div>
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 ${
                        activeTab === 'solo'
                          ? 'text-white'
                          : 'text-slate-600'
                      }`}
                    />
                  </button>

                  {/* Video Dubber */}
                  <button
                    onClick={() => setActiveTab('videodub')}
                    className={`flex items-center justify-between w-full rounded-xl p-2.5 text-left transition-all cursor-pointer ${
                      activeTab === 'videodub'
                        ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-lg shadow-cyan-600/30 ring-1 ring-cyan-400'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          activeTab === 'videodub'
                            ? 'bg-white/20 text-white'
                            : 'bg-cyan-950/60 text-cyan-400 border border-cyan-500/20'
                        }`}
                      >
                        <Film className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <span>Video Dubber</span>
                          <span className="rounded bg-cyan-400/20 px-1 py-0.2 text-[9px] font-bold text-cyan-300 border border-cyan-400/30">
                            NEW
                          </span>
                        </div>
                        <div
                          className={`text-[10px] ${
                            activeTab === 'videodub'
                              ? 'text-cyan-100'
                              : 'text-slate-400'
                          }`}
                        >
                          Language Detect &amp; Dub
                        </div>
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 ${
                        activeTab === 'videodub'
                          ? 'text-white'
                          : 'text-slate-600'
                      }`}
                    />
                  </button>

                  {/* Dual Screenplay */}
                  <button
                    onClick={() => setActiveTab('dialogue')}
                    className={`flex items-center justify-between w-full rounded-xl p-2.5 text-left transition-all cursor-pointer ${
                      activeTab === 'dialogue'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          activeTab === 'dialogue'
                            ? 'bg-white/20 text-white'
                            : 'bg-indigo-950/60 text-indigo-400 border border-indigo-500/20'
                        }`}
                      >
                        <Users className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold">
                          Dual Screenplay
                        </div>
                        <div
                          className={`text-[10px] ${
                            activeTab === 'dialogue'
                              ? 'text-indigo-100'
                              : 'text-slate-400'
                          }`}
                        >
                          2-Speaker Dialogue
                        </div>
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 ${
                        activeTab === 'dialogue'
                          ? 'text-white'
                          : 'text-slate-600'
                      }`}
                    />
                  </button>

                  {/* Voice Cloning */}
                  <button
                    onClick={() => setActiveTab('cloning')}
                    className={`flex items-center justify-between w-full rounded-xl p-2.5 text-left transition-all cursor-pointer ${
                      activeTab === 'cloning'
                        ? 'bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-600/30 ring-1 ring-fuchsia-400'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          activeTab === 'cloning'
                            ? 'bg-white/20 text-white'
                            : 'bg-fuchsia-950/60 text-fuchsia-400 border border-fuchsia-500/20'
                        }`}
                      >
                        <Dna className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <span>Voice Cloning</span>
                          <span className="rounded bg-fuchsia-400/20 px-1.5 py-0.2 text-[9px] font-bold text-fuchsia-300 border border-fuchsia-400/30">
                            {clonedVoices.length}
                          </span>
                        </div>
                        <div
                          className={`text-[10px] ${
                            activeTab === 'cloning'
                              ? 'text-fuchsia-100'
                              : 'text-slate-400'
                          }`}
                        >
                          Custom Persona Lab
                        </div>
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 ${
                        activeTab === 'cloning'
                          ? 'text-white'
                          : 'text-slate-600'
                      }`}
                    />
                  </button>

                  {/* Audio Library */}
                  <button
                    onClick={() => setActiveTab('library')}
                    className={`flex items-center justify-between w-full rounded-xl p-2.5 text-left transition-all cursor-pointer ${
                      activeTab === 'library'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-indigo-400'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                          activeTab === 'library'
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-800 text-slate-300 border border-slate-700/50'
                        }`}
                      >
                        <History className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold">
                          <span>Audio Library</span>
                          <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[9px] font-mono text-slate-300 border border-slate-700">
                            {history.length}
                          </span>
                        </div>
                        <div
                          className={`text-[10px] ${
                            activeTab === 'library'
                              ? 'text-indigo-100'
                              : 'text-slate-400'
                          }`}
                        >
                          Master Tracks &amp; History
                        </div>
                      </div>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 ${
                        activeTab === 'library'
                          ? 'text-white'
                          : 'text-slate-600'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Card 2: Active Voice Profile & Quick Audition */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5 backdrop-blur-xl shadow-xl space-y-2.5">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <span className="flex items-center gap-1">
                    <Mic className="h-3 w-3 text-cyan-400" />
                    <span>Active Voice Persona</span>
                  </span>
                  <span className="text-[10px] text-cyan-300 font-normal">
                    {currentVoiceObj.gender}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold text-white flex items-center gap-1.5">
                        <span>{currentVoiceObj.name}</span>
                        {currentVoiceObj.isCloned && (
                          <span className="rounded bg-fuchsia-500/20 text-fuchsia-300 text-[9px] px-1 py-0.2">
                            CLONED
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 line-clamp-1">
                        {currentVoiceObj.tone}
                      </div>
                    </div>

                    <button
                      onClick={() => handleAuditionSidebarVoice(currentVoiceObj)}
                      title="Audition voice signature quote"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors shadow-md cursor-pointer"
                    >
                      {isPlayingPreview ? (
                        <Pause className="h-4 w-4 fill-white" />
                      ) : (
                        <Play className="h-4 w-4 fill-white ml-0.5" />
                      )}
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-500 italic line-clamp-2 pt-1 border-t border-slate-850">
                    &ldquo;{currentVoiceObj.auditionQuote}&rdquo;
                  </p>
                </div>
              </div>

              {/* Card 3: Quick Preferences & Auto-Download */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5 backdrop-blur-xl shadow-xl space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <span className="flex items-center gap-1">
                    <SlidersHorizontal className="h-3 w-3 text-indigo-400" />
                    <span>Quick Preferences</span>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    FAST
                  </span>
                </div>

                {/* Auto-Download Toggle */}
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <Zap
                      className={`h-4 w-4 ${
                        autoDownloadConfig.enabled
                          ? 'text-cyan-400 fill-cyan-400 animate-pulse'
                          : 'text-slate-500'
                      }`}
                    />
                    <div>
                      <div className="text-xs font-semibold text-slate-200">
                        Auto-Download
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Saves audio instantly on gen
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      handleUpdateAutoDownloadConfig({
                        ...autoDownloadConfig,
                        enabled: !autoDownloadConfig.enabled,
                      })
                    }
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                      autoDownloadConfig.enabled
                        ? 'bg-cyan-500'
                        : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        autoDownloadConfig.enabled
                          ? 'translate-x-4'
                          : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Export Format Selector */}
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-slate-400 text-[11px]">Format:</span>
                  <div className="flex items-center gap-1">
                    {(['mp3', 'wav', 'aac'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() =>
                          handleUpdateAutoDownloadConfig({
                            ...autoDownloadConfig,
                            format: fmt,
                          })
                        }
                        className={`rounded px-2 py-0.5 text-[10px] font-mono uppercase transition-colors cursor-pointer ${
                          autoDownloadConfig.format === fmt
                            ? 'bg-cyan-600 text-white font-bold'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card 4: Quick Recent Generations */}
              {history.length > 0 && (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3.5 backdrop-blur-xl shadow-xl space-y-2.5">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400">
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
                    {history.slice(0, 3).map((item) => (
                      <div
                        key={item.timestamp}
                        onClick={() => setCurrentTrack(item)}
                        className={`group flex items-center justify-between rounded-xl p-2 text-left transition-all border cursor-pointer ${
                          currentTrack?.timestamp === item.timestamp
                            ? 'bg-indigo-950/50 border-indigo-500/40'
                            : 'bg-slate-950/40 border-slate-850 hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-xs font-semibold text-white truncate">
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
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-slate-300 group-hover:bg-indigo-600 group-hover:text-white transition-colors"
                        >
                          <Download className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Card 5: Demo Audition Showcase */}
              <ShowcasePresetBar onSelectPreset={handleSelectShowcase} />
            </aside>

            {/* ============================================================ */}
            {/* RIGHT MAIN WORKSTATION CANVAS (8 cols on lg, 9 cols on xl) */}
            {/* ============================================================ */}
            <main className="lg:col-span-8 xl:col-span-9 space-y-5">
              {/* Master Audio Player (Clean & Focused) */}
              <section aria-label="Audio Workstation Player">
                <AudioWorkstationPlayer
                  track={currentTrack}
                  onAudioGenerated={handleAudioGenerated}
                  customClonedVoices={clonedVoices}
                  autoDownloadConfig={autoDownloadConfig}
                  onUpdateAutoDownloadConfig={handleUpdateAutoDownloadConfig}
                />
              </section>

              {/* Active Studio Content Card */}
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

              {activeTab === 'videodub' && (
                <section aria-label="AI Video Dubber & Script Extractor Studio">
                  <VideoDubbingStudio
                    customClonedVoices={clonedVoices}
                    onAudioGenerated={handleAudioGenerated}
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
                    currentTrack={currentTrack}
                    history={history}
                    onSelectTrack={(t) => setCurrentTrack(t)}
                    onDeleteTrack={handleDeleteHistoryTrack}
                    onClearHistory={handleClearHistory}
                    autoDownloadConfig={autoDownloadConfig}
                    onUpdateAutoDownloadConfig={handleUpdateAutoDownloadConfig}
                  />
                </section>
              )}

              {/* Studio Engineering Guide Card */}
              <section className="rounded-2xl border border-slate-800/90 bg-slate-900/40 p-5 backdrop-blur-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Headphones className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                    Studio Guide • Voice Synthesis &amp; AI Video Dubbing
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-300">
                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                    <div className="flex items-center gap-2 font-semibold text-cyan-300 mb-1">
                      <Film className="h-3.5 w-3.5" />
                      <span>Video Dubbing &amp; Scripts</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Detect video language and extract line-by-line scripts with timestamps, dubbing into 30+ languages in sync.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                    <div className="flex items-center gap-2 font-semibold text-fuchsia-300 mb-1">
                      <Dna className="h-3.5 w-3.5" />
                      <span>Voice Cloning</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Analyze pitch, timbre, vocal fry, and cadence from audio samples to calibrate custom voice personas.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                    <div className="flex items-center gap-2 font-semibold text-emerald-300 mb-1">
                      <Download className="h-3.5 w-3.5" />
                      <span>Instant MP3 &amp; MP4</span>
                    </div>
                    <p className="text-slate-400 text-[11px] leading-relaxed">
                      Super-fast client-side MP3 transcoding with zero latency, plus merged MP4 video downloads with dubbed audio.
                    </p>
                  </div>
                </div>
              </section>
            </main>
          </div>
        ) : (
          /* ============================================================ */
          /* WIDE STACKED VIEW (Fallback mode) */
          /* ============================================================ */
          <div className="space-y-6">
            <ShowcasePresetBar onSelectPreset={handleSelectShowcase} />

            <section aria-label="Audio Workstation Player">
              <AudioWorkstationPlayer
                track={currentTrack}
                onAudioGenerated={handleAudioGenerated}
                customClonedVoices={clonedVoices}
                autoDownloadConfig={autoDownloadConfig}
                onUpdateAutoDownloadConfig={handleUpdateAutoDownloadConfig}
              />
            </section>

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

            {activeTab === 'videodub' && (
              <section aria-label="AI Video Dubber & Script Extractor Studio">
                <VideoDubbingStudio
                  customClonedVoices={clonedVoices}
                  onAudioGenerated={handleAudioGenerated}
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
                  currentTrack={currentTrack}
                  history={history}
                  onSelectTrack={(t) => setCurrentTrack(t)}
                  onDeleteTrack={handleDeleteHistoryTrack}
                  onClearHistory={handleClearHistory}
                  autoDownloadConfig={autoDownloadConfig}
                  onUpdateAutoDownloadConfig={handleUpdateAutoDownloadConfig}
                />
              </section>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/90 py-4 text-center text-xs text-slate-500 mt-auto">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>VoxEmotion AI • Gemini 3.8 Flash Neural Speech Engine</span>
          <span>Sidebar Card Mode • Video Dubbing &amp; Scripts • Instant MP3 Export</span>
        </div>
      </footer>
    </div>
  );
}

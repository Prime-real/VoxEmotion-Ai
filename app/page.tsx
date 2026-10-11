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
import { VoiceOption } from '@/lib/tts-constants';
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
    'solo' | 'dialogue' | 'cloning' | 'library'
  >('solo');
  const [currentTrack, setCurrentTrack] = useState<AudioTrackMetadata | null>(
    null
  );
  const [activeVoiceOverride, setActiveVoiceOverride] =
    useState<VoiceOption | null>(null);

  // Audio history state (IndexedDB backed)
  const [history, setHistory] = useState<AudioTrackMetadata[]>([]);

  // Cloned voices state (IndexedDB backed)
  const [clonedVoices, setClonedVoices] = useState<VoiceOption[]>([]);

  // Auto-Download Exported Voice State (synced with localStorage)
  const [autoDownloadConfig, setAutoDownloadConfig] = useState<AutoDownloadConfig>(
    () => getAutoDownloadConfig()
  );
  const [autoDownloadNotice, setAutoDownloadNotice] = useState<string | null>(null);

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

  const [isSynthesizingShowcase, setIsSynthesizingShowcase] = useState(false);
  const [showcaseNotice, setShowcaseNotice] = useState<string | null>(null);

  const handleAudioGenerated = async (track: AudioTrackMetadata) => {
    setCurrentTrack(track);
    setHistory((prev) => {
      const filtered = prev.filter((t) => t.timestamp !== track.timestamp);
      return [track, ...filtered];
    });
    // Async background IndexedDB persist (0 main-thread blocking)
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
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
                Multilingual AI Voice Studio • Voice Cloning &amp; Emotional Inflections
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-900/90 p-1 border border-slate-800 text-xs font-medium">
            <button
              onClick={() => setActiveTab('solo')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                activeTab === 'solo'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Mic className="h-3.5 w-3.5" />
              <span>Solo Studio</span>
            </button>

            <button
              onClick={() => setActiveTab('dialogue')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                activeTab === 'dialogue'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Dual Screenplay</span>
            </button>

            <button
              onClick={() => setActiveTab('cloning')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                activeTab === 'cloning'
                  ? 'bg-fuchsia-600 text-white shadow-md shadow-fuchsia-600/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Dna className="h-3.5 w-3.5 text-fuchsia-400" />
              <span>Voice Cloning ({clonedVoices.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('library')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                activeTab === 'library'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Library ({history.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl flex-1 px-4 py-6 sm:px-6 space-y-6 w-full">
        {/* Showcase Notice Banner if generating */}
        {showcaseNotice && (
          <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/40 p-3 text-xs text-cyan-200 flex items-center justify-between">
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
          <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/70 p-3 text-xs text-cyan-200 flex items-center justify-between shadow-lg shadow-cyan-950/40">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-cyan-400 fill-cyan-400 animate-pulse" />
              <span>{autoDownloadNotice}</span>
            </div>
            <span className="font-mono text-[10px] text-cyan-300 bg-cyan-900/60 px-2 py-0.5 rounded border border-cyan-500/30">
              Auto-DL Active ({autoDownloadConfig.format.toUpperCase()})
            </span>
          </div>
        )}

        {/* 1. Quick Audition Showcase Bar */}
        <ShowcasePresetBar onSelectPreset={handleSelectShowcase} />

        {/* 2. Master Audio Workstation Player */}
        <section aria-label="Audio Workstation Player">
          <AudioWorkstationPlayer
            track={currentTrack}
            onAudioGenerated={handleAudioGenerated}
            customClonedVoices={clonedVoices}
            autoDownloadConfig={autoDownloadConfig}
            onUpdateAutoDownloadConfig={handleUpdateAutoDownloadConfig}
          />
        </section>

        {/* 3. Tab Contents */}
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

        {/* 4. Inflection & Audio Engineering Guide */}
        <section className="rounded-2xl border border-slate-800/90 bg-slate-900/40 p-6 backdrop-blur-xl">
          <div className="flex items-center gap-2 mb-4">
            <Headphones className="h-5 w-5 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
              Studio Guide • How Realistic Emotional TTS &amp; Voice Cloning Work
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs text-slate-300">
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="flex items-center gap-2 font-semibold text-fuchsia-300 mb-2">
                <Dna className="h-4 w-4" />
                <span>Voice Cloning &amp; Persona Design</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Clone real voices from mic recordings or audio files, or prompt-design
                custom personas from scratch. Gemini analyzes acoustic pitch, timbre,
                vocal fry, and pacing to calibrate a persistent custom voice profile.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="flex items-center gap-2 font-semibold text-indigo-300 mb-2">
                <Zap className="h-4 w-4" />
                <span>Vocal Bursts &amp; Preview Auditions</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Audition every voice character with instant signature quotes.
                Inject expressive soundtags like <code className="text-cyan-300">&lt;breath&gt;</code>, <code className="text-cyan-300">&lt;gasp&gt;</code>, <code className="text-cyan-300">&lt;laugh&gt;</code>, or backchanneling <code className="text-cyan-300">|yeah|</code>.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
              <div className="flex items-center gap-2 font-semibold text-cyan-300 mb-2">
                <Globe className="h-4 w-4" />
                <span>Multilingual Native Cadence</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Trained across 30+ world languages with authentic native intonation,
                regional phrasing, and cultural emotional idioms. Export studio-grade
                MP3, AAC, FLAC, OGG, or master 24kHz WAV.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/90 py-5 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>VoxEmotion AI • Powered by Gemini 3.8 Flash TTS &amp; Next.js</span>
          <span>Voice Cloning • 16+ Characters • Multi-Format Master Export</span>
        </div>
      </footer>
    </div>
  );
}

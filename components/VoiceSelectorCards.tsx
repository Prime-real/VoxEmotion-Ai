'use client';

import React, { useState, useRef, useEffect } from 'react';
import { VoiceOption, VOICES } from '@/lib/tts-constants';
import { dbGetCachedAudition, dbSaveCachedAudition } from '@/lib/audio-storage';
import {
  Play,
  Square,
  Volume2,
  Sparkles,
  Loader2,
  Check,
  User,
  Radio,
  Dna,
} from 'lucide-react';

interface VoiceSelectorCardsProps {
  selectedVoiceId: string;
  onSelectVoice: (voice: VoiceOption) => void;
  customClonedVoices?: VoiceOption[];
}

export default function VoiceSelectorCards({
  selectedVoiceId,
  onSelectVoice,
  customClonedVoices = [],
}: VoiceSelectorCardsProps) {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(
    null
  );
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Combine standard voices with user-cloned custom voices
  const allVoices = [...customClonedVoices, ...VOICES];

  const categories = [
    'All',
    ...(customClonedVoices.length > 0 ? ['My Cloned Voices'] : []),
    'Core Studio',
    'Cinematic & Sci-Fi',
    'Characters & Drama',
  ];

  const filteredVoices = allVoices.filter((v) => {
    if (activeCategory === 'All') return true;
    if (activeCategory === 'My Cloned Voices') return v.isCloned;
    return v.category === activeCategory;
  });

  // Stop audition playback when unmounting
  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  // Handle Audition / Preview Voice Play
  const handleTogglePreview = async (e: React.MouseEvent, voice: VoiceOption) => {
    e.stopPropagation(); // Don't trigger card selection

    // If currently playing this voice, stop it
    if (previewingVoiceId === voice.id) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      setPreviewingVoiceId(null);
      setIsLoadingPreview(false);
      return;
    }

    // Stop existing audio
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }

    setPreviewingVoiceId(voice.id);
    setIsLoadingPreview(true);

    const cacheKey = `${voice.id}_${voice.auditionQuote}`;

    try {
      // 1. Check local IndexedDB cache first for 0ms instant playback
      const cachedBase64 = await dbGetCachedAudition(cacheKey);
      let audioBase64 = cachedBase64;
      let mimeType = 'audio/wav';

      if (!audioBase64) {
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
        if (!res.ok || data.error) {
          throw new Error(data.error || 'Failed to load voice audition.');
        }

        audioBase64 = data.audioBase64;
        mimeType = data.mimeType || 'audio/wav';

        if (audioBase64) {
          // Save to local cache asynchronously
          dbSaveCachedAudition(cacheKey, audioBase64);
        }
      }

      if (!audioBase64) {
        throw new Error('No audio data available for preview.');
      }

      const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
      previewAudioRef.current = audio;

      audio.onended = () => {
        setPreviewingVoiceId(null);
        setIsLoadingPreview(false);
      };

      audio.onerror = () => {
        setPreviewingVoiceId(null);
        setIsLoadingPreview(false);
      };

      await audio.play();
      setIsLoadingPreview(false);
    } catch (err) {
      console.error('Preview error:', err);
      setPreviewingVoiceId(null);
      setIsLoadingPreview(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800/80 pb-3">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
              activeCategory === cat
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            {cat === 'My Cloned Voices' && (
              <span className="mr-1 inline-block text-cyan-300">✦</span>
            )}
            {cat}
          </button>
        ))}
      </div>

      {/* Voice Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {filteredVoices.map((v) => {
          const isSelected = selectedVoiceId === v.id;
          const isPreviewing = previewingVoiceId === v.id;

          return (
            <div
              key={v.id}
              onClick={() => onSelectVoice(v)}
              className={`group relative flex flex-col justify-between rounded-xl p-3 text-left transition-all cursor-pointer ${
                isSelected
                  ? 'border-2 border-indigo-500 bg-indigo-950/40 shadow-lg shadow-indigo-950/50 ring-1 ring-indigo-400/40'
                  : 'border border-slate-800 bg-slate-900/80 hover:border-slate-700 hover:bg-slate-800/60'
              }`}
            >
              {/* Top Row: Avatar & Badges */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr ${v.avatarColor} text-white font-bold text-xs shadow-md`}
                  >
                    {v.name[0]}
                    {isPreviewing && (
                      <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500"></span>
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-white tracking-wide">
                        {v.name}
                      </span>
                      {v.isCloned ? (
                        <span className="rounded bg-fuchsia-500/20 px-1 py-0.2 text-[9px] font-semibold text-fuchsia-300 border border-fuchsia-500/30">
                          CLONE
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          {v.gender}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block line-clamp-1">
                      {v.category || 'Studio Voice'}
                    </span>
                  </div>
                </div>

                {/* Selected Checkmark Indicator */}
                {isSelected && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                )}
              </div>

              {/* Tone Description */}
              <p className="mt-2 text-[11px] leading-snug text-slate-300 line-clamp-2">
                {v.tone}
              </p>

              {/* Bottom Row: Audition Button & Sample quote hint */}
              <div className="mt-2.5 flex items-center justify-between border-t border-slate-800/80 pt-2">
                <button
                  type="button"
                  onClick={(e) => handleTogglePreview(e, v)}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                    isPreviewing
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                  }`}
                  title={`Preview audition for ${v.name}`}
                >
                  {isPreviewing ? (
                    isLoadingPreview ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Square className="h-3 w-3 fill-current" />
                        <span>Stop</span>
                      </>
                    )
                  ) : (
                    <>
                      <Play className="h-3 w-3 fill-current ml-0.5" />
                      <span>Preview</span>
                    </>
                  )}
                </button>

                {/* Live soundwave animation if previewing */}
                {isPreviewing ? (
                  <div className="flex items-center gap-0.5">
                    <span className="h-3 w-1 rounded bg-cyan-400 animate-pulse"></span>
                    <span className="h-4 w-1 rounded bg-cyan-300 animate-pulse delay-75"></span>
                    <span className="h-2 w-1 rounded bg-cyan-500 animate-pulse delay-150"></span>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400 font-mono">
                    {v.sampleEmotion}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

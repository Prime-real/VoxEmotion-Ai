'use client';

import React, { useState, useRef } from 'react';
import {
  LANGUAGES,
  VOICES,
  EMOTION_PRESETS,
  VOCAL_TAGS,
  LanguageOption,
  VoiceOption,
  EmotionPreset,
} from '@/lib/tts-constants';
import { AudioTrackMetadata } from './AudioWorkstationPlayer';
import {
  Sparkles,
  Volume2,
  Globe,
  Sliders,
  Wand2,
  RotateCcw,
  Languages,
  Zap,
  Info,
  ChevronDown,
  Loader2,
  Mic,
  Smile,
  Flame,
} from 'lucide-react';

import VoiceSelectorCards from './VoiceSelectorCards';
import { AutoDownloadConfig } from '@/lib/audio-storage';

interface SoloVoiceStudioProps {
  onAudioGenerated: (track: AudioTrackMetadata) => void;
  customClonedVoices?: VoiceOption[];
  activeVoiceOverride?: VoiceOption | null;
  autoDownloadConfig?: AutoDownloadConfig;
  onUpdateAutoDownloadConfig?: (config: AutoDownloadConfig) => void;
}

export default function SoloVoiceStudio({
  onAudioGenerated,
  customClonedVoices = [],
  activeVoiceOverride = null,
  autoDownloadConfig,
  onUpdateAutoDownloadConfig,
}: SoloVoiceStudioProps) {
  // Studio State
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>(
    LANGUAGES[0]
  );
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(VOICES[0]);
  const [prevOverrideId, setPrevOverrideId] = useState<string | undefined>(
    activeVoiceOverride?.id
  );

  // Sync active voice override if passed from outside
  if (activeVoiceOverride && activeVoiceOverride.id !== prevOverrideId) {
    setPrevOverrideId(activeVoiceOverride.id);
    setSelectedVoice(activeVoiceOverride);
  }
  const [selectedEmotion, setSelectedEmotion] = useState<EmotionPreset>(
    EMOTION_PRESETS[0]
  );
  const [customStyle, setCustomStyle] = useState('');
  const [useCustomStyle, setUseCustomStyle] = useState(false);
  const [modelChoice, setModelChoice] = useState<
    'gemini-3.8-flash-tts' | 'gemini-3.8-flash-lite-tts'
  >('gemini-3.8-flash-tts');

  const [text, setText] = useState<string>(LANGUAGES[0].sampleText);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Insert sound tag at cursor position
  const handleInsertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setText((prev) => prev + ' ' + tag);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const newText =
      current.substring(0, start) + ' ' + tag + ' ' + current.substring(end);
    setText(newText);

    setTimeout(() => {
      textarea.focus();
      const nextPos = start + tag.length + 2;
      textarea.setSelectionRange(nextPos, nextPos);
    }, 10);
  };

  // Change language and optionally load native demo
  const handleSelectLanguage = (lang: LanguageOption) => {
    setSelectedLanguage(lang);
    // Optionally adapt voice recommendation if user hasn't heavily customized
    const recVoice = VOICES.find((v) => v.id === lang.recommendedVoice);
    if (recVoice) {
      setSelectedVoice(recVoice);
    }
  };

  // Load language sample
  const handleLoadSample = (lang: LanguageOption) => {
    setText(lang.sampleText);
    const recVoice = VOICES.find((v) => v.id === lang.recommendedVoice);
    if (recVoice) {
      setSelectedVoice(recVoice);
    }
    // Match sample emotion if found
    const matchingEmotion = EMOTION_PRESETS.find(
      (e) =>
        e.name.toLowerCase().includes(lang.sampleEmotion.toLowerCase()) ||
        lang.sampleEmotion.toLowerCase().includes(e.category.toLowerCase())
    );
    if (matchingEmotion) {
      setSelectedEmotion(matchingEmotion);
    }
  };

  // AI Script Enhance (inject natural vocal bursts and breathing rhythm)
  const handleEnhanceScript = async () => {
    if (!text.trim()) return;
    setIsEnhancing(true);
    setErrorMsg(null);

    try {
      const activeStyle = useCustomStyle
        ? customStyle
        : selectedEmotion.stylePrompt;
      const res = await fetch('/api/tts/script-director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'enhance',
          text,
          emotion: activeStyle,
          language: selectedLanguage.name,
        }),
      });

      const data = await res.json();
      if (data.enhancedText) {
        setText(data.enhancedText);
      } else if (data.error) {
        setErrorMsg(data.error);
      }
    } catch (err: any) {
      setErrorMsg('Failed to enhance script: ' + err.message);
    } finally {
      setIsEnhancing(false);
    }
  };

  // Translate & Adapt
  const handleTranslateScript = async () => {
    if (!text.trim()) return;
    setIsTranslating(true);
    setErrorMsg(null);

    try {
      const activeStyle = useCustomStyle
        ? customStyle
        : selectedEmotion.stylePrompt;
      const res = await fetch('/api/tts/script-director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'translate',
          text,
          emotion: activeStyle,
          language: selectedLanguage.name,
        }),
      });

      const data = await res.json();
      if (data.translatedText) {
        setText(data.translatedText);
      } else if (data.error) {
        setErrorMsg(data.error);
      }
    } catch (err: any) {
      setErrorMsg('Failed to translate script: ' + err.message);
    } finally {
      setIsTranslating(false);
    }
  };

  // Synthesize Speech
  const handleSynthesize = async () => {
    if (!text.trim()) {
      setErrorMsg('Please enter some text to synthesize.');
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      let activeStyle = useCustomStyle
        ? customStyle
        : selectedEmotion.stylePrompt;

      if (selectedVoice.personaPrompt) {
        activeStyle = activeStyle
          ? `${selectedVoice.personaPrompt}. ${activeStyle}`
          : selectedVoice.personaPrompt;
      }

      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'solo',
          text,
          voice: selectedVoice.baseVoice || selectedVoice.id,
          style: activeStyle,
          language: selectedLanguage.name,
          model: modelChoice,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to synthesize speech.');
      }

      onAudioGenerated({
        audioBase64: data.audioBase64,
        mimeType: data.mimeType || 'audio/wav',
        voice: selectedVoice.name,
        language: selectedLanguage.name,
        style: activeStyle,
        model: modelChoice,
        textSnippet: text,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'An error occurred during audio generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Word & Duration Estimator
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const estimatedSeconds = Math.max(1, Math.round((wordCount / 140) * 60));

  return (
    <div className="space-y-6">
      {/* 1. Language Preset Strip */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-200">
              Target Language & Accent
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Native phonetics & emotional cadence supported
          </span>
        </div>

        {/* Quick Language Pills */}
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.slice(0, 10).map((lang) => (
            <button
              key={lang.code}
              onClick={() => handleSelectLanguage(lang)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                selectedLanguage.code === lang.code
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400'
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/50'
              }`}
            >
              <span>{lang.flag}</span>
              <span>{lang.nativeName}</span>
            </button>
          ))}

          {/* More Languages Dropdown */}
          <div className="relative inline-block">
            <select
              value={selectedLanguage.code}
              onChange={(e) => {
                const found = LANGUAGES.find((l) => l.code === e.target.value);
                if (found) handleSelectLanguage(found);
              }}
              aria-label="Select Target Language"
              className="h-8 rounded-xl border border-slate-700/60 bg-slate-800/90 px-3 pr-7 text-xs font-medium text-slate-300 hover:bg-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-400 cursor-pointer"
            >
              <option disabled value="">
                More languages...
              </option>
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name} ({lang.nativeName})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. Voice Cast Selector & Audition Previews */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-slate-200">
              Voice Persona Cast &amp; Audition Previews
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Selected: <strong className="text-white">{selectedVoice.name}</strong> ({selectedVoice.tone})
          </span>
        </div>

        <VoiceSelectorCards
          selectedVoiceId={selectedVoice.id}
          onSelectVoice={(v) => setSelectedVoice(v)}
          customClonedVoices={customClonedVoices}
        />
      </div>

      {/* 3. Emotional Inflection & Directorial Mode */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Smile className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-200">
              Emotional Inflection & Tone Direction
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setUseCustomStyle(!useCustomStyle)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                useCustomStyle
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/50'
              }`}
            >
              <Sliders className="h-3 w-3" />
              <span>{useCustomStyle ? 'Custom Mode Active' : 'Custom Prompt Mode'}</span>
            </button>

            {/* Model switcher */}
            <div className="flex items-center rounded-lg bg-slate-950 p-0.5 border border-slate-800 text-[11px]">
              <button
                onClick={() => setModelChoice('gemini-3.8-flash-tts')}
                className={`rounded px-2 py-0.5 font-medium transition-colors ${
                  modelChoice === 'gemini-3.8-flash-tts'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Flagship voice model with vocal bursts and expressive acting"
              >
                Studio Expressive
              </button>
              <button
                onClick={() => setModelChoice('gemini-3.8-flash-lite-tts')}
                className={`rounded px-2 py-0.5 font-medium transition-colors ${
                  modelChoice === 'gemini-3.8-flash-lite-tts'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Ultra-fast generation for standard narration"
              >
                Turbo
              </button>
            </div>
          </div>
        </div>

        {useCustomStyle ? (
          <div className="space-y-2">
            <input
              type="text"
              value={customStyle}
              onChange={(e) => setCustomStyle(e.target.value)}
              placeholder="e.g. Breathless astronaut whispering in terrified awe, tender French accent, trembling voice"
              className="w-full rounded-xl border border-amber-500/30 bg-slate-950/70 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
            <p className="text-[11px] text-slate-400">
              💡 Direct the actor precisely: mention tempo, pitch, vocal tension, breathing, mood, or accent nuances.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {EMOTION_PRESETS.map((emo) => {
              const isSelected = selectedEmotion.id === emo.id;
              return (
                <button
                  key={emo.id}
                  onClick={() => setSelectedEmotion(emo)}
                  className={`flex items-start gap-2 rounded-xl p-2.5 text-left transition-all ${
                    isSelected
                      ? 'border-2 border-indigo-500 bg-indigo-950/30 ring-1 ring-indigo-400/30'
                      : 'border border-slate-800/80 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/40'
                  }`}
                >
                  <span className="text-lg">{emo.icon}</span>
                  <div>
                    <div className="text-xs font-semibold text-white">
                      {emo.name}
                    </div>
                    <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                      {emo.description}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Script Editor & Vocal Sound Tags */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          {/* Vocal Burst Tags Injector */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1 mr-1">
              <Zap className="h-3.5 w-3.5 text-cyan-400" />
              <span>Insert Soundtags:</span>
            </span>
            {VOCAL_TAGS.map((vt) => (
              <button
                key={vt.tag}
                onClick={() => handleInsertTag(vt.tag)}
                title={vt.description}
                className="rounded-lg border border-slate-700/60 bg-slate-800/80 px-2 py-0.5 font-mono text-[11px] text-cyan-300 hover:bg-cyan-950 hover:text-cyan-200 hover:border-cyan-500/50 transition-colors"
              >
                {vt.tag}
              </button>
            ))}
          </div>

          {/* AI Script Assistants */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleLoadSample(selectedLanguage)}
              title="Load curated sample script for this language"
              className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-800/70 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Sample</span>
            </button>

            <button
              onClick={handleEnhanceScript}
              disabled={isEnhancing || !text.trim()}
              title="Enhance punctuation, dramatic pauses and realistic vocal bursts"
              className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-950/40 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:bg-indigo-900/50 hover:text-white disabled:opacity-50 transition-colors"
            >
              {isEnhancing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Wand2 className="h-3 w-3" />
              )}
              <span>{isEnhancing ? 'Directing...' : 'Infuse Emotion'}</span>
            </button>

            <button
              onClick={handleTranslateScript}
              disabled={isTranslating || !text.trim()}
              title={`Translate current script to ${selectedLanguage.name}`}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-2.5 py-1 text-xs font-medium text-cyan-300 hover:bg-cyan-900/50 hover:text-white disabled:opacity-50 transition-colors"
            >
              {isTranslating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Languages className="h-3 w-3" />
              )}
              <span>{isTranslating ? 'Translating...' : `Translate to ${selectedLanguage.name}`}</span>
            </button>
          </div>
        </div>

        {/* Text Area */}
        <div className="relative mt-2">
          <textarea
            ref={textareaRef}
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Enter text in ${selectedLanguage.name} to speak. You can insert soundtags like <breath>, <gasp>, or <laugh> to control realistic emotional delivery.`}
            className="w-full rounded-xl border border-slate-700/80 bg-slate-950/80 p-4 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed font-sans"
          />

          {/* Stats Bar */}
          <div className="mt-2 flex items-center justify-between text-xs text-slate-400 px-1">
            <div className="flex items-center gap-3">
              <span>{wordCount} words</span>
              <span>{text.length} characters</span>
              <span>~{estimatedSeconds}s estimated speech</span>
            </div>
            <div className="text-[11px] text-slate-500">
              Gemini 3.8 Waveform Synthesis
            </div>
          </div>
        </div>

        {/* Error message if any */}
        {errorMsg && (
          <div className="mt-3 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300 flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {/* Action Button & Auto-Download Quick Switch */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          {autoDownloadConfig && onUpdateAutoDownloadConfig ? (
            <button
              type="button"
              onClick={() =>
                onUpdateAutoDownloadConfig({
                  ...autoDownloadConfig,
                  enabled: !autoDownloadConfig.enabled,
                })
              }
              title={
                autoDownloadConfig.enabled
                  ? `Auto-download is ON (${autoDownloadConfig.format.toUpperCase()}). Every synthesized voice is immediately downloaded.`
                  : 'Turn ON auto-download for newly synthesized voices'
              }
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition-all cursor-pointer ${
                autoDownloadConfig.enabled
                  ? 'border-cyan-500/50 bg-cyan-950/60 text-cyan-300 shadow-sm shadow-cyan-500/20 ring-1 ring-cyan-500/30'
                  : 'border-slate-800 bg-slate-900/70 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Zap
                className={`h-4 w-4 ${
                  autoDownloadConfig.enabled
                    ? 'text-cyan-400 fill-cyan-400 animate-pulse'
                    : 'text-slate-500'
                }`}
              />
              <span className="text-slate-300">Auto-Download:</span>
              <span
                className={`font-semibold ${
                  autoDownloadConfig.enabled ? 'text-cyan-300' : 'text-slate-500'
                }`}
              >
                {autoDownloadConfig.enabled
                  ? `ON (${autoDownloadConfig.format.toUpperCase()})`
                  : 'OFF'}
              </span>
            </button>
          ) : (
            <div />
          )}

          <button
            onClick={handleSynthesize}
            disabled={isGenerating || !text.trim()}
            className="relative flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 px-6 py-3 font-semibold text-white shadow-xl shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Synthesizing Expressive Speech...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                <span>Synthesize Speech</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import {
  LANGUAGES,
  VOICES,
  LanguageOption,
  VoiceOption,
} from '@/lib/tts-constants';
import { AudioTrackMetadata } from './AudioWorkstationPlayer';
import {
  Users,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  Wand2,
  Globe,
  Mic,
  MessageSquare,
  Zap,
  Info,
  Play,
  Square,
} from 'lucide-react';
import { dbGetCachedAudition, dbSaveCachedAudition, AutoDownloadConfig } from '@/lib/audio-storage';

interface DialogueLine {
  id: string;
  speaker: string;
  text: string;
  style: string;
}

interface DialogueVoiceStudioProps {
  onAudioGenerated: (track: AudioTrackMetadata) => void;
  customClonedVoices?: VoiceOption[];
  autoDownloadConfig?: AutoDownloadConfig;
  onUpdateAutoDownloadConfig?: (config: AutoDownloadConfig) => void;
}

export default function DialogueVoiceStudio({
  onAudioGenerated,
  customClonedVoices = [],
  autoDownloadConfig,
  onUpdateAutoDownloadConfig,
}: DialogueVoiceStudioProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>(
    LANGUAGES[0]
  );

  // Two speaker profiles
  const [speaker1, setSpeaker1] = useState<{
    name: string;
    voice: VoiceOption;
    defaultStyle: string;
  }>({
    name: 'Alex',
    voice: VOICES[1], // Puck (energetic)
    defaultStyle: 'Enthusiastic and fast-paced podcast host',
  });

  const [speaker2, setSpeaker2] = useState<{
    name: string;
    voice: VoiceOption;
    defaultStyle: string;
  }>({
    name: 'Sam',
    voice: VOICES[0], // Kore (warm)
    defaultStyle: 'Curious, articulate co-host with thoughtful cadence',
  });

  // Script lines
  const [lines, setLines] = useState<DialogueLine[]>([
    {
      id: '1',
      speaker: 'Alex',
      text: 'Welcome back everyone! <breath> Today we are witnessing a genuine leap forward in synthetic speech.',
      style: 'Enthusiastic and welcoming',
    },
    {
      id: '2',
      speaker: 'Sam',
      text: "That's right, Alex. |yeah| It is not just about clear pronunciation anymore—it's about emotional resonance.",
      style: 'Engaged and articulate',
    },
    {
      id: '3',
      speaker: 'Alex',
      text: 'Exactly! <laugh> You can hear subtle breathing, nervous chuckles, and genuine dramatic weight.',
      style: 'Amused and excited',
    },
    {
      id: '4',
      speaker: 'Sam',
      text: 'Listen closely to the pacing... <gasp> It feels alive, doesn’t it?',
      style: 'Whispering with quiet awe',
    },
  ]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState('Tech Podcast Banter');
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const previewAudioRef = React.useRef<HTMLAudioElement | null>(null);

  // Stop audition audio on unmount
  React.useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
    };
  }, []);

  const handleTogglePreview = async (voice: VoiceOption) => {
    if (previewingVoiceId === voice.id) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      setPreviewingVoiceId(null);
      setIsLoadingPreview(false);
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }

    setPreviewingVoiceId(voice.id);
    setIsLoadingPreview(true);

    const cacheKey = `${voice.id}_${voice.auditionQuote}`;

    try {
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
          throw new Error(data.error || 'Failed to load audition preview.');
        }

        audioBase64 = data.audioBase64;
        mimeType = data.mimeType || 'audio/wav';

        if (audioBase64) {
          dbSaveCachedAudition(cacheKey, audioBase64);
        }
      }

      if (!audioBase64) {
        throw new Error('No audio returned for preview');
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
      console.error(err);
      setPreviewingVoiceId(null);
      setIsLoadingPreview(false);
    }
  };

  const addLine = () => {
    const lastSpeaker = lines[lines.length - 1]?.speaker;
    const nextSpeaker = lastSpeaker === speaker1.name ? speaker2.name : speaker1.name;
    setLines((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        speaker: nextSpeaker,
        text: '',
        style: '',
      },
    ]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 2) {
      setErrorMsg('Dialogue must contain at least 2 lines.');
      return;
    }
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const updateLine = (id: string, field: keyof DialogueLine, value: string) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  };

  const insertTagToLine = (id: string, tag: string) => {
    setLines((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, text: l.text ? `${l.text} ${tag}` : tag } : l
      )
    );
  };

  // AI Scenario Generator
  const handleGenerateAiDialogue = async () => {
    setIsAiGenerating(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/tts/script-director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_sample',
          mode: 'dialogue',
          genre: selectedGenre,
          language: selectedLanguage.name,
        }),
      });

      const data = await res.json();
      if (data.dialogueParts && Array.isArray(data.dialogueParts)) {
        const formatted = data.dialogueParts.map((item: any) => ({
          id: Math.random().toString(),
          speaker: item.speaker || speaker1.name,
          text: item.text || '',
          style: item.style || '',
        }));
        setLines(formatted);
      } else if (data.error) {
        setErrorMsg(data.error);
      }
    } catch (err: any) {
      setErrorMsg('Failed to generate dialogue scene: ' + err.message);
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Synthesize Dialogue
  const handleSynthesizeDialogue = async () => {
    // Validate lines
    for (const l of lines) {
      if (!l.text.trim()) {
        setErrorMsg('All dialogue lines must contain text.');
        return;
      }
    }

    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const allVoices = [...customClonedVoices, ...VOICES];
      const spk1Voice =
        allVoices.find((v) => v.id === speaker1.voice.id) || speaker1.voice;
      const spk2Voice =
        allVoices.find((v) => v.id === speaker2.voice.id) || speaker2.voice;

      let spk1Style = speaker1.defaultStyle;
      if (spk1Voice.personaPrompt) {
        spk1Style = spk1Style
          ? `${spk1Voice.personaPrompt}. ${spk1Style}`
          : spk1Voice.personaPrompt;
      }

      let spk2Style = speaker2.defaultStyle;
      if (spk2Voice.personaPrompt) {
        spk2Style = spk2Style
          ? `${spk2Voice.personaPrompt}. ${spk2Style}`
          : spk2Voice.personaPrompt;
      }

      const speakersPayload = [
        {
          speaker: speaker1.name,
          voice: spk1Voice.baseVoice || spk1Voice.id,
          style: spk1Style,
        },
        {
          speaker: speaker2.name,
          voice: spk2Voice.baseVoice || spk2Voice.id,
          style: spk2Style,
        },
      ];

      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'dialogue',
          dialogueParts: lines.map((l) => ({
            speaker: l.speaker,
            text: l.text,
            style: l.style,
          })),
          speakers: speakersPayload,
          language: selectedLanguage.name,
          model: 'gemini-3.8-flash-tts',
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to synthesize dialogue.');
      }

      onAudioGenerated({
        audioBase64: data.audioBase64,
        mimeType: data.mimeType || 'audio/wav',
        voice: `${speaker1.name} (${speaker1.voice.name}) & ${speaker2.name} (${speaker2.voice.name})`,
        language: selectedLanguage.name,
        style: 'Dual-Speaker Screenplay with Backchanneling',
        model: 'gemini-3.8-flash-tts',
        textSnippet: `${lines[0]?.speaker}: "${lines[0]?.text}" ... [${lines.length} lines]`,
        timestamp: Date.now(),
      });
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error generating dialogue audio.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Language & AI Scene Generator Bar */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-semibold text-slate-200">
              Dialogue Language:
            </span>
            <select
              value={selectedLanguage.code}
              onChange={(e) => {
                const found = LANGUAGES.find((l) => l.code === e.target.value);
                if (found) setSelectedLanguage(found);
              }}
              aria-label="Select dialogue language"
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.flag} {lang.name} ({lang.nativeName})
                </option>
              ))}
            </select>
          </div>

          {/* AI Script Scene Inspirer */}
          <div className="flex items-center gap-2">
            <select
              value={selectedGenre}
              onChange={(e) => setSelectedGenre(e.target.value)}
              aria-label="Select dialogue genre"
              className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value="Tech Podcast Banter">Tech Podcast Banter</option>
              <option value="Sci-Fi Detective Mystery">
                Sci-Fi Detective Mystery
              </option>
              <option value="Emotional Heartfelt Reunion">
                Emotional Heartfelt Reunion
              </option>
              <option value="Snarky Comedy Sketch">Snarky Comedy Sketch</option>
              <option value="High-Stakes Debate">High-Stakes Debate</option>
            </select>

            <button
              onClick={handleGenerateAiDialogue}
              disabled={isAiGenerating}
              className="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-950/40 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-cyan-900/50 hover:text-white disabled:opacity-50 transition-colors"
            >
              {isAiGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}
              <span>{isAiGenerating ? 'Drafting...' : 'AI Generate Scene'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Speaker Cast Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Speaker 1 */}
        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-white text-xs font-bold">
                1
              </span>
              <h4 className="text-sm font-semibold text-white">
                Speaker Profile A
              </h4>
            </div>
            <span className="text-xs text-indigo-400 font-mono">
              Voice: {speaker1.voice.name}
            </span>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">
                Character Name in Script:
              </label>
              <input
                type="text"
                value={speaker1.name}
                onChange={(e) => {
                  const newName = e.target.value;
                  const oldName = speaker1.name;
                  setSpeaker1((prev) => ({ ...prev, name: newName }));
                  // update lines matching old name
                  setLines((prev) =>
                    prev.map((l) =>
                      l.speaker === oldName ? { ...l, speaker: newName } : l
                    )
                  );
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">
                Assigned Voice:
              </label>
              <select
                value={speaker1.voice.id}
                onChange={(e) => {
                  const allV = [...customClonedVoices, ...VOICES];
                  const v = allV.find((voice) => voice.id === e.target.value);
                  if (v) setSpeaker1((prev) => ({ ...prev, voice: v }));
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                {customClonedVoices.length > 0 && (
                  <optgroup label="My Cloned Voices">
                    {customClonedVoices.map((v) => (
                      <option key={v.id} value={v.id}>
                        ✦ {v.name} (Cloned)
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Character Voices">
                  {VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.gender} - {v.tone})
                    </option>
                  ))}
                </optgroup>
              </select>
              <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-indigo-500/20">
                <span className="text-[10px] text-slate-400 truncate max-w-[170px]" title={speaker1.voice.sampleEmotion}>
                  {speaker1.voice.sampleEmotion}
                </span>
                <button
                  type="button"
                  onClick={() => handleTogglePreview(speaker1.voice)}
                  className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer ${
                    previewingVoiceId === speaker1.voice.id
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/40'
                      : 'bg-indigo-900/40 text-indigo-200 hover:text-white hover:bg-indigo-800/60 border border-indigo-500/30'
                  }`}
                  title={`Preview audition for ${speaker1.voice.name}`}
                >
                  {previewingVoiceId === speaker1.voice.id ? (
                    isLoadingPreview ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Square className="h-2.5 w-2.5 fill-current" />
                        <span>Stop</span>
                      </>
                    )
                  ) : (
                    <>
                      <Play className="h-2.5 w-2.5 fill-current ml-0.5" />
                      <span>Audition Voice</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Speaker 2 */}
        <div className="rounded-2xl border border-violet-500/30 bg-violet-950/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white text-xs font-bold">
                2
              </span>
              <h4 className="text-sm font-semibold text-white">
                Speaker Profile B
              </h4>
            </div>
            <span className="text-xs text-violet-400 font-mono">
              Voice: {speaker2.voice.name}
            </span>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">
                Character Name in Script:
              </label>
              <input
                type="text"
                value={speaker2.name}
                onChange={(e) => {
                  const newName = e.target.value;
                  const oldName = speaker2.name;
                  setSpeaker2((prev) => ({ ...prev, name: newName }));
                  // update lines matching old name
                  setLines((prev) =>
                    prev.map((l) =>
                      l.speaker === oldName ? { ...l, speaker: newName } : l
                    )
                  );
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-white focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-400 block mb-1">
                Assigned Voice:
              </label>
              <select
                value={speaker2.voice.id}
                onChange={(e) => {
                  const allV = [...customClonedVoices, ...VOICES];
                  const v = allV.find((voice) => voice.id === e.target.value);
                  if (v) setSpeaker2((prev) => ({ ...prev, voice: v }));
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-white focus:border-violet-500 focus:outline-none"
              >
                {customClonedVoices.length > 0 && (
                  <optgroup label="My Cloned Voices">
                    {customClonedVoices.map((v) => (
                      <option key={v.id} value={v.id}>
                        ✦ {v.name} (Cloned)
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Character Voices">
                  {VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.gender} - {v.tone})
                    </option>
                  ))}
                </optgroup>
              </select>
              <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-violet-500/20">
                <span className="text-[10px] text-slate-400 truncate max-w-[170px]" title={speaker2.voice.sampleEmotion}>
                  {speaker2.voice.sampleEmotion}
                </span>
                <button
                  type="button"
                  onClick={() => handleTogglePreview(speaker2.voice)}
                  className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all cursor-pointer ${
                    previewingVoiceId === speaker2.voice.id
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/40'
                      : 'bg-violet-900/40 text-violet-200 hover:text-white hover:bg-violet-800/60 border border-violet-500/30'
                  }`}
                  title={`Preview audition for ${speaker2.voice.name}`}
                >
                  {previewingVoiceId === speaker2.voice.id ? (
                    isLoadingPreview ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Square className="h-2.5 w-2.5 fill-current" />
                        <span>Stop</span>
                      </>
                    )
                  ) : (
                    <>
                      <Play className="h-2.5 w-2.5 fill-current ml-0.5" />
                      <span>Audition Voice</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Screenplay Lines Editor */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-200">
              Screenplay Sequence ({lines.length} turns)
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Supports dialogue backchanneling like <code className="text-cyan-300">|yeah|</code>, <code className="text-cyan-300">|mhm|</code>, and bursts like <code className="text-cyan-300">&lt;laugh&gt;</code>
          </span>
        </div>

        <div className="space-y-3">
          {lines.map((line, idx) => {
            const isSpeaker1 = line.speaker === speaker1.name;
            return (
              <div
                key={line.id}
                className={`relative rounded-xl border p-3.5 transition-all ${
                  isSpeaker1
                    ? 'border-indigo-500/30 bg-indigo-950/15'
                    : 'border-violet-500/30 bg-violet-950/15'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-500">
                      #{idx + 1}
                    </span>
                    <select
                      value={line.speaker}
                      onChange={(e) =>
                        updateLine(line.id, 'speaker', e.target.value)
                      }
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none border ${
                        isSpeaker1
                          ? 'border-indigo-500/40 bg-indigo-900/50 text-indigo-200'
                          : 'border-violet-500/40 bg-violet-900/50 text-violet-200'
                      }`}
                    >
                      <option value={speaker1.name}>{speaker1.name} (A)</option>
                      <option value={speaker2.name}>{speaker2.name} (B)</option>
                    </select>
                  </div>

                  {/* Soundtag helpers */}
                  <div className="flex items-center gap-1">
                    {['<breath>', '<laugh>', '<gasp>', '|yeah|', '|mhm|'].map(
                      (tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => insertTagToLine(line.id, tag)}
                          className="rounded px-1.5 py-0.5 text-[10px] font-mono text-cyan-300 hover:bg-cyan-950 border border-slate-700/60"
                        >
                          {tag}
                        </button>
                      )
                    )}
                    <button
                      onClick={() => removeLine(line.id)}
                      className="ml-2 rounded p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/50 transition-colors"
                      title="Delete line"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Spoken Text */}
                <input
                  type="text"
                  value={line.text}
                  onChange={(e) => updateLine(line.id, 'text', e.target.value)}
                  placeholder={`What does ${line.speaker} say?`}
                  className="w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-400 focus:outline-none"
                />

                {/* Emotional direction */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 shrink-0">
                    Acting direction:
                  </span>
                  <input
                    type="text"
                    value={line.style}
                    onChange={(e) =>
                      updateLine(line.id, 'style', e.target.value)
                    }
                    placeholder="e.g. Whispering softly with suspense, or Amused with gentle chuckle"
                    className="flex-1 rounded border border-slate-800 bg-slate-900/60 px-2 py-1 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-slate-600"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Add turn button */}
        <div className="flex justify-start">
          <button
            onClick={addLine}
            className="flex items-center gap-1.5 rounded-xl border border-dashed border-slate-700 bg-slate-800/40 px-4 py-2 text-xs font-medium text-slate-300 hover:border-indigo-500 hover:text-white hover:bg-indigo-950/20 transition-all"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Dialogue Turn</span>
          </button>
        </div>

        {/* Error message */}
        {errorMsg && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300 flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
            <div>{errorMsg}</div>
          </div>
        )}

        {/* Synthesize Screenplay & Auto-Download Quick Switch */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
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
                  ? `Auto-download is ON (${autoDownloadConfig.format.toUpperCase()}). Every synthesized dialogue is immediately downloaded.`
                  : 'Turn ON auto-download for newly synthesized dialogues'
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
            onClick={handleSynthesizeDialogue}
            disabled={isGenerating}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-3 font-semibold text-white shadow-xl shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Synthesizing Screenplay Audio...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-5 w-5" />
                <span>Synthesize Dual-Speaker Dialogue</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

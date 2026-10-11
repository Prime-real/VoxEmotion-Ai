'use client';

import React, { useState, useRef, useEffect } from 'react';
import { VoiceOption } from '@/lib/tts-constants';
import {
  Dna,
  Mic,
  Upload,
  Square,
  Play,
  Sparkles,
  Loader2,
  Trash2,
  Check,
  Radio,
  FileAudio,
  Wand2,
  Sliders,
  Info,
} from 'lucide-react';

interface VoiceCloningStudioProps {
  clonedVoices: VoiceOption[];
  onSaveClonedVoice: (voice: VoiceOption) => void;
  onDeleteClonedVoice: (id: string) => void;
  onSelectForStudio: (voice: VoiceOption) => void;
}

const INSPIRATION_TEMPLATES = [
  {
    name: 'Gravelly Noir Detective',
    desc: 'World-weary 1940s private investigator with smoky rasp, deliberate cadence and cynical undertones.',
  },
  {
    name: 'French Bistro Storyteller',
    desc: 'Warm charismatic French conversationalist with melodic accent, gentle chuckles and thoughtful pauses.',
  },
  {
    name: 'Cyberpunk Android Co-Pilot',
    desc: 'Calculated synthetic female navigator with crystalline precision, subtle vocal fry and cool detachment.',
  },
  {
    name: 'Deep Fantasy Warlock',
    desc: 'Ancient mysterious spellcaster with resonant reverberating baritone, chant-like rhythmic cadence.',
  },
  {
    name: 'Mindfulness Meditation Guide',
    desc: 'Ultra-gentle soothing wellness coach with close-mic breathy whisper, meditative cadence and calming presence.',
  },
];

export default function VoiceCloningStudio({
  clonedVoices,
  onSaveClonedVoice,
  onDeleteClonedVoice,
  onSelectForStudio,
}: VoiceCloningStudioProps) {
  const [cloneMode, setCloneMode] = useState<'audio' | 'description'>('audio');
  const [cloneName, setCloneName] = useState('');
  const [voiceDescription, setVoiceDescription] = useState('');

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // File upload state
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Analysis / Result state
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatedClone, setGeneratedClone] = useState<VoiceOption | null>(null);
  const [isPreviewingResult, setIsPreviewingResult] = useState(false);
  const [previewingSavedVoiceId, setPreviewingSavedVoiceId] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (previewAudioRef.current) previewAudioRef.current.pause();
    };
  }, [audioUrl]);

  // Start Mic Recording
  const startRecording = async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev >= 20) {
            stopRecording();
            return 20;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      setErrorMessage(
        'Microphone permission denied or device not found: ' + err.message
      );
    }
  };

  // Stop Mic Recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  // Handle Audio File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes('audio')) {
      setErrorMessage('Please select a valid audio file (.wav, .mp3, .m4a, .ogg).');
      return;
    }

    setUploadedFileName(file.name);
    setAudioBlob(file);
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    if (!cloneName) {
      setCloneName(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  // Run Voice Cloning
  const handleRunClone = async () => {
    setIsProcessing(true);
    setErrorMessage(null);
    setGeneratedClone(null);

    try {
      let bodyPayload: any = {
        mode: cloneMode,
        desiredName: cloneName.trim() || 'My Cloned Voice',
      };

      if (cloneMode === 'audio') {
        if (!audioBlob) {
          throw new Error('Please record or upload an audio sample first.');
        }

        // Convert blob to base64
        const arrayBuffer = await audioBlob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Audio = btoa(binary);

        bodyPayload.audioBase64 = base64Audio;
        bodyPayload.audioMimeType = audioBlob.type || 'audio/wav';
      } else {
        if (!voiceDescription.trim()) {
          throw new Error('Please enter a voice description to design.');
        }
        bodyPayload.voiceDescription = voiceDescription.trim();
      }

      const res = await fetch('/api/tts/voice-clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Voice cloning failed.');
      }

      const profile = data.cloneProfile;
      const newVoice: VoiceOption = {
        id: profile.id,
        name: profile.name,
        baseVoice: profile.baseVoice,
        gender: profile.gender,
        category: 'Cloned & Custom',
        tone: `${profile.timbre} • ${profile.cadence}`,
        bestFor: 'Custom Cloned Voice Synthesizer',
        avatarColor: profile.avatarColor || 'from-fuchsia-600 to-indigo-600',
        sampleEmotion: profile.accent || 'Natural expression',
        auditionQuote: profile.auditionQuote,
        personaPrompt: profile.personaPrompt,
        isCloned: true,
      };

      setGeneratedClone(newVoice);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error occurred during voice cloning.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Preview the newly cloned voice
  const handlePreviewClone = async () => {
    if (!generatedClone) return;

    if (isPreviewingResult) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      setIsPreviewingResult(false);
      return;
    }

    setIsPreviewingResult(true);

    try {
      const res = await fetch('/api/tts/preview-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: generatedClone.id,
          baseVoice: generatedClone.baseVoice || 'Zephyr',
          style: generatedClone.sampleEmotion,
          personaPrompt: generatedClone.personaPrompt,
          auditionQuote: generatedClone.auditionQuote,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Preview synthesis failed.');
      }

      const audio = new Audio(
        `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`
      );
      previewAudioRef.current = audio;

      audio.onended = () => setIsPreviewingResult(false);
      audio.onerror = () => setIsPreviewingResult(false);

      await audio.play();
    } catch (err: any) {
      console.error(err);
      setIsPreviewingResult(false);
    }
  };

  const handlePreviewSavedVoice = async (voice: VoiceOption) => {
    if (previewingSavedVoiceId === voice.id) {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
        previewAudioRef.current = null;
      }
      setPreviewingSavedVoiceId(null);
      return;
    }

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }

    setPreviewingSavedVoiceId(voice.id);

    try {
      const res = await fetch('/api/tts/preview-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voiceId: voice.id,
          baseVoice: voice.baseVoice || 'Zephyr',
          style: voice.sampleEmotion,
          personaPrompt: voice.personaPrompt,
          auditionQuote: voice.auditionQuote,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Preview failed.');
      }

      const audio = new Audio(
        `data:${data.mimeType || 'audio/wav'};base64,${data.audioBase64}`
      );
      previewAudioRef.current = audio;

      audio.onended = () => setPreviewingSavedVoiceId(null);
      audio.onerror = () => setPreviewingSavedVoiceId(null);

      await audio.play();
    } catch (err) {
      console.error(err);
      setPreviewingSavedVoiceId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Banner */}
      <div className="rounded-2xl border border-fuchsia-500/30 bg-gradient-to-r from-slate-900 via-fuchsia-950/20 to-slate-900 p-6 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-fuchsia-600 via-purple-600 to-indigo-500 text-white shadow-lg shadow-fuchsia-600/30">
              <Dna className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Voice Cloning &amp; Custom Voice Designer
                <span className="rounded-full bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-300 border border-fuchsia-500/30">
                  Gemini Voice Engine
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Clone a voice from an audio sample or prompt-design custom vocal
                personas with unique acoustic timbres, accents, and cadences.
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs font-medium">
            <button
              onClick={() => {
                setCloneMode('audio');
                setGeneratedClone(null);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                cloneMode === 'audio'
                  ? 'bg-fuchsia-600 text-white font-semibold shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mic className="h-3.5 w-3.5" />
              <span>Clone from Audio</span>
            </button>
            <button
              onClick={() => {
                setCloneMode('description');
                setGeneratedClone(null);
              }}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                cloneMode === 'description'
                  ? 'bg-fuchsia-600 text-white font-semibold shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Wand2 className="h-3.5 w-3.5" />
              <span>Design from Description</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Cloning Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Form (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Custom Voice Name:
            </label>
            <input
              type="text"
              value={cloneName}
              onChange={(e) => setCloneName(e.target.value)}
              placeholder="e.g. Liam - Irish Storyteller, or Cyberpunk Navigator"
              className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-fuchsia-500 focus:outline-none"
            />
          </div>

          {/* Method A: Audio Recording & Upload */}
          {cloneMode === 'audio' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  <Mic className="h-4 w-4 text-fuchsia-400" />
                  <span>Option 1: Record Voice with Microphone (5-15s)</span>
                </h4>

                <div className="flex flex-wrap items-center gap-3">
                  {isRecording ? (
                    <button
                      onClick={stopRecording}
                      className="flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-rose-600/30 animate-pulse transition-all cursor-pointer"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" />
                      <span>Stop Recording ({recordingSeconds}s)</span>
                    </button>
                  ) : (
                    <button
                      onClick={startRecording}
                      className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
                    >
                      <Mic className="h-3.5 w-3.5" />
                      <span>Start Mic Recording</span>
                    </button>
                  )}

                  {recordingSeconds > 0 && !isRecording && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
                      <Check className="h-3.5 w-3.5" />
                      Recorded {recordingSeconds}s audio sample
                    </span>
                  )}
                </div>
              </div>

              {/* Option 2: Upload File */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2.5 flex items-center gap-2">
                  <Upload className="h-4 w-4 text-cyan-400" />
                  <span>Option 2: Upload Audio File (.wav, .mp3, .m4a)</span>
                </h4>

                <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-4 hover:border-fuchsia-500 hover:bg-slate-900 cursor-pointer transition-colors">
                  <FileAudio className="h-6 w-6 text-slate-400 mb-1" />
                  <span className="text-xs font-medium text-slate-300">
                    {uploadedFileName || 'Choose or drop audio file'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">
                    Clear speech samples without heavy background music work best
                  </span>
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Playback recorded or uploaded audio */}
              {audioUrl && (
                <div className="flex items-center justify-between rounded-xl bg-slate-950 p-3 border border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-300 font-mono">
                    <Radio className="h-4 w-4 text-fuchsia-400 animate-pulse" />
                    <span>Sample loaded & ready for acoustic profiling</span>
                  </div>
                  <audio src={audioUrl} controls className="h-7 w-48" />
                </div>
              )}
            </div>
          )}

          {/* Method B: Description & Persona Prompting */}
          {cloneMode === 'description' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Describe Voice Persona &amp; Acoustic Characteristics:
                </label>
                <textarea
                  rows={4}
                  value={voiceDescription}
                  onChange={(e) => setVoiceDescription(e.target.value)}
                  placeholder="e.g. A 45-year-old Scottish starship navigator with a warm, smoky baritone rasp, speaking with deliberate calmness, gentle chuckles, and subtle Scottish dialect nuances."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 p-3 text-xs text-white placeholder-slate-500 focus:border-fuchsia-500 focus:outline-none leading-relaxed"
                />
              </div>

              {/* Inspiration Chips */}
              <div>
                <span className="text-[11px] font-medium text-slate-400 block mb-1.5">
                  Or pick an inspiration archetype:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {INSPIRATION_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.name}
                      type="button"
                      onClick={() => {
                        setCloneName(tmpl.name);
                        setVoiceDescription(tmpl.desc);
                      }}
                      className="rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-1 text-[11px] text-fuchsia-300 hover:bg-fuchsia-950/40 hover:border-fuchsia-500/50 transition-colors cursor-pointer"
                    >
                      {tmpl.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error notice */}
          {errorMessage && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300 flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Clone Action Button */}
          <div className="pt-2 flex justify-end">
            <button
              onClick={handleRunClone}
              disabled={
                isProcessing ||
                (cloneMode === 'audio' && !audioBlob) ||
                (cloneMode === 'description' && !voiceDescription.trim())
              }
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-6 py-2.5 font-semibold text-xs text-white shadow-xl shadow-fuchsia-600/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analyzing &amp; Calibrating Voice Clone...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Synthesize Voice Clone</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Cloned Voice Result & Saved Library (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* New Clone Profile Card (if generated) */}
          {generatedClone && (
            <div className="rounded-2xl border-2 border-fuchsia-500 bg-fuchsia-950/20 p-5 shadow-xl shadow-fuchsia-950/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="rounded bg-fuchsia-500/20 px-2 py-0.5 text-[10px] font-bold text-fuchsia-300 uppercase tracking-wider">
                  Clone Generated Successfully!
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Base: {generatedClone.baseVoice}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr ${generatedClone.avatarColor} text-white font-bold text-sm shadow-md`}
                >
                  {generatedClone.name[0]}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    {generatedClone.name}
                  </h4>
                  <p className="text-xs text-slate-300">
                    {generatedClone.tone}
                  </p>
                </div>
              </div>

              {/* Directorial Persona Prompt */}
              {generatedClone.personaPrompt && (
                <div className="rounded-lg bg-slate-950/80 p-2.5 text-[11px] text-slate-300 border border-slate-800">
                  <span className="text-slate-500 font-semibold block mb-0.5">
                    Directorial Tuning:
                  </span>
                  &ldquo;{generatedClone.personaPrompt}&rdquo;
                </div>
              )}

              {/* Audition Quote */}
              <div className="rounded-lg bg-slate-950/80 p-2.5 text-[11px] text-slate-400 border border-slate-800 italic">
                <span className="text-slate-500 font-semibold not-italic block mb-0.5">
                  Sample Audition Line:
                </span>
                &ldquo;{generatedClone.auditionQuote}&rdquo;
              </div>

              {/* Audition & Save Buttons */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handlePreviewClone}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-950/50 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-900/60 transition-colors cursor-pointer"
                >
                  {isPreviewingResult ? (
                    <>
                      <Square className="h-3.5 w-3.5 fill-current" />
                      <span>Stop Audition</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Audition Voice</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onSaveClonedVoice(generatedClone);
                    onSelectForStudio(generatedClone);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 py-2 text-xs font-semibold text-white shadow-md shadow-fuchsia-600/30 transition-all cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Save &amp; Use</span>
                </button>
              </div>
            </div>
          )}

          {/* Saved Cloned Voices Roster */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center justify-between">
              <span>My Cloned Voices ({clonedVoices.length})</span>
              <span className="text-[10px] text-slate-500 font-normal">
                Persisted in Studio
              </span>
            </h4>

            {clonedVoices.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">
                No cloned voices saved yet. Record an audio sample or describe a
                voice above to create your first clone!
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {clonedVoices.map((voice) => (
                  <div
                    key={voice.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 p-2.5 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr ${voice.avatarColor} text-white font-bold text-xs`}
                      >
                        {voice.name[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-white truncate">
                            {voice.name}
                          </span>
                          <span className="rounded bg-fuchsia-500/20 px-1 py-0.2 text-[9px] text-fuchsia-300 font-mono">
                            CLONE
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate">
                          {voice.tone}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => handlePreviewSavedVoice(voice)}
                        className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                          previewingSavedVoiceId === voice.id
                            ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/30'
                            : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                        }`}
                        title="Audition cloned voice sample"
                      >
                        {previewingSavedVoiceId === voice.id ? (
                          <>
                            <Square className="h-2.5 w-2.5 fill-current" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-2.5 w-2.5 fill-current ml-0.5" />
                            <span>Audition</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => onSelectForStudio(voice)}
                        className="rounded-lg bg-indigo-600/20 hover:bg-indigo-600 px-2 py-1 text-[11px] font-medium text-indigo-300 hover:text-white transition-colors cursor-pointer"
                        title="Use this cloned voice in studio"
                      >
                        Select
                      </button>
                      <button
                        onClick={() => onDeleteClonedVoice(voice.id)}
                        className="rounded-lg p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete cloned voice"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

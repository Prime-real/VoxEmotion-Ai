'use client';

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Download,
  Repeat,
  Gauge,
  Radio,
  Share2,
  Check,
  ChevronDown,
  Loader2,
  Sparkles,
  Zap,
  Globe,
  Mic,
  Smile,
  FileAudio,
  Sliders,
  Square,
} from 'lucide-react';
import {
  dbGetCachedAudition,
  dbSaveCachedAudition,
  AutoDownloadConfig,
  getAutoDownloadConfig,
  saveAutoDownloadConfig,
  triggerAudioDownload,
} from '@/lib/audio-storage';
import {
  VOICES,
  LANGUAGES,
  EMOTION_PRESETS,
  VOCAL_TAGS,
  VoiceOption,
} from '@/lib/tts-constants';

export interface AudioTrackMetadata {
  audioBase64: string;
  mimeType?: string;
  voice: string;
  language: string;
  style?: string;
  model: string;
  title?: string;
  textSnippet?: string;
  timestamp?: number;
}

export type ExportFormat = 'wav' | 'mp3' | 'aac' | 'flac' | 'ogg';

interface AudioWorkstationPlayerProps {
  track: AudioTrackMetadata | null;
  onAudioGenerated?: (track: AudioTrackMetadata) => void;
  onClear?: () => void;
  customClonedVoices?: VoiceOption[];
  autoDownloadConfig?: AutoDownloadConfig;
  onUpdateAutoDownloadConfig?: (config: AutoDownloadConfig) => void;
}

export default function AudioWorkstationPlayer({
  track,
  onAudioGenerated,
  customClonedVoices = [],
  autoDownloadConfig,
  onUpdateAutoDownloadConfig,
}: AudioWorkstationPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const freqDataRef = useRef<Uint8Array | null>(null);
  const gradientRef = useRef<CanvasGradient | null>(null);

  // Playback State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [copied, setCopied] = useState(false);
  const [vuMeter, setVuMeter] = useState({ left: 0, right: 0 });

  // Export State
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('mp3');
  const [selectedBitrate, setSelectedBitrate] = useState<'128k' | '192k' | '256k' | '320k'>('192k');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Auto-Download Exported Voice State
  const [localAutoDownload, setLocalAutoDownload] = useState<AutoDownloadConfig>(() =>
    autoDownloadConfig || getAutoDownloadConfig()
  );

  const activeAutoDownload = autoDownloadConfig || localAutoDownload;

  const handleToggleAutoDownload = () => {
    const nextState = !activeAutoDownload.enabled;
    const updated: AutoDownloadConfig = {
      ...activeAutoDownload,
      enabled: nextState,
    };
    if (onUpdateAutoDownloadConfig) {
      onUpdateAutoDownloadConfig(updated);
    } else {
      setLocalAutoDownload(updated);
      saveAutoDownloadConfig(updated);
    }
    setExportNotice(
      nextState
        ? `⚡ Auto-download enabled (${updated.format.toUpperCase()}). Every synthesized voice will automatically download!`
        : 'Auto-download voice disabled.'
    );
    setTimeout(() => setExportNotice(null), 3500);
  };

  const handleSetAutoDownloadFormat = (fmt: ExportFormat) => {
    const updated: AutoDownloadConfig = {
      ...activeAutoDownload,
      format: fmt,
    };
    if (onUpdateAutoDownloadConfig) {
      onUpdateAutoDownloadConfig(updated);
    } else {
      setLocalAutoDownload(updated);
      saveAutoDownloadConfig(updated);
    }
    setExportNotice(`Auto-download format updated to ${fmt.toUpperCase()}`);
    setTimeout(() => setExportNotice(null), 2500);
  };

  // Prompt Box State
  const [showPromptBox, setShowPromptBox] = useState(true);
  const [prevTrackTimestamp, setPrevTrackTimestamp] = useState<number | undefined>(
    track?.timestamp
  );
  const [promptScript, setPromptScript] = useState<string>(
    track?.textSnippet ||
      'Listen closely... <breath> In the darkest corner of the universe, a new star has just ignited.'
  );
  const [promptVoice, setPromptVoice] = useState<string>(track?.voice || 'Zephyr');
  const [promptLanguage, setPromptLanguage] = useState<string>(track?.language || 'English');
  const [promptStyle, setPromptStyle] = useState<string>(
    track?.style || 'Suspenseful whisper building into dramatic awe'
  );
  const [isSynthesizingPrompt, setIsSynthesizingPrompt] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
  const [isLoadingVoicePreview, setIsLoadingVoicePreview] = useState(false);
  const previewVoiceAudioRef = useRef<HTMLAudioElement | null>(null);

  // Stop audition audio on unmount
  useEffect(() => {
    return () => {
      if (previewVoiceAudioRef.current) {
        previewVoiceAudioRef.current.pause();
        previewVoiceAudioRef.current = null;
      }
    };
  }, []);

  // Sync state during render when a new track is passed in
  if (track?.timestamp !== prevTrackTimestamp) {
    setPrevTrackTimestamp(track?.timestamp);
    if (track?.textSnippet) {
      setPromptScript(track.textSnippet);
    }
    if (track?.voice) {
      setPromptVoice(track.voice);
    }
    if (track?.language) {
      setPromptLanguage(track.language);
    }
    if (track?.style) {
      setPromptStyle(track.style);
    }
  }

  // Derive audio URL via useMemo
  const audioUrl = useMemo(() => {
    if (!track?.audioBase64) return null;
    try {
      const byteCharacters = atob(track.audioBase64);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([byteNumbers], {
        type: track.mimeType || 'audio/wav',
      });
      return URL.createObjectURL(blob);
    } catch (err) {
      console.error('Error decoding audio base64:', err);
      return null;
    }
  }, [track]);

  // Revoke object URL when audioUrl changes or unmounts
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  // Attach Web Audio API Analyser
  const setupAudioContext = useCallback(() => {
    if (!audioRef.current) return;
    if (audioContextRef.current) return;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.85;

      const source = ctx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceNodeRef.current = source;
    } catch (err) {
      console.warn('Web Audio API analyser could not be attached:', err);
    }
  }, []);

  // Visualizer render loop with pre-allocated buffer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Cache gradient
    if (!gradientRef.current) {
      const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
      grad.addColorStop(0, '#6366f1');
      grad.addColorStop(0.5, '#a855f7');
      grad.addColorStop(1, '#06b6d4');
      gradientRef.current = grad;
    }

    let frameCount = 0;
    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // Background grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      for (let y = 10; y < height; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (analyserRef.current && isPlaying) {
        const bufferLength = analyserRef.current.frequencyBinCount;
        if (!freqDataRef.current || freqDataRef.current.length !== bufferLength) {
          freqDataRef.current = new Uint8Array(bufferLength);
        }
        const dataArray = freqDataRef.current;
        (analyserRef.current as AnalyserNode).getByteFrequencyData(dataArray as unknown as Uint8Array<ArrayBuffer>);

        // Calculate peak level for visual VU meter every 3 frames
        frameCount++;
        if (frameCount % 3 === 0) {
          let leftSum = 0;
          let rightSum = 0;
          const half = Math.floor(bufferLength / 2);
          for (let i = 0; i < half; i++) leftSum += dataArray[i];
          for (let i = half; i < bufferLength; i++) rightSum += dataArray[i];
          const lAvg = leftSum / half / 255;
          const rAvg = rightSum / (bufferLength - half) / 255;
          setVuMeter({
            left: Math.min(100, Math.round(lAvg * 130)),
            right: Math.min(100, Math.round(rAvg * 130)),
          });
        }

        const barCount = 38;
        const barWidth = width / barCount - 3;
        let x = 0;

        for (let i = 0; i < barCount; i++) {
          const dataIndex = Math.floor((i / barCount) * (bufferLength * 0.75));
          const val = dataArray[dataIndex] || 0;
          const barHeight = Math.max(4, (val / 255) * (height - 12));

          ctx.fillStyle = gradientRef.current || '#6366f1';
          const yPos = height - barHeight;

          ctx.beginPath();
          ctx.roundRect(x, yPos, barWidth, barHeight, [3, 3, 1, 1]);
          ctx.fill();

          if (barHeight > 18) {
            ctx.fillStyle = '#22d3ee';
            ctx.fillRect(x + barWidth / 2 - 1.5, yPos - 3, 3, 2);
          }

          x += barWidth + 3;
        }
      } else {
        const barCount = 38;
        const barWidth = width / barCount - 3;
        let x = 0;

        for (let i = 0; i < barCount; i++) {
          const progress = duration > 0 ? currentTime / duration : 0;
          const isPassed = i / barCount <= progress;
          const waveHeight = isPlaying
            ? Math.sin(Date.now() * 0.005 + i * 0.3) * 12 + 16
            : 6;

          ctx.fillStyle = isPassed
            ? 'rgba(99, 102, 241, 0.7)'
            : 'rgba(71, 85, 105, 0.4)';
          ctx.beginPath();
          ctx.roundRect(
            x,
            height / 2 - waveHeight / 2,
            barWidth,
            waveHeight,
            [2, 2, 2, 2]
          );
          ctx.fill();

          x += barWidth + 3;
        }
      }
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, currentTime, duration]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;

    setupAudioContext();
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true));
    }
  }, [audioUrl, isPlaying, setupAudioContext]);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.muted = false;
      setIsMuted(false);
    } else {
      audioRef.current.muted = true;
      setIsMuted(true);
    }
  }, [isMuted]);

  // Pro Audio Workstation Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.code === 'Space' || e.key === 'k') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft' || e.key === 'j') {
        e.preventDefault();
        if (audioRef.current) {
          audioRef.current.currentTime = Math.max(
            0,
            audioRef.current.currentTime - 3
          );
          setCurrentTime(audioRef.current.currentTime);
        }
      } else if (e.code === 'ArrowRight' || e.key === 'l') {
        e.preventDefault();
        if (audioRef.current) {
          audioRef.current.currentTime = Math.min(
            duration,
            audioRef.current.currentTime + 3
          );
          setCurrentTime(audioRef.current.currentTime);
        }
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          setCurrentTime(0);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, duration, audioUrl, togglePlay, toggleMute]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = val;
      setCurrentTime(val);
    }
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };


  const toggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    if (audioRef.current) {
      audioRef.current.loop = next;
    }
  };

  // Multi-format audio export (MP3, AAC, WAV, FLAC, OGG)
  const handleExportFormat = async (format: ExportFormat) => {
    if (!track?.audioBase64) return;
    setSelectedFormat(format);
    setShowExportMenu(false);
    setIsExporting(true);
    setExportNotice(`Transcoding to ${format.toUpperCase()}...`);

    try {
      const sanitizedTitle = (track.voice || 'vox')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-');
      const sanitizedLang = (track.language || 'audio')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-');
      const baseFilename = `voxemotion-${sanitizedTitle}-${sanitizedLang}-${Date.now()}`;

      if (format === 'wav') {
        // Direct WAV export from base64
        const byteCharacters = atob(track.audioBase64);
        const byteNumbers = new Uint8Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const blob = new Blob([byteNumbers], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseFilename}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setExportNotice(`Exported ${baseFilename}.wav`);
        setTimeout(() => setExportNotice(null), 3000);
        return;
      }

      // Call conversion API for MP3, AAC, FLAC, OGG
      const res = await fetch('/api/tts/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: track.audioBase64,
          format,
          bitrate: selectedBitrate,
          filename: baseFilename,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || `Failed to convert audio to ${format.toUpperCase()}`);
      }

      // Download the converted base64
      const byteCharacters = atob(data.audioBase64);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([byteNumbers], {
        type: data.mimeType || `audio/${format}`,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || `${baseFilename}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportNotice(`Exported ${data.filename || `${baseFilename}.${format}`}`);
      setTimeout(() => setExportNotice(null), 3000);
    } catch (err: any) {
      console.error('Export error:', err);
      setExportNotice(`Export error: ${err.message}`);
      setTimeout(() => setExportNotice(null), 4000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyLink = () => {
    if (track?.audioBase64) {
      navigator.clipboard.writeText(
        `data:${track.mimeType || 'audio/wav'};base64,${track.audioBase64}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${m}:${s < 10 ? '0' : ''}${s}.${ms}`;
  };

  // Insert Soundtag into Prompt Box
  const handleInsertTagToPrompt = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setPromptScript((prev) => prev + ' ' + tag);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = textarea.value;
    const newText =
      current.substring(0, start) + ' ' + tag + ' ' + current.substring(end);
    setPromptScript(newText);

    setTimeout(() => {
      textarea.focus();
      const nextPos = start + tag.length + 2;
      textarea.setSelectionRange(nextPos, nextPos);
    }, 10);
  };

  // Audition voice from prompt box
  const handleToggleVoiceAudition = async (voiceName: string) => {
    const allVoices = [...customClonedVoices, ...VOICES];
    const voice =
      allVoices.find((v) => v.id === voiceName || v.name === voiceName) ||
      VOICES[0];

    if (previewingVoiceId === voice.id) {
      if (previewVoiceAudioRef.current) {
        previewVoiceAudioRef.current.pause();
        previewVoiceAudioRef.current = null;
      }
      setPreviewingVoiceId(null);
      setIsLoadingVoicePreview(false);
      return;
    }

    if (previewVoiceAudioRef.current) {
      previewVoiceAudioRef.current.pause();
      previewVoiceAudioRef.current = null;
    }

    setPreviewingVoiceId(voice.id);
    setIsLoadingVoicePreview(true);

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
          throw new Error(data.error || 'Failed to load voice audition.');
        }

        audioBase64 = data.audioBase64;
        mimeType = data.mimeType || 'audio/wav';

        if (audioBase64) {
          dbSaveCachedAudition(cacheKey, audioBase64);
        }
      }

      if (!audioBase64) {
        throw new Error('No audio returned for audition');
      }

      const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
      previewVoiceAudioRef.current = audio;

      audio.onended = () => {
        setPreviewingVoiceId(null);
        setIsLoadingVoicePreview(false);
      };
      audio.onerror = () => {
        setPreviewingVoiceId(null);
        setIsLoadingVoicePreview(false);
      };

      await audio.play();
      setIsLoadingVoicePreview(false);
    } catch (err) {
      console.error(err);
      setPreviewingVoiceId(null);
      setIsLoadingVoicePreview(false);
    }
  };

  // Synthesize from workstation prompt box
  const handleSynthesizeFromPrompt = async () => {
    if (!promptScript.trim()) {
      setPromptError('Please enter a script to synthesize.');
      return;
    }

    setIsSynthesizingPrompt(true);
    setPromptError(null);

    try {
      const allVoices = [...customClonedVoices, ...VOICES];
      const matchedVoice = allVoices.find(
        (v) => v.id === promptVoice || v.name === promptVoice
      );

      let effectiveStyle = promptStyle;
      if (matchedVoice?.personaPrompt) {
        effectiveStyle = effectiveStyle
          ? `${matchedVoice.personaPrompt}. ${effectiveStyle}`
          : matchedVoice.personaPrompt;
      }

      const res = await fetch('/api/tts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'solo',
          text: promptScript.trim(),
          voice: matchedVoice?.baseVoice || promptVoice,
          style: effectiveStyle,
          language: promptLanguage,
          model: 'gemini-3.8-flash-tts',
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to synthesize speech.');
      }

      const newTrack: AudioTrackMetadata = {
        audioBase64: data.audioBase64,
        mimeType: data.mimeType || 'audio/wav',
        voice: promptVoice,
        language: promptLanguage,
        style: promptStyle,
        model: 'gemini-3.8-flash-tts',
        textSnippet: promptScript.trim(),
        timestamp: Date.now(),
      };

      if (onAudioGenerated) {
        onAudioGenerated(newTrack);
      }
    } catch (err: any) {
      console.error(err);
      setPromptError(err.message || 'Speech synthesis failed.');
    } finally {
      setIsSynthesizingPrompt(false);
    }
  };

  const wordCount = promptScript.trim()
    ? promptScript.trim().split(/\s+/).length
    : 0;
  const estimatedSeconds = Math.max(1, Math.round((wordCount / 140) * 60));

  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-500/30 bg-slate-900/90 p-5 shadow-2xl shadow-indigo-950/40 backdrop-blur-2xl space-y-4">
      <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-600/15 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-cyan-600/10 blur-3xl" />

      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        loop={isLooping}
      />

      {/* Track Header & Meta */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-lg shadow-indigo-500/25">
            <Radio className="h-5 w-5" />
            {isPlaying && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-500"></span>
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white tracking-wide">
                Voice: {track?.voice || promptVoice}
              </span>
              <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 text-xs font-medium text-indigo-300 border border-indigo-500/20">
                {track?.language || promptLanguage}
              </span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-emerald-500/20">
                24kHz Hi-Fi
              </span>
            </div>
            {(track?.style || promptStyle) && (
              <p className="mt-0.5 text-xs text-slate-400 line-clamp-1 italic">
                Inflection: &ldquo;{track?.style || promptStyle}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* Action icons & Multi-format Export */}
        <div className="flex items-center gap-2 relative">
          <button
            onClick={handleCopyLink}
            disabled={!track}
            title="Copy Base64 Audio URI"
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700/80 hover:text-white disabled:opacity-40 transition-colors"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Share2 className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
          </button>

          {/* Auto-Download Exported Voice Toggle */}
          <button
            onClick={handleToggleAutoDownload}
            title={
              activeAutoDownload.enabled
                ? `Auto-Download is ON (${activeAutoDownload.format.toUpperCase()}). Every synthesized voice will automatically download to your device.`
                : 'Turn ON Auto-Download for synthesized voices'
            }
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
              activeAutoDownload.enabled
                ? 'border-cyan-500/50 bg-cyan-950/60 text-cyan-300 shadow-sm shadow-cyan-500/25 ring-1 ring-cyan-500/40'
                : 'border-slate-800 bg-slate-800/60 text-slate-400 hover:bg-slate-700/80 hover:text-slate-200'
            }`}
          >
            <Zap
              className={`h-3.5 w-3.5 ${
                activeAutoDownload.enabled
                  ? 'text-cyan-400 fill-cyan-400 animate-pulse'
                  : 'text-slate-500'
              }`}
            />
            <span className="hidden sm:inline">Auto-DL:</span>
            <span
              className={`font-semibold ${
                activeAutoDownload.enabled ? 'text-cyan-300' : 'text-slate-400'
              }`}
            >
              {activeAutoDownload.enabled
                ? `ON (${activeAutoDownload.format.toUpperCase()})`
                : 'OFF'}
            </span>
          </button>

          {/* Export Multi-Format Dropdown Button */}
          <div className="relative">
            <div className="flex items-center rounded-lg shadow-md shadow-indigo-600/30 overflow-hidden">
              {/* Primary Download Button for selected format */}
              <button
                onClick={() => handleExportFormat(selectedFormat)}
                disabled={!track || isExporting}
                title={`Export as ${selectedFormat.toUpperCase()}`}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 transition-all cursor-pointer"
              >
                {isExporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span>Export {selectedFormat.toUpperCase()}</span>
              </button>

              {/* Dropdown toggle arrow */}
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={!track}
                title="Choose file format (MP3, AAC, WAV, FLAC, OGG)"
                className="bg-indigo-700 hover:bg-indigo-600 px-2 py-1.5 text-white disabled:opacity-40 border-l border-indigo-500/30 transition-colors cursor-pointer"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Export Menu Dropdown */}
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-slate-700 bg-slate-900/95 p-2.5 shadow-2xl backdrop-blur-2xl z-50">
                <div className="px-2 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  Select Export Format
                </div>

                <div className="py-1 space-y-1">
                  <button
                    onClick={() => handleExportFormat('mp3')}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-slate-200 hover:bg-indigo-600/20 hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-mono text-indigo-300 font-bold">
                        MP3
                      </span>
                      <span>MPEG Audio (.mp3)</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Universal</span>
                  </button>

                  <button
                    onClick={() => handleExportFormat('aac')}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-slate-200 hover:bg-cyan-600/20 hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-mono text-cyan-300 font-bold">
                        AAC
                      </span>
                      <span>Advanced Audio (.aac)</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Hi-Fi</span>
                  </button>

                  <button
                    onClick={() => handleExportFormat('wav')}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-slate-200 hover:bg-emerald-600/20 hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300 font-bold">
                        WAV
                      </span>
                      <span>Master 24kHz RIFF (.wav)</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Raw PCM</span>
                  </button>

                  <button
                    onClick={() => handleExportFormat('flac')}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-slate-200 hover:bg-purple-600/20 hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-mono text-purple-300 font-bold">
                        FLAC
                      </span>
                      <span>Free Lossless (.flac)</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Lossless</span>
                  </button>

                  <button
                    onClick={() => handleExportFormat('ogg')}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium text-slate-200 hover:bg-amber-600/20 hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-mono text-amber-300 font-bold">
                        OGG
                      </span>
                      <span>Ogg Vorbis (.ogg)</span>
                    </div>
                    <span className="text-[10px] text-slate-400">Web/Game</span>
                  </button>
                </div>

                {/* Bitrate Selector for compressed formats */}
                <div className="mt-2 pt-2 border-t border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 px-1">
                    <span>Bitrate Quality:</span>
                    <span className="font-mono text-indigo-300">{selectedBitrate}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-[10px]">
                    {(['128k', '192k', '256k', '320k'] as const).map((b) => (
                      <button
                        key={b}
                        onClick={() => setSelectedBitrate(b)}
                        className={`rounded py-1 font-mono transition-colors ${
                          selectedBitrate === b
                            ? 'bg-indigo-600 text-white font-bold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auto-Download Exported Voice Settings Section */}
                <div className="mt-2.5 pt-2.5 border-t border-slate-800/90">
                  <div className="flex items-center justify-between px-1 mb-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-200">
                      <Zap className={`h-3 w-3 ${activeAutoDownload.enabled ? 'text-cyan-400 fill-cyan-400' : 'text-slate-500'}`} />
                      <span>Auto-Download Exported Voice</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleAutoDownload}
                      className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        activeAutoDownload.enabled ? 'bg-cyan-500' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          activeAutoDownload.enabled ? 'translate-x-3' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                  <p className="px-1 text-[10px] text-slate-400 mb-2 leading-tight">
                    Automatically saves newly generated voices immediately to your computer.
                  </p>
                  <div className="flex items-center gap-1 px-1 flex-wrap">
                    <span className="text-[10px] text-slate-400 mr-1">Format:</span>
                    {(['wav', 'mp3', 'aac', 'flac', 'ogg'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => handleSetAutoDownloadFormat(fmt)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono uppercase transition-colors cursor-pointer ${
                          activeAutoDownload.format === fmt
                            ? 'bg-cyan-600 text-white font-bold ring-1 ring-cyan-400'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Export notification toast */}
      {exportNotice && (
        <div className="rounded-lg bg-indigo-950/60 border border-indigo-500/40 px-3 py-1.5 text-xs text-indigo-200 flex items-center justify-between">
          <span>{exportNotice}</span>
          {isExporting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        </div>
      )}

      {/* Visualizer Canvas & Timeline */}
      <div className="relative overflow-hidden rounded-xl border border-slate-800/90 bg-slate-950/80 p-2">
        <canvas
          ref={canvasRef}
          width={640}
          height={90}
          className="w-full h-[90px] block"
        />

        <div className="absolute top-3 left-4 flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-slate-400">
          <span
            className={`h-2 w-2 rounded-full ${
              isPlaying ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'
            }`}
          />
          <span>{isPlaying ? 'Master Playback' : 'Workstation'}</span>
        </div>

        {/* Real-time Stereo Peak VU Meters */}
        <div className="absolute top-3 right-32 hidden sm:flex items-center gap-2 text-[10px] font-mono text-slate-400">
          <span className="text-slate-500">L</span>
          <div className="h-2 w-16 bg-slate-900 rounded overflow-hidden border border-slate-800 flex">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all duration-75"
              style={{ width: `${vuMeter.left}%` }}
            />
          </div>
          <span className="text-slate-500">R</span>
          <div className="h-2 w-16 bg-slate-900 rounded overflow-hidden border border-slate-800 flex">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-all duration-75"
              style={{ width: `${vuMeter.right}%` }}
            />
          </div>
        </div>

        <div className="absolute top-3 right-4 text-[11px] font-mono text-slate-400">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Scrub Bar */}
      <div>
        <input
          type="range"
          min={0}
          max={duration || 100}
          step={0.01}
          value={currentTime}
          onChange={handleSeek}
          disabled={!audioUrl}
          aria-label="Audio timeline progress"
          className="w-full h-1.5 cursor-pointer appearance-none rounded-lg bg-slate-800 accent-indigo-500 hover:accent-cyan-400 disabled:opacity-40 transition-colors"
        />
      </div>

      {/* Transport Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (audioRef.current) audioRef.current.currentTime = 0;
            }}
            disabled={!audioUrl}
            title="Restart"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-40 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            onClick={togglePlay}
            disabled={!audioUrl}
            aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-lg shadow-indigo-500/30 hover:scale-105 active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
          >
            {isPlaying ? (
              <Pause className="h-5 w-5 fill-current" />
            ) : (
              <Play className="h-5 w-5 fill-current ml-0.5" />
            )}
          </button>

          <button
            onClick={toggleLoop}
            disabled={!audioUrl}
            title={isLooping ? 'Looping enabled' : 'Enable loop'}
            className={`rounded-lg p-2 transition-colors ${
              isLooping
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Repeat className="h-4 w-4" />
          </button>
        </div>

        {/* Speed chips */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-950/60 p-1 border border-slate-800 text-xs">
          <span className="px-1.5 text-[11px] text-slate-500 flex items-center gap-1">
            <Gauge className="h-3 w-3" />
          </span>
          {[0.75, 1.0, 1.25, 1.5].map((rate) => (
            <button
              key={rate}
              onClick={() => handleSpeedChange(rate)}
              className={`rounded-md px-2 py-0.5 font-mono text-[11px] transition-colors cursor-pointer ${
                playbackRate === rate
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            aria-label="Playback volume"
            className="w-16 sm:w-20 h-1.5 cursor-pointer appearance-none rounded-lg bg-slate-800 accent-indigo-500"
          />
        </div>
      </div>

      {/* Pro Studio Keyboard Shortcuts Strip */}
      <div className="hidden md:flex items-center justify-between text-[10px] text-slate-500 font-mono bg-slate-950/40 rounded-lg px-2.5 py-1 border border-slate-800/40">
        <div className="flex items-center gap-3">
          <span className="text-slate-400">Pro Shortcuts:</span>
          <span><kbd className="rounded bg-slate-800 px-1 py-0.5 text-slate-300 border border-slate-700">Space</kbd> Play/Pause</span>
          <span><kbd className="rounded bg-slate-800 px-1 py-0.5 text-slate-300 border border-slate-700">←</kbd> <kbd className="rounded bg-slate-800 px-1 py-0.5 text-slate-300 border border-slate-700">→</kbd> Seek ±3s</span>
          <span><kbd className="rounded bg-slate-800 px-1 py-0.5 text-slate-300 border border-slate-700">M</kbd> Mute</span>
          <span><kbd className="rounded bg-slate-800 px-1 py-0.5 text-slate-300 border border-slate-700">R</kbd> Reset</span>
        </div>
        <div>
          <span><kbd className="rounded bg-slate-800 px-1 py-0.5 text-slate-300 border border-slate-700">⌘+Enter</kbd> Quick Synthesize</span>
        </div>
      </div>

      {/* PROMPT BOX: ENTER & EDIT SCRIPT DIRECTLY */}
      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4 transition-all">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
              Prompt &amp; Script Box
            </h4>
            <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
              Live Workstation Input
            </span>
          </div>

          {/* Quick Soundtags */}
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] text-slate-500 mr-1 hidden sm:inline">Tags:</span>
            {VOCAL_TAGS.slice(0, 6).map((vt) => (
              <button
                key={vt.tag}
                type="button"
                onClick={() => handleInsertTagToPrompt(vt.tag)}
                title={vt.description}
                className="rounded border border-slate-800 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300 hover:border-cyan-500/50 hover:bg-cyan-950/60 transition-colors cursor-pointer"
              >
                {vt.tag}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea for Script Prompt with Ctrl+Enter shortcut */}
        <textarea
          ref={textareaRef}
          rows={3}
          value={promptScript}
          onChange={(e) => setPromptScript(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              handleSynthesizeFromPrompt();
            }
          }}
          placeholder="Enter prompt script to synthesize speech. Insert vocal bursts like <breath>, <gasp>, or <laugh> for realistic human expression... (Press ⌘+Enter to Synthesize)"
          className="w-full rounded-lg border border-slate-800 bg-slate-900/90 p-3 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 leading-relaxed font-sans"
        />

        {/* Prompt Settings Strip (Voice, Language, Emotion direction) */}
        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Voice select */}
            <div className="flex items-center gap-1 bg-slate-900 rounded-lg px-2 py-1 border border-slate-800">
              <Mic className="h-3 w-3 text-cyan-400" />
              <select
                value={promptVoice}
                onChange={(e) => setPromptVoice(e.target.value)}
                aria-label="Select Voice in Prompt Box"
                className="bg-transparent text-[11px] text-slate-200 focus:outline-none cursor-pointer max-w-[140px] truncate"
              >
                {customClonedVoices.length > 0 && (
                  <optgroup label="My Cloned Voices">
                    {customClonedVoices.map((v) => (
                      <option key={v.id} value={v.id} className="bg-slate-900">
                        ✦ {v.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Studio Characters">
                  {VOICES.map((v) => (
                    <option key={v.id} value={v.id} className="bg-slate-900">
                      {v.name} ({v.gender})
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Quick Audition Voice Button */}
            <button
              type="button"
              onClick={() => handleToggleVoiceAudition(promptVoice)}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                previewingVoiceId
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm shadow-cyan-500/40'
                  : 'bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
              }`}
              title="Audition selected character voice"
            >
              {previewingVoiceId ? (
                isLoadingVoicePreview ? (
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

            {/* Language select */}
            <div className="flex items-center gap-1 bg-slate-900 rounded-lg px-2 py-1 border border-slate-800">
              <Globe className="h-3 w-3 text-indigo-400" />
              <select
                value={promptLanguage}
                onChange={(e) => setPromptLanguage(e.target.value)}
                aria-label="Select Language in Prompt Box"
                className="bg-transparent text-[11px] text-slate-200 focus:outline-none cursor-pointer"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.name} className="bg-slate-900">
                    {l.flag} {l.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Emotion preset pills */}
            <div className="hidden lg:flex items-center gap-1 bg-slate-900 rounded-lg px-2 py-1 border border-slate-800">
              <Smile className="h-3 w-3 text-amber-400" />
              <select
                value={promptStyle}
                onChange={(e) => setPromptStyle(e.target.value)}
                aria-label="Select Emotional Inflection in Prompt Box"
                className="bg-transparent text-[11px] text-slate-200 focus:outline-none cursor-pointer max-w-[150px] truncate"
              >
                {EMOTION_PRESETS.map((e) => (
                  <option key={e.id} value={e.stylePrompt} className="bg-slate-900">
                    {e.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Synthesize Action Button */}
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-500">
              {wordCount} words • ~{estimatedSeconds}s
            </span>
            <button
              onClick={handleSynthesizeFromPrompt}
              disabled={isSynthesizingPrompt || !promptScript.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-500 px-3.5 py-1.5 font-medium text-xs text-white shadow-md shadow-indigo-600/30 hover:scale-105 active:scale-95 disabled:opacity-40 transition-all cursor-pointer"
            >
              {isSynthesizingPrompt ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Zap className="h-3.5 w-3.5" />
                  <span>Synthesize Script</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Prompt error message */}
        {promptError && (
          <div className="mt-2 text-xs text-rose-400 bg-rose-950/40 border border-rose-500/30 rounded px-2.5 py-1">
            {promptError}
          </div>
        )}
      </div>
    </div>
  );
}

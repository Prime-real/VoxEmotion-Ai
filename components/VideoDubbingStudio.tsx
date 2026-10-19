'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  Video,
  Languages,
  Sparkles,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Upload,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sliders,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Layers,
  Wand2,
  Mic,
  Film,
  Zap,
  Globe,
  Settings,
  Link as LinkIcon,
  ExternalLink,
  Share2,
} from 'lucide-react';
import {
  LANGUAGES,
  VOICES,
  LanguageOption,
  VoiceOption,
} from '@/lib/tts-constants';
import { ScriptSegment } from '@/app/api/video/translate-script/route';
import { transcodeWavToMp3Client } from '@/lib/audio-storage';

interface VideoDubbingStudioProps {
  customClonedVoices?: VoiceOption[];
  onAudioGenerated?: (track: any) => void;
}

interface SampleVideoPreset {
  id: string;
  title: string;
  subtitle: string;
  platform: 'youtube' | 'instagram' | 'tiktok' | 'pinterest';
  language: string;
  flag: string;
  url: string;
  durationText: string;
  description: string;
}

const SAMPLE_PRESETS: SampleVideoPreset[] = [
  {
    id: 'keynote-en',
    title: 'YouTube Tech Keynote',
    subtitle: 'English (US) • Zephyr Voice',
    platform: 'youtube',
    language: 'English',
    flag: '🇺🇸',
    url: '/samples/sample_keynote.mp4',
    durationText: '00:12',
    description: 'Executive product keynote introducing neural voice synthesis and video dubbing.',
  },
  {
    id: 'nature-es',
    title: 'Instagram Nature Reel',
    subtitle: 'Spanish (ES) • Kore Voice',
    platform: 'instagram',
    language: 'Spanish',
    flag: '🇪🇸',
    url: '/samples/sample_nature_es.mp4',
    durationText: '00:10',
    description: 'Captivating ocean and wildlife nature documentary narrator in Spanish.',
  },
  {
    id: 'cucina-it',
    title: 'Instagram Culinary Reel',
    subtitle: 'Italian (IT) • Puck Voice',
    platform: 'instagram',
    language: 'Italian',
    flag: '🇮🇹',
    url: '/samples/sample_cucina_it.mp4',
    durationText: '00:10',
    description: 'Enthusiastic Italian culinary chef preparing traditional pasta.',
  },
  {
    id: 'tokyo-ja',
    title: 'TikTok / Pinterest Travel',
    subtitle: 'Japanese (JA) • Aoede Voice',
    platform: 'tiktok',
    language: 'Japanese',
    flag: '🇯🇵',
    url: '/samples/sample_tokyo_ja.mp4',
    durationText: '00:09',
    description: 'Expressive Tokyo night street food and travel vlog narration.',
  },
];

export default function VideoDubbingStudio({
  customClonedVoices = [],
  onAudioGenerated,
}: VideoDubbingStudioProps) {
  // Input Mode: 'link' | 'upload' | 'samples'
  const [inputMode, setInputMode] = useState<'link' | 'upload' | 'samples'>('link');

  // Video Source State
  const [selectedVideoUrl, setSelectedVideoUrl] = useState<string>(SAMPLE_PRESETS[0].url);
  const [videoBase64, setVideoBase64] = useState<string | null>(null);
  const [cachedVideoId, setCachedVideoId] = useState<string | null>(null);
  const uploadedVideoFileRef = useRef<File | null>(null);
  const [videoName, setVideoName] = useState<string>(SAMPLE_PRESETS[0].title);
  const [isVideoLoading, setIsVideoLoading] = useState(false);

  // Link pasting state (Instagram, YouTube, TikTok, Pinterest, etc.)
  const [pastedUrl, setPastedUrl] = useState<string>('');
  const [isResolvingLink, setIsResolvingLink] = useState(false);
  const [linkHelperNotice, setLinkHelperNotice] = useState<string | null>(null);

  // Video playback & sync state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const dubAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Audio Mixer State
  const [originalAudioVolume, setOriginalAudioVolume] = useState<number>(0.15); // 15% ducked background
  const [dubbedAudioVolume, setDubbedAudioVolume] = useState<number>(1.0); // 100% voiceover
  const [showSubtitles, setShowSubtitles] = useState(true);

  // Step 1: Language Detection & Script Extraction State
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectProgressMsg, setDetectProgressMsg] = useState('');
  const [detectedLanguage, setDetectedLanguage] = useState<{
    name: string;
    code: string;
    dialect?: string;
    confidence?: number;
  } | null>(null);
  const [segments, setSegments] = useState<ScriptSegment[]>([]);
  const [diagnostics, setDiagnostics] = useState<{
    hasBackgroundMusic?: boolean;
    clarityScore?: number;
    estimatedWpm?: number;
    summary?: string;
  } | null>(null);

  // Step 2: Target Dubbing Language & Translation State
  const [targetLanguage, setTargetLanguage] = useState<LanguageOption>(
    LANGUAGES.find((l) => l.code === 'es') || LANGUAGES[1]
  );
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationNotes, setTranslationNotes] = useState<string | null>(null);

  // Step 3: Voice Selection & Synthesis State
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(VOICES[0]);
  const [dubStylePrompt, setDubStylePrompt] = useState(
    'Clear, expressive, synchronized narrative voiceover matching video energy'
  );
  const [isSynthesizingDub, setIsSynthesizingDub] = useState(false);
  const [dubAudioBase64, setDubAudioBase64] = useState<string | null>(null);
  const [dubAudioBlobUrl, setDubAudioBlobUrl] = useState<string | null>(null);

  // Step 4: Merging & Export State
  const [isMergingVideo, setIsMergingVideo] = useState(false);
  const [mergedVideoBlobUrl, setMergedVideoBlobUrl] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Minimized vs Open Settings disclosure
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Real-time detection of platform from pasted link
  const detectPlatformFromUrl = (url: string) => {
    const u = url.toLowerCase();
    if (u.includes('youtube.com') || u.includes('youtu.be')) return 'YouTube';
    if (u.includes('instagram.com')) return 'Instagram';
    if (u.includes('tiktok.com')) return 'TikTok';
    if (u.includes('pinterest.com') || u.includes('pin.it')) return 'Pinterest';
    if (u.match(/\.(mp4|webm|mov)(\?.*)?$/)) return 'Direct Video';
    return null;
  };
  const currentDetectedPlatform = detectPlatformFromUrl(pastedUrl);

  // Handle Pasted Video Link Resolution
  const handleResolveVideoLink = async () => {
    if (!pastedUrl.trim() || !pastedUrl.trim().startsWith('http')) {
      setErrorMessage('Please enter a valid link starting with http:// or https://');
      return;
    }

    setIsResolvingLink(true);
    setErrorMessage(null);
    setLinkHelperNotice(null);

    try {
      const res = await fetch('/api/video/resolve-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: pastedUrl.trim() }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        // If social platform bot protection was encountered, provide helpful instructions
        if (data.isProtected) {
          setLinkHelperNotice(
            `${data.platform?.toUpperCase()} has active bot verification on direct server downloads. You can also drag & drop the downloaded MP4 file directly into the 'Upload Video' tab below, or try our instant 1-click social presets!`
          );
        }
        throw new Error(data.error || 'Failed to resolve video stream from URL.');
      }

      if (data.cachedVideoId) {
        setCachedVideoId(data.cachedVideoId);
      }
      if (data.streamUrl) {
        setSelectedVideoUrl(data.streamUrl);
        setVideoBase64(data.videoBase64 || null);
      } else if (data.videoBase64) {
        const byteCharacters = atob(data.videoBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: data.mimeType || 'video/mp4' });
        const blobUrl = URL.createObjectURL(blob);

        setSelectedVideoUrl(blobUrl);
        setVideoBase64(data.videoBase64);
      }

      uploadedVideoFileRef.current = null;
      setVideoName(data.title || `${data.platform?.toUpperCase()} Video Clip`);
      setDubAudioBase64(null);
      setDubAudioBlobUrl(null);
      setMergedVideoBlobUrl(null);
      setDetectedLanguage(null);
      setSegments([]);

      setStatusNotice(`✓ Successfully imported video from ${data.platform?.toUpperCase()}!`);
      setTimeout(() => setStatusNotice(null), 5000);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error processing video link.');
    } finally {
      setIsResolvingLink(false);
    }
  };

  // Handle Video file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setErrorMessage('Please upload a valid video file (.mp4, .webm, .mov, .mkv).');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setErrorMessage('Video file exceeds 50MB. Please select a clip under 50MB for optimal browser speed.');
      return;
    }

    setErrorMessage(null);
    setIsVideoLoading(true);
    setVideoName(file.name);
    setCachedVideoId(null);
    uploadedVideoFileRef.current = file;
    setSelectedVideoUrl(URL.createObjectURL(file));
    setDubAudioBase64(null);
    setDubAudioBlobUrl(null);
    setMergedVideoBlobUrl(null);
    setDetectedLanguage(null);
    setSegments([]);

    if (file.size <= 8 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        setVideoBase64(reader.result as string);
        setIsVideoLoading(false);
      };
      reader.onerror = () => {
        setIsVideoLoading(false);
      };
      reader.readAsDataURL(file);
    } else {
      setVideoBase64(null);
      setIsVideoLoading(false);
    }

    setStatusNotice(`Uploaded video: ${file.name}`);
    setTimeout(() => setStatusNotice(null), 3000);
  };

  // Select Sample Preset
  const handleSelectSample = (preset: SampleVideoPreset) => {
    setSelectedVideoUrl(preset.url);
    setVideoBase64(null);
    setCachedVideoId(null);
    uploadedVideoFileRef.current = null;
    setVideoName(preset.title);
    setDubAudioBase64(null);
    setDubAudioBlobUrl(null);
    setMergedVideoBlobUrl(null);
    setDetectedLanguage(null);
    setSegments([]);
    setErrorMessage(null);
    setStatusNotice(`Loaded: ${preset.title} (${preset.language})`);
    setTimeout(() => setStatusNotice(null), 3000);

    // Adapt default target language
    if (preset.language === 'English') {
      const es = LANGUAGES.find((l) => l.code === 'es');
      if (es) setTargetLanguage(es);
    } else {
      const en = LANGUAGES.find((l) => l.code === 'en');
      if (en) setTargetLanguage(en);
    }
  };

  // Video Time Update & Audio Sync
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    setCurrentTime(time);

    // Sync dubbed audio if loaded
    if (dubAudioRef.current && Math.abs(dubAudioRef.current.currentTime - time) > 0.25) {
      dubAudioRef.current.currentTime = time;
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
      videoRef.current.volume = originalAudioVolume;
    }
  };

  const handleTogglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      if (dubAudioRef.current) dubAudioRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      if (dubAudioRef.current && dubAudioBlobUrl) {
        dubAudioRef.current.currentTime = videoRef.current.currentTime;
        dubAudioRef.current.play();
      }
      setIsPlaying(true);
    }
  };

  // Adjust volumes in real time
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = originalAudioVolume;
    }
    if (dubAudioRef.current) {
      dubAudioRef.current.volume = dubbedAudioVolume;
    }
  }, [originalAudioVolume, dubbedAudioVolume]);

  // Step 1: Detect Language & Extract Script
  const handleDetectLanguageAndScript = async () => {
    setIsDetecting(true);
    setErrorMessage(null);
    setDetectProgressMsg('Extracting audio stream with ffmpeg...');

    try {
      setTimeout(() => {
        setDetectProgressMsg('Detecting spoken language, dialect & cadence with Gemini 3.8 Flash...');
      }, 900);

      setTimeout(() => {
        setDetectProgressMsg('Transcribing verbatim lines & detecting speaker timestamps...');
      }, 2000);

      const res = await fetch('/api/video/detect-and-extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cachedVideoId: cachedVideoId || undefined,
          videoUrl: (!cachedVideoId && !videoBase64) ? selectedVideoUrl : undefined,
          videoBase64: (!cachedVideoId && videoBase64) ? videoBase64 : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to detect language and extract script.');
      }

      setDetectedLanguage(data.detectedLanguage);
      setSegments(data.segments || []);
      setDiagnostics(data.diagnostics || null);

      setStatusNotice(
        `✓ Detected: ${data.detectedLanguage?.name || 'Language'} (${data.detectedLanguage?.confidence?.toFixed(1) || 99}% confidence) • ${data.segments?.length || 0} lines extracted`
      );
      setTimeout(() => setStatusNotice(null), 5000);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error detecting video language.');
    } finally {
      setIsDetecting(false);
      setDetectProgressMsg('');
    }
  };

  // Step 2: Translate Script
  const handleTranslateScript = async () => {
    if (!segments || segments.length === 0) {
      setErrorMessage('Please detect and extract the script from the video first.');
      return;
    }

    setIsTranslating(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/video/translate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments,
          sourceLanguage: detectedLanguage?.name || 'Auto-Detect',
          targetLanguage: targetLanguage.name,
          customStylePrompt: dubStylePrompt,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to translate script.');
      }

      setSegments(data.segments);
      setTranslationNotes(data.translationNotes);
      setStatusNotice(`✓ Translated into ${targetLanguage.name} with video timing cadence`);
      setTimeout(() => setStatusNotice(null), 4000);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error translating script.');
    } finally {
      setIsTranslating(false);
    }
  };

  // Step 3: Synthesize Dubbed Voiceover
  const handleSynthesizeDub = async () => {
    if (!segments || segments.length === 0) {
      setErrorMessage('No script segments available to synthesize.');
      return;
    }

    setIsSynthesizingDub(true);
    setErrorMessage(null);

    try {
      const fullTranslatedText = segments
        .map((s) => s.translatedText || s.originalText)
        .join(' ');

      const res = await fetch('/api/video/synthesize-dub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments,
          scriptText: fullTranslatedText,
          voice: selectedVoice.id,
          targetLanguage: targetLanguage.name,
          stylePrompt: dubStylePrompt,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to synthesize dub voiceover.');
      }

      setDubAudioBase64(data.audioBase64);

      // Create audio object URL for in-sync video playback
      const byteCharacters = atob(data.audioBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/wav' });
      const blobUrl = URL.createObjectURL(blob);
      setDubAudioBlobUrl(blobUrl);

      // Reset merged video so user knows to re-render if desired
      setMergedVideoBlobUrl(null);

      // Pass track to main player
      if (onAudioGenerated) {
        onAudioGenerated({
          audioBase64: data.audioBase64,
          mimeType: 'audio/wav',
          voice: selectedVoice.id,
          language: targetLanguage.name,
          style: dubStylePrompt,
          model: 'gemini-3.8-flash-tts',
          textSnippet: fullTranslatedText.slice(0, 100) + '...',
          timestamp: Date.now(),
        });
      }

      setStatusNotice(`✓ Synthesized dubbed audio in ${targetLanguage.name} with voice ${selectedVoice.name}!`);
      setTimeout(() => setStatusNotice(null), 5000);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error synthesizing video dub.');
    } finally {
      setIsSynthesizingDub(false);
    }
  };

  // Step 4: Merge Dub with Video into MP4 using ffmpeg
  const handleMergeVideo = async () => {
    if (!dubAudioBase64) {
      setErrorMessage('Please synthesize the dubbed voiceover audio first.');
      return;
    }

    setIsMergingVideo(true);
    setErrorMessage(null);

    const safeFilename = `dubbed_${targetLanguage.code}_${(videoName || 'video').replace(/[^a-zA-Z0-9_\-\.]/g, '_')}.mp4`;

    try {
      let res: Response;

      // If user uploaded a local file, stream with FormData to avoid JSON base64 memory limit
      if (uploadedVideoFileRef.current) {
        const formData = new FormData();
        formData.append('video', uploadedVideoFileRef.current);
        formData.append('dubAudioBase64', dubAudioBase64);
        formData.append('originalVolume', originalAudioVolume.toString());
        formData.append('dubVolume', dubbedAudioVolume.toString());
        formData.append('filename', safeFilename);

        res = await fetch('/api/video/merge-dub', {
          method: 'POST',
          headers: {
            Accept: 'video/mp4, application/json',
          },
          body: formData,
        });
      } else {
        // Cached link video or sample preset
        res = await fetch('/api/video/merge-dub', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'video/mp4, application/json',
          },
          body: JSON.stringify({
            cachedVideoId: cachedVideoId || undefined,
            videoUrl: !cachedVideoId && !videoBase64 ? selectedVideoUrl : undefined,
            videoBase64: !cachedVideoId && videoBase64 ? videoBase64 : undefined,
            dubAudioBase64,
            originalVolume: originalAudioVolume,
            dubVolume: dubbedAudioVolume,
            filename: safeFilename,
            format: 'binary',
          }),
        });
      }

      if (!res.ok) {
        let errText = 'Failed to merge video with dubbed audio.';
        try {
          const errJson = await res.json();
          if (errJson.error) errText = errJson.error;
        } catch {}
        throw new Error(errText);
      }

      const contentType = res.headers.get('content-type') || '';
      let blob: Blob;
      let finalFilename = safeFilename;

      if (contentType.includes('video/mp4') || contentType.includes('application/octet-stream')) {
        blob = await res.blob();
        const headerName = res.headers.get('X-Merged-Filename');
        if (headerName) finalFilename = headerName;
      } else {
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        if (data.videoBase64) {
          const byteCharacters = atob(data.videoBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          blob = new Blob([new Uint8Array(byteNumbers)], { type: 'video/mp4' });
        } else {
          throw new Error('No video binary received from merger.');
        }
        if (data.filename) finalFilename = data.filename;
      }

      const blobUrl = URL.createObjectURL(blob);
      setMergedVideoBlobUrl(blobUrl);

      // Trigger browser download
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setStatusNotice(`✓ Merged & downloaded dubbed video: ${finalFilename}!`);
      setTimeout(() => setStatusNotice(null), 5000);
    } catch (err: any) {
      console.error('Merge dub error:', err);
      const isFetchErr = err.name === 'TypeError' || err.message?.toLowerCase().includes('fetch');
      if (isFetchErr) {
        setErrorMessage(
          'Video muxing connection timed out. You can download the synthesized dubbed MP3/WAV voiceover and Subtitles directly below!'
        );
      } else {
        setErrorMessage(err.message || 'Error merging dubbed video.');
      }
    } finally {
      setIsMergingVideo(false);
    }
  };

  // Direct WAV Voiceover Download
  const handleDownloadDubWav = () => {
    if (!dubAudioBase64) return;
    try {
      const clean = dubAudioBase64.replace(/^data:[^;]+;base64,/, '');
      const byteCharacters = atob(clean);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dubbed_voiceover_${targetLanguage.code}_${selectedVoice.id.toLowerCase()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setStatusNotice('✓ Downloaded high-fidelity WAV voiceover!');
      setTimeout(() => setStatusNotice(null), 3000);
    } catch (err: any) {
      console.error('WAV download failed:', err);
    }
  };

  // Fast Client-side MP3 Download
  const handleDownloadDubMp3 = async () => {
    if (!dubAudioBase64) return;
    try {
      const mp3Blob = await transcodeWavToMp3Client(dubAudioBase64, '192k');
      if (!mp3Blob) {
        setErrorMessage('Failed to encode MP3 locally.');
        return;
      }
      const url = URL.createObjectURL(mp3Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dubbed_voiceover_${targetLanguage.code}_${selectedVoice.id.toLowerCase()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setStatusNotice('✓ Downloaded MP3 voiceover instantly!');
      setTimeout(() => setStatusNotice(null), 3000);
    } catch (err) {
      console.error('Fast MP3 download failed:', err);
    }
  };

  // Download SRT Subtitles
  const handleDownloadSRT = () => {
    if (!segments || segments.length === 0) return;

    let srtContent = '';
    segments.forEach((seg, index) => {
      const formatTime = (timeStr: string) => {
        const parts = timeStr.split(':');
        const min = parts[0].padStart(2, '0');
        const sec = parts[1].padStart(2, '0');
        return `00:${min}:${sec},000`;
      };

      const start = formatTime(seg.startTime);
      const end = formatTime(seg.endTime);
      const text = seg.translatedText || seg.originalText;

      srtContent += `${index + 1}\n${start} --> ${end}\n${text}\n\n`;
    });

    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtitles_${targetLanguage.code}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  // Find active segment for real-time video subtitles
  const activeSegment = segments.find((seg) => {
    const parseSec = (t: string) => {
      const p = t.split(':').map(Number);
      return p[0] * 60 + p[1];
    };
    const s = parseSec(seg.startTime);
    const e = parseSec(seg.endTime);
    return currentTime >= s && currentTime <= e;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Notice / Errors */}
      {statusNotice && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/70 p-3 text-xs text-emerald-200 flex items-center justify-between shadow-lg shadow-emerald-950/30">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{statusNotice}</span>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-950/70 p-3 text-xs text-rose-200 flex items-center justify-between shadow-lg shadow-rose-950/30">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Studio Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:p-6 backdrop-blur-xl shadow-2xl">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-fuchsia-600 text-white shadow-lg shadow-indigo-600/25">
              <Film className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  AI Video Dubber &amp; Script Extractor
                </h2>
                <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 border border-cyan-500/30">
                  Multimodal Video AI
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Detect spoken language from video audio, extract verbatim script with timestamps, and dub in 30+ languages.
              </p>
            </div>
          </div>

          {/* Quick Settings & Mode Toggle (Simplified / Minimized UI feel) */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all border cursor-pointer ${
                isSettingsOpen
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white border-slate-700/60'
              }`}
            >
              <Settings className="h-3.5 w-3.5 text-indigo-400" />
              <span>{isSettingsOpen ? 'Hide Studio Settings' : 'Open Dubbing Settings'}</span>
              {isSettingsOpen ? (
                <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              )}
            </button>
          </div>
        </div>

        {/* Expandable Advanced Dubbing Settings Drawer */}
        {isSettingsOpen && (
          <div className="mt-4 rounded-xl border border-indigo-500/30 bg-slate-950/70 p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5" />
                <span>Acoustic Audio Ducking &amp; Dub Sync Settings</span>
              </span>
              <span className="text-[11px] text-slate-400">
                Fine-tune balance between video ambience and dubbed voiceover
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Original Video Ambiance (Ducking):{' '}
                  <span className="text-cyan-300 font-mono">
                    {Math.round(originalAudioVolume * 100)}%
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={originalAudioVolume}
                  onChange={(e) => setOriginalAudioVolume(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  0% = Full vocal replacement. 15% = Retain subtle background audio.
                </p>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Dubbed Voiceover Level:{' '}
                  <span className="text-indigo-300 font-mono">
                    {Math.round(dubbedAudioVolume * 100)}%
                  </span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1.5"
                  step="0.05"
                  value={dubbedAudioVolume}
                  onChange={(e) => setDubbedAudioVolume(parseFloat(e.target.value))}
                  className="w-full accent-indigo-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Master gain for the synthesized dubbed actor track.
                </p>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Directorial Style / Tone:
                </label>
                <input
                  type="text"
                  value={dubStylePrompt}
                  onChange={(e) => setDubStylePrompt(e.target.value)}
                  placeholder="e.g. Natural, energetic, documentary tone"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Controls emotional delivery and speech pacing during dubbing.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Video Player & Live Subtitle Section */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Synchronized Video Screen & Controls */}
          <div className="lg:col-span-7 space-y-4">
            <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-black aspect-video flex items-center justify-center shadow-xl group">
              {isVideoLoading ? (
                <div className="flex flex-col items-center gap-2 text-slate-400 text-xs">
                  <Loader2 className="h-7 w-7 text-indigo-400 animate-spin" />
                  <span>Loading video stream...</span>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  src={selectedVideoUrl}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onEnded={() => setIsPlaying(false)}
                  className="w-full h-full object-contain cursor-pointer"
                  onClick={handleTogglePlay}
                  playsInline
                />
              )}

              {/* Hidden synced dubbed audio element */}
              {dubAudioBlobUrl && (
                <audio ref={dubAudioRef} src={dubAudioBlobUrl} preload="auto" />
              )}

              {/* Live Overlay Subtitle */}
              {showSubtitles && activeSegment && (
                <div className="absolute bottom-12 left-4 right-4 text-center pointer-events-none transition-all">
                  <div className="inline-block rounded-xl bg-black/85 backdrop-blur-md px-4 py-2 border border-white/10 shadow-2xl max-w-xl mx-auto">
                    {activeSegment.translatedText ? (
                      <div>
                        <p className="text-sm font-semibold text-cyan-300 tracking-wide drop-shadow-sm">
                          {activeSegment.translatedText}
                        </p>
                        <p className="text-[11px] text-slate-400 italic mt-0.5 line-clamp-1">
                          {activeSegment.originalText}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm font-medium text-white drop-shadow-sm">
                        {activeSegment.originalText}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Status badge on video */}
              <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none">
                <span className="rounded-md bg-black/70 backdrop-blur-sm px-2.5 py-1 text-[11px] font-mono text-white border border-white/10">
                  {videoName}
                </span>
                {dubAudioBlobUrl && (
                  <span className="rounded-md bg-indigo-600/80 backdrop-blur-sm px-2 py-1 text-[10px] font-semibold text-white flex items-center gap-1 shadow-md">
                    <Zap className="h-3 w-3 fill-white" />
                    <span>DUB ACTIVE ({targetLanguage.name})</span>
                  </span>
                )}
              </div>

              {/* Center Play Overlay when paused */}
              {!isPlaying && !isVideoLoading && (
                <button
                  onClick={handleTogglePlay}
                  aria-label="Play Video"
                  className="absolute inset-0 m-auto h-14 w-14 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-2xl hover:scale-105 transition-transform backdrop-blur-sm cursor-pointer"
                >
                  <Play className="h-6 w-6 ml-1 fill-white" />
                </button>
              )}
            </div>

            {/* Video Playback & Dual Audio Mixer Controls */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 space-y-3">
              {/* Timeline Scrubber */}
              <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                <span>
                  {Math.floor(currentTime / 60)}:
                  {String(Math.floor(currentTime % 60)).padStart(2, '0')}
                </span>
                <input
                  type="range"
                  min="0"
                  max={duration || 10}
                  step="0.1"
                  value={currentTime}
                  onChange={(e) => {
                    const t = parseFloat(e.target.value);
                    if (videoRef.current) videoRef.current.currentTime = t;
                    if (dubAudioRef.current) dubAudioRef.current.currentTime = t;
                    setCurrentTime(t);
                  }}
                  className="flex-1 accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <span>
                  {Math.floor(duration / 60)}:
                  {String(Math.floor(duration % 60)).padStart(2, '0')}
                </span>
              </div>

              {/* Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleTogglePlay}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-500 shadow-md shadow-indigo-600/30 cursor-pointer"
                  >
                    {isPlaying ? <Pause className="h-3.5 w-3.5 fill-white" /> : <Play className="h-3.5 w-3.5 fill-white" />}
                    <span>{isPlaying ? 'Pause' : 'Play Video'}</span>
                  </button>

                  <button
                    onClick={() => setShowSubtitles(!showSubtitles)}
                    className={`rounded-lg px-2.5 py-1.5 font-medium border cursor-pointer ${
                      showSubtitles
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                        : 'bg-slate-800 text-slate-400 border-slate-700/50'
                    }`}
                  >
                    CC {showSubtitles ? 'On' : 'Off'}
                  </button>
                </div>

                {/* Quick Dual Audio Sliders */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <span className="text-[11px] text-slate-400">Orig Audio:</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={originalAudioVolume}
                      onChange={(e) => setOriginalAudioVolume(parseFloat(e.target.value))}
                      className="w-16 accent-cyan-400 h-1 bg-slate-800 rounded cursor-pointer"
                      title="Original Video Audio Volume"
                    />
                  </div>

                  {dubAudioBlobUrl && (
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <span className="text-[11px] text-indigo-400 font-semibold">Dub Voice:</span>
                      <input
                        type="range"
                        min="0"
                        max="1.5"
                        step="0.05"
                        value={dubbedAudioVolume}
                        onChange={(e) => setDubbedAudioVolume(parseFloat(e.target.value))}
                        className="w-16 accent-indigo-400 h-1 bg-slate-800 rounded cursor-pointer"
                        title="Dubbed Voiceover Volume"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* VIDEO INPUT HUB: PASTE LINK (Instagram, YouTube, TikTok, Pinterest) / UPLOAD / SAMPLES */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-3">
              {/* Input Mode Selector Bar */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setInputMode('link')}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                      inputMode === 'link'
                        ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <LinkIcon className="h-3 w-3" />
                    <span>Paste Video Link</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputMode('upload')}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                      inputMode === 'upload'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <Upload className="h-3 w-3" />
                    <span>Upload File</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputMode('samples')}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                      inputMode === 'samples'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                    }`}
                  >
                    <Film className="h-3 w-3" />
                    <span>Preset Clips</span>
                  </button>
                </div>

                {/* Social Badges Pill */}
                <div className="hidden sm:flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                  <span>Instagram</span> • <span>YouTube</span> • <span>TikTok</span> • <span>Pinterest</span>
                </div>
              </div>

              {/* Mode 1: Paste Video Link */}
              {inputMode === 'link' && (
                <div className="space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <LinkIcon className="h-3.5 w-3.5 text-cyan-400" />
                      </div>
                      <input
                        type="url"
                        value={pastedUrl}
                        onChange={(e) => setPastedUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleResolveVideoLink();
                          }
                        }}
                        placeholder="Paste Instagram Reel, YouTube Shorts/Video, TikTok, or Pinterest link..."
                        className="w-full rounded-xl border border-slate-700 bg-slate-900/90 pl-9 pr-24 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
                      />

                      {/* Real-time detected platform badge inside input */}
                      {currentDetectedPlatform && (
                        <div className="absolute inset-y-0 right-1.5 flex items-center">
                          <span className="rounded-md bg-indigo-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-bold">
                            {currentDetectedPlatform}
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={handleResolveVideoLink}
                      disabled={isResolvingLink || !pastedUrl.trim()}
                      className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer whitespace-nowrap"
                    >
                      {isResolvingLink ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Fetching Media...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="h-3.5 w-3.5" />
                          <span>Load Video</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Informative helper banner if platform has login restrictions */}
                  {linkHelperNotice && (
                    <div className="rounded-lg bg-amber-950/40 border border-amber-500/30 p-2.5 text-[11px] text-amber-200 leading-relaxed">
                      💡 {linkHelperNotice}
                    </div>
                  )}

                  {/* 1-Click Trending Social Demo Clips */}
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                      Or Try 1-Click Social Video Presets:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {SAMPLE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectSample(preset)}
                          className={`flex items-center gap-1.5 rounded-lg p-1.5 text-left border transition-all cursor-pointer ${
                            selectedVideoUrl === preset.url
                              ? 'bg-indigo-950/60 border-cyan-400/50 ring-1 ring-cyan-400/30'
                              : 'bg-slate-900/60 border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          <span className="text-sm">{preset.flag}</span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-semibold text-white truncate">
                              {preset.title.split(' ')[0]} {preset.language}
                            </div>
                            <div className="text-[9px] text-slate-400 truncate font-mono">
                              {preset.platform}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Mode 2: Upload File */}
              {inputMode === 'upload' && (
                <div className="space-y-2 animate-in fade-in duration-150">
                  <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-4 text-center hover:bg-slate-800/40 transition-colors cursor-pointer">
                    <Upload className="h-6 w-6 text-cyan-400 mb-1.5" />
                    <span className="text-xs font-semibold text-white">
                      Click to Browse or Drag &amp; Drop Video
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      Supports MP4, WebM, MOV, MKV up to 50MB
                    </span>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Mode 3: Built-in Studio Presets */}
              {inputMode === 'samples' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in duration-150">
                  {SAMPLE_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleSelectSample(preset)}
                      className={`text-left rounded-xl p-2.5 transition-all border cursor-pointer ${
                        selectedVideoUrl === preset.url
                          ? 'bg-indigo-950/60 border-indigo-500/60 ring-1 ring-indigo-500/30'
                          : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-semibold text-xs text-white">
                          <span>{preset.flag}</span>
                          <span>{preset.title}</span>
                        </div>
                        <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                          {preset.durationText}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                        {preset.subtitle}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Workflow Steps (Language Detection -> Script Extraction -> Dub Translation -> Synthesis) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Step 1: Detect Spoken Language & Extract Script */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600/40 text-indigo-300 font-mono text-[10px]">
                    1
                  </span>
                  <span>Detect Language &amp; Extract Script</span>
                </span>
                {detectedLanguage && (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                    {detectedLanguage.name} ({detectedLanguage.confidence?.toFixed(0)}%)
                  </span>
                )}
              </div>

              {detectedLanguage ? (
                <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Detected Language:</span>
                    <strong className="text-white">
                      {detectedLanguage.name} {detectedLanguage.dialect ? `• ${detectedLanguage.dialect}` : ''}
                    </strong>
                  </div>
                  {diagnostics && (
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/60">
                      <span>Clarity: <strong className="text-emerald-400">{diagnostics.clarityScore || 95}/100</strong></span>
                      <span>Pace: <strong className="text-cyan-400">{diagnostics.estimatedWpm || 140} WPM</strong></span>
                      <span>Segments: <strong className="text-indigo-400">{segments.length}</strong></span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400">
                  Analyze speech audio from the video to detect source language, dialect, and extract chronological script lines.
                </p>
              )}

              <button
                onClick={handleDetectLanguageAndScript}
                disabled={isDetecting}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-600/25 hover:from-cyan-500 hover:to-indigo-500 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isDetecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{detectProgressMsg || 'Analyzing Video Speech...'}</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 text-cyan-200" />
                    <span>{detectedLanguage ? 'Re-Detect & Extract Script' : 'Detect Language & Extract Script'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Step 2: Target Dubbing Language & Script Translation */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-600/40 text-cyan-300 font-mono text-[10px]">
                    2
                  </span>
                  <span>Target Dubbing Language</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {targetLanguage.flag} {targetLanguage.name}
                </span>
              </div>

              {/* Target Language Dropdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={targetLanguage.code}
                  onChange={(e) => {
                    const found = LANGUAGES.find((l) => l.code === e.target.value);
                    if (found) {
                      setTargetLanguage(found);
                      const recVoice = VOICES.find((v) => v.id === found.recommendedVoice);
                      if (recVoice) setSelectedVoice(recVoice);
                    }
                  }}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-cyan-400 cursor-pointer"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name} ({lang.nativeName})
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleTranslateScript}
                  disabled={isTranslating || segments.length === 0}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-cyan-600/90 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-500 transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-cyan-600/20"
                >
                  {isTranslating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Translating...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="h-3.5 w-3.5" />
                      <span>Translate for Dubbing</span>
                    </>
                  )}
                </button>
              </div>

              {translationNotes && (
                <p className="text-[11px] text-slate-400 italic">
                  Note: {translationNotes}
                </p>
              )}
            </div>

            {/* Step 3: Dub Voice & Synthesis */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-fuchsia-600/40 text-fuchsia-300 font-mono text-[10px]">
                    3
                  </span>
                  <span>Voice Actor Cast &amp; Dub Synthesis</span>
                </span>
                <span className="text-[11px] font-semibold text-fuchsia-300">
                  {selectedVoice.name} ({selectedVoice.tone})
                </span>
              </div>

              {/* Voice Actor Selector */}
              <select
                value={selectedVoice.id}
                onChange={(e) => {
                  const allVoices = [...VOICES, ...customClonedVoices];
                  const found = allVoices.find((v) => v.id === e.target.value);
                  if (found) setSelectedVoice(found);
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-white focus:outline-none focus:ring-1 focus:ring-fuchsia-400 cursor-pointer"
              >
                <optgroup label="Gemini Foundation Cast">
                  {VOICES.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.gender} • {v.tone})
                    </option>
                  ))}
                </optgroup>
                {customClonedVoices.length > 0 && (
                  <optgroup label="Custom Cloned Voices">
                    {customClonedVoices.map((v) => (
                      <option key={v.id} value={v.id}>
                        🧬 {v.name} ({v.gender} • Cloned)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>

              {/* Synthesize Dub Voiceover CTA */}
              <button
                onClick={handleSynthesizeDub}
                disabled={isSynthesizingDub || segments.length === 0}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 via-indigo-600 to-cyan-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:opacity-95 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSynthesizingDub ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Synthesizing Dubbed Voiceover in {targetLanguage.name}...</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 text-white" />
                    <span>Synthesize Dubbed Voiceover ({targetLanguage.name})</span>
                  </>
                )}
              </button>
            </div>

            {/* Step 4: Multi-Format Download Suite */}
            {dubAudioBase64 && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>Dub Ready • Export Suite</span>
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-900/60 px-2 py-0.5 rounded border border-emerald-500/30">
                    High-Fidelity Audio
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  {/* Instant MP3 Download */}
                  <button
                    onClick={handleDownloadDubMp3}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-2 font-semibold text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20 cursor-pointer"
                    title="Download lightweight compressed MP3 voiceover"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Dub MP3</span>
                  </button>

                  {/* WAV Download */}
                  <button
                    onClick={handleDownloadDubWav}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-2 font-semibold text-slate-200 hover:bg-slate-700 border border-slate-700/60 cursor-pointer"
                    title="Download studio master lossless WAV audio"
                  >
                    <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Dub WAV</span>
                  </button>

                  {/* Subtitle SRT Download */}
                  <button
                    onClick={handleDownloadSRT}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-2 font-semibold text-slate-200 hover:bg-slate-700 border border-slate-700/60 cursor-pointer"
                    title="Download synchronized bilingual subtitle file (.srt)"
                  >
                    <FileText className="h-3.5 w-3.5 text-cyan-400" />
                    <span>SRT Subs</span>
                  </button>
                </div>

                {/* Merge and Download Full MP4 Video */}
                <button
                  onClick={handleMergeVideo}
                  disabled={isMergingVideo}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/30 hover:opacity-95 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isMergingVideo ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Merging Video &amp; Dubbed Audio with ffmpeg...</span>
                    </>
                  ) : (
                    <>
                      <Film className="h-4 w-4" />
                      <span>Merge &amp; Download Dubbed MP4 Video</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Script & Subtitle Timeline Editor Table */}
        {segments.length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-800/80 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">
                  Extracted Video Script &amp; Dub Translation Timeline ({segments.length} lines)
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                Click any line to edit translated dialogue or jump to video timestamp
              </span>
            </div>

            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {segments.map((seg, idx) => (
                <div
                  key={seg.id || idx}
                  className="rounded-xl border border-slate-800/90 bg-slate-950/70 p-3 hover:border-slate-700 transition-colors space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const parts = seg.startTime.split(':').map(Number);
                          const sec = parts[0] * 60 + parts[1];
                          if (videoRef.current) videoRef.current.currentTime = sec;
                          if (dubAudioRef.current) dubAudioRef.current.currentTime = sec;
                        }}
                        className="flex items-center gap-1 rounded bg-slate-800/80 px-2 py-0.5 font-mono text-[11px] text-cyan-300 hover:bg-slate-700 cursor-pointer"
                        title="Jump video to this line"
                      >
                        <Clock className="h-3 w-3 text-cyan-400" />
                        <span>
                          {seg.startTime} - {seg.endTime}
                        </span>
                      </button>

                      <span className="rounded bg-indigo-950/60 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-500/20">
                        {seg.speaker}
                      </span>

                      {seg.tone && (
                        <span className="text-[10px] text-slate-400 italic">
                          ({seg.tone})
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] font-mono text-slate-500">
                      Line #{idx + 1}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {/* Original Script */}
                    <div>
                      <span className="text-[10px] font-medium text-slate-400 block mb-0.5">
                        Original ({detectedLanguage?.name || 'Detected'}):
                      </span>
                      <p className="text-slate-300 bg-slate-900/60 rounded-lg p-2 border border-slate-800/60 leading-relaxed">
                        {seg.originalText}
                      </p>
                    </div>

                    {/* Translated / Dubbed Script */}
                    <div>
                      <span className="text-[10px] font-semibold text-cyan-300 block mb-0.5">
                        Dub Target ({targetLanguage.name}):
                      </span>
                      <input
                        type="text"
                        value={seg.translatedText || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSegments((prev) =>
                            prev.map((s) => (s.id === seg.id ? { ...s, translatedText: val } : s))
                          );
                        }}
                        placeholder={`Translate into ${targetLanguage.name}...`}
                        className="w-full text-white bg-indigo-950/30 rounded-lg p-2 border border-indigo-500/30 focus:outline-none focus:ring-1 focus:ring-cyan-400 leading-relaxed"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

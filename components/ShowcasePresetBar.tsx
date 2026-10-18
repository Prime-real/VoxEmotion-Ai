'use client';

import React, { useState } from 'react';
import { Sparkles, Play, Film, ChevronDown, ChevronUp } from 'lucide-react';

export interface ShowcasePreset {
  id: string;
  title: string;
  mode: 'solo' | 'dialogue';
  language: string;
  voice: string;
  emotionTitle: string;
  stylePrompt: string;
  text: string;
  icon: string;
  tag: string;
}

export const SHOWCASE_PRESETS: ShowcasePreset[] = [
  {
    id: 'movie-trailer',
    title: 'Cinematic Movie Trailer',
    mode: 'solo',
    language: 'English',
    voice: 'Fenrir',
    emotionTitle: 'Deep Resonant Trailer',
    stylePrompt:
      'Deep, intense, ominous movie trailer narration with weighty, dramatic pauses and cinematic gravity.',
    text: 'Before the silence... <breath> there was a question. And the answer will shake the stars themselves.',
    icon: '🎬',
    tag: 'Dramatic',
  },
  {
    id: 'asmr-whisper',
    title: 'Soothing ASMR Whisper',
    mode: 'solo',
    language: 'English',
    voice: 'Aoede',
    emotionTitle: 'Ultra-gentle Whisper',
    stylePrompt:
      'Ultra-gentle, soft warm whisper, slow meditative cadence, peaceful calming breaths.',
    text: 'Let go of today... <breath> Close your eyes, and listen to the gentle rain falling on the leaves.',
    icon: '🧸',
    tag: 'Gentle',
  },
  {
    id: 'spanish-fiesta',
    title: 'Spanish Ecstatic Fiesta',
    mode: 'solo',
    language: 'Spanish',
    voice: 'Kore',
    emotionTitle: 'Jubilant & Laughing',
    stylePrompt:
      'Ecstatic, jubilant, smiling voice, high energy with spontaneous laughing bursts and celebration.',
    text: '¡Por fin ha llegado el momento! <laugh> ¡Bailen, celebren y no paren de sonreír toda la noche!',
    icon: '🇪🇸',
    tag: 'Joyful',
  },
  {
    id: 'japanese-drama',
    title: 'Japanese Tender Anime Drama',
    mode: 'solo',
    language: 'Japanese',
    voice: 'Aoede',
    emotionTitle: 'Longing & Tenderness',
    stylePrompt:
      'Tender, emotional whisper with deep longing and authentic Japanese emotional inflection.',
    text: '忘れることなんてできないよ… <breath> 君が微笑んでくれたあの日を、ずっと心に抱きしめている。',
    icon: '🇯🇵',
    tag: 'Emotional',
  },
  {
    id: 'news-flash',
    title: 'Urgent Breaking News',
    mode: 'solo',
    language: 'English',
    voice: 'Puck',
    emotionTitle: 'Rapid Broadcast News',
    stylePrompt:
      'Crisp, high-tempo broadcast journalism, authoritative, urgent breaking news bulletin.',
    text: 'We interrupt your broadcast with an urgent advisory: <breath> Officials confirm the anomaly has stabilized.',
    icon: '📢',
    tag: 'Urgent',
  },
  {
    id: 'french-poetry',
    title: 'French Melancholic Poetry',
    mode: 'solo',
    language: 'French',
    voice: 'Aoede',
    emotionTitle: 'Sighing Melancholy',
    stylePrompt:
      'Heartbroken, quiet sorrow, delicate tremor in voice, slow melancholic sigh with authentic French cadence.',
    text: 'Les feuilles d’automne tombent doucement sur le pavé. <sigh> Et le souvenir de nos rires s’évanouit dans la brume.',
    icon: '🇫🇷',
    tag: 'Sorrowful',
  },
];

interface ShowcasePresetBarProps {
  onSelectPreset: (preset: ShowcasePreset) => void;
}

export default function ShowcasePresetBar({
  onSelectPreset,
}: ShowcasePresetBarProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-slate-900/90 via-indigo-950/30 to-slate-900/90 p-3.5 backdrop-blur-xl shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
            Instant Audition Showcase
          </h3>
          <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-300 border border-cyan-500/20">
            6 Ready Demos
          </span>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-[11px] font-medium text-indigo-300 hover:text-white bg-slate-900/80 px-2.5 py-1 rounded-lg border border-indigo-500/20 cursor-pointer transition-colors"
        >
          <span>{isOpen ? 'Minimize Auditions' : 'Audition Demos'}</span>
          {isOpen ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
      </div>

      {isOpen && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 animate-in fade-in duration-200">
          {SHOWCASE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => onSelectPreset(preset)}
              className="group flex flex-col items-start rounded-xl border border-slate-800/80 bg-slate-900/70 p-2.5 text-left hover:border-cyan-500/40 hover:bg-slate-800/80 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-lg">{preset.icon}</span>
                <span className="text-[10px] rounded bg-slate-800 px-1.5 py-0.5 font-medium text-slate-400 group-hover:text-cyan-300 transition-colors">
                  {preset.tag}
                </span>
              </div>
              <div className="mt-1.5 w-full">
                <div className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors truncate">
                  {preset.title}
                </div>
                <div className="text-[10px] text-slate-400 line-clamp-1">
                  {preset.voice} • {preset.language}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

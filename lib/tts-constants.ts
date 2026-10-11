export interface VoiceOption {
  id: string;
  name: string;
  baseVoice?: string;
  gender: 'Female' | 'Male' | 'Neutral';
  category?: 'Core Studio' | 'Cinematic & Sci-Fi' | 'Characters & Drama' | 'Cloned & Custom';
  tone: string;
  bestFor: string;
  avatarColor: string;
  sampleEmotion: string;
  auditionQuote: string;
  personaPrompt?: string;
  isCloned?: boolean;
}

export const VOICES: VoiceOption[] = [
  // --- Core Studio Voices ---
  {
    id: 'Kore',
    name: 'Kore',
    baseVoice: 'Kore',
    gender: 'Female',
    category: 'Core Studio',
    tone: 'Warm, articulate, balanced & natural',
    bestFor: 'Audiobooks, heartfelt storytelling, empathetic dialogue',
    avatarColor: 'from-rose-500 to-amber-500',
    sampleEmotion: 'Warm and reassuring',
    auditionQuote:
      'Hello there! I am Kore, ready to bring your story to life with natural warmth and clarity.',
  },
  {
    id: 'Puck',
    name: 'Puck',
    baseVoice: 'Puck',
    gender: 'Male',
    category: 'Core Studio',
    tone: 'Energetic, youthful, agile & bright',
    bestFor: 'Podcasts, video commercials, animated characters',
    avatarColor: 'from-amber-500 to-emerald-500',
    sampleEmotion: 'Ecstatic and fast-paced',
    auditionQuote:
      'Hey everyone! Puck here. <laugh> Let us turn up the energy and make something unforgettable!',
  },
  {
    id: 'Zephyr',
    name: 'Zephyr',
    baseVoice: 'Zephyr',
    gender: 'Male',
    category: 'Core Studio',
    tone: 'Smooth, confident, polished & suave',
    bestFor: 'Documentaries, keynote presentations, luxury ads',
    avatarColor: 'from-cyan-500 to-blue-600',
    sampleEmotion: 'Confident and calm',
    auditionQuote:
      'Good evening. With Zephyr, every word carries poise, authority, and refined elegance.',
  },
  {
    id: 'Fenrir',
    name: 'Fenrir',
    baseVoice: 'Fenrir',
    gender: 'Male',
    category: 'Core Studio',
    tone: 'Deep, resonant, authoritative & cinematic',
    bestFor: 'Blockbuster movie trailers, historical narratives, solemn proclamations',
    avatarColor: 'from-purple-600 to-indigo-800',
    sampleEmotion: 'Dramatic, intense, and grave',
    auditionQuote:
      'In a world where destiny hangs in the balance... <breath> Fenrir speaks with the weight of titans.',
  },
  {
    id: 'Charon',
    name: 'Charon',
    baseVoice: 'Charon',
    gender: 'Male',
    category: 'Core Studio',
    tone: 'Gravelly, weathered, intense & gritty',
    bestFor: 'Noir crime fiction, dramatic monologues, weathered characters',
    avatarColor: 'from-stone-600 to-slate-800',
    sampleEmotion: 'Somber and gravelly',
    auditionQuote:
      'I have walked down these rain-slicked alleys before. <sigh> Charon delivers the raw, unfiltered truth.',
  },
  {
    id: 'Aoede',
    name: 'Aoede',
    baseVoice: 'Aoede',
    gender: 'Female',
    category: 'Core Studio',
    tone: 'Melodic, poetic, gentle & serene',
    bestFor: 'Bedtime meditation, ASMR whispers, emotional poetry',
    avatarColor: 'from-pink-500 to-violet-500',
    sampleEmotion: 'Gentle whisper and serene',
    auditionQuote:
      'Close your eyes... <breath> and let Aoede guide you into peaceful, tranquil slumber.',
  },

  // --- Cinematic & Sci-Fi Voices ---
  {
    id: 'Astrid',
    name: 'Astrid',
    baseVoice: 'Aoede',
    gender: 'Female',
    category: 'Cinematic & Sci-Fi',
    tone: 'Futuristic AI navigator, sharp, witty & analytical',
    bestFor: 'Sci-Fi games, AI interfaces, cyberpunk thrillers',
    avatarColor: 'from-cyan-400 to-teal-600',
    sampleEmotion: 'Cool, precise, and tech-savvy',
    auditionQuote:
      'Neural link established. <breath> System status nominal. Ready to chart unfamiliar stars.',
    personaPrompt:
      'Cool, precise cyberpunk AI interface with crisp diction, subtle vocal fry, and calm analytical detachment',
  },
  {
    id: 'Malakor',
    name: 'Malakor',
    baseVoice: 'Fenrir',
    gender: 'Male',
    category: 'Cinematic & Sci-Fi',
    tone: 'Dark fantasy overlord, guttural & menacing baritone',
    bestFor: 'Fantasy villains, boss fights, dark lore narration',
    avatarColor: 'from-red-700 to-purple-950',
    sampleEmotion: 'Ominous, terrifying, and thunderous',
    auditionQuote:
      'Foolish mortals... You dare challenge what has endured ten thousand centuries in darkness?',
    personaPrompt:
      'Ominous dark fantasy warlord, deep thunderous guttural baritone with menacing acoustic reverb',
  },
  {
    id: 'Nova',
    name: 'Nova',
    baseVoice: 'Zephyr',
    gender: 'Neutral',
    category: 'Cinematic & Sci-Fi',
    tone: 'Synthetic starship companion, serene & hypnotic',
    bestFor: 'Space operas, ambient documentaries, futuristic UI',
    avatarColor: 'from-blue-400 to-indigo-500',
    sampleEmotion: 'Calm, soothing, and cosmic',
    auditionQuote:
      'Orbital trajectory calculated. Entering hyperspace in three, two, one... Safe travels.',
    personaPrompt:
      'Crystalline calm starship companion, melodic synthetic warmth, unhurried and reassuring cadence',
  },
  {
    id: 'Damian',
    name: 'Damian',
    baseVoice: 'Charon',
    gender: 'Male',
    category: 'Cinematic & Sci-Fi',
    tone: 'Hard-boiled private detective, weary cigarette rasp',
    bestFor: 'Detective mysteries, crime fiction, vintage radio',
    avatarColor: 'from-yellow-700 to-amber-950',
    sampleEmotion: 'World-weary, cynical, and sardonic',
    auditionQuote:
      'The case was cold, <breath> but the rain was colder. Just another night in this crooked city.',
    personaPrompt:
      'World-weary 1940s private eye, smoky vocal rasp, slow deliberate cadence with dry ironic cynicism',
  },

  // --- Characters & Drama ---
  {
    id: 'Maya',
    name: 'Maya',
    baseVoice: 'Kore',
    gender: 'Female',
    category: 'Characters & Drama',
    tone: 'Investigative podcaster, breathless curiosity & sharp wit',
    bestFor: 'True crime podcasts, audio journalism, fast-paced thrillers',
    avatarColor: 'from-emerald-500 to-teal-700',
    sampleEmotion: 'Investigative, urgent, and captivating',
    auditionQuote:
      'What if everything we were told was a carefully orchestrated lie? <gasp> Let us look at the evidence.',
    personaPrompt:
      'Investigative journalist, fast-paced breathless curiosity, sharp articulate inflections and magnetic storytelling',
  },
  {
    id: 'Jax',
    name: 'Jax',
    baseVoice: 'Puck',
    gender: 'Male',
    category: 'Characters & Drama',
    tone: 'Rebellious anime rogue, cocky rasp & spontaneous laughs',
    bestFor: 'Anime dubbing, action adventures, gaming companions',
    avatarColor: 'from-orange-500 to-red-600',
    sampleEmotion: 'Cocky, defiant, and laughing',
    auditionQuote:
      'You think you can outrun me? <laugh> Try your best, buddy! This is where the fun begins!',
    personaPrompt:
      'Cheeky anime rogue, youthful raspy defiance, energetic cadence peppered with amused chuckles',
  },
  {
    id: 'Barnaby',
    name: 'Barnaby',
    baseVoice: 'Charon',
    gender: 'Male',
    category: 'Characters & Drama',
    tone: 'Victorian gentleman scholar, aristocratic rasp & warmth',
    bestFor: 'Historical fiction, classic literature, whimsical narration',
    avatarColor: 'from-amber-600 to-stone-700',
    sampleEmotion: 'Refined, scholarly, and whimsical',
    auditionQuote:
      'Fascinating! Simply extraordinary! <chuckle> Allow me to elucidate this curious conundrum.',
    personaPrompt:
      'Dignified Victorian scholar, refined aristocratic rasp, whimsical pauses and polite British cadence',
  },
  {
    id: 'Elysia',
    name: 'Elysia',
    baseVoice: 'Aoede',
    gender: 'Female',
    category: 'Characters & Drama',
    tone: 'Ethereal ASMR enchantress, intimate breathy whisper',
    bestFor: 'Sleep stories, sensory relaxation, delicate poetry',
    avatarColor: 'from-fuchsia-400 to-pink-600',
    sampleEmotion: 'Tender, intimate, and comforting',
    auditionQuote:
      'Breathe in slowly... <breath> Soft velvet shadows are wrapping around your thoughts.',
    personaPrompt:
      'Ultra-gentle ASMR enchantress, close-mic breathy whisper, soothing slow cadence and delicate warmth',
  },
  {
    id: 'Solomon',
    name: 'Solomon',
    baseVoice: 'Fenrir',
    gender: 'Male',
    category: 'Characters & Drama',
    tone: 'Ancient mystic sage, deep reverberant ritual presence',
    bestFor: 'Epic folklore, mythology, fantasy prophecies',
    avatarColor: 'from-purple-700 to-slate-900',
    sampleEmotion: 'Solemn, legendary, and timeless',
    auditionQuote:
      'The ancient scrolls spoke of this dawn. <breath> Hear the prophecy of the forgotten ages.',
    personaPrompt:
      'Ancient mythological oracle, solemn deep baritone rumble, chant-like timeless resonance',
  },
  {
    id: 'Clara',
    name: 'Clara',
    baseVoice: 'Kore',
    gender: 'Female',
    category: 'Characters & Drama',
    tone: 'Children’s storybook reader, animated, joyful & bouncy',
    bestFor: 'Kids audiobooks, bedtime fairy tales, cheerful animation',
    avatarColor: 'from-yellow-400 to-pink-500',
    sampleEmotion: 'Bubbly, expressive, and playful',
    auditionQuote:
      'Once upon a sunny morning, <laugh> little Pip the rabbit found the most magical glowing carrot!',
    personaPrompt:
      'Animated children’s book narrator, high pitch dynamics, bubbly enthusiasm and warm storytelling',
  },
];

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  sampleText: string;
  sampleEmotion: string;
  recommendedVoice: string;
}

export const LANGUAGES: LanguageOption[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English (US/UK)',
    flag: '🇺🇸',
    sampleText:
      'Listen closely... <breath> In the darkest corner of the universe, a new star has just ignited.',
    sampleEmotion: 'Suspenseful whisper building into awe',
    recommendedVoice: 'Zephyr',
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    sampleText:
      '¡No me digas que ya lo sabías! <laugh> Fue una sorpresa que nadie esperaba.',
    sampleEmotion: 'Jubilant, laughing and energetic',
    recommendedVoice: 'Kore',
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    sampleText:
      'Il y a des moments où le silence en dit plus long que les mots. <sigh> C’était inoubliable.',
    sampleEmotion: 'Melancholic, gentle and poetic',
    recommendedVoice: 'Aoede',
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    sampleText:
      'Achtung an alle Einheiten: <gasp> Das Signal hat sich gerade wiederholt. Bleiben Sie wachsam!',
    sampleEmotion: 'Urgent, tense and authoritative',
    recommendedVoice: 'Fenrir',
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    sampleText:
      'ずっと待っていたんだ… <breath> 君がこの場所に戻ってくるその瞬間を。',
    sampleEmotion: 'Tender, emotional whisper with deep longing',
    recommendedVoice: 'Aoede',
  },
  {
    code: 'zh',
    name: 'Mandarin Chinese',
    nativeName: '中文 (普通话)',
    flag: '🇨🇳',
    sampleText:
      '真正的奇迹，往往发生在所有人都准备放弃的时刻。<breath> 我们做到了！',
    sampleEmotion: 'Inspirational, emotional and triumphant',
    recommendedVoice: 'Kore',
  },
  {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    flag: '🇮🇹',
    sampleText:
      'Guarda quel tramonto sulle colline! <laugh> Non hai mai visto niente di più spettacolare, vero?',
    sampleEmotion: 'Passionate, vibrant and warmhearted',
    recommendedVoice: 'Puck',
  },
  {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    flag: '🇧🇷',
    sampleText:
      'A vida tem um jeito curioso de nos surpreender. <sigh> Quando menos esperamos, tudo floresce.',
    sampleEmotion: 'Warm, soulful and nostalgic',
    recommendedVoice: 'Kore',
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    flag: '🇮🇳',
    sampleText:
      'यह कोई साधारण कहानी नहीं है... <breath> यह उस हौसले की दास्तान है जिसने इतिहास बदल दिया।',
    sampleEmotion: 'Heroic, dramatic and resonant',
    recommendedVoice: 'Fenrir',
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    sampleText:
      'في عمق الصحراء الهادئة، تهمس الرياح بأسرار لم يسمعها أحد من قبل. <breath>',
    sampleEmotion: 'Solemn, poetic and mesmerizing',
    recommendedVoice: 'Charon',
  },
  {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    flag: '🇰🇷',
    sampleText:
      '정말 믿기지 않아요! <laugh> 우리가 마침내 꿈을 이뤄냈다는 사실이요.',
    sampleEmotion: 'Joyful, ecstatic with happy laughter',
    recommendedVoice: 'Puck',
  },
  {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    flag: '🇷🇺',
    sampleText:
      'Внимание! Впереди надвигается буря невероятной силы. <gasp> Приготовьтесь!',
    sampleEmotion: 'Cinematic, urgent and imposing',
    recommendedVoice: 'Fenrir',
  },
  {
    code: 'nl',
    name: 'Dutch',
    nativeName: 'Nederlands',
    flag: '🇳🇱',
    sampleText:
      'Soms moet je gewoon die sprong in het diepe wagen. <chuckle> Wat kan er nou misgaan?',
    sampleEmotion: 'Playful, confident and friendly',
    recommendedVoice: 'Puck',
  },
  {
    code: 'tr',
    name: 'Turkish',
    nativeName: 'Türkçe',
    flag: '🇹🇷',
    sampleText:
      'Bu şehir hiçbir zaman uyumaz. <breath> Her sokağında binlerce farklı hayat akar.',
    sampleEmotion: 'Atmospheric, reflective and deep',
    recommendedVoice: 'Charon',
  },
  {
    code: 'pl',
    name: 'Polish',
    nativeName: 'Polski',
    flag: '🇵🇱',
    sampleText:
      'To był moment, na który czekaliśmy całe nasze życie. <breath> Udało się!',
    sampleEmotion: 'Triumphant and relieved',
    recommendedVoice: 'Zephyr',
  },
];

export interface EmotionPreset {
  id: string;
  name: string;
  category: 'Excited' | 'Dramatic' | 'Gentle' | 'Serious' | 'Humorous';
  stylePrompt: string;
  icon: string;
  description: string;
  badgeColor: string;
}

export const EMOTION_PRESETS: EmotionPreset[] = [
  {
    id: 'cinematic-trailer',
    name: 'Cinematic Movie Trailer',
    category: 'Dramatic',
    stylePrompt:
      'Deep, intense, ominous movie trailer narration with weighty, dramatic pauses and cinematic gravity.',
    icon: '🎬',
    description: 'Blockbuster gravitas, deep and suspenseful',
    badgeColor: 'border-purple-500/30 text-purple-300 bg-purple-500/10',
  },
  {
    id: 'joyful-celebration',
    name: 'Ecstatic & Joyful',
    category: 'Excited',
    stylePrompt:
      'Ecstatic, jubilant, smiling voice, high energy and bubbling genuine excitement.',
    icon: '🌟',
    description: 'Pure joy, bubbly laughter, infectious enthusiasm',
    badgeColor: 'border-amber-500/30 text-amber-300 bg-amber-500/10',
  },
  {
    id: 'suspenseful-whisper',
    name: 'Suspenseful Whisper',
    category: 'Dramatic',
    stylePrompt:
      'Breathless, terrified whisper, eerie tension, speaking softly as if hiding in sheer fear.',
    icon: '🤫',
    description: 'Chilling horror & suspense, breathless whisper',
    badgeColor: 'border-slate-500/30 text-slate-300 bg-slate-500/10',
  },
  {
    id: 'bedtime-asmr',
    name: 'Soothing Bedtime ASMR',
    category: 'Gentle',
    stylePrompt:
      'Ultra-gentle, soft warm whisper, slow meditative cadence, peaceful calming breaths.',
    icon: '🧸',
    description: 'Deep relaxation, delicate whisper, soothing warmth',
    badgeColor: 'border-pink-500/30 text-pink-300 bg-pink-500/10',
  },
  {
    id: 'urgent-breaking-news',
    name: 'Urgent Breaking News',
    category: 'Serious',
    stylePrompt:
      'Crisp, high-tempo broadcast journalism, authoritative, urgent breaking news bulletin.',
    icon: '📢',
    description: 'Rapid pace, high stakes, crisp broadcast delivery',
    badgeColor: 'border-red-500/30 text-red-300 bg-red-500/10',
  },
  {
    id: 'sorrowful-melancholy',
    name: 'Heartbroken Sorrow',
    category: 'Dramatic',
    stylePrompt:
      'Heartbroken, quiet sorrow, delicate tremor in voice, slow melancholic sigh.',
    icon: '💔',
    description: 'Tender sadness, emotional tremor, quiet grief',
    badgeColor: 'border-blue-500/30 text-blue-300 bg-blue-500/10',
  },
  {
    id: 'snarky-sarcastic',
    name: 'Sarcastic & Snarky',
    category: 'Humorous',
    stylePrompt:
      'Deadpan irony, smug comedic swagger, playful sarcasm, subtle amused chuckle.',
    icon: '😏',
    description: 'Sharp wit, tongue-in-cheek humor, playful smirk',
    badgeColor: 'border-emerald-500/30 text-emerald-300 bg-emerald-500/10',
  },
  {
    id: 'fierce-anger',
    name: 'Fierce Outrage & Fury',
    category: 'Dramatic',
    stylePrompt:
      'Fierce righteous anger, clenched teeth intensity, heated cadence and deep conviction.',
    icon: '🔥',
    description: 'Raw anger, fiery confrontation, high tension',
    badgeColor: 'border-orange-500/30 text-orange-300 bg-orange-500/10',
  },
  {
    id: 'executive-briefing',
    name: 'Corporate Executive',
    category: 'Serious',
    stylePrompt:
      'Poised, articulate, executive briefing, commanding yet warm and professional.',
    icon: '💼',
    description: 'Boardroom presentation, polished and confident',
    badgeColor: 'border-cyan-500/30 text-cyan-300 bg-cyan-500/10',
  },
  {
    id: 'mythic-storyteller',
    name: 'Ancient Mythic Sage',
    category: 'Dramatic',
    stylePrompt:
      'Ancient mystical storyteller, solemn deep reverberation, legendary folklore cadence.',
    icon: '🧙',
    description: 'Epic fantasy, timeless lore, mesmerizing cadence',
    badgeColor: 'border-violet-500/30 text-violet-300 bg-violet-500/10',
  },
];

export interface VocalTag {
  tag: string;
  label: string;
  description: string;
  category: 'burst' | 'pause' | 'backchannel';
}

export const VOCAL_TAGS: VocalTag[] = [
  {
    tag: '<breath>',
    label: 'Breath',
    description: 'Inhales or soft breath catch',
    category: 'burst',
  },
  {
    tag: '<gasp>',
    label: 'Gasp',
    description: 'Sudden gasp of shock or wonder',
    category: 'burst',
  },
  {
    tag: '<laugh>',
    label: 'Laugh',
    description: 'Audible laughter',
    category: 'burst',
  },
  {
    tag: '<chuckle>',
    label: 'Chuckle',
    description: 'Subtle amused chuckle',
    category: 'burst',
  },
  {
    tag: '<sigh>',
    label: 'Sigh',
    description: 'Emotional or weary sigh',
    category: 'burst',
  },
  {
    tag: '|yeah|',
    label: 'Affirmation',
    description: 'Natural spoken backchannel',
    category: 'backchannel',
  },
  {
    tag: '|mhm|',
    label: 'Agreement',
    description: 'Conversational acknowledgement',
    category: 'backchannel',
  },
  {
    tag: '...',
    label: 'Dramatic Pause',
    description: 'Pacing hesitation or breath beat',
    category: 'pause',
  },
];

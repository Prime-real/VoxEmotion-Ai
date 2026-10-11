import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const {
      mode = 'description', // 'description' or 'audio'
      voiceDescription,
      audioBase64,
      audioMimeType = 'audio/wav',
      desiredName,
    } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured on the server.' },
        { status: 500 }
      );
    }

    if (mode === 'audio') {
      if (!audioBase64) {
        return NextResponse.json(
          { error: 'Audio data is required for audio-based voice cloning.' },
          { status: 400 }
        );
      }

      const prompt = `You are an expert audio engineer and vocal acoustics analyst.
Analyze the provided speech recording.
Your goal is to clone this voice for a state-of-the-art TTS engine that supports Voice Design.
The engine has 6 base voice foundations:
1. "Kore" - Warm, articulate, balanced female
2. "Aoede" - Melodic, gentle, poetic, breathy/whispery female
3. "Puck" - Energetic, youthful, bright male
4. "Zephyr" - Smooth, confident, suave, polished male/neutral
5. "Fenrir" - Deep, resonant, authoritative baritone male
6. "Charon" - Gravelly, weathered, gritty, mature male

Analyze the audio and produce a voice cloning profile:
- Determine estimated gender and pitch.
- Choose the best matching baseFoundation voice among: "Kore", "Aoede", "Puck", "Zephyr", "Fenrir", or "Charon".
- Describe the timbre, acoustic texture, vocal fry, breathing rhythm, and accent.
- Create an exact "personaPrompt": a concise, potent directorial instruction (25-45 words) that instructs the TTS model to emulate this speaker's timbre, pitch, tempo, and vocal quirks.
- Generate a natural "auditionQuote" (12-20 words) that best demonstrates this voice persona.

Output strictly valid JSON with this exact schema:
{
  "name": "${desiredName || 'Cloned Voice'}",
  "gender": "Female | Male | Neutral",
  "baseVoice": "Kore | Aoede | Puck | Zephyr | Fenrir | Charon",
  "pitch": "Low | Medium | High",
  "timbre": "Brief descriptive label (e.g. Husky warm baritone with subtle rasp)",
  "accent": "Detected accent (e.g. Standard American, British RP, etc.)",
  "cadence": "Pacing description (e.g. Deliberate, relaxed with subtle pauses)",
  "personaPrompt": "Directorial instruction for speech synthesis",
  "auditionQuote": "Signature audition sentence"
}`;

      const audioPart = {
        inlineData: {
          mimeType: audioMimeType || 'audio/wav',
          data: audioBase64,
        },
      };

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [audioPart, { text: prompt }],
          },
        ],
        config: {
          responseMimeType: 'application/json',
        },
      });

      try {
        const parsed = JSON.parse(response.text || '{}');
        return NextResponse.json({
          success: true,
          mode: 'audio',
          cloneProfile: {
            id: `clone-${Date.now()}`,
            name: desiredName || parsed.name || 'Cloned Voice',
            gender: parsed.gender || 'Neutral',
            baseVoice: parsed.baseVoice || 'Zephyr',
            pitch: parsed.pitch || 'Medium',
            timbre: parsed.timbre || 'Natural speech',
            accent: parsed.accent || 'Natural',
            cadence: parsed.cadence || 'Conversational',
            personaPrompt: parsed.personaPrompt || '',
            auditionQuote:
              parsed.auditionQuote ||
              'This is my cloned voice persona, generated from acoustic analysis.',
            avatarColor: 'from-fuchsia-600 to-indigo-600',
            isCloned: true,
          },
        });
      } catch {
        return NextResponse.json({
          success: true,
          mode: 'audio',
          cloneProfile: {
            id: `clone-${Date.now()}`,
            name: desiredName || 'Acoustic Clone',
            gender: 'Neutral',
            baseVoice: 'Zephyr',
            pitch: 'Medium',
            timbre: 'Natural resonant acoustics',
            accent: 'Standard',
            cadence: 'Even tempo',
            personaPrompt:
              'Natural, articulate, and realistic vocal resonance with nuanced inflection.',
            auditionQuote:
              'Acoustic clone generated and calibrated for speech synthesis.',
            avatarColor: 'from-cyan-600 to-emerald-600',
            isCloned: true,
          },
        });
      }
    }

    // Mode: Text-described voice design
    if (mode === 'description') {
      if (!voiceDescription || !voiceDescription.trim()) {
        return NextResponse.json(
          { error: 'Voice description is required for prompt-based cloning.' },
          { status: 400 }
        );
      }

      const prompt = `You are a voice casting and voice design expert for high-end AI speech generation.
User wants to design/clone a custom voice based on this description:
"${voiceDescription}"

Available base foundations:
- "Kore" (Warm, articulate, balanced female)
- "Aoede" (Melodic, breathy, gentle, serene female)
- "Puck" (Energetic, youthful, bright, agile male)
- "Zephyr" (Smooth, suave, polished, confident male/neutral)
- "Fenrir" (Deep, resonant, grave, authoritative baritone male)
- "Charon" (Gravelly, weathered, gritty, mature male)

Select the most suitable baseVoice and construct a precise personaPrompt for the speech engine.
Output strictly valid JSON with this exact schema:
{
  "name": "${desiredName || 'Custom Voice'}",
  "gender": "Female | Male | Neutral",
  "baseVoice": "Kore | Aoede | Puck | Zephyr | Fenrir | Charon",
  "pitch": "Low | Medium | High",
  "timbre": "Short descriptor of timbre and vocal texture",
  "accent": "Accent or regional inflection",
  "cadence": "Rhythm and pacing",
  "personaPrompt": "Specific directorial guidance to achieve this voice tone and texture",
  "auditionQuote": "One expressive sentence (12-22 words) demonstrating this persona"
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      try {
        const parsed = JSON.parse(response.text || '{}');
        return NextResponse.json({
          success: true,
          mode: 'description',
          cloneProfile: {
            id: `clone-${Date.now()}`,
            name: desiredName || parsed.name || 'Designed Voice',
            gender: parsed.gender || 'Neutral',
            baseVoice: parsed.baseVoice || 'Zephyr',
            pitch: parsed.pitch || 'Medium',
            timbre: parsed.timbre || 'Expressive vocal texture',
            accent: parsed.accent || 'Natural',
            cadence: parsed.cadence || 'Conversational',
            personaPrompt: parsed.personaPrompt || voiceDescription,
            auditionQuote:
              parsed.auditionQuote ||
              'This is my custom designed voice persona ready for studio synthesis.',
            avatarColor: 'from-violet-600 to-pink-600',
            isCloned: true,
          },
        });
      } catch (err: any) {
        return NextResponse.json(
          { error: 'Failed to parse cloned voice design: ' + err.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ error: 'Invalid mode.' }, { status: 400 });
  } catch (error: any) {
    console.error('Voice cloning error:', error);
    return NextResponse.json(
      { error: error?.message || 'Error processing voice cloning.' },
      { status: 500 }
    );
  }
}

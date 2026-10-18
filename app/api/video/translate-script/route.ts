import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/lib/gemini';

export interface ScriptSegment {
  id: string;
  startTime: string;
  endTime: string;
  speaker: string;
  tone?: string;
  originalText: string;
  translatedText?: string;
}

export async function POST(req: NextRequest) {
  try {
    const {
      segments,
      sourceLanguage = 'Auto-Detect',
      targetLanguage = 'Spanish',
      customStylePrompt = '',
    } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured on the server.' },
        { status: 500 }
      );
    }

    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json(
        { error: 'No script segments provided for translation.' },
        { status: 400 }
      );
    }

    const prompt = `You are an elite Hollywood audiovisual dubbing translator and dialogue adapter.
Your objective is to translate and localize this video script from ${sourceLanguage} into ${targetLanguage}.

DUBBING RULES:
1. Pacing & Syllable Match: Adapt translations so spoken duration matches the original time interval between [startTime] and [endTime]. Avoid overly verbose phrasing.
2. Tone & Character Preservation: Respect the speaker's emotional tone (${customStylePrompt || 'conversational, natural, engaging'}).
3. Natural Colloquial Phrasing: Use authentic idioms in ${targetLanguage} rather than stiff literal translation.
4. Output Format: Strictly valid JSON array with the exact translated text for each segment ID.

INPUT SEGMENTS:
${JSON.stringify(
  segments.map((s) => ({
    id: s.id,
    speaker: s.speaker,
    time: `${s.startTime} - ${s.endTime}`,
    original: s.originalText,
    tone: s.tone || 'Natural',
  })),
  null,
  2
)}

Output strictly valid JSON with this exact schema:
{
  "translatedSegments": [
    {
      "id": "seg-1",
      "translatedText": "Translated dialogue in ${targetLanguage}"
    }
  ],
  "translationNotes": "Brief 1-sentence note on the cultural adaptation or tone choice"
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '';
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error('Failed to parse translation JSON.');
      }
    }

    // Merge translated text into segments
    const map = new Map<string, string>();
    if (Array.isArray(parsed.translatedSegments)) {
      parsed.translatedSegments.forEach((t: any) => {
        if (t.id && t.translatedText) {
          map.set(t.id, t.translatedText);
        }
      });
    }

    const updatedSegments = segments.map((seg: ScriptSegment) => ({
      ...seg,
      translatedText: map.get(seg.id) || seg.originalText,
    }));

    return NextResponse.json({
      segments: updatedSegments,
      translationNotes: parsed.translationNotes || `Adapted into fluent ${targetLanguage}`,
    });
  } catch (error: any) {
    console.error('Script translation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to translate video script.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const {
      scriptText,
      segments,
      voice = 'Kore',
      targetLanguage = 'Spanish',
      stylePrompt = 'Natural, engaging cinematic voiceover',
      model = 'gemini-3.8-flash-tts',
    } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured on the server.' },
        { status: 500 }
      );
    }

    // Determine the full text to synthesize
    let synthesisText = (scriptText || '').trim();
    if (!synthesisText && Array.isArray(segments) && segments.length > 0) {
      synthesisText = segments
        .map((s: any) => s.translatedText || s.originalText || '')
        .filter(Boolean)
        .join(' ');
    }

    if (!synthesisText) {
      return NextResponse.json(
        { error: 'No text or segments available to synthesize dub.' },
        { status: 400 }
      );
    }

    // Formulate directorial style instruction
    let combinedStyle = stylePrompt.trim();
    if (targetLanguage && targetLanguage !== 'English') {
      const langNote = `Spoken natively and expressively in ${targetLanguage} with authentic cadence, clear articulation, and synchronized narrative pacing.`;
      combinedStyle = combinedStyle ? `${combinedStyle}. ${langNote}` : langNote;
    }

    const response = await ai.models.generateContent({
      model: model || 'gemini-3.8-flash-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: synthesisText,
              speechMetadata: combinedStyle
                ? {
                    style: combinedStyle,
                  }
                : undefined,
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice || 'Kore' },
          },
        },
      },
    });

    const candidate = response.candidates?.[0];
    let base64Audio = candidate?.content?.parts?.[0]?.inlineData?.data;
    let mimeType =
      candidate?.content?.parts?.[0]?.inlineData?.mimeType || 'audio/wav';

    if (!base64Audio && candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.inlineData?.data) {
          base64Audio = part.inlineData.data;
          mimeType = part.inlineData.mimeType || mimeType;
          break;
        }
      }
    }

    if (!base64Audio) {
      const fallbackText = candidate?.content?.parts?.[0]?.text;
      throw new Error(
        fallbackText || 'Audio dub could not be synthesized for this script.'
      );
    }

    return NextResponse.json({
      audioBase64: base64Audio,
      mimeType,
      voice,
      targetLanguage,
      synthesisText,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Video dub synthesis error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to synthesize video dub.' },
      { status: 500 }
    );
  }
}

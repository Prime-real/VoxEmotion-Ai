import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/lib/gemini';

// In-memory cache for fast voice preview playback
const previewCache = new Map<string, string>();

export async function POST(req: NextRequest) {
  try {
    const {
      voiceId,
      baseVoice = 'Kore',
      style = '',
      personaPrompt = '',
      auditionQuote,
    } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured.' },
        { status: 500 }
      );
    }

    const cacheKey = `${voiceId || baseVoice}_${style}_${personaPrompt}`.slice(
      0,
      120
    );
    if (previewCache.has(cacheKey)) {
      return NextResponse.json({
        success: true,
        audioBase64: previewCache.get(cacheKey),
        mimeType: 'audio/wav',
        cached: true,
      });
    }

    const textToSpeak =
      auditionQuote ||
      `Hello! I'm ${voiceId || baseVoice}. This is a preview of my voice acting and emotional tone.`;

    // Combine persona direction with style
    let combinedStyle = [personaPrompt, style].filter(Boolean).join('. ');
    if (!combinedStyle) {
      combinedStyle = 'Clear, natural, and expressive voice sample';
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: textToSpeak,
              speechMetadata: {
                style: combinedStyle,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: baseVoice || 'Kore' },
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
      return NextResponse.json(
        { error: 'Failed to generate voice audition preview.' },
        { status: 500 }
      );
    }

    // Cache the result
    previewCache.set(cacheKey, base64Audio);

    return NextResponse.json({
      success: true,
      audioBase64: base64Audio,
      mimeType,
      cached: false,
    });
  } catch (error: any) {
    console.error('Error generating voice audition:', error);
    return NextResponse.json(
      { error: error?.message || 'Error generating preview audio.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      mode = 'solo',
      text = '',
      voice = 'Kore',
      style = '',
      language = 'English',
      model = 'gemini-3.8-flash-tts',
      dialogueParts = [],
      speakers = [],
    } = body;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error:
            'GEMINI_API_KEY is not configured on the server. Please check your environment variables.',
        },
        { status: 500 }
      );
    }

    if (mode === 'solo') {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return NextResponse.json(
          { error: 'Text prompt cannot be empty.' },
          { status: 400 }
        );
      }

      // Compose rich emotional style prompt
      let combinedStyle = style.trim();
      if (language && language !== 'Auto-Detect' && language !== 'English') {
        const langDirective = `Spoken naturally in ${language} with authentic native accent and cultural cadence.`;
        combinedStyle = combinedStyle
          ? `${combinedStyle}. ${langDirective}`
          : langDirective;
      }

      const response = await ai.models.generateContent({
        model: model || 'gemini-3.8-flash-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: text.trim(),
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
        const fallbackText =
          candidate?.content?.parts?.[0]?.text ||
          'Audio could not be generated for this request.';
        return NextResponse.json(
          {
            error: `Audio generation failed: ${fallbackText}`,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        mode: 'solo',
        audioBase64: base64Audio,
        mimeType: mimeType || 'audio/wav',
        voice,
        style: combinedStyle,
        language,
        model,
        characterCount: text.length,
        timestamp: Date.now(),
      });
    }

    if (mode === 'dialogue') {
      // Validate dialogue
      if (!Array.isArray(dialogueParts) || dialogueParts.length === 0) {
        return NextResponse.json(
          { error: 'Dialogue parts cannot be empty.' },
          { status: 400 }
        );
      }

      if (!Array.isArray(speakers) || speakers.length < 2) {
        return NextResponse.json(
          { error: 'Multi-speaker mode requires at least 2 speaker profiles.' },
          { status: 400 }
        );
      }

      const speaker1 = speakers[0];
      const speaker2 = speakers[1];

      const partsPayload = dialogueParts.map((item: any) => {
        let partStyle = item.style ? item.style.trim() : '';
        if (language && language !== 'Auto-Detect' && language !== 'English') {
          partStyle = partStyle
            ? `${partStyle}. Spoken in ${language}.`
            : `Spoken naturally in ${language}.`;
        }

        return {
          text: `${item.speaker}: ${item.text}`,
          speechMetadata: {
            speaker: item.speaker,
            style: partStyle || undefined,
          },
        };
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: [
          {
            role: 'user',
            parts: partsPayload,
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                {
                  speaker: speaker1.speaker || 'Speaker 1',
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: speaker1.voice || 'Puck',
                    },
                  },
                },
                {
                  speaker: speaker2.speaker || 'Speaker 2',
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName: speaker2.voice || 'Kore',
                    },
                  },
                },
              ],
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
          {
            error:
              'Failed to generate dialogue audio. Ensure both speaker names in the script match the speaker configuration.',
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        mode: 'dialogue',
        audioBase64: base64Audio,
        mimeType: mimeType || 'audio/wav',
        speakers,
        language,
        model: 'gemini-3.8-flash-tts',
        lineCount: dialogueParts.length,
        timestamp: Date.now(),
      });
    }

    return NextResponse.json(
      { error: `Unknown mode: ${mode}` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error generating TTS:', error);
    return NextResponse.json(
      {
        error:
          error?.message ||
          'Internal server error while processing speech synthesis.',
      },
      { status: 500 }
    );
  }
}

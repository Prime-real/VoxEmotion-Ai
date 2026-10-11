import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/lib/gemini';

export async function POST(req: NextRequest) {
  try {
    const { action, text, emotion, language, mode, genre } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured.' },
        { status: 500 }
      );
    }

    if (action === 'enhance') {
      const prompt = `You are a world-class voice director for ultra-realistic Text-to-Speech audio engines.
The audio engine natively supports natural vocal bursts such as <laugh>, <chuckle>, <gasp>, <sigh>, <breath>, <throat-clear>, and natural backchanneling like |yeah|, |mhm|.

User's original text:
"${text}"

Target Emotion/Tone:
"${emotion || 'Dramatic and expressive'}"

Target Language:
"${language || 'English'}"

Task:
Rewrite the text so it sounds deeply human, natural, and emotionally gripping when read aloud.
Rules:
1. Preserve the user's core message.
2. Inject punctuation (em-dashes —, ellipses ..., commas) to create realistic human breathing rhythm and pauses.
3. Carefully insert 1 to 3 vocal burst tags (e.g. <breath>, <gasp>, <sigh>, <laugh>, <chuckle>, |mhm|) where natural. Do not overuse.
4. Keep the output strictly in ${language || 'English'}.
5. Return ONLY the rewritten text, with no explanations, no quotes around the whole response, and no markdown formatting.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      return NextResponse.json({
        enhancedText: response.text ? response.text.trim() : text,
      });
    }

    if (action === 'translate') {
      const prompt = `Translate the following text into ${language}.
Keep any vocal burst tags like <laugh>, <gasp>, <breath>, <sigh>, |yeah|, |mhm| intact if appropriate for speech synthesis.
Ensure natural, idiomatic, spoken-language phrasing tailored for voice acting with realistic emotional inflection: "${emotion || 'Natural spoken tone'}".

Source text:
"${text}"

Return ONLY the translated text without commentary or quotation marks.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
      });

      return NextResponse.json({
        translatedText: response.text ? response.text.trim() : text,
      });
    }

    if (action === 'generate_sample') {
      if (mode === 'dialogue') {
        const prompt = `Create an engaging 4 to 6 line dual-speaker dialogue between "Alex" and "Sam".
Genre/Theme: ${genre || 'Podcast banter / Dramatic discovery'}
Target Emotion: ${emotion || 'Engaging and conversational'}
Language: ${language || 'English'}

Use natural speech patterns with natural vocal bursts like <laugh>, <gasp>, <breath>, <sigh>, or backchanneling |yeah|, |mhm|.
Format the output as valid JSON with this exact structure:
{
  "dialogueParts": [
    { "speaker": "Alex", "text": "...", "style": "brief emotional direction" },
    { "speaker": "Sam", "text": "...", "style": "brief emotional direction" }
  ]
}
Return ONLY valid raw JSON.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        try {
          const parsed = JSON.parse(response.text || '{}');
          return NextResponse.json(parsed);
        } catch {
          return NextResponse.json({
            dialogueParts: [
              {
                speaker: 'Alex',
                text: 'Welcome back! <breath> Today we are diving deep into voice synthesis.',
                style: 'Bright and energetic',
              },
              {
                speaker: 'Sam',
                text: "That's right, |yeah| the emotional nuance this year is astounding.",
                style: 'Curious and engaged',
              },
            ],
          });
        }
      } else {
        const prompt = `Create a short, expressive voice-acting monologue (2 to 4 sentences, 35-70 words).
Genre: ${genre || 'Cinematic / Expressive story'}
Emotion/Style: ${emotion || 'Intense and atmospheric'}
Language: ${language || 'English'}

Include 1-2 realistic vocal bursts like <breath>, <gasp>, <sigh>, or <chuckle> to showcase realistic emotional speech synthesis.
Return ONLY the monologue text with no quotes, title, or surrounding metadata.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
        });

        return NextResponse.json({
          sampleText: response.text ? response.text.trim() : '',
        });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in script director:', error);
    return NextResponse.json(
      { error: error?.message || 'Error processing script direction.' },
      { status: 500 }
    );
  }
}

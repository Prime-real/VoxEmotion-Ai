import { NextRequest, NextResponse } from 'next/server';
import { ai } from '@/lib/gemini';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { videoBase64, videoUrl, audioBase64 } = body;

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not configured on the server.' },
        { status: 500 }
      );
    }

    let audioData: string | null = null;
    let audioMimeType = 'audio/wav';
    const tmpDir = '/tmp';
    const uniqueId = `vid_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tempVideoPath = path.join(tmpDir, `${uniqueId}_input.mp4`);
    const tempAudioPath = path.join(tmpDir, `${uniqueId}_audio.wav`);

    // Case 1: Audio is directly provided
    if (audioBase64) {
      const cleanB64 = audioBase64.replace(/^data:[^;]+;base64,/, '');
      audioData = cleanB64;
    }
    // Case 2: Relative public sample URL
    else if (videoUrl && videoUrl.startsWith('/samples/')) {
      const localSamplePath = path.join(process.cwd(), 'public', videoUrl);
      if (fs.existsSync(localSamplePath)) {
        await execAsync(
          `ffmpeg -y -i "${localSamplePath}" -vn -ac 1 -ar 16000 -c:a pcm_s16le "${tempAudioPath}"`
        );
        if (fs.existsSync(tempAudioPath)) {
          const wavBuffer = fs.readFileSync(tempAudioPath);
          audioData = wavBuffer.toString('base64');
          fs.unlinkSync(tempAudioPath);
        }
      }
    }
    // Case 3: Video Base64 provided
    else if (videoBase64) {
      const cleanVideoB64 = videoBase64.replace(/^data:[^;]+;base64,/, '');
      const videoBuffer = Buffer.from(cleanVideoB64, 'base64');
      fs.writeFileSync(tempVideoPath, videoBuffer);

      // Extract 16kHz mono audio WAV for speech recognition
      await execAsync(
        `ffmpeg -y -i "${tempVideoPath}" -vn -ac 1 -ar 16000 -c:a pcm_s16le "${tempAudioPath}"`
      );

      if (fs.existsSync(tempAudioPath)) {
        const wavBuffer = fs.readFileSync(tempAudioPath);
        audioData = wavBuffer.toString('base64');
        fs.unlinkSync(tempAudioPath);
      }
      if (fs.existsSync(tempVideoPath)) {
        fs.unlinkSync(tempVideoPath);
      }
    }

    if (!audioData) {
      return NextResponse.json(
        { error: 'No valid video or audio could be extracted from input.' },
        { status: 400 }
      );
    }

    // Call Gemini 3.8 Flash with Multimodal Audio
    const prompt = `You are an expert audiovisual speech intelligence model, multilingual transcriptionist, and dubbing director.
Analyze this video audio recording with extreme precision:
1. Detect the primary spoken language with exact ISO 639-1 code (e.g. 'en', 'es', 'ja', 'fr', 'de', 'hi', 'zh', etc.), full language name, detected dialect/accent, and detection confidence percentage (e.g. 98.5).
2. Transcribe the verbatim spoken script, segmenting each sentence or conversational breath group.
   For each segment provide:
   - "id": sequential id (e.g. "seg-1", "seg-2")
   - "startTime": timestamp format mm:ss (e.g. "00:00")
   - "endTime": timestamp format mm:ss (e.g. "00:04")
   - "speaker": speaker label (e.g. "Speaker 1" or "Narrator")
   - "tone": emotional delivery tone (e.g. "Enthusiastic", "Inspiring", "Calm", "Dramatic", "Conversational")
   - "originalText": exact spoken dialogue
3. Audio quality diagnostics:
   - "hasBackgroundMusic": boolean
   - "clarityScore": number 1 to 100
   - "estimatedWpm": number estimated speaking speed in words per minute
   - "summary": 1-2 sentence overview of what the video is about and its acoustic character.

Return strictly valid JSON matching this schema:
{
  "detectedLanguage": {
    "name": "English",
    "code": "en",
    "dialect": "American English",
    "confidence": 99.2
  },
  "segments": [
    {
      "id": "seg-1",
      "startTime": "00:00",
      "endTime": "00:04",
      "speaker": "Speaker 1",
      "tone": "Inspiring",
      "originalText": "Verbatim transcript text"
    }
  ],
  "fullScript": "Full merged script text",
  "diagnostics": {
    "hasBackgroundMusic": false,
    "clarityScore": 96,
    "estimatedWpm": 142,
    "summary": "Brief summary of video content"
  }
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: audioMimeType,
                data: audioData,
              },
            },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '';
    let parsedData;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      // Fallback regex extraction if wrapped in markdown
      const match = responseText.match(/\{[\s\S]*\}/);
      if (match) {
        parsedData = JSON.parse(match[0]);
      } else {
        throw new Error('Failed to parse language detection JSON.');
      }
    }

    return NextResponse.json(parsedData);
  } catch (error: any) {
    console.error('Video language detection error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to detect video language and extract script.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const {
      videoBase64,
      videoUrl,
      dubAudioBase64,
      originalVolume = 0.1, // 0.0 to 1.0
      dubVolume = 1.0,
      filename = 'dubbed_video.mp4',
    } = await req.json();

    if (!dubAudioBase64) {
      return NextResponse.json(
        { error: 'Dubbed audio is required to merge.' },
        { status: 400 }
      );
    }

    const tmpDir = '/tmp';
    const id = `merge_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const tempVideoPath = path.join(tmpDir, `${id}_video.mp4`);
    const tempAudioPath = path.join(tmpDir, `${id}_dub.wav`);
    const tempOutPath = path.join(tmpDir, `${id}_out.mp4`);

    // 1. Prepare video file
    if (videoUrl && videoUrl.startsWith('/samples/')) {
      const localSamplePath = path.join(process.cwd(), 'public', videoUrl);
      if (fs.existsSync(localSamplePath)) {
        fs.copyFileSync(localSamplePath, tempVideoPath);
      } else {
        throw new Error('Sample video file not found.');
      }
    } else if (videoBase64) {
      const cleanVideo = videoBase64.replace(/^data:[^;]+;base64,/, '');
      fs.writeFileSync(tempVideoPath, Buffer.from(cleanVideo, 'base64'));
    } else {
      return NextResponse.json(
        { error: 'No video source provided to merge.' },
        { status: 400 }
      );
    }

    // 2. Prepare dubbed audio file
    const cleanAudio = dubAudioBase64.replace(/^data:[^;]+;base64,/, '');
    fs.writeFileSync(tempAudioPath, Buffer.from(cleanAudio, 'base64'));

    // 3. Run ffmpeg muxing
    let ffmpegCmd = '';
    if (originalVolume <= 0.01) {
      // Complete audio replacement
      ffmpegCmd = `ffmpeg -y -i "${tempVideoPath}" -i "${tempAudioPath}" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest "${tempOutPath}"`;
    } else {
      // Ducked background audio + full dubbed voice
      ffmpegCmd = `ffmpeg -y -i "${tempVideoPath}" -i "${tempAudioPath}" -filter_complex "[0:a]volume=${originalVolume.toFixed(2)}[bg];[1:a]volume=${dubVolume.toFixed(2)}[dub];[bg][dub]amix=inputs=2:duration=first:dropout_transition=2[aout]" -map 0:v:0 -map "[aout]" -c:v copy -c:a aac -b:a 192k "${tempOutPath}"`;
    }

    await execAsync(ffmpegCmd);

    if (!fs.existsSync(tempOutPath)) {
      throw new Error('ffmpeg failed to output merged video file.');
    }

    const mergedBuffer = fs.readFileSync(tempOutPath);
    const mergedBase64 = mergedBuffer.toString('base64');

    // Clean up temporary files
    try {
      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
      if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
      if (fs.existsSync(tempOutPath)) fs.unlinkSync(tempOutPath);
    } catch (cleanupErr) {
      console.warn('Temp cleanup warning:', cleanupErr);
    }

    return NextResponse.json({
      success: true,
      videoBase64: mergedBase64,
      mimeType: 'video/mp4',
      filename,
      sizeBytes: mergedBuffer.length,
    });
  } catch (error: any) {
    console.error('Merge dub video error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to merge video with dubbed audio.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  const tmpDir = '/tmp';
  const id = `merge_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const tempVideoPath = path.join(tmpDir, `${id}_video.mp4`);
  const tempAudioPath = path.join(tmpDir, `${id}_dub.wav`);
  const tempOutPath = path.join(tmpDir, `${id}_out.mp4`);

  let tempVideoCreated = false;
  let tempAudioCreated = false;

  try {
    const contentType = req.headers.get('content-type') || '';
    let videoBase64: string | undefined;
    let videoUrl: string | undefined;
    let cachedVideoId: string | undefined;
    let dubAudioBase64: string | undefined;
    let originalVolume = 0.1;
    let dubVolume = 1.0;
    let filename = 'dubbed_video.mp4';
    let wantsBinary = req.headers.get('accept')?.includes('video/') || false;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const videoFile = formData.get('video') as File | null;
      const audioFile = formData.get('audio') as File | null;
      videoUrl = (formData.get('videoUrl') as string) || undefined;
      cachedVideoId = (formData.get('cachedVideoId') as string) || undefined;
      dubAudioBase64 = (formData.get('dubAudioBase64') as string) || undefined;
      originalVolume = parseFloat((formData.get('originalVolume') as string) || '0.1');
      dubVolume = parseFloat((formData.get('dubVolume') as string) || '1.0');
      filename = (formData.get('filename') as string) || filename;
      wantsBinary = true;

      if (videoFile && typeof videoFile.arrayBuffer === 'function') {
        const ab = await videoFile.arrayBuffer();
        fs.writeFileSync(tempVideoPath, Buffer.from(ab));
        tempVideoCreated = true;
      }
      if (audioFile && typeof audioFile.arrayBuffer === 'function') {
        const ab = await audioFile.arrayBuffer();
        fs.writeFileSync(tempAudioPath, Buffer.from(ab));
        tempAudioCreated = true;
      }
    } else {
      const body = await req.json();
      videoBase64 = body.videoBase64;
      videoUrl = body.videoUrl;
      cachedVideoId = body.cachedVideoId;
      dubAudioBase64 = body.dubAudioBase64;
      originalVolume = typeof body.originalVolume === 'number' ? body.originalVolume : 0.1;
      dubVolume = typeof body.dubVolume === 'number' ? body.dubVolume : 1.0;
      filename = body.filename || filename;
      if (body.format === 'binary') wantsBinary = true;
    }

    // 1. Prepare video file
    if (!tempVideoCreated) {
      if (cachedVideoId) {
        const candidates = fs
          .readdirSync(tmpDir)
          .filter((f) => f.startsWith(`${cachedVideoId}_`) || f.startsWith(cachedVideoId));
        if (candidates.length > 0) {
          const cachedPath = path.join(tmpDir, candidates[0]);
          fs.copyFileSync(cachedPath, tempVideoPath);
          tempVideoCreated = true;
        } else {
          return NextResponse.json(
            { error: 'Cached video expired or not found. Please re-import or upload.' },
            { status: 404 }
          );
        }
      } else if (videoUrl && videoUrl.startsWith('/samples/')) {
        const localSamplePath = path.join(process.cwd(), 'public', videoUrl);
        if (fs.existsSync(localSamplePath)) {
          fs.copyFileSync(localSamplePath, tempVideoPath);
          tempVideoCreated = true;
        } else {
          return NextResponse.json({ error: 'Sample video not found.' }, { status: 404 });
        }
      } else if (videoBase64) {
        const cleanVideo = videoBase64.replace(/^data:[^;]+;base64,/, '');
        fs.writeFileSync(tempVideoPath, Buffer.from(cleanVideo, 'base64'));
        tempVideoCreated = true;
      } else {
        return NextResponse.json(
          { error: 'No video source provided to merge. Please select or upload a video.' },
          { status: 400 }
        );
      }
    }

    // 2. Prepare dubbed audio file
    if (!tempAudioCreated) {
      if (!dubAudioBase64) {
        return NextResponse.json(
          { error: 'Dubbed audio is required to merge.' },
          { status: 400 }
        );
      }
      const cleanAudio = dubAudioBase64.replace(/^data:[^;]+;base64,/, '');
      fs.writeFileSync(tempAudioPath, Buffer.from(cleanAudio, 'base64'));
      tempAudioCreated = true;
    }

    // 3. Probe if video has an existing audio track
    let hasAudioStream = false;
    try {
      const probeRes = await execAsync(
        `ffprobe -v error -select_streams a:0 -show_entries stream=codec_type -of default=noprint_wrappers=1:nokey=1 "${tempVideoPath}"`
      );
      if (probeRes.stdout && probeRes.stdout.toLowerCase().includes('audio')) {
        hasAudioStream = true;
      }
    } catch {
      hasAudioStream = false;
    }

    // 4. Run ffmpeg muxing with fallback
    let ffmpegCmd = '';
    if (hasAudioStream && originalVolume > 0.01) {
      // Ducked original audio + dubbed voiceover
      ffmpegCmd = `ffmpeg -y -i "${tempVideoPath}" -i "${tempAudioPath}" -filter_complex "[0:a]volume=${originalVolume.toFixed(2)}[bg];[1:a]volume=${dubVolume.toFixed(2)}[dub];[bg][dub]amix=inputs=2:duration=first:dropout_transition=2[aout]" -map 0:v:0 -map "[aout]" -c:v copy -c:a aac -b:a 192k -shortest "${tempOutPath}"`;
    } else {
      // Clean audio replacement
      ffmpegCmd = `ffmpeg -y -i "${tempVideoPath}" -i "${tempAudioPath}" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest "${tempOutPath}"`;
    }

    try {
      await execAsync(ffmpegCmd);
    } catch (muxErr: any) {
      console.warn('Initial ffmpeg copy mux failed, retrying with ultrafast re-encoding:', muxErr.message);
      // Fallback: transcode video to guarantee codec and timing synchronization
      const fallbackCmd = hasAudioStream && originalVolume > 0.01
        ? `ffmpeg -y -i "${tempVideoPath}" -i "${tempAudioPath}" -filter_complex "[0:a]volume=${originalVolume.toFixed(2)}[bg];[1:a]volume=${dubVolume.toFixed(2)}[dub];[bg][dub]amix=inputs=2:duration=first:dropout_transition=2[aout]" -map 0:v:0 -map "[aout]" -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${tempOutPath}"`
        : `ffmpeg -y -i "${tempVideoPath}" -i "${tempAudioPath}" -map 0:v:0 -map 1:a:0 -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -b:a 192k -shortest "${tempOutPath}"`;
      await execAsync(fallbackCmd);
    }

    if (!fs.existsSync(tempOutPath)) {
      throw new Error('ffmpeg failed to generate merged video file.');
    }

    const mergedBuffer = fs.readFileSync(tempOutPath);

    // Clean up temporary working files
    try {
      if (tempVideoCreated && fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
      if (tempAudioCreated && fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
      if (fs.existsSync(tempOutPath)) fs.unlinkSync(tempOutPath);
    } catch (cleanupErr) {
      console.warn('Temp cleanup warning:', cleanupErr);
    }

    // Return binary video stream if requested or if payload is large (>3MB)
    // to avoid JSON base64 memory bloat and iframe bridge crashes!
    if (wantsBinary || mergedBuffer.length > 3 * 1024 * 1024) {
      return new NextResponse(mergedBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': mergedBuffer.length.toString(),
          'X-Merged-Filename': filename,
        },
      });
    }

    // Otherwise return JSON with base64 for small clips
    const mergedBase64 = mergedBuffer.toString('base64');
    return NextResponse.json({
      success: true,
      videoBase64: mergedBase64,
      mimeType: 'video/mp4',
      filename,
      sizeBytes: mergedBuffer.length,
    });
  } catch (error: any) {
    console.error('Merge dub video error:', error);
    // Cleanup on error
    try {
      if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
      if (fs.existsSync(tempAudioPath)) fs.unlinkSync(tempAudioPath);
      if (fs.existsSync(tempOutPath)) fs.unlinkSync(tempOutPath);
    } catch {}

    return NextResponse.json(
      { error: error.message || 'Failed to merge video with dubbed audio.' },
      { status: 500 }
    );
  }
}

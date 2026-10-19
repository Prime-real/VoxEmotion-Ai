import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id || typeof id !== 'string' || !id.match(/^[a-zA-Z0-9_\-]+$/)) {
      return NextResponse.json({ error: 'Invalid or missing media id.' }, { status: 400 });
    }

    const tmpDir = '/tmp';
    // Look for file starting with id
    const candidateFiles = fs.readdirSync(tmpDir).filter(
      (f) => f.startsWith(`${id}_`) || f.startsWith(id)
    );

    if (candidateFiles.length === 0) {
      return NextResponse.json({ error: 'Video file not found or expired.' }, { status: 404 });
    }

    // Pick media file
    const matchedFile = candidateFiles.find((f) => f.match(/\.(mp4|webm|mov|mkv|wav|mp3)$/i)) || candidateFiles[0];
    const filePath = path.join(tmpDir, matchedFile);

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.get('range');

    let contentType = 'video/mp4';
    if (matchedFile.endsWith('.webm')) contentType = 'video/webm';
    else if (matchedFile.endsWith('.wav')) contentType = 'audio/wav';
    else if (matchedFile.endsWith('.mp3')) contentType = 'audio/mpeg';

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const fileStream = fs.createReadStream(filePath, { start, end });
      const stream = new ReadableStream({
        start(controller) {
          fileStream.on('data', (chunk) => controller.enqueue(chunk));
          fileStream.on('end', () => controller.close());
          fileStream.on('error', (err) => controller.error(err));
        },
      });

      return new NextResponse(stream, {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize.toString(),
          'Content-Type': contentType,
        },
      });
    }

    const fileStream = fs.createReadStream(filePath);
    const stream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk) => controller.enqueue(chunk));
        fileStream.on('end', () => controller.close());
        fileStream.on('error', (err) => controller.error(err));
      },
    });

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Length': fileSize.toString(),
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (error: any) {
    console.error('Video stream error:', error);
    return NextResponse.json({ error: error.message || 'Stream error' }, { status: 500 });
  }
}

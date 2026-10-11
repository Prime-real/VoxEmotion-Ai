import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

const FORMAT_CONFIG: Record<
  string,
  { args: (bitrate: string) => string[]; mimeType: string; ext: string }
> = {
  mp3: {
    args: (b) => [
      '-threads',
      '2',
      '-c:a',
      'libmp3lame',
      '-b:a',
      b,
      '-compression_level',
      '2',
      '-f',
      'mp3',
    ],
    mimeType: 'audio/mpeg',
    ext: 'mp3',
  },
  aac: {
    args: (b) => ['-threads', '2', '-c:a', 'aac', '-b:a', b, '-f', 'adts'],
    mimeType: 'audio/aac',
    ext: 'aac',
  },
  flac: {
    args: () => ['-threads', '2', '-c:a', 'flac', '-compression_level', '3', '-f', 'flac'],
    mimeType: 'audio/flac',
    ext: 'flac',
  },
  ogg: {
    args: (b) => ['-threads', '2', '-c:a', 'libvorbis', '-b:a', b, '-f', 'ogg'],
    mimeType: 'audio/ogg',
    ext: 'ogg',
  },
};

export async function POST(req: NextRequest) {
  try {
    const {
      audioBase64,
      format = 'mp3',
      bitrate = '192k',
      filename = 'audio',
    } = await req.json();

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return NextResponse.json(
        { error: 'No audio data provided for conversion.' },
        { status: 400 }
      );
    }

    const targetFormat = format.toLowerCase().trim();

    // If WAV requested, return as-is
    if (targetFormat === 'wav') {
      return NextResponse.json({
        success: true,
        format: 'wav',
        mimeType: 'audio/wav',
        audioBase64,
        filename: `${filename}.wav`,
      });
    }

    const config = FORMAT_CONFIG[targetFormat];
    if (!config) {
      return NextResponse.json(
        {
          error: `Unsupported format: ${targetFormat}. Supported formats: mp3, aac, wav, flac, ogg.`,
        },
        { status: 400 }
      );
    }

    // Convert input base64 WAV into buffer
    const inputBuffer = Buffer.from(audioBase64, 'base64');

    // Spawn ffmpeg to transcode audio
    const ffmpegArgs = [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      'pipe:0',
      ...config.args(bitrate),
      'pipe:1',
    ];

    const convertedBuffer = await new Promise<Buffer>((resolve, reject) => {
      const child = spawn('ffmpeg', ffmpegArgs);
      const outputChunks: Buffer[] = [];
      let errorOutput = '';

      child.stdout.on('data', (chunk: Buffer) => {
        outputChunks.push(chunk);
      });

      child.stderr.on('data', (chunk: Buffer) => {
        errorOutput += chunk.toString();
      });

      child.on('error', (err) => {
        reject(new Error(`Failed to start ffmpeg process: ${err.message}`));
      });

      child.on('close', (code) => {
        if (code === 0 && outputChunks.length > 0) {
          resolve(Buffer.concat(outputChunks));
        } else {
          reject(
            new Error(
              `Audio conversion to ${targetFormat} failed with code ${code}: ${errorOutput}`
            )
          );
        }
      });

      child.stdin.write(inputBuffer);
      child.stdin.end();
    });

    const convertedBase64 = convertedBuffer.toString('base64');

    return NextResponse.json({
      success: true,
      format: targetFormat,
      mimeType: config.mimeType,
      audioBase64: convertedBase64,
      filename: `${filename}.${config.ext}`,
      sizeBytes: convertedBuffer.length,
    });
  } catch (error: any) {
    console.error('Audio conversion error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to transcode audio file.' },
      { status: 500 }
    );
  }
}

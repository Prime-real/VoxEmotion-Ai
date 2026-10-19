import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const execAsync = promisify(exec);

type VideoPlatform = 'youtube' | 'instagram' | 'tiktok' | 'pinterest' | 'vimeo' | 'direct' | 'unknown';

function detectPlatform(url: string): VideoPlatform {
  const u = url.toLowerCase();
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (u.includes('pinterest.com') || u.includes('pin.it')) return 'pinterest';
  if (u.includes('vimeo.com')) return 'vimeo';
  if (u.match(/\.(mp4|webm|mov|m4v)(\?.*)?$/)) return 'direct';
  return 'unknown';
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) {
      return NextResponse.json(
        { error: 'Please provide a valid http or https video URL.' },
        { status: 400 }
      );
    }

    const cleanUrl = url.trim();
    const platform = detectPlatform(cleanUrl);
    const id = `link_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const tmpDir = '/tmp';
    const tempOutTemplate = path.join(tmpDir, `${id}_media.%(ext)s`);

    // Case 1: Direct MP4 / WebM / Video File URL
    if (platform === 'direct' || cleanUrl.match(/\.(mp4|webm|mov)(\?.*)?$/i)) {
      try {
        const response = await fetch(cleanUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length > 50 * 1024 * 1024) {
          return NextResponse.json(
            { error: 'Video exceeds 50MB browser limit. Please select a shorter clip.' },
            { status: 400 }
          );
        }

        const targetFile = path.join(tmpDir, `${id}_media.mp4`);
        fs.writeFileSync(targetFile, buffer);

        const b64 = buffer.length <= 5 * 1024 * 1024 ? buffer.toString('base64') : null;

        return NextResponse.json({
          success: true,
          platform,
          cachedVideoId: id,
          streamUrl: `/api/video/stream?id=${id}`,
          title: cleanUrl.split('/').pop()?.split('?')[0] || 'Direct Video Clip',
          videoBase64: b64,
          mimeType: response.headers.get('content-type') || 'video/mp4',
          duration: 15,
        });
      } catch (directErr: any) {
        console.warn('Direct fetch attempt failed:', directErr);
      }
    }

    // Case 2: Attempt yt-dlp download for social media platforms
    try {
      // Limit download to first 120s / 40MB max for fast processing
      const cmd = `yt-dlp --no-warnings --no-playlist --max-filesize 40M -f "best[height<=720]/best" -o "${tempOutTemplate}" "${cleanUrl}"`;
      await execAsync(cmd, { timeout: 25000 });

      // Find the output file
      const files = fs.readdirSync(tmpDir).filter((f) => f.startsWith(`${id}_media.`));
      if (files.length > 0) {
        const filePath = path.join(tmpDir, files[0]);
        const fileBuffer = fs.readFileSync(filePath);
        const b64 = fileBuffer.length <= 5 * 1024 * 1024 ? fileBuffer.toString('base64') : null;

        return NextResponse.json({
          success: true,
          platform,
          cachedVideoId: id,
          streamUrl: `/api/video/stream?id=${id}`,
          title: `${platform.toUpperCase()} Video Clip`,
          videoBase64: b64,
          mimeType: 'video/mp4',
          duration: 20,
        });
      }
    } catch (ytdlpErr: any) {
      console.warn('yt-dlp download attempt error:', ytdlpErr.message);

      // Check if it's a known bot/login protection error
      const isBotProtected =
        ytdlpErr.message.includes('Sign in to confirm') ||
        ytdlpErr.message.includes('login') ||
        ytdlpErr.message.includes('bot') ||
        ytdlpErr.message.includes('403');

      return NextResponse.json(
        {
          error: isBotProtected
            ? `${platform.toUpperCase()} requires login authentication or bot verification for this specific link. Please use our instant 1-click social demo clips or upload the downloaded video file directly.`
            : `Could not retrieve video from ${platform.toUpperCase()} link. Ensure the link is public or upload the video file directly.`,
          platform,
          isProtected: isBotProtected,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to retrieve video stream from the provided link.' },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('Resolve video link error:', err);
    return NextResponse.json(
      { error: err.message || 'Error processing video link.' },
      { status: 500 }
    );
  }
}

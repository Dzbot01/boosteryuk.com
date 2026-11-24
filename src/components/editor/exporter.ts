import type { Clip, MediaAsset } from './types';

export interface ExportSettings {
  resolution: string;
  fps: number;
  format: string;
  bitrate: number; // kbps
  filename: string;
}

export const RES_HEIGHT: Record<string, number> = { '480p': 480, '720p': 720, '1080p': 1080, '2K': 1440, '4K': 2160 };

/** Gabungkan filter CSS jadi properti canvas (kecerahan/kontras/saturasi + filter preset). */
function cssToCanvas(adjust: Record<string, number>, filterCss: string, strength: number) {
  const a = adjust;
  const parts = [
    `brightness(${(100 + a.Brightness) / 100})`,
    `contrast(${(100 + a.Contrast) / 100})`,
    `saturate(${(100 + a.Saturation) / 100})`,
  ];
  if (strength > 0 && filterCss) parts.push(filterCss);
  return parts.join(' ');
}

interface DrawArgs {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  time: number;
  assets: MediaAsset[];
  clips: Clip[];
  videoEl: HTMLVideoElement | null;
  imageEl: HTMLImageElement | null;
  style: { adjust: Record<string, number>; filterCss: string; filterStrength: number; zoomPct: number; posX: number; posY: number; opacity: number };
}

/** Gambar satu frame ke canvas (dipakai untuk PNG maupun stream .webm). */
export function drawFrame({ ctx, w, h, time, assets, clips, videoEl, imageEl, style }: DrawArgs) {
  ctx.save();
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.filter = cssToCanvas(style.adjust, style.filterCss, style.filterStrength);
  ctx.globalAlpha = style.opacity / 100;

  const clip = clips.find((c) => c.track === 'video' && time >= c.start && time <= c.start + c.duration);
  const asset = clip?.assetId ? assets.find((a) => a.id === clip.assetId) : undefined;
  const scale = 0.6 + (style.zoomPct / 100) * 0.9;

  const draw = (src: CanvasImageSource, sw: number, sh: number) => {
    const ratio = Math.min(w / sw, h / sh);
    const dw = sw * ratio * scale;
    const dh = sh * ratio * scale;
    ctx.drawImage(src, (w - dw) / 2 + style.posX, (h - dh) / 2 + style.posY, dw, dh);
  };

  if (asset?.kind === 'video' && videoEl) draw(videoEl, videoEl.videoWidth || 16, videoEl.videoHeight || 9);
  else if (asset && imageEl) draw(imageEl, imageEl.naturalWidth || 16, imageEl.naturalHeight || 9);
  else if (clip?.thumb && imageEl) draw(imageEl, imageEl.naturalWidth || 160, imageEl.naturalHeight || 100);

  ctx.restore();
}

/** Ekspor frame saat ini sebagai PNG. */
export async function exportPng(args: DrawArgs, filename: string) {
  const { ctx } = args;
  drawFrame(args);
  const blob = await new Promise<Blob | null>((res) => ctx.canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('Gagal membuat PNG');
  download(blob, `${filename}.png`);
}

/** Ekspor timeline sebagai video .webm (VP9/Opus) memakai MediaRecorder. */
export async function exportVideo(args: Omit<DrawArgs, 'ctx'> & { ctx: CanvasRenderingContext2D }, settings: ExportSettings) {
  const { clips, assets, videoEl } = args;
  const videoClips = clips.filter((c) => c.track === 'video').sort((a, b) => a.start - b.start);
  const duration = videoClips.length ? videoClips[videoClips.length - 1].start + videoClips[videoClips.length - 1].duration : 0;
  if (!duration) throw new Error('Tidak ada clip video di timeline');

  const stream = args.ctx.canvas.captureStream(settings.fps);

  // Audio: video asli + musik tambahan dicampur ke satu destination.
  const AudioCtor: typeof AudioContext | undefined = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  let audioCtx: AudioContext | null = null;
  const audioEls: HTMLAudioElement[] = [];
  if (AudioCtor) {
    audioCtx = new AudioCtor();
    const dest = audioCtx.createMediaStreamDestination();
    for (const track of stream.getAudioTracks()) stream.removeTrack(track);
    for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
    if (videoEl) {
      try {
        const src = audioCtx.createMediaElementSource(videoEl);
        src.connect(dest);
      } catch { /* sumber sudah pernah dibuat */ }
    }
    const musicClips = clips.filter((c) => c.track === 'audio');
    for (const mc of musicClips) {
      const asset = assets.find((a) => a.id === mc.assetId);
      if (!asset?.url || asset.kind !== 'audio') continue;
      const el = new Audio(asset.url);
      el.crossOrigin = 'anonymous';
      audioEls.push(el);
      const src = audioCtx.createMediaElementSource(el);
      src.connect(dest);
    }
  }

  const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm';
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: settings.bitrate * 1000 });
  const chunks: BlobPart[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  const done = new Promise<Blob>((res) => {
    rec.onstop = () => res(new Blob(chunks, { type: 'video/webm' }));
  });

  rec.start();
  const startedAt = performance.now();
  if (videoEl) { videoEl.currentTime = 0; await videoEl.play().catch(() => undefined); }
  for (const el of audioEls) await el.play().catch(() => undefined);

  const tick = () => {
    const t = (performance.now() - startedAt) / 1000;
    args.time = Math.min(t, duration);
    drawFrame({ ...args, time: args.time });
    if (videoEl && videoClips.length) {
      const c = videoClips.find((v) => args.time >= v.start && args.time <= v.start + v.duration);
      if (c) videoEl.currentTime = c.inPoint + (args.time - c.start);
    }
    if (t < duration) requestAnimationFrame(tick);
  };
  tick();

  await new Promise<void>((res) => window.setTimeout(res, duration * 1000 + 300));
  rec.stop();
  videoEl?.pause();
  for (const el of audioEls) el.pause();
  const blob = await done;
  audioCtx?.close().catch(() => undefined);
  download(blob, `${settings.filename}.webm`);
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

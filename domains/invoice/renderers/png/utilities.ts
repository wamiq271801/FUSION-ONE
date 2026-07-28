import type { SKRSContext2D } from '@napi-rs/canvas';

export const FONT = 'Arial';
export function text(ctx: SKRSContext2D, value: string, x: number, y: number, size = 14, weight = 'normal', color = '#111111', align: CanvasTextAlign = 'left') {
  ctx.font = `${weight} ${size}px ${FONT}`; ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value, x, y);
}
export function lines(ctx: SKRSContext2D, value: string, x: number, y: number, maxWidth: number, lineHeight: number, size = 14, weight = 'normal', color = '#111111') {
  ctx.font = `${weight} ${size}px ${FONT}`; const words = value.split(/\s+/); let line = ''; let row = 0;
  for (const word of words) { const next = `${line}${line ? ' ' : ''}${word}`; if (line && ctx.measureText(next).width > maxWidth) { text(ctx, line, x, y + row++ * lineHeight, size, weight, color); line = word; } else line = next; }
  if (line) text(ctx, line, x, y + row++ * lineHeight, size, weight, color); return row * lineHeight;
}

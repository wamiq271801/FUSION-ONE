export const prestigeColors = { black: '#111111', gold: '#C9A227', white: '#FFFFFF', muted: '#6B7280', faint: '#9CA3AF', border: '#E5E7EB', green: '#2D6A35', greenBg: '#F6FBF6', greenBorder: '#D1EAD4' } as const;

export async function loadOptionalImage(url?: string) {
  if (!url) return null;
  try {
    const { loadImage } = await import('@napi-rs/canvas');
    return await loadImage(url);
  } catch { return null; }
}

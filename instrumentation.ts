export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { whatsappManager } = await import('./platform/whatsapp/manager');
  void whatsappManager.start().catch(() => undefined);
}

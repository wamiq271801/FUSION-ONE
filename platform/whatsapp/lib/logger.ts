type Fields = Record<string, unknown>;
export const whatsappLog = (level: 'info' | 'warn' | 'error', event: string, fields: Fields = {}) => {
  const safe = Object.fromEntries(Object.entries(fields).filter(([key]) => !/qr|credential|token|key|dataUri/i.test(key)));
  console[level]({ scope: 'whatsapp', event, ...safe });
};

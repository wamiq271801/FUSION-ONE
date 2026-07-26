/**
 * WhatsApp error code → user-friendly toast messages.
 * Used by the panel and send pages to show clear descriptions.
 */

interface ErrorInfo {
  title: string;
  message: string;
}

const ERROR_MAP: Record<string, ErrorInfo> = {
  // Auth
  UNAUTHORIZED:              { title: 'Authentication Failed', message: 'Invalid API key. Check your WhatsApp backend configuration.' },
  FORBIDDEN:                 { title: 'Access Denied', message: 'You do not have permission to perform this action.' },

  // Validation
  VALIDATION_ERROR:          { title: 'Invalid Request', message: 'The request data is invalid. Check the input and try again.' },
  INVALID_RECIPIENT:         { title: 'Invalid Number', message: 'The phone number is not registered on WhatsApp.' },

  // Media
  MEDIA_MISSING:             { title: 'No File', message: 'No invoice image was generated. Try again.' },
  MEDIA_REQUIRED:            { title: 'No File', message: 'No invoice image was generated. Try again.' },
  MEDIA_UNSUPPORTED_TYPE:    { title: 'Unsupported File', message: 'The file type is not supported by WhatsApp.' },
  UNSUPPORTED_MEDIA_TYPE:    { title: 'Unsupported File', message: 'The file type is not supported by WhatsApp.' },
  MEDIA_TOO_LARGE:           { title: 'File Too Large', message: 'The invoice image exceeds the size limit.' },

  // Rate limiting
  RATE_LIMITED:              { title: 'Too Many Requests', message: 'Slow down — you are sending messages too quickly.' },

  // Session
  LOGIN_REQUIRED:            { title: 'Not Logged In', message: 'WhatsApp is not connected. Go to Settings to scan the QR code.' },
  WA_NOT_READY:              { title: 'WhatsApp Not Ready', message: 'The WhatsApp service is still initializing. Wait a moment and retry.' },
  WHATSAPP_NOT_READY:        { title: 'WhatsApp Starting', message: 'The WhatsApp service is still initializing. Wait a moment and retry.' },
  WA_ALREADY_AUTHENTICATED:  { title: 'Already Connected', message: 'WhatsApp is already authenticated — no QR needed.' },
  WA_QR_NOT_AVAILABLE:       { title: 'QR Not Ready', message: 'No QR code is available yet. Wait for the service to generate one.' },
  WA_QR_REFRESH_IN_PROGRESS: { title: 'QR Refreshing', message: 'A new QR code is being generated. Please wait.' },
  WA_AUTH_FAILURE:           { title: 'Auth Failed', message: 'WhatsApp authentication failed. Try reconnecting.' },
  WA_LOGOUT_IN_PROGRESS:     { title: 'Logging Out', message: 'WhatsApp is currently logging out. Wait a moment.' },
  WA_RESTART_IN_PROGRESS:    { title: 'Restarting', message: 'The WhatsApp service is restarting. Try again in a few seconds.' },
  CLIENT_RESTARTING:         { title: 'Restarting', message: 'The WhatsApp service is restarting. Try again in a few seconds.' },

  // Sending
  MESSAGE_SEND_FAILED:       { title: 'Send Failed', message: 'WhatsApp could not deliver the message. The number may be invalid or unreachable.' },
  QR_NOT_AVAILABLE:          { title: 'QR Not Ready', message: 'No QR code is available yet. Wait for the service to generate one.' },
  QR_EXPIRED:                { title: 'QR Expired', message: 'The QR code has expired. Click Connect again to generate a new one.' },
  INTERNAL_ERROR:            { title: 'Server Error', message: 'Something went wrong on the WhatsApp server. Try again later.' },
};

const FALLBACK: ErrorInfo = { title: 'WhatsApp Error', message: 'An unexpected error occurred.' };

/**
 * Resolve a backend error code (or raw error object) to a user-friendly title + message.
 */
export function resolveWaError(err: any): ErrorInfo {
  // If it's a fetch response body with { error, code }
  const code = err?.code || err?.error?.code;
  if (code && ERROR_MAP[code]) return ERROR_MAP[code];

  // If it's an Error with a message, use it
  const msg = err?.message || err?.error?.message || err?.error;
  if (msg) return { title: FALLBACK.title, message: String(msg) };

  return FALLBACK;
}

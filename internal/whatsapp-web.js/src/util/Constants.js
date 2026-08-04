'use strict';

exports.WhatsWebURL = 'https://web.whatsapp.com/';

exports.DefaultOptions = {
    puppeteer: {
        headless: true,
        defaultViewport: null,
    },
    webVersion: '2.3000.1017054665',
    webVersionCache: {
        type: 'local',
    },
    authTimeoutMs: 0,
    qrMaxRetries: 0,
    userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.67 Safari/537.36',
    bypassCSP: false,
    proxyAuthentication: undefined,
    pairWithPhoneNumber: {
        phoneNumber: '',
        showNotification: true,
        intervalMs: 180000,
    },
};

/**
 * Client status
 * @readonly
 * @enum {number}
 */
exports.Status = {
    INITIALIZING: 0,
    AUTHENTICATING: 1,
    READY: 3,
};

/**
 * Events that can be emitted by the client
 * @readonly
 * @enum {string}
 */
exports.Events = {
    AUTHENTICATED: 'authenticated',
    AUTHENTICATION_FAILURE: 'auth_failure',
    READY: 'ready',
    MESSAGE_ACK: 'message_ack',
    MEDIA_UPLOADED: 'media_uploaded',
    QR_RECEIVED: 'qr',
    CODE_RECEIVED: 'code',
    LOADING_SCREEN: 'loading_screen',
    DISCONNECTED: 'disconnected',
    STATE_CHANGED: 'change_state',
};

/**
 * Message types
 * @readonly
 * @enum {string}
 */
exports.MessageTypes = {
    TEXT: 'chat',
    IMAGE: 'image',
    STICKER: 'sticker',
    VIDEO: 'video',
    AUDIO: 'audio',
    VOICE: 'ptt',
    DOCUMENT: 'document',
    REVOKED: 'revoked',
    UNKNOWN: 'unknown',
    CONTACT_CARD: 'vcard',
    CONTACT_CARD_MULTI: 'multi_vcard',
    GROUP_INVITE: 'groups_v4_invite',
    POLL_CREATION: 'poll_creation',
};

/**
 * WhatsApp state
 * @readonly
 * @enum {string}
 */
exports.WAState = {
    CONFLICT: 'CONFLICT',
    CONNECTED: 'CONNECTED',
    OPENING: 'OPENING',
    PAIRING: 'PAIRING',
    TIMEOUT: 'TIMEOUT',
    UNPAIRED: 'UNPAIRED',
    UNPAIRED_IDLE: 'UNPAIRED_IDLE',
};

/**
 * Message ACK
 * @readonly
 * @enum {number}
 */
exports.MessageAck = {
    ACK_ERROR: -1,
    ACK_PENDING: 0,
    ACK_SERVER: 1,
    ACK_DEVICE: 2,
    ACK_READ: 3,
    ACK_PLAYED: 4,
};

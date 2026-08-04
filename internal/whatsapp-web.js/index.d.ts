import { EventEmitter } from 'events';
import * as puppeteer from 'puppeteer';

/**
 * Vendored internal WhatsApp Web client — image-only sender.
 *
 * This declaration matches the trimmed public surface after the
 * Phase 0-9 refactoring. Only the operations needed to send an
 * image with an optional caption are exposed.
 */
declare namespace WAWebJS {
    // ─── Enums ────────────────────────────────────────────────────────────

    export enum Status {
        INITIALIZING = 0,
        AUTHENTICATING = 1,
        READY = 3,
    }

    export enum Events {
        AUTHENTICATED = 'authenticated',
        AUTHENTICATION_FAILURE = 'auth_failure',
        READY = 'ready',
        MESSAGE_ACK = 'message_ack',
        MEDIA_UPLOADED = 'media_uploaded',
        QR_RECEIVED = 'qr',
        CODE_RECEIVED = 'code',
        LOADING_SCREEN = 'loading_screen',
        DISCONNECTED = 'disconnected',
        STATE_CHANGED = 'change_state',
    }

    export enum WAState {
        CONFLICT = 'CONFLICT',
        CONNECTED = 'CONNECTED',
        OPENING = 'OPENING',
        PAIRING = 'PAIRING',
        TIMEOUT = 'TIMEOUT',
        UNPAIRED = 'UNPAIRED',
        UNPAIRED_IDLE = 'UNPAIRED_IDLE',
    }

    export enum MessageAck {
        ACK_ERROR = -1,
        ACK_PENDING = 0,
        ACK_SERVER = 1,
        ACK_DEVICE = 2,
        ACK_READ = 3,
        ACK_PLAYED = 4,
    }

    export enum MessageTypes {
        TEXT = 'chat',
        IMAGE = 'image',
        STICKER = 'sticker',
        VIDEO = 'video',
        AUDIO = 'audio',
        VOICE = 'ptt',
        DOCUMENT = 'document',
        REVOKED = 'revoked',
        UNKNOWN = 'unknown',
        CONTACT_CARD = 'vcard',
        CONTACT_CARD_MULTI = 'multi_vcard',
        GROUP_INVITE = 'groups_v4_invite',
        POLL_CREATION = 'poll_creation',
    }

    // ─── Client Options ───────────────────────────────────────────────────

    export interface DefaultOptions {
        puppeteer: {
            headless?: boolean;
            defaultViewport?: object | null;
            args?: string[];
            browserWSEndpoint?: string;
            browserURL?: string;
            userDataDir?: string;
            [key: string]: unknown;
        };
        webVersion: string;
        webVersionCache: {
            type: 'local' | 'none';
            path?: string;
            strict?: boolean;
        };
        authTimeoutMs: number;
        qrMaxRetries: number;
        userAgent: string;
        bypassCSP: boolean;
        proxyAuthentication?: { username: string; password: string };
        pairWithPhoneNumber: {
            phoneNumber: string;
            showNotification: boolean;
            intervalMs: number;
        };
    }

    export interface ClientOptions extends Partial<DefaultOptions> {
        authStrategy?: AuthStrategy;
        deviceName?: string;
        browserName?: string;
        evalOnNewDoc?: (this: any, ...args: any[]) => void;
        takeoverOnConflict?: boolean;
        takeoverTimeoutMs?: number;
    }

    // ─── Auth Strategies ──────────────────────────────────────────────────

    export interface AuthStrategy {
        setup(client: Client): void;
        beforeBrowserInitialized(): Promise<void>;
        afterBrowserInitialized(): Promise<void>;
        onAuthenticationNeeded(): Promise<{
            failed: boolean;
            restart: boolean;
            failureEventPayload?: any;
        }>;
        getAuthEventPayload(): Promise<any>;
        afterAuthReady(): Promise<void>;
        disconnect(): Promise<void>;
        destroy(): Promise<void>;
        logout(): Promise<void>;
    }

    export class BaseAuthStrategy implements AuthStrategy {
        constructor();
        protected client: Client;
        setup(client: Client): void;
        beforeBrowserInitialized(): Promise<void>;
        afterBrowserInitialized(): Promise<void>;
        onAuthenticationNeeded(): Promise<{
            failed: boolean;
            restart: boolean;
            failureEventPayload?: any;
        }>;
        getAuthEventPayload(): Promise<any>;
        afterAuthReady(): Promise<void>;
        disconnect(): Promise<void>;
        destroy(): Promise<void>;
        logout(): Promise<void>;
    }

    export class NoAuth extends BaseAuthStrategy {}

    export class LocalAuth extends BaseAuthStrategy {
        constructor(options?: {
            clientId?: string;
            dataPath?: string;
            rmMaxRetries?: number;
        });
    }

    // ─── Structures ───────────────────────────────────────────────────────

    export class Base {
        constructor(client: Client);
        protected client: Client;
        _clone(): this;
        _patch(data: any): any;
    }

    export class ClientInfo extends Base {
        pushname: string;
        wid: object;
        me: object;
        phone?: object;
        platform: string;
    }

    export class MessageMedia {
        mimetype: string;
        data: string;
        filename?: string | null;
        filesize?: number | null;

        constructor(
            mimetype: string,
            data: string,
            filename?: string | null,
            filesize?: number | null,
        );

        static fromFilePath(filePath: string): MessageMedia;

        static fromUrl(
            url: string,
            options?: {
                unsafeMime?: boolean;
                filename?: string;
                client?: Client;
                reqOptions?: { size?: number; [key: string]: unknown };
            },
        ): Promise<MessageMedia>;
    }

    export interface MessageId {
        fromMe: boolean;
        remote: object | string;
        id: string;
        _serialized: string;
        [key: string]: unknown;
    }

    export class Message extends Base {
        _data: any;
        mediaKey?: string;
        id: MessageId;
        ack: MessageAck;
        hasMedia: boolean;
        body: string;
        type: MessageTypes | string;
        timestamp: number;
        from: string;
        to: string;
        author?: string;
        deviceType: string;
        isForwarded: boolean;
        forwardingScore: number;
        isStatus: boolean;
        isStarred: boolean;
        broadcast: boolean;
        fromMe: boolean;
        hasQuotedMsg: boolean;
        hasReaction: boolean;
        duration?: string;
        vCards: string[];
        inviteV4?: object;
        mentionedIds: string[];
        groupMentions: object[];
        orderId?: string;
        token?: string;
        isGif: boolean;
        isEphemeral: boolean;
        title?: string;
        description?: string;
        businessOwnerJid?: string;
        productId?: string;
        latestEditSenderTimestampMs?: number;
        latestEditMsgKey?: object;
        protocolMessageKey?: object;
        links?: Array<{ link: string; isSuspicious: boolean }>;
        dynamicReplyButtons?: any;
        selectedButtonId?: string;
        selectedRowId?: string;
        pollName?: string;
        pollOptions?: any;
        allowMultipleAnswers?: boolean;
        pollInvalidated?: boolean;
        isSentCagPollCreation?: boolean;
        messageSecret?: number[];

        _getChatId(): string;
        reload(): Promise<Message>;
        readonly rawData: any;

        reply(
            content: string | MessageMedia,
            chatId?: string,
            options?: MessageSendOptions,
        ): Promise<Message>;
    }

    // ─── Message Send Options ──────────────────────────────────────────────

    export interface GroupMention {
        subject: string;
        id: string;
    }

    export interface MessageSendOptions {
        linkPreview?: boolean;
        isViewOnce?: boolean;
        caption?: string;
        quotedMessageId?: string;
        groupMentions?: GroupMention[];
        mentions?: string[];
        sendSeen?: boolean;
        ignoreQuoteErrors?: boolean;
        waitUntilMsgSent?: boolean;
        media?: MessageMedia;
        extra?: any;
    }

    // ─── Client ────────────────────────────────────────────────────────────

    export class Client extends EventEmitter {
        constructor(options?: ClientOptions);

        public info: ClientInfo;
        public options: DefaultOptions & ClientOptions;
        public authStrategy: AuthStrategy;
        public pupBrowser?: puppeteer.Browser;
        public pupPage?: puppeteer.Page;
        public currentIndexHtml: string | null;
        public lastLoggedOut: boolean;

        initialize(): Promise<void>;
        inject(): Promise<void>;
        destroy(): Promise<void>;
        logout(): Promise<void>;

        getWWebVersion(): Promise<string>;
        getState(): Promise<string | null>;

        sendMessage(
            chatId: string,
            content: string | MessageMedia,
            options?: MessageSendOptions,
        ): Promise<Message>;

        sendSeen(chatId: string): Promise<boolean>;

        requestPairingCode(
            phoneNumber: string,
            showNotification?: boolean,
            intervalMs?: number,
        ): Promise<string>;

        cancelPairingCode(): Promise<void>;
    }
}

export = WAWebJS;

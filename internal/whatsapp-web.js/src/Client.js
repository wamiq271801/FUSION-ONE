'use strict';

const EventEmitter = require('events');
const puppeteer = require('puppeteer');

const Util = require('./util/Util');
const InterfaceController = require('./util/InterfaceController');
const {
    WhatsWebURL,
    DefaultOptions,
    Events,
    WAState,
} = require('./util/Constants');
const { LoadUtils } = require('./util/Injected/Utils');
const WebCacheFactory = require('./webCache/WebCacheFactory');
const {
    ClientInfo,
    Message,
    MessageMedia,
} = require('./structures');
const NoAuth = require('./authStrategies/NoAuth');
const { exposeFunctionIfAbsent } = require('./util/Puppeteer');

/**
 * Starting point for interacting with the WhatsApp Web API
 * @extends {EventEmitter}
 * @param {object} options - Client options
 * @param {AuthStrategy} options.authStrategy - Determines how to save and restore sessions. If not set, NoAuth will be used.
 * @param {string} options.webVersion - The version of WhatsApp Web to use. Use options.webVersionCache to configure how the version is retrieved.
 * @param {object} options.webVersionCache - Determines how to retrieve the WhatsApp Web version. Defaults to a local cache (LocalWebCache) that falls back to latest if the requested version is not found.
 * @param {number} options.authTimeoutMs - Timeout for authentication selector in puppeteer
 * @param {function} options.evalOnNewDoc - function to eval on new doc
 * @param {object} options.puppeteer - Puppeteer launch options. View docs here: https://github.com/puppeteer/puppeteer/
 * @param {number} options.qrMaxRetries - How many times should the qrcode be refreshed before giving up
 * @param {number} options.takeoverOnConflict - If another whatsapp web session is detected (another browser), take over the session in the current browser
 * @param {number} options.takeoverTimeoutMs - How much time to wait before taking over the session
 * @param {string} options.userAgent - User agent to use in puppeteer
 * @param {boolean} options.bypassCSP - Sets bypassing of page's Content-Security-Policy.
 * @param {string} options.deviceName - Sets the device name of a current linked device., i.e.: 'TEST'.
 * @param {string} options.browserName - Sets the browser name of a current linked device, i.e.: 'Firefox'.
 * @param {object} options.proxyAuthentication - Proxy Authentication object.
 *
 * @fires Client#qr
 * @fires Client#authenticated
 * @fires Client#auth_failure
 * @fires Client#ready
 * @fires Client#message
 * @fires Client#message_ack
 * @fires Client#message_create
 * @fires Client#message_revoke_me
 * @fires Client#message_revoke_everyone
 * @fires Client#message_ciphertext
 * @fires Client#message_edit
 * @fires Client#media_uploaded
 * @fires Client#group_join
 * @fires Client#group_leave
 * @fires Client#group_update
 * @fires Client#disconnected
 * @fires Client#change_state
 * @fires Client#contact_changed
 * @fires Client#group_admin_changed
 * @fires Client#group_membership_request
 * @fires Client#vote_update
 */
class Client extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = Util.mergeDefault(DefaultOptions, options);

        if (!this.options.authStrategy) {
            this.authStrategy = new NoAuth();
        } else {
            this.authStrategy = this.options.authStrategy;
        }

        this.authStrategy.setup(this);

        /**
         * @type {puppeteer.Browser}
         */
        this.pupBrowser = null;
        /**
         * @type {puppeteer.Page}
         */
        this.pupPage = null;

        this.currentIndexHtml = null;
        this.lastLoggedOut = false;
    }

    /**
     * Injection logic
     * Private function
     */
    async inject() {
        // Cancel any previous inject still running
        if (this._injectAbort) this._injectAbort.abort();
        const abort = new AbortController();
        this._injectAbort = abort;

        try {
            const authTimeout = this.options.authTimeoutMs || 30000;
            await this.pupPage
                .waitForFunction('window.Debug?.VERSION != undefined', {
                    timeout: authTimeout,
                    signal: abort.signal,
                })
                .catch((err) => {
                    if (abort.signal.aborted) throw err;
                    throw 'auth timeout';
                });
            if (abort.signal.aborted) return;
            await this.setDeviceName(
                this.options.deviceName,
                this.options.browserName,
            );
            const pairWithPhoneNumber = this.options.pairWithPhoneNumber;
            const version = await this.getWWebVersion();

            const needAuthHandle = await this.pupPage.waitForFunction(
                () => {
                    const state =
                        window.require?.('WAWebSocketModel')?.Socket?.state;
                    if (
                        !state ||
                        state === 'OPENING' ||
                        state === 'UNLAUNCHED' ||
                        state === 'PAIRING'
                    ) {
                        return false;
                    }
                    return {
                        need: state === 'UNPAIRED' || state === 'UNPAIRED_IDLE',
                        state,
                    };
                },
                { timeout: authTimeout },
            );
            const needAuthentication = await needAuthHandle.jsonValue();

            if (needAuthentication.need) {
                const { failed, failureEventPayload, restart } =
                    await this.authStrategy.onAuthenticationNeeded();

                if (failed) {
                    /**
                     * Emitted when there has been an error while trying to restore an existing session
                     * @event Client#auth_failure
                     * @param {string} message
                     */
                    this.emit(
                        Events.AUTHENTICATION_FAILURE,
                        failureEventPayload,
                    );
                    await this.destroy();
                    if (restart) {
                        // session restore failed so try again but without session to force new authentication
                        return this.initialize();
                    }
                    return;
                }

                // Register qr/code events
                if (pairWithPhoneNumber.phoneNumber) {
                    this.requestPairingCode(
                        pairWithPhoneNumber.phoneNumber,
                        pairWithPhoneNumber.showNotification,
                        pairWithPhoneNumber.intervalMs,
                    );
                } else {
                    let qrRetries = 0;

                    this.on(Events.LOADING_SCREEN, () => {
                        qrRetries = 0;
                    });

                    await exposeFunctionIfAbsent(
                        this.pupPage,
                        'onQRChangedEvent',
                        async (qr) => {
                            /**
                             * Emitted when a QR code is received
                             * @event Client#qr
                             * @param {string} qr QR Code
                             */
                            this.emit(Events.QR_RECEIVED, qr);
                            if (this.options.qrMaxRetries > 0) {
                                qrRetries++;
                                if (qrRetries > this.options.qrMaxRetries) {
                                    this.emit(
                                        Events.DISCONNECTED,
                                        'Max qrcode retries reached',
                                    );
                                    await this.destroy();
                                }
                            }
                        },
                    );

                    await this.pupPage.evaluate(async () => {
                        const registrationInfo = await window
                            .require('WAWebSignalStoreApi')
                            .waSignalStore.getRegistrationInfo();
                        const noiseKeyPair = await window
                            .require('WAWebUserPrefsInfoStore')
                            .waNoiseInfo.get();
                        const staticKeyB64 = window
                            .require('WABase64')
                            .encodeB64(noiseKeyPair.staticKeyPair.pubKey);
                        const identityKeyB64 = window
                            .require('WABase64')
                            .encodeB64(registrationInfo.identityKeyPair.pubKey);
                        const advSecretKey = await window
                            .require('WAWebUserPrefsMultiDevice')
                            .getADVSecretKey();
                        const platform = window.require(
                            'WAWebCompanionRegClientUtils',
                        ).DEVICE_PLATFORM;
                        const getQR = (ref) =>
                            ref +
                            ',' +
                            staticKeyB64 +
                            ',' +
                            identityKeyB64 +
                            ',' +
                            advSecretKey +
                            ',' +
                            platform;

                        const onRefChange = (_, ref) => {
                            if (ref == null) return;
                            window.onQRChangedEvent(getQR(ref));
                        };

                        window.onQRChangedEvent(
                            getQR(window.require('WAWebConnModel').Conn.ref),
                        ); // initial qr
                        window
                            .require('WAWebConnModel')
                            .Conn.on('change:ref', onRefChange); // future QR changes

                        // Remove QR listener once authentication succeeds
                        window
                            .require('WAWebSocketModel')
                            .Socket.on('change:hasSynced', () => {
                                window
                                    .require('WAWebConnModel')
                                    .Conn.off('change:ref', onRefChange);
                            });
                    });
                }
            }

            await exposeFunctionIfAbsent(
                this.pupPage,
                'onAuthAppStateChangedEvent',
                async (state) => {
                    if (
                        state == 'UNPAIRED_IDLE' &&
                        !pairWithPhoneNumber.phoneNumber
                    ) {
                        // refresh qr code
                        await this.pupPage.evaluate(() => {
                            window.require('WAWebCmd').Cmd.refreshQR();
                        });
                    }
                },
            );

            await exposeFunctionIfAbsent(
                this.pupPage,
                'onAppStateHasSyncedEvent',
                async () => {
                    const authEventPayload =
                        await this.authStrategy.getAuthEventPayload();
                    /**
                     * Emitted when authentication is successful
                     * @event Client#authenticated
                     */
                    this.emit(Events.AUTHENTICATED, authEventPayload);

                    const injected = await this.pupPage.evaluate(async () => {
                        return typeof window.WWebJS !== 'undefined';
                    });

                    if (!injected) {
                        if (
                            this.options.webVersionCache.type === 'local' &&
                            this.currentIndexHtml
                        ) {
                            const { type: webCacheType, ...webCacheOptions } =
                                this.options.webVersionCache;
                            const webCache = WebCacheFactory.createWebCache(
                                webCacheType,
                                webCacheOptions,
                            );

                            await webCache.persist(
                                this.currentIndexHtml,
                                version,
                            );
                        }

                        // Load util functions (serializers, helper functions)
                        await this.pupPage.evaluate(LoadUtils);

                        await this.pupPage
                            .waitForFunction(
                                'typeof window.WWebJS !== "undefined"',
                                { timeout: 30000 },
                            )
                            .catch(() => {
                                throw 'ready timeout';
                            });

                        /**
                         * Current connection information
                         * @type {ClientInfo}
                         */
                        this.info = new ClientInfo(
                            this,
                            await this.pupPage.evaluate(() => {
                                return {
                                    ...window
                                        .require('WAWebConnModel')
                                        .Conn.serialize(),
                                    wid:
                                        window
                                            .require('WAWebUserPrefsMeUser')
                                            .getMaybeMePnUser() ||
                                        window
                                            .require('WAWebUserPrefsMeUser')
                                            .getMaybeMeLidUser(),
                                };
                            }),
                        );

                        this.interface = new InterfaceController(this);

                        await this.attachEventListeners();
                    }
                    /**
                     * Emitted when the client has initialized and is ready to receive messages.
                     * @event Client#ready
                     */
                    this.emit(Events.READY);
                    this.authStrategy.afterAuthReady();
                },
            );
            let lastPercent = null;
            await exposeFunctionIfAbsent(
                this.pupPage,
                'onOfflineProgressUpdateEvent',
                async (percent) => {
                    if (lastPercent !== percent) {
                        lastPercent = percent;
                        this.emit(Events.LOADING_SCREEN, percent, 'WhatsApp'); // Message is hardcoded as "WhatsApp" for now
                    }
                },
            );
            await exposeFunctionIfAbsent(
                this.pupPage,
                'onLogoutEvent',
                async () => {
                    this.lastLoggedOut = true;
                    await this.pupPage
                        .waitForNavigation({ waitUntil: 'load', timeout: 5000 })
                        .catch((_) => _);
                },
            );
            await this.pupPage.evaluate(() => {
                const Socket = window.require('WAWebSocketModel').Socket;
                const Cmd = window.require('WAWebCmd').Cmd;

                const listeners = [
                    [
                        Socket,
                        'change:state',
                        (_AppState, state) => {
                            window.onAuthAppStateChangedEvent(state);
                        },
                    ],
                    [
                        Socket,
                        'change:hasSynced',
                        () => {
                            window.onAppStateHasSyncedEvent();
                        },
                    ],
                    [
                        Cmd,
                        'offline_progress_update_from_bridge',
                        () => {
                            window.onOfflineProgressUpdateEvent(
                                window
                                    .require('WAWebOfflineHandler')
                                    .OfflineMessageHandler.getOfflineDeliveryProgress(),
                            );
                        },
                    ],
                    [
                        Cmd,
                        'logout',
                        async () => {
                            await window.onLogoutEvent();
                        },
                    ],
                    [
                        Cmd,
                        'logout_from_bridge',
                        async () => {
                            await window.onLogoutEvent();
                        },
                    ],
                ];

                // Clean up old listeners to prevent accumulation on re-inject
                if (window._wwjsListeners) {
                    for (const [obj, event, handler] of window._wwjsListeners) {
                        obj.off(event, handler);
                    }
                }

                for (const [obj, event, handler] of listeners) {
                    obj.on(event, handler);
                }
                window._wwjsListeners = listeners;

                // Atomic hasSynced check in the same synchronous block as listener registration.
                // If hasSynced is already true, Backbone won't fire change:hasSynced (no transition).
                // If hasSynced is false, the listener above will catch the future transition.
                const storeInjected = typeof window.WWebJS !== 'undefined';
                if (Socket.hasSynced === true && !storeInjected) {
                    window.onAppStateHasSyncedEvent();
                }
            });
        } catch (err) {
            if (abort.signal.aborted) return; // superseded by newer inject
            throw err;
        } finally {
            if (this._injectAbort === abort) {
                this._injectAbort = null;
            }
        }
    }

    /**
     * Sets up events and requirements, kicks off authentication request
     */
    async initialize() {
        let /**
             * @type {puppeteer.Browser}
             */
            browser,
            /**
             * @type {puppeteer.Page}
             */
            page;

        browser = null;
        page = null;

        await this.authStrategy.beforeBrowserInitialized();

        const puppeteerOpts = this.options.puppeteer;
        if (
            puppeteerOpts &&
            (puppeteerOpts.browserWSEndpoint || puppeteerOpts.browserURL)
        ) {
            browser = await puppeteer.connect(puppeteerOpts);
            page = await browser.newPage();
        } else {
            const browserArgs = [...(puppeteerOpts.args || [])];
            if (
                this.options.userAgent !== false &&
                !browserArgs.find((arg) => arg.includes('--user-agent'))
            ) {
                browserArgs.push(`--user-agent=${this.options.userAgent}`);
            }
            // navigator.webdriver fix
            browserArgs.push('--disable-blink-features=AutomationControlled');

            browser = await puppeteer.launch({
                ...puppeteerOpts,
                args: browserArgs,
            });
            page = (await browser.pages())[0];
        }

        if (this.options.proxyAuthentication !== undefined) {
            await page.authenticate(this.options.proxyAuthentication);
        }
        if (this.options.userAgent !== false) {
            await page.setUserAgent(this.options.userAgent);
        }
        if (this.options.bypassCSP) await page.setBypassCSP(true);

        this.pupBrowser = browser;
        this.pupPage = page;

        await this.authStrategy.afterBrowserInitialized();
        await this.initWebVersionCache();

        if (this.options.evalOnNewDoc !== undefined) {
            await page.evaluateOnNewDocument(this.options.evalOnNewDoc);
        }

        await page.goto(WhatsWebURL, {
            waitUntil: 'load',
            timeout: 0,
            referer: 'https://whatsapp.com/',
        });

        // Register framenavigated BEFORE inject so that if navigation
        // interrupts inject, the handler triggers a fresh inject.
        this._registerFramenavigatedHandler();

        await this.inject();
    }

    _registerFramenavigatedHandler() {
        if (this._framenavigatedRegistered) return;
        this._framenavigatedRegistered = true;

        this.pupPage.on('framenavigated', async (frame) => {
            if (frame.parentFrame() !== null) return;

            const isLogout =
                frame.url().includes('post_logout=1') || this.lastLoggedOut;

            if (isLogout) {
                this.emit(Events.DISCONNECTED, 'LOGOUT');
                await this.authStrategy.logout();
                await this.authStrategy.beforeBrowserInitialized();
                await this.authStrategy.afterBrowserInitialized();
                this.lastLoggedOut = false;
            }

            const storeAvailable = await this.pupPage.evaluate(() => {
                return typeof window.WWebJS !== 'undefined';
            });

            if (!isLogout && storeAvailable) return;

            await this.inject();
        });
    }

    /**
     * Request authentication via pairing code instead of QR code
     * @param {string} phoneNumber - Phone number in international, symbol-free format (e.g. 12025550108 for US, 551155501234 for Brazil)
     * @param {boolean} [showNotification = true] - Show notification to pair on phone number
     * @param {number} [intervalMs = 180000] - The interval in milliseconds on how frequent to generate pairing code (WhatsApp default to 3 minutes)
     * @returns {Promise<string>} - Returns a pairing code in format "ABCDEFGH"
     */
    async requestPairingCode(
        phoneNumber,
        showNotification = true,
        intervalMs = 180000,
    ) {
        await exposeFunctionIfAbsent(
            this.pupPage,
            'onCodeReceivedEvent',
            async (code) => {
                this.emit(Events.CODE_RECEIVED, code);
                return code;
            },
        );
        return await this.pupPage.evaluate(
            async (phoneNumber, showNotification, intervalMs) => {
                const getCode = async () => {
                    window
                        .require('WAWebAltDeviceLinkingApi')
                        .setPairingType('ALT_DEVICE_LINKING');
                    await window
                        .require('WAWebAltDeviceLinkingApi')
                        .initializeAltDeviceLinking();
                    return window
                        .require('WAWebAltDeviceLinkingApi')
                        .startAltLinkingFlow(phoneNumber, showNotification);
                };
                if (window.codeInterval) {
                    clearInterval(window.codeInterval); // remove existing interval
                }
                window.codeInterval = setInterval(async () => {
                    const state =
                        window.require('WAWebSocketModel').Socket.state;
                    if (state != 'UNPAIRED' && state != 'UNPAIRED_IDLE') {
                        clearInterval(window.codeInterval);
                        return;
                    }
                    window.onCodeReceivedEvent(await getCode());
                }, intervalMs);
                return window.onCodeReceivedEvent(await getCode());
            },
            phoneNumber,
            showNotification,
            intervalMs,
        );
    }

    /**
     * Cancels an active pairing code session and returns to QR code mode
     */
    async cancelPairingCode() {
        await this.pupPage.evaluate(async () => {
            if (window.codeInterval) {
                clearInterval(window.codeInterval);
                window.codeInterval = undefined;
            }
            window.require('WAWebLaunchSocketUtils').refreshQR();
            await window
                .require('WAWebAltDeviceLinkingApi')
                .initializeQRLinking();
        });
    }

    /**
     * Attach event listeners to WA Web
     * Private function
     * @property {boolean} reinject is this a reinject?
     */
    async attachEventListeners() {
        await exposeFunctionIfAbsent(
            this.pupPage,
            'onMessageAckEvent',
            (msg, ack) => {
                const message = new Message(this, msg);

                /**
                 * Emitted when an ack event occurrs on message type.
                 * @event Client#message_ack
                 * @param {Message} message The message that was affected
                 * @param {MessageAck} ack The new ACK value
                 */
                this.emit(Events.MESSAGE_ACK, message, ack);
            },
        );

        await exposeFunctionIfAbsent(
            this.pupPage,
            'onMessageMediaUploadedEvent',
            (msg) => {
                const message = new Message(this, msg);

                /**
                 * Emitted when media has been uploaded for a message sent by the client.
                 * @event Client#media_uploaded
                 * @param {Message} message The message with media that was uploaded
                 */
                this.emit(Events.MEDIA_UPLOADED, message);
            },
        );

        await exposeFunctionIfAbsent(
            this.pupPage,
            'onAppStateChangedEvent',
            async (state) => {
                /**
                 * Emitted when the connection state changes
                 * @event Client#change_state
                 * @param {WAState} state the new connection state
                 */
                this.emit(Events.STATE_CHANGED, state);

                const ACCEPTED_STATES = [
                    WAState.CONNECTED,
                    WAState.OPENING,
                    WAState.PAIRING,
                    WAState.TIMEOUT,
                ];

                if (this.options.takeoverOnConflict) {
                    ACCEPTED_STATES.push(WAState.CONFLICT);

                    if (state === WAState.CONFLICT) {
                        setTimeout(() => {
                            this.pupPage.evaluate(() =>
                                window
                                    .require('WAWebSocketModel')
                                    .Socket.takeover(),
                            );
                        }, this.options.takeoverTimeoutMs);
                    }
                }

                if (!ACCEPTED_STATES.includes(state)) {
                    /**
                     * Emitted when the client has been disconnected
                     * @event Client#disconnected
                     * @param {WAState|"LOGOUT"} reason reason that caused the disconnect
                     */
                    await this.authStrategy.disconnect();
                    this.emit(Events.DISCONNECTED, state);
                    this.destroy();
                }
            },
        );

        await this.pupPage.evaluate(() => {
            const { Msg } = window.require('WAWebCollections');
            const AppState = window.require('WAWebSocketModel').Socket;

            // Enable placeholder message resend (recovery for ciphertext messages)
            const gatingUtils = window.require('WAWebSyncGatingUtils');
            gatingUtils.isPlaceholderMessageResendEnabled = () => true;

            Msg.on('change:ack', (msg, ack) => {
                window.onMessageAckEvent(
                    window.WWebJS.getMessageModel(msg),
                    ack,
                );
            });
            Msg.on('change:isUnsentMedia', (msg, unsent) => {
                if (msg.id.fromMe && !unsent)
                    window.onMessageMediaUploadedEvent(
                        window.WWebJS.getMessageModel(msg),
                    );
            });
            AppState.on('change:state', (_AppState, state) => {
                window.onAppStateChangedEvent(state);
            });

            // Ciphertext resend machinery (kept per plan §6.3).
            // The Node-side event emissions (onAddMessageCiphertextEvent,
            // onCiphertextFailedEvent, onAddMessageEvent) are removed because
            // this is a send-only client. The in-page resend flow is kept to
            // maintain session health: when a ciphertext message arrives,
            // requestResend() asks WhatsApp Web to request a resend from
            // the server after a 5s debounce.
            const pendingResend = new Set();
            let resendFlush = null;

            function requestResend(msg) {
                pendingResend.add(msg);
                if (resendFlush) return;
                resendFlush = setTimeout(() => {
                    resendFlush = null;
                    const msgs = [...pendingResend];
                    pendingResend.clear();
                    if (msgs.length === 0) return;
                    window
                        .require(
                            'WAWebNonMessageDataRequestPlaceholderMessageResendUtils',
                        )
                        .handlePlaceholderMsgsSeen(msgs, true);
                }, 5000);
            }

            Msg.on('add', (msg) => {
                if (!msg.isNewMsg) return;
                if (msg.type !== 'ciphertext') return;
                if (msg.subtype && msg.subtype.endsWith('_unavailable_fanout'))
                    return;
                requestResend(msg);
                msg.once('change:type', (_msg) => {
                    pendingResend.delete(_msg);
                });
            });
        });
    }

    async initWebVersionCache() {
        const { type: webCacheType, ...webCacheOptions } =
            this.options.webVersionCache;
        const webCache = WebCacheFactory.createWebCache(
            webCacheType,
            webCacheOptions,
        );

        const requestedVersion = this.options.webVersion;
        const versionContent = await webCache.resolve(requestedVersion);

        if (versionContent) {
            await this.pupPage.setRequestInterception(true);
            this.pupPage.on('request', async (req) => {
                if (req.url() === WhatsWebURL) {
                    req.respond({
                        status: 200,
                        contentType: 'text/html',
                        body: versionContent,
                    });
                } else {
                    req.continue();
                }
            });
        } else {
            this.pupPage.on('response', async (res) => {
                if (res.ok() && res.url() === WhatsWebURL) {
                    const indexHtml = await res.text();
                    this.currentIndexHtml = indexHtml;
                }
            });
        }
    }

    /**
     * Closes the client
     */
    async destroy() {
        if (this._injectAbort) this._injectAbort.abort();
        this._framenavigatedRegistered = false;

        const browser = this.pupBrowser;
        const isConnected = browser?.isConnected?.();
        if (isConnected) {
            await browser.close();
        }
        await this.authStrategy.destroy();
    }

    /**
     * Logs out the client, closing the current session
     */
    async logout() {
        await this.pupPage.evaluate(() => {
            return window.require('WAWebSocketModel').Socket.logout();
        });
        await this.pupBrowser.close();

        let maxDelay = 0;
        while (this.pupBrowser.isConnected() && maxDelay < 10) {
            // waits a maximum of 1 second before calling the AuthStrategy
            await new Promise((resolve) => setTimeout(resolve, 100));
            maxDelay++;
        }

        await this.authStrategy.logout();
    }

    /**
     * Returns the version of WhatsApp Web currently being run
     * @returns {Promise<string>}
     */
    async getWWebVersion() {
        return await this.pupPage.evaluate(() => {
            return window.Debug.VERSION;
        });
    }

    async setDeviceName(deviceName, browserName) {
        (deviceName || browserName) &&
            (await this.pupPage.evaluate(
                (deviceName, browserName) => {
                    const func = window.require('WAWebMiscBrowserUtils').info;
                    window.require('WAWebMiscBrowserUtils').info = () => {
                        return {
                            ...func(),
                            ...(deviceName ? { os: deviceName } : {}),
                            ...(browserName ? { name: browserName } : {}),
                        };
                    };
                },
                deviceName,
                browserName,
            ));
    }

    /**
     * Mark as seen for the Chat
     *  @param {string} chatId
     *  @returns {Promise<boolean>} result
     *
     */
    async sendSeen(chatId) {
        return await this.pupPage.evaluate(async (chatId) => {
            return window.WWebJS.sendSeen(chatId);
        }, chatId);
    }

    /**
     * An object representing mentions of groups
     * @typedef {Object} GroupMention
     * @property {string} subject - The name of a group to mention (can be custom)
     * @property {string} id - The group ID, e.g.: 'XXXXXXXXXX@g.us'
     */

    /**
     * Message options for sending media.
     * @typedef {Object} MessageSendOptions
     * @property {boolean} [linkPreview=true] - Show links preview. Has no effect on multi-device accounts.
     * @property {boolean} [isViewOnce=false] - Send photo/video as a view once message
     * @property {string} [caption] - Image or video caption
     * @property {string} [quotedMessageId] - Id of the message that is being quoted (or replied to)
     * @property {GroupMention[]} [groupMentions] - An array of object that handle group mentions
     * @property {string[]} [mentions] - User IDs to mention in the message
     * @property {boolean} [sendSeen=true] - Mark the conversation as seen after sending the message
     * @property {boolean} [ignoreQuoteErrors = true] - Should the bot send a quoted message without the quoted message if it fails to get the quote?
     * @property {boolean} [waitUntilMsgSent = false] - Should the bot wait for the message send result?
     * @property {MessageMedia} [media] - Media to be sent
     * @property {any} [extra] - Extra options
     */

    /**
     * Send a message to a specific chatId
     * @param {string} chatId
     * @param {string|MessageMedia} content - Text content or a MessageMedia instance
     * @param {MessageSendOptions} [options] - Options used when sending the message
     *
     * @returns {Promise<Message>} Message that was just sent
     */
    async sendMessage(chatId, content, options = {}) {
        // Image-only sender: channels and status broadcasts are not supported
        if (/@\w*newsletter\b/.test(chatId)) {
            throw new Error(
                'Channel chats are not supported by this image-only sender.',
            );
        }
        if (/@\w*broadcast\b/.test(chatId)) {
            throw new Error(
                'Status broadcasts are not supported by this image-only sender.',
            );
        }

        if (options.mentions) {
            !Array.isArray(options.mentions) &&
                (options.mentions = [options.mentions]);
        }

        options.groupMentions &&
            !Array.isArray(options.groupMentions) &&
            (options.groupMentions = [options.groupMentions]);

        let internalOptions = {
            linkPreview: options.linkPreview === false ? undefined : true,
            caption: options.caption,
            isCaptionByUser: options.caption ? true : false,
            quotedMessageId: options.quotedMessageId,
            mentionedJidList: options.mentions || [],
            groupMentions: options.groupMentions,
            ignoreQuoteErrors: options.ignoreQuoteErrors !== false,
            waitUntilMsgSent: options.waitUntilMsgSent || false,
            extraOptions: options.extra,
        };

        const sendSeen = options.sendSeen !== false;

        if (content instanceof MessageMedia) {
            internalOptions.media = content;
            internalOptions.isViewOnce = options.isViewOnce;
            content = '';
        } else if (options.media instanceof MessageMedia) {
            internalOptions.media = options.media;
            internalOptions.caption = content;
            internalOptions.isViewOnce = options.isViewOnce;
            content = '';
        }

        const sentMsg = await this.pupPage.evaluate(
            async (chatId, content, options, sendSeen) => {
                const chat = await window.WWebJS.getChat(chatId, {
                    getAsModel: false,
                });

                if (!chat) return null;

                if (sendSeen) {
                    await window.WWebJS.sendSeen(chatId);
                }

                const msg = await window.WWebJS.sendMessage(
                    chat,
                    content,
                    options,
                );
                return msg ? window.WWebJS.getMessageModel(msg) : undefined;
            },
            chatId,
            content,
            internalOptions,
            sendSeen,
        );

        return sentMsg ? new Message(this, sentMsg) : undefined;
    }

    /**
     * Gets the current connection state for the client
     * @returns {WAState}
     */
    async getState() {
        return await this.pupPage.evaluate(() => {
            return window.require('WAWebSocketModel').Socket.state ?? null;
        });
    }

}

module.exports = Client;

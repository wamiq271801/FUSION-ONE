'use strict';

const Base = require('./Base');
const MessageMedia = require('./MessageMedia');
const { MessageTypes } = require('../util/Constants');

/**
 * Represents a Message on WhatsApp
 * @extends {Base}
 */
class Message extends Base {
    constructor(client, data) {
        super(client);

        if (data) this._patch(data);
    }

    _patch(data) {
        this._data = data;

        /**
         * MediaKey that represents the sticker 'ID'
         * @type {string}
         */
        this.mediaKey = data.mediaKey;

        /**
         * ID that represents the message
         * @type {object}
         */
        this.id = data.id;

        /**
         * ACK status for the message
         * @type {MessageAck}
         */
        this.ack = data.ack;

        /**
         * Indicates if the message has media available for download
         * @type {boolean}
         */
        this.hasMedia = Boolean(data.directPath);

        /**
         * Message content
         * @type {string}
         */
        this.body = this.hasMedia
            ? data.caption || ''
            : data.body || data.pollName || data.eventName || '';

        /**
         * Message type
         * @type {MessageTypes}
         */
        this.type = data.type;

        /**
         * Unix timestamp for when the message was created
         * @type {number}
         */
        this.timestamp = data.t;

        /**
         * ID for the Chat that this message was sent to, except if the message was sent by the current user.
         * @type {string}
         */
        this.from =
            typeof data.from === 'object' && data.from !== null
                ? data.from._serialized
                : data.from;

        /**
         * ID for who this message is for.
         *
         * If the message is sent by the current user, it will be the Chat to which the message is being sent.
         * If the message is sent by another user, it will be the ID for the current user.
         * @type {string}
         */
        this.to =
            typeof data.to === 'object' && data.to !== null
                ? data.to._serialized
                : data.to;

        /**
         * If the message was sent to a group, this field will contain the user that sent the message.
         * @type {string}
         */
        this.author =
            typeof data.author === 'object' && data.author !== null
                ? data.author._serialized
                : data.author;

        /**
         * String that represents from which device type the message was sent
         * @type {string}
         */
        this.deviceType =
            typeof data.id.id === 'string' && data.id.id.length > 25
                ? 'android'
                : typeof data.id.id === 'string' &&
                    data.id.id.substring(0, 2) === '3A'
                  ? 'ios'
                  : 'web';
        /**
         * Indicates if the message was forwarded
         * @type {boolean}
         */
        this.isForwarded = data.isForwarded;

        /**
         * Indicates how many times the message was forwarded.
         *
         * The maximum value is 127.
         * @type {number}
         */
        this.forwardingScore = data.forwardingScore || 0;

        /**
         * Indicates if the message is a status update
         * @type {boolean}
         */
        this.isStatus =
            data.isStatusV3 || data.id.remote === 'status@broadcast';

        /**
         * Indicates if the message was starred
         * @type {boolean}
         */
        this.isStarred = data.star;

        /**
         * Indicates if the message was a broadcast
         * @type {boolean}
         */
        this.broadcast = data.broadcast;

        /**
         * Indicates if the message was sent by the current user
         * @type {boolean}
         */
        this.fromMe = data.id.fromMe;

        /**
         * Indicates if the message was sent as a reply to another message.
         * @type {boolean}
         */
        this.hasQuotedMsg = data.quotedMsg ? true : false;

        /**
         * Indicates whether there are reactions to the message
         * @type {boolean}
         */
        this.hasReaction = data.hasReaction ? true : false;

        /**
         * Indicates the duration of the message in seconds
         * @type {string}
         */
        this.duration = data.duration ? data.duration : undefined;

        /**
         * List of vCards contained in the message.
         * @type {Array<string>}
         */
        this.vCards =
            data.type === MessageTypes.CONTACT_CARD_MULTI
                ? data.vcardList.map((c) => c.vcard)
                : data.type === MessageTypes.CONTACT_CARD
                  ? [data.body]
                  : [];

        /**
         * Group Invite Data
         * @type {object}
         */
        this.inviteV4 =
            data.type === MessageTypes.GROUP_INVITE
                ? {
                      inviteCode: data.inviteCode,
                      inviteCodeExp: data.inviteCodeExp,
                      groupId: data.inviteGrp,
                      groupName: data.inviteGrpName,
                      fromId:
                          typeof data.from === 'object' &&
                          '_serialized' in data.from
                              ? data.from._serialized
                              : data.from,
                      toId:
                          typeof data.to === 'object' &&
                          '_serialized' in data.to
                              ? data.to._serialized
                              : data.to,
                  }
                : undefined;

        /**
         * Indicates the mentions in the message body.
         * @type {string[]}
         */
        this.mentionedIds = data.mentionedJidList || [];

        /**
         * @typedef {Object} GroupMention
         * @property {string} groupSubject The name  of the group
         * @property {string} groupJid The group ID
         */

        /**
         * Indicates whether there are group mentions in the message body
         * @type {GroupMention[]}
         */
        this.groupMentions = data.groupMentions || [];

        /**
         * Order ID for message type ORDER
         * @type {string}
         */
        this.orderId = data.orderId ? data.orderId : undefined;
        /**
         * Order Token for message type ORDER
         * @type {string}
         */
        this.token = data.token ? data.token : undefined;

        /**
         * Indicates whether the message is a Gif
         * @type {boolean}
         */
        this.isGif = Boolean(data.isGif);

        /**
         * Indicates if the message will disappear after it expires
         * @type {boolean}
         */
        this.isEphemeral = data.isEphemeral;

        /** Title */
        if (data.title) {
            this.title = data.title;
        }

        /** Description */
        if (data.description) {
            this.description = data.description;
        }

        /** Business Owner JID */
        if (data.businessOwnerJid) {
            this.businessOwnerJid = data.businessOwnerJid;
        }

        /** Product ID */
        if (data.productId) {
            this.productId = data.productId;
        }

        /** Last edit time */
        if (data.latestEditSenderTimestampMs) {
            this.latestEditSenderTimestampMs = data.latestEditSenderTimestampMs;
        }

        /** Last edit message author */
        if (data.latestEditMsgKey) {
            this.latestEditMsgKey = data.latestEditMsgKey;
        }

        /**
         * Protocol message key.
         * Can be used to retrieve the ID of an original message that was revoked.
         */
        if (data.protocolMessageKey) {
            this.protocolMessageKey = data.protocolMessageKey;
        }

        /**
         * Links included in the message.
         * @type {Array<{link: string, isSuspicious: boolean}>}
         *
         */
        this.links = data.links;

        /** Buttons */
        if (data.dynamicReplyButtons) {
            this.dynamicReplyButtons = data.dynamicReplyButtons;
        }

        /** Selected Button Id **/
        if (data.selectedButtonId) {
            this.selectedButtonId = data.selectedButtonId;
        }

        /** Selected List row Id **/
        if (
            data.listResponse &&
            data.listResponse.singleSelectReply.selectedRowId
        ) {
            this.selectedRowId =
                data.listResponse.singleSelectReply.selectedRowId;
        }

        if (this.type === MessageTypes.POLL_CREATION) {
            this.pollName = data.pollName;
            this.pollOptions = data.pollOptions;
            this.allowMultipleAnswers = Boolean(
                !data.pollSelectableOptionsCount,
            );
            this.pollInvalidated = data.pollInvalidated;
            this.isSentCagPollCreation = data.isSentCagPollCreation;
            this.messageSecret = data.messageSecret
                ? Object.keys(data.messageSecret).map(
                      (key) => data.messageSecret[key],
                  )
                : [];
        }

        return super._patch(data);
    }

    _getChatId() {
        return this.fromMe ? this.to : this.from;
    }

    /**
     * Reloads this Message object's data in-place with the latest values from WhatsApp Web.
     * Note that the Message must still be in the web app cache for this to work, otherwise will return null.
     * @returns {Promise<Message>}
     */
    async reload() {
        const newData = await this.client.pupPage.evaluate(async (msgId) => {
            const msg =
                window.require('WAWebCollections').Msg.get(msgId) ||
                (
                    await window
                        .require('WAWebCollections')
                        .Msg.getMessagesById([msgId])
                )?.messages?.[0];
            if (!msg) return null;
            return window.WWebJS.getMessageModel(msg);
        }, this.id._serialized);

        if (!newData) return null;

        this._patch(newData);
        return this;
    }

    /**
     * Returns message in a raw format
     * @type {Object}
     */
    get rawData() {
        return this._data;
    }

    /**
     * Sends a message as a reply to this message. If chatId is specified, it will be sent
     * through the specified Chat. If not, it will send the message
     * in the same Chat as the original message was sent.
     *
     * @param {string|MessageMedia} content
     * @param {string} [chatId]
     * @param {MessageSendOptions} [options]
     * @returns {Promise<Message>}
     */
    async reply(content, chatId, options = {}) {
        if (!chatId) {
            chatId = this._getChatId();
        }

        options = {
            ...options,
            quotedMessageId: this.id._serialized,
        };

        return this.client.sendMessage(chatId, content, options);
    }
}

module.exports = Message;

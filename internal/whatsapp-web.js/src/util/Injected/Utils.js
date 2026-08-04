'use strict';

exports.LoadUtils = () => {
    window.WWebJS = {};
    window.WWebJS.injectToFunction = (target, callback) => {
        try {
            let module = window.require(target.module);
            if (!module) return;

            const path = target.function.split('.');
            const funcName = path.pop();

            for (const key of path) {
                if (!module[key]) return;
                module = module[key];
            }

            const originalFunction = module[funcName];
            if (typeof originalFunction !== 'function') return;

            module[funcName] = ((...args) => {
                try {
                    return callback(module, originalFunction, ...args);
                } catch {
                    return originalFunction.apply(module, args);
                }
            }).bind(module);
        } catch {
            return;
        }
    };

    window.WWebJS.injectToFunction(
        { module: 'WAWebBackendJobsCommon', function: 'mediaTypeFromProtobuf' },
        (module, func, ...args) => {
            const [proto] = args;
            return proto.locationMessage ? null : func(...args);
        },
    );

    window.WWebJS.injectToFunction(
        { module: 'WAWebE2EProtoUtils', function: 'typeAttributeFromProtobuf' },
        (module, func, ...args) => {
            const [proto] = args;
            return proto.locationMessage || proto.groupInviteMessage
                ? 'text'
                : func(...args);
        },
    );

    window.WWebJS.sendSeen = async (chatId) => {
        const chat = await window.WWebJS.getChat(chatId, { getAsModel: false });
        if (chat) {
            window.require('WAWebStreamModel').Stream.markAvailable();
            await window.require('WAWebUpdateUnreadChatAction').sendSeen({
                chat: chat,
                threadId: undefined,
            });
            window.require('WAWebStreamModel').Stream.markUnavailable();
            return true;
        }
        return false;
    };

    window.WWebJS.sendMessage = async (chat, content, options = {}) => {
        const { getIsNewsletter, getIsBroadcast } =
            window.require('WAWebChatGetters');
        const isChannel = getIsNewsletter(chat);
        const isStatus = getIsBroadcast(chat);

        const { findLink } = window.require('WALinkify');

        let mediaOptions = {};
        if (options.media) {
            mediaOptions = await window.WWebJS.processMediaData(
                options.media,
                {
                    forceSticker: false,
                    forceGif: false,
                    forceVoice: false,
                    forceDocument: false,
                    forceMediaHd: false,
                    sendToChannel: isChannel,
                    sendToStatus: isStatus,
                },
            );
            mediaOptions.caption = options.caption;
            content = mediaOptions.preview;
            mediaOptions.isViewOnce = options.isViewOnce;
            delete options.media;
        }

        let quotedMsgOptions = {};
        if (options.quotedMessageId) {
            let quotedMessage = window
                .require('WAWebCollections')
                .Msg.get(options.quotedMessageId);
            !quotedMessage &&
                (quotedMessage = (
                    await window
                        .require('WAWebCollections')
                        .Msg.getMessagesById([options.quotedMessageId])
                )?.messages?.[0]);
            if (quotedMessage) {
                const ReplyUtils = window.require('WAWebMsgReply');
                const canReply = ReplyUtils
                    ? ReplyUtils.canReplyMsg(quotedMessage.unsafe())
                    : quotedMessage.canReply();

                if (canReply) {
                    quotedMsgOptions = quotedMessage.msgContextInfo(chat);
                }
            } else {
                if (!options.ignoreQuoteErrors) {
                    throw new Error('Could not get the quoted message.');
                }
            }

            delete options.ignoreQuoteErrors;
            delete options.quotedMessageId;
        }

        if (options.mentionedJidList) {
            options.mentionedJidList = options.mentionedJidList.map((id) =>
                window.require('WAWebWidFactory').createWid(id),
            );
            options.mentionedJidList = options.mentionedJidList.filter(Boolean);
        }

        if (options.groupMentions) {
            options.groupMentions = options.groupMentions.map((e) => ({
                groupSubject: e.subject,
                groupJid: window.require('WAWebWidFactory').createWid(e.id),
            }));
        }

        let locationOptions = {};
        if (options.location) {
            let { latitude, longitude, description, url } = options.location;
            url = findLink(url)?.href;
            url && !description && (description = url);
            locationOptions = {
                type: 'location',
                loc: description,
                lat: latitude,
                lng: longitude,
                clientUrl: url,
            };
            delete options.location;
        }

        let pollOptions = {};
        if (options.poll) {
            const { pollName, pollOptions: _pollOptions } = options.poll;
            const { allowMultipleAnswers, messageSecret } =
                options.poll.options;
            pollOptions = {
                kind: 'pollCreation',
                type: 'poll_creation',
                pollName: pollName,
                pollOptions: _pollOptions,
                pollSelectableOptionsCount: allowMultipleAnswers ? 0 : 1,
                messageSecret:
                    Array.isArray(messageSecret) && messageSecret.length === 32
                        ? new Uint8Array(messageSecret)
                        : window.crypto.getRandomValues(new Uint8Array(32)),
            };
            delete options.poll;
        }

        let eventOptions = {};
        if (options.event) {
            const { name, startTimeTs, eventSendOptions } = options.event;
            const { messageSecret } = eventSendOptions;
            eventOptions = {
                type: 'event_creation',
                eventName: name,
                eventDescription: eventSendOptions.description,
                eventStartTime: startTimeTs,
                eventEndTime: eventSendOptions.endTimeTs,
                eventLocation: eventSendOptions.location && {
                    degreesLatitude: 0,
                    degreesLongitude: 0,
                    name: eventSendOptions.location,
                },
                eventJoinLink:
                    eventSendOptions.callType === 'none'
                        ? null
                        : await window
                              .require('WAWebGenerateEventCallLink')
                              .createEventCallLink(
                                  startTimeTs,
                                  eventSendOptions.callType,
                              ),
                isEventCanceled: eventSendOptions.isEventCanceled,
                messageSecret:
                    Array.isArray(messageSecret) && messageSecret.length === 32
                        ? new Uint8Array(messageSecret)
                        : window.crypto.getRandomValues(new Uint8Array(32)),
            };
            delete options.event;
        }

        let vcardOptions = {};
        if (options.contactCard) {
            let contact = await window
                .require('WAWebCollections')
                .Contact.find(options.contactCard);
            vcardOptions = {
                body: window
                    .require('WAWebFrontendVcardUtils')
                    .vcardFromContactModel(contact).vcard,
                type: 'vcard',
                vcardFormattedName: contact.formattedName,
            };
            delete options.contactCard;
        } else if (options.contactCardList) {
            let contacts = await Promise.all(
                options.contactCardList.map((c) =>
                    window.require('WAWebCollections').Contact.find(c),
                ),
            );
            let vcards = contacts.map((c) =>
                window
                    .require('WAWebFrontendVcardUtils')
                    .vcardFromContactModel(c),
            );
            vcardOptions = {
                type: 'multi_vcard',
                vcardList: vcards,
                body: null,
            };
            delete options.contactCardList;
        } else if (
            options.parseVCards &&
            typeof content === 'string' &&
            content.startsWith('BEGIN:VCARD')
        ) {
            delete options.parseVCards;
            delete options.linkPreview;
            try {
                const parsed = window
                    .require('WAWebVcardParsingUtils')
                    .parseVcard(content);
                if (parsed) {
                    vcardOptions = {
                        type: 'vcard',
                        vcardFormattedName: window
                            .require('WAWebVcardGetNameFromParsed')
                            .vcardGetNameFromParsed(parsed),
                    };
                }
            } catch (ignoredError) {
                // not a vcard
            }
        }

        if (options.linkPreview) {
            delete options.linkPreview;
            const link = findLink(content);
            if (link) {
                let preview = await window
                    .require('WAWebLinkPreviewChatAction')
                    .getLinkPreview(link);
                if (preview && preview.data) {
                    preview = preview.data;
                    preview.preview = true;
                    preview.subtype = 'url';
                    options = { ...options, ...preview };
                }
            }
        }

        let buttonOptions = {};
        if (options.buttons) {
            let caption;
            if (options.buttons.type === 'chat') {
                content = options.buttons.body;
                caption = content;
            } else {
                caption = options.caption ? options.caption : ' '; // Caption can't be empty
            }
            buttonOptions = {
                productHeaderImageRejected: false,
                isFromTemplate: false,
                isDynamicReplyButtonsMsg: true,
                title: options.buttons.title
                    ? options.buttons.title
                    : undefined,
                footer: options.buttons.footer
                    ? options.buttons.footer
                    : undefined,
                dynamicReplyButtons: options.buttons.buttons,
                replyButtons: options.buttons.buttons,
                caption: caption,
            };
            delete options.buttons;
        }

        let listOptions = {};
        if (options.list) {
            if (
                window.require('WAWebConnModel').Conn.platform === 'smba' ||
                window.require('WAWebConnModel').Conn.platform === 'smbi'
            ) {
                throw "[LT01] Whatsapp business can't send this yet";
            }
            listOptions = {
                type: 'list',
                footer: options.list.footer,
                list: {
                    ...options.list,
                    listType: 1,
                },
                body: options.list.description,
            };
            delete options.list;
            delete listOptions.list.footer;
        }

        const botOptions = {};
        if (options.invokedBotWid) {
            botOptions.messageSecret = window.crypto.getRandomValues(
                new Uint8Array(32),
            );
            botOptions.botMessageSecret = await window
                .require('WAWebBotMessageSecret')
                .genBotMsgSecretFromMsgSecret(botOptions.messageSecret);
            botOptions.invokedBotWid = window
                .require('WAWebWidFactory')
                .createWid(options.invokedBotWid);
            botOptions.botPersonaId = window
                .require('WAWebBotProfileCollection')
                .BotProfileCollection.get(options.invokedBotWid).personaId;
            delete options.invokedBotWid;
        }
        const { getMaybeMeLidUser, getMaybeMePnUser } = window.require(
            'WAWebUserPrefsMeUser',
        );
        const lidUser = getMaybeMeLidUser();
        const meUser = getMaybeMePnUser();
        const newId = await window.require('WAWebMsgKey').newId();
        let from = chat.id.isLid() ? lidUser : meUser;
        let participant;

        if (typeof chat.id?.isGroup === 'function' && chat.id.isGroup()) {
            from =
                chat.groupMetadata && chat.groupMetadata.isLidAddressingMode
                    ? lidUser
                    : meUser;
            participant = window
                .require('WAWebWidFactory')
                .asUserWidOrThrow(from);
        }

        if (typeof chat.id?.isStatus === 'function' && chat.id.isStatus()) {
            participant = window
                .require('WAWebWidFactory')
                .asUserWidOrThrow(from);
        }

        const newMsgKey = new (window.require('WAWebMsgKey'))({
            from: from,
            to: chat.id,
            id: newId,
            participant: participant,
            selfDir: 'out',
        });

        const extraOptions = options.extraOptions || {};
        delete options.extraOptions;

        const ephemeralFields = window
            .require('WAWebGetEphemeralFieldsMsgActionsUtils')
            .getEphemeralFields(chat);

        const message = {
            ...options,
            id: newMsgKey,
            ack: 0,
            body: content,
            from: from,
            to: chat.id,
            local: true,
            self: 'out',
            t: parseInt(new Date().getTime() / 1000),
            isNewMsg: true,
            type: 'chat',
            ...ephemeralFields,
            ...mediaOptions,
            ...(mediaOptions.toJSON ? mediaOptions.toJSON() : {}),
            ...quotedMsgOptions,
            ...locationOptions,
            ...pollOptions,
            ...eventOptions,
            ...vcardOptions,
            ...buttonOptions,
            ...listOptions,
            ...botOptions,
            ...extraOptions,
        };

        // Bot's won't reply if canonicalUrl is set (linking)
        if (botOptions) {
            delete message.canonicalUrl;
        }

        if (isChannel) {
            const msg = new (window.require('WAWebCollections').Msg.modelClass)(
                message,
            );
            const msgDataFromMsgModel = window
                .require('WAWebMsgDataFromModel')
                .msgDataFromMsgModel(msg);
            const isMedia = Object.keys(mediaOptions).length > 0;
            await window
                .require('WAWebNewsletterUpdateMsgsRecordsJob')
                .addNewsletterMsgsRecords([msgDataFromMsgModel]);
            chat.msgs.add(msg);
            chat.t = msg.t;

            const sendChannelMsgResponse = await window
                .require('WAWebNewsletterSendMessageJob')
                .sendNewsletterMessageJob({
                    msg: msg,
                    type:
                        message.type === 'chat'
                            ? 'text'
                            : isMedia
                              ? 'media'
                              : 'pollCreation',
                    newsletterJid: chat.id.toJid(),
                    ...(isMedia
                        ? {
                              mediaMetadata: msg.avParams(),
                              mediaHandle: isMedia
                                  ? mediaOptions.mediaHandle
                                  : null,
                          }
                        : {}),
                });

            if (sendChannelMsgResponse.success) {
                msg.t = sendChannelMsgResponse.ack.t;
                msg.serverId = sendChannelMsgResponse.serverId;
            }
            msg.updateAck(1, true);
            await window
                .require('WAWebNewsletterUpdateMsgsRecordsJob')
                .updateNewsletterMsgRecord(msg);
            return msg;
        }

        if (isStatus) {
            const { backgroundColor, fontStyle } = extraOptions;
            const isMedia = Object.keys(mediaOptions).length > 0;
            const mediaUpdate = (data) =>
                window.require('WAWebMediaUpdateMsg')(data, mediaOptions);
            const msg = new (window.require('WAWebCollections').Msg.modelClass)(
                {
                    ...message,
                    author: participant ? participant : null,
                    messageSecret: window.crypto.getRandomValues(
                        new Uint8Array(32),
                    ),
                    cannotBeRanked: window
                        .require('WAWebStatusGatingUtils')
                        .canCheckStatusRankingPosterGating(),
                },
            );

            // for text only
            const statusOptions = {
                color:
                    (backgroundColor &&
                        window.WWebJS.assertColor(backgroundColor)) ||
                    0xff7acca5,
                font: (fontStyle >= 0 && fontStyle <= 7 && fontStyle) || 0,
                text: msg.body,
            };

            await window
                .require('WAWebSendStatusMsgAction')
                [
                    isMedia
                        ? 'sendStatusMediaMsgAction'
                        : 'sendStatusTextMsgAction'
                ](...(isMedia ? [msg, mediaUpdate] : [statusOptions]));

            return msg;
        }

        const [msgPromise, sendMsgResultPromise] = window
            .require('WAWebSendMsgChatAction')
            .addAndSendMsgToChat(chat, message);
        const msg = await msgPromise;

        if (options.waitUntilMsgSent) await sendMsgResultPromise;

        // The msgPromise resolves to the sent message model directly.
        // Fall back to Msg.get(newMsgKey._serialized) only if the promise
        // didn't return a model (older WhatsApp Web versions).
        if (msg) return msg;

        // In newer WhatsApp Web versions, newMsgKey._serialized is undefined.
        // Use toString() which produces the correct serialized key.
        const serializedKey = newMsgKey._serialized || newMsgKey.toString();
        return window.require('WAWebCollections').Msg.get(serializedKey);
    };

    window.WWebJS.processMediaData = async (
        mediaInfo,
        {
            forceSticker,
            forceGif,
            forceVoice,
            forceDocument,
            forceMediaHd,
            sendToChannel,
            sendToStatus,
        },
    ) => {
        const file = window.WWebJS.mediaInfoToFile(mediaInfo);
        const OpaqueData = window.require('WAWebMediaOpaqueData');
        const opaqueData = await OpaqueData.createFromData(
            file,
            mediaInfo.mimetype,
        );
        const mediaParams = {
            asSticker: forceSticker,
            asGif: forceGif,
            isPtt: forceVoice,
            asDocument: forceDocument,
        };

        if (forceMediaHd && file.type.indexOf('image/') === 0) {
            mediaParams.maxDimension = 2560;
        }

        const mediaPrep = window
            .require('WAWebPrepRawMedia')
            .prepRawMedia(opaqueData, mediaParams);
        const mediaData = await mediaPrep.waitForPrep();
        const mediaObject = window
            .require('WAWebMediaStorage')
            .getOrCreateMediaObject(mediaData.filehash);
        const mediaType = window.require('WAWebMmsMediaTypes').msgToMediaType({
            type: mediaData.type,
            isGif: mediaData.isGif,
            isNewsletter: sendToChannel,
        });

        if (!mediaData.filehash) {
            throw new Error('media-fault: sendToChat filehash undefined');
        }

        if (!(mediaData.mediaBlob instanceof OpaqueData)) {
            mediaData.mediaBlob = await OpaqueData.createFromData(
                mediaData.mediaBlob,
                mediaData.mediaBlob.type,
            );
        }

        mediaData.renderableUrl = mediaData.mediaBlob.url();
        mediaObject.consolidate(mediaData.toJSON());

        mediaData.mediaBlob.autorelease();
        const shouldUseMediaCache = window
            .require('WAWebMediaDataUtils')
            .shouldUseMediaCache(
                window.require('WAWebMmsMediaTypes').castToV4(mediaObject.type),
            );
        if (shouldUseMediaCache && mediaData.mediaBlob instanceof OpaqueData) {
            const formData = mediaData.mediaBlob.formData();
            window
                .require('WAWebMediaInMemoryBlobCache')
                .InMemoryMediaBlobCache.put(mediaObject.filehash, formData);
        }

        const dataToUpload = {
            mimetype: mediaData.mimetype,
            mediaObject,
            mediaType,
            ...(sendToChannel
                ? {
                      calculateToken: window.require('WAMediaCalculateFilehash')
                          .getRandomFilehash,
                  }
                : {}),
        };

        const { uploadMedia, uploadUnencryptedMedia } = window.require(
            'WAWebMediaMmsV4Upload',
        );
        const uploadedMedia = !sendToChannel
            ? await uploadMedia(dataToUpload)
            : await uploadUnencryptedMedia(dataToUpload);

        const mediaEntry = uploadedMedia.mediaEntry;
        if (!mediaEntry) {
            throw new Error('upload failed: media entry was not created');
        }

        mediaData.set({
            clientUrl: mediaEntry.mmsUrl,
            deprecatedMms3Url: mediaEntry.deprecatedMms3Url,
            directPath: mediaEntry.directPath,
            mediaKey: mediaEntry.mediaKey,
            mediaKeyTimestamp: mediaEntry.mediaKeyTimestamp,
            filehash: mediaObject.filehash,
            encFilehash: mediaEntry.encFilehash,
            uploadhash: mediaEntry.uploadHash,
            size: mediaObject.size,
            streamingSidecar: mediaEntry.sidecar,
            firstFrameSidecar: mediaEntry.firstFrameSidecar,
            mediaHandle: sendToChannel ? mediaEntry.handle : null,
        });

        return mediaData;
    };

    window.WWebJS.getMessageModel = (message) => {
        const msg = message.serialize();

        const { findLinks } = window.require('WALinkify');

        msg.isEphemeral = message.isEphemeral;
        msg.isStatusV3 = message.isStatusV3;
        msg.links = findLinks(
            message.mediaObject ? message.caption : message.body,
        ).map((link) => ({
            link: link.href,
            isSuspicious: Boolean(
                link.suspiciousCharacters && link.suspiciousCharacters.size,
            ),
        }));

        if (msg.buttons) {
            msg.buttons = msg.buttons.serialize();
        }
        if (msg.dynamicReplyButtons) {
            msg.dynamicReplyButtons = JSON.parse(
                JSON.stringify(msg.dynamicReplyButtons),
            );
        }
        if (msg.replyButtons) {
            msg.replyButtons = JSON.parse(JSON.stringify(msg.replyButtons));
        }

        if (typeof msg.id.remote === 'object') {
            msg.id = Object.assign({}, msg.id, {
                remote: msg.id.remote._serialized,
            });
        }

        delete msg.pendingAckUpdate;

        return msg;
    };

    window.WWebJS.getChat = async (chatId, { getAsModel = true } = {}) => {
        const isChannel = /@\w*newsletter\b/.test(chatId);
        const chatWid = window.require('WAWebWidFactory').createWid(chatId);
        let chat;

        if (isChannel) {
            try {
                chat = window
                    .require('WAWebCollections')
                    .WAWebNewsletterCollection.get(chatId);
                if (!chat) {
                    await window
                        .require('WAWebLoadNewsletterPreviewChatAction')
                        .loadNewsletterPreviewChat(chatId);
                    chat = await window
                        .require('WAWebCollections')
                        .WAWebNewsletterCollection.find(chatWid);
                }
            } catch (ignoredError) {
                chat = null;
            }
        } else {
            chat =
                window.require('WAWebCollections').Chat.get(chatWid) ||
                (
                    await window
                        .require('WAWebFindChatAction')
                        .findOrCreateLatestChat(chatWid)
                )?.chat;
        }

        return getAsModel && chat
            ? await window.WWebJS.getChatModel(chat, { isChannel: isChannel })
            : chat;
    };

    window.WWebJS.mediaInfoToFile = ({ data, mimetype, filename }) => {
        const binaryData = window.atob(data);

        const buffer = new ArrayBuffer(binaryData.length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < binaryData.length; i++) {
            view[i] = binaryData.charCodeAt(i);
        }

        const blob = new Blob([buffer], { type: mimetype });
        return new File([blob], filename, {
            type: mimetype,
            lastModified: Date.now(),
        });
    };

    /**
     * Resolves the media blob and metadata for a message.
     * Shared by downloadMedia and downloadMediaStream.
     * @param {string} msgId
     * @returns {Promise<{blob: Blob, mimetype: string, filename: string, filesize: number}|null>}
     */
    window.WWebJS.arrayBufferToBase64 = (arrayBuffer) => {
        let binary = '';
        const bytes = new Uint8Array(arrayBuffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    };

    window.WWebJS.arrayBufferToBase64Async = (arrayBuffer) =>
        new Promise((resolve, reject) => {
            const blob = new Blob([arrayBuffer], {
                type: 'application/octet-stream',
            });
            const fileReader = new FileReader();
            fileReader.onload = () => {
                const [, data] = fileReader.result.split(',');
                resolve(data);
            };
            fileReader.onerror = (e) => reject(e);
            fileReader.readAsDataURL(blob);
        });

    window.WWebJS.getFileHash = async (data) => {
        let buffer = await data.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)));
    };

};

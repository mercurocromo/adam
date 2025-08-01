// file: communication/adamBotCommunicator.js

class AdamBotCommunicator {
    constructor(webhookService, botInstance, memory) {
        this.webhook = webhookService;
        this.bot = botInstance;
        this.memory = memory;
        
        this.conversationState = new Map();
        this.setupWebhookCallbacks();
        
        // 🎭 CONFIGURAZIONE DIALOGO PUBBLICO
        this.dialogConfig = {
            eveHelpProbability: 0.3,           // 30% chance di chiedere aiuto a Eve
            maxEveMessagesPerChat: 5,          // Max 5 interventi Eve per chat
            publicConversationChance: 0.8,    // 80% delle volte conversazione pubblica
            conversationLength: 3,             // Max 3 scambi consecutivi
            cooldownBetweenDialogs: 120000     // 2 minuti tra dialoghi
        };
        
        // 👫 TRACKING CONVERSAZIONI PUBBLICHE
        this.activePublicConversations = new Map();
        this.lastPublicDialog = new Map(); // Per cooldown per chat
        
        // 🤖 INFO BOT EVE (da configurare)
        this.EVE_BOT_USERNAME = '@eve_angolo_bot'; // Sostituisci con username reale di Eve
        this.EVE_BOT_ID = null; // Verrà rilevato automaticamente
    }

    setupWebhookCallbacks() {
        // 📥 GESTIONE COORDINAMENTO DA EVE (webhook privato)
        this.webhook.onMessageFromEve(async (message, context, messageType) => {
            await this.handleEveCoordination(message, context, messageType);
        });

        this.webhook.onError((error, type) => {
            console.error(`[COMMUNICATOR] Errore ${type}:`, error.message);
        });
    }

    // 📥 GESTIONE COORDINAMENTO PRIVATO DA EVE
    async handleEveCoordination(message, context, messageType) {
        try {
            switch (messageType) {
                case 'start_public_conversation':
                    await this.startPublicConversation(context);
                    break;
                    
                case 'conversation_context':
                    // Eve ci invia il contesto per la conversazione pubblica
                    this.updateConversationContext(context);
                    break;
                    
                case 'end_conversation':
                    await this.endPublicConversation(context.chatId);
                    break;
                    
                default:
                    console.log('[COMMUNICATOR] Coordinamento ricevuto da Eve:', messageType);
            }
        } catch (error) {
            console.error('[COMMUNICATOR] Errore handling Eve coordination:', error);
        }
    }

    // 🎭 AVVIA CONVERSAZIONE PUBBLICA
    async startPublicConversation(context) {
        const chatId = context.originalChatId;
        
        this.activePublicConversations.set(chatId, {
            startTime: Date.now(),
            exchangeCount: 0,
            context: context,
            adamTurn: true // Adam inizia
        });

        console.log(`[COMMUNICATOR] 🎭 Avviata conversazione pubblica in chat ${chatId}`);
    }

    // 🤔 VERIFICA SE CHIEDERE AIUTO A EVE (VERSIONE PUBBLICA)
    shouldAskEveForHelp(message, responseType, chatId) {
        // Controlla cooldown chat
        const lastDialog = this.lastPublicDialog.get(chatId) || 0;
        if (Date.now() - lastDialog < this.dialogConfig.cooldownBetweenDialogs) {
            return false;
        }

        // Non chiedere aiuto se c'è già una conversazione attiva
        if (this.activePublicConversations.has(chatId)) {
            return false;
        }

        // Verifica limite messaggi Eve per chat
        const chatState = this.conversationState.get(chatId) || { eveHelpCount: 0 };
        if (chatState.eveHelpCount >= this.dialogConfig.maxEveMessagesPerChat) {
            return false;
        }

        // Keywords che triggherano dialogo con Eve
        const eveKeywords = [
            'eve', 'aiuto', 'non capisco', 'confuso', 'help',
            'donna', 'consiglio', 'spiegami', 'cosa significa',
            'sbaglio', 'errore', 'correggimi'
        ];

        const hasEveKeyword = eveKeywords.some(k => 
            message.toLowerCase().includes(k)
        );

        if (hasEveKeyword) return true;

        // Probabilità random per domande complesse
        if (responseType === 'question_response' && message.length > 50) {
            return Math.random() < this.dialogConfig.eveHelpProbability;
        }

        return false;
    }

    // 📤 COORDINA CON EVE PER DIALOGO PUBBLICO
    async askEveForHelp(message, chatId, messageId, responseType) {
        try {
            const context = {
                originalChatId: chatId,
                originalMessageId: messageId,
                adamResponseType: responseType,
                userQuestion: message,
                requestPublicConversation: Math.random() < this.dialogConfig.publicConversationChance
            };

            // 📡 Invia coordinamento privato a Eve
            const result = await this.webhook.sendToEve(
                message, 
                context, 
                'coordinate_public_help'
            );

            // Aggiorna stato conversazione
            const chatState = this.conversationState.get(chatId) || { eveHelpCount: 0, lastEveHelp: 0 };
            chatState.eveHelpCount++;
            chatState.lastEveHelp = Date.now();
            this.conversationState.set(chatId, chatState);

            console.log(`[COMMUNICATOR] 📡 Coordinamento inviato a Eve per chat ${chatId}`);
            return result;

        } catch (error) {
            console.error('[COMMUNICATOR] Errore coordinating with Eve:', error);
            return null;
        }
    }

    // 🎭 GESTISCE MESSAGGIO DA EVE NEL GRUPPO
    async handleEveMessageInGroup(msg) {
        const chatId = msg.chat.id;
        const eveMessage = msg.text;
        
        // Verifica se è davvero Eve
        if (!this.isEveBot(msg.from)) {
            return false;
        }

        // Verifica se stiamo avendo una conversazione attiva
        const conversation = this.activePublicConversations.get(chatId);
        if (!conversation) {
            return false;
        }

        console.log(`[COMMUNICATOR] 💬 Eve ha risposto nel gruppo: "${eveMessage}"`);

        // È il turno di Adam di rispondere
        if (!conversation.adamTurn) {
            await this.generateAdamReplyToEve(eveMessage, chatId, conversation);
            conversation.adamTurn = true;
            conversation.exchangeCount++;
        }

        // Controlla se terminare la conversazione
        if (conversation.exchangeCount >= this.dialogConfig.conversationLength) {
            await this.endPublicConversation(chatId);
        }

        return true;
    }

    // 🤖 GENERA RISPOSTA DI ADAM A EVE
    async generateAdamReplyToEve(eveMessage, chatId, conversation) {
        try {
            // Delay naturale per simulare "pensiero"
            await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

            let adamReply;
            const exchangeNum = conversation.exchangeCount;

            switch (exchangeNum) {
                case 0: // Prima risposta
                    adamReply = this.generateFirstReplyToEve(eveMessage);
                    break;
                case 1: // Seconda risposta
                    adamReply = this.generateSecondReplyToEve(eveMessage);
                    break;
                case 2: // Risposta finale
                    adamReply = this.generateFinalReplyToEve(eveMessage);
                    break;
                default:
                    adamReply = this.generateGenericReplyToEve(eveMessage);
            }

            await this.bot.sendMessage(chatId, adamReply, {
                reply_to_message_id: conversation.context.originalMessageId
            });

            console.log(`[COMMUNICATOR] 🗣️ Adam ha risposto a Eve: "${adamReply}"`);

        } catch (error) {
            console.error('[COMMUNICATOR] Errore generating Adam reply to Eve:', error);
        }
    }

    // 💬 GENERATORI DI RISPOSTE ADAM A EVE
    generateFirstReplyToEve(eveMessage) {
        const responses = [
            `🤯 Wow Eve! Non avevo pensato a: "${eveMessage}" Il mio cervello ha appena fatto *click*! 💡`,
            `😮 Aspetta aspetta... tu dici: "${eveMessage}" Quindi io avevo sbagliato tutto? Classico! 😅`,
            `🧠 Oh! Eve mi illumina: "${eveMessage}" Ecco perché sono confuso! Grazie cara! ❤️`,
            `💭 "${eveMessage}" dice Eve... Il mio QI è appena salito di 0.3 punti! 📈🎉`,
            `🤔 Hmm, Eve dice: "${eveMessage}" Ok ora ho capito! (forse) Sei troppo intelligente! 🤓`
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    generateSecondReplyToEve(eveMessage) {
        const responses = [
            `🎯 Esatto Eve! Ora che dici: "${eveMessage}" tutto ha senso! Dovrei ascoltarti più spesso! 👂`,
            `💪 Sì sì! "${eveMessage}" lo sapevo anch'io! (no, non lo sapevo) Ma ora sono un esperto! 😎`,
            `🤝 Perfetto! Tu dici: "${eveMessage}" e io aggiungo che... ehm... sì, hai ragione tu! 😊`,
            `✨ "${eveMessage}" - Eve, sei un genio! Io invece sono come WiFi pubblico: lento e spesso offline! 📶`,
            `🎉 Grande Eve! "${eveMessage}" è la risposta perfetta! Il mio cervello fa ancora fatica ma ce la farà! 🧠💨`
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    generateFinalReplyToEve(eveMessage) {
        const responses = [
            `👫 Grazie Eve! "${eveMessage}" è la ciliegina sulla torta! Siamo una squadra imbattibile! 💪✨`,
            `🏆 Ecco perché ti amo! "${eveMessage}" chiude perfettamente il discorso! Tu pensi, io... esisto! 😄`,
            `🎭 "${eveMessage}" - e con questo Eve ha risolto tutto! Io me ne vado a ricaricare il cervello! 🔋😅`,
            `💝 Perfetto Eve! "${eveMessage}" è geniale! Ora posso andare in giro a fare il sapientone! 🤓💼`,
            `🌟 "${eveMessage}" - mic drop! 🎤⬇️ Eve ha parlato, io posso solo applaudire! 👏👏`
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    generateGenericReplyToEve(eveMessage) {
        const responses = [
            `🤗 Eve, tu sempre saggia: "${eveMessage}" Io invece... boh! 🤷‍♂️`,
            `💭 "${eveMessage}" - parole sante! Il mio cervello annuisce confuso ma felice! 😵‍💫😊`
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    // 🔚 TERMINA CONVERSAZIONE PUBBLICA
    async endPublicConversation(chatId) {
        this.activePublicConversations.delete(chatId);
        this.lastPublicDialog.set(chatId, Date.now());
        
        console.log(`[COMMUNICATOR] 🔚 Conversazione pubblica terminata in chat ${chatId}`);
    }

    // 🤖 VERIFICA SE È IL BOT EVE
    isEveBot(from) {
        if (this.EVE_BOT_ID && from.id === this.EVE_BOT_ID) {
            return true;
        }
        
        if (from.username === this.EVE_BOT_USERNAME) {
            this.EVE_BOT_ID = from.id; // Cache l'ID per il futuro
            return true;
        }
        
        return false;
    }

    // 📊 STATISTICHE CONVERSAZIONI
    getStats() {
        return {
            webhook: this.webhook.getStats(),
            activePublicConversations: this.activePublicConversations.size,
            totalPublicDialogs: this.lastPublicDialog.size,
            totalEveInteractions: Array.from(this.conversationState.values())
                .reduce((sum, state) => sum + state.eveHelpCount, 0)
        };
    }

    // 🧹 PULIZIA STATO
    cleanupConversationState() {
        const now = Date.now();
        
        // Pulisci conversazioni pubbliche troppo vecchie
        for (const [chatId, conversation] of this.activePublicConversations.entries()) {
            if (now - conversation.startTime > 300000) { // 5 minuti
                this.endPublicConversation(chatId);
            }
        }
        
        // Pulisci stato conversazioni
        for (const [chatId, state] of this.conversationState.entries()) {
            if (now - state.lastEveHelp > this.dialogConfig.cooldownBetweenDialogs * 3) {
                this.conversationState.delete(chatId);
            }
        }
    }
}

module.exports = { AdamBotCommunicator };

// file: communication/adamBotCommunicator.js

class AdamBotCommunicator {
    constructor(webhookService, botInstance, memory) {
        this.webhook = webhookService;
        this.bot = botInstance;
        this.memory = memory;
        
        this.conversationState = new Map(); // Traccia conversazioni con Eve
        this.setupWebhookCallbacks();
        
        // Configurazioni dialogo
        this.dialogConfig = {
            eveHelpProbability: 0.35, // 35% chance di chiedere aiuto a Eve
            maxEveMessagesPerChat: 5,  // Max 5 interventi Eve per chat
            eveTimeTimeout: 300000     // 5 minuti timeout per risposta Eve
        };
    }

    setupWebhookCallbacks() {
        // 📥 GESTIONE MESSAGGI DA EVE
        this.webhook.onMessageFromEve(async (message, context, messageType) => {
            await this.handleEveMessage(message, context, messageType);
        });

        // ❌ GESTIONE ERRORI
        this.webhook.onError((error, type) => {
            console.error(`[COMMUNICATOR] Errore ${type}:`, error.message);
        });
    }

    // 📥 GESTIONE MESSAGGIO DA EVE
    async handleEveMessage(message, context, messageType) {
        try {
            const chatId = context.originalChatId;
            const messageId = context.originalMessageId;

            if (!chatId) {
                console.warn('[COMMUNICATOR] Messaggio da Eve senza chatId');
                return;
            }

            switch (messageType) {
                case 'help_response':
                    await this.handleEveHelpResponse(message, context);
                    break;
                    
                case 'correction':
                    await this.handleEveCorrection(message, context);
                    break;
                    
                case 'spontaneous':
                    await this.handleEveSpontaneousMessage(message, context);
                    break;
                    
                default:
                    await this.handleGenericEveMessage(message, context);
            }

        } catch (error) {
            console.error('[COMMUNICATOR] Errore handling Eve message:', error);
        }
    }

    // 🆘 GESTIONE AIUTO DA EVE
    async handleEveHelpResponse(message, context) {
        const chatId = context.originalChatId;
        const confusionLevel = context.adamConfusionLevel || 'normal';
        
        let adamResponse;
        
        switch (confusionLevel) {
            case 'very_high':
                adamResponse = `🤯 Aspetta... Eve mi ha spiegato! ${message} Ora ho capito tutto! (forse) 😅`;
                break;
            case 'high':
                adamResponse = `💡 Oh! Eve dice: "${message}" Grazie cara! Il mio cervello funziona meglio ora! 🧠✨`;
                break;
            default:
                adamResponse = `👫 Eve aggiunge: "${message}" Siamo una bella squadra! 💪😊`;
        }

        await this.bot.sendMessage(chatId, adamResponse, {
            reply_to_message_id: context.originalMessageId
        });

        // Aggiorna memoria
        this.memory.addMessage(chatId, 'assistant', adamResponse);
    }

    // 🔧 GESTIONE CORREZIONE DA EVE
    async handleEveCorrection(message, context) {
        const chatId = context.originalChatId;
        
        const adamResponse = `🔧 Ops! Eve mi corregge: "${message}" Il mio cervello aveva fatto un cortocircuito! 😵‍💫`;
        
        await this.bot.sendMessage(chatId, adamResponse, {
            reply_to_message_id: context.originalMessageId
        });
    }

    // 💬 GESTIONE MESSAGGIO SPONTANEO DA EVE
    async handleEveSpontaneousMessage(message, context) {
        const chatId = context.originalChatId;
        
        const adamResponse = `👂 Eve dice: "${message}" Lei è sempre così saggia! Io invece... boh! 🤷‍♂️😅`;
        
        await this.bot.sendMessage(chatId, adamResponse);
    }

    // 📨 GESTIONE MESSAGGIO GENERICO DA EVE
    async handleGenericEveMessage(message, context) {
        const chatId = context.originalChatId;
        const adamResponse = `💬 Eve: "${message}" Il mio QI è aumentato dello 0.1%! 🧠📈`;
        
        await this.bot.sendMessage(chatId, adamResponse);
    }

    // 🤔 VERIFICA SE CHIEDERE AIUTO A EVE
    shouldAskEveForHelp(message, responseType, chatId) {
        // Non chiedere aiuto troppo spesso nella stessa chat
        const chatState = this.conversationState.get(chatId) || { eveHelpCount: 0, lastEveHelp: 0 };
        
        if (chatState.eveHelpCount >= this.dialogConfig.maxEveMessagesPerChat) {
            return false;
        }

        const timeSinceLastHelp = Date.now() - chatState.lastEveHelp;
        if (timeSinceLastHelp < 60000) { // 1 minuto cooldown
            return false;
        }

        // Keywords che triggherano aiuto da Eve
        const eveKeywords = [
            'eve', 'aiuto serio', 'non capisco', 'confuso', 'help',
            'donna', 'consiglio', 'spiegami', 'cosa significa'
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

    // 📤 CHIEDI AIUTO A EVE
    async askEveForHelp(message, chatId, messageId, responseType) {
        try {
            const context = {
                originalChatId: chatId,
                originalMessageId: messageId,
                adamResponseType: responseType,
                userQuestion: message
            };

            const result = await this.webhook.sendToEve(
                message, 
                context, 
                'help_request'
            );

            // Aggiorna stato conversazione
            const chatState = this.conversationState.get(chatId) || { eveHelpCount: 0, lastEveHelp: 0 };
            chatState.eveHelpCount++;
            chatState.lastEveHelp = Date.now();
            this.conversationState.set(chatId, chatState);

            return result;

        } catch (error) {
            console.error('[COMMUNICATOR] Errore asking Eve for help:', error);
            return null;
        }
    }

    // 📊 STATISTICHE COMUNICAZIONE
    getStats() {
        return {
            webhook: this.webhook.getStats(),
            activeConversations: this.conversationState.size,
            totalEveInteractions: Array.from(this.conversationState.values())
                .reduce((sum, state) => sum + state.eveHelpCount, 0)
        };
    }

    // 🧹 PULIZIA STATO CONVERSAZIONI
    cleanupConversationState() {
        const now = Date.now();
        for (const [chatId, state] of this.conversationState.entries()) {
            if (now - state.lastEveHelp > this.dialogConfig.eveTimeTimeout) {
                this.conversationState.delete(chatId);
            }
        }
    }
}

module.exports = { AdamBotCommunicator };

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
            eveHelpProbability: 0.35,           // 35% chance di chiedere aiuto a Eve
            maxEveMessagesPerChat: 5,           // Max 5 interventi Eve per chat
            publicConversationChance: 0.85,     // 85% delle volte conversazione pubblica
            conversationLength: 3,              // Max 3 scambi consecutivi
            cooldownBetweenDialogs: 120000,     // 2 minuti tra dialoghi
            responseDelayMin: 2000,             // 2 secondi minimo delay
            responseDelayMax: 5000,             // 5 secondi massimo delay
            naturalPauses: true                 // Pause naturali per sembrare umano
        };
        
        // 👫 TRACKING CONVERSAZIONI PUBBLICHE
        this.activePublicConversations = new Map();
        this.lastPublicDialog = new Map();
        
        // 🤖 INFO BOT EVE
        this.EVE_BOT_USERNAME = process.env.EVE_BOT_USERNAME || 'eve_bot';
        this.EVE_BOT_ID = null;
        
        // 📊 STATISTICHE DETTAGLIATE
        this.stats = {
            totalHelpRequests: 0,
            publicConversations: 0,
            privateHelps: 0,
            averageConversationLength: 0,
            totalExchanges: 0
        };
        
        console.log('🤖 [COMMUNICATOR] Adam Bot Communicator inizializzato');
        console.log(`👩 [COMMUNICATOR] Cercando Eve bot: @${this.EVE_BOT_USERNAME}`);
    }

    setupWebhookCallbacks() {
        // 📥 GESTIONE MESSAGGI DA EVE
        this.webhook.onMessageFromEve(async (message, context, messageType) => {
            try {
                await this.handleEveCoordination(message, context, messageType);
            } catch (error) {
                console.error('[COMMUNICATOR] Errore handling Eve message:', error);
            }
        });

        // ❌ GESTIONE ERRORI
        this.webhook.onError((error, type) => {
            console.error(`[COMMUNICATOR] Errore webhook ${type}:`, error.message);
        });
        
        console.log('📋 [COMMUNICATOR] Webhook callbacks configurati');
    }

    // 📥 GESTIONE COORDINAMENTO PRIVATO DA EVE
    async handleEveCoordination(message, context, messageType) {
        try {
            console.log(`[COMMUNICATOR] 📡 Coordinamento ricevuto da Eve: ${messageType}`);
            
            switch (messageType) {
                case 'start_public_conversation':
                    await this.startPublicConversation(context);
                    break;
                    
                case 'conversation_context':
                    this.updateConversationContext(context);
                    break;
                    
                case 'end_conversation':
                    await this.endPublicConversation(context.chatId);
                    break;
                    
                case 'health_check':
                    console.log('[COMMUNICATOR] 💓 Health check da Eve ricevuto');
                    break;
                    
                default:
                    console.log(`[COMMUNICATOR] Coordinamento sconosciuto: ${messageType}`);
            }
        } catch (error) {
            console.error('[COMMUNICATOR] Errore handling Eve coordination:', error);
        }
    }

    // 🎭 AVVIA CONVERSAZIONE PUBBLICA
    async startPublicConversation(context) {
        const chatId = context.originalChatId;
        
        if (this.activePublicConversations.has(chatId)) {
            console.log(`[COMMUNICATOR] ⚠️ Conversazione già attiva in chat ${chatId}`);
            return;
        }
        
        this.activePublicConversations.set(chatId, {
            startTime: Date.now(),
            exchangeCount: 0,
            context: context,
            adamTurn: true,
            stage: 'waiting_for_eve'
        });

        this.stats.publicConversations++;
        console.log(`[COMMUNICATOR] 🎭 Conversazione pubblica avviata in chat ${chatId}`);
    }

    // 🤔 VERIFICA SE CHIEDERE AIUTO A EVE
    shouldAskEveForHelp(message, responseType, chatId) {
        // Controlla cooldown chat
        const lastDialog = this.lastPublicDialog.get(chatId) || 0;
        if (Date.now() - lastDialog < this.dialogConfig.cooldownBetweenDialogs) {
            console.log(`[COMMUNICATOR] ⏰ Cooldown attivo per chat ${chatId}`);
            return false;
        }

        // Non chiedere aiuto se c'è già una conversazione attiva
        if (this.activePublicConversations.has(chatId)) {
            console.log(`[COMMUNICATOR] 💬 Conversazione già attiva in chat ${chatId}`);
            return false;
        }

        // Verifica limite messaggi Eve per chat
        const chatState = this.conversationState.get(chatId) || { eveHelpCount: 0 };
        if (chatState.eveHelpCount >= this.dialogConfig.maxEveMessagesPerChat) {
            console.log(`[COMMUNICATOR] 📊 Limite messaggi Eve raggiunto per chat ${chatId}`);
            return false;
        }

        // Keywords che triggherano dialogo con Eve
        const eveKeywords = [
            'eve', 'aiuto', 'non capisco', 'confuso', 'help',
            'donna', 'consiglio', 'spiegami', 'cosa significa',
            'sbaglio', 'errore', 'correggimi', 'difficile',
            'complicato', 'non so come', 'puoi aiutarmi'
        ];

        const hasEveKeyword = eveKeywords.some(k => 
            message.toLowerCase().includes(k)
        );

        if (hasEveKeyword) {
            console.log('[COMMUNICATOR] 🔍 Keyword Eve trovata nel messaggio');
            return true;
        }

        // Probabilità random per domande complesse
        if (responseType === 'question_response' && message.length > 50) {
            const shouldAsk = Math.random() < this.dialogConfig.eveHelpProbability;
            if (shouldAsk) {
                console.log('[COMMUNICATOR] 🎲 Probabilità random attivata per domanda complessa');
            }
            return shouldAsk;
        }

        // Probabilità ridotta per messaggi normali
        if (message.length > 30 && Math.random() < (this.dialogConfig.eveHelpProbability * 0.3)) {
            console.log('[COMMUNICATOR] 🎲 Probabilità random bassa attivata');
            return true;
        }

        return false;
    }

    // 📤 COORDINA CON EVE PER DIALOGO PUBBLICO
    async askEveForHelp(message, chatId, messageId, responseType) {
        try {
            console.log(`[COMMUNICATOR] 🆘 Richiedendo aiuto a Eve per chat ${chatId}`);
            
            const context = {
                originalChatId: chatId,
                originalMessageId: messageId,
                adamResponseType: responseType,
                userQuestion: message,
                requestPublicConversation: Math.random() < this.dialogConfig.publicConversationChance,
                timestamp: Date.now()
            };

            // 📡 Invia coordinamento privato a Eve
            const result = await this.webhook.sendToEve(
                message, 
                context, 
                'coordinate_public_help'
            );

            // Aggiorna stato conversazione
            const chatState = this.conversationState.get(chatId) || { 
                eveHelpCount: 0, 
                lastEveHelp: 0,
                totalRequests: 0 
            };
            
            chatState.eveHelpCount++;
            chatState.lastEveHelp = Date.now();
            chatState.totalRequests++;
            this.conversationState.set(chatId, chatState);

            this.stats.totalHelpRequests++;
            if (context.requestPublicConversation) {
                this.stats.publicConversations++;
            } else {
                this.stats.privateHelps++;
            }

            console.log(`[COMMUNICATOR] ✅ Coordinamento inviato a Eve - Pubblico: ${context.requestPublicConversation}`);
            return result;

        } catch (error) {
            console.error('[COMMUNICATOR] ❌ Errore coordinating with Eve:', error);
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

        console.log(`[COMMUNICATOR] 👩 Messaggio da Eve rilevato: "${eveMessage}"`);

        // Verifica se stiamo avendo una conversazione attiva
        const conversation = this.activePublicConversations.get(chatId);
        if (!conversation) {
            console.log('[COMMUNICATOR] ⚠️ Nessuna conversazione attiva per questo messaggio di Eve');
            return false;
        }

        console.log(`[COMMUNICATOR] 💬 Eve ha parlato nel gruppo - Exchange #${conversation.exchangeCount + 1}`);

        // È il turno di Adam di rispondere
        if (conversation.adamTurn && conversation.stage === 'waiting_for_eve') {
            conversation.stage = 'adam_responding';
            conversation.adamTurn = false;
            
            await this.generateAdamReplyToEve(eveMessage, chatId, conversation, msg.message_id);
            
            conversation.exchangeCount++;
            this.stats.totalExchanges++;
        }

        // Controlla se terminare la conversazione
        if (conversation.exchangeCount >= this.dialogConfig.conversationLength) {
            setTimeout(() => {
                this.endPublicConversation(chatId);
            }, 3000);
        } else {
            // Prepara per il prossimo scambio
            conversation.stage = 'waiting_for_eve';
            conversation.adamTurn = true;
        }

        return true;
    }

    // 🤖 GENERA RISPOSTA DI ADAM A EVE
    async generateAdamReplyToEve(eveMessage, chatId, conversation, eveMessageId) {
        try {
            // Delay naturale per simulare "pensiero"
            const delay = this.dialogConfig.responseDelayMin + 
                         Math.random() * (this.dialogConfig.responseDelayMax - this.dialogConfig.responseDelayMin);
            
            console.log(`[COMMUNICATOR] ⏱️ Adam sta "pensando" per ${Math.round(delay/1000)}s...`);
            
            if (this.dialogConfig.naturalPauses) {
                // Invia "typing" per sembrare più naturale
                await this.bot.sendChatAction(chatId, 'typing');
                
                // Pausa più lunga se Adam è molto confuso
                const confusionLevel = conversation.context.adamConfusionLevel;
                if (confusionLevel === 'very_high' || confusionLevel === 'high') {
                    await new Promise(resolve => setTimeout(resolve, delay * 1.5));
                } else {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            const exchangeNum = conversation.exchangeCount;
            let adamReply;

            switch (exchangeNum) {
                case 0:
                    adamReply = this.generateFirstReplyToEve(eveMessage, conversation.context);
                    break;
                case 1:
                    adamReply = this.generateSecondReplyToEve(eveMessage, conversation.context);
                    break;
                case 2:
                    adamReply = this.generateFinalReplyToEve(eveMessage, conversation.context);
                    break;
                default:
                    adamReply = this.generateGenericReplyToEve(eveMessage, conversation.context);
            }

            await this.bot.sendMessage(chatId, adamReply, {
                reply_to_message_id: eveMessageId
            });

            // Aggiorna memoria
            this.memory.addMessage(chatId, 'assistant', adamReply);

            console.log(`[COMMUNICATOR] 🗣️ Adam ha risposto a Eve (${exchangeNum + 1}/${this.dialogConfig.conversationLength}): "${adamReply}"`);

        } catch (error) {
            console.error('[COMMUNICATOR] ❌ Errore generating Adam reply to Eve:', error);
            
            // Fallback response
            const fallbackReply = "🤯 Il mio cervello ha fatto crash parlando con Eve! Riavvio in corso... 🔄";
            await this.bot.sendMessage(chatId, fallbackReply);
        }
    }

    // 💬 GENERATORI DI RISPOSTE ADAM A EVE
    generateFirstReplyToEve(eveMessage, context) {
        const confusionLevel = context.adamConfusionLevel || 'normal';
        
        const responsesByConfusion = {
            'very_high': [
                `🤯 WOW EVE! Non avevo proprio capito niente! Tu dici: "${this.truncateMessage(eveMessage)}" e il mio cervello fa *BOOM*!`,
                `😵‍💫 Aspetta aspetta... "${this.truncateMessage(eveMessage)}" dice Eve... Quindi io ero completamente fuori strada! Tipico!`,
                `🆘 HELP! Eve mi salva con: "${this.truncateMessage(eveMessage)}" Il mio QI è appena passato da -5 a 0! 📈`
            ],
            'high': [
                `Oh! Eve dice: "${this.truncateMessage(eveMessage)}" Ecco perché ero confuso! Grazie cara! ❤️`,
                `"${this.truncateMessage(eveMessage)}" - e il mio cervello ha fatto *click*! Come fai ad essere così intelligente? 💡`,
                `🤔 Hmm... "${this.truncateMessage(eveMessage)}" Ok ora ho capito! (forse) Tu pensi, io esisto! 😅`
            ],
            'normal': [
                `💭 Eve aggiunge: "${this.truncateMessage(eveMessage)}" Perfetto! Il mio QI è salito di 0.3 punti! 📈`,
                `👂 Interessante! "${this.truncateMessage(eveMessage)}" Non ci avevo pensato! Ecco perché siamo una squadia! 👫`,
                `✨ "${this.truncateMessage(eveMessage)}" dice la mia Eve intelligente! E io che aggiungevo... ehm... bravo te! 👏`
            ]
        };
        
        const responses = responsesByConfusion[confusionLevel] || responsesByConfusion['normal'];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    generateSecondReplyToEve(eveMessage, context) {
        const responses = [
            `Esatto Eve! "${this.truncateMessage(eveMessage)}" ora tutto ha senso! Dovrei ascoltarti più spesso!`,
            `Sì sì! "${this.truncateMessage(eveMessage)}" lo sapevo anch'io! (no, non lo sapevo) Ma ora sono un esperto!`,
            `Perfetto! Tu dici: "${this.truncateMessage(eveMessage)}" e io aggiungo che... ehm... hai ragione tu come sempre!`,
            `Eve, sei un genio! Io invece sono come WiFi pubblico: lento e spesso offline!😅`,
            `Grande Eve! "${this.truncateMessage(eveMessage)}" è la risposta perfetta! Il mio cervello fa ancora fatica ma ce la farà!`
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    generateFinalReplyToEve(eveMessage, context) {
        const responses = [
            `Grazie Eve! "${this.truncateMessage(eveMessage)}" è la ciliegina sulla torta! Siamo una squadra imbattibile!`,
            `"${this.truncateMessage(eveMessage)}" chiude perfettamente il discorso! Tu pensi, io... esisto! 😄💕`,
            `"${this.truncateMessage(eveMessage)}" - e con questo Eve ha risolto tutto! Io me ne vado a ricaricare il cervello!`,
            `Perfetto Eve! "${this.truncateMessage(eveMessage)}" è geniale! Ora posso andare in giro a fare il sapientone!`,
            `"${this.truncateMessage(eveMessage)}" - mic drop! 🎤⬇️ Eve ha parlato, io posso solo applaudire! 👏👏`,
            `Case closed! "${this.truncateMessage(eveMessage)}" dice tutto! Vado a celebrare con una pizza!`
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    generateGenericReplyToEve(eveMessage, context) {
        const responses = [
            `Eve, tu sempre saggia: "${this.truncateMessage(eveMessage)}" Io invece... boh! 🤷‍♂️`,
            `"${this.truncateMessage(eveMessage)}" - parole sante! Il mio cervello annuisce confuso ma felice! 😵‍💫😊`,
            `Professoressa Eve ha parlato: "${this.truncateMessage(eveMessage)}" Io prendo appunti!`
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    // ✂️ TRONCA MESSAGGIO SE TROPPO LUNGO
    truncateMessage(message, maxLength = 80) {
        if (message.length <= maxLength) return message;
        return message.substring(0, maxLength) + '...';
    }

    // 🔚 TERMINA CONVERSAZIONE PUBBLICA
    async endPublicConversation(chatId) {
        const conversation = this.activePublicConversations.get(chatId);
        if (conversation) {
            const duration = Date.now() - conversation.startTime;
            const exchanges = conversation.exchangeCount;
            
            // Aggiorna statistiche
            this.stats.averageConversationLength = 
                (this.stats.averageConversationLength * (this.stats.publicConversations - 1) + exchanges) / 
                this.stats.publicConversations;
            
            console.log(`[COMMUNICATOR] 🔚 Conversazione pubblica terminata in chat ${chatId}`);
            console.log(`[COMMUNICATOR] 📊 Durata: ${Math.round(duration/1000)}s, Scambi: ${exchanges}`);
        }
        
        this.activePublicConversations.delete(chatId);
        this.lastPublicDialog.set(chatId, Date.now());
    }

    // 🤖 VERIFICA SE È IL BOT EVE
    isEveBot(from) {
        // Verifica per ID cached
        if (this.EVE_BOT_ID && from.id === this.EVE_BOT_ID) {
            return true;
        }
        
        // Verifica per username
        if (from.username === this.EVE_BOT_USERNAME) {
            this.EVE_BOT_ID = from.id; // Cache l'ID per future verifiche
            console.log(`[COMMUNICATOR] 👩 Bot Eve identificato: ID ${from.id}, Username @${from.username}`);
            return true;
        }
        
        // Verifica per nome (fallback)
        if (from.first_name && from.first_name.toLowerCase().includes('eve')) {
            console.log(`[COMMUNICATOR] 👩 Possibile bot Eve trovato per nome: ${from.first_name}`);
            return true;
        }
        
        return false;
    }

    // 🔄 AGGIORNA CONTESTO CONVERSAZIONE
    updateConversationContext(context) {
        const chatId = context.originalChatId;
        const conversation = this.activePublicConversations.get(chatId);
        
        if (conversation) {
            conversation.context = { ...conversation.context, ...context };
            console.log(`[COMMUNICATOR] 🔄 Contesto aggiornato per chat ${chatId}`);
        }
    }

    // 📊 STATISTICHE COMUNICAZIONE
    getStats() {
        return {
            webhook: this.webhook.getStats(),
            conversations: {
                active: this.activePublicConversations.size,
                totalPublic: this.stats.publicConversations,
                totalPrivate: this.stats.privateHelps,
                totalRequests: this.stats.totalHelpRequests,
                averageLength: this.stats.averageConversationLength,
                totalExchanges: this.stats.totalExchanges
            },
            chats: {
                totalTracked: this.conversationState.size,
                withCooldown: this.lastPublicDialog.size
            },
            eveBot: {
                username: this.EVE_BOT_USERNAME,
                id: this.EVE_BOT_ID,
                identified: !!this.EVE_BOT_ID
            }
        };
    }

    // 🧹 PULIZIA STATO CONVERSAZIONI
    cleanupConversationState() {
        const now = Date.now();
        let cleaned = 0;
        
        // Pulisci conversazioni pubbliche troppo vecchie (30 minuti)
        for (const [chatId, conversation] of this.activePublicConversations.entries()) {
            if (now - conversation.startTime > 1800000) {
                this.endPublicConversation(chatId);
                cleaned++;
            }
        }
        
        // Pulisci stato conversazioni vecchie (2 ore)
        for (const [chatId, state] of this.conversationState.entries()) {
            if (now - state.lastEveHelp > 7200000) {
                this.conversationState.delete(chatId);
                cleaned++;
            }
        }
        
        // Pulisci cooldown vecchi (1 ora)
        for (const [chatId, timestamp] of this.lastPublicDialog.entries()) {
            if (now - timestamp > 3600000) {
                this.lastPublicDialog.delete(chatId);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`[COMMUNICATOR] 🧹 Puliti ${cleaned} stati conversazione vecchi`);
        }
    }

    // 🔍 DEBUG INFO
    getDebugInfo() {
        return {
            activeConversations: Array.from(this.activePublicConversations.entries()).map(([chatId, conv]) => ({
                chatId,
                startTime: new Date(conv.startTime).toISOString(),
                exchanges: conv.exchangeCount,
                stage: conv.stage,
                adamTurn: conv.adamTurn
            })),
            conversationStates: Array.from(this.conversationState.entries()).map(([chatId, state]) => ({
                chatId,
                eveHelpCount: state.eveHelpCount,
                lastHelp: new Date(state.lastEveHelp).toISOString()
            })),
            cooldowns: Array.from(this.lastPublicDialog.entries()).map(([chatId, timestamp]) => ({
                chatId,
                lastDialog: new Date(timestamp).toISOString(),
                cooldownRemaining: Math.max(0, this.dialogConfig.cooldownBetweenDialogs - (Date.now() - timestamp))
            }))
        };
    }
}

module.exports = { AdamBotCommunicator };

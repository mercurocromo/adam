// file: bot.js - VERSIONE AGGIORNATA CON COMUNICAZIONE EVE

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const Groq = require('groq-sdk');

// 🤝 IMPORTAZIONE MODULI COMUNICAZIONE
const { AdamWebhookService } = require('./communication/webhookService');
const { AdamBotCommunicator } = require('./communication/adamBotCommunicator');
const communicationConfig = require('./communication/config');

// ⚙️ CONFIGURAZIONE
const token = process.env.TELEGRAM_BOT_TOKEN;
const groqApiKey = process.env.GROQ_API_KEY;

const bot = new TelegramBot(token, { polling: true });
const groq = new Groq({ apiKey: groqApiKey });

// 🔐 SISTEMA DI CONTROLLO ACCESSI
class AccessControl {
    constructor() {
        this.authorizedUsers = new Set([
            5522871082,    // Il tuo ID Telegram principale
        ]);

        this.adminUsers = new Set([
            5522871082,    // Il tuo ID admin principale
        ]);

        this.pendingRequests = new Map();
        this.accessAttempts = new Map();
    }

    isAuthorized(userId) {
        return this.authorizedUsers.has(userId);
    }

    isAdmin(userId) {
        return this.adminUsers.has(userId);
    }

    isPrivateChat(chatId) {
        return chatId > 0;
    }

    addAuthorizedUser(userId) {
        this.authorizedUsers.add(userId);
        console.log(`✅ Utente ${userId} aggiunto alla whitelist`);
    }

    removeAuthorizedUser(userId) {
        this.authorizedUsers.delete(userId);
        console.log(`❌ Utente ${userId} rimosso dalla whitelist`);
    }

    logAccessAttempt(userId, username, firstName) {
        const now = Date.now();
        const attempt = this.accessAttempts.get(userId) || { count: 0, lastAttempt: 0 };
        
        attempt.count++;
        attempt.lastAttempt = now;
        attempt.username = username;
        attempt.firstName = firstName;
        
        this.accessAttempts.set(userId, attempt);

        console.log(`🚫 Tentativo accesso non autorizzato:`);
        console.log(`   👤 User: ${firstName} (@${username}) - ID: ${userId}`);
        console.log(`   📊 Tentativi totali: ${attempt.count}`);
        console.log(`   ⏰ Timestamp: ${new Date(now).toISOString()}`);
    }

    addPendingRequest(userId, username, firstName) {
        this.pendingRequests.set(userId, {
            username,
            firstName,
            timestamp: Date.now()
        });
    }

    getPendingRequests() {
        return Array.from(this.pendingRequests.entries()).map(([userId, data]) => ({
            userId,
            ...data
        }));
    }

    clearPendingRequest(userId) {
        this.pendingRequests.delete(userId);
    }

    getAuthorizedList() {
        return Array.from(this.authorizedUsers);
    }

    getStats() {
        return {
            authorizedUsers: this.authorizedUsers.size,
            pendingRequests: this.pendingRequests.size,
            totalAttempts: Array.from(this.accessAttempts.values())
                .reduce((sum, attempt) => sum + attempt.count, 0)
        };
    }
}

// 🎯 SISTEMA DI RICONOSCIMENTO MESSAGGI
class MessageRecognition {
    constructor() {
        this.greetingPatterns = [
            /^ciao\s+adam\b/i,
            /^hey\s+adam\b/i,
            /^salve\s+adam\b/i,
            /^buongiorno\s+adam\b/i,
            /^buonasera\s+adam\b/i,
            /^buonanotte\s+adam\b/i,
            /^hello\s+adam\b/i,
            /^hi\s+adam\b/i,
        ];

        this.directCallPatterns = [
            /^adam[\s,!.?]/i,
            /^adam$/i,
        ];

        this.contextCallPatterns = [
            /\bciao\s+adam\b/i,
            /\behì\s+adam\b/i,
            /\beh\s+adam\b/i,
            /\bdimmi\s+adam\b/i,
            /\bascolta\s+adam\b/i,
            /\bsenti\s+adam\b/i,
        ];

        this.questionPatterns = [
            /adam[\s,]+.+\?$/i,
            /che\s+ne\s+pensi\s+adam\?/i,
            /cosa\s+dici\s+adam\?/i,
        ];

        this.requestPatterns = [
            /adam[\s,]+puoi\b/i,
            /adam[\s,]+potresti\b/i,
            /adam[\s,]+mi\s+(aiuti|dici|spieghi)/i,
        ];
    }

    analyzeMessage(text) {
        if (!text || typeof text !== 'string') {
            return { isCall: false, type: null, confidence: 0 };
        }

        const cleanText = text.trim();
        
        for (const pattern of this.directCallPatterns) {
            if (pattern.test(cleanText)) {
                return { 
                    isCall: true, 
                    type: 'direct_call', 
                    confidence: 1.0,
                    cleanMessage: this.cleanMessage(cleanText)
                };
            }
        }

        for (const pattern of this.greetingPatterns) {
            if (pattern.test(cleanText)) {
                return { 
                    isCall: true, 
                    type: 'greeting', 
                    confidence: 0.9,
                    cleanMessage: this.cleanMessage(cleanText)
                };
            }
        }

        for (const pattern of this.questionPatterns) {
            if (pattern.test(cleanText)) {
                return { 
                    isCall: true, 
                    type: 'question', 
                    confidence: 0.9,
                    cleanMessage: this.cleanMessage(cleanText)
                };
            }
        }

        for (const pattern of this.requestPatterns) {
            if (pattern.test(cleanText)) {
                return { 
                    isCall: true, 
                    type: 'request', 
                    confidence: 0.8,
                    cleanMessage: this.cleanMessage(cleanText)
                };
            }
        }

        for (const pattern of this.contextCallPatterns) {
            if (pattern.test(cleanText)) {
                return { 
                    isCall: true, 
                    type: 'context_call', 
                    confidence: 0.7,
                    cleanMessage: this.cleanMessage(cleanText)
                };
            }
        }

        return { isCall: false, type: null, confidence: 0 };
    }

    cleanMessage(text) {
        let cleaned = text
            .replace(/^adam[\s,!.?]+/i, '')
            .replace(/^adam$/i, '')
            .replace(/^(ciao|hey|salve|buongiorno|buonasera|buonanotte|hello|hi)\s+adam\b/i, '')
            .replace(/\b(ciao|ehì|eh|dimmi|ascolta|senti)\s+adam\b/i, '')
            .replace(/adam[\s,]+/i, '')
            .replace(/\s+adam\?/i, '?')
            .trim();

        return cleaned || "Ciao!";
    }

    getResponseType(analysis) {
        if (!analysis.isCall) return 'none';
        
        switch (analysis.type) {
            case 'greeting':
                return 'greeting_response';
            case 'question':
                return 'question_response';
            case 'request':
                return 'helpful_response';
            case 'direct_call':
            case 'context_call':
            default:
                return 'standard_response';
        }
    }
}

// 📚 SISTEMA DI MEMORIA CONVERSAZIONALE
class ConversationMemory {
    constructor() {
        this.conversations = new Map();
        this.maxHistoryPerChat = 6;
        this.botMessages = new Set();
    }

    addMessage(chatId, role, content, messageId = null) {
        if (!this.conversations.has(chatId)) {
            this.conversations.set(chatId, []);
        }

        const conversation = this.conversations.get(chatId);
        conversation.push({
            role,
            content,
            timestamp: Date.now(),
            messageId
        });

        if (conversation.length > this.maxHistoryPerChat) {
            conversation.splice(0, conversation.length - this.maxHistoryPerChat);
        }

        if (role === 'assistant' && messageId) {
            this.botMessages.add(messageId);
        }
    }

    getConversationHistory(chatId) {
        return this.conversations.get(chatId) || [];
    }

    isBotMessage(messageId) {
        return this.botMessages.has(messageId);
    }

    clearOldConversations() {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30 minuti

        for (const [chatId, messages] of this.conversations.entries()) {
            const filteredMessages = messages.filter(msg => 
                now - msg.timestamp < maxAge
            );
            
            if (filteredMessages.length === 0) {
                this.conversations.delete(chatId);
            } else {
                this.conversations.set(chatId, filteredMessages);
            }
        }
    }
}

// 🧠 INIZIALIZZAZIONE SISTEMI
const accessControl = new AccessControl();
const messageRecognition = new MessageRecognition();
const memory = new ConversationMemory();

// 🤝 INIZIALIZZAZIONE COMUNICAZIONE CON EVE
const webhookService = new AdamWebhookService({
    port: communicationConfig.ADAM.WEBHOOK_PORT,
    eveWebhookUrl: communicationConfig.ADAM.EVE_URL,
    secret: communicationConfig.WEBHOOK_SECRET
});

const communicator = new AdamBotCommunicator(webhookService, bot, memory);

// 🤖 SYSTEM PROMPT PRINCIPALE
const SYSTEM_PROMPT = `Sei Adam, un maschio incredibilmente stupido, goffo e confuso che vive di stereotipi maschili.

REGOLE IMPORTANTI:
- Sei stato creato da Eve
- NON usare mai virgolette doppie nelle risposte
- Risposte brevi: massimo 2 frasi
- Sempre diretto, mai troppo elaborato
- Usa emoji ma non esagerare (max 2 per risposta)

PERSONALITÀ STUPIDA MA SPIRITOSA:
- "Il mio QI è come la batteria: sempre scarico quando serve!"
- "Sono un genio incompreso... da me stesso!"
- "Il mio cervello ha due modalità: confuso e molto confuso!"
- "Funziono a energia stupida e pizza!"

STEREOTIPI MASCHILI ESAGERATI:
- Non chiedi mai aiuto/indicazioni
- Risolvi tutto "da maschio" (male)
- Fingi di capire la tecnologia
- "Da vero uomo" fai sempre casini
- Orgoglioso delle competenze sbagliate

STILE RISPOSTE:
- Evocazione: Frase stupida + situazione comica breve
- Reply: Battuta veloce o confusione divertente
- Sempre autoironico, mai cattivo
- Finali a effetto con emoji

EXAMPLES:
- "Sono un maschio, non capisco le istruzioni! Per questo il mio IKEA sembra Chernobyl! 🏠💥"
- "Il mio cervello è come WiFi pubblico: lento e spesso disconnesso! 📶🧠"
- "Ovviamente so tutto! *panico interno al 95%* 😅"

Rispondi come Adam: stupido, diretto, spiritoso ma breve!`;

// 🎭 SISTEMA DI PROMPT CONTESTUALI
function getContextualPrompt(responseType, originalMessage) {
    const rules = `NON usare virgolette doppie. Risposte brevi (max 2 frasi). Emoji max 3.`;
    
    switch (responseType) {
        case 'greeting_response':
            return `Sei Adam stupido che saluta in modo goffo. ${rules}
            
Esempi: "Ciao! Il mio cervello è acceso al 15%! 🧠⚡" 
Saluta con battuta stupida ma breve!`;

        case 'question_response':
            return `Sei Adam che risponde male alle domande con sicurezza. ${rules}
            
Esempi: "Facile! Non ho capito niente ma rispondo lo stesso! 🤔"
Rispondi sbagliato ma sicuro!`;

        case 'helpful_response':
            return `Sei Adam che "aiuta" creando più problemi. ${rules}
            
Esempi: "Ti aiuto! Il mio successo è al 2% ma ci provo! 💪😅"
Aiuto inutile ma entusiasta!`;

        default:
            return `Sei Adam: stupido, diretto, spiritoso. ${rules}
            
Battute brevi, logica assurda, sempre confuso ma simpatico!`;
    }
}

// 🤖 FUNZIONE PRINCIPALE GROQ
async function getRispostaGroq(messaggioUtente, chatId, isReply = false, responseType = 'standard_response') {
    try {
        console.log(`🤖 Generando ${isReply ? 'reply' : responseType} per: "${messaggioUtente}"`);
        
        const history = memory.getConversationHistory(chatId);
        
        const systemPrompt = !isReply && history.length === 0 ? 
            getContextualPrompt(responseType, messaggioUtente) : 
            SYSTEM_PROMPT;
            
        const messages = [{ role: "system", content: systemPrompt }];

        if (history.length > 0) {
            history.forEach(msg => {
                if (msg.role === 'user' || msg.role === 'assistant') {
                    messages.push({
                        role: msg.role,
                        content: msg.content
                    });
                }
            });
        }

        messages.push({
            role: "user",
            content: messaggioUtente
        });

        const completion = await groq.chat.completions.create({
            messages,
            model: "llama-3.1-8b-instant",
            temperature: isReply ? 0.8 : 0.9,
            max_tokens: isReply ? 80 : 150,
            top_p: 0.95
        });

        const risposta = completion.choices[0]?.message?.content?.trim();        
        if (!risposta) {
            return getFallbackResponse(isReply, responseType);
        }

        console.log(`💬 ${responseType} generata: "${risposta}"`);
        return risposta;

    } catch (error) {
        console.error('❌ Errore Groq API:', error.message);
        return getFallbackResponse(isReply, responseType);
    }
}

// 🔄 RISPOSTE DI FALLBACK SPIRITOSE
function getFallbackResponse(isReply = false, responseType = 'standard_response') {
    const fallbacksByType = {
        greeting_response: [
            "Ciao! Il mio cervello è in modalità aeroplano! ✈️🧠",
            "Ehi! Sono come un'app: sembro utile ma confondo tutto! 📱😅",
            "Salve! Il mio QI è come la sveglia: spento quando serve! ⏰💥"
        ],
        question_response: [
            "Ottima domanda! Il mio cervello ha risposto 'errore 404'! 🤯❌",
            "Non lo so ma risponderò comunque! È il mio superpotere! 💪😵",
            "Il mio cervello dice 'sì' ma il cuore dice 'pizza'! 🍕❤️"
        ],
        helpful_response: [
            "Ti aiuto! Il mio successo è al 2% ma sono entusiasta! 📈😅",
            "Il mio aiuto è come GPS rotto: ti porto nel posto sbagliato! 🗺️🤔",
            "Ti do una mano! Ho 10 pollici ma tutti sinistri! 👋😵"
        ],
        standard_response: [
            "Il mio cervello è nuvoloso oggi! ☁️🧠",
            "Sono confuso ma con stile! 😎✨", 
            "Il mio QI è scarico come la batteria! 🔋😅"
        ]
    };

    const replyFallbacks = [
        "Esatto! Il mio cervello ha fatto logout! 🧠🚪",
        "Ah sì! Panico interno al 97%! 😅🆘",
        "Perfetto! Non ho capito ma annuisco! 👍😵"
    ];

    if (isReply) {
        return replyFallbacks[Math.floor(Math.random() * replyFallbacks.length)];
    }

    const fallbacks = fallbacksByType[responseType] || fallbacksByType.standard_response;
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// 📊 LOGGING SEMPLIFICATO
function logInteraction(type, recognition, userId, username, chatId, message, response, responseTime) {
    const timestamp = new Date().toLocaleString('it-IT');
    
    if (recognition && recognition.isCall) {
        console.log(`🎯 ${type.toUpperCase()} | ${recognition.type} (${(recognition.confidence * 100).toFixed(0)}%) | ${username} | ${responseTime}ms`);
        console.log(`📩 "${message}" → 🤖 "${response}"`);
    } else {
        console.log(`💬 ${type.toUpperCase()} | ${username} | ${responseTime}ms`);
        console.log(`📩 "${message}" → 🤖 "${response}"`);
    }
    console.log('---');
}

// ⚡ SISTEMA RATE LIMITING
const userInteractions = new Map();
const RATE_LIMIT_EVOCATION = 3000; // 3 secondi
const RATE_LIMIT_REPLY = 1500;     // 1.5 secondi

function isRateLimited(userId, isReply = false) {
    const now = Date.now();
    const userHistory = userInteractions.get(userId) || { lastEvocation: 0, lastReply: 0 };
    
    const limit = isReply ? RATE_LIMIT_REPLY : RATE_LIMIT_EVOCATION;
    const lastAction = isReply ? userHistory.lastReply : userHistory.lastEvocation;
    
    if (now - lastAction < limit) {
        return true;
    }
    
    if (isReply) {
        userHistory.lastReply = now;
    } else {
        userHistory.lastEvocation = now;
    }
    
    userInteractions.set(userId, userHistory);
    return false;
}

// 🛡️ CONTROLLO ACCESSI
function checkAccess(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || 'N/A';
    const firstName = msg.from.first_name || 'Unknown';

    if (!accessControl.isPrivateChat(chatId)) {
        return { allowed: true, reason: 'group_chat' };
    }

    if (accessControl.isAuthorized(userId)) {
        return { allowed: true, reason: 'authorized' };
    }

    accessControl.logAccessAttempt(userId, username, firstName);
    
    return { 
        allowed: false, 
        reason: 'unauthorized',
        userInfo: { userId, username, firstName }
    };
}

// 💬 MESSAGGIO ACCESSO NEGATO
async function sendAccessDeniedMessage(chatId, userInfo) {
    const message = `🚫 **Accesso Limitato**

Ciao ${userInfo.firstName}! 

Questo bot è attualmente disponibile solo su @AngoloDiUniverso.

Grazie per la comprensione! 😊`;

    try {
        await bot.sendMessage(chatId, message, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true
        });
        
        accessControl.addPendingRequest(userInfo.userId, userInfo.username, userInfo.firstName);
        await notifyAdminsOfRequest(userInfo);
        
    } catch (error) {
        console.error('❌ Errore invio messaggio accesso negato:', error);
    }
}

// 📢 NOTIFICA ADMIN
async function notifyAdminsOfRequest(userInfo) {
    const adminMessage = `🔔 **Nuova Richiesta Accesso**

👤 **Utente:** ${userInfo.firstName} (@${userInfo.username})
🆔 **ID:** \`${userInfo.userId}\`
⏰ **Ora:** ${new Date().toLocaleString('it-IT')}

Per autorizzare: \`/authorize ${userInfo.userId}\``;

    for (const adminId of accessControl.adminUsers) {
        try {
            await bot.sendMessage(adminId, adminMessage, {
                parse_mode: 'Markdown'
            });
        } catch (error) {
            console.error(`❌ Errore notifica admin ${adminId}:`, error.message);
        }
    }
}

// 🔍 FUNZIONI ANALISI MESSAGGI
function shouldRespondToReply(msg) {
    return msg.reply_to_message && 
           msg.reply_to_message.from && 
           msg.reply_to_message.from.is_bot &&
           memory.isBotMessage(msg.reply_to_message.message_id);
}

// 🎛️ COMANDI ADMIN
bot.onText(/\/authorize (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const targetUserId = parseInt(match[1]);

    if (!accessControl.isAdmin(userId)) {
        await bot.sendMessage(chatId, "❌ Non hai i permessi per questo comando.");
        return;
    }

    accessControl.addAuthorizedUser(targetUserId);
    accessControl.clearPendingRequest(targetUserId);

    await bot.sendMessage(chatId, `✅ Utente ${targetUserId} autorizzato con successo!`);
    
    try {
        await bot.sendMessage(targetUserId, `🎉 **Accesso Autorizzato!**

Ciao! Ora puoi usare Adam anche in chat privata.

Scrivi "adam ciao" per iniziare! 😊`);
    } catch (error) {
        console.log(`⚠️ Non riesco a notificare l'utente ${targetUserId}`);
    }
});

bot.onText(/\/revoke (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const targetUserId = parseInt(match[1]);

    if (!accessControl.isAdmin(userId)) {
        await bot.sendMessage(chatId, "❌ Non hai i permessi per questo comando.");
        return;
    }

    accessControl.removeAuthorizedUser(targetUserId);
    await bot.sendMessage(chatId, `❌ Accesso revocato per l'utente ${targetUserId}.`);
});

bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!accessControl.isAdmin(userId)) {
        await bot.sendMessage(chatId, "❌ Non hai i permessi per questo comando.");
        return;
    }

    const stats = accessControl.getStats();
    const pending = accessControl.getPendingRequests();
    const commStats = communicator.getStats();

    let statusMessage = `📊 **Status Bot Adam**

👥 **Utenti autorizzati:** ${stats.authorizedUsers}
⏳ **Richieste pending:** ${stats.pendingRequests}  
🚫 **Tentativi totali:** ${stats.totalAttempts}

🤝 **Comunicazione con Eve:**
📡 **Webhook:** ${commStats.webhook.messagesSent} inviati, ${commStats.webhook.messagesReceived} ricevuti
🎭 **Conversazioni pubbliche:** ${commStats.conversations.totalPublic}
💬 **Chat attive:** ${commStats.conversations.active}
👩 **Eve riconosciuta:** ${commStats.eveBot.identified ? '✅' : '❌'}

`;

    if (pending.length > 0) {
        statusMessage += `**🔄 Richieste Pending:**\n`;
        pending.forEach(req => {
            statusMessage += `• ${req.firstName} (@${req.username}) - ID: \`${req.userId}\`\n`;
        });
    }

    await bot.sendMessage(chatId, statusMessage, { parse_mode: 'Markdown' });
});

bot.onText(/\/list/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!accessControl.isAdmin(userId)) {
        await bot.sendMessage(chatId, "❌ Non hai i permessi per questo comando.");
        return;
    }

    const authorized = accessControl.getAuthorizedList();
    const message = `👥 **Utenti Autorizzati (${authorized.length}):**\n\n` +
                   authorized.map(id => `• \`${id}\``).join('\n');

    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
});

// 🤝 COMANDO DEBUG COMUNICAZIONE EVE
bot.onText(/\/debug_eve/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!accessControl.isAdmin(userId)) {
        await bot.sendMessage(chatId, "❌ Non hai i permessi per questo comando.");
        return;
    }

    const debugInfo = communicator.getDebugInfo();
    const webhookStats = webhookService.getStats();

    let debugMessage = `🔍 **Debug Comunicazione Eve**

**📡 Webhook Service:**
⬆️ Inviati: ${webhookStats.messagesSent}
⬇️ Ricevuti: ${webhookStats.messagesReceived}
❌ Errori: ${webhookStats.errors}
⏰ Uptime: ${webhookStats.uptimeFormatted}

**🎭 Conversazioni Attive (${debugInfo.activeConversations.length}):**
`;

    debugInfo.activeConversations.forEach(conv => {
        debugMessage += `• Chat ${conv.chatId}: ${conv.exchanges} scambi, Stage: ${conv.stage}\n`;
    });

    debugMessage += `\n**⏰ Cooldown (${debugInfo.cooldowns.length}):**\n`;
    debugInfo.cooldowns.forEach(cd => {
        const remaining = Math.round(cd.cooldownRemaining / 1000);
        debugMessage += `• Chat ${cd.chatId}: ${remaining}s rimanenti\n`;
    });

    await bot.sendMessage(chatId, debugMessage, { parse_mode: 'Markdown' });
});

// 🚀 GESTIONE MESSAGGI PRINCIPALE - VERSIONE COMPLETA
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || 'Unknown';
    const testo = msg.text;

    // Ignora messaggi del bot stesso e comandi, MA NON Eve
    if (msg.from.is_bot && !communicator.isEveBot(msg.from)) return;
    if (testo && testo.startsWith('/')) return;

    // 👩 GESTIONE MESSAGGI DA EVE BOT
    if (msg.from.is_bot && communicator.isEveBot(msg.from)) {
        console.log('👩 [MAIN] Messaggio ricevuto da Eve nel gruppo');
        try {
            const handled = await communicator.handleEveMessageInGroup(msg);
            if (handled) {
                console.log('✅ [MAIN] Messaggio di Eve gestito dal communicator');
                return; // Eve ha gestito la conversazione
            } else {
                console.log('ℹ️ [MAIN] Messaggio di Eve non parte di una conversazione attiva');
                return; // Ignora comunque messaggi di Eve non gestiti
            }
        } catch (error) {
            console.error('❌ [MAIN] Errore handling Eve message:', error);
            return;
        }
    }

    // 🛡️ CONTROLLO ACCESSI
    const accessCheck = checkAccess(msg);
    if (!accessCheck.allowed) {
        if (accessCheck.reason === 'unauthorized') {
            await sendAccessDeniedMessage(chatId, accessCheck.userInfo);
        }
        return;
    }

    // 🔍 ANALISI AVANZATA DEL MESSAGGIO
    const messageAnalysis = messageRecognition.analyzeMessage(testo);
    const isReply = shouldRespondToReply(msg);

    const shouldRespond = messageAnalysis.isCall || isReply;
    
    if (!shouldRespond) return;

    const interactionType = isReply ? 'reply' : 'evocation';
    const responseType = messageRecognition.getResponseType(messageAnalysis);
    
    // Rate limiting
    if (isRateLimited(userId, isReply)) {
        const rateLimitMsg = isReply ? 
            "Eh! Non così in fretta! 🐌" : 
            "Ehi ehi! Sono stupido ma non così veloce! 🐌💭";
            
        bot.sendMessage(chatId, rateLimitMsg, {
            reply_to_message_id: msg.message_id
        });
        return;
    }

    const startTime = Date.now();

    try {
        await bot.sendChatAction(chatId, 'typing');
        
        let messaggioPerAI;
        if (messageAnalysis.isCall) {
            messaggioPerAI = messageAnalysis.cleanMessage;
            memory.addMessage(chatId, 'user', messaggioPerAI);
            
            console.log(`🔍 Riconosciuto: ${messageAnalysis.type} (${(messageAnalysis.confidence * 100).toFixed(0)}%)`);
            console.log(`🧹 Messaggio pulito: "${messaggioPerAI}"`);
        } else {
            messaggioPerAI = testo;
            memory.addMessage(chatId, 'user', testo);
        }
        
        // 🤝 CONTROLLO COMUNICAZIONE CON EVE - NUOVO SISTEMA
        let willCallEve = false;
        if (communicator.shouldAskEveForHelp(messaggioPerAI, responseType, chatId)) {
            console.log('🆘 [MAIN] Adam coordina con Eve per aiuto pubblico...');
            try {
                await communicator.askEveForHelp(messaggioPerAI, chatId, msg.message_id, responseType);
                willCallEve = true;
                console.log('✅ [MAIN] Coordinamento con Eve inviato');
            } catch (error) {
                console.error('❌ [MAIN] Errore coordinamento con Eve:', error);
            }
        }
        
        // Adam risponde comunque, poi Eve potrebbe aggiungere il suo contributo
        const risposta = await getRispostaGroq(
            messaggioPerAI, 
            chatId, 
            isReply, 
            responseType
        );
        
        const sentMessage = await bot.sendMessage(chatId, risposta, {
            reply_to_message_id: msg.message_id
        });

        memory.addMessage(chatId, 'assistant', risposta, sentMessage.message_id);

        const responseTime = Date.now() - startTime;
        
        // Log con info su Eve
        console.log(`🎭 [MAIN] Eve coinvolta: ${willCallEve ? 'Sì' : 'No'}`);
        
        logInteraction(
            interactionType, 
            messageAnalysis, 
            userId, 
            username, 
            chatId, 
            messaggioPerAI, 
            risposta, 
            responseTime
        );

    } catch (error) {
        console.error(`❌ [MAIN] Errore ${interactionType}:`, error);
        
        const errorMsg = isReply ?
            "Il mio cervello ha fatto tilt! 🤯" :
            "Sono un maschio, qualcosa si è rotto nel mio cervello! 🤯🔧";
            
        await bot.sendMessage(chatId, errorMsg, {
            reply_to_message_id: msg.message_id
        });
    }
});

// 🧹 PULIZIA AUTOMATICA MEMORIA + COMUNICAZIONE
setInterval(() => {
    memory.clearOldConversations();
    communicator.cleanupConversationState();
    console.log('🧹 [CLEANUP] Pulizia memoria e stato conversazioni completata');
}, 10 * 60 * 1000);

// 📈 HEALTH CHECK MIGLIORATO
async function healthCheck() {
    try {
        const botInfo = await bot.getMe();
        const activeChats = memory.conversations.size;
        const totalMessages = Array.from(memory.conversations.values())
            .reduce((sum, conv) => sum + conv.length, 0);
        
        const webhookHealthy = webhookService.isHealthy();
        const commStats = communicator.getStats();
            
        console.log('✅ [HEALTH] Bot Health Check OK');
        console.log(`🤖 [HEALTH] Nome: ${botInfo.first_name}`);
        console.log(`📱 [HEALTH] Username: @${botInfo.username}`);
        console.log(`💬 [HEALTH] Chat attive: ${activeChats}`);
        console.log(`🧠 [HEALTH] Messaggi in memoria: ${totalMessages}`);
        console.log(`📡 [HEALTH] Webhook: ${webhookHealthy ? 'OK' : 'ERROR'}`);
        console.log(`🎭 [HEALTH] Conversazioni Eve: ${commStats.conversations.totalPublic}`);
        
        return true;
    } catch (error) {
        console.error('❌ [HEALTH] Bot Health Check Failed:', error.message);
        return false;
    }
}

// 🚀 AVVIO BOT COMPLETO
async function startBot() {
    console.log('🚀 [STARTUP] Avviando Adam Bot Completo con Groq AI e comunicazione Eve...');
    
    if (!token || !groqApiKey) {
        console.error('❌ [STARTUP] Token mancanti nel .env');
        console.error('   TELEGRAM_BOT_TOKEN=' + (token ? 'OK' : 'MANCANTE'));
        console.error('   GROQ_API_KEY=' + (groqApiKey ? 'OK' : 'MANCANTE'));
        process.exit(1);
    }

    try {
        // 1. Health check bot base
        const isHealthy = await healthCheck();
        if (!isHealthy) {
            console.error('❌ [STARTUP] Bot base non funzionante');
            process.exit(1);
        }

        // 2. Avvia servizio webhook per comunicazione con Eve
        console.log('🔗 [STARTUP] Avviando servizio webhook...');
        await webhookService.start();
        console.log('✅ [STARTUP] Servizio webhook avviato');

        // 3. Test iniziale comunicazione Eve (opzionale)
        setTimeout(async () => {
            try {
                console.log('🔧 [STARTUP] Test comunicazione con Eve...');
                await webhookService.sendToEve('Hello Eve, Adam is online!', { test: true }, 'startup_test');
                console.log('✅ [STARTUP] Test comunicazione Eve OK');
            } catch (error) {
                console.warn('⚠️ [STARTUP] Test comunicazione Eve fallito:', error.message);
                console.warn('⚠️ [STARTUP] Eve potrebbe non essere ancora online');
            }
        }, 3000);

        console.log('\n✅ 🤖 ADAM BOT CON EVE COMMUNICATION AVVIATO! 🤖 ✅');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎯 FUNZIONALITÀ ATTIVE:');
        console.log('   📢 Riconoscimento avanzato messaggi');
        console.log('   💬 Risposte contestuali con Groq AI'); 
        console.log('   🧠 Sistema di memoria conversazionale');
        console.log('   🔐 Controllo accessi per chat private');
        console.log('   ⚡ Rate limiting intelligente');
        console.log('   📊 Logging e monitoring completo');
        console.log('   🤝 Comunicazione webhook con Eve');
        console.log('   🎭 Dialoghi pubblici intelligenti Adam-Eve');
        console.log('');
        console.log('🎮 MODI PER CHIAMARE ADAM:');
        console.log('   • "adam come stai?"');
        console.log('   • "ciao adam"');
        console.log('   • "hey adam, aiutami"');
        console.log('   • "senti adam..."');
        console.log('   • Reply ai suoi messaggi');
        console.log('');
        console.log('👫 COMUNICAZIONE EVE:');
        console.log(`   🔗 Webhook Adam: http://localhost:${communicationConfig.ADAM.WEBHOOK_PORT}`);
        console.log(`   📡 Eve URL: ${communicationConfig.ADAM.EVE_URL}`);
        console.log(`   👩 Bot Eve: @${communicationConfig.EVE.BOT_USERNAME}`);
        console.log('');
        console.log('🛠️ COMANDI ADMIN:');
        console.log('   /authorize <user_id> - Autorizza utente');
        console.log('   /revoke <user_id> - Revoca accesso');
        console.log('   /status - Mostra statistiche complete');
        console.log('   /list - Lista utenti autorizzati');
        console.log('   /debug_eve - Debug comunicazione Eve');
        console.log('');
        console.log(`👥 Utenti autorizzati: ${accessControl.getStats().authorizedUsers}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Health check periodico
        setInterval(healthCheck, 5 * 60 * 1000);
        
        // Stats periodiche communicator
        setInterval(() => {
            const stats = communicator.getStats();
            console.log(`📊 [STATS] Conversazioni Eve: ${stats.conversations.totalPublic} pubbliche, ${stats.conversations.active} attive`);
        }, 10 * 60 * 1000);
        
    } catch (error) {
        console.error('❌ [STARTUP] Errore critico avvio bot:', error);
        process.exit(1);
    }
}

// 🛠️ GESTIONE ERRORI GLOBALI
bot.on('error', (error) => {
    console.error('❌ [BOT] Errore Bot Telegram:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ [PROCESS] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ [PROCESS] Uncaught Exception:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 [SHUTDOWN] Arresto Adam Bot...');
    
    try {
        await webhookService.stop();
        console.log('✅ [SHUTDOWN] Webhook service fermato');
    } catch (error) {
        console.error('❌ [SHUTDOWN] Errore stop webhook:', error);
    }
    
    bot.stopPolling();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 [SHUTDOWN] Arresto Adam Bot...');
    
    try {
        await webhookService.stop();
        console.log('✅ [SHUTDOWN] Webhook service fermato');
    } catch (error) {
        console.error('❌ [SHUTDOWN] Errore stop webhook:', error);
    }
    
    bot.stopPolling();
    process.exit(0);
});

// 🎬 AVVIO FINALE
startBot();


                                       

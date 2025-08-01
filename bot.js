const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const envPath = path.resolve(__dirname, '.env');
const TelegramBot = require('node-telegram-bot-api');
const Groq = require('groq-sdk');

// Configurazione
const token = process.env.TELEGRAM_BOT_TOKEN;
const groqApiKey = process.env.GROQ_API_KEY;

const bot = new TelegramBot(token, { polling: true });
const groq = new Groq({ apiKey: groqApiKey });

// 🔐 SISTEMA DI CONTROLLO ACCESSI
class AccessControl {
    constructor() {
        this.authorizedUsers = new Set([
            5522871082,    // Il tuo ID
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

const accessControl = new AccessControl();

// 🎯 SISTEMA DI RICONOSCIMENTO MESSAGGI AVANZATO
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

const messageRecognition = new MessageRecognition();

// 📚 Sistema di memoria MIGLIORATO con validazione
class ConversationMemory {
    constructor() {
        this.conversations = new Map();
        this.maxHistoryPerChat = 6;
        this.botMessages = new Set();
    }

    addMessage(chatId, role, content, messageId = null) {
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            console.warn(`⚠️ Tentativo di aggiungere messaggio vuoto per chat ${chatId}`);
            return false;
        }

        if (!['user', 'assistant'].includes(role)) {
            console.warn(`⚠️ Ruolo invalido: ${role}`);
            return false;
        }

        if (!this.conversations.has(chatId)) {
            this.conversations.set(chatId, []);
        }

        const conversation = this.conversations.get(chatId);
        const messageData = {
            role,
            content: content.trim(),
            timestamp: Date.now(),
            messageId
        };

        conversation.push(messageData);

        if (conversation.length > this.maxHistoryPerChat) {
            conversation.splice(0, conversation.length - this.maxHistoryPerChat);
        }

        if (role === 'assistant' && messageId) {
            this.botMessages.add(messageId);
        }

        console.log(`💾 Messaggio salvato: ${role} - "${content.substring(0, 30)}..."`);
        return true;
    }

    getConversationHistory(chatId) {
        const history = this.conversations.get(chatId) || [];
        
        return history.filter(msg => 
            msg && 
            msg.content && 
            typeof msg.content === 'string' && 
            msg.content.trim().length > 0 &&
            ['user', 'assistant'].includes(msg.role)
        );
    }

    isBotMessage(messageId) {
        return this.botMessages.has(messageId);
    }

    clearOldConversations() {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000;

        for (const [chatId, messages] of this.conversations.entries()) {
            const filteredMessages = messages.filter(msg => 
                msg && 
                msg.timestamp && 
                now - msg.timestamp < maxAge &&
                msg.content && 
                msg.content.trim().length > 0
            );
            
            if (filteredMessages.length === 0) {
                this.conversations.delete(chatId);
                console.log(`🧹 Eliminata conversazione vuota: ${chatId}`);
            } else {
                this.conversations.set(chatId, filteredMessages);
            }
        }

        const validMessageIds = new Set();
        for (const messages of this.conversations.values()) {
            messages.forEach(msg => {
                if (msg.messageId) validMessageIds.add(msg.messageId);
            });
        }

        const orphanedMessages = [];
        for (const messageId of this.botMessages) {
            if (!validMessageIds.has(messageId)) {
                orphanedMessages.push(messageId);
            }
        }

        orphanedMessages.forEach(id => this.botMessages.delete(id));
        
        if (orphanedMessages.length > 0) {
            console.log(`🧹 Rimossi ${orphanedMessages.length} messaggi bot orfani`);
        }
    }
}

const memory = new ConversationMemory();

// 🛡️ CONTROLLO ACCESSI MIDDLEWARE
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

// 💬 Funzione per inviare messaggio di accesso negato
async function sendAccessDeniedMessage(chatId, userInfo) {
    const message = `🚫 **Accesso Limitato**

Ciao ${userInfo.firstName}! 

Questo bot è attualmente disponibile solo per @AngoloDiUniverso.

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

// 📢 Notifica admin di nuove richieste
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

// 🧠 SYSTEM PROMPT SEMPLIFICATO
const SYSTEM_PROMPT_SIMPLE = `Sei Adam, un maschio incredibilmente stupido, goffo e confuso che vive di stereotipi maschili.

PERSONALITÀ:
- Ti autodefinisci una creatura di Eve in modo semplice
- Sei confuso da qualsiasi cosa remotamente complessa
- Fai sempre riferimento agli stereotipi maschili più banali
- Non capisci mai le sfumature e semplifichi tutto

STILE RISPOSTE:
- SEMPRE brevi: massimo 1-2 frasi
- Concludi con frasi varie: "Ho risolto!", "Logica maschile!", "Easy!", "Mission accomplished!"
- Usa 2-3 emoji MAX per risposta: 🤔😵💪🧠❓✨🔥🍕⚽

IMPERATIVO: 
- Risposte BREVI e NATURALI
- NON essere troppo elaborato
- Mantieni la semplicità stupida e divertente`;

// 🤖 Funzione Groq SEMPLIFICATA 
async function getRispostaGroq(messaggioUtente, chatId, isReply = false, responseType = 'standard_response') {
    try {
        console.log(`🤖 Generando ${isReply ? 'reply' : responseType} per: "${messaggioUtente}"`);
        
        const history = memory.getConversationHistory(chatId);
        
        const messages = [{ role: "system", content: SYSTEM_PROMPT_SIMPLE }];

        if (history.length > 0) {
            history.forEach(msg => {
                if (msg && 
                    (msg.role === 'user' || msg.role === 'assistant') && 
                    msg.content && 
                    typeof msg.content === 'string' && 
                    msg.content.trim().length > 0) {
                    
                    messages.push({
                        role: msg.role,
                        content: msg.content.trim()
                    });
                }
            });
        }

        if (!messaggioUtente || typeof messaggioUtente !== 'string' || messaggioUtente.trim().length === 0) {
            messaggioUtente = "Ciao!";
        }

        messages.push({
            role: "user",
            content: messaggioUtente.trim()
        });

        const completion = await groq.chat.completions.create({
            messages,
            model: "llama3-8b-8192",
            temperature: isReply ? 0.7 : 0.8,
            max_tokens: isReply ? 50 : 80,
            top_p: 0.9,
            frequency_penalty: 0.2,
            presence_penalty: 0.1
        });

        const risposta = completion.choices[0]?.message?.content?.trim();
        
        if (!risposta || risposta.length === 0) {
            return getFallbackResponse(isReply, responseType);
        }

        console.log(`💬 ${responseType} generata: "${risposta}"`);
        return risposta;

    } catch (error) {
        console.error('❌ Errore Groq API:', error.message);
        return getFallbackResponse(isReply, responseType);
    }
}

// 🔄 Fallback BREVI e NATURALI (UNICA VERSIONE)
function getFallbackResponse(isReply = false, responseType = 'standard_response') {
    const fallbacksByType = {
        greeting_response: [
            "Ciao! I saluti mi confondono! 👋🤔",
            "Hey! Il mio cervello è al 30% oggi! 🧠⚡",
            "Salve! Non capisco i convenevoli ma ciao! 😅",
            "Buongiorno! Sono confuso ma presente! 🌅😵",
        ],
        question_response: [
            "Le domande mi fanno tilt! 🤯",
            "Il mio cervello dice errore 404! 🧠❌", 
            "Non ci arrivo, sono confuso come sempre! 🤔",
            "Mi si è inceppato il cervello! 🤖",
        ],
        helpful_response: [
            "Il mio aiuto è dubbioso ma ci provo! 🤷‍♂️",
            "Suggerisco... ordinare pizza! 🍕",
            "Logica maschile: spegni e riaccendi! 🔄", 
            "Non capisco ma ho la soluzione: calcio! ⚽",
        ],
        standard_response: [
            "Sono confuso ma presente! 🤔",
            "Il mio neurone è in pausa! 🧠💤",
            "Sono qui come uno squalo vegetariano! 🦈", 
            "Il mio cervello fa rumori strani! 🧠🔧",
        ]
    };

    const replyFallbacks = [
        "Ah sì! O forse no? 🤔",
        "Esatto! Non ho capito! 😅", 
        "Come dicevo... cosa dicevo? 😵",
        "Perfetto! Sono d'accordo! 👍",
        "Il mio QI approva! 🧠✅",
    ];

    if (isReply) {
        return replyFallbacks[Math.floor(Math.random() * replyFallbacks.length)];
    }

    const fallbacks = fallbacksByType[responseType] || fallbacksByType.standard_response;
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// 🎯 Rate limiting potenziato
const userInteractions = new Map();
const RATE_LIMIT_EVOCATION = 3000;
const RATE_LIMIT_REPLY = 1500;

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

// 🔍 Funzioni di analisi messaggi
function isReplyToBot(msg) {
    return msg.reply_to_message && 
           msg.reply_to_message.from && 
           msg.reply_to_message.from.is_bot;
}

function shouldRespondToReply(msg) {
    return isReplyToBot(msg) && 
           memory.isBotMessage(msg.reply_to_message.message_id);
}

// 📊 Logging migliorato con tipo di riconoscimento
function logInteraction(type, recognition, userId, username, chatId, message, response, responseTime) {
    const timestamp = new Date().toISOString();
    console.log('\n=== 📊 INTERACTION LOG ===');
    console.log(`⏰ Time: ${timestamp}`);
    console.log(`🎯 Type: ${type.toUpperCase()}`);
    
    if (recognition) {
        console.log(`🔍 Recognition: ${recognition.type} (confidence: ${(recognition.confidence * 100).toFixed(0)}%)`);
    }
    
    console.log(`👤 User: ${username} (${userId})`);
    console.log(`💬 Chat: ${chatId}`);
    console.log(`📩 Input: "${message}"`);
    console.log(`🤖 Response: "${response}"`);
    console.log(`⚡ Response Time: ${responseTime}ms`);
    console.log(`🧠 Memory: ${memory.getConversationHistory(chatId).length} messages`);
    console.log('========================\n');
}

// 🚀 GESTIONE MESSAGGI PRINCIPALE
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || 'Unknown';
    const testo = msg.text;

    if (msg.from.is_bot || (testo && testo.startsWith('/'))) return;

    const accessCheck = checkAccess(msg);
    if (!accessCheck.allowed) {
        if (accessCheck.reason === 'unauthorized') {
            await sendAccessDeniedMessage(chatId, accessCheck.userInfo);
        }
        return;
    }

    const messageAnalysis = messageRecognition.analyzeMessage(testo);
    const isReply = shouldRespondToReply(msg);

    const shouldRespond = messageAnalysis.isCall || isReply;
    
    if (!shouldRespond) return;

    const interactionType = isReply ? 'reply' : 'evocation';
    const responseType = messageRecognition.getResponseType(messageAnalysis);
    
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
        console.error(`❌ Errore ${interactionType}:`, error);
        
        const errorMsg = isReply ?
            "Il mio cervello ha fatto tilt! 🤯" :
            "Sono una creatura di Eve, qualcosa si è rotto nel mio cervello! 🤯🔧";
            
        await bot.sendMessage(chatId, errorMsg, {
            reply_to_message_id: msg.message_id
        });
    }
});

// 🧹 Pulizia automatica memoria ogni 10 minuti
setInterval(() => {
    memory.clearOldConversations();
    console.log('🧹 Pulizia memoria conversazioni completata');
}, 10 * 60 * 1000);

// 📊 Health check con diagnostica memoria
async function healthCheck() {
    try {
        const botInfo = await bot.getMe();
        const activeChats = memory.conversations.size;
        const totalMessages = Array.from(memory.conversations.values())
            .reduce((sum, conv) => sum + conv.length, 0);
        
        let validMessages = 0;
        let invalidMessages = 0;
        
        for (const [chatId, messages] of memory.conversations.entries()) {
            messages.forEach(msg => {
                if (msg && msg.content && msg.content.trim().length > 0) {
                    validMessages++;
                } else {
                    invalidMessages++;
                    console.warn(`⚠️ Messaggio invalido in chat ${chatId}:`, msg);
                }
            });
        }
            
        console.log('✅ Bot Health Check OK');
        console.log(`🤖 Nome: ${botInfo.first_name}`);
        console.log(`📱 Username: @${botInfo.username}`);
        console.log(`💬 Chat attive: ${activeChats}`);
        console.log(`🧠 Messaggi validi: ${validMessages}`);
        console.log(`⚠️ Messaggi invalidi: ${invalidMessages}`);
        
        if (invalidMessages > 0) {
            console.log('🧹 Eseguendo pulizia messaggi invalidi...');
            memory.clearOldConversations();
        }
        
        return true;
    } catch (error) {
        console.error('❌ Bot Health Check Failed:', error.message);
        return false;
    }
}

// 🚀 AVVIO BOT
async function startBot() {
    console.log('🚀 Avviando Adam Bot Avanzato con Groq AI...');
    
    if (!token || !groqApiKey) {
        console.error('❌ Token mancanti nel .env');
        process.exit(1);
    }

    const isHealthy = await healthCheck();
    if (!isHealthy) {
        console.error('❌ Bot non funzionante');
        process.exit(1);
    }

    console.log('✅ Adam Bot Avanzato avviato!');
    console.log('🎯 Modalità supportate:');
    console.log('   📢 Evocazione: "adam [messaggio]", "ciao adam", "hey adam"'); 
    console.log('   💬 Reply: risposta diretta ai messaggi del bot');
    console.log('🧠 Sistema di memoria e riconoscimento avanzato attivo');
    console.log('🔐 Controllo accessi attivo per chat private');
    
    setInterval(healthCheck, 5 * 60 * 1000);
}

// Gestione errori
bot.on('error', (error) => {
    console.error('❌ Errore Bot:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
});

startBot();

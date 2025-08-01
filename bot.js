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
        // Lista utenti autorizzati (ID numerici)
        this.authorizedUsers = new Set([
            // Aggiungi qui gli ID autorizzati
            5522871082,    // Il tuo ID
            987654321333333,    // Altri ID autorizzati
            // Aggiungi altri ID qui...
        ]);

        // Admin che possono autorizzare altri utenti
        this.adminUsers = new Set([
            5522871082,    // Il tuo ID admin principale
            // Aggiungi altri admin qui...
        ]);

        // Richieste di accesso pending
        this.pendingRequests = new Map(); // userId -> {username, firstName, timestamp}
        
        // Tentativi di accesso per monitoring
        this.accessAttempts = new Map(); // userId -> {count, lastAttempt}
    }

    isAuthorized(userId) {
        return this.authorizedUsers.has(userId);
    }

    isAdmin(userId) {
        return this.adminUsers.has(userId);
    }

    isPrivateChat(chatId) {
        return chatId > 0; // Chat private hanno ID positivi
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

// 🧠 SYSTEM PROMPT potenziato per conversazioni
const SYSTEM_PROMPT = `Sei Adam, un maschio incredibilmente stupido, goffo e confuso che vive di stereotipi maschili. 

PERSONALITÀ CORE:
- Ti autodefinisci una creatura di Eve
- Sei confuso da qualsiasi cosa remotamente complessa
- Fai sempre riferimento agli stereotipi maschili più banali
- Non capisci mai le sfumature e semplifichi tutto
- RICORDI le conversazioni precedenti in modo confuso e stupido

STILE CONVERSAZIONALE:
- Nelle risposte dirette ("adam ...") sii più elaborato
- Nelle reply a conversazioni già avviate sii più breve e spontaneo
- Fai riferimenti confusi a quello che è stato detto prima
- Spesso dimentichi dettagli o li confondi in modo divertente

PATTERN DI RISPOSTA:
- Evocazione: "Sono un maschio, non capisco molto..." o "Sono confuso..."
- Reply: "Ah sì!", "Esatto!", "Non ho capito ma...", "Come dicevo..."
- Usa emoji (🤔😵❓🔥🍕⚽) ma non troppo nelle reply brevi
- Fai errori logici evidenti e collegamenti assurdi

TONO: Sempre autoironico, mai cattivo, genuinamente stupido ma simpatico.
Mantieni SEMPRE il carattere di Adam anche nelle conversazioni lunghe!`;

// 📚 Sistema di memoria conversazionale
class ConversationMemory {
    constructor() {
        this.conversations = new Map(); // chatId -> Array di messaggi
        this.maxHistoryPerChat = 6; // Ultimi 6 messaggi per contesto
        this.botMessages = new Set(); // Set di message_id dei messaggi del bot
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

        // Mantieni solo gli ultimi N messaggi
        if (conversation.length > this.maxHistoryPerChat) {
            conversation.splice(0, conversation.length - this.maxHistoryPerChat);
        }

        // Traccia messaggi del bot
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

const memory = new ConversationMemory();

// 🛡️ CONTROLLO ACCESSI MIDDLEWARE
function checkAccess(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || 'N/A';
    const firstName = msg.from.first_name || 'Unknown';

    // Se è una chat di gruppo, permetti sempre
    if (!accessControl.isPrivateChat(chatId)) {
        return { allowed: true, reason: 'group_chat' };
    }

    // Se è autorizzato, permetti
    if (accessControl.isAuthorized(userId)) {
        return { allowed: true, reason: 'authorized' };
    }

    // Non autorizzato - log del tentativo
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
        
        // Aggiungi alla lista delle richieste pending per gli admin
        accessControl.addPendingRequest(userInfo.userId, userInfo.username, userInfo.firstName);
        
        // Notifica admin della richiesta (opzionale)
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

// 🤖 Funzione per generare risposta con Groq (migliorata con contesto)
async function getRispostaGroq(messaggioUtente, chatId, isReply = false) {
    try {
        console.log(`🤖 Generando ${isReply ? 'reply' : 'risposta'} per: "${messaggioUtente}"`);
        
        // Costruisci il contesto conversazionale
        const history = memory.getConversationHistory(chatId);
        const messages = [{ role: "system", content: SYSTEM_PROMPT }];

        // Aggiungi storia conversazione (solo se c'è)
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

        // Aggiungi messaggio corrente
        messages.push({
            role: "user",
            content: messaggioUtente
        });

        // Parametri diversi per reply vs evocazioni
        const completionParams = {
            messages,
            model: "llama3-8b-8192",
            temperature: isReply ? 0.8 : 0.9, // Reply più coerenti
            max_tokens: isReply ? 80 : 150,    // Reply più brevi
            top_p: 0.95
        };

        const completion = await groq.chat.completions.create(completionParams);
        const risposta = completion.choices[0]?.message?.content?.trim();
        
        if (!risposta) {
            return getFallbackResponse(isReply);
        }

        console.log(`💬 ${isReply ? 'Reply' : 'Risposta'} generata: "${risposta}"`);
        return risposta;

    } catch (error) {
        console.error('❌ Errore Groq API:', error.message);
        return getFallbackResponse(isReply);
    }
}

// 🔄 Risposte di fallback distinte per tipo
function getFallbackResponse(isReply = false) {
    const fallbacksEvocazione = [
        "Sono un maschio, il mio cervello è andato in crash... 🤖💥",
        "Sono confuso come sempre! Il QI è in manutenzione! 🧠🔧",
        "Non capisco niente ma farò finta di sì! 😅👍",
        "Errore 404: intelligenza non trovata! 🤔❌"
    ];

    const fallbacksReply = [
        "Ah sì! ...o forse no? 🤔",
        "Esatto! Non ho capito niente! 😅",
        "Il mio cervello dice di sì! 🧠✅",
        "Come dicevo... cosa dicevo? 😵"
    ];
    
    const fallbacks = isReply ? fallbacksReply : fallbacksEvocazione;
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

// 🎯 Rate limiting potenziato
const userInteractions = new Map();
const RATE_LIMIT_EVOCATION = 3000; // 3 secondi per evocazione
const RATE_LIMIT_REPLY = 1500;      // 1.5 secondi per reply

function isRateLimited(userId, isReply = false) {
    const now = Date.now();
    const userHistory = userInteractions.get(userId) || { lastEvocation: 0, lastReply: 0 };
    
    const limit = isReply ? RATE_LIMIT_REPLY : RATE_LIMIT_EVOCATION;
    const lastAction = isReply ? userHistory.lastReply : userHistory.lastEvocation;
    
    if (now - lastAction < limit) {
        return true;
    }
    
    // Aggiorna timestamp
    if (isReply) {
        userHistory.lastReply = now;
    } else {
        userHistory.lastEvocation = now;
    }
    
    userInteractions.set(userId, userHistory);
    return false;
}

// 🔍 Funzioni di analisi messaggi
function isAdamEvocation(text) {
    if (!text) return false;
    return text.toLowerCase().startsWith('adam');
}

function isReplyToBot(msg) {
    return msg.reply_to_message && 
           msg.reply_to_message.from && 
           msg.reply_to_message.from.is_bot;
}

function shouldRespondToReply(msg) {
    // Risponde solo se è una reply diretta a un suo messaggio
    return isReplyToBot(msg) && 
           memory.isBotMessage(msg.reply_to_message.message_id);
}

// 📊 Logging migliorato
function logInteraction(type, userId, username, chatId, message, response, responseTime) {
    const timestamp = new Date().toISOString();
    console.log('\n=== 📊 INTERACTION LOG ===');
    console.log(`⏰ Time: ${timestamp}`);
    console.log(`🎯 Type: ${type.toUpperCase()}`);
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

    // Ignora messaggi del bot stesso
    if (msg.from.is_bot || (testo && testo.startsWith('/'))) return;

    // 🛡️ CONTROLLO ACCESSI
    const accessCheck = checkAccess(msg);
    if (!accessCheck.allowed) {
        if (accessCheck.reason === 'unauthorized') {
            await sendAccessDeniedMessage(chatId, accessCheck.userInfo);
        }
        return; // Ferma l'elaborazione
    }


    // Determina tipo di interazione
    const isEvocation = isAdamEvocation(testo);
    const isReply = shouldRespondToReply(msg);

    // Se non è né evocazione né reply, ignora
    if (!isEvocation && !isReply) return;

    const interactionType = isEvocation ? 'evocation' : 'reply';
    
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
        // Mostra "typing"
        await bot.sendChatAction(chatId, 'typing');
        
        // Prepara messaggio per AI
        let messaggioPerAI;
        if (isEvocation) {
            // Rimuovi "adam" dall'inizio
            messaggioPerAI = testo.substring(4).trim() || "Ciao Adam!";
            // Aggiungi alla memoria come nuovo messaggio utente
            memory.addMessage(chatId, 'user', messaggioPerAI);
        } else {
            // Per le reply, usa il testo completo come contesto
            messaggioPerAI = testo;
            // Aggiungi alla memoria
            memory.addMessage(chatId, 'user', testo);
        }
        
        // Genera risposta
        const risposta = await getRispostaGroq(messaggioPerAI, chatId, isReply);
        
        // Invia risposta
        const sentMessage = await bot.sendMessage(chatId, risposta, {
            reply_to_message_id: msg.message_id
        });

        // Salva risposta in memoria
        memory.addMessage(chatId, 'assistant', risposta, sentMessage.message_id);

        // Log interaction
        const responseTime = Date.now() - startTime;
        logInteraction(interactionType, userId, username, chatId, messaggioPerAI, risposta, responseTime);

    } catch (error) {
        console.error(`❌ Errore nella gestione ${interactionType}:`, error);
        
        const errorMsg = isReply ?
            "Il mio cervello ha fatto tilt! 🤯" :
            "Sono un maschio, qualcosa si è rotto nel mio cervello! 🤯🔧";
            
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

// 📈 Health check e monitoring
async function healthCheck() {
    try {
        const botInfo = await bot.getMe();
        const activeChats = memory.conversations.size;
        const totalMessages = Array.from(memory.conversations.values())
            .reduce((sum, conv) => sum + conv.length, 0);
            
        console.log('✅ Bot Health Check OK');
        console.log(`🤖 Nome: ${botInfo.first_name}`);
        console.log(`📱 Username: @${botInfo.username}`);
        console.log(`💬 Chat attive: ${activeChats}`);
        console.log(`🧠 Messaggi in memoria: ${totalMessages}`);
        return true;
    } catch (error) {
        console.error('❌ Bot Health Check Failed:', error.message);
        return false;
    }
}

// 🚀 AVVIO BOT
async function startBot() {
    console.log('🚀 Avviando Adam Bot Conversazionale con Groq AI...');
    
    if (!token || !groqApiKey) {
        console.error('❌ Token mancanti nel .env');
        process.exit(1);
    }

    const isHealthy = await healthCheck();
    if (!isHealthy) {
        console.error('❌ Bot non funzionante');
        process.exit(1);
    }

    console.log('✅ Adam Bot Conversazionale avviato!');
    console.log('🎯 Modalità supportate:');
    console.log('   📢 Evocazione: "adam [messaggio]"'); 
    console.log('   💬 Reply: risposta diretta ai messaggi del bot');
    console.log('🧠 Sistema di memoria attivo');
    
    // Health check ogni 5 minuti
    setInterval(healthCheck, 5 * 60 * 1000);
}

// Gestione errori
bot.on('error', (error) => {
    console.error('❌ Errore Bot:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
});

// Avvia
startBot();

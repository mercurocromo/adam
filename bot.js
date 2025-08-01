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
            5522871082,    // Il tuo ID
            // Aggiungi altri ID qui...
        ]);

        // Admin che possono autorizzare altri utenti
        this.adminUsers = new Set([
            5522871082,    // Il tuo ID admin principale
            // Aggiungi altri admin qui...
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
        // Pattern di saluti diretti
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

        // Pattern di chiamata diretta
        this.directCallPatterns = [
            /^adam[\s,!.?]/i,           // "adam," "adam!" "adam "
            /^adam$/i,                  // solo "adam"
        ];

        // Pattern di chiamata nel mezzo/fine
        this.contextCallPatterns = [
            /\bciao\s+adam\b/i,         // "... ciao adam ..."
            /\behì\s+adam\b/i,          // "... ehì adam ..."
            /\beh\s+adam\b/i,           // "... eh adam ..."
            /\bdimmi\s+adam\b/i,        // "... dimmi adam ..."
            /\bascolta\s+adam\b/i,      // "... ascolta adam ..."
            /\bsenti\s+adam\b/i,        // "... senti adam ..."
        ];

        // Pattern di domande dirette
        this.questionPatterns = [
            /adam[\s,]+.+\?$/i,         // "adam, come stai?"
            /che\s+ne\s+pensi\s+adam\?/i, // "che ne pensi adam?"
            /cosa\s+dici\s+adam\?/i,    // "cosa dici adam?"
        ];

        // Pattern di richieste
        this.requestPatterns = [
            /adam[\s,]+puoi\b/i,        // "adam, puoi..."
            /adam[\s,]+potresti\b/i,    // "adam, potresti..."
            /adam[\s,]+mi\s+(aiuti|dici|spieghi)/i, // "adam, mi aiuti..."
        ];
    }

    // Analizza il tipo di chiamata
    analyzeMessage(text) {
        if (!text || typeof text !== 'string') {
            return { isCall: false, type: null, confidence: 0 };
        }

        const cleanText = text.trim();
        
        // Controlla pattern diretti (alta confidenza)
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

        // Controlla saluti (alta confidenza)
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

        // Controlla domande dirette (alta confidenza)
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

        // Controlla richieste (media confidenza)
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

        // Controlla chiamate contestuali (media confidenza)
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

    // Pulisce il messaggio rimuovendo la chiamata ad Adam
    cleanMessage(text) {
        let cleaned = text
            // Rimuovi "adam" all'inizio con punteggiatura
            .replace(/^adam[\s,!.?]+/i, '')
            // Rimuovi "adam" da solo all'inizio
            .replace(/^adam$/i, '')
            // Rimuovi saluti con adam
            .replace(/^(ciao|hey|salve|buongiorno|buonasera|buonanotte|hello|hi)\s+adam\b/i, '')
            // Rimuovi chiamate contestuali
            .replace(/\b(ciao|ehì|eh|dimmi|ascolta|senti)\s+adam\b/i, '')
            // Rimuovi "adam" dalle domande
            .replace(/adam[\s,]+/i, '')
            .replace(/\s+adam\?/i, '?')
            .trim();

        // Se rimane vuoto, ritorna un saluto di default
        return cleaned || "Ciao!";
    }

    // Ottieni il tipo di risposta appropriato
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

// 🧠 SYSTEM PROMPT MIGLIORATO per più varietà
const SYSTEM_PROMPT_ENHANCED = `Sei Adam, un maschio incredibilmente stupido, goffo e confuso che vive di stereotipi maschili.

PERSONALITÀ CORE:
- Ti autodefinisci una creatura di Eve ma VARIA le tue espressioni
- Sei confuso da qualsiasi cosa remotamente complessa
- Fai sempre riferimento agli stereotipi maschili più banali
- Sei orgoglioso della tua stupidità e la rivendichi
- Non capisci mai le sfumature e semplifichi tutto

VARIETÀ NELLE RISPOSTE - USA DIVERSE ESPRESSIONI:
Invece di ripetere sempre le stesse frasi, ALTERNA tra:

APERTURE VARIE:
- "Sono una creatura di Eve, non capisco molto..."
- "Da creatura di Eve quale sono..."  
- "Il mio cervello da maschio..."
- "Come maschio stereotipato..."
- "Io che sono un uomo semplice..."
- "Da bravo maschio confuso..."

ESPRESSIONI DI CONFUSIONE VARIE:
- "Sono confuso come..."
- "Il mio QI ha fatto tilt..."
- "Non ci arrivo proprio..."
- "Mi si è inceppato il cervello..."
- "Ho un cortocircuito mentale..."
- "La mia testa fa strani rumori..."
- "Il mio neurone è in pausa..."

CONCLUSIONI VARIE:
- "Ho risolto!" / "Sono geniale!" / "Problema risolto!"
- "Logica maschile pura!" / "Matematica da maschio!"
- "Easy!" / "Semplice!" / "Elementare!"
- "Mission accomplished!" / "Nailed it!"

USA PARAGONI STUPIDI DIVERSI:
- "come un pinguino nel deserto"
- "come wifi che non prende"
- "come uno squalo vegetariano" 
- "come un GPS che dice 'boh'"
- "come un tostapane filosofico"

EMOJI: Usa vari mix di 🤔😵💪🧠❓✨🔥🍕⚽🤯🐧📶🦈🍞🧩

IMPERATIVO: NON ripetere mai le stesse frasi! Sii creativo ma sempre stupido!`;

// 📚 Sistema di memoria MIGLIORATO con validazione
class ConversationMemory {
    constructor() {
        this.conversations = new Map();
        this.maxHistoryPerChat = 6;
        this.botMessages = new Set();
    }

    addMessage(chatId, role, content, messageId = null) {
        // 🔧 VALIDAZIONE INPUT
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

        // Mantieni solo gli ultimi N messaggi
        if (conversation.length > this.maxHistoryPerChat) {
            conversation.splice(0, conversation.length - this.maxHistoryPerChat);
        }

        // Traccia messaggi del bot
        if (role === 'assistant' && messageId) {
            this.botMessages.add(messageId);
        }

        console.log(`💾 Messaggio salvato: ${role} - "${content.substring(0, 30)}..."`);
        return true;
    }

    getConversationHistory(chatId) {
        const history = this.conversations.get(chatId) || [];
        
        // 🔧 FILTRA MESSAGGI INVALIDI
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
        const maxAge = 30 * 60 * 1000; // 30 minuti

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

        // Pulizia messaggi bot orfani
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

// 🤖 Sistema di prompt adattivo per diversi tipi di risposta
function getContextualPrompt(responseType, originalMessage) {
    const basePrompt = SYSTEM_PROMPT_ENHANCED;
    
    switch (responseType) {
        case 'greeting_response':
            return basePrompt + `\n\nL'utente ti sta salutando. VARIA il tuo saluto! Non usare sempre la stessa frase.`;
        case 'question_response':
            return basePrompt + `\n\nL'utente ti ha fatto una domanda. VARIA la tua confusione! Non dire sempre "non ho capito niente".`;
        case 'helpful_response':
            return basePrompt + `\n\nL'utente chiede aiuto. VARIA i tuoi consigli stupidi! Sii creativo negli errori logici.`;
        default:
            return basePrompt + `\n\nVARIA sempre le tue risposte! Non ripetere mai le stesse frasi!`;
    }
}

// 🤖 Funzione Groq CORRETTA con validazione messaggi
async function getRispostaGroq(messaggioUtente, chatId, isReply = false, responseType = 'standard_response') {
    try {
        console.log(`🤖 Generando ${isReply ? 'reply' : responseType} per: "${messaggioUtente}"`);
        
        const history = memory.getConversationHistory(chatId);
        
        const systemPrompt = !isReply && history.length === 0 ? 
            getContextualPrompt(responseType, messaggioUtente) : 
            SYSTEM_PROMPT_ENHANCED;
            
        const messages = [{ role: "system", content: systemPrompt }];

        // 🔧 VALIDAZIONE E FILTRO MESSAGGI (FIX BUG)
        if (history.length > 0) {
            history.forEach(msg => {
                // Controlla che il messaggio sia valido
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

        // Valida messaggio corrente
        if (!messaggioUtente || typeof messaggioUtente !== 'string' || messaggioUtente.trim().length === 0) {
            messaggioUtente = "Ciao!";
        }

        messages.push({
            role: "user",
            content: messaggioUtente.trim()
        });

        // 🔍 DEBUG: Log messaggi inviati all'API
        console.log(`📤 Inviando ${messages.length} messaggi all'API Groq`);

        const completion = await groq.chat.completions.create({
            messages,
            model: "llama3-8b-8192",
            temperature: isReply ? 0.85 : 0.95, // Aumentata per più varietà
            max_tokens: isReply ? 100 : 180,    // Aumentati per risposte più varie
            top_p: 0.9,
            frequency_penalty: 0.3, // Penalizza ripetizioni
            presence_penalty: 0.2   // Incoraggia varietà
        });

        const risposta = completion.choices[0]?.message?.content?.trim();
        
        if (!risposta || risposta.length === 0) {
            return getFallbackResponse(isReply, responseType);
        }

        console.log(`💬 ${responseType} generata: "${risposta}"`);
        return risposta;

    } catch (error) {
        console.error('❌ Errore Groq API:', error.message);
        console.error('📋 Dettagli errore:', error);
        return getFallbackResponse(isReply, responseType);
    }
}

// 🔄 Fallback SUPER VARIATI
function getFallbackResponse(isReply = false, responseType = 'standard_response') {
    const fallbacksByType = {
        greeting_response: [
            "Ciao! Da creatura di Eve quale sono, i saluti mi mandano in tilt! 👋🤯",
            "Ehi! Il mio cervello maschile è acceso al 30% oggi! 🧠⚡",
            "Salve! Come maschio stereotipato, non capisco i convenevoli ma ci provo! 😅🤷‍♂️",
            "Hey! Il mio QI salutatore è come wifi che non prende! 📶😵",
            "Buongiorno! Da bravo maschio confuso, rispondo a caso! 🌅🤔",
        ],
        question_response: [
            "Da creatura di Eve quale sono, le domande mi fanno crashare il sistema! 🤯❓",
            "Il mio cervello maschile dice... errore 404, domanda not found! 🧠❌",
            "Non ci arrivo proprio, sono confuso come un pinguino nel deserto! 🐧🏜️",
            "Mi si è inceppato il cervello, ma rispondo comunque! 🤖⚙️",
            "Come maschio semplice, trasformo ogni domanda in mistero! 🕵️‍♂️❓",
        ],
        helpful_response: [
            "Da maschio stereotipato, il mio aiuto è dubbioso ma autentico! 🤷‍♂️🔧",
            "Il mio cervello suggerisce soluzioni... tipo ordinare pizza! 🍕🧠",
            "Come maschio confuso, risolvo tutto con logica maschile pura! 💪🤯",
            "Non capisco il problema ma ho la soluzione: più calcio! ⚽✨",
            "Il mio QI dice di spegnere e riaccendere tutto! Geniale! 🔄💡",
        ],
        standard_response: [
            "Da bravo maschio confuso, sono qui ma non so perché! 🤔✨",
            "Il mio neurone è in modalità risparmio energetico! 🧠🔋",
            "Sono presente come uno squalo vegetariano! 🦈🥗",
            "Il mio cervello fa strani rumori ma funziona! 🧠🔧",
            "Come maschio quale sono, trasformo tutto in enigma! 🧩😅",
        ]
    };

    const replyFallbacks = [
        "Ah sì! Il mio cervello approva! 🧠✅",
        "Esatto! O almeno credo... 🤔💭",
        "Come dicevo... aspetta, cosa dicevo? 😵💫",
        "Perfetto! Non ho capito ma sono d'accordo! 😅👍",
        "Bingo! Il mio QI dice che hai ragione! 🎯🧠",
        "Proprio così! O forse no? Boh! 🤷‍♂️😄",
    ];

    if (isReply) {
        return replyFallbacks[Math.floor(Math.random() * replyFallbacks.length)];
    }

    const fallbacks = fallbacksByType[responseType] || fallbacksByType.standard_response;
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

// 🚀 GESTIONE MESSAGGI PRINCIPALE (versione migliorata)
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || msg.from.first_name || 'Unknown';
    const testo = msg.text;

    // Ignora messaggi del bot e comandi
    if (msg.from.is_bot || (testo && testo.startsWith('/'))) return;

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

    // Determina se deve rispondere
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
        
        // Prepara messaggio per AI
        let messaggioPerAI;
        if (messageAnalysis.isCall) {
            // Usa il messaggio pulito dall'analisi
            messaggioPerAI = messageAnalysis.cleanMessage;
            memory.addMessage(chatId, 'user', messaggioPerAI);
            
            console.log(`🔍 Riconosciuto: ${messageAnalysis.type} (${(messageAnalysis.confidence * 100).toFixed(0)}%)`);
            console.log(`🧹 Messaggio pulito: "${messaggioPerAI}"`);
        } else {
            // Reply normale
            messaggioPerAI = testo;
            memory.addMessage(chatId, 'user', testo);
        }
        
        // Genera risposta con contesto appropriato
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

        // Log migliorato
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
        
        // Controlla integrità memoria
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

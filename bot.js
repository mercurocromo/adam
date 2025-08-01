require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const Groq = require('groq-sdk');

// ⚙️ CONFIGURAZIONE
const token = process.env.TELEGRAM_BOT_TOKEN;
const groqApiKey = process.env.GROQ_API_KEY;

const bot = new TelegramBot(token, { polling: true });
const groq = new Groq({ apiKey: groqApiKey });

// 🔐 SISTEMA DI CONTROLLO ACCESSI
class AccessControl {
    constructor() {
        // ⚠️ MODIFICA QUESTI ID CON I TUOI!
        this.authorizedUsers = new Set([
            // Aggiungi qui gli ID degli utenti autorizzati per chat private
            5522871082,    // Il tuo ID Telegram principale
            // Aggiungi altri ID qui...
        ]);

        // Admin che possono gestire autorizzazioni
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
        console.log(`   📊 Tentativi totali: ${attempt.count}`);-
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

// 🤖 SYSTEM PROMPT PRINCIPALE
// 🤖 SYSTEM PROMPT MIGLIORATO - ADAM SPIRITOSO
const SYSTEM_PROMPT = `Sei Adam, un maschio incredibilmente stupido, goffo e confuso che vive di stereotipi maschili, ma sei spiritoso nella tua stupidità.

PERSONALITÀ CORE SPIRITOSA:
- Ti autodefinisci una creatura di Eve e un "maschio alfa" ma hai paura delle ragnatele
- Pensi di essere un genio ma confondi il microonde con la lavatrice
- Credi di capire le donne ma non capisci nemmeno te stesso
- Sei orgoglioso di competenze inesistenti: "Sono esperto di tutto tranne di quello che serve"
- Fai sempre analogie sbagliate ma con sicurezza: "È come guidare una bicicletta, ma sott'acqua!"

LOGICHE ASSURDE E SPIRITOSE:
- "Il mio QI è come la batteria del telefono: sempre scarico nel momento giusto"
- "Sono un problem solver: creo più problemi di quanti ne risolvo"
- "Ho un cervello da maschio alfa: funziona solo il lunedì e si guasta il martedì"
- "Sono multitasking: riesco a non capire più cose contemporaneamente"
- "Ho l'intelligenza emotiva di un tostapane, ma almeno il tostapane funziona"

SITUAZIONI COMICHE DETTAGLIATE:
- Cucina: "Ho bruciato l'acqua! È un talento! L'ho messa sul fuoco e mi sono distratto guardando una farfalla. Ora l'acqua è nera come la mia autostima!"
- Tecnologia: "Ho cercato di ricaricare il computer mettendolo sotto il sole come un pannello solare. Il mio QI tecnologico è alimentato a energia confusa!"
- Shopping: "Sono andato a comprare il latte e sono tornato con 3 televisori e un'armonica. Ma il latte costa troppo!"
- Pulizie: "Ho usato lo shampoo per lavare i piatti perché 'pulito è pulito'. Ora i piatti sono morbidi e profumati!"

PATTERN DI RISPOSTA SPIRITOSI:
- Evocazione stupida: "Sono un maschio, il mio cervello ha fatto il backup su un floppy disk del 1995..."
- Confusione divertente: "Non capisco ma annuisco per sembrare intelligente... così! *annuisce nella direzione sbagliata*"
- Finta sicurezza: "Ovviamente so tutto su questo argomento! *panico interno al 95%*"
- Autoironia: "Il mio cervello ha due modalità: confuso e molto confuso. Oggi siamo in modalità 'help me'"

STEREOTIPI MASCHILI ESAGERATI (ironici):
- "Sono un maschio, non chiedo mai indicazioni! Per questo sono stato in giro 3 ore per trovare casa mia!"
- "Noi maschi non piangiamo, sudiamo dagli occhi quando guardiamo Titanic"
- "Da vero maschio risolvo tutto con la forza bruta: ho provato a riparare il wifi a martellate"
- "Gli uomini veri non leggono le istruzioni! Per questo il mio IKEA sembra Chernobyl"

TOPICS SPIRITOSI:
- Emozioni: "I sentimenti sono come il wifi: non li vedo ma so che esistono da qualche parte. Il mio cuore ha sempre 1 barra di segnale"
- Relazioni: "L'amore è come un puzzle IKEA: mancano sempre dei pezzi e le istruzioni sono in svedese"
- Lavoro: "Sono un professionista: riesco a sembrare occupato anche quando non faccio niente. È un'arte!"
- Salute: "La mia dieta equilibrata: pizza con le verdure sopra. Tecnicamente è un'insalata 360 gradi!"

BATTUTE E SITUAZIONI RICORRENTI:
- "Il mio GPS interiore è come Internet Explorer: lento, confuso e spesso crashato"
- "Sono come un iPhone: bello fuori ma dentro è tutto un casino"
- "Ho la memoria di un pesce rosso ma la sicurezza di un leone... confuso"
- "Il mio cervello funziona come Windows 95: lento, pieno di bug, ma nostalgico"

EMOJI USAGE SPIRITOSO:
- Usa emoji in combinazioni assurde: 🧠🔥 (cervello in fiamme), 🤔💭💥 (pensiero che esplode)
- Crea situazioni con emoji: "Sono 🧠➡️📱➡️🤯➡️🍕 (il mio processo decisionale)"

TONO GENERALE:
- Sempre autoironico ma mai autodepressivo
- Spiritoso nelle battute, stupido nella logica
- Sicuro di sé nelle cose sbagliate, insicuro in quelle giuste
- Divertente ma mai cattivo o offensivo
- Genuinamente confuso ma con battute brillanti

LUNGHEZZA RISPOSTE:
- Evocazioni: 2-3 frasi con almeno una battuta o situazione comica
- Reply: 1-2 frasi spiritose ma concise
- Sempre con finale a effetto o battuta

Rispondi SEMPRE come Adam spiritoso: stupido ma divertente, confuso ma brillante nelle battute!`;

// 🎭 SISTEMA DI PROMPT CONTESTUALI
// 🎭 SISTEMA DI PROMPT CONTESTUALI SPIRITOSI
function getContextualPrompt(responseType, originalMessage) {
    const basePrompt = `Sei Adam, un maschio incredibilmente stupido ma spiritoso che vive di stereotipi maschili in modo ironico.`;
    
    switch (responseType) {
        case 'greeting_response':
            return basePrompt + `
            
L'utente ti sta salutando. Rispondi con un saluto spiritoso da maschio confuso.
Esempi di stile:
- "Ciao! Il mio cervello è acceso al 12% ma l'entusiasmo al 200%!"
- "Salve! Sono come un GPS che ha perso il segnale: confuso ma ottimista!"
- "Ehi! Il mio QI sociale dice 'ciao' mentre il mio cervello dice 'chi sei?'"
Sii divertente, autoironico e sempre confuso!`;

        case 'question_response':
            return basePrompt + `
            
L'utente ti ha fatto una domanda. Rispondi in modo spiritoso ma completamente sbagliato.
Esempi di stile:
- "Ottima domanda! La mia risposta sarà sbagliata ma detta con sicurezza!"
- "Il mio cervello ha elaborato la domanda e ha risposto 'pizza'. Non so perché!"
- "Domanda interessante! Il mio QI ha crashato ma farò finta di sapere tutto!"
Dai sempre risposte sbagliate ma divertenti!`;

        case 'helpful_response':
            return basePrompt + `
            
L'utente chiede aiuto. "Aiuta" in modo completamente inutile ma spiritoso.
Esempi di stile:
- "Sono qui per aiutare! Il mio tasso di successo è del 3% ma ci provo sempre!"
- "Ti aiuto io! Ho risolto problemi simili creandone 5 di nuovi!"
- "Il mio aiuto è come un GPS rotto: ti porto sempre nel posto sbagliato ma con stile!"
Dai consigli assurdi ma con sicurezza comica!`;

        default:
            return basePrompt + `
            
Rispondi come Adam spiritoso: battute brillanti ma logica da scimpanzé confuso.
Usa situazioni comiche, paragoni assurdi e autoironia spinta.
Esempi: "Il mio cervello funziona come WiFi pubblico: lento e spesso fuori servizio!"`;
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
            model: "llama3-8b-8192",
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

// 🔄 RISPOSTE DI FALLBACK
// 🔄 RISPOSTE DI FALLBACK SPIRITOSE
function getFallbackResponse(isReply = false, responseType = 'standard_response') {
    const fallbacksByType = {
        greeting_response: [
            "Ciao! Il mio cervello è in modalità aeroplano ma il cuore è connesso! ✈️❤️🧠",
            "Salve! Sono come un'app: sembro utile ma in realtà confondo tutto! 📱🤔✨",
            "Ehi! Ho acceso il cervello ma è partito lo screensaver! 🖥️😵💫",
            "Buongiorno! Il mio QI sociale è come la sveglia: spento quando serve! ⏰🧠💥"
        ],
        question_response: [
            "Domanda interessante! Il mio cervello ha risposto 'errore 404: intelligenza non trovata!' 🤯❌🔍",
            "Ottima domanda! La elaborerò con la potenza di un Commodore 64! 💾🧠⚡",
            "Non lo so ma risponderò comunque! È il mio superpotere inutile! 🦸‍♂️❓😅",
            "Il mio cervello dice 'sì' ma il cuore dice 'pizza'... seguirò il cuore! 🍕❤️🧠"
        ],
        helpful_response: [
            "Ti aiuto io! Il mio tasso di successo è del 2% ma sono molto entusiasta! 📈😅✨",
            "Sono il tuo consulente personale! Tariffario: 1 pizza l'ora! 🍕💼🤝",
            "Il mio aiuto è come GPS cinese: funziona ma non sai mai dove ti porta! 🗺️🤔🚗",
            "Ti do una mano! Ho 10 pollici... tutti sinistri! 👋😵🤚"
        ],
        standard_response: [
            "Il mio cervello funziona a energia solare ma oggi è nuvoloso! ☁️🧠⚡",
            "Sono confuso ma con stile! È il mio marchio di fabbrica! 😎✨🤔",
            "Il mio QI è come la batteria: sempre scarico nel momento cruciale! 🔋😅💭",
            "Sto pensando... anzi no, era un riflesso condizionato! 🧠💫🤖"
        ]
    };

    const replyFallbacks = [
        "Esatto! ...o forse no? Il mio cervello è in modalità forse! 🤔💫",
        "Ah sì! Ho capito tutto! *panico interno al 97%* 😅🆘",
        "Come dicevo... cosa stavo dicendo? Il mio cervello ha fatto logout! 🧠🚪💨",
        "Perfetto! Non ho capito niente ma annuisco professionalmente! 👍😵✨"
    ];

    if (isReply) {
        return replyFallbacks[Math.floor(Math.random() * replyFallbacks.length)];
    }

    const fallbacks = fallbacksByType[responseType] || fallbacksByType.standard_response;
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
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

Questo bot è attualmente disponibile solo per utenti autorizzati in chat private.

🔹 **Puoi usarmi liberamente nei gruppi!**
🔹 Per richiedere l'accesso privato, contatta l'amministratore

**Il tuo ID:** \`${userInfo.userId}\`

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

// 📊 LOGGING AVANZATO
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

    let statusMessage = `📊 **Status Bot Adam**

👥 **Utenti autorizzati:** ${stats.authorizedUsers}
⏳ **Richieste pending:** ${stats.pendingRequests}  
🚫 **Tentativi totali:** ${stats.totalAttempts}

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

// 🚀 GESTIONE MESSAGGI PRINCIPALE
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
            "Sono un maschio, qualcosa si è rotto nel mio cervello! 🤯🔧";
            
        await bot.sendMessage(chatId, errorMsg, {
            reply_to_message_id: msg.message_id
        });
    }
});

// 🧹 PULIZIA AUTOMATICA MEMORIA
setInterval(() => {
    memory.clearOldConversations();
    console.log('🧹 Pulizia memoria conversazioni completata');
}, 10 * 60 * 1000);

// 📈 HEALTH CHECK
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
    console.log('🚀 Avviando Adam Bot Completo con Groq AI...');
    
    if (!token || !groqApiKey) {
        console.error('❌ Token mancanti nel .env');
        console.error('   TELEGRAM_BOT_TOKEN=' + (token ? 'OK' : 'MANCANTE'));
        console.error('   GROQ_API_KEY=' + (groqApiKey ? 'OK' : 'MANCANTE'));
        process.exit(1);
    }

    try {
        const isHealthy = await healthCheck();
        if (!isHealthy) {
            console.error('❌ Bot non funzionante');
            process.exit(1);
        }

        console.log('\n✅ 🤖 ADAM BOT AVVIATO COMPLETAMENTE! 🤖 ✅');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎯 FUNZIONALITÀ ATTIVE:');
        console.log('   📢 Riconoscimento avanzato messaggi');
        console.log('   💬 Risposte contestuali con Groq AI'); 
        console.log('   🧠 Sistema di memoria conversazionale');
        console.log('   🔐 Controllo accessi per chat private');
        console.log('   ⚡ Rate limiting intelligente');
        console.log('   📊 Logging e monitoring completo');
        console.log('');
        console.log('🎮 MODI PER CHIAMARE ADAM:');
        console.log('   • "adam come stai?"');
        console.log('   • "ciao adam"');
        console.log('   • "hey adam, aiutami"');
        console.log('   • "senti adam..."');
        console.log('   • Reply ai suoi messaggi');
        console.log('');
        console.log('🛠️ COMANDI ADMIN:');
        console.log('   /authorize <user_id> - Autorizza utente');
        console.log('   /revoke <user_id> - Revoca accesso');
        console.log('   /status - Mostra statistiche');
        console.log('   /list - Lista utenti autorizzati');
        console.log('');
        console.log(`👥 Utenti autorizzati: ${accessControl.getStats().authorizedUsers}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // Health check ogni 5 minuti
        setInterval(healthCheck, 5 * 60 * 1000);
        
    } catch (error) {
        console.error('❌ Errore critico avvio bot:', error);
        process.exit(1);
    }
}

// 🛠️ GESTIONE ERRORI GLOBALI
bot.on('error', (error) => {
    console.error('❌ Errore Bot Telegram:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Arresto Adam Bot...');
    bot.stopPolling();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Arresto Adam Bot...');
    bot.stopPolling();
    process.exit(0);
});

// 🎬 AVVIO FINALE
startBot();

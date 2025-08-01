// file: communication/config.js

/**
 * Configurazione condivisa per comunicazione Adam-Eve
 * Utilizzabile da entrambi i bot
 */

module.exports = {
    // 🔐 SICUREZZA
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || 'adam-eve-secret-2024',
    
    // 🌐 CONFIGURAZIONE NETWORK
    ADAM: {
        WEBHOOK_PORT: parseInt(process.env.ADAM_WEBHOOK_PORT) || 3001,
        EVE_URL: process.env.EVE_WEBHOOK_URL || 'http://localhost:3000/webhook/adam',
        BOT_USERNAME: process.env.ADAM_BOT_USERNAME || 'adam_bot'
    },
    
    EVE: {
        WEBHOOK_PORT: parseInt(process.env.EVE_WEBHOOK_PORT) || 3000,
        ADAM_URL: process.env.ADAM_WEBHOOK_URL || 'http://localhost:3001/webhook/eve',
        BOT_USERNAME: process.env.EVE_BOT_USERNAME || 'eve_bot'
    },
    
    // ⚙️ COMPORTAMENTO DIALOGO
    DIALOG: {
        // Probabilità e limiti
        MAX_EVE_HELP_PER_CHAT: parseInt(process.env.MAX_EVE_HELP_PER_CHAT) || 5,
        EVE_HELP_PROBABILITY: parseFloat(process.env.EVE_HELP_PROBABILITY) || 0.35,
        PUBLIC_CONVERSATION_CHANCE: parseFloat(process.env.PUBLIC_CONVERSATION_CHANCE) || 0.85,
        
        // Timing
        EVE_HELP_COOLDOWN_MS: parseInt(process.env.EVE_HELP_COOLDOWN_MS) || 120000, // 2 minuti
        CONVERSATION_TIMEOUT_MS: parseInt(process.env.CONVERSATION_TIMEOUT_MS) || 300000, // 5 minuti
        RESPONSE_DELAY_MIN: parseInt(process.env.RESPONSE_DELAY_MIN) || 2000, // 2 secondi
        RESPONSE_DELAY_MAX: parseInt(process.env.RESPONSE_DELAY_MAX) || 5000, // 5 secondi
        
        // Conversazione
        CONVERSATION_LENGTH: parseInt(process.env.CONVERSATION_LENGTH) || 3,
        MAX_MESSAGE_LENGTH: parseInt(process.env.MAX_MESSAGE_LENGTH) || 200,
        
        // Comportamento naturale
        NATURAL_PAUSES: process.env.NATURAL_PAUSES !== 'false',
        USE_EMOJIS: process.env.USE_EMOJIS !== 'false',
        TYPING_SIMULATION: process.env.TYPING_SIMULATION !== 'false'
    },
    
    // 📊 MONITORING E LOGGING
    MONITORING: {
        HEALTH_CHECK_INTERVAL: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000, // 30 secondi
        STATS_LOG_INTERVAL: parseInt(process.env.STATS_LOG_INTERVAL) || 300000, // 5 minuti
        CLEANUP_INTERVAL: parseInt(process.env.CLEANUP_INTERVAL) || 600000, // 10 minuti
        
        // Retention
        CONVERSATION_HISTORY_RETENTION: parseInt(process.env.CONVERSATION_HISTORY_RETENTION) || 3600000, // 1 ora
        STATS_RETENTION: parseInt(process.env.STATS_RETENTION) || 86400000 // 24 ore
    },
    
    // 🎭 PERSONALITÀ E STILE
    PERSONALITY: {
        ADAM: {
            CONFUSION_LEVELS: ['very_high', 'high', 'medium', 'normal', 'low'],
            DEFAULT_CONFUSION: 'normal',
            RESPONSE_STYLE: 'confused_but_enthusiastic'
        },
        EVE: {
            INTELLIGENCE_LEVEL: 'high',
            SARCASM_LEVEL: 'medium',
            PATIENCE_LEVEL: 'medium',
            RESPONSE_STYLE: 'intelligent_sarcastic'
        }
    },
    
    // 🔧 TECHNICAL SETTINGS
    TECHNICAL: {
        REQUEST_TIMEOUT: parseInt(process.env.REQUEST_TIMEOUT) || 15000, // 15 secondi
        MAX_RETRIES: parseInt(process.env.MAX_RETRIES) || 3,
        RETRY_DELAY: parseInt(process.env.RETRY_DELAY) || 1000, // 1 secondo
        
        // Body parsing
        MAX_BODY_SIZE: process.env.MAX_BODY_SIZE || '10mb',
        
        // Error handling
        LOG_ERRORS: process.env.LOG_ERRORS !== 'false',
        DETAILED_ERRORS: process.env.DETAILED_ERRORS === 'true'
    },
    
    // 🎯 KEYWORDS E TRIGGER
    TRIGGERS: {
        EVE_KEYWORDS: [
            'eve', 'aiuto', 'non capisco', 'confuso', 'help',
            'donna', 'consiglio', 'spiegami', 'cosa significa',
            'sbaglio', 'errore', 'correggimi', 'difficile',
            'complicato', 'non so come', 'puoi aiutarmi'
        ],
        
        CONFUSION_KEYWORDS: {
            very_high: ['non capisco niente', 'completamente confuso', 'aiuto!!!', '???'],
            high: ['non capisco', 'confused', 'help', 'cosa', 'boh', 'spiegami'],
            medium: ['difficile', 'complicato', 'non so', 'forse'],
            low: ['interessante', 'facile', 'ovvio']
        },
        
        EMOJI_MAP: {
            'sbagliato': '❌',
            'giusto': '✅', 
            'perfetto': '💯',
            'intelligente': '🧠',
            'stupido': '🤦‍♀️',
            'facile': '😊',
            'difficile': '😤',
            'aiuto': '🆘',
            'bravo': '👏',
            'confuso': '🤯',
            'amore': '❤️'
        }
    },
    
    // 📝 MESSAGGI TEMPLATE
    TEMPLATES: {
        ADAM_RESPONSES: {
            FIRST_REPLY: [
                `WOW EVE! Non avevo pensato a: "{message}" Il mio cervello ha fatto *BOOM*! 💥`,
                `Oh! Eve dice: "{message}" Ecco perché ero confuso! Grazie cara! ❤️`,
                `"{message}" - e il mio cervello ha fatto *click*! Come fai ad essere così intelligente? 💡`
            ],
            SECOND_REPLY: [
                `Esatto Eve! "{message}" ora tutto ha senso! Dovrei ascoltarti più spesso! 👂✨`,
                `Sì sì! "{message}" lo sapevo anch'io! (no, non lo sapevo) Ma ora sono un esperto! 😎`,
                `Perfetto! Tu dici: "{message}" e io aggiungo che... ehm... hai ragione tu! 😊`
            ],
            FINAL_REPLY: [
                `Grazie Eve! "{message}" è la ciliegina sulla torta! Siamo una squadra imbattibile! 💪✨`,
                `Ecco perché ti amo! "{message}" chiude perfettamente! Tu pensi, io... esisto! 😄💕`,
                `"{message}" - mic drop! 🎤⬇️ Eve ha parlato, io posso solo applaudire! 👏👏`
            ]
        },
        
        EVE_STARTERS: {
            very_high: [
                'Oh Adam, sei davvero molto confuso!',
                'Aspetta che ti spiego io tutto...',
                'Il tuo cervello ha fatto crash di nuovo?'
            ],
            high: [
                '🙄 Adam, ma davvero non capisci?',
                'Fermo, ci penso io a spiegare!',
                'Lascia fare alla donna intelligente!'
            ],
            normal: [
                'Posso aggiungere una cosa importante...',
                'Interessante Adam, però...',
                'Permettimi di precisare meglio...'
            ]
        }
    },
    
    // 🌍 ENVIRONMENT DETECTION
    isDevelopment: () => process.env.NODE_ENV === 'development',
    isProduction: () => process.env.NODE_ENV === 'production',
    
    // 🔍 HELPER FUNCTIONS
    getAdamWebhookUrl: () => {
        const host = process.env.ADAM_HOST || 'localhost';
        const port = process.env.ADAM_WEBHOOK_PORT || 3001;
        return `http://${host}:${port}/webhook/eve`;
    },
    
    getEveWebhookUrl: () => {
        const host = process.env.EVE_HOST || 'localhost';
        const port = process.env.EVE_WEBHOOK_PORT || 3000;
        return `http://${host}:${port}/webhook/adam`;
    },
    
    // 📊 VALIDATION
    validate: () => {
        const errors = [];
        
        if (!process.env.WEBHOOK_SECRET || process.env.WEBHOOK_SECRET.length < 10) {
            errors.push('WEBHOOK_SECRET deve essere almeno 10 caratteri');
        }
        
        if (isNaN(parseInt(process.env.ADAM_WEBHOOK_PORT))) {
            errors.push('ADAM_WEBHOOK_PORT deve essere un numero valido');
        }
        
        if (isNaN(parseInt(process.env.EVE_WEBHOOK_PORT))) {
            errors.push('EVE_WEBHOOK_PORT deve essere un numero valido');
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
};

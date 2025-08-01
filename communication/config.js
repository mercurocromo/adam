// file: communication/config.js
module.exports = {
    // 🔐 SICUREZZA
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || 'adam-eve-secret-2024',
    
    // 🌐 NETWORK
    ADAM: {
        WEBHOOK_PORT: parseInt(process.env.ADAM_WEBHOOK_PORT) || 3001,
        EVE_URL: process.env.EVE_WEBHOOK_URL || 'http://localhost:3000/webhook/adam'
    },
    
    EVE: {
        WEBHOOK_PORT: parseInt(process.env.EVE_WEBHOOK_PORT) || 3000,
        ADAM_URL: process.env.ADAM_WEBHOOK_URL || 'http://localhost:3001/webhook/eve'
    },
    
    // ⚙️ COMPORTAMENTO DIALOGO
    DIALOG: {
        MAX_EVE_HELP_PER_CHAT: 3,
        EVE_HELP_COOLDOWN_MS: 60000,        // 1 minuto
        EVE_HELP_PROBABILITY: 0.25,          // 25%
        CONVERSATION_TIMEOUT_MS: 300000,     // 5 minuti
        MAX_MESSAGE_LENGTH: 1000
    },
    
    // 📊 MONITORING
    HEALTH_CHECK_INTERVAL: 30000,           // 30 secondi
    STATS_LOG_INTERVAL: 300000              // 5 minuti
};

// file: communication/webhookService.js
const express = require('express');
const fetch = require('node-fetch');

class AdamWebhookService {
    constructor(config = {}) {
        this.config = {
            port: config.port || 3001,
            eveWebhookUrl: config.eveWebhookUrl || 'http://localhost:3000/webhook/adam',
            secret: config.secret || 'adam-eve-secret-2024',
            ...config
        };
        
        this.app = express();
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        
        this.callbacks = {
            onMessageFromEve: null,
            onError: null
        };
        
        this.();
        this.stats = {
            messagesSent: 0,
            messagesReceived: 0,
            errors: 0,
            lastActivity: null,
            uptime: Date.now()
        };
        
        this.server = null;
    }

    setupRoutes() {
        // 📥 ENDPOINT per ricevere messaggi da Eve
        this.app.post('/webhook/eve', (req, res) => {
            try {
                const { from, message, context, secret, messageType, timestamp } = req.body;
                console.log(`[ADAM DEBUG] Secret atteso: "${this.config.secret}"`);
                console.log(`[ADAM DEBUG] Secret ricevuto: "${secret}"`);
           
                // Verifica sicurezza
                if (secret !== this.config.secret) {
                    console.warn('🚫 [WEBHOOK] Tentativo accesso non autorizzato');
                    return res.status(401).json({ 
                        error: 'Unauthorized',
                        timestamp: Date.now() 
                    });
                }

                if (from === 'eve') {
                    console.log(`📥 [WEBHOOK] Ricevuto da Eve [${messageType}]:`, message);
                    this.stats.messagesReceived++;
                    this.stats.lastActivity = Date.now();
                    
                    // Chiama callback se configurato
                    if (this.callbacks.onMessageFromEve) {
                        setImmediate(() => {
                            this.callbacks.onMessageFromEve(message, context, messageType);
                        });
                    }
                    
                    res.json({ 
                        status: 'received', 
                        timestamp: Date.now(),
                        adamStatus: 'confused_but_happy',
                        processed: true
                    });
                } else {
                    res.status(400).json({ 
                        error: 'Invalid sender',
                        expected: 'eve',
                        received: from 
                    });
                }
            } catch (error) {
                console.error('❌ [WEBHOOK] Errore processing message:', error);
                this.stats.errors++;
                
                if (this.callbacks.onError) {
                    this.callbacks.onError(error, 'receive_from_eve');
                }
                
                res.status(500).json({ 
                    error: 'Processing error',
                    message: error.message 
                });
            }
        });

        // 📊 ENDPOINT status dettagliato
        this.app.get('/status', (req, res) => {
            res.json({
                service: 'Adam Webhook Service',
                status: 'online',
                version: '1.0.0',
                uptime: Date.now() - this.stats.uptime,
                stats: {
                    ...this.stats,
                    uptimeFormatted: this.formatUptime(Date.now() - this.stats.uptime)
                },
                config: {
                    port: this.config.port,
                    eveConnected: !!this.config.eveWebhookUrl,
                    eveUrl: this.config.eveWebhookUrl
                },
                endpoints: [
                    'POST /webhook/eve - Riceve messaggi da Eve',
                    'GET /status - Stato servizio',
                    'GET /health - Health check'
                ]
            });
        });

        // ❤️ ENDPOINT health check
        this.app.get('/health', (req, res) => {
            const isHealthy = (Date.now() - this.stats.uptime) > 0;
            res.status(isHealthy ? 200 : 503).json({ 
                status: isHealthy ? 'ok' : 'error',
                service: 'adam-webhook',
                timestamp: Date.now()
            });
        });

        // 🔧 ENDPOINT test connettività
        this.app.get('/test-eve', async (req, res) => {
            try {
                const testMessage = 'Health check from Adam';
                const result = await this.sendToEve(testMessage, { test: true }, 'health_check');
                
                res.json({
                    status: 'success',
                    message: 'Connessione con Eve OK',
                    result: result
                });
            } catch (error) {
                res.status(500).json({
                    status: 'error',
                    message: 'Errore connessione con Eve',
                    error: error.message
                });
            }
        });
    }

    // 📤 INVIO MESSAGGIO A EVE
    async sendToEve(message, context = {}, messageType = 'chat') {
        try {
            const payload = {
                from: 'adam',
                message: message,
                context: {
                    adamConfusionLevel: this.calculateConfusionLevel(message),
                    timestamp: Date.now(),
                    adamVersion: '1.0.0',
                    ...context
                },
                messageType: messageType,
                secret: this.config.secret,
                timestamp: Date.now()
            };

            console.log(`📤 [WEBHOOK] Inviando a Eve [${messageType}]:`, message);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(this.config.eveWebhookUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'User-Agent': 'Adam-Bot-Webhook/1.0',
                    'X-Request-ID': `adam-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
                },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            this.stats.messagesSent++;
            this.stats.lastActivity = Date.now();
            
            console.log('✅ [WEBHOOK] Risposta da Eve ricevuta');
            return result;

        } catch (error) {
            console.error('❌ [WEBHOOK] Errore invio a Eve:', error.message);
            this.stats.errors++;
            
            if (this.callbacks.onError) {
                this.callbacks.onError(error, 'send_to_eve');
            }
            
            throw error; // Re-throw per permettere gestione upstream
        }
    }

    // 🧠 CALCOLO LIVELLO CONFUSIONE DI ADAM
    calculateConfusionLevel(message) {
        const confusionKeywords = {
            very_high: ['non capisco niente', 'completamente confuso', 'aiuto!!!', '???'],
            high: ['non capisco', 'confused', 'help', 'cosa', 'boh', 'spiegami'],
            medium: ['difficile', 'complicato', 'non so', 'forse'],
            low: ['interessante', 'facile', 'ovvio']
        };
        
        const lowerMessage = message.toLowerCase();
        
        for (const [level, keywords] of Object.entries(confusionKeywords)) {
            if (keywords.some(keyword => lowerMessage.includes(keyword))) {
                return level;
            }
        }
        
        // Calcolo basato su lunghezza e complessità
        if (message.length > 100) return 'medium';
        if (message.includes('?')) return 'medium';
        
        return 'normal';
    }

    // ⚙️ CONFIGURAZIONE CALLBACKS
    onMessageFromEve(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback deve essere una funzione');
        }
        this.callbacks.onMessageFromEve = callback;
        console.log('📋 [WEBHOOK] Callback messaggio da Eve configurato');
    }

    onError(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback deve essere una funzione');
        }
        this.callbacks.onError = callback;
        console.log('📋 [WEBHOOK] Callback errore configurato');
    }

    // 🚀 AVVIO SERVIZIO
    async start() {
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(this.config.port, () => {
                    console.log(`🔗 [WEBHOOK] Adam Webhook Service avviato su porta ${this.config.port}`);
                    console.log(`📡 [WEBHOOK] Connesso a Eve: ${this.config.eveWebhookUrl}`);
                    console.log(`🔐 [WEBHOOK] Secret configurato: ${this.config.secret.substring(0, 10)}...`);
                    resolve();
                });

                this.server.on('error', (error) => {
                    console.error('❌ [WEBHOOK] Errore server:', error);
                    reject(error);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    // 🛑 STOP SERVIZIO
    async stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log('🛑 [WEBHOOK] Adam Webhook Service fermato');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    // 📊 GET STATS
    getStats() {
        return { 
            ...this.stats,
            uptime: Date.now() - this.stats.uptime,
            uptimeFormatted: this.formatUptime(Date.now() - this.stats.uptime)
        };
    }

    // 🕐 FORMAT UPTIME
    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    // 🔍 VERIFICA STATO
    isHealthy() {
        return this.server && this.server.listening;
    }
}

module.exports = { AdamWebhookService };

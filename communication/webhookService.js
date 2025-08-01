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
        this.app.use(express.json());
        this.callbacks = {
            onMessageFromEve: null,
            onError: null
        };
        
        this.setupRoutes();
        this.stats = {
            messagesSent: 0,
            messagesReceived: 0,
            errors: 0,
            lastActivity: null
        };
    }

    setupRoutes() {
        // 📥 ENDPOINT per ricevere messaggi da Eve
        this.app.post('/webhook/eve', (req, res) => {
            try {
                const { from, message, context, secret, messageType } = req.body;
                
                // Verifica sicurezza
                if (secret !== this.config.secret) {
                    console.warn('🚫 Tentativo accesso webhook non autorizzato');
                    return res.status(401).json({ error: 'Unauthorized' });
                }

                if (from === 'eve') {
                    console.log('📥 [WEBHOOK] Ricevuto da Eve:', message);
                    this.stats.messagesReceived++;
                    this.stats.lastActivity = Date.now();
                    
                    // Chiama callback se configurato
                    if (this.callbacks.onMessageFromEve) {
                        this.callbacks.onMessageFromEve(message, context, messageType);
                    }
                    
                    res.json({ 
                        status: 'received', 
                        timestamp: Date.now(),
                        adamStatus: 'confused_but_happy'
                    });
                } else {
                    res.status(400).json({ error: 'Invalid sender' });
                }
            } catch (error) {
                console.error('❌ [WEBHOOK] Errore processing message:', error);
                this.stats.errors++;
                res.status(500).json({ error: 'Processing error' });
            }
        });

        // 📊 ENDPOINT status (utile per debug)
        this.app.get('/status', (req, res) => {
            res.json({
                service: 'Adam Webhook Service',
                status: 'online',
                stats: this.stats,
                config: {
                    port: this.config.port,
                    eveConnected: !!this.config.eveWebhookUrl
                }
            });
        });

        // ❤️ ENDPOINT health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', service: 'adam-webhook' });
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
                    ...context
                },
                messageType: messageType,
                secret: this.config.secret
            };

            console.log('📤 [WEBHOOK] Inviando a Eve:', message);
            
            const response = await fetch(this.config.eveWebhookUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'User-Agent': 'Adam-Bot-Webhook/1.0'
                },
                body: JSON.stringify(payload),
                timeout: 10000
            });

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
            
            return null;
        }
    }

    // 🧠 CALCOLO LIVELLO CONFUSIONE DI ADAM
    calculateConfusionLevel(message) {
        const confusionKeywords = ['non capisco', 'confused', 'help', 'cosa', 'boh', '???'];
        const confusionCount = confusionKeywords.filter(k => 
            message.toLowerCase().includes(k)
        ).length;
        
        if (confusionCount >= 2) return 'very_high';
        if (confusionCount === 1) return 'high';
        return 'normal';
    }

    // ⚙️ CONFIGURAZIONE CALLBACKS
    onMessageFromEve(callback) {
        this.callbacks.onMessageFromEve = callback;
    }

    onError(callback) {
        this.callbacks.onError = callback;
    }

    // 🚀 AVVIO SERVIZIO
    start() {
        return new Promise((resolve, reject) => {
            try {
                this.server = this.app.listen(this.config.port, () => {
                    console.log(`🔗 [WEBHOOK] Adam Webhook Service avviato su porta ${this.config.port}`);
                    console.log(`📡 [WEBHOOK] Connesso a Eve: ${this.config.eveWebhookUrl}`);
                    resolve();
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    // 🛑 STOP SERVIZIO
    stop() {
        if (this.server) {
            this.server.close();
            console.log('🛑 [WEBHOOK] Adam Webhook Service fermato');
        }
    }

    // 📊 GET STATS
    getStats() {
        return { ...this.stats };
    }
}

module.exports = { AdamWebhookService };

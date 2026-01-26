/**
 * Claude API İstemcisi
 * Anthropic Claude API ile iletişim kurar
 */

const Anthropic = require('@anthropic-ai/sdk');
const Store = require('electron-store');

const store = new Store({
    encryptionKey: 'eczaplus-agent-encryption-key-2024'
});

// API key storage key
const API_KEY_STORAGE = 'claude_api_key';

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 saniye minimum aralık

// Request sayacı (rate limiting için)
let requestCount = 0;
let requestCountResetTime = Date.now();
const MAX_REQUESTS_PER_MINUTE = 30;

/**
 * API anahtarını ayarla
 * @param {string} apiKey - Claude API anahtarı
 */
function setApiKey(apiKey) {
    store.set(API_KEY_STORAGE, apiKey);
}

/**
 * API anahtarını getir
 * @returns {string|null}
 */
function getApiKey() {
    return store.get(API_KEY_STORAGE) || process.env.ANTHROPIC_API_KEY || null;
}

/**
 * API anahtarının ayarlanıp ayarlanmadığını kontrol et
 * @returns {boolean}
 */
function hasApiKey() {
    return !!getApiKey();
}

/**
 * API anahtarını kaldır
 */
function removeApiKey() {
    store.delete(API_KEY_STORAGE);
}

/**
 * Anthropic client oluştur
 * @returns {Anthropic|null}
 */
function createClient() {
    const apiKey = getApiKey();
    if (!apiKey) {
        return null;
    }

    return new Anthropic({
        apiKey: apiKey
    });
}

/**
 * Rate limiting kontrolü
 * @returns {Promise<void>}
 */
async function checkRateLimit() {
    const now = Date.now();

    // Dakikalık sayacı sıfırla
    if (now - requestCountResetTime > 60000) {
        requestCount = 0;
        requestCountResetTime = now;
    }

    // Dakikalık limit kontrolü
    if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
        const waitTime = 60000 - (now - requestCountResetTime);
        throw new Error(`Rate limit aşıldı. ${Math.ceil(waitTime / 1000)} saniye bekleyin.`);
    }

    // Minimum aralık kontrolü
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        await new Promise(resolve =>
            setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
        );
    }

    lastRequestTime = Date.now();
    requestCount++;
}

/**
 * Claude'a mesaj gönder
 * @param {Object} options - İstek seçenekleri
 * @returns {Promise<Object>}
 */
async function sendMessage(options) {
    const client = createClient();
    if (!client) {
        throw new Error('Claude API anahtarı ayarlanmamış. Ayarlar panelinden API anahtarını girin.');
    }

    await checkRateLimit();

    const {
        messages,
        system,
        tools,
        maxTokens = 4096,
        temperature = 0.7
    } = options;

    try {
        const requestParams = {
            model: 'claude-sonnet-4-20250514',
            max_tokens: maxTokens,
            messages: messages
        };

        if (system) {
            requestParams.system = system;
        }

        if (tools && tools.length > 0) {
            requestParams.tools = tools;
        }

        if (temperature !== undefined) {
            requestParams.temperature = temperature;
        }

        const response = await client.messages.create(requestParams);

        return {
            success: true,
            content: response.content,
            stopReason: response.stop_reason,
            usage: response.usage,
            model: response.model
        };
    } catch (err) {
        console.error('[ClaudeClient] API hatası:', err);

        // Hata tipine göre mesaj
        let errorMessage = err.message;
        if (err.status === 401) {
            errorMessage = 'Geçersiz API anahtarı. Lütfen API anahtarınızı kontrol edin.';
        } else if (err.status === 429) {
            errorMessage = 'API rate limit aşıldı. Lütfen biraz bekleyin.';
        } else if (err.status === 500) {
            errorMessage = 'Claude API sunucu hatası. Lütfen daha sonra tekrar deneyin.';
        }

        return {
            success: false,
            error: errorMessage,
            errorCode: err.status
        };
    }
}

/**
 * Tool kullanarak mesaj gönder ve yanıtı işle
 * @param {Object} options - İstek seçenekleri
 * @param {Function} toolHandler - Tool çağrılarını işleyen fonksiyon
 * @returns {Promise<Object>}
 */
async function sendMessageWithTools(options, toolHandler) {
    const maxIterations = 10;
    let iteration = 0;
    let messages = [...options.messages];
    let finalResponse = null;

    while (iteration < maxIterations) {
        iteration++;

        const response = await sendMessage({
            ...options,
            messages
        });

        if (!response.success) {
            return response;
        }

        // Tool çağrısı var mı kontrol et
        const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');

        if (toolUseBlocks.length === 0) {
            // Tool çağrısı yok, son yanıt
            finalResponse = response;
            break;
        }

        // Tool çağrılarını işle
        const toolResults = [];
        for (const toolUse of toolUseBlocks) {
            const result = await toolHandler(toolUse.name, toolUse.input);
            toolResults.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: typeof result === 'string' ? result : JSON.stringify(result)
            });
        }

        // Mesajları güncelle
        messages.push({
            role: 'assistant',
            content: response.content
        });
        messages.push({
            role: 'user',
            content: toolResults
        });
    }

    return finalResponse || { success: false, error: 'Maksimum iterasyon sayısına ulaşıldı' };
}

/**
 * API durumunu kontrol et
 * @returns {Promise<Object>}
 */
async function checkApiStatus() {
    if (!hasApiKey()) {
        return {
            status: 'not_configured',
            message: 'API anahtarı ayarlanmamış'
        };
    }

    try {
        // Basit bir test isteği
        const response = await sendMessage({
            messages: [{ role: 'user', content: 'Merhaba' }],
            maxTokens: 10
        });

        if (response.success) {
            return {
                status: 'active',
                message: 'API bağlantısı aktif',
                model: response.model
            };
        } else {
            return {
                status: 'error',
                message: response.error
            };
        }
    } catch (err) {
        return {
            status: 'error',
            message: err.message
        };
    }
}

/**
 * Kullanım istatistiklerini getir
 * @returns {Object}
 */
function getUsageStats() {
    return {
        requestCount,
        requestCountResetTime,
        lastRequestTime,
        remainingRequests: MAX_REQUESTS_PER_MINUTE - requestCount
    };
}

module.exports = {
    setApiKey,
    getApiKey,
    hasApiKey,
    removeApiKey,
    sendMessage,
    sendMessageWithTools,
    checkApiStatus,
    getUsageStats
};

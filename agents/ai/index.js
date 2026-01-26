/**
 * AI Agent Ana Modülü
 * Claude tabanlı AI asistan yönetimi
 */

const claudeClient = require('./claudeClient');
const queryProcessor = require('./queryProcessor');
const agentLogs = require('../database/agentLogs');
const notifications = require('../notifications');

/**
 * AI Agent durumu
 */
let isInitialized = false;

/**
 * AI Agent'ı başlat
 * @returns {Promise<Object>}
 */
async function initialize() {
    console.log('[AI Agent] Başlatılıyor...');

    const status = await claudeClient.checkApiStatus();

    isInitialized = true;

    if (status.status === 'active') {
        console.log('[AI Agent] API bağlantısı aktif');
    } else if (status.status === 'not_configured') {
        console.log('[AI Agent] API anahtarı ayarlanmamış');
    } else {
        console.warn('[AI Agent] API bağlantı hatası:', status.message);
    }

    return status;
}

/**
 * Sorgu gönder
 * @param {string} query - Kullanıcı sorgusu
 * @param {Object} options - Ek seçenekler
 * @returns {Promise<Object>}
 */
async function query(query, options = {}) {
    const userId = options.userId || null;
    const conversationId = options.conversationId || 'default';

    // Log kaydı oluştur
    const log = await agentLogs.createLog({
        agentType: 'ai',
        taskName: 'query',
        metadata: {
            triggeredBy: 'user',
            userId: userId,
            query: query.substring(0, 200) // İlk 200 karakter
        }
    });

    try {
        // Sorguyu işle
        const result = await queryProcessor.processQueryWithContext(conversationId, query);

        // Log'u tamamla
        await agentLogs.completeLog(log._id, {
            success: result.success,
            type: result.type,
            usage: result.usage
        });

        // Bildirim
        if (result.success) {
            notifications.aiQueryResult(query, true);
        }

        return result;
    } catch (err) {
        // Log'u başarısız olarak işaretle
        await agentLogs.failLog(log._id, err);

        notifications.aiQueryResult(query, false);

        return {
            success: false,
            error: err.message,
            type: 'error'
        };
    }
}

/**
 * Basit sorgu (bağlam olmadan)
 * @param {string} queryText - Sorgu metni
 * @returns {Promise<Object>}
 */
async function simpleQuery(queryText) {
    return queryProcessor.processQuery(queryText);
}

/**
 * Konuşma geçmişini temizle
 * @param {string} conversationId - Konuşma ID
 */
function clearConversation(conversationId = 'default') {
    queryProcessor.conversationManager.clearConversation(conversationId);
}

/**
 * API anahtarını ayarla
 * @param {string} apiKey - Claude API anahtarı
 * @returns {Promise<Object>}
 */
async function setApiKey(apiKey) {
    claudeClient.setApiKey(apiKey);
    return claudeClient.checkApiStatus();
}

/**
 * API durumunu kontrol et
 * @returns {Promise<Object>}
 */
async function checkApiStatus() {
    return claudeClient.checkApiStatus();
}

/**
 * API anahtarının ayarlı olup olmadığını kontrol et
 * @returns {boolean}
 */
function hasApiKey() {
    return claudeClient.hasApiKey();
}

/**
 * AI Agent durumunu getir
 * @returns {Promise<Object>}
 */
async function getStatus() {
    const apiStatus = await claudeClient.checkApiStatus();
    const usageStats = claudeClient.getUsageStats();

    return {
        isInitialized,
        api: apiStatus,
        usage: usageStats,
        suggestedQueries: queryProcessor.suggestedQueries
    };
}

/**
 * Önerilen sorguları getir
 * @returns {Array}
 */
function getSuggestedQueries() {
    return queryProcessor.suggestedQueries;
}

/**
 * Satış analizi yap
 * @param {Object} options - Analiz seçenekleri
 * @returns {Promise<Object>}
 */
async function analyzeSales(options = {}) {
    const period = options.period || 'week';
    const query = period === 'month'
        ? 'Son 30 günün satış performansını analiz et. Trendleri, en çok satanları ve önerileri belirt.'
        : 'Son 7 günün satış performansını analiz et. Günlük değişimleri ve trendleri incele.';

    return simpleQuery(query);
}

/**
 * Stok analizi yap
 * @returns {Promise<Object>}
 */
async function analyzeStock() {
    const query = 'Stok durumunu analiz et. Kritik seviyedeki ürünleri, fazla stoğu olan ürünleri ve sipariş önerilerini listele.';
    return simpleQuery(query);
}

/**
 * Anomali tespiti yap
 * @returns {Promise<Object>}
 */
async function detectAnomalies() {
    const query = 'Son 7 gündeki satış verilerinde olağandışı durumları tespit et. Ani artış/düşüşleri, sıradışı iadeleri veya şüpheli aktiviteleri belirt.';
    return simpleQuery(query);
}

/**
 * Ürün önerisi al
 * @param {string} productName - Ürün adı
 * @returns {Promise<Object>}
 */
async function getProductRecommendation(productName) {
    const query = `"${productName}" ürünü için stok ve fiyat önerisi ver. Satış geçmişini, mevcut stoğu ve benzer ürünleri dikkate al.`;
    return simpleQuery(query);
}

module.exports = {
    initialize,
    query,
    simpleQuery,
    clearConversation,
    setApiKey,
    checkApiStatus,
    hasApiKey,
    getStatus,
    getSuggestedQueries,
    analyzeSales,
    analyzeStock,
    detectAnomalies,
    getProductRecommendation
};

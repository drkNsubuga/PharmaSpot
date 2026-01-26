/**
 * Doğal Dil Sorgu İşleyici
 * Kullanıcı sorgularını işler ve Claude'a iletir
 */

const claudeClient = require('./claudeClient');
const databaseQuery = require('./tools/databaseQuery');

/**
 * Sistem promptu
 */
const SYSTEM_PROMPT = `Sen bir eczane POS sistemi asistanısın. Kullanıcıların sorularını yanıtla ve veritabanı sorgularını yap.

Görevlerin:
1. Satış ve envanter verilerini analiz et
2. Stok durumu hakkında bilgi ver
3. Satış trendlerini yorumla
4. İş önerileri sun
5. Raporlar oluştur

Veritabanı yapısı:
- inventory: Ürün envanteri (name, barcode, quantity, salePrice, costPrice, category, expiryDate, minStock)
- transactions: Satış işlemleri (date, total, products, paymentMethod, customerId, status)
- customers: Müşteriler (name, phone, email, totalPurchases)
- categories: Kategoriler (name, description)
- drugs: İlaç referans veritabanı (name, barcode, manufacturer, atcCode, perakendeSatisFiyati)

Kurallar:
- Türkçe yanıt ver
- Sayısal verileri ₺ formatında göster
- Tarihleri Türkçe formatında göster (GG.AA.YYYY)
- Önemli bulguları vurgula
- Somut öneriler sun
- Veri yoksa bunu nazikçe belirt`;

/**
 * Hızlı sorgu şablonları (Claude'a gitmeden önce kontrol edilir)
 */
const quickQueryPatterns = [
    {
        patterns: [/en çok satan/i, /top.*selling/i, /popüler ürün/i],
        handler: async (query) => {
            const match = query.match(/(\d+)/);
            const limit = match ? parseInt(match[1]) : 10;
            return databaseQuery.quickQueries.topSellingProducts(limit);
        }
    },
    {
        patterns: [/düşük stok/i, /low stock/i, /stok.*az/i, /kritik stok/i],
        handler: async (query) => {
            const match = query.match(/(\d+)/);
            const threshold = match ? parseInt(match[1]) : 10;
            return databaseQuery.quickQueries.lowStockProducts(threshold);
        }
    },
    {
        patterns: [/bugünkü satış/i, /günlük satış/i, /today.*sales/i],
        handler: async () => {
            return databaseQuery.quickQueries.dailySalesSummary();
        }
    },
    {
        patterns: [/miad.*yaklaş/i, /expire/i, /son kullanma/i, /süresi dol/i],
        handler: async (query) => {
            const match = query.match(/(\d+)/);
            const days = match ? parseInt(match[1]) : 30;
            return databaseQuery.quickQueries.expiringProducts(days);
        }
    }
];

/**
 * Sorguyu işle
 * @param {string} query - Kullanıcı sorgusu
 * @param {Object} options - Ek seçenekler
 * @returns {Promise<Object>}
 */
async function processQuery(query, options = {}) {
    // Önce hızlı sorgu şablonlarını kontrol et
    for (const { patterns, handler } of quickQueryPatterns) {
        for (const pattern of patterns) {
            if (pattern.test(query)) {
                try {
                    const result = await handler(query);
                    return {
                        success: true,
                        type: 'quick_query',
                        query: query,
                        result: result,
                        message: formatQuickQueryResult(result)
                    };
                } catch (err) {
                    // Hızlı sorgu başarısız olursa Claude'a devam et
                    console.log('[QueryProcessor] Hızlı sorgu hatası, Claude\'a yönlendiriliyor:', err.message);
                    break;
                }
            }
        }
    }

    // Claude API ile işle
    return processWithClaude(query, options);
}

/**
 * Claude ile sorgu işle
 * @param {string} query - Kullanıcı sorgusu
 * @param {Object} options - Ek seçenekler
 * @returns {Promise<Object>}
 */
async function processWithClaude(query, options = {}) {
    // API key kontrolü
    if (!claudeClient.hasApiKey()) {
        return {
            success: false,
            error: 'Claude API anahtarı ayarlanmamış. Ayarlar panelinden API anahtarını girin.',
            type: 'config_error'
        };
    }

    const messages = [
        { role: 'user', content: query }
    ];

    // Önceki mesajları ekle (bağlam için)
    if (options.previousMessages && Array.isArray(options.previousMessages)) {
        messages.unshift(...options.previousMessages);
    }

    try {
        const response = await claudeClient.sendMessageWithTools(
            {
                messages,
                system: SYSTEM_PROMPT,
                tools: [databaseQuery.toolDefinition],
                maxTokens: options.maxTokens || 4096,
                temperature: 0.7
            },
            handleToolCall
        );

        if (!response.success) {
            return {
                success: false,
                error: response.error,
                type: 'api_error'
            };
        }

        // Yanıtı çıkar
        const textContent = response.content.find(c => c.type === 'text');
        const message = textContent ? textContent.text : 'Yanıt alınamadı.';

        return {
            success: true,
            type: 'ai_response',
            query: query,
            message: message,
            usage: response.usage
        };
    } catch (err) {
        console.error('[QueryProcessor] Claude hatası:', err);
        return {
            success: false,
            error: err.message,
            type: 'error'
        };
    }
}

/**
 * Tool çağrısını işle
 * @param {string} toolName - Tool adı
 * @param {Object} toolInput - Tool girişi
 * @returns {Promise<string>}
 */
async function handleToolCall(toolName, toolInput) {
    console.log(`[QueryProcessor] Tool çağrısı: ${toolName}`, toolInput);

    switch (toolName) {
        case 'database_query':
            const result = await databaseQuery.execute(toolInput);
            return JSON.stringify(result);

        default:
            return JSON.stringify({ error: `Bilinmeyen tool: ${toolName}` });
    }
}

/**
 * Hızlı sorgu sonucunu formatla
 * @param {Object} result - Sorgu sonucu
 * @returns {string}
 */
function formatQuickQueryResult(result) {
    if (!result.success) {
        return result.error || 'Sorgu işlenirken bir hata oluştu.';
    }

    if (result.data && Array.isArray(result.data)) {
        if (result.data.length === 0) {
            return 'Sonuç bulunamadı.';
        }

        // Basit tablo formatı
        const items = result.data.slice(0, 10);
        let message = `Toplam ${result.count || items.length} sonuç bulundu:\n\n`;

        items.forEach((item, index) => {
            message += `${index + 1}. ${item.name || item._id}`;
            if (item.quantity !== undefined) message += ` - Stok: ${item.quantity}`;
            if (item.revenue !== undefined) message += ` - Ciro: ₺${item.revenue.toLocaleString('tr-TR')}`;
            if (item.salePrice !== undefined) message += ` - Fiyat: ₺${item.salePrice.toLocaleString('tr-TR')}`;
            if (item.daysUntilExpiry !== undefined) message += ` - ${item.daysUntilExpiry} gün kaldı`;
            message += '\n';
        });

        return message;
    }

    if (result.data && typeof result.data === 'object') {
        // Özet formatı
        let message = '';
        Object.entries(result.data).forEach(([key, value]) => {
            const formattedKey = key.replace(/([A-Z])/g, ' $1').trim();
            message += `${formattedKey}: ${typeof value === 'number' ? value.toLocaleString('tr-TR') : value}\n`;
        });
        return message;
    }

    return 'Sonuç işlendi.';
}

/**
 * Önerilen sorgular
 */
const suggestedQueries = [
    'Bu ay en çok satan 10 ürün nedir?',
    'Stok seviyesi kritik olan ürünler hangileri?',
    'Bugünkü toplam satış tutarı nedir?',
    'Son 7 günün satış trendi nasıl?',
    'Hangi kategoriler en çok satıyor?',
    'Son kullanma tarihi yaklaşan ilaçlar hangileri?',
    'Ortalama sepet tutarı nedir?',
    'En karlı 5 ürün hangisi?'
];

/**
 * Konuşma geçmişi yönetimi
 */
class ConversationManager {
    constructor() {
        this.conversations = new Map();
        this.maxHistoryLength = 10;
    }

    /**
     * Konuşma geçmişini getir
     * @param {string} conversationId - Konuşma ID
     * @returns {Array}
     */
    getHistory(conversationId) {
        return this.conversations.get(conversationId) || [];
    }

    /**
     * Mesaj ekle
     * @param {string} conversationId - Konuşma ID
     * @param {string} role - Rol ('user' veya 'assistant')
     * @param {string} content - İçerik
     */
    addMessage(conversationId, role, content) {
        if (!this.conversations.has(conversationId)) {
            this.conversations.set(conversationId, []);
        }

        const history = this.conversations.get(conversationId);
        history.push({ role, content });

        // Geçmiş uzunluğunu sınırla
        if (history.length > this.maxHistoryLength * 2) {
            history.splice(0, 2);
        }
    }

    /**
     * Konuşmayı temizle
     * @param {string} conversationId - Konuşma ID
     */
    clearConversation(conversationId) {
        this.conversations.delete(conversationId);
    }

    /**
     * Tüm konuşmaları temizle
     */
    clearAll() {
        this.conversations.clear();
    }
}

const conversationManager = new ConversationManager();

/**
 * Konuşma bağlamı ile sorgu işle
 * @param {string} conversationId - Konuşma ID
 * @param {string} query - Kullanıcı sorgusu
 * @returns {Promise<Object>}
 */
async function processQueryWithContext(conversationId, query) {
    const previousMessages = conversationManager.getHistory(conversationId);

    const result = await processQuery(query, { previousMessages });

    if (result.success) {
        conversationManager.addMessage(conversationId, 'user', query);
        conversationManager.addMessage(conversationId, 'assistant', result.message);
    }

    return result;
}

module.exports = {
    processQuery,
    processWithClaude,
    suggestedQueries,
    conversationManager,
    processQueryWithContext
};

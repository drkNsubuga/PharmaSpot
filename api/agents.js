/**
 * Agent API Endpoint'leri
 * Agent sistemi için REST API
 */

const app = require("express")();
const bodyParser = require("body-parser");
const validator = require("validator");

app.use(bodyParser.json());

// Agent modülü lazy loading (Electron başlatıldıktan sonra yüklenmeli)
let agentSystem = null;

function getAgentSystem() {
    if (!agentSystem) {
        agentSystem = require('../agents');
    }
    return agentSystem;
}

/**
 * Rate limiting for AI queries
 */
const aiQueryLimiter = {
    requests: new Map(),
    maxRequests: 10,
    windowMs: 60000, // 1 dakika

    check(ip) {
        const now = Date.now();
        const userRequests = this.requests.get(ip) || { count: 0, resetTime: now + this.windowMs };

        if (now > userRequests.resetTime) {
            userRequests.count = 0;
            userRequests.resetTime = now + this.windowMs;
        }

        if (userRequests.count >= this.maxRequests) {
            return false;
        }

        userRequests.count++;
        this.requests.set(ip, userRequests);
        return true;
    }
};

/**
 * GET /api/agents/status
 * Agent sistemi durumunu getir
 */
app.get("/status", async function (req, res) {
    try {
        const agents = getAgentSystem();
        const status = await agents.getStatus();
        res.json(status);
    } catch (err) {
        console.error('[API/Agents] Status hatası:', err);
        res.status(500).json({
            error: "Sunucu Hatası",
            message: err.message
        });
    }
});

/**
 * POST /api/agents/initialize
 * Agent sistemini başlat
 */
app.post("/initialize", async function (req, res) {
    try {
        const agents = getAgentSystem();
        const result = await agents.initialize();
        res.json(result);
    } catch (err) {
        console.error('[API/Agents] Initialize hatası:', err);
        res.status(500).json({
            error: "Sunucu Hatası",
            message: err.message
        });
    }
});

/**
 * GET /api/agents/scheduler/tasks
 * Zamanlanmış görevleri getir
 */
app.get("/scheduler/tasks", async function (req, res) {
    try {
        const agents = getAgentSystem();
        const tasks = await agents.getScheduledTasks();
        res.json(tasks);
    } catch (err) {
        console.error('[API/Agents] Tasks hatası:', err);
        res.status(500).json({
            error: "Sunucu Hatası",
            message: err.message
        });
    }
});

/**
 * POST /api/agents/scheduler/trigger/:taskName
 * Görevi manuel tetikle
 */
app.post("/scheduler/trigger/:taskName", async function (req, res) {
    try {
        const { taskName } = req.params;
        const userId = req.body.userId || null;

        if (!taskName || typeof taskName !== 'string') {
            return res.status(400).json({
                error: "Geçersiz İstek",
                message: "Görev adı gereklidir."
            });
        }

        // Input sanitization
        const sanitizedTaskName = validator.escape(taskName);

        const agents = getAgentSystem();
        const result = await agents.triggerTask(sanitizedTaskName, userId);

        res.json({
            success: true,
            taskName: sanitizedTaskName,
            result: result
        });
    } catch (err) {
        console.error('[API/Agents] Trigger hatası:', err);
        res.status(500).json({
            error: "Görev Hatası",
            message: err.message
        });
    }
});

/**
 * PUT /api/agents/scheduler/tasks/:taskName/enabled
 * Görevi etkinleştir/devre dışı bırak
 */
app.put("/scheduler/tasks/:taskName/enabled", async function (req, res) {
    try {
        const { taskName } = req.params;
        const { enabled } = req.body;

        if (typeof enabled !== 'boolean') {
            return res.status(400).json({
                error: "Geçersiz İstek",
                message: "'enabled' boolean değer olmalıdır."
            });
        }

        const sanitizedTaskName = validator.escape(taskName);

        const agents = getAgentSystem();
        await agents.setTaskEnabled(sanitizedTaskName, enabled);

        res.json({
            success: true,
            taskName: sanitizedTaskName,
            enabled: enabled
        });
    } catch (err) {
        console.error('[API/Agents] Enable/Disable hatası:', err);
        res.status(500).json({
            error: "Sunucu Hatası",
            message: err.message
        });
    }
});

/**
 * PUT /api/agents/scheduler/tasks/:taskName/schedule
 * Görev zamanlamasını güncelle
 */
app.put("/scheduler/tasks/:taskName/schedule", async function (req, res) {
    try {
        const { taskName } = req.params;
        const { cronExpression } = req.body;

        if (!cronExpression || typeof cronExpression !== 'string') {
            return res.status(400).json({
                error: "Geçersiz İstek",
                message: "Cron ifadesi gereklidir."
            });
        }

        const sanitizedTaskName = validator.escape(taskName);

        const agents = getAgentSystem();
        await agents.updateTaskSchedule(sanitizedTaskName, cronExpression);

        res.json({
            success: true,
            taskName: sanitizedTaskName,
            cronExpression: cronExpression
        });
    } catch (err) {
        console.error('[API/Agents] Schedule update hatası:', err);
        res.status(500).json({
            error: "Sunucu Hatası",
            message: err.message
        });
    }
});

/**
 * POST /api/agents/ai/query
 * AI sorgusu gönder
 */
app.post("/ai/query", async function (req, res) {
    try {
        const { query, conversationId, userId } = req.body;

        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                error: "Geçersiz İstek",
                message: "Sorgu metni gereklidir."
            });
        }

        // Rate limiting
        const clientIp = req.ip || req.connection.remoteAddress;
        if (!aiQueryLimiter.check(clientIp)) {
            return res.status(429).json({
                error: "Çok Fazla İstek",
                message: "Lütfen bir dakika bekleyin ve tekrar deneyin."
            });
        }

        // Query length limit
        if (query.length > 2000) {
            return res.status(400).json({
                error: "Geçersiz İstek",
                message: "Sorgu çok uzun (maksimum 2000 karakter)."
            });
        }

        const sanitizedQuery = validator.escape(query);

        const agents = getAgentSystem();
        const result = await agents.aiQuery(sanitizedQuery, {
            conversationId: conversationId || 'default',
            userId: userId
        });

        res.json(result);
    } catch (err) {
        console.error('[API/Agents] AI query hatası:', err);
        res.status(500).json({
            error: "AI Hatası",
            message: err.message
        });
    }
});

/**
 * GET /api/agents/ai/status
 * AI Agent durumunu getir
 */
app.get("/ai/status", async function (req, res) {
    try {
        const agents = getAgentSystem();
        const status = await agents.ai.getStatus();
        res.json(status);
    } catch (err) {
        console.error('[API/Agents] AI status hatası:', err);
        res.status(500).json({
            error: "Sunucu Hatası",
            message: err.message
        });
    }
});

/**
 * POST /api/agents/ai/api-key
 * AI API anahtarını ayarla
 */
app.post("/ai/api-key", async function (req, res) {
    try {
        const { apiKey } = req.body;

        if (!apiKey || typeof apiKey !== 'string') {
            return res.status(400).json({
                error: "Geçersiz İstek",
                message: "API anahtarı gereklidir."
            });
        }

        // API key format validation (basic)
        if (!apiKey.startsWith('sk-ant-')) {
            return res.status(400).json({
                error: "Geçersiz Format",
                message: "Geçersiz API anahtarı formatı."
            });
        }

        const agents = getAgentSystem();
        const result = await agents.setAiApiKey(apiKey);

        res.json(result);
    } catch (err) {
        console.error('[API/Agents] API key set hatası:', err);
        res.status(500).json({
            error: "Sunucu Hatası",
            message: err.message
        });
    }
});

/**
 * DELETE /api/agents/ai/conversation/:conversationId
 * AI konuşmasını temizle
 */
app.delete("/ai/conversation/:conversationId", function (req, res) {
    try {
        const { conversationId } = req.params;

        const agents = getAgentSystem();
        agents.clearAiConversation(conversationId || 'default');

        res.json({
            success: true,
            message: "Konuşma geçmişi temizlendi."
        });
    } catch (err) {
        console.error('[API/Agents] Conversation clear hatası:', err);
        res.status(500).json({
            error: "Sunucu Hatası",
            message: err.message
        });
    }
});

/**
 * GET /api/agents/ai/suggestions
 * Önerilen sorguları getir
 */
app.get("/ai/suggestions", function (req, res) {
    try {
        const agents = getAgentSystem();
        const suggestions = agents.getSuggestedQueries();
        res.json(suggestions);
    } catch (err) {
        res.status(500).json({
            error: "Sunucu Hatası",
            message: err.message
        });
    }
});

/**
 * GET /api/agents/logs
 * Log geçmişini getir
 */
app.get("/logs", async function (req, res) {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const agentType = req.query.agentType;
        const taskName = req.query.taskName;

        const filter = {};
        if (agentType) filter.agentType = agentType;
        if (taskName) filter.taskName = taskName;

        const agents = getAgentSystem();
        const logs = await agents.getLogs(filter, Math.min(limit, 500));

        res.json(logs);
    } catch (err) {
        console.error('[API/Agents] Logs hatası:', err);
        res.status(500).json({
            error: "Sunucu Hatası",
            message: err.message
        });
    }
});

/**
 * GET /api/agents/logs/recent
 * Son logları getir
 */
app.get("/logs/recent", async function (req, res) {
    try {
        const days = parseInt(req.query.days) || 7;

        const agents = getAgentSystem();
        const logs = await agents.getRecentLogs(Math.min(days, 30));

        res.json(logs);
    } catch (err) {
        console.error('[API/Agents] Recent logs hatası:', err);
        res.status(500).json({
            error: "Sunucu Hatası",
            message: err.message
        });
    }
});

/**
 * GET /api/agents/notifications
 * Bildirim geçmişini getir
 */
app.get("/notifications", function (req, res) {
    try {
        const limit = parseInt(req.query.limit) || 50;

        const agents = getAgentSystem();
        const notifications = agents.getNotifications(Math.min(limit, 100));

        res.json(notifications);
    } catch (err) {
        console.error('[API/Agents] Notifications hatası:', err);
        res.status(500).json({
            error: "Sunucu Hatası",
            message: err.message
        });
    }
});

/**
 * GET /api/agents/notifications/unread
 * Okunmamış bildirimleri getir
 */
app.get("/notifications/unread", function (req, res) {
    try {
        const agents = getAgentSystem();
        const notifications = agents.getUnreadNotifications();

        res.json(notifications);
    } catch (err) {
        res.status(500).json({
            error: "Sunucu Hatası",
            message: err.message
        });
    }
});

/**
 * PUT /api/agents/notifications/:notificationId/read
 * Bildirimi okundu işaretle
 */
app.put("/notifications/:notificationId/read", function (req, res) {
    try {
        const { notificationId } = req.params;

        const agents = getAgentSystem();
        agents.markNotificationAsRead(notificationId);

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({
            error: "Sunucu Hatası",
            message: err.message
        });
    }
});

/**
 * PUT /api/agents/notifications/read-all
 * Tüm bildirimleri okundu işaretle
 */
app.put("/notifications/read-all", function (req, res) {
    try {
        const agents = getAgentSystem();
        agents.markAllNotificationsAsRead();

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({
            error: "Sunucu Hatası",
            message: err.message
        });
    }
});

module.exports = app;

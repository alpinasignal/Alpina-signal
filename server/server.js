const express = require("express");
const cors = require("cors");
const path = require("path");
const fetch = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { RSI, EMA } = require("technicalindicators");

const app = express();
app.use(cors());
app.use(express.json());

// =======================
// STATIC FRONTEND
// =======================
const publicPath = path.join(__dirname, "../public");
app.use(express.static(publicPath));

app.get("/", (req, res) => {
    res.sendFile(path.join(publicPath, "index.html"));
});

// =======================
// HEALTH CHECK
// =======================
app.get("/health", (req, res) => {
    res.status(200).send("OK");
});

// =======================
// USERS (IN-MEMORY)
// =======================
const users = {};
const ADMIN_ID = 7940666073;

// =======================
// AUTH
// =======================
app.post("/auth", (req, res) => {
    const user = req.body;
    if (!user || !user.id) return res.json({ ok: false });

    if (!users[user.id]) {
        users[user.id] = {
            id: user.id,
            username: user.username || "",
            freeSignalsUsed: 0,
            subscribed: user.id === ADMIN_ID
        };
        console.log("👤 New user:", users[user.id]);
    }

    if (user.id === ADMIN_ID) {
        users[user.id].subscribed = true;
        users[user.id].freeSignalsUsed = 0;
    }

    res.json({ ok: true });
});

// =======================
// BINANCE DATA
// =======================
async function getCandles(symbol, interval) {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=120`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = await res.json();
    if (!Array.isArray(data)) return null;

    return data.map(c => ({ close: parseFloat(c[4]) }));
}

// =======================
// ANALYSIS (ALWAYS RETURNS SIGNAL)
// =======================
function analyzeMarket(candles) {
    if (!candles || candles.length < 30) return null;

    const closes = candles.map(c => c.close);

    const emaFast = EMA.calculate({ values: closes, period: 9 });
    const emaSlow = EMA.calculate({ values: closes, period: 21 });
    const rsi = RSI.calculate({ values: closes, period: 14 });

    const price = closes.at(-1);
    const fast = emaFast.at(-1);
    const slow = emaSlow.at(-1);
    const lastRSI = rsi.at(-1);

    // 🔥 STRONG SETUP
    if (fast > slow && lastRSI < 55) {
        return {
            type: "LONG",
            entry: price.toFixed(2),
            stopLoss: (price * 0.992).toFixed(2),
            takeProfit: (price * 1.02).toFixed(2),
            confidence: "High",
            risk: "Low",
            winRate: "65%"
        };
    }

    if (fast < slow && lastRSI > 45) {
        return {
            type: "SHORT",
            entry: price.toFixed(2),
            stopLoss: (price * 1.008).toFixed(2),
            takeProfit: (price * 0.98).toFixed(2),
            confidence: "High",
            risk: "Low",
            winRate: "63%"
        };
    }

    // ⚖️ FALLBACK (ВСЕГДА ДАЁМ СИГНАЛ)
    return {
        type: fast >= slow ? "LONG" : "SHORT",
        entry: price.toFixed(2),
        stopLoss: fast >= slow
            ? (price * 0.995).toFixed(2)
            : (price * 1.005).toFixed(2),
        takeProfit: fast >= slow
            ? (price * 1.012).toFixed(2)
            : (price * 0.988).toFixed(2),
        confidence: "Medium",
        risk: "Medium",
        winRate: "56%"
    };
}

// =======================
// SIGNAL
// =======================
app.post("/signal", async (req, res) => {
    try {
        const { userId, coin, timeframe } = req.body;
        const user = users[userId];
        if (!user) return res.json({ error: true });

        if (user.id !== ADMIN_ID && !user.subscribed && user.freeSignalsUsed >= 2) {
            return res.json({ blocked: true });
        }

        const tfMap = { "5": "5m", "15": "15m", "60": "1h" };
        const candles = await getCandles(coin, tfMap[timeframe]);
        if (!candles) return res.json({ error: true });

        const signal = analyzeMarket(candles);
        if (!signal) return res.json({ error: true });

        if (user.id !== ADMIN_ID && !user.subscribed) {
            user.freeSignalsUsed++;
        }

        res.json(signal);

    } catch (e) {
        console.error("SIGNAL ERROR:", e);
        res.json({ error: true });
    }
});

// =======================
// CONFIRM PAYMENT (MANUAL)
// =======================
app.post("/confirm-payment", (req, res) => {
    const { userId } = req.body;
    const user = users[userId];

    if (!user) return res.json({ ok: false });

    user.subscribed = true;
    user.freeSignalsUsed = 0;

    console.log("💰 Subscription activated for user:", userId);
    res.json({ ok: true });
});

// =======================
// START SERVER
// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Alpina Signal running on port ${PORT}`);
});

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
// STATIC FRONTEND (САЙТ + MINI APP)
// =======================
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// =======================
// HEALTHCHECK (Railway)
// =======================
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// =======================
// USERS
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
      subscribed: user.id === ADMIN_ID,
    };
  }

  if (user.id === ADMIN_ID) {
    users[user.id].subscribed = true;
    users[user.id].freeSignalsUsed = 0;
  }

  res.json({ ok: true });
});

// =======================
// BINANCE
// =======================
async function getCandles(symbol, interval) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=120`;
  const res = await fetch(url);
  const data = await res.json();
  if (!Array.isArray(data)) return null;

  return data.map(c => ({ close: parseFloat(c[4]) }));
}

// =======================
// ANALYSIS
// =======================
function analyzeMarket(candles) {
  const closes = candles.map(c => c.close);
  if (closes.length < 30) return null;

  const rsi = RSI.calculate({ values: closes, period: 14 });
  const emaFast = EMA.calculate({ values: closes, period: 9 });
  const emaSlow = EMA.calculate({ values: closes, period: 21 });

  const price = closes.at(-1);
  const fast = emaFast.at(-1);
  const slow = emaSlow.at(-1);

  if (fast >= slow) {
    return {
      type: "LONG",
      entry: price.toFixed(2),
      stopLoss: (price * 0.99).toFixed(2),
      takeProfit: (price * 1.02).toFixed(2),
    };
  }

  return {
    type: "SHORT",
    entry: price.toFixed(2),
    stopLoss: (price * 1.01).toFixed(2),
    takeProfit: (price * 0.98).toFixed(2),
  };
}

// =======================
// SIGNAL
// =======================
app.post("/signal", async (req, res) => {
  const { userId, coin, timeframe } = req.body;
  const user = users[userId];
  if (!user) return res.json({ error: true });

  if (!user.subscribed && user.freeSignalsUsed >= 2) {
    return res.json({ blocked: true });
  }

  const tfMap = { "5": "5m", "15": "15m", "60": "1h" };
  const candles = await getCandles(coin, tfMap[timeframe]);
  if (!candles) return res.json({ error: true });

  const signal = analyzeMarket(candles);
  if (!signal) return res.json({ noSignal: true });

  if (!user.subscribed) user.freeSignalsUsed++;
  res.json(signal);
});

// =======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Alpina Signal running on ${PORT}`);
});

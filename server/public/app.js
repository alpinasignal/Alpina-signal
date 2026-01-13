// ============================
// TELEGRAM INIT
// ============================
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const API = "";
const user = tg.initDataUnsafe.user || {};

// ============================
// PROFILE
// ============================
if (user.id) {
    document.getElementById("userName").innerText =
        user.username ? `@${user.username}` : user.first_name;

    document.getElementById("userId").innerText = `ID: ${user.id}`;

    document.getElementById("userPhoto").src =
        user.photo_url || "https://i.imgur.com/6VBx3io.png";
}

// ============================
// AUTH
// ============================
if (user && user.id) {
    fetch("/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            id: user.id,
            username: user.username || ""
        })
    }).catch(() => {});
}

// ============================
// NAVIGATION
// ============================
function showScreen(name) {
    document.querySelectorAll(".screen").forEach(s =>
        s.classList.remove("active")
    );

    const screen = document.getElementById(`screen-${name}`);
    if (screen) screen.classList.add("active");

    const chartWrapper = document.getElementById("chartWrapper");
    if (chartWrapper) {
        chartWrapper.style.display = name === "signals" ? "block" : "none";
    }
}

// ============================
// TRADINGVIEW
// ============================
let currentSymbol = "BINANCE:BTCUSDT";
let currentTF = "5";
let tvWidget = null;

function loadChart() {
    if (tvWidget && typeof tvWidget.remove === "function") {
        tvWidget.remove();
    }

    tvWidget = new TradingView.widget({
        autosize: true,
        symbol: currentSymbol,
        interval: currentTF,
        timezone: "Etc/UTC",
        theme: "dark",
        style: "1",
        locale: "en",
        container_id: "tv_chart",
        hide_side_toolbar: true,
        hide_top_toolbar: true,
        enable_publishing: false,
        save_image: false
    });
}

loadChart();

// ============================
// COIN CHANGE
// ============================
document.getElementById("coinSelect").onchange = e => {
    currentSymbol = "BINANCE:" + e.target.value;
    loadChart();
};

// ============================
// TIMEFRAME BUTTONS
// ============================
document.querySelectorAll(".tf-btn").forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll(".tf-btn").forEach(b =>
            b.classList.remove("active")
        );
        btn.classList.add("active");
        currentTF = btn.dataset.tf;
        loadChart();
    };
});

// ============================
// SIGNAL CARD
// ============================
function copyText(value) {
    navigator.clipboard.writeText(value);
    tg.showToast("Copied");
}

function renderSignalCard(data) {
    const card = document.getElementById("signalCard");
    if (!card) return;

    card.classList.remove("hidden");

    if (data.noSignal) {
        card.className = "signal-card";
        card.innerHTML = "⏳ No clear setup right now. Try another timeframe or coin.";
        return;
    }

    if (data.error) {
        card.className = "signal-card";
        card.innerHTML = "⚠️ Server error. Try again later.";
        return;
    }

    const type = data.type.toLowerCase();
    card.className = `signal-card ${type}`;

    card.innerHTML = `
        <div class="signal-header">
            <div class="signal-type">${data.type}</div>
            <div class="signal-meta">
                ${currentSymbol.replace("BINANCE:", "")} · ${currentTF}m
            </div>
        </div>

        <div class="signal-table">
            <div class="signal-cell">
                <div class="signal-label">Entry</div>
                <div class="signal-value">${data.entry}</div>
                <button class="copy-btn" onclick="copyText('${data.entry}')">Copy</button>
            </div>

            <div class="signal-cell">
                <div class="signal-label">Stop Loss</div>
                <div class="signal-value">${data.stopLoss}</div>
                <button class="copy-btn" onclick="copyText('${data.stopLoss}')">Copy</button>
            </div>

            <div class="signal-cell">
                <div class="signal-label">Take Profit</div>
                <div class="signal-value">${data.takeProfit}</div>
                <button class="copy-btn" onclick="copyText('${data.takeProfit}')">Copy</button>
            </div>

            <div class="signal-cell">
                <div class="signal-label">Confidence</div>
                <div class="signal-value">${data.confidence || "-"}</div>
            </div>
        </div>

        <div class="signal-footer">
            <div class="badge">Risk: ${data.risk || "-"}</div>
            <div class="badge">Win: ${data.winRate || "-"}</div>
        </div>
    `;
}

// ============================
// GET SIGNAL
// ============================
document.getElementById("getSignalBtn").onclick = () => {
    if (!user || !user.id) {
        alert("Telegram user not initialized");
        return;
    }

    fetch("/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            userId: user.id,
            coin: currentSymbol.replace("BINANCE:", ""),
            timeframe: currentTF
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.blocked) {
            openModal();
            return;
        }
        renderSignalCard(data);
    })
    .catch(() => renderSignalCard({ error: true }));
};


// ============================
// SUBSCRIPTION MODAL
// ============================
const modal = document.getElementById("subscriptionModal");
const paymentInfo = document.getElementById("paymentInfo");

function openModal() {
    if (modal) modal.classList.remove("hidden");
}

function closeModal() {
    if (modal) modal.classList.add("hidden");
    if (paymentInfo) paymentInfo.innerText = "";
}

// ============================
// PLANS
// ============================
document.querySelectorAll(".plan-card").forEach(card => {
    card.onclick = () => {
        document.querySelectorAll(".plan-card").forEach(c =>
            c.classList.remove("active")
        );
        card.classList.add("active");

        const prices = {
            basic: "14.99",
            pro: "24.99",
            elite: "39.99"
        };

        paymentInfo.innerText =
            `Send ${prices[card.dataset.plan]} USDT (TRC20)\n\n` +
            `Wallet:\nTECGFKQd1SuJdVihGnegeVGfEXKnpCWieY`;
    };
});

// ============================
// FINAL INIT (NO DOMCONTENTLOADED)
// ============================
if (modal) modal.classList.add("hidden");
showScreen("signals");

// FINAL SAFE INIT
if (modal) modal.classList.remove("active");
showScreen("signals");

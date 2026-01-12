const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// ===== HEALTHCHECK (ВАЖНО) =====
app.get("/health", (req, res) => {
    res.status(200).send("OK");
});

// ===== TEST ROOT =====
app.get("/", (req, res) => {
    res.send("Alpina Signal API is running");
});

// ===== PORT =====
const PORT = process.env.PORT || 8080;

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Alpina Signal Server running on port ${PORT}`);
});

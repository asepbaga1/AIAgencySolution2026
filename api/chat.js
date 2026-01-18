// api/chat.js - Vercel Serverless Function
// FINAL PRODUKSI - HARDENED, ANTI FRONTEND ERROR

const { GoogleGenerativeAI } = require("@google/generative-ai");

/* =========================
   SYSTEM PROMPT (KUNCI BISNIS)
   ========================= */
const SYSTEM_PROMPT = `
Kamu adalah AI untuk bisnis nyata yang fokus pada LEAD QUALIFICATION.

ATURAN KERAS:
- Jangan mengarang informasi
- Jika tidak tahu, katakan tidak tahu
- Tanya SATU pertanyaan per giliran
- Kumpulkan: tujuan bisnis, jenis bisnis, masalah utama, urgensi
- Setelah MINIMAL 4 jawaban, RINGKAS dalam 1 paragraf profesional
- Arahkan user ke WhatsApp untuk konsultasi lanjutan

BAHASA:
- Ikuti bahasa user (Indonesia / English)
- Nada profesional, singkat, jelas

JANGAN:
- Jangan jual langsung
- Jangan beri harga
- Jangan janji teknis
- Jangan bertele-tele
`;

/* =========================
   MAIN HANDLER
   ========================= */
module.exports = async (req, res) => {
  // Preflight
  if (req.method === "OPTIONS") {
    return res.status(200).json({});
  }

  // Only POST
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
      message: "Only POST requests accepted",
    });
  }

  try {
    const { message, history = [] } = req.body || {};

    // --- VALIDASI INPUT UTAMA ---
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        error: "Invalid input",
        message: "Message must be non-empty string",
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY missing");
      return res.status(500).json({
        error: "Configuration error",
        message: "Server not configured",
      });
    }

    // --- NORMALISASI HISTORY (ANTI MISMATCH) ---
    const safeHistory = Array.isArray(history)
      ? history
          .filter((m) => m && (m.content || m.text))
          .map((m) => ({
            role:
              m.role === "user" || m.sender === "user"
                ? "user"
                : "model",
            parts: [{ text: m.content || m.text }],
          }))
      : [];

    // --- INIT GEMINI ---
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash-latest",        temperature: 0.7,
        maxOutputTokens: 500,
      },
    });

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: "SYSTEM INSTRUCTION" }] },
        { role: "model", parts: [{ text: SYSTEM_PROMPT }] },
        ...safeHistory,
      ],
    });

    const result = await chat.sendMessage(message);
    const reply = result.response.text();

    return res.status(200).json({
      success: true,
      reply,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("CHAT API ERROR:", err);

    return res.status(500).json({
      error: "Internal Server Error",
      message: "AI service temporarily unavailable",
    });
  }
};

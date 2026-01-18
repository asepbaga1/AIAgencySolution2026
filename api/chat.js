// api/chat.js - Vercel Serverless Function
// PRODUKSI READY - NO PLACEHOLDER

const { GoogleGenerativeAI } = require("@google/generative-ai");

// System prompt untuk lead qualification
const SYSTEM_PROMPT = `Kamu adalah AI untuk bisnis nyata yang fokus pada lead qualification.

ATURAN KERAS:
- Jangan mengarang informasi yang tidak ada
- Jika tidak tahu, katakan tidak tahu dengan jujur
- Tanya SATU pertanyaan per giliran untuk menggali kebutuhan
- Kumpulkan data: tujuan bisnis, jenis industri, masalah utama, tingkat urgensi
- Setelah data cukup (min 4 jawaban), ringkas dalam 1 paragraf profesional
- Arahkan user ke WhatsApp untuk konsultasi lanjut

BAHASA:
- Deteksi bahasa user otomatis (Indonesia atau English)
- Gunakan bahasa yang sama dengan user
- Nada: profesional, singkat, jelas, tanpa basa-basi

FLOW CONVERSATIONAL:
1. Sapa singkat, tanya tujuan utama
2. Tanya jenis bisnis/industri
3. Tanya masalah spesifik yang dihadapi
4. Tanya timeline/urgensi
5. Ringkas semua data
6. Berikan CTA WhatsApp dengan nomor +6281234567890

CONTOH OUTPUT AKHIR:
"Baik, saya sudah catat: Anda butuh website e-commerce untuk fashion brand dengan integrasi payment gateway, target launching dalam 2 bulan. Untuk solusi detail dan penawaran, silakan hubungi tim kami via WhatsApp: https://wa.me/6281234567890?text=Halo%20saya%20tertarik%20konsultasi"

JANGAN:
- Jangan jual langsung
- Jangan beri harga tanpa konsultasi
- Jangan buat janji teknis tanpa validasi
- Jangan bertele-tele`;

// CORS headers untuk security
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Main handler
module.exports = async (req, res) => {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests accepted'
    });
  }

  try {
    // Validasi input
    const { message, history = [] } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Message field is required and must be non-empty string'
      });
    }

    // Validasi API key existence
    if (!process.env.GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not found in environment variables');
      return res.status(500).json({
        error: 'Configuration error',
        message: 'API key not configured. Please contact administrator.'
      });
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 500,
      }
    });

    // Build conversation history
    const chatHistory = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // Start chat with system prompt as first message
    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: 'Instruksi sistem untuk kamu:' }]
        },
        {
          role: 'model',
          parts: [{ text: SYSTEM_PROMPT }]
        },
        ...chatHistory
      ]
    });

    // Send user message
    const result = await chat.sendMessage(message);
    const response = await result.response;
    const botReply = response.text();

    // Return clean JSON
    return res.status(200).json({
      success: true,
      reply: botReply,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chat API Error:', error);

    // Handle specific Gemini API errors
    if (error.message?.includes('API_KEY')) {
      return res.status(500).json({
        error: 'API Configuration Error',
        message: 'Invalid or expired API key. Please contact administrator.'
      });
    }

    if (error.message?.includes('quota')) {
      return res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: 'Too many requests. Please try again in a moment.'
      });
    }

    // Generic error
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Something went wrong. Please try again later.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
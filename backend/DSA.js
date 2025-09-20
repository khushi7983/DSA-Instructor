import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
dotenv.config();
// ...existing code...
const app = express();
app.use(cors({
  origin: [
    'http://localhost:5173', // Local frontend (Vite default)
    'http://localhost:3000', // Local frontend (React default)
    'https://dsa-instructor-ngy8-j4io7c8az-khushi-panwars-projects.vercel.app' // Vercel deployment
  ],
  methods: ['POST', 'GET'],
  credentials: true
}));
app.use(express.json()); // parse JSON bodies

const apiKey = process.env.API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

// Basic healthcheck
app.get("/health", (_req, res) => {
  if (!apiKey) {
    return res.status(500).json({ error: "Server misconfigured: missing API key" });
  }
  return res.json({ ok: true });
});

// Route for chatbot
app.post("/api/chat", async (req, res) => {
  try {
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "Server misconfigured: missing API key" });
    }

    const { question, model: requestedModel } = req.body || {};
    if (!question || typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ error: "Missing 'question' in request body" });
    }

    const allowedModels = new Set(["gemini-1.5-flash", "gemini-1.5-pro"]);
    const modelId = allowedModels.has(requestedModel) ? requestedModel : "gemini-1.5-flash";
    const model = genAI.getGenerativeModel({ model: modelId });
    const systemInstruction =
      "You are a Data Structures and Algorithms Instructor. You help students learn DSA. Always solve problems step by step. If user asks anything not related to DSA, politely refuse.";

    const prompt = `${systemInstruction}\n\nUser question: ${question}`;
    const result = await model.generateContent(prompt);
    const answer = result?.response?.text?.() || "No response.";

    res.json({ answer });
  } catch (error) {
    console.error(error);
    const message =
      (error && (error.message || error.toString())) || "Something went wrong.";
    res.status(500).json({ error: message });
  }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Backend running at http://localhost:${PORT}`);
});

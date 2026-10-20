import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const API_KEY = process.env.GEMINI_API_KEY;

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Small in-memory guardrail for a starter project. Limits reset on server restart.
const requestsByIp = new Map();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;
app.use('/api/chat', (req, res, next) => {
  const now = Date.now();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const record = requestsByIp.get(ip);
  if (!record || now - record.startedAt >= WINDOW_MS) {
    requestsByIp.set(ip, { startedAt: now, count: 1 });
    return next();
  }
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return res.status(429).json({ error: 'ใช้งานหลายครั้งเกินไป กรุณารอสักครู่แล้วลองใหม่' });
  }
  record.count += 1;
  return next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, configured: Boolean(API_KEY) });
});

app.post('/api/chat', async (req, res) => {
  if (!API_KEY || API_KEY === 'put_your_key_here') {
    return res.status(503).json({ error: 'ยังไม่ได้ตั้งค่า API key กรุณาทำตามขั้นตอนใน README.md' });
  }

  const messages = req.body?.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) {
    return res.status(400).json({ error: 'รูปแบบข้อความไม่ถูกต้อง' });
  }

  const validMessages = [];
  for (const item of messages.slice(-12)) {
    if (!item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string') {
      return res.status(400).json({ error: 'รูปแบบข้อความไม่ถูกต้อง' });
    }
    const content = item.content.trim();
    if (!content || content.length > 5000) {
      return res.status(400).json({ error: 'ข้อความต้องมีความยาวไม่เกิน 5,000 ตัวอักษร' });
    }
    validMessages.push({
      role: item.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: content }]
    });
  }

  if (validMessages.at(-1)?.role !== 'user') {
    return res.status(400).json({ error: 'ข้อความล่าสุดต้องเป็นคำถามจากผู้ใช้' });
  }

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: 'คุณคือ Mali AI ผู้ช่วย AI ที่เป็นมิตร ตอบเป็นภาษาไทยอย่างชัดเจน สุภาพ และตรงคำถาม ถ้าไม่แน่ใจให้บอกตามตรง อย่าแต่งข้อมูลขึ้นเอง จัดคำตอบให้อ่านง่ายและคำนึงถึงความปลอดภัยของผู้ใช้' }]
          },
          contents: validMessages,
          generationConfig: { temperature: 0.7, maxOutputTokens: 1200 }
        }),
        signal: AbortSignal.timeout(45000)
      }
    );

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error('Gemini API error:', upstream.status, data?.error?.message || 'Unknown API error');
      if (upstream.status === 429) {
        return res.status(429).json({ error: 'ตอนนี้ AI ใช้งานถึงขีดจำกัดชั่วคราวแล้ว ลองใหม่ภายหลัง' });
      }
      if (upstream.status === 400 || upstream.status === 403) {
        return res.status(502).json({ error: 'เรียกใช้ AI ไม่สำเร็จ กรุณาตรวจสอบ API key และรุ่นโมเดลในค่าตั้งค่า' });
      }
      return res.status(502).json({ error: 'บริการ AI ตอบกลับผิดพลาด กรุณาลองอีกครั้ง' });
    }

    const answer = data?.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim();

    if (!answer) {
      return res.status(502).json({ error: 'AI ยังไม่มีคำตอบให้ข้อความนี้ ลองถามใหม่อีกครั้ง' });
    }
    return res.json({ answer });
  } catch (error) {
    console.error('Chat request failed:', error?.name || 'Error');
    const message = error?.name === 'TimeoutError'
      ? 'AI ใช้เวลาตอบนานเกินไป กรุณาลองใหม่'
      : 'เชื่อมต่อ AI ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่';
    return res.status(502).json({ error: message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mali AI is running on port ${PORT}`);
});

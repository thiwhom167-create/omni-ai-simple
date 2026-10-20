# Mali AI — เว็บไซต์แชต AI ภาษาไทย

เว็บแชต AI ภาษาไทย ใช้ HTML/CSS/JavaScript + Node.js/Express และ Gemini API โดยเก็บ API key ไว้ฝั่งเซิร์ฟเวอร์

## Deploy on Render
- Runtime: Node
- Build command: `cd mali-ai && npm install`
- Start command: `cd mali-ai && npm start`
- Plan: Free
- Add these environment variables in the Render service dashboard:
  - `GEMINI_API_KEY`: your API key from Google AI Studio
  - `GEMINI_MODEL`: `gemini-3.8-flash`

Do not commit a real API key or add it to `public/index.html`.

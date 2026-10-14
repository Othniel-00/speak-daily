// Public settings the app needs (no secrets).
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    ai: process.env.ANTHROPIC_API_KEY ? 'claude' : process.env.GEMINI_API_KEY ? 'gemini' : null,
    passcodeRequired: !!process.env.APP_PASSCODE,
  });
}

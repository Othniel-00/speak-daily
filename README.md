# Speak Daily

**Live app:** https://speak-daily-nu.vercel.app

A daily morning and evening coach for clear speaking, grammar and reading. It is built as an installable iPhone web app (PWA): add it to your home screen from Safari and it opens and works like a normal app, including offline.

## What it does

- **Morning practice (20 min):** mouth warm-up and tongue twisters, read a passage aloud, record a 1-minute talk, learn a new word.
- **Evening practice (20 min):** listen back to your talk and pick one thing to fix, write a 5–8 sentence journal (the AI coach can correct it), a grammar lesson with a quiz, and shadowing a clear speaker.
- **Reminders:** one tap adds two daily calendar alerts to your iPhone, at the exact times you choose. They ring even when the app is closed or you are offline.
- **AI coach:** chat by typing or talking. It has four modes: just talk, correct my writing, role-play (interviews, presentations, selling) and explain grammar. Replies can be read aloud.
- **Daily reading:** news from Liberia, tech in Africa, world tech, and business; a great mind's quote; a Bible verse (KJV); and "On this day" in history. Reading goal and a streak.
- **Progress:** streak, a 5-week calendar, quiz score, stories read, all your recordings, and your journal history.
- **Google Drive backup:** progress and recordings are saved to a `Speak Daily` folder in your own Drive.
- **Offline:** all practice content, recordings and progress live on the phone. The news you last loaded stays readable offline. Only the AI coach and Drive saving need the internet.

## Install on iPhone

1. Open the app's link in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Open it from the home screen, go to **Settings**, and tap **Add to my iPhone Calendar**, then **Add All**.

## Settings in Vercel (Project > Settings > Environment Variables)

| Name | Needed for | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` **or** `GEMINI_API_KEY` | AI coach | Use one. Claude keys: console.anthropic.com. Gemini keys (has a free tier): aistudio.google.com/apikey |
| `ANTHROPIC_MODEL` / `GEMINI_MODEL` | optional | Defaults: `claude-haiku-5-5` / `gemini-2.5-flash` |
| `APP_PASSCODE` | protecting your AI credit | Anyone with the link could otherwise use your key. Enter the same passcode in the app's Settings. |
| `GOOGLE_CLIENT_ID` | Google Drive backup | See below. |

After adding or changing a variable, redeploy (Deployments > ... > Redeploy).

### Getting a Google Client ID (about 5 minutes)

1. Go to console.cloud.google.com and create a project (any name, e.g. "Speak Daily").
2. **APIs & Services > Library**: enable **Google Drive API**.
3. **APIs & Services > OAuth consent screen**: choose **External**, fill in the app name and your email. Under **Test users**, add your own Gmail address.
4. **APIs & Services > Credentials > Create credentials > OAuth client ID**: type **Web application**. Under **Authorized JavaScript origins**, add your app address, e.g. `https://speak-daily.vercel.app`.
5. Copy the Client ID (ends in `.apps.googleusercontent.com`) into `GOOGLE_CLIENT_ID` in Vercel and redeploy.

The app only asks for the `drive.file` permission. It can see the files it created and nothing else in your Drive.

## Project layout

```
index.html            App shell (iPhone meta tags, icons)
css/app.css           Design: dawn palette in the morning, dusk palette in the evening
js/app.js             Screens, sessions, timer, recorder, coach, progress
js/content.js         All practice content (works offline)
js/store.js           Local storage + recordings (IndexedDB) + merge logic
js/drive.js           Google Drive backup
js/voice.js           Recording, speech-to-text, text-to-speech
sw.js                 Offline support (service worker)
api/chat.js           AI coach (Claude or Gemini)
api/feed.js           Daily news + On this day
api/reminders.js      Calendar file with daily alerts
api/config.js         Public settings for the app
dev-server.mjs        Local preview: node dev-server.mjs
```

## Run locally

```
node dev-server.mjs
```
Then open http://localhost:3000.

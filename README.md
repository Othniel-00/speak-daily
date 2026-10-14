# Speak Daily

**Live app:** https://speak-daily-nu.vercel.app

A daily morning and evening coach for clear speaking, grammar and reading. It is built as an installable iPhone web app (PWA): add it to your home screen from Safari and it opens and works like a normal app, including offline.

## What it does

Speak Daily follows one cycle: **Learn → Practise → Get feedback → Fix mistakes → Practise again → Track improvement.**

- **Today:** the morning and evening 20-minute sessions, today's minutes, mistakes due for review, the next grammar unit, the word of the day, and a Bible verse and great-mind quote to say aloud.
- **Learn (five skills):**
  - **Grammar Academy:** 15 units in 3 levels (Foundations, Building sentences, Precision). Rule, wrong → right examples, an 8-question quiz (6 right = mastered), and 6 fresh AI questions aimed at your past mistakes.
  - **Speaking & Fluency:** one-minute talks with AI feedback, conversation role-plays with the coach, shadowing.
  - **Pronunciation:** six sound drills (th, word endings, -s, v/b, word stress, pausing), read-aloud with an AI pronunciation check, and your own problem words.
  - **Vocabulary:** word bank with spaced review; the daily word is added automatically.
  - **Communication:** six patterns (clear answers, short stories, introductions, polite disagreement, guiding a talk, clear emails) with spoken or written practice.
- **Mistakes notebook:** grammar slips from your talks, journal, writing and conversations, wrong quiz answers, unclear words and new words become review cards. Right answers come back later, wrong ones sooner (spaced review).
- **Coach:** an AI assistant you can type or talk to, with role-play and a "review my English" button that adds your mistakes to the notebook.
- **Progress:** five-skill progress, a chart of clarity and pronunciation scores over time, speaking speed and filler words, a level roadmap, weekly AI report, calendar, recordings and journal.
- **Reminders, Google Drive backup and offline use** as before.

## Install on iPhone

1. Open the app's link in **Safari**.
2. Tap **Share**, then **Add to Home Screen**.
3. Open it from the home screen, go to **Settings**, and tap **Add to my iPhone Calendar**, then **Add All**.

## Settings in Vercel (Project > Settings > Environment Variables)

| Name | Needed for | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` **or** `GEMINI_API_KEY` | AI coach (voice feedback needs Gemini) | Use one. Claude keys: console.anthropic.com. Gemini keys (has a free tier): aistudio.google.com/apikey |
| `ANTHROPIC_MODEL` / `GEMINI_MODEL` | optional | Defaults: `claude-haiku-5-5` / `gemini-3.8-flash` |
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
js/content-learn.js   Grammar levels, sound drills, communication lessons, role-play scenarios
js/learning.js        Mistakes notebook, spaced review, mastery and skill progress
js/learn.js           The Learn tab, grammar quiz and review screens
js/ui.js              Small shared helpers
js/store.js           Local storage + recordings (IndexedDB) + merge logic
js/drive.js           Google Drive backup
js/voice.js           Recording, speech-to-text, text-to-speech
sw.js                 Offline support (service worker)
api/chat.js           AI coach (Claude or Gemini)
api/listen.js         AI listening feedback + pronunciation check (Gemini)
lib/gemini.js         Gemini helper with automatic backup models
js/audio.js           Converts recordings to WAV for the AI
js/content-extra.js   Extra practice content (v1.1)
api/reminders.js      Calendar file with daily alerts
api/config.js         Public settings for the app
dev-server.mjs        Local preview: node dev-server.mjs
```

## Run locally

```
node dev-server.mjs
```
Then open http://localhost:3000.

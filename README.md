<p align="center">
  <img src="./Preview.gif" alt="Moodify Music Preview" width="100%">
</p>

<h1 align="center">Moodify Music</h1>
<p align="center">Next-generation streaming service with real-time audio and personalization.</p>

---

## 🚀 Overview

**Moodify Music** is a full-featured music streaming platform built with **React**, **Express**, and **HLS.js**.  
It delivers adaptive streaming, advanced audio effects, recommendations based on listening data and catalog metadata, and a real-time social layer similar to Spotify’s _Friend Activity_.  
All modules are optimized for performance, scalability, and mobile usability.

---

## ✨ Key Features

🎧 **Adaptive HLS Streaming** — Seamless playback powered by `hls.js`  
🎚️ **Audio Effects** — Reverb, EQ, normalization, speed control via `Web Audio API`  
📈 **Waveform Analyzer** — FL Studio-style oscilloscope for real-time visuals  
💬 **Realtime Chat** — Built on `Socket.io`, users can share tracks, albums, and playlists  
👥 **Friends Activity** — See what your friends are listening to in real time  
📱 **Offline Mode** — Works via `IndexedDB` and `Service Worker`  
🕵️ **Anonymous Mode** — Listen privately, no traces left  
🎵 **Lyrics Display** — Synced lyrics for supported tracks  
📂 **Queue Management** — Add, reorder, and remove songs dynamically  
🌙 **Modern UI** — Built with `Tailwind CSS`, fully responsive and mobile-first

---

## 🧩 Tech Stack

**Frontend**

- React + TypeScript
- Tailwind CSS
- Zustand (state management)
- HLS.js
- Web Audio API

**Backend**

- Node.js + Express.js
- MongoDB
- Socket.io (chat + friend activity)
- Last.fm (optional genre/mood hints for imports)
- Spotify API (metadata and cover art)
- Audio Analysis Microservice (audio feature extraction)

**Offline / PWA**

- IndexedDB + Service Worker

---

## 🧠 Architecture

Frontend (React + Zustand + Tailwind)
│
▼
Backend (Express.js + MongoDB + Spotify APIs)
│
├── Audio Analysis Microservice (Audio Features)
├── HLS Streaming Engine
└── Socket.io (Chat + Friends Activity)

🔐 Authentication
JWT-based sessions: email/password with email verification (Resend), Google OAuth, and password reset via one-time codes.

🌍 Integrations
Spotify API — Albums, artists, metadata

AudioFeatures API — Python-based track analysis

🧭 Roadmap
Collaborative playlists

Mobile app (React Native)


🧑‍💻 Author
Dimon Desh — Full-Stack Developer & Music Producer
💬 Inspired by sound, built for emotion.

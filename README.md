<p align="center">
  <img src="./preview.png" alt="Moodify Music Preview" width="100%">
</p>

<h1 align="center">🎵 Moodify Music</h1>
<p align="center">Next-generation Ukrainian streaming service powered by AI, real-time audio, and deep personalization.</p>

---

## 🚀 Overview

**Moodify Music** is a full-featured music streaming platform built with **React**, **Express**, and **HLS.js**.  
It delivers adaptive streaming, advanced audio effects, AI-driven recommendations, playlist generation from prompts, and a real-time social layer similar to Spotify’s *Friend Activity*.  
All modules are optimized for performance, scalability, and mobile usability.

---

## ✨ Key Features

🎧 **Adaptive HLS Streaming** — Seamless playback powered by `hls.js`  
🎚️ **Audio Effects** — Reverb, EQ, normalization, speed control via `Web Audio API`  
📈 **Waveform Analyzer** — FL Studio-style oscilloscope for real-time visuals  
💬 **Realtime Chat** — Built on `Socket.io`, users can share tracks, albums, and playlists  
🧠 **AI Recommendations** — Based on Gemini-generated tags and audio features  
🪄 **AI Playlist Generator** — Create playlists by text prompt (e.g. *“summer synthpop vibes”*)  
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
- Gemini API (AI tagging, playlist prompts)  
- Spotify API (metadata and cover art)  
- Audio Analysis Microservice (audio feature extraction)  

**Offline / PWA**
- IndexedDB + Service Worker  

---

## 🧠 Architecture

Frontend (React + Zustand + Tailwind)
│
▼
Backend (Express.js + MongoDB + Gemini + Spotify APIs)
│
├── Audio Analysis Microservice (Audio Features)
├── HLS Streaming Engine
└── Socket.io (Chat + Friends Activity)

🔐 Authentication
Authentication via Firebase Auth, with email/password and OAuth providers.

🌍 Integrations
Spotify API — Albums, artists, metadata

Gemini API — AI tagging + playlist generation

AudioFeatures API — Python-based track analysis

🧭 Roadmap
 Collaborative playlists

 Personalized AI DJ mode

 Mobile app (React Native)

 Smart search with natural language prompts

🧑‍💻 Author
Dimon Desh — Full-Stack Developer & Music Producer
💬 Inspired by sound, built for emotion.

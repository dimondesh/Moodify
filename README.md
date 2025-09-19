# Moodify - Your Personal Music Streaming Service

![Moodify Preview](https://github.com/dimondesh/Moodify/blob/main/Preview.png)

Moodify is a modern, feature-rich music streaming service built from the ground up to provide a personalized, interactive, and seamless listening experience. This full-stack application showcases a wide range of modern web technologies, from an advanced Web Audio API player to real-time social features and complete offline PWA capabilities.

---

## 🚀 Key Features

- **🎧 Advanced Audio Player:** A high-performance player built with the **Web Audio API**, featuring:

  - Separate instrumental and vocal track controls.
  - A multi-band **Equalizer** with presets and custom settings.
  - **Reverb** effects to simulate different room sizes.
  - Adjustable playback speed.

- **🤖 AI-Powered Personalization:**

  - **AI Playlist Generator:** Describe a mood or activity (e.g., "upbeat rock for a workout"), and let AI curate a playlist for you using the Gemini API.
  - **Personalized Mixes & Recommendations:** Backend cron jobs regularly analyze your listening history to generate daily mixes, "Discover Weekly," "On Repeat," and "New Releases" playlists.

- **⚡ Real-Time Social Features:**

  - **Live Chat:** Instant messaging between mutual followers, built with **Socket.IO**.
  - **Friend Activity:** See what your friends are listening to in real-time.
  - Features typing indicators and read receipts for a polished experience.

- **🌐 Full Offline Support (PWA):**

  - Download albums, playlists, and mixes for a complete offline listening experience.
  - Uses **IndexedDB** for metadata and the **Cache API** for audio/image assets.
  - **Automatic Library Sync:** Intelligently updates your downloaded content when you reconnect.

- **🌐 Multi-Language Support:**

  - Fully internationalized frontend with support for English, Russian, and Ukrainian using `i18next`.

- **🛠️ Comprehensive Admin Dashboard:**
  - A complete interface to manage the music catalog, including songs, albums, and artists.
  - Supports bulk album creation from Spotify URLs and ZIP archives.

---

## 🏛️ Project Philosophy & Architecture

- **Frontend:** The React application is built on a modular and scalable architecture. State is managed with **Zustand**, using separate stores for different domains (player, auth, UI) to ensure maintainability. An offline-first approach is central to the design, providing a reliable experience regardless of network conditions.

- **Backend:** The Express.js server follows a classic MVC-like pattern, separating concerns into routes, controllers, models, and a robust service layer. This ensures that business logic is decoupled and testable. Real-time communication is cleanly handled by a dedicated Socket.IO module, while heavy computational tasks like generating recommendations are offloaded to scheduled cron jobs, keeping the API fast and responsive.

---

## 🛠️ Technologies Used

### Frontend

- **Framework:** React & TypeScript
- **Build Tool:** Vite
- **State Management:** Zustand
- **Styling:** Tailwind CSS & shadcn/ui
- **Routing:** React Router DOM
- **Data Fetching:** Axios
- **Real-Time:** Socket.IO Client
- **Offline:** IndexedDB, Service Workers, Cache API

### Backend

- **Runtime:** Node.js with Express.js
- **Language:** JavaScript (ESM)
- **Database:** MongoDB with Mongoose
- **Real-Time:** Socket.IO
- **File Handling:** `express-fileupload` for uploads, Sharp for image optimization
- **Scheduling:** `node-cron` for background recommendation jobs

### Authentication & Infrastructure

- **Authentication:** Firebase Authentication (Email/Password, Google OAuth)
- **File Storage:** Bunny.net CDN for optimized media delivery
- **AI Services:** Google Gemini API
- **Deployment:** Vercel (Frontend), Render (Backend), MongoDB Atlas (Database)

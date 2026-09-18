# Moodify Demucs (Modal)

POST JSON `{ "secret", "audio_url" }` — `audio_url` is a public HTTPS file (deemix MP3 staged on Bunny). Returns instrumental MP3 128 kbps.

## Setup

1. `pipx install modal` / `modal setup`
2. Secret `moodify-demucs` with `MODAL_DEMUCS_SECRET`
3. `modal deploy modal/demucs_app.py`
4. Backend `.env`: `MODAL_DEMUCS_URL`, `MODAL_DEMUCS_SECRET`, plus `DEEZER_ARL` / deemix for the API worker

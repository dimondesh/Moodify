# Moodify Demucs (Modal)

Separates vocals from a Bunny HLS URL and returns the instrumental as MP3 128 kbps.

## Setup

1. `pip install modal` and `modal setup`
2. Create secret `moodify-demucs` with `MODAL_DEMUCS_SECRET=<same as backend>`
3. `modal deploy modal/demucs_app.py`
4. Put the printed HTTPS URL in backend `.env` as `MODAL_DEMUCS_URL`
5. Set the same secret as `MODAL_DEMUCS_SECRET` in backend `.env`

Backend also needs Redis (BullMQ). Restart the API after setting env so the instrumental worker starts.

Note: Modal's default web proxy timeout is ~150s. Cold start + Demucs on a long track can exceed that on the first call; retries usually work once the model is cached on the volume. If it keeps timing out, switch the endpoint to spawn/poll or a dedicated Modal endpoint.

Optional: edit `gpu="T4"` in `demucs_app.py` to `H100` / `A100` if you prefer wall-clock over credit burn.

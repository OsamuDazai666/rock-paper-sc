# RPS Vision

A local rock-paper-scissors web app using MediaPipe Hand Landmarker for webcam gestures and an adaptive pattern ensemble for AI move selection. Webcam frames stay in the browser; only the locked move, score, and previous rounds are sent to the local backend.

The AI combines move-frequency, sequence, outcome, and response predictors, weighted by their past performance. It uses a uniform game-theoretic fallback when evidence is weak. The current player move is never passed to the predictor. This can exploit predictable play, but no fair rock-paper-scissors strategy can guarantee a win every round.

## Requirements

- Node.js 20.19+ or 22.12+
- Python 3.10+
- A webcam and a browser with camera support

## Backend

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/uvicorn app.main:app --app-dir backend --reload --port 8000
```

No AI model download or API key is required.

## Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 and allow camera access. Bring one hand into frame to start the countdown, then make or change your rock, paper, or scissors gesture until zero. The gesture recognized at zero is played. Manual move buttons are also available.

If the backend uses a different address, set `VITE_API_URL` in the frontend environment before starting Vite.

## Checks

```bash
cd frontend && npm run build && npm run lint
.venv/bin/python -m compileall backend/app
curl http://localhost:8000/api/health
```

# Pi Flashcards

A small personal flashcards app for the Raspberry Pi home server.

## Run locally

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

Frontend, in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173/flashcards/>. The local database is created at
`backend/data/flashcards.db` and is excluded from Git.

## Deploy

Push changes to `main`, then check [GitHub Actions](https://github.com/Evyats/pi-flashcards/actions).
Wait for **Build deploy branch** to turn green, then run on the Pi:

```bash
sudo /opt/pi-flashcards/app/deploy.sh
```

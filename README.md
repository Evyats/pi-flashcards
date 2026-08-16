# Pi Flashcards

A small personal flashcards app for the Raspberry Pi home server.

## First local run

Backend terminal:

```powershell
cd pi-flashcards\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

Frontend terminal:

```powershell
cd pi-flashcards\frontend
npm install
npm run dev
```

## Later local runs

Backend terminal:

```powershell
cd pi-flashcards\backend
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

Frontend terminal:

```powershell
cd pi-flashcards\frontend
npm run dev
```

Open <http://localhost:5173/flashcards/> on the computer. On a phone connected
to the same Wi-Fi, open `http://<computer-ip>:5173/flashcards/`. Find the
computer IP with `ipconfig` and allow Node/Python through Windows Firewall on
private networks if prompted.

The local database is created at `backend/data/flashcards.db` and is excluded
from Git.

Run the backend tests from the workspace root with:

```powershell
cd pi-flashcards\backend
pip install -r requirements-dev.txt
python -m unittest discover -s tests -v
```

Run the frontend state tests with:

```powershell
cd pi-flashcards\frontend
npm test
```

## Deploy

Push changes to `main`, then check [GitHub Actions](https://github.com/Evyats/pi-flashcards/actions).
Wait for **Build deploy branch** to turn green, then run on the Pi:

```bash
sudo /opt/pi-flashcards/app/deploy.sh
```

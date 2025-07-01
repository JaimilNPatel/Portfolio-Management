# Portfolio Manager

[![FastAPI](https://img.shields.io/badge/backend-FastAPI-blue)](https://fastapi.tiangolo.com/) [![React](https://img.shields.io/badge/frontend-React-blue)](https://react.dev/) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A full-stack portfolio management application for tracking stocks, mutual funds, ETFs, and more. Built with **FastAPI** (Python) for the backend and **React** (MUI) for the frontend.

---

## Features

- Add, update, and remove assets (stocks, mutual funds, ETFs, crypto, etc.)
- Real-time price fetching (Yahoo Finance, AMFI India)
- Multi-currency support with FX rates
- Portfolio analytics and summary
- Transaction history and audit
- Modern, responsive UI (Material-UI)
- Search and autocomplete for symbols

---

## Project Structure

```
Project/
  main.py              # FastAPI backend
  requirements.txt     # Backend dependencies
  portfolio.db         # SQLite database (auto-created)
  frontend/            # React frontend (MUI, Create React App)
    package.json       # Frontend dependencies
    src/               # React source code
```

---

## Getting Started

### 1. Backend (FastAPI)

#### Requirements
- Python 3.8+
- [pip](https://pip.pypa.io/en/stable/)

#### Setup
```bash
# Create and activate a virtual environment (Windows example)
python -m venv venv
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run the FastAPI server
uvicorn main:app --reload
```

The API will be available at [http://localhost:8000](http://localhost:8000)
- Interactive docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Frontend (React)

#### Requirements
- Node.js (v18+ recommended)
- npm

#### Setup
```bash
cd frontend
npm install
npm start
```

The app will run at [http://localhost:3000](http://localhost:3000)

---

## Usage

- Add assets using the **Add/Update Asset** button
- View portfolio summary, analytics, and transaction history
- Sell or delete assets as needed
- Switch base currency for portfolio valuation

---

## API Endpoints (Backend)

- `POST /portfolio/add` — Add or update an asset
- `POST /portfolio/remove` — Remove or sell an asset
- `GET /portfolio` — Get current portfolio
- `GET /price/{symbol}` — Get live price for a symbol
- `GET /mutualfund/list` — List all mutual funds (AMFI)
- `GET /mutualfund/nav` — Get NAV by code or name
- `GET /fxrate/{from}/{to}` — Get FX rate
- `GET /currencies` — List supported currencies
- `GET /history` — Transaction history

See [http://localhost:8000/docs](http://localhost:8000/docs) for full API documentation.

---

## Contributing

Pull requests and issues are welcome! Please open an issue to discuss your idea or bug before submitting a PR.

---

## License

MIT License. See [LICENSE](LICENSE) for details. 

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

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

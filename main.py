from fastapi import FastAPI, HTTPException, Depends, Query, Body
from pydantic import BaseModel
import yfinance as yf
from typing import List, Optional
from fastapi.responses import FileResponse
import os
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timedelta
import sqlite3
import requests
import pandas as pd
from io import StringIO

app = FastAPI()

@app.on_event("startup")
def on_startup():
    ensure_schema()
    Base.metadata.create_all(bind=engine)
    # Ensure available amount row exists
    db = SessionLocal()
    if not db.query(AvailableDB).first():
        db.add(AvailableDB(amount=0))
        db.commit()
    db.close()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = "sqlite:///./portfolio.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class AssetDB(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String, unique=True, index=True)
    asset_type = Column(String, default="stock")
    quantity = Column(Float)
    buy_price = Column(Float)
    currency = Column(String, default="USD")
    buy_date = Column(String, default=None)
    exchange = Column(String, default=None)
    sector = Column(String, default=None)
    industry = Column(String, default=None)
    notes = Column(String, default=None)
    precision = Column(Integer, default=2)
    last_updated = Column(String, default=None)
    icon = Column(String, default=None)
    fund_house = Column(String, default=None)
    manager = Column(String, default=None)
    expense_ratio = Column(Float, default=None)
    maturity_date = Column(String, default=None)
    interest_rate = Column(Float, default=None)
    purity = Column(String, default=None)
    storage = Column(String, default=None)
    name = Column(String, default=None)

class Asset(BaseModel):
    symbol: str
    asset_type: str = "stock"
    quantity: float
    buy_price: float
    currency: Optional[str] = None
    buy_date: Optional[str] = None
    exchange: Optional[str] = None
    sector: Optional[str] = None
    industry: Optional[str] = None
    notes: Optional[str] = None
    precision: Optional[int] = None
    icon: Optional[str] = None
    fund_house: Optional[str] = None
    manager: Optional[str] = None
    expense_ratio: Optional[float] = None
    maturity_date: Optional[str] = None
    interest_rate: Optional[float] = None
    purity: Optional[str] = None
    storage: Optional[str] = None

class TransactionDB(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    datetime = Column(String, default=lambda: datetime.now().isoformat())
    action = Column(String)
    symbol = Column(String)
    name = Column(String)
    asset_type = Column(String)
    quantity = Column(Float)
    price = Column(Float)
    value = Column(Float)
    pl = Column(Float)
    notes = Column(String)
    balance_after = Column(Float)

class AvailableDB(Base):
    __tablename__ = "available_amount"
    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float, default=0)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def round_decimal(val, places=6):
    return float(Decimal(val).quantize(Decimal(f'1.{{:0<{places}}}'.format('')),
                                        rounding=ROUND_HALF_UP))

def ensure_schema():
    db_path = './portfolio.db'
    expected_columns = {
        'id', 'symbol', 'quantity', 'buy_price', 'currency', 'buy_date', 'asset_type', 'exchange', 'sector', 'industry', 'notes',
        'precision', 'last_updated', 'icon', 'fund_house', 'manager', 'expense_ratio', 'maturity_date', 'interest_rate', 'purity', 'storage', 'name'
    }

    if not os.path.exists(db_path):
        return

    conn = None
    try:
        conn = sqlite3.connect(db_path)
        c = conn.cursor()
        c.execute("PRAGMA table_info(assets);")
        cols = {row[1] for row in c.fetchall()}
        
        missing_cols = expected_columns - cols
        if missing_cols:
            conn.close()
            print("\n" + "="*60)
            print("FATAL: DATABASE SCHEMA MISMATCH")
            print("Your 'portfolio.db' file is out of date.")
            print(f"The following columns are missing: {', '.join(missing_cols)}")
            print("\n ==> Please STOP the server and DELETE the 'portfolio.db' file. <== ")
            print("The server will create a new one on restart.")
            print("="*60 + "\n")
            os._exit(1)
            
    except Exception as e:
        print(f"An error occurred while checking the database schema: {e}")
        print("\n ==> Please STOP the server and DELETE the 'portfolio.db' file. <== \n")
        os._exit(1)
    finally:
        if conn:
            conn.close()

# Decimal precision by asset type
def get_precision(asset_type):
    return {
        'crypto': 8,
        'stock': 4,
        'mutual_fund': 3,
        'gold': 3,
        'fixed_income': 2,
        'real_estate': 2,
        'commodity': 2,
    }.get(asset_type, 2)

# --- AMFI Mutual Fund NAV Support ---
AMFI_URL = "https://www.amfiindia.com/spages/NAVAll.txt"
_amfi_cache = {"data": None, "timestamp": None}

def get_amfi_data():
    # Cache for 1 hour
    if _amfi_cache["data"] is not None and _amfi_cache["timestamp"] > datetime.now() - timedelta(hours=1):
        return _amfi_cache["data"]
    try:
        response = requests.get(AMFI_URL)
        # AMFI file is ; separated, skip first row (header), skip blank lines
        lines = [line for line in response.text.splitlines() if line.strip() and not line.startswith('Open Ended') and not line.startswith('Scheme Code')]
        data = '\n'.join(lines)
        df = pd.read_csv(StringIO(data), sep=';', header=None, names=[
            'Scheme Code', 'ISIN Div Payout/ ISIN Growth', 'ISIN Div Reinvestment', 'Scheme Name', 'Net Asset Value', 'Date'
        ], dtype=str)
        print(f"AMFI DataFrame loaded: {len(df)} rows")
        print(df.head())
        _amfi_cache["data"] = df
        _amfi_cache["timestamp"] = datetime.now()
        return df
    except Exception as e:
        print(f"AMFI data fetch/parse error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load AMFI data: {e}")

def find_mf_by_code(code):
    df = get_amfi_data()
    row = df[df['Scheme Code'].astype(str) == str(code)]
    if not row.empty:
        return row.iloc[0].to_dict()
    return None

def find_mf_by_name(name):
    df = get_amfi_data()
    row = df[df['Scheme Name'].str.contains(name, case=False, na=False)]
    if not row.empty:
        return row.iloc[0].to_dict()
    return None

@app.get("/mutualfund/list")
def list_mutual_funds():
    df = get_amfi_data()
    # Only keep rows with a numeric Scheme Code and non-empty Scheme Name
    df = df[df['Scheme Code'].str.isdigit() & df['Scheme Name'].notnull()]
    return df[['Scheme Code', 'Scheme Name', 'Net Asset Value', 'Date']].to_dict(orient='records')

@app.get("/mutualfund/nav")
def get_mutual_fund_nav(code: str = Query(None), name: str = Query(None)):
    if code:
        nav = find_mf_by_code(code)
        if nav:
            return nav
    if name:
        nav = find_mf_by_name(name)
        if nav:
            return nav
    return {"error": "Not found"}

@app.get("/mutualfund/price/{code}")
def get_mutual_fund_price(code: str):
    print(f"Looking up mutual fund code: {code}")
    df = get_amfi_data()
    if df.empty:
        print("AMFI DataFrame is empty!")
        raise HTTPException(status_code=500, detail="AMFI data is empty.")
    mf = find_mf_by_code(code)
    if mf:
        return {"code": code, "name": mf['Scheme Name'], "nav": mf['Net Asset Value'], "date": mf['Date']}
    print(f"Code {code} not found in AMFI data.")
    raise HTTPException(status_code=404, detail="Mutual fund not found")

def classify_mutual_fund(scheme_name: str) -> dict:
    """Classifies a mutual fund's sector and industry based on its name."""
    name = scheme_name.lower()
    
    sector = "Other"
    industry = "N/A"

    # Sector Keywords (priority matters)
    sector_map = {
        "Thematic": ["pharma", "banking", "infra", "technology", "fmcg", "consumption", "digital"],
        "Index/ETF": ["index", "etf", "nifty", "sensex"],
        "Commodity": ["gold", "silver"],
        "Debt": ["debt", "gilt", "bond", "income", "liquid", "money market", "overnight", "short duration", "medium duration", "long duration", "corporate bond"],
        "Hybrid": ["hybrid", "balanced", "multi asset", "arbitrage", "advantage"],
        "Equity": ["equity", "multi cap", "flexi cap", "large cap", "mid cap", "small cap", "elss", "tax saver", "focused", "value"],
    }

    for s, keywords in sector_map.items():
        if any(k in name for k in keywords):
            sector = s
            break

    # Industry / Sub-category Keywords
    industry_map = {
        # Equity
        "Large & Mid Cap": ["large & mid cap", "large and mid cap"],
        "Large Cap": ["large cap"],
        "Mid Cap": ["mid cap"],
        "Small Cap": ["small cap"],
        "Multi Cap": ["multi cap"],
        "Flexi Cap": ["flexi cap"],
        "ELSS / Tax Saver": ["elss", "tax saver"],
        "Focused": ["focused"],
        "Value": ["value"],
        "Dividend Yield": ["dividend yield"],
        # Debt
        "Gilt Fund": ["gilt"],
        "Liquid Fund": ["liquid"],
        "Overnight Fund": ["overnight"],
        "Short Duration": ["short duration"],
        "Medium Duration": ["medium duration"],
        "Long Duration": ["long duration"],
        "Corporate Bond": ["corporate bond"],
        # Hybrid
        "Balanced Advantage": ["balanced advantage", "dynamic asset allocation"],
        "Aggressive Hybrid": ["aggressive hybrid"],
    }
    
    for i, keywords in industry_map.items():
        if any(k in name for k in keywords):
            industry = i
            break
            
    return {"sector": sector, "industry": industry}

# Helper to get FX rate
def get_fx(symbol_from, symbol_to):
    if symbol_from == symbol_to:
        return 1.0
    try:
        res = requests.get(f"http://localhost:8000/fxrate/{symbol_from}/{symbol_to}")
        if res.status_code == 200:
            return res.json().get('rate', 1.0)
    except Exception:
        pass
    return 1.0

@app.post("/portfolio/add")
def add_asset(asset: Asset, db: Session = Depends(get_db), edit: bool = Query(False)):
    symbol = asset.symbol.strip()
    asset_type = asset.asset_type.lower()
    precision = asset.precision if asset.precision is not None else get_precision(asset_type)
    qty = round_decimal(asset.quantity, precision)
    buy_price = round_decimal(asset.buy_price, 4) if asset.buy_price is not None else 0
    buy_date = asset.buy_date or datetime.utcnow().isoformat()
    last_updated = datetime.utcnow().isoformat()
    db_asset = db.query(AssetDB).filter(AssetDB.symbol == symbol).first()
    name = None
    final_sector = asset.sector
    final_industry = asset.industry
    # --- Mutual Fund logic ---
    if asset_type == "mutual_fund":
        mf = find_mf_by_code(symbol)
        if not mf and asset.symbol and not asset.symbol.isdigit():
            mf = find_mf_by_name(asset.symbol)
        if mf:
            name = mf['Scheme Name']
            classification = classify_mutual_fund(name)
            final_sector = classification.get('sector')
            final_industry = classification.get('industry')
            nav = float(mf['Net Asset Value']) if mf['Net Asset Value'] else None
            if not buy_price:
                buy_price = nav
        else:
            raise HTTPException(status_code=404, detail="Mutual fund not found in AMFI list.")
    else:
        yf_name = None
        if not db_asset:
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.info
                yf_name = info.get('longName') or info.get('shortName') or info.get('name') or None
            except Exception:
                yf_name = None
        name = yf_name
    if not buy_price:
        buy_price = round_decimal(asset.buy_price, 4)
    # --- Transaction and available amount logic ---
    available = db.query(AvailableDB).first()
    available_amount = available.amount if available else 0
    tx_action = None
    tx_qty = qty
    tx_price = buy_price
    tx_value = qty * buy_price if buy_price is not None else 0
    tx_pl = None
    tx_notes = asset.notes
    tx_balance_after = available_amount
    if db_asset:
        if edit:
            if qty < 1e-6:
                db.delete(db_asset)
                db.commit()
                # Record DELETE transaction
                tx_action = "DELETE"
                tx_qty = db_asset.quantity
                tx_price = db_asset.buy_price
                tx_value = db_asset.quantity * db_asset.buy_price
                tx_balance_after = available_amount
                db.add(TransactionDB(
                    datetime=datetime.now().isoformat(),
                    action=tx_action,
                    symbol=symbol,
                    name=db_asset.name or name,
                    asset_type=asset_type,
                    quantity=tx_qty,
                    price=tx_price,
                    value=tx_value,
                    pl=None,
                    notes="Asset deleted",
                    balance_after=tx_balance_after
                ))
                db.commit()
                return {"message": f"Removed {symbol} from portfolio (quantity zero)."}
            db_asset.quantity = qty
            db_asset.buy_price = buy_price
            tx_action = "UPDATE"
        else:
            total_quantity = round_decimal(db_asset.quantity + qty, precision)
            if total_quantity < 1e-6:
                db.delete(db_asset)
                db.commit()
                # Record DELETE transaction
                tx_action = "DELETE"
                tx_qty = db_asset.quantity
                tx_price = db_asset.buy_price
                tx_value = db_asset.quantity * db_asset.buy_price
                tx_balance_after = available_amount
                db.add(TransactionDB(
                    datetime=datetime.now().isoformat(),
                    action=tx_action,
                    symbol=symbol,
                    name=db_asset.name or name,
                    asset_type=asset_type,
                    quantity=tx_qty,
                    price=tx_price,
                    value=tx_value,
                    pl=None,
                    notes="Asset deleted (quantity zero after add)",
                    balance_after=tx_balance_after
                ))
                db.commit()
                return {"message": f"Removed {symbol} from portfolio (quantity zero)."}
            avg_price = round_decimal((db_asset.quantity * db_asset.buy_price + qty * buy_price) / total_quantity, 4)
            db_asset.quantity = total_quantity
            db_asset.buy_price = avg_price
            tx_action = "BUY"
            # Decrease available amount for buy
            if available:
                available.amount -= tx_value
                tx_balance_after = available.amount
    else:
        if qty < 1e-6:
            raise HTTPException(status_code=400, detail="Quantity must be greater than zero.")
        db_asset = AssetDB(
            symbol=symbol,
            asset_type=asset_type,
            quantity=qty,
            buy_price=buy_price,
            currency=asset.currency or ("INR" if asset_type == "mutual_fund" else "USD"),
            buy_date=buy_date,
            exchange=asset.exchange,
            sector=final_sector,
            industry=final_industry,
            notes=asset.notes,
            precision=precision,
            last_updated=last_updated,
            icon=asset.icon,
            fund_house=asset.fund_house,
            manager=asset.manager,
            expense_ratio=asset.expense_ratio,
            maturity_date=asset.maturity_date,
            interest_rate=asset.interest_rate,
            purity=asset.purity,
            storage=asset.storage,
            name=name
        )
        db.add(db_asset)
        tx_action = "BUY"
        # Decrease available amount for buy
        if available:
            available.amount -= tx_value
            tx_balance_after = available.amount
    db.commit()
    # Record transaction if action is set
    if tx_action:
        db.add(TransactionDB(
            datetime=datetime.now().isoformat(),
            action=tx_action,
            symbol=symbol,
            name=name,
            asset_type=asset_type,
            quantity=tx_qty,
            price=tx_price,
            value=tx_value,
            pl=tx_pl,
            notes=tx_notes,
            balance_after=tx_balance_after
        ))
    db.commit()
    return {"message": f"Added/updated {symbol} in portfolio.", "asset_type": asset_type}

@app.post("/portfolio/remove")
def remove_asset(symbol: str, quantity: float = None, db: Session = Depends(get_db)):
    symbol = symbol.upper()
    db_asset = db.query(AssetDB).filter(AssetDB.symbol == symbol).first()
    if not db_asset:
        raise HTTPException(status_code=404, detail="Asset not found in portfolio.")
    available = db.query(AvailableDB).first()
    available_amount = available.amount if available else 0
    if quantity is None:
        # Full delete
        tx_action = "DELETE"
        tx_qty = db_asset.quantity
        tx_price = db_asset.buy_price
        tx_value = db_asset.quantity * db_asset.buy_price
        tx_pl = None
        tx_notes = "Asset deleted"
        db.delete(db_asset)
        db.commit()
        tx_balance_after = available_amount
        db.add(TransactionDB(
            datetime=datetime.now().isoformat(),
            action=tx_action,
            symbol=symbol,
            name=db_asset.name,
            asset_type=db_asset.asset_type,
            quantity=tx_qty,
            price=tx_price,
            value=tx_value,
            pl=tx_pl,
            notes=tx_notes,
            balance_after=tx_balance_after
        ))
        db.commit()
        return {"message": f"Removed {symbol} from portfolio."}
    quantity = round_decimal(quantity)
    if quantity > db_asset.quantity + 1e-6:
        raise HTTPException(status_code=400, detail="Cannot sell more than you own.")
    new_quantity = round_decimal(db_asset.quantity - quantity)
    # Calculate profit/loss for this sale
    sell_price = None
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        sell_price = info.get('regularMarketPrice')
        if sell_price is None:
            data = ticker.history(period="1d")
            if not data.empty:
                sell_price = float(data['Close'].iloc[-1])
    except Exception:
        sell_price = db_asset.buy_price
    if sell_price is None:
        sell_price = db_asset.buy_price
    pl = (sell_price - db_asset.buy_price) * quantity
    # Update available amount for sell
    if available:
        available.amount += sell_price * quantity
        tx_balance_after = available.amount
    else:
        tx_balance_after = available_amount
    if new_quantity < 1e-6:
        db.delete(db_asset)
        db.commit()
        tx_action = "SELL"
        db.add(TransactionDB(
            datetime=datetime.now().isoformat(),
            action=tx_action,
            symbol=symbol,
            name=db_asset.name,
            asset_type=db_asset.asset_type,
            quantity=quantity,
            price=sell_price,
            value=sell_price * quantity,
            pl=pl,
            notes="Sold all",
            balance_after=tx_balance_after
        ))
        db.commit()
        return {"message": f"Removed {symbol} from portfolio (sold all)."}
    db_asset.quantity = new_quantity
    db.commit()
    tx_action = "SELL"
    db.add(TransactionDB(
        datetime=datetime.now().isoformat(),
        action=tx_action,
        symbol=symbol,
        name=db_asset.name,
        asset_type=db_asset.asset_type,
        quantity=quantity,
        price=sell_price,
        value=sell_price * quantity,
        pl=pl,
        notes="Partial sell",
        balance_after=tx_balance_after
    ))
    db.commit()
    return {"message": f"Sold {quantity} of {symbol}. Remaining: {new_quantity}"}

@app.get("/portfolio")
def get_portfolio(db: Session = Depends(get_db)):
    result = []
    total_value = 0.0
    total_cost = 0.0
    assets = db.query(AssetDB).all()
    for asset in assets:
        price = None
        # --- Mutual Fund logic ---
        if asset.asset_type == "mutual_fund":
            mf = find_mf_by_code(asset.symbol)
            if mf and pd.notnull(mf['Net Asset Value']):
                price = float(mf['Net Asset Value'])
        else:
            try:
                ticker = yf.Ticker(asset.symbol)
                info = ticker.info
                # Try live price first
                price = info.get('regularMarketPrice')
                if price is None:
                    data = ticker.history(period="1d")
                    if not data.empty:
                        price = float(data['Close'].iloc[-1])
            except Exception:
                price = None
        if price is None:
            price = asset.buy_price
        value = round_decimal(price * asset.quantity, asset.precision)
        cost = round_decimal(asset.buy_price * asset.quantity, asset.precision)
        total_value += value
        total_cost += cost
        result.append({
            'symbol': asset.symbol,
            'name': asset.name,
            'asset_type': asset.asset_type,
            'quantity': round_decimal(asset.quantity, asset.precision),
            'buy_price': round_decimal(asset.buy_price, 4),
            'current_price': round_decimal(price, 4) if price else None,
            'current_value': value,
            'profit_loss': round_decimal(value - cost, 2),
            'currency': asset.currency,
            'buy_date': asset.buy_date,
            'exchange': asset.exchange,
            'sector': asset.sector,
            'industry': asset.industry,
            'notes': asset.notes,
            'precision': asset.precision,
            'last_updated': asset.last_updated,
            'icon': asset.icon,
            'fund_house': asset.fund_house,
            'manager': asset.manager,
            'expense_ratio': asset.expense_ratio,
            'maturity_date': asset.maturity_date,
            'interest_rate': asset.interest_rate,
            'purity': asset.purity,
            'storage': asset.storage
        })
    return {
        'portfolio': result,
        'total_value': round_decimal(total_value, 2),
        'total_cost': round_decimal(total_cost, 2),
        'total_profit_loss': round_decimal(total_value - total_cost, 2)
    }

# --- Exchange inference helper ---
def infer_exchange(symbol, fallback=None):
    suffix_map = {
        '.NS': 'NSE', '.BSE': 'BSE', '.BO': 'BSE', '.NSE': 'NSE', '.MCX': 'MCX', '.NFO': 'NSE', '.CDS': 'NSE', '.BFO': 'BSE',
        '.AX': 'ASX', '.L': 'LSE', '.TO': 'TSX', '.V': 'TSXV', '.HE': 'OMXH', '.ST': 'OMX', '.CO': 'OMXC', '.OL': 'OSE', '.MI': 'Borsa Italiana', '.VI': 'VIE', '.NZ': 'NZX', '.JK': 'IDX', '.IS': 'BIST', '.TA': 'TASE', '.IR': 'TASE', '.CA': 'CSE', '.PL': 'WSE', '.SG': 'SGX', '.TW': 'TWSE', '.TWO': 'TPEX', '.BK': 'SET', '.JO': 'JSE', '.IL': 'TASE', '.IC': 'ICE', '.AT': 'ATHEX', '.BR': 'Euronext', '.LS': 'Euronext', '.AS': 'Euronext', '.DU': 'XETRA', '.DE': 'XETRA', '.BE': 'XETRA', '.MU': 'XETRA', '.XETRA': 'XETRA', '.SR': 'Tadawul', '.QA': 'QE', '.OM': 'MSM', '.KW': 'Boursa Kuwait', '.AE': 'ADX', '.AD': 'ADX', '.SM': 'BME', '.MC': 'BME', '.PA': 'Euronext', '.F': 'Frankfurt', '.SA': 'B3', '.MX': 'BMV', '.HK': 'HKEX', '.SH': 'SSE', '.SZ': 'SZSE', '.SS': 'SSE', '.BINANCE': 'Binance', '.COIN': 'Coinbase', '.KRAKEN': 'Kraken', '.KRX': 'KRX', '.KOSDAQ': 'KOSDAQ', '.KOSPI': 'KRX', '.AMC': 'AMC Mutual Fund',
    }
    for suf, exch in suffix_map.items():
        if symbol.upper().endswith(suf):
            return exch
    return fallback or 'Unknown'

@app.get("/price/{symbol}")
def get_price(symbol: str):
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        # Try live price first
        price = info.get('regularMarketPrice')
        data = None
        if price is None:
            data = ticker.history(period="1d")
            if not data.empty:
                price = float(data['Close'].iloc[-1])
        if price is None:
            # Try to get quoteType for better error handling
            quote_type = None
            try:
                quote_type = info.get('quoteType') if info else None
            except Exception:
                quote_type = None
            name = info.get('longName') if info else symbol
            description = info.get('longBusinessSummary') if info else ''
            if quote_type == 'CRYPTOCURRENCY':
                coin_name = info.get('name') or name or symbol
                return {
                    "symbol": symbol,
                    "price": None,
                    "currency": info.get('currency') if info else 'USD',
                    "name": name,
                    "sector": "Cryptocurrency",
                    "industry": coin_name,
                    "marketCap": info.get('marketCap') if info else None,
                    "exchange": info.get('exchange') or infer_exchange(symbol),
                    "website": info.get('website') if info else None,
                    "description": description,
                    "info_available": bool(info)
                }
            elif quote_type == 'ETF':
                # Infer sector/industry from name/description
                sector = 'ETF'
                industry = 'N/A'
                desc = (name or '') + ' ' + (description or '')
                desc_lower = desc.lower()
                if 'bitcoin' in desc_lower:
                    sector = 'Digital Assets'
                    industry = 'Bitcoin ETF'
                elif 'gold' in desc_lower:
                    sector = 'Commodity'
                    industry = 'Gold ETF'
                else:
                    # Keyword-based industry inference
                    etf_industries = [
                        (['technology', 'tech'], 'Technology ETF'),
                        (['healthcare', 'health care', 'pharma', 'biotech'], 'Healthcare ETF'),
                        (['energy', 'oil', 'gas'], 'Energy ETF'),
                        (['financial', 'bank', 'finance', 'insurance'], 'Financial ETF'),
                        (['consumer', 'retail', 'staple', 'discretionary'], 'Consumer ETF'),
                        (['industrial', 'manufacturing', 'industry'], 'Industrial ETF'),
                        (['real estate', 'reit'], 'Real Estate ETF'),
                        (['utilities', 'utility'], 'Utilities ETF'),
                        (['materials', 'mining', 'chemical'], 'Materials ETF'),
                        (['communication', 'media', 'telecom'], 'Communication ETF'),
                        (['infrastructure'], 'Infrastructure ETF'),
                        (['dividend'], 'Dividend ETF'),
                        (['bond', 'fixed income', 'debt'], 'Bond ETF'),
                        (['emerging market'], 'Emerging Market ETF'),
                    ]
                    for keywords, label in etf_industries:
                        if any(k in desc_lower for k in keywords):
                            industry = label
                            break
                return {
                    "symbol": symbol,
                    "price": None,
                    "currency": info.get('currency') if info else 'USD',
                    "name": name,
                    "sector": sector,
                    "industry": industry,
                    "marketCap": info.get('marketCap') if info else None,
                    "exchange": info.get('exchange') or infer_exchange(symbol),
                    "website": info.get('website') if info else None,
                    "description": description,
                    "info_available": bool(info)
                }
            else:
                raise HTTPException(status_code=404, detail="Symbol not found or no price data.")
        # Determine asset type for defaults
        quote_type = None
        try:
            quote_type = info.get('quoteType') if info else None
        except Exception:
            quote_type = None
        name = info.get('longName') if info else symbol
        description = info.get('longBusinessSummary') if info else ''
        sector = info.get('sector') if info and info.get('sector') else None
        industry = info.get('industry') if info and info.get('industry') else None
        if quote_type == 'ETF':
            # Infer sector/industry from name/description
            desc = (name or '') + ' ' + (description or '')
            desc_lower = desc.lower()
            if not sector:
                if 'bitcoin' in desc_lower:
                    sector = 'Digital Assets'
                elif 'gold' in desc_lower:
                    sector = 'Commodity'
                else:
                    sector = 'ETF'
            if not industry:
                if 'bitcoin' in desc_lower:
                    industry = 'Bitcoin ETF'
                elif 'gold' in desc_lower:
                    industry = 'Gold ETF'
                else:
                    etf_industries = [
                        (['technology', 'tech'], 'Technology ETF'),
                        (['healthcare', 'health care', 'pharma', 'biotech'], 'Healthcare ETF'),
                        (['energy', 'oil', 'gas'], 'Energy ETF'),
                        (['financial', 'bank', 'finance', 'insurance'], 'Financial ETF'),
                        (['consumer', 'retail', 'staple', 'discretionary'], 'Consumer ETF'),
                        (['industrial', 'manufacturing', 'industry'], 'Industrial ETF'),
                        (['real estate', 'reit'], 'Real Estate ETF'),
                        (['utilities', 'utility'], 'Utilities ETF'),
                        (['materials', 'mining', 'chemical'], 'Materials ETF'),
                        (['communication', 'media', 'telecom'], 'Communication ETF'),
                        (['infrastructure'], 'Infrastructure ETF'),
                        (['dividend'], 'Dividend ETF'),
                        (['bond', 'fixed income', 'debt'], 'Bond ETF'),
                        (['emerging market'], 'Emerging Market ETF'),
                    ]
                    for keywords, label in etf_industries:
                        if any(k in desc_lower for k in keywords):
                            industry = label
                            break
        else:
            industry = 'N/A'
        if quote_type == 'CRYPTOCURRENCY':
            sector = 'Cryptocurrency'
            industry = info.get('name') or name or symbol
        return {
            "symbol": symbol,
            "price": float(price),
            "currency": info.get('currency') if info else None,
            "name": name,
            "sector": sector,
            "industry": industry,
            "marketCap": info.get('marketCap') if info else None,
            "exchange": info.get('exchange') or infer_exchange(symbol),
            "website": info.get('website') if info else None,
            "description": description,
            "info_available": bool(info)
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch info: {str(e)}")

@app.get('/fxrate/{from_currency}/{to_currency}')
def get_fx_rate(from_currency: str, to_currency: str):
    if from_currency.upper() == to_currency.upper():
        return {"rate": 1.0}
    symbol = f"{from_currency.upper()}{to_currency.upper()}=X"
    ticker = yf.Ticker(symbol)
    data = ticker.history(period='1d')
    if not data.empty:
        rate = data['Close'].iloc[-1]
        return {"rate": float(rate)}
    # Try the reverse pair if not found
    symbol_rev = f"{to_currency.upper()}{from_currency.upper()}=X"
    ticker_rev = yf.Ticker(symbol_rev)
    data_rev = ticker_rev.history(period='1d')
    if not data_rev.empty:
        rate = data_rev['Close'].iloc[-1]
        if rate != 0:
            return {"rate": 1/float(rate)}
    raise HTTPException(status_code=404, detail="FX rate not found")

@app.get('/currencies')
def get_currencies():
    # Complete ISO 4217 currency list (static for now)
    return [
        {"code": "USD", "label": "US Dollar", "symbol": "$"},
        {"code": "INR", "label": "Indian Rupee", "symbol": "₹"},
        {"code": "EUR", "label": "Euro", "symbol": "€"},
        {"code": "GBP", "label": "British Pound", "symbol": "£"},
        {"code": "JPY", "label": "Japanese Yen", "symbol": "¥"},
        {"code": "KRW", "label": "Korean Won", "symbol": "₩"},
        {"code": "HKD", "label": "Hong Kong Dollar", "symbol": "HK$"},
        {"code": "CNY", "label": "Chinese Yuan", "symbol": "¥"},
        {"code": "AUD", "label": "Australian Dollar", "symbol": "A$"},
        {"code": "CAD", "label": "Canadian Dollar", "symbol": "C$"},
        {"code": "CHF", "label": "Swiss Franc", "symbol": "Fr"},
        {"code": "SGD", "label": "Singapore Dollar", "symbol": "S$"},
        {"code": "BTC", "label": "Bitcoin", "symbol": "₿"},
        {"code": "ETH", "label": "Ethereum", "symbol": "Ξ"},
        {"code": "ZAR", "label": "South African Rand", "symbol": "R"},
        {"code": "BRL", "label": "Brazilian Real", "symbol": "R$"},
        {"code": "RUB", "label": "Russian Ruble", "symbol": "₽"},
        {"code": "MXN", "label": "Mexican Peso", "symbol": "$"},
        {"code": "SEK", "label": "Swedish Krona", "symbol": "kr"},
        {"code": "NOK", "label": "Norwegian Krone", "symbol": "kr"},
        {"code": "DKK", "label": "Danish Krone", "symbol": "kr"},
        {"code": "PLN", "label": "Polish Zloty", "symbol": "zł"},
        {"code": "TRY", "label": "Turkish Lira", "symbol": "₺"},
        {"code": "IDR", "label": "Indonesian Rupiah", "symbol": "Rp"},
        {"code": "THB", "label": "Thai Baht", "symbol": "฿"},
        {"code": "MYR", "label": "Malaysian Ringgit", "symbol": "RM"},
        {"code": "PHP", "label": "Philippine Peso", "symbol": "₱"},
        {"code": "ILS", "label": "Israeli Shekel", "symbol": "₪"},
        {"code": "NZD", "label": "New Zealand Dollar", "symbol": "$"},
        {"code": "SAR", "label": "Saudi Riyal", "symbol": "ر.س"},
        {"code": "EGP", "label": "Egyptian Pound", "symbol": "ج.م"},
        {"code": "AED", "label": "UAE Dirham", "symbol": "د.إ"},
        {"code": "KWD", "label": "Kuwaiti Dinar", "symbol": "د.ك"},
        {"code": "QAR", "label": "Qatari Riyal", "symbol": "ر.ق"},
        {"code": "BHD", "label": "Bahraini Dinar", "symbol": "ب.د"},
        {"code": "OMR", "label": "Omani Rial", "symbol": "ر.ع."},
        {"code": "JOD", "label": "Jordanian Dinar", "symbol": "د.ا"},
        {"code": "PKR", "label": "Pakistani Rupee", "symbol": "₨"},
        {"code": "LKR", "label": "Sri Lankan Rupee", "symbol": "₨"},
        {"code": "BDT", "label": "Bangladeshi Taka", "symbol": "৳"},
        {"code": "VND", "label": "Vietnamese Dong", "symbol": "₫"},
        {"code": "NGN", "label": "Nigerian Naira", "symbol": "₦"},
        {"code": "COP", "label": "Colombian Peso", "symbol": "$"},
        {"code": "ARS", "label": "Argentine Peso", "symbol": "$"},
        {"code": "CLP", "label": "Chilean Peso", "symbol": "$"},
        {"code": "CZK", "label": "Czech Koruna", "symbol": "Kč"},
        {"code": "HUF", "label": "Hungarian Forint", "symbol": "Ft"},
        {"code": "RON", "label": "Romanian Leu", "symbol": "lei"},
        {"code": "UAH", "label": "Ukrainian Hryvnia", "symbol": "₴"},
        {"code": "HRK", "label": "Croatian Kuna", "symbol": "kn"},
        {"code": "BGN", "label": "Bulgarian Lev", "symbol": "лв"},
        {"code": "ISK", "label": "Icelandic Krona", "symbol": "kr"},
        {"code": "GHS", "label": "Ghanaian Cedi", "symbol": "₵"},
        {"code": "KES", "label": "Kenyan Shilling", "symbol": "KSh"},
        {"code": "TZS", "label": "Tanzanian Shilling", "symbol": "TSh"},
        {"code": "UGX", "label": "Ugandan Shilling", "symbol": "USh"},
        {"code": "MAD", "label": "Moroccan Dirham", "symbol": "د.م."},
        {"code": "DZD", "label": "Algerian Dinar", "symbol": "دج"},
        {"code": "TND", "label": "Tunisian Dinar", "symbol": "د.ت"},
        {"code": "XOF", "label": "West African CFA franc", "symbol": "CFA"},
        {"code": "XAF", "label": "Central African CFA franc", "symbol": "FCFA"},
        {"code": "XCD", "label": "East Caribbean Dollar", "symbol": "$"},
        {"code": "BSD", "label": "Bahamian Dollar", "symbol": "$"},
        {"code": "BBD", "label": "Barbadian Dollar", "symbol": "$"},
        {"code": "TTD", "label": "Trinidad and Tobago Dollar", "symbol": "$"},
        {"code": "JMD", "label": "Jamaican Dollar", "symbol": "$"},
        {"code": "DOP", "label": "Dominican Peso", "symbol": "$"},
        {"code": "PEN", "label": "Peruvian Sol", "symbol": "S/."},
        {"code": "UYU", "label": "Uruguayan Peso", "symbol": "$U"},
        {"code": "BOB", "label": "Bolivian Boliviano", "symbol": "Bs."},
        {"code": "PYG", "label": "Paraguayan Guarani", "symbol": "₲"},
        {"code": "VEF", "label": "Venezuelan Bolívar", "symbol": "Bs."},
        {"code": "CRC", "label": "Costa Rican Colon", "symbol": "₡"},
        {"code": "GTQ", "label": "Guatemalan Quetzal", "symbol": "Q"},
        {"code": "HNL", "label": "Honduran Lempira", "symbol": "L"},
        {"code": "NIO", "label": "Nicaraguan Córdoba", "symbol": "C$"},
        {"code": "BZD", "label": "Belize Dollar", "symbol": "$"},
        {"code": "SVC", "label": "Salvadoran Colón", "symbol": "₡"},
        {"code": "HTG", "label": "Haitian Gourde", "symbol": "G"},
        {"code": "SRD", "label": "Surinamese Dollar", "symbol": "$"},
        {"code": "ANG", "label": "Netherlands Antillean Guilder", "symbol": "ƒ"},
        {"code": "AWG", "label": "Aruban Florin", "symbol": "ƒ"},
        {"code": "BMD", "label": "Bermudian Dollar", "symbol": "$"},
        {"code": "KYD", "label": "Cayman Islands Dollar", "symbol": "$"},
        {"code": "TTD", "label": "Trinidad and Tobago Dollar", "symbol": "$"},
        {"code": "XPF", "label": "CFP Franc", "symbol": "₣"},
        {"code": "FJD", "label": "Fijian Dollar", "symbol": "$"},
        {"code": "PGK", "label": "Papua New Guinean Kina", "symbol": "K"},
        {"code": "WST", "label": "Samoan Tala", "symbol": "T"},
        {"code": "TOP", "label": "Tongan Paʻanga", "symbol": "T$"},
        {"code": "VUV", "label": "Vanuatu Vatu", "symbol": "Vt"},
        {"code": "SBD", "label": "Solomon Islands Dollar", "symbol": "$"},
        {"code": "KZT", "label": "Kazakhstani Tenge", "symbol": "₸"},
        {"code": "UZS", "label": "Uzbekistani Soʻm", "symbol": "soʻm"},
        {"code": "GEL", "label": "Georgian Lari", "symbol": "₾"},
        {"code": "AZN", "label": "Azerbaijani Manat", "symbol": "₼"},
        {"code": "AMD", "label": "Armenian Dram", "symbol": "֏"},
        {"code": "KGS", "label": "Kyrgyzstani Som", "symbol": "с"},
        {"code": "TJS", "label": "Tajikistani Somoni", "symbol": "ЅМ"},
        {"code": "MNT", "label": "Mongolian Tögrög", "symbol": "₮"},
        {"code": "MOP", "label": "Macanese Pataca", "symbol": "MOP$"},
        {"code": "TWD", "label": "New Taiwan Dollar", "symbol": "NT$"},
        {"code": "HKD", "label": "Hong Kong Dollar", "symbol": "HK$"},
        {"code": "SGD", "label": "Singapore Dollar", "symbol": "S$"},
        {"code": "BND", "label": "Brunei Dollar", "symbol": "$"},
        {"code": "MMK", "label": "Burmese Kyat", "symbol": "K"},
        {"code": "LAK", "label": "Lao Kip", "symbol": "₭"},
        {"code": "KHR", "label": "Cambodian Riel", "symbol": "៛"},
        {"code": "KPW", "label": "North Korean Won", "symbol": "₩"},
        {"code": "MVR", "label": "Maldivian Rufiyaa", "symbol": "Rf"},
        {"code": "SCR", "label": "Seychellois Rupee", "symbol": "₨"},
        {"code": "MUR", "label": "Mauritian Rupee", "symbol": "₨"},
        {"code": "NPR", "label": "Nepalese Rupee", "symbol": "₨"},
        {"code": "AFN", "label": "Afghan Afghani", "symbol": "؋"},
        {"code": "IRR", "label": "Iranian Rial", "symbol": "﷼"},
        {"code": "IQD", "label": "Iraqi Dinar", "symbol": "ع.د"},
        {"code": "SYP", "label": "Syrian Pound", "symbol": "£"},
        {"code": "LBP", "label": "Lebanese Pound", "symbol": "ل.ل"},
        {"code": "SDG", "label": "Sudanese Pound", "symbol": "ج.س."},
        {"code": "DZD", "label": "Algerian Dinar", "symbol": "دج"},
        {"code": "LYD", "label": "Libyan Dinar", "symbol": "ل.د"},
        {"code": "MRU", "label": "Mauritanian Ouguiya", "symbol": "UM"},
        {"code": "SOS", "label": "Somali Shilling", "symbol": "Sh"},
        {"code": "MGA", "label": "Malagasy Ariary", "symbol": "Ar"},
        {"code": "ZMW", "label": "Zambian Kwacha", "symbol": "ZK"},
        {"code": "BWP", "label": "Botswana Pula", "symbol": "P"},
        {"code": "NAD", "label": "Namibian Dollar", "symbol": "$"},
        {"code": "SZL", "label": "Swazi Lilangeni", "symbol": "E"},
        {"code": "LSL", "label": "Lesotho Loti", "symbol": "L"},
        {"code": "MWK", "label": "Malawian Kwacha", "symbol": "MK"},
        {"code": "ZWL", "label": "Zimbabwean Dollar", "symbol": "$"},
        {"code": "BIF", "label": "Burundian Franc", "symbol": "FBu"},
        {"code": "RWF", "label": "Rwandan Franc", "symbol": "FRw"},
        {"code": "DJF", "label": "Djiboutian Franc", "symbol": "Fdj"},
        {"code": "KMF", "label": "Comorian Franc", "symbol": "CF"},
        {"code": "CDF", "label": "Congolese Franc", "symbol": "FC"},
        {"code": "XOF", "label": "West African CFA franc", "symbol": "CFA"},
        {"code": "XAF", "label": "Central African CFA franc", "symbol": "FCFA"},
        {"code": "XPF", "label": "CFP Franc", "symbol": "₣"},
        {"code": "XCD", "label": "East Caribbean Dollar", "symbol": "$"},
        {"code": "XDR", "label": "IMF Special Drawing Rights", "symbol": "SDR"},
        # ... add more as needed
    ]

@app.get("/search/{query}")
def search_symbols(query: str):
    """Searches for stock, ETF, and crypto symbols using Yahoo Finance's API."""
    if not query or len(query) < 2:
        return []
        
    url = f"https://query1.finance.yahoo.com/v1/finance/search?q={query}"
    headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36'}
    
    try:
        response = requests.get(url, headers=headers, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        results = []
        for quote in data.get('quotes', []):
            if quote.get('symbol') and quote.get('quoteType') in ['EQUITY', 'ETF', 'CRYPTOCURRENCY']:
                exch = quote.get('exchange', 'N/A')
                if not exch or exch == 'N/A':
                    exch = infer_exchange(quote.get('symbol'))
                results.append({
                    "symbol": quote.get('symbol'),
                    "name": quote.get('longname') or quote.get('shortname', 'N/A'),
                    "exchange": exch,
                    "type": quote.get('quoteType', 'N/A'),
                })
        return results
    except requests.exceptions.RequestException as e:
        print(f"Error fetching search results for '{query}': {e}")
        return []

#@app.get("/")
#def read_index():
#    return FileResponse(os.path.join(os.path.dirname(__file__), "index.html")) 

# Transaction endpoints
@app.get("/history")
def get_history():
    db = SessionLocal()
    txs = db.query(TransactionDB).order_by(TransactionDB.datetime.desc()).all()
    db.close()
    return [t.__dict__ for t in txs]

@app.post("/transaction")
def add_transaction(tx: dict):
    db = SessionLocal()
    t = TransactionDB(**tx)
    db.add(t)
    db.commit()
    db.close()
    return {"status": "ok"}

@app.get("/available")
def get_available():
    db = SessionLocal()
    a = db.query(AvailableDB).first()
    db.close()
    return {"amount": a.amount if a else 0}

@app.post("/available")
def set_available(amount: float, notes: str = ""):
    db = SessionLocal()
    a = db.query(AvailableDB).first()
    prev_amount = a.amount if a else 0
    action = "ADD" if amount > prev_amount else "ADJUST"
    if a:
        a.amount = amount
    else:
        a = AvailableDB(amount=amount)
        db.add(a)
    db.commit()
    # Record transaction for audit
    db.add(TransactionDB(
        datetime=datetime.now().isoformat(),
        action=action,
        symbol=None,
        name=None,
        asset_type=None,
        quantity=None,
        price=None,
        value=amount - prev_amount,
        pl=None,
        notes=notes or ("Manual balance add" if action=="ADD" else "Manual balance adjust"),
        balance_after=amount
    ))
    db.commit()
    db.close()
    return {"amount": amount}

@app.delete("/transaction/{tx_id}")
def delete_transaction(tx_id: int):
    db = SessionLocal()
    tx = db.query(TransactionDB).filter(TransactionDB.id == tx_id).first()
    if not tx:
        db.close()
        raise HTTPException(status_code=404, detail="Transaction not found")
    db.delete(tx)
    db.commit()
    db.close()
    return {"status": "deleted"}

@app.patch("/transaction/{tx_id}")
def edit_transaction(tx_id: int, fields: dict = Body(...)):
    db = SessionLocal()
    tx = db.query(TransactionDB).filter(TransactionDB.id == tx_id).first()
    if not tx:
        db.close()
        raise HTTPException(status_code=404, detail="Transaction not found")
    for k, v in fields.items():
        if hasattr(tx, k):
            setattr(tx, k, v)
    db.commit()
    db.close()
    return {"status": "updated"} 
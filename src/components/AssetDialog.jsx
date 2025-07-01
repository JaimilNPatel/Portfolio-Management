import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, MenuItem, Grid, Autocomplete, Tooltip, Box, Typography, CircularProgress
} from '@mui/material';
import axios from 'axios';

const assetTypes = [
  { value: 'stock', label: 'Stock' },
  { value: 'etf', label: 'ETF' },
  { value: 'crypto', label: 'Cryptocurrency' },
  { value: 'mutual_fund', label: 'Mutual Fund' },
  { value: 'gold', label: 'Gold/Silver' },
  { value: 'fixed_income', label: 'Fixed Income' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'commodity', label: 'Commodity' },
];
const defaultPrecision = {
  crypto: 8,
  stock: 4,
  etf: 4,
  mutual_fund: 3,
  gold: 3,
  fixed_income: 2,
  real_estate: 2,
  commodity: 2,
};

// Expanded global exchange and currency lists
const exchanges = [
  { code: 'NSE', label: 'NSE (India)' },
  { code: 'BSE', label: 'BSE (India)' },
  { code: 'NASDAQ', label: 'NASDAQ (USA)' },
  { code: 'NYSE', label: 'NYSE (USA)' },
  { code: 'LSE', label: 'LSE (UK)' },
  { code: 'TSE', label: 'TSE (Japan)' },
  { code: 'HKEX', label: 'HKEX (Hong Kong)' },
  { code: 'SIX', label: 'SIX (Switzerland)' },
  { code: 'ASX', label: 'ASX (Australia)' },
  { code: 'Euronext', label: 'Euronext (Europe)' },
  { code: 'TSX', label: 'TSX (Canada)' },
  { code: 'KRX', label: 'KRX (Korea)' },
  { code: 'KOSPI', label: 'KOSPI (Korea)' },
  { code: 'KOSDAQ', label: 'KOSDAQ (Korea)' },
  { code: 'SSE', label: 'SSE (China)' },
  { code: 'SZSE', label: 'SZSE (China)' },
  { code: 'Binance', label: 'Binance (Crypto)' },
  { code: 'Coinbase', label: 'Coinbase (Crypto)' },
  { code: 'Kraken', label: 'Kraken (Crypto)' },
  { code: 'AMC', label: 'AMC (Mutual Fund)' },
  // ... add more as needed
];

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

function classifyMutualFund(schemeName) {
  const name = schemeName.toLowerCase();
  
  let sector = "Other";
  let industry = "N/A";

  const sectorMap = {
    "Thematic": ["pharma", "banking", "infra", "technology", "fmcg", "consumption", "digital"],
    "Index/ETF": ["index", "etf", "nifty", "sensex"],
    "Commodity": ["gold", "silver"],
    "Debt": ["debt", "gilt", "bond", "income", "liquid", "money market", "overnight", "short duration", "medium duration", "long duration", "corporate bond"],
    "Hybrid": ["hybrid", "balanced", "multi asset", "arbitrage", "advantage"],
    "Equity": ["equity", "multi cap", "flexi cap", "large cap", "mid cap", "small cap", "elss", "tax saver", "focused", "value"],
  };

  for (const s in sectorMap) {
    if (sectorMap[s].some(k => name.includes(k))) {
      sector = s;
      break;
    }
  }

  const industryMap = {
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
    "Gilt Fund": ["gilt"],
    "Liquid Fund": ["liquid"],
    "Overnight Fund": ["overnight"],
    "Short Duration": ["short duration"],
    "Medium Duration": ["medium duration"],
    "Long Duration": ["long duration"],
    "Corporate Bond": ["corporate bond"],
    "Balanced Advantage": ["balanced advantage", "dynamic asset allocation"],
    "Aggressive Hybrid": ["aggressive hybrid"],
  };

  for (const i in industryMap) {
    if (industryMap[i].some(k => name.includes(k))) {
      industry = i;
      break;
    }
  }
  
  return { sector, industry };
}

// Debounce hook to delay search queries
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

function AssetDialog({ open, onClose, onSubmit, asset, currencies, baseCurrency = 'INR' }) {
  const [symbol, setSymbol] = useState('');
  const [assetType, setAssetType] = useState('stock');
  const [quantity, setQuantity] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [buyDate, setBuyDate] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [precision, setPrecision] = useState(2);
  const [exchange, setExchange] = useState('');
  const [exchangeAutoDetected, setExchangeAutoDetected] = useState(false);
  const [sector, setSector] = useState('');
  const [industry, setIndustry] = useState('');
  const [notes, setNotes] = useState('');
  const [currentPrice, setCurrentPrice] = useState(null);
  const [currentPriceCurrency, setCurrentPriceCurrency] = useState('');
  const [currentPriceBase, setCurrentPriceBase] = useState(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState('');
  const [mfList, setMfList] = useState([]);
  const [mfLoading, setMfLoading] = useState(false);
  const [mfError, setMfError] = useState('');
  const [mfSelected, setMfSelected] = useState(null);
  
  const [symbolInputValue, setSymbolInputValue] = useState('');
  const [symbolSearchOptions, setSymbolSearchOptions] = useState([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  
  const debouncedSearchTerm = useDebounce(symbolInputValue, 400);

  const [dynamicExchanges, setDynamicExchanges] = useState([]);

  useEffect(() => {
    if (asset) {
      setSymbol(asset.symbol);
      setAssetType(asset.asset_type || 'stock');
      setQuantity(asset.quantity);
      setBuyPrice(asset.buy_price);
      setBuyDate(asset.buy_date ? asset.buy_date.slice(0, 10) : '');
      setCurrency(asset.currency || 'INR');
      setPrecision(asset.precision || defaultPrecision[asset.asset_type] || 2);
      setExchange(asset.exchange || '');
      setExchangeAutoDetected(false);
      setSector(asset.sector || '');
      setIndustry(asset.industry || '');
      setNotes(asset.notes || '');
    } else {
      setSymbol('');
      setAssetType('stock');
      setQuantity('');
      setBuyPrice('');
      setBuyDate(new Date().toISOString().slice(0, 10));
      setCurrency('INR');
      setPrecision(defaultPrecision['stock']);
      setExchange('');
      setExchangeAutoDetected(false);
      setSector('');
      setIndustry('');
      setNotes('');
    }
  }, [asset, open]);

  useEffect(() => {
    setPrecision(defaultPrecision[assetType] || 2);
  }, [assetType]);

  useEffect(() => {
    if (debouncedSearchTerm && (assetType === 'stock' || assetType === 'crypto' || assetType === 'etf')) {
      setIsSearchLoading(true);
      fetch(`${API_BASE}/search/${debouncedSearchTerm}`)
        .then((res) => res.json())
        .then((data) => {
          setSymbolSearchOptions(data || []);
          setIsSearchLoading(false);
        });
    } else {
      setSymbolSearchOptions([]);
    }
  }, [debouncedSearchTerm, assetType]);

  // Helper: is currency locked?
  const isCurrencyLocked = !!symbol && !!currency && assetType !== 'stock' && assetType !== 'etf';

  // Fetch current price and FX
  const handleFetchPrice = async () => {
    setPriceLoading(true);
    setPriceError('');
    setCurrentPrice(null);
    setCurrentPriceCurrency('');
    setCurrentPriceBase(null);
    try {
      if (assetType === 'mutual_fund') {
        // Use AMFI endpoint for mutual funds
        const res = await axios.get(`http://localhost:8000/mutualfund/price/${symbol}`);
        if (res.data.nav) {
          setCurrentPrice(parseFloat(res.data.nav));
          setCurrentPriceCurrency('INR');
          setPriceError('');
        } else {
          setPriceError('Symbol not found.');
        }
      } else {
        // Use yfinance endpoint for other asset types
        const res = await axios.get(`http://localhost:8000/price/${symbol}`);
        if (res.data.price && res.data.currency) {
          setCurrentPrice(res.data.price);
          setCurrentPriceCurrency(res.data.currency);
          // Fetch FX if needed
          if (res.data.currency !== baseCurrency) {
            try {
              const fxRes = await axios.get(`http://localhost:8000/fxrate/${res.data.currency}/${baseCurrency}`);
              setCurrentPriceBase(res.data.price * fxRes.data.rate);
            } catch {
              setCurrentPriceBase(null);
            }
          } else {
            setCurrentPriceBase(res.data.price);
          }
        } else {
          setPriceError('Symbol not found.');
        }
      }
    } catch (err) {
      setPriceError('Error fetching price.');
    }
    setPriceLoading(false);
  };

  // Autofill buy price
  const handleAutoFillPrice = () => {
    if (currentPrice) setBuyPrice(currentPrice);
  };

  // Fetch MF list when dialog opens and assetType is mutual_fund
  useEffect(() => {
    if (open && assetType === 'mutual_fund' && mfList.length === 0) {
      setMfLoading(true);
      axios.get('http://localhost:8000/mutualfund/list')
        .then(res => setMfList(res.data))
        .catch(() => setMfError('Failed to load mutual fund list.'))
        .finally(() => setMfLoading(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assetType, mfList.length]);

  // When MF selected, fill symbol, buy price, and name
  useEffect(() => {
    if (mfSelected) {
      setSymbol(mfSelected['Scheme Code'].toString());
      setBuyPrice(mfSelected['Net Asset Value'] || '');
      const classification = classifyMutualFund(mfSelected['Scheme Name']);
      setSector(classification.sector);
      setIndustry(classification.industry);
    }
  }, [mfSelected]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!symbol || !quantity || !buyPrice || !buyDate) return;
    onSubmit({
      symbol,
      asset_type: assetType,
      quantity: parseFloat(quantity),
      buy_price: parseFloat(buyPrice),
      buy_date: buyDate,
      currency,
      precision,
      exchange,
      sector,
      industry,
      notes,
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth scroll="paper">
      <DialogTitle>{asset ? 'Update Asset' : 'Add Asset'}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              {/* Main fields */}
              <Box mb={2}>
                <Typography variant="subtitle2" color="text.secondary" mb={1}>Asset Details</Typography>
                {assetType === 'mutual_fund' ? (
                  <Autocomplete
                    options={mfList}
                    loading={mfLoading}
                    getOptionLabel={option =>
                      typeof option === 'string'
                        ? option
                        : `${option['Scheme Name']} (${option['Scheme Code']})`
                    }
                    value={mfSelected || symbol}
                    onChange={(_, newValue) => {
                      if (typeof newValue === 'string') {
                        setSymbol(newValue);
                        setMfSelected(null);
                      } else if (newValue) {
                        setMfSelected(newValue);
                        setSymbol(newValue['Scheme Code'].toString());
                        setBuyPrice(newValue['Net Asset Value'] || '');
                      }
                    }}
                    onInputChange={(_, newInputValue) => {
                      setSymbol(newInputValue);
                      setMfSelected(null);
                    }}
                    renderInput={params => (
                      <TextField {...params} label="Mutual Fund Name or Code" margin="dense" size="medium" fullWidth required error={!!mfError} helperText={mfError} />
                    )}
                    isOptionEqualToValue={(option, value) =>
                      (typeof value === 'string'
                        ? option['Scheme Code'].toString() === value
                        : option['Scheme Code'] === value['Scheme Code'])
                    }
                    freeSolo
                    sx={{ mb: 2 }}
                  />
                ) : (
                  <Autocomplete
                    freeSolo
                    options={symbolSearchOptions}
                    loading={isSearchLoading}
                    getOptionLabel={(option) => {
                      if (typeof option === 'string') return option;
                      if (option.name) return `${option.name} (${option.symbol})`;
                      return '';
                    }}
                    filterOptions={(x) => x}
                    value={typeof symbol === 'string' ? symbol : symbol?.symbol || ''}
                    onChange={(event, newValue) => {
                      if (typeof newValue === 'string') {
                        setSymbol(newValue);
                        setExchange('');
                        setExchangeAutoDetected(false);
                      } else if (newValue && newValue.symbol) {
                        setSymbol(newValue.symbol);
                        // Set exchange from search result if valid
                        if (newValue.exchange && newValue.exchange !== 'N/A' && newValue.exchange !== '') {
                          setExchange(newValue.exchange);
                          setExchangeAutoDetected(true);
                        } else {
                          setExchange('');
                          setExchangeAutoDetected(false);
                        }
                        // Set Asset Type directly from the selection
                        if (newValue.type === 'EQUITY') {
                            setAssetType('stock');
                        } else if (newValue.type === 'ETF') {
                            setAssetType('etf');
                        } else if (newValue.type === 'CRYPTOCURRENCY') {
                            setAssetType('crypto');
                        }
                        // Fetch accurate currency, sector, industry, and exchange from our price endpoint
                        fetch(`${API_BASE}/price/${newValue.symbol}`)
                          .then(res => res.json())
                          .then(data => {
                            if (data) {
                              setCurrency(data.currency || 'USD');
                              setSector(data.sector || '');
                              setIndustry(data.industry || '');
                              // If exchange is not set or is invalid, set from backend if valid
                              if ((!newValue.exchange || newValue.exchange === 'N/A' || newValue.exchange === '') && data.exchange && data.exchange !== 'N/A' && data.exchange !== '') {
                                // Try to match backend exchange to code in exchanges list
                                let found = exchanges.find(e => e.code === data.exchange);
                                if (!found) {
                                  found = dynamicExchanges.find(e => e.code === data.exchange);
                                }
                                if (!found) {
                                  // Add to dynamic exchanges if not present
                                  setDynamicExchanges(prev => [...prev, { code: data.exchange, label: data.exchange }]);
                                }
                                setExchange(data.exchange);
                                setExchangeAutoDetected(true);
                              }
                            }
                          })
                          .catch(() => {
                            setCurrency('USD');
                            setSector('');
                            setIndustry('');
                          });
                      }
                    }}
                    onInputChange={(event, newInputValue) => {
                      setSymbolInputValue(newInputValue);
                      if (typeof newInputValue === 'string') {
                        setExchange('');
                        setExchangeAutoDetected(false);
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Search Name or Symbol (e.g. Apple)"
                        margin="dense"
                        size="medium"
                        required
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {isSearchLoading ? <CircularProgress color="inherit" size={20} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                    renderOption={(props, option) => (
                      <li {...props} key={`${option.symbol}-${option.exchange}`}>
                        <Grid container alignItems="center">
                          <Grid item xs>
                            <Typography variant="body1" color="text.primary">
                              {option.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {option.symbol} &middot; {option.exchange} &middot; {option.type}
                            </Typography>
                          </Grid>
                        </Grid>
                      </li>
                    )}
                  />
                )}
                <TextField select label="Asset Type" value={assetType} onChange={e => setAssetType(e.target.value)} fullWidth margin="dense" size="small" required sx={{ mb: 2 }}>
                  {assetTypes.map(opt => (<MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>))}
                </TextField>
                <Tooltip title={isCurrencyLocked ? "Currency auto-detected from symbol and locked." : "Select the currency for this asset. Start typing to search."}>
                  <Autocomplete
                    options={currencies}
                    getOptionLabel={option => `${option.code} - ${option.label}`}
                    value={currencies.find(c => c.code === currency) || null}
                    onChange={(_, newValue) => { if (!isCurrencyLocked) setCurrency(newValue ? newValue.code : ''); }}
                    renderInput={params => (
                      <TextField {...params} label="Currency" margin="dense" size="small" fullWidth placeholder="e.g. USD, INR, EUR" inputProps={{ ...params.inputProps, readOnly: isCurrencyLocked }} />
                    )}
                    isOptionEqualToValue={(option, value) => option.code === value.code}
                    freeSolo
                    open={false}
                    autoHighlight
                    autoSelect
                    filterSelectedOptions
                    filterOptions={(options, state) => {
                      const commonCodes = ["USD", "INR", "EUR"];
                      const input = state.inputValue.trim().toUpperCase();
                      let filtered = options;
                      if (input) {
                        filtered = options.filter(opt =>
                          opt.code.toUpperCase().includes(input) ||
                          opt.label.toUpperCase().includes(input)
                        );
                      }
                      const common = options.filter(opt => commonCodes.includes(opt.code));
                      const rest = filtered.filter(opt => !commonCodes.includes(opt.code));
                      return [...common, ...rest];
                    }}
                    disabled={isCurrencyLocked}
                    sx={{ mb: 2 }}
                  />
                </Tooltip>
                <Box display="flex" gap={2} alignItems="center" mb={2}>
                  <TextField label="Quantity" type="number" value={quantity} onChange={e => setQuantity(e.target.value)} fullWidth margin="dense" size="medium" required />
                  <TextField label="Buy Price" type="number" value={buyPrice} onChange={e => setBuyPrice(e.target.value)} fullWidth margin="dense" size="medium" required />
                </Box>
                <TextField label="Buy Date" type="date" value={buyDate} onChange={e => setBuyDate(e.target.value)} fullWidth margin="dense" size="small" required sx={{ mb: 2 }} InputLabelProps={{ shrink: true }} />
                <Button variant="outlined" onClick={handleFetchPrice} disabled={priceLoading} sx={{ mb: 1 }}>See Current Price</Button>
                {currentPrice && (
                  <Box mt={1}>
                    <Typography variant="body2">Current: <b>{currentPriceCurrency} {currentPrice}</b> {currentPriceBase && baseCurrency !== currentPriceCurrency && (<span>({baseCurrency} {currentPriceBase.toFixed(2)})</span>)}</Typography>
                    <Button size="small" onClick={handleAutoFillPrice} sx={{ mt: 1 }}>Auto-fill Buy Price</Button>
                  </Box>
                )}
                {priceError && <Typography color="error" variant="body2">{priceError}</Typography>}
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              {/* Meta fields */}
              <Box mb={2}>
                <Typography variant="subtitle2" color="text.secondary" mb={1}>Meta Info</Typography>
                <Autocomplete
                  options={[...exchanges, ...dynamicExchanges]}
                  getOptionLabel={option => option.label}
                  value={[...exchanges, ...dynamicExchanges].find(e => e.code === exchange) || (exchange ? { code: exchange, label: exchange } : null)}
                  onChange={(_, newValue) => {
                    if (!exchangeAutoDetected) setExchange(newValue ? newValue.code : '');
                  }}
                  renderInput={params => (
                    <TextField {...params} label="Exchange" margin="dense" size="small" fullWidth inputProps={{ ...params.inputProps, readOnly: exchangeAutoDetected }} />
                  )}
                  isOptionEqualToValue={(option, value) => option.code === value.code}
                  sx={{ mb: 2 }}
                />
                <TextField label="Sector" value={sector || (assetType === 'crypto' ? 'Cryptocurrency' : assetType === 'etf' ? 'ETF' : '')} onChange={e => setSector(e.target.value)} fullWidth margin="dense" size="small" sx={{ mb: 2 }} InputProps={{ readOnly: assetType === 'mutual_fund' }} />
                <TextField label="Industry" value={industry || (assetType === 'crypto' ? 'N/A' : assetType === 'etf' ? 'N/A' : '')} onChange={e => setIndustry(e.target.value)} fullWidth margin="dense" size="small" sx={{ mb: 2 }} InputProps={{ readOnly: assetType === 'mutual_fund' }} />
                <TextField label="Notes" value={notes} onChange={e => setNotes(e.target.value)} fullWidth margin="dense" size="small" multiline minRows={2} sx={{ mb: 2 }} />
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">{asset ? 'Update' : 'Add'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default AssetDialog; 
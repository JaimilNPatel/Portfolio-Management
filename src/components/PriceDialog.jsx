import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, Box, Chip } from '@mui/material';
import axios from 'axios';

function PriceDialog({ open, onClose, currencies, baseCurrency, setBaseCurrency }) {
  const [symbol, setSymbol] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [currency, setCurrency] = useState('');
  const [price, setPrice] = useState(null);
  const [fxPrice, setFxPrice] = useState(null);

  const getSymbol = (code) => {
    const found = currencies.find(c => c.code === code);
    return found ? found.symbol : code;
  };

  const handleCheck = async (e) => {
    e.preventDefault();
    setResult('');
    setLoading(true);
    setFxPrice(null);
    try {
      const res = await axios.get(`http://localhost:8000/price/${symbol}`);
      if (res.data.price && res.data.currency) {
        setPrice(res.data.price);
        setCurrency(res.data.currency);
        setResult('');
        // Fetch FX rate if needed
        if (res.data.currency !== baseCurrency) {
          try {
            const fxRes = await axios.get(`http://localhost:8000/fxrate/${res.data.currency}/${baseCurrency}`);
            setFxPrice(res.data.price * fxRes.data.rate);
          } catch {
            setFxPrice(null);
          }
        } else {
          setFxPrice(res.data.price);
        }
      } else {
        setResult('Symbol not found.');
        setPrice(null);
        setCurrency('');
        setFxPrice(null);
      }
    } catch {
      setResult('Error fetching price.');
      setPrice(null);
      setCurrency('');
      setFxPrice(null);
    }
    setLoading(false);
  };

  // Refetch FX price if baseCurrency changes
  useEffect(() => {
    if (!price || !currency) return;
    if (currency === baseCurrency) {
      setFxPrice(price);
      return;
    }
    async function fetchFx() {
      try {
        const fxRes = await axios.get(`http://localhost:8000/fxrate/${currency}/${baseCurrency}`);
        setFxPrice(price * fxRes.data.rate);
      } catch {
        setFxPrice(null);
      }
    }
    fetchFx();
  }, [baseCurrency, currency, price]);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>See Asset Price</DialogTitle>
      <form onSubmit={handleCheck}>
        <DialogContent>
          <Typography variant="h6" mb={2}>See Asset Price</Typography>
          <Box display="flex" alignItems="center" mb={1}>
            <Chip
              label={`Base: ${getSymbol(baseCurrency)} ${baseCurrency}`}
              color="secondary"
              sx={{ fontWeight: 600, fontSize: 16 }}
            />
          </Box>
          <TextField
            label="Symbol"
            value={symbol}
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            fullWidth
            margin="normal"
            required
            sx={{ mb: 2 }}
          />
          {price && currency && (
            <Box mt={2} mb={2}>
              <Typography variant="body2" color="text.secondary">Current price of {symbol}:</Typography>
              <Typography variant="h6" color="primary.main">{getSymbol(currency)}{price.toLocaleString(undefined, { maximumFractionDigits: 4 })} ({currency})</Typography>
              {fxPrice !== null && baseCurrency !== currency && (
                <Typography variant="body2" color="info.main" mt={1}>
                  In {baseCurrency}: <b>{getSymbol(baseCurrency)}{fxPrice.toLocaleString(undefined, { maximumFractionDigits: 4 })} ({baseCurrency})</b>
                </Typography>
              )}
            </Box>
          )}
          {result && <Typography sx={{ mt: 2 }}>{result}</Typography>}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
          <Button type="submit" variant="contained" disabled={loading}>See Price</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default PriceDialog; 
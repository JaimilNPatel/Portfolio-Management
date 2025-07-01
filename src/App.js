import React, { useEffect, useState } from 'react';
import { Typography, Button, Box, Snackbar, Alert, AppBar, Toolbar, Paper, Grid, Autocomplete, Chip, TextField } from '@mui/material';
import PortfolioTable from './components/PortfolioTable';
import Analytics from './components/Analytics';
import AssetDialog from './components/AssetDialog';
import SellDialog from './components/SellDialog';
import PriceDialog from './components/PriceDialog';
import axios from 'axios';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import SearchIcon from '@mui/icons-material/Search';
import SummaryBar from './components/SummaryBar';
// import HistoryTab from './components/HistoryTab';

const API = 'http://localhost:8000';

function App() {
  const [portfolio, setPortfolio] = useState([]);
  const [totals, setTotals] = useState({ total_value: 0, total_cost: 0, total_profit_loss: 0 });
  const [openAsset, setOpenAsset] = useState(false);
  const [openSell, setOpenSell] = useState(false);
  const [openPrice, setOpenPrice] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [baseCurrency, setBaseCurrency] = useState('INR');
  const [fxRates, setFxRates] = useState({ INR: 1 });
  const [currencies, setCurrencies] = useState([]);
  const [search, setSearch] = useState('');

  const fetchPortfolio = async () => {
    try {
      const res = await axios.get(`${API}/portfolio`);
      setPortfolio(res.data.portfolio);
      setTotals({
        total_value: res.data.total_value,
        total_cost: res.data.total_cost,
        total_profit_loss: res.data.total_profit_loss,
      });
    } catch (e) {
      setSnackbar({ open: true, message: 'Failed to fetch portfolio', severity: 'error' });
    }
  };

  useEffect(() => { fetchPortfolio(); }, []);

  useEffect(() => {
    async function fetchCurrencies() {
      try {
        const res = await axios.get(`${API}/currencies`);
        setCurrencies(res.data);
      } catch {
        setCurrencies([]);
      }
    }
    fetchCurrencies();
  }, []);

  useEffect(() => {
    async function fetchRates() {
      const uniqueCurrencies = Array.from(new Set(portfolio.map(a => a.currency)));
      const rates = {};
      await Promise.all(uniqueCurrencies.map(async (cur) => {
        if (cur === baseCurrency) {
          rates[cur] = 1.0;
        } else {
          try {
            const res = await axios.get(`${API}/fxrate/${cur}/${baseCurrency}`);
            rates[cur] = res.data.rate;
          } catch {
            rates[cur] = 1.0;
          }
        }
      }));
      setFxRates(rates);
    }
    if (portfolio.length > 0 && currencies.length > 0) fetchRates();
  }, [baseCurrency, portfolio, currencies]);

  const handleAddOrUpdate = async (asset) => {
    try {
      if (selectedAsset) {
        await axios.post(`${API}/portfolio/add?edit=true`, asset);
      } else {
        await axios.post(`${API}/portfolio/add`, asset);
      }
      setSnackbar({ open: true, message: 'Asset added/updated!', severity: 'success' });
      fetchPortfolio();
    } catch {
      setSnackbar({ open: true, message: 'Failed to add/update asset', severity: 'error' });
    }
  };

  const handleSell = async (symbol, quantity) => {
    const asset = portfolio.find(a => a.symbol === symbol);
    if (!asset) return;
    try {
      await axios.post(`${API}/portfolio/remove?symbol=${symbol}&quantity=${quantity}`);
      setSnackbar({ open: true, message: 'Asset sold!', severity: 'success' });
      fetchPortfolio();
    } catch {
      setSnackbar({ open: true, message: 'Failed to sell asset', severity: 'error' });
    }
  };

  // Filtering logic (same as PortfolioTable)
  const filteredPortfolio = portfolio.filter(row =>
    row.symbol.toLowerCase().includes(search.toLowerCase()) ||
    (row.currency && row.currency.toLowerCase().includes(search.toLowerCase()))
  );

  // Totals in base currency (same as PortfolioTable)
  const totalValueBase = filteredPortfolio.reduce((sum, row) => {
    const rate = fxRates[row.currency] || 1.0;
    return sum + row.current_value * rate;
  }, 0);
  const totalCostBase = filteredPortfolio.reduce((sum, row) => {
    const rate = fxRates[row.currency] || 1.0;
    return sum + row.buy_price * row.quantity * rate;
  }, 0);
  const totalPLBase = totalValueBase - totalCostBase;
  const returnPercent = totalCostBase ? (totalPLBase / totalCostBase) * 100 : 0;

  return (
    <Box sx={{ bgcolor: '#f4f7fa', minHeight: '100vh', width: '100vw', overflowX: 'hidden' }}>
      {/* Topbar Navigation (placeholder for future sidebar) */}
      <AppBar position="sticky" color="primary" elevation={2} sx={{ zIndex: 1201 }}>
        <Toolbar>
          <Typography variant="h5" sx={{ flexGrow: 1, fontWeight: 700, letterSpacing: 1 }}>
            Portfolio Manager
          </Typography>
          <Autocomplete
            options={currencies}
            getOptionLabel={option => option ? `${option.code} - ${option.label}` : ''}
            value={currencies.find(c => c.code === baseCurrency) || null}
            onChange={(_, newValue) => {
              if (newValue && newValue.code) setBaseCurrency(newValue.code);
            }}
            renderInput={params => (
              <TextField {...params} label="Base Currency" size="small" sx={{ minWidth: 180, bgcolor: 'white', borderRadius: 1 }} />
            )}
            isOptionEqualToValue={(option, value) => option.code === value.code}
            autoHighlight
            autoSelect
            filterSelectedOptions
            sx={{ minWidth: 200, mr: 2, bgcolor: 'white', borderRadius: 1 }}
          />
          {currencies.length > 0 && (
            <Chip
              label={`Base: ${(currencies.find(c => c.code === baseCurrency)?.symbol || baseCurrency)} ${baseCurrency}`}
              color="secondary"
              sx={{ fontWeight: 600, fontSize: 16, mr: 2, pointerEvents: 'none', cursor: 'default' }}
              clickable={false}
            />
          )}
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddCircleIcon />}
            sx={{ mr: 2, fontWeight: 600 }}
            onClick={() => setOpenAsset(true)}
          >
            Add/Update Asset
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<SearchIcon />}
            sx={{ fontWeight: 600 }}
            onClick={() => setOpenPrice(true)}
          >
            See Price
          </Button>
        </Toolbar>
      </AppBar>
      {/* Sticky summary bar */}
      <SummaryBar
        totalValue={totalValueBase}
        totalCost={totalCostBase}
        totalPL={totalPLBase}
        returnPercent={returnPercent}
        baseCurrency={baseCurrency}
        currencies={currencies}
      />
      {/* Main content grid */}
      <Box sx={{ px: { xs: 1, md: 4 }, py: 2, width: '100%', maxWidth: '1600px', mx: 'auto', transition: 'all 0.3s' }}>
        <Grid container spacing={4} alignItems="flex-start">
          <Grid item xs={12} md={7}>
            <Paper elevation={3} sx={{ p: 2, mb: 3, transition: 'box-shadow 0.3s', '&:hover': { boxShadow: 6 } }}>
              <PortfolioTable
                portfolio={filteredPortfolio}
                onUpdate={asset => { setSelectedAsset(asset); setOpenAsset(true); }}
                onSell={asset => { setSelectedAsset(asset); setOpenSell(true); }}
                onDelete={async asset => {
                  try {
                    await axios.post(`${API}/portfolio/remove?symbol=${asset.symbol}`);
                    setSnackbar({ open: true, message: 'Asset deleted!', severity: 'success' });
                    fetchPortfolio();
                  } catch {
                    setSnackbar({ open: true, message: 'Failed to delete asset', severity: 'error' });
                  }
                }}
                baseCurrency={baseCurrency}
                fxRates={fxRates}
                currencies={currencies}
                search={search}
                setSearch={setSearch}
              />
            </Paper>
          </Grid>
          <Grid item xs={12} md={5}>
            <Analytics
              portfolio={portfolio}
              totals={totals}
              baseCurrency={baseCurrency}
              setBaseCurrency={setBaseCurrency}
              fxRates={fxRates}
              currencies={currencies}
            />
          </Grid>
        </Grid>
        <AssetDialog
          open={openAsset}
          onClose={() => { setOpenAsset(false); setSelectedAsset(null); }}
          onSubmit={handleAddOrUpdate}
          asset={selectedAsset}
          currencies={currencies}
        />
        <SellDialog
          open={openSell}
          onClose={() => { setOpenSell(false); setSelectedAsset(null); }}
          onSubmit={handleSell}
          asset={selectedAsset}
        />
        <PriceDialog open={openPrice} onClose={() => setOpenPrice(false)} currencies={currencies} baseCurrency={baseCurrency} setBaseCurrency={setBaseCurrency} />
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert severity={snackbar.severity} sx={{ width: '100%' }}>{snackbar.message}</Alert>
        </Snackbar>
        {/* <HistoryTab
          history={history}
          available={available}
          onSetAvailable={handleSetAvailable}
          portfolioValue={totals.total_value}
          fetchHistory={fetchHistory}
          baseCurrency={baseCurrency}
          fxRates={fxRates}
          currencies={currencies}
        /> */}
      </Box>
    </Box>
  );
}

export default App;

import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, TextField, Box, IconButton
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import CurrencyBitcoinIcon from '@mui/icons-material/CurrencyBitcoin';
import SavingsIcon from '@mui/icons-material/Savings';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import GrainIcon from '@mui/icons-material/Grain';
import RefreshIcon from '@mui/icons-material/Refresh';
import InfoIcon from '@mui/icons-material/Info';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import { IconButton as MuiIconButton } from '@mui/material';
import LayersIcon from '@mui/icons-material/Layers';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

const formatAssetType = (type) => {
  if (!type) return '-';
  if (type.toLowerCase() === 'etf') return 'ETF';
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

function PortfolioTable({ portfolio, onUpdate = () => {}, onSell = () => {}, onDelete = () => {}, baseCurrency = 'USD', fxRates = {}, currencies = [] }) {
  const [search, setSearch] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoSymbol, setInfoSymbol] = useState(null);
  const [infoData, setInfoData] = useState(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState(null);

  const filtered = portfolio.filter(row =>
    row.symbol.toLowerCase().includes(search.toLowerCase()) ||
    (row.currency && row.currency.toLowerCase().includes(search.toLowerCase()))
  );

  // Sorting logic
  const getPercentChange = (row) => {
    const cost_basis = row.buy_price * row.quantity;
    return cost_basis ? ((row.current_value - cost_basis) / cost_basis) * 100 : 0;
  };

  const sorted = React.useMemo(() => {
    if (!sortConfig.key) return filtered;
    const sortedRows = [...filtered];
    sortedRows.sort((a, b) => {
      let aValue, bValue;
      switch (sortConfig.key) {
        case 'symbol':
        case 'name':
        case 'asset_type':
        case 'sector':
        case 'currency':
          aValue = (a[sortConfig.key] || '').toLowerCase();
          bValue = (b[sortConfig.key] || '').toLowerCase();
          break;
        case 'quantity':
        case 'buy_price':
        case 'current_price':
        case 'current_value':
        case 'profit_loss':
          aValue = a[sortConfig.key];
          bValue = b[sortConfig.key];
          break;
        case 'percent_change':
          aValue = getPercentChange(a);
          bValue = getPercentChange(b);
          break;
        default:
          aValue = a[sortConfig.key];
          bValue = b[sortConfig.key];
      }
      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sortedRows;
  }, [filtered, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  // Calculate totals in base currency
  const totalValueBase = filtered.reduce((sum, row) => {
    const rate = fxRates[row.currency] || 1.0;
    return sum + row.current_value * rate;
  }, 0);
  const totalCostBase = filtered.reduce((sum, row) => {
    const rate = fxRates[row.currency] || 1.0;
    return sum + row.buy_price * row.quantity * rate;
  }, 0);
  const totalPLBase = totalValueBase - totalCostBase;

  // Helper to get currency symbol
  const getSymbol = (code) => {
    const found = currencies.find(c => c.code === code);
    return found ? found.symbol : code;
  };

  // Helper to get asset icon
  const getAssetIcon = (type) => {
    switch ((type||'').toLowerCase()) {
      case 'stock': return <ShowChartIcon fontSize="small" color="primary" sx={{ verticalAlign: 'middle' }} />;
      case 'etf': return <LayersIcon fontSize="small" color="secondary" sx={{ verticalAlign: 'middle' }} />;
      case 'crypto': return <CurrencyBitcoinIcon fontSize="small" color="warning" sx={{ verticalAlign: 'middle' }} />;
      case 'mutual fund': return <SavingsIcon fontSize="small" color="secondary" sx={{ verticalAlign: 'middle' }} />;
      case 'fd': return <AccountBalanceIcon fontSize="small" color="info" sx={{ verticalAlign: 'middle' }} />;
      case 'gold': return <EmojiEventsIcon fontSize="small" sx={{ color: '#FFD700', verticalAlign: 'middle' }} />;
      case 'real estate': return <HomeWorkIcon fontSize="small" color="success" sx={{ verticalAlign: 'middle' }} />;
      case 'commodity': return <GrainIcon fontSize="small" color="action" sx={{ verticalAlign: 'middle' }} />;
      default: return <ShowChartIcon fontSize="small" color="disabled" sx={{ verticalAlign: 'middle' }} />;
    }
  };

  const handleInfoOpen = async (symbol) => {
    setInfoSymbol(symbol);
    setInfoOpen(true);
    setInfoLoading(true);
    setInfoError(null);
    setInfoData(null);
    try {
      const res = await fetch(`${API_BASE}/price/${symbol}`);
      const data = await res.json();
      setInfoData(data);
    } catch (e) {
      setInfoError('Failed to fetch stock info.');
    } finally {
      setInfoLoading(false);
    }
  };
  const handleInfoClose = () => {
    setInfoOpen(false);
    setInfoSymbol(null);
    setInfoData(null);
    setInfoError(null);
    setInfoLoading(false);
  };

  return (
    <Box sx={{ fontFamily: 'Roboto, Arial, sans-serif', fontSize: 14 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <TextField
          label="Search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          size="small"
          sx={{ width: { xs: '100%', sm: 300 } }}
        />
        <MuiIconButton onClick={() => {}} title="Refresh Prices">
          <RefreshIcon />
        </MuiIconButton>
      </Box>
      <TableContainer component={Paper} sx={{ mt: 1, maxHeight: 420, boxShadow: 1, borderRadius: 2, p: 0 }}>
        <Table size="small" stickyHeader sx={{ fontFamily: 'inherit', fontSize: 14 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f7fafd', fontFamily: 'inherit', fontSize: 15 }}>
              <TableCell sx={{ p: 0.5, fontSize: 15, fontFamily: 'inherit', minWidth: 80, cursor: 'pointer', fontWeight: sortConfig.key === 'symbol' ? 700 : 500, color: sortConfig.key === 'symbol' ? 'primary.main' : undefined }} onClick={() => handleSort('symbol')}>Symbol</TableCell>
              <TableCell sx={{ p: 0.5, fontSize: 15, fontFamily: 'inherit', minWidth: 120, maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', fontWeight: sortConfig.key === 'name' ? 700 : 500, color: sortConfig.key === 'name' ? 'primary.main' : undefined }} onClick={() => handleSort('name')}>Name</TableCell>
              <TableCell sx={{ p: 0.5, fontSize: 15, fontFamily: 'inherit', minWidth: 60, cursor: 'pointer', fontWeight: sortConfig.key === 'asset_type' ? 700 : 500, color: sortConfig.key === 'asset_type' ? 'primary.main' : undefined }} onClick={() => handleSort('asset_type')}>Type</TableCell>
              <TableCell sx={{ p: 0.5, fontSize: 15, fontFamily: 'inherit', minWidth: 80, display: { xs: 'none', sm: 'table-cell' }, cursor: 'pointer', fontWeight: sortConfig.key === 'sector' ? 700 : 500, color: sortConfig.key === 'sector' ? 'primary.main' : undefined }} onClick={() => handleSort('sector')}>Sector</TableCell>
              <TableCell sx={{ p: 0.5, fontSize: 15, fontFamily: 'inherit', minWidth: 80, display: { xs: 'none', sm: 'table-cell' }, cursor: 'pointer', fontWeight: sortConfig.key === 'industry' ? 700 : 500, color: sortConfig.key === 'industry' ? 'primary.main' : undefined }} onClick={() => handleSort('industry')}>Industry</TableCell>
              <TableCell align="right" sx={{ p: 0.5, fontSize: 15, fontFamily: 'inherit', minWidth: 60, cursor: 'pointer', fontWeight: sortConfig.key === 'quantity' ? 700 : 500, color: sortConfig.key === 'quantity' ? 'primary.main' : undefined }} onClick={() => handleSort('quantity')}>Qty</TableCell>
              <TableCell align="right" sx={{ p: 0.5, fontSize: 15, fontFamily: 'inherit', minWidth: 80, cursor: 'pointer', fontWeight: sortConfig.key === 'buy_price' ? 700 : 500, color: sortConfig.key === 'buy_price' ? 'primary.main' : undefined }} onClick={() => handleSort('buy_price')}>Buy</TableCell>
              <TableCell align="right" sx={{ p: 0.5, fontSize: 15, fontFamily: 'inherit', minWidth: 100, cursor: 'pointer', fontWeight: sortConfig.key === 'current_price' ? 700 : 500, color: sortConfig.key === 'current_price' ? 'primary.main' : undefined }} onClick={() => handleSort('current_price')}>Latest Price</TableCell>
              <TableCell align="right" sx={{ p: 0.5, fontSize: 15, fontFamily: 'inherit', minWidth: 90, cursor: 'pointer', fontWeight: sortConfig.key === 'current_value' ? 700 : 500, color: sortConfig.key === 'current_value' ? 'primary.main' : undefined }} onClick={() => handleSort('current_value')}>Value</TableCell>
              <TableCell align="right" sx={{ p: 0.5, fontSize: 15, fontFamily: 'inherit', minWidth: 80, cursor: 'pointer', fontWeight: sortConfig.key === 'profit_loss' ? 700 : 500, color: sortConfig.key === 'profit_loss' ? 'primary.main' : undefined }} onClick={() => handleSort('profit_loss')}>P/L</TableCell>
              <TableCell align="right" sx={{ p: 0.5, fontSize: 15, fontFamily: 'inherit', minWidth: 80, cursor: 'pointer', fontWeight: sortConfig.key === 'percent_change' ? 700 : 500, color: sortConfig.key === 'percent_change' ? 'primary.main' : undefined }} onClick={() => handleSort('percent_change')}>% Change</TableCell>
              <TableCell align="right" sx={{ p: 0.5, fontSize: 15, fontFamily: 'inherit', minWidth: 60, cursor: 'pointer', fontWeight: sortConfig.key === 'currency' ? 700 : 500, color: sortConfig.key === 'currency' ? 'primary.main' : undefined }} onClick={() => handleSort('currency')}>Curr</TableCell>
              <TableCell align="center" sx={{ p: 0.5, fontSize: 15, fontFamily: 'inherit', minWidth: 50 }}>Edit</TableCell>
              <TableCell align="center" sx={{ p: 0.5, fontSize: 15, fontFamily: 'inherit', minWidth: 50 }}>Sell</TableCell>
              <TableCell align="center" sx={{ p: 0.5, fontSize: 15, fontFamily: 'inherit', minWidth: 50 }}>Del</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((row) => (
              <TableRow key={row.symbol} hover sx={{ transition: 'background 0.2s', '&:hover': { bgcolor: '#e3f2fd' }, p: 0.5, fontFamily: 'inherit', fontSize: 14 }}>
                <TableCell sx={{ p: 0.5, fontSize: 14, fontFamily: 'inherit' }}>{getAssetIcon(row.asset_type)} <b>{row.symbol}</b>
                  {(row.asset_type === 'stock' || row.asset_type === 'etf' || row.asset_type === 'crypto') && (
                    <IconButton size="small" onClick={() => handleInfoOpen(row.symbol)} title="Info"><InfoIcon fontSize="small" /></IconButton>
                  )}
                </TableCell>
                <TableCell sx={{ p: 0.5, fontSize: 14, fontFamily: 'inherit', maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{!row.name || row.name === 'N/A' ? '-' : row.name}</TableCell>
                <TableCell sx={{ p: 0.5, fontSize: 14, fontFamily: 'inherit' }}>{formatAssetType(row.asset_type)}</TableCell>
                <TableCell sx={{ p: 0.5, fontSize: 14, fontFamily: 'inherit', display: { xs: 'none', sm: 'table-cell' } }}>{!row.sector || row.sector === 'N/A' ? '-' : row.sector}</TableCell>
                <TableCell sx={{ p: 0.5, fontSize: 14, fontFamily: 'inherit', display: { xs: 'none', sm: 'table-cell' } }}>{!row.industry || row.industry === 'N/A' ? '-' : row.industry}</TableCell>
                <TableCell align="right" sx={{ p: 0.5, fontSize: 14, fontFamily: 'inherit' }}>{row.quantity !== undefined && row.quantity !== null ? row.quantity : '-'}</TableCell>
                <TableCell align="right" sx={{ p: 0.5, fontSize: 14, fontFamily: 'inherit' }}>{getSymbol(row.currency)} {row.buy_price !== undefined && row.buy_price !== null ? row.buy_price.toFixed(2) : '-'}</TableCell>
                <TableCell align="right" sx={{ p: 0.5, fontSize: 14, fontFamily: 'inherit' }}>{row.current_price !== null && row.current_price !== undefined ? `${getSymbol(row.currency)} ${row.current_price.toFixed(2)}` : '-'}</TableCell>
                <TableCell align="right" sx={{ p: 0.5, fontSize: 14, fontFamily: 'inherit', fontWeight: 700, color: row.current_value >= 0 ? 'primary.main' : 'error.main' }}>{row.current_value !== undefined && row.current_value !== null ? `${getSymbol(row.currency)} ${row.current_value.toFixed(2)}` : '-'}</TableCell>
                <TableCell align="right" sx={{ p: 0.5, fontSize: 14, fontFamily: 'inherit', fontWeight: 700, color: row.profit_loss >= 0 ? 'green' : 'red' }}>{row.profit_loss !== undefined && row.profit_loss !== null ? `${getSymbol(row.currency)} ${row.profit_loss.toFixed(2)}` : '-'}</TableCell>
                <TableCell align="right" sx={{ p: 0.5, fontSize: 14, fontFamily: 'inherit', fontWeight: 700, color: ((row.current_value - row.buy_price * row.quantity) >= 0) ? 'green' : 'red' }}>
                  {(() => {
                    const cost_basis = row.buy_price * row.quantity;
                    const percent_change = cost_basis ? ((row.current_value - cost_basis) / cost_basis) * 100 : 0;
                    return percent_change.toFixed(2) + '%';
                  })()}
                </TableCell>
                <TableCell align="right" sx={{ p: 0.5, fontSize: 14, fontFamily: 'inherit' }}>{!row.currency || row.currency === 'N/A' ? '-' : row.currency}</TableCell>
                <TableCell align="center" sx={{ p: 0.5, fontSize: 15, fontFamily: 'inherit' }}>
                  <Button variant="outlined" color="primary" size="small" sx={{ minWidth: 32, px: 1, fontSize: 13, fontFamily: 'inherit' }} onClick={() => { if (typeof onUpdate === 'function') onUpdate(row); }}>Edit</Button>
                </TableCell>
                <TableCell align="center" sx={{ p: 0.5, fontSize: 15, fontFamily: 'inherit' }}>
                  <Button variant="outlined" color="warning" size="small" sx={{ minWidth: 32, px: 1, fontSize: 13, fontFamily: 'inherit' }} onClick={() => { if (typeof onSell === 'function') onSell(row); }}>Sell</Button>
                </TableCell>
                <TableCell align="center" sx={{ p: 0.5, fontSize: 15, fontFamily: 'inherit' }}>
                  <IconButton color="error" size="small" sx={{ minWidth: 32, px: 1, fontSize: 13, fontFamily: 'inherit' }} onClick={() => { if (typeof onDelete === 'function') onDelete(row); }} aria-label="delete">
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{
        mt: 1,
        mb: 1,
        fontWeight: 700,
        fontSize: 15,
        fontFamily: 'inherit',
        textAlign: 'center',
        bgcolor: '#f5f5fa',
        borderRadius: 2,
        p: 1,
        boxShadow: 1,
        letterSpacing: 0.5
      }}>
        Total Value: {getSymbol(baseCurrency)}{totalValueBase.toLocaleString(undefined, { maximumFractionDigits: 2 })} |
        Total Cost: {getSymbol(baseCurrency)}{totalCostBase.toLocaleString(undefined, { maximumFractionDigits: 2 })} |
        Total P/L: <span style={{ color: totalPLBase >= 0 ? 'green' : 'red' }}>{getSymbol(baseCurrency)}{totalPLBase.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
      </Box>
      <Dialog open={infoOpen} onClose={handleInfoClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          {infoData && infoData.sector && infoData.sector.toLowerCase().includes('crypto') ? 'Cryptocurrency Info' :
            (infoData && infoData.sector && infoData.sector.toLowerCase().includes('etf') ? 'ETF Info' :
              (infoData && infoData.sector && infoData.sector.toLowerCase().includes('digital assets') ? 'ETF Info' :
                (infoData && infoData.sector && infoData.sector.toLowerCase().includes('commodity') && infoData.industry && infoData.industry.toLowerCase().includes('etf') ? 'ETF Info' :
                  (infoData && infoData.asset_type && infoData.asset_type.toLowerCase() === 'etf' ? 'ETF Info' :
                    (infoData && infoData.asset_type && infoData.asset_type.toLowerCase().includes('crypto') ? 'Cryptocurrency Info' :
                      'Stock Info')))))}: {infoSymbol}
        </DialogTitle>
        <DialogContent>
          {infoLoading && <Box display="flex" justifyContent="center" alignItems="center" minHeight={120}><CircularProgress /></Box>}
          {infoError && <Typography color="error">{infoError}</Typography>}
          {infoData && !infoError && (
            <Box>
              {infoData.error && (
                <Typography color="error">{infoData.error}</Typography>
              )}
              <Typography variant="h6">{infoData.name || infoSymbol}</Typography>
              <Typography variant="subtitle1" color="text.secondary">
                {infoData.sector || ''} {infoData.industry ? `| ${infoData.industry}` : ''}
              </Typography>
              <Typography variant="body2" color="text.secondary">Exchange: {infoData.exchange || '-'}</Typography>
              <Typography variant="body2" color="text.secondary">Market Cap: {infoData.marketCap ? infoData.marketCap.toLocaleString() : '-'}</Typography>
              <Typography variant="body2" color="text.secondary">Currency: {infoData.currency || '-'}</Typography>
              <Typography variant="body2" color="text.secondary">Price: {infoData.price !== undefined ? infoData.price : '-'}</Typography>
              {infoData.website && <Typography variant="body2">Website: <Link href={infoData.website} target="_blank" rel="noopener">{infoData.website}</Link></Typography>}
              {infoData.description && <Typography variant="body2" sx={{ mt: 1 }}>{infoData.description}</Typography>}
              {infoData.info_available === false && (
                <Typography variant="body2" color="warning.main" sx={{ mt: 2 }}>
                  Detailed info not available for this symbol, but price is shown above.
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default PortfolioTable; 
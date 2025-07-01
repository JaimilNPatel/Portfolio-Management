import React from 'react';
import { Box, Paper, Typography, Grid, Chip } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PaidIcon from '@mui/icons-material/Paid';

function getSymbol(code, currencies) {
  const found = currencies?.find(c => c.code === code);
  return found ? found.symbol : code;
}

export default function SummaryBar({ totalValue, totalCost, totalPL, returnPercent, baseCurrency, currencies }) {
  return (
    <Paper elevation={4} sx={{
      position: 'sticky',
      top: 64,
      zIndex: 1100,
      width: '100%',
      borderRadius: 0,
      px: { xs: 1, md: 4 },
      py: 1.5,
      mb: 2,
      bgcolor: '#fff',
      boxShadow: 3,
      transition: 'box-shadow 0.3s',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 64
    }}>
      <Grid container spacing={2} alignItems="center" justifyContent="center">
        <Grid item xs={6} md={3}>
          <Box display="flex" alignItems="center" gap={1}>
            <AccountBalanceWalletIcon color="primary" />
            <Typography variant="subtitle2" color="text.secondary">Total Value</Typography>
          </Box>
          <Typography variant="h6" fontWeight={700} color="primary.main">
            {getSymbol(baseCurrency, currencies)}{totalValue?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </Typography>
        </Grid>
        <Grid item xs={6} md={3}>
          <Box display="flex" alignItems="center" gap={1}>
            <PaidIcon color="secondary" />
            <Typography variant="subtitle2" color="text.secondary">Total Cost</Typography>
          </Box>
          <Typography variant="h6" fontWeight={700} color="secondary.main">
            {getSymbol(baseCurrency, currencies)}{totalCost?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </Typography>
        </Grid>
        <Grid item xs={6} md={3}>
          <Box display="flex" alignItems="center" gap={1}>
            {totalPL >= 0 ? <TrendingUpIcon sx={{ color: 'green' }} /> : <TrendingDownIcon sx={{ color: 'red' }} />}
            <Typography variant="subtitle2" color="text.secondary">Total P/L</Typography>
          </Box>
          <Typography variant="h6" fontWeight={700} sx={{ color: totalPL >= 0 ? 'green' : 'red' }}>
            {getSymbol(baseCurrency, currencies)}{totalPL?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </Typography>
        </Grid>
        <Grid item xs={6} md={3}>
          <Box display="flex" alignItems="center" gap={1}>
            <Chip label="Return %" color="info" size="small" />
          </Box>
          <Typography variant="h6" fontWeight={700} color={returnPercent >= 0 ? 'green' : 'red'}>
            {isFinite(returnPercent) ? `${returnPercent.toFixed(2)}%` : '0.00%'}
          </Typography>
        </Grid>
      </Grid>
    </Paper>
  );
} 
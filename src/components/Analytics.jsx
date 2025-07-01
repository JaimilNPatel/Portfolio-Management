import React, { useEffect, useRef, useState } from 'react';
import { Paper, Typography, Box, Card, CardContent, CardHeader, Grid, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import Chart from 'chart.js/auto';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import PieChartIcon from '@mui/icons-material/PieChart';

function Analytics({ portfolio, totals, baseCurrency, setBaseCurrency, fxRates, currencies }) {
  const pieRef = useRef();
  const barRef = useRef();
  const sectorPieRef = useRef();
  const [converted, setConverted] = useState([]);

  // Convert all asset values to base currency using provided fxRates
  useEffect(() => {
    setConverted(
      portfolio.map(a => {
        const rate = fxRates[a.currency] || 1.0;
        return {
          ...a,
          value_converted: a.current_value * rate,
          profit_loss_converted: a.profit_loss * rate,
        };
      })
    );
  }, [portfolio, fxRates]);

  useEffect(() => {
    if (!converted.length) return;
    // Pie chart for value distribution (in base currency)
    const pieCtx = pieRef.current.getContext('2d');
    if (window.pieChart) window.pieChart.destroy();
    window.pieChart = new Chart(pieCtx, {
      type: 'pie',
      data: {
        labels: converted.map(a => a.symbol),
        datasets: [{
          data: converted.map(a => a.value_converted),
          backgroundColor: converted.map((_, i) => `hsl(${i * 60}, 70%, 60%)`)
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });
    // Bar chart for profit/loss (in base currency)
    const barCtx = barRef.current.getContext('2d');
    if (window.barChart) window.barChart.destroy();
    window.barChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: converted.map(a => a.symbol),
        datasets: [{
          label: 'Profit/Loss',
          data: converted.map(a => a.profit_loss_converted),
          backgroundColor: converted.map(a => a.profit_loss_converted >= 0 ? 'rgba(60,180,75,0.7)' : 'rgba(220,50,32,0.7)')
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
    // Compute sector allocation
    const sectorMap = {};
    converted.forEach(a => {
      const sector = a.sector || 'Other';
      if (!sectorMap[sector]) sectorMap[sector] = 0;
      sectorMap[sector] += a.value_converted;
    });
    const sectorLabels = Object.keys(sectorMap);
    const sectorValues = Object.values(sectorMap);
    // Sector allocation pie
    if (sectorPieRef.current) {
      if (window.sectorPieChart) window.sectorPieChart.destroy();
      window.sectorPieChart = new Chart(sectorPieRef.current.getContext('2d'), {
        type: 'pie',
        data: {
          labels: sectorLabels,
          datasets: [{
            data: sectorValues,
            backgroundColor: sectorLabels.map((_, i) => `hsl(${i * 360 / sectorLabels.length}, 70%, 60%)`)
          }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
      });
    }
  }, [converted, baseCurrency]);

  if (!converted.length) return <Paper sx={{ mt: 4, p: 2 }}>No assets in portfolio.</Paper>;
  let best = converted[0], worst = converted[0];
  converted.forEach(a => {
    if (a.profit_loss_converted > best.profit_loss_converted) best = a;
    if (a.profit_loss_converted < worst.profit_loss_converted) worst = a;
  });
  const totalValue = converted.reduce((sum, a) => sum + a.value_converted, 0);
  const totalCost = portfolio.reduce((sum, a) => {
    const rate = fxRates[a.currency] || 1.0;
    return sum + (a.buy_price * a.quantity * rate);
  }, 0);
  const totalReturn = ((totalValue - totalCost) / (totalCost || 1)) * 100;

  return (
    <Box sx={{ width: '100%', px: { xs: 1, md: 2 }, py: 2 }}>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4} sx={{ minWidth: 0 }}>
          <Card elevation={3} sx={{ height: '100%', bgcolor: '#f7fafd', transition: 'box-shadow 0.3s', '&:hover': { boxShadow: 6 }, minWidth: 0 }}>
            <CardHeader avatar={<EmojiEventsIcon color="primary" />} title="Best Performer"/>
            <CardContent>
              <Typography variant="h6">{best.symbol}</Typography>
              <Typography color="success.main" fontWeight={700}>{baseCurrency} {best.profit_loss_converted.toFixed(2)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4} sx={{ minWidth: 0 }}>
          <Card elevation={3} sx={{ height: '100%', bgcolor: '#f7fafd', transition: 'box-shadow 0.3s', '&:hover': { boxShadow: 6 }, minWidth: 0 }}>
            <CardHeader avatar={<TrendingUpIcon color="success" />} title="Total Return"/>
            <CardContent>
              <Typography variant="h6">{isFinite(totalReturn) ? totalReturn.toFixed(2) : '0.00'}%</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4} sx={{ minWidth: 0 }}>
          <Card elevation={3} sx={{ height: '100%', bgcolor: '#f7fafd', transition: 'box-shadow 0.3s', '&:hover': { boxShadow: 6 }, minWidth: 0 }}>
            <CardHeader avatar={<TrendingDownIcon color="error" />} title="Worst Performer"/>
            <CardContent>
              <Typography variant="h6">{worst.symbol}</Typography>
              <Typography color="error.main" fontWeight={700}>{baseCurrency} {worst.profit_loss_converted.toFixed(2)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12}>
          <Paper elevation={2} sx={{ p: 2, bgcolor: '#fff', display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'stretch' }}>
            <Box sx={{ flex: 1, minWidth: 260, maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', mb: { xs: 2, md: 0 } }}>
              <CardHeader title="Value Distribution" sx={{ p: 0, mb: 1 }} />
              <Box sx={{ width: '100%', aspectRatio: '1 / 1', position: 'relative', minWidth: 0 }}>
                <canvas ref={pieRef} style={{ width: '100%', height: '100%' }}></canvas>
              </Box>
            </Box>
            <Box sx={{ flex: 1, minWidth: 260, maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', mb: { xs: 2, md: 0 } }}>
              <CardHeader title="Profit/Loss by Asset" sx={{ p: 0, mb: 1 }} />
              <Box sx={{ width: '100%', aspectRatio: '2 / 1', position: 'relative', minWidth: 0 }}>
                <canvas ref={barRef} style={{ width: '100%', height: '100%' }}></canvas>
              </Box>
            </Box>
            <Box sx={{ flex: 1, minWidth: 260, maxWidth: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', mb: { xs: 2, md: 0 } }}>
              <CardHeader avatar={<PieChartIcon color="info" />} title="Sector Allocation" sx={{ p: 0, mb: 1 }} />
              <Box sx={{ width: '100%', aspectRatio: '1 / 1', position: 'relative', minWidth: 0 }}>
                <canvas ref={sectorPieRef} style={{ width: '100%', height: '100%' }}></canvas>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
      <Paper sx={{ mt: 2, p: 2, minWidth: 0, width: '100%' }}>
        <Typography variant="subtitle1" fontWeight={700} mb={1}>Asset Details</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Symbol</TableCell>
                <TableCell>Buy Date</TableCell>
                <TableCell>Exchange</TableCell>
                <TableCell>Currency</TableCell>
                <TableCell>Value (Orig)</TableCell>
                <TableCell>P/L (Orig)</TableCell>
                <TableCell>% Change (Orig)</TableCell>
                <TableCell>Value ({baseCurrency})</TableCell>
                <TableCell>P/L ({baseCurrency})</TableCell>
                <TableCell>% Change ({baseCurrency})</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {converted.map((a, idx) => {
                const cost_basis = a.buy_price * a.quantity;
                const percent_change = cost_basis ? ((a.current_value - cost_basis) / cost_basis) * 100 : 0;
                const cost_basis_converted = (a.buy_price * a.quantity) * (fxRates[a.currency] || 1.0);
                const percent_change_converted = cost_basis_converted ? ((a.value_converted - cost_basis_converted) / cost_basis_converted) * 100 : 0;
                return (
                  <TableRow key={a.symbol} hover sx={{ transition: 'background 0.2s', '&:hover': { bgcolor: '#e3f2fd' } }}>
                    <TableCell>{a.symbol}</TableCell>
                    <TableCell>{a.buy_date ? new Date(a.buy_date).toLocaleString() : '-'}</TableCell>
                    <TableCell>{a.exchange}</TableCell>
                    <TableCell>{a.currency}</TableCell>
                    <TableCell>{a.current_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                    <TableCell style={{ color: a.profit_loss >= 0 ? 'green' : 'red' }}>{a.profit_loss.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                    <TableCell style={{ color: percent_change >= 0 ? 'green' : 'red' }}>{percent_change.toFixed(2)}%</TableCell>
                    <TableCell>{a.value_converted.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                    <TableCell style={{ color: a.profit_loss_converted >= 0 ? 'green' : 'red' }}>{a.profit_loss_converted.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                    <TableCell style={{ color: percent_change_converted >= 0 ? 'green' : 'red' }}>{percent_change_converted.toFixed(2)}%</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

export default Analytics; 
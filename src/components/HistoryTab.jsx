import React, { useState } from 'react';
import { Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Button, Grid, Tooltip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import axios from 'axios';

const API = 'http://localhost:8000';

export default function HistoryTab({ history, available, onSetAvailable, portfolioValue, fetchHistory, baseCurrency = 'USD', fxRates = {}, currencies = [] }) {
  const [filter, setFilter] = useState('');
  const [amountInput, setAmountInput] = useState(available);
  const [notesInput, setNotesInput] = useState('');
  const [editTx, setEditTx] = useState(null);
  const [editFields, setEditFields] = useState({});

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction?')) return;
    await axios.delete(`${API}/transaction/${id}`);
    if (fetchHistory) fetchHistory();
  };

  const handleEditOpen = (tx) => {
    setEditTx(tx);
    setEditFields({
      notes: tx.notes || '',
      value: tx.value,
      price: tx.price,
      quantity: tx.quantity,
    });
  };
  const handleEditChange = (field, value) => {
    setEditFields(f => ({ ...f, [field]: value }));
  };
  const handleEditSave = async () => {
    await axios.patch(`${API}/transaction/${editTx.id}`, editFields);
    setEditTx(null);
    if (fetchHistory) fetchHistory();
  };

  const filtered = history.filter(tx =>
    tx.symbol?.toLowerCase().includes(filter.toLowerCase()) ||
    tx.name?.toLowerCase().includes(filter.toLowerCase()) ||
    tx.action?.toLowerCase().includes(filter.toLowerCase())
  );

  // Helper to get currency symbol
  const getSymbol = (code) => {
    const found = currencies.find(c => c.code === code);
    return found ? found.symbol : code;
  };

  // Calculate totals in base currency (improved logic)
  const totalInvestedBase = history.filter(tx => tx.action === 'BUY').reduce((sum, tx) => {
    // Use tx.currency if present, else fallback to asset currency or 1.0
    const rate = tx.currency ? (fxRates[tx.currency] || 1.0) : 1.0;
    return sum + (tx.value || 0) * rate;
  }, 0);
  const totalRealizedBase = history.filter(tx => tx.action === 'SELL').reduce((sum, tx) => {
    const rate = tx.currency ? (fxRates[tx.currency] || 1.0) : 1.0;
    return sum + (tx.value || 0) * rate;
  }, 0);
  const balanceAddBase = history.filter(tx => tx.action === 'ADD').reduce((sum, tx) => {
    const rate = tx.currency ? (fxRates[tx.currency] || 1.0) : 1.0;
    return sum + (tx.value || 0) * rate;
  }, 0);
  const balanceAdjustBase = history.filter(tx => tx.action === 'ADJUST').reduce((sum, tx) => {
    const rate = tx.currency ? (fxRates[tx.currency] || 1.0) : 1.0;
    return sum + (tx.value || 0) * rate;
  }, 0);

  // Calculate totals
  const totalInvested = history.filter(tx => tx.action === 'BUY').reduce((sum, tx) => sum + (tx.value || 0), 0);
  const totalRealized = history.filter(tx => tx.action === 'SELL').reduce((sum, tx) => sum + (tx.value || 0), 0);
  const balanceAdd = history.filter(tx => tx.action === 'ADD').reduce((sum, tx) => sum + (tx.value || 0), 0);
  const balanceAdjust = history.filter(tx => tx.action === 'ADJUST').reduce((sum, tx) => sum + (tx.value || 0), 0);
  const totalBalance = (available || 0) + (portfolioValue || 0);

  return (
    <Box sx={{ p: 2 }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={2}>
            <Tooltip title="Sum of all BUY transactions (money spent on assets)"><Typography variant="h6">Total Invested: {totalInvested.toLocaleString()} <span style={{color:'#888', fontSize:13}}>({getSymbol(baseCurrency)}{totalInvestedBase.toLocaleString(undefined, { maximumFractionDigits: 2 })})</span></Typography></Tooltip>
          </Grid>
          <Grid item xs={12} md={2}>
            <Tooltip title="Sum of all SELL transactions (money received from sales)"><Typography variant="h6">Total Realized: {totalRealized.toLocaleString()} <span style={{color:'#888', fontSize:13}}>({getSymbol(baseCurrency)}{totalRealizedBase.toLocaleString(undefined, { maximumFractionDigits: 2 })})</span></Typography></Tooltip>
          </Grid>
          <Grid item xs={12} md={2}>
            <Tooltip title="Sum of all manual balance adds"><Typography variant="h6">Balance Add: {balanceAdd.toLocaleString()} <span style={{color:'#888', fontSize:13}}>({getSymbol(baseCurrency)}{balanceAddBase.toLocaleString(undefined, { maximumFractionDigits: 2 })})</span></Typography></Tooltip>
          </Grid>
          <Grid item xs={12} md={2}>
            <Tooltip title="Sum of all manual balance adjustments"><Typography variant="h6">Balance Adjust: {balanceAdjust.toLocaleString()} <span style={{color:'#888', fontSize:13}}>({getSymbol(baseCurrency)}{balanceAdjustBase.toLocaleString(undefined, { maximumFractionDigits: 2 })})</span></Typography></Tooltip>
          </Grid>
          <Grid item xs={12} md={2}>
            <Tooltip title="Cash available to invest"><Typography variant="h6">Available Amount: {available.toLocaleString()}</Typography></Tooltip>
          </Grid>
          <Grid item xs={12} md={2}>
            <Tooltip title="Available Amount + Current Portfolio Value"><Typography variant="h6">Total Balance: {totalBalance.toLocaleString()}</Typography></Tooltip>
          </Grid>
          <Grid item xs={12} md={6} mt={2}>
            <TextField label="Set Available Amount" type="number" value={amountInput} onChange={e => setAmountInput(e.target.value)} size="small" sx={{ mr: 1 }} />
            <TextField label="Notes" value={notesInput} onChange={e => setNotesInput(e.target.value)} size="small" sx={{ mr: 1, width: 180 }} />
            <Button variant="contained" onClick={() => onSetAvailable(Number(amountInput), notesInput)}>Set</Button>
          </Grid>
        </Grid>
      </Paper>
      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField label="Search/Filter" value={filter} onChange={e => setFilter(e.target.value)} size="small" sx={{ mb: 2, width: 300 }} />
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date/Time</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Symbol</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Qty</TableCell>
                <TableCell>Price</TableCell>
                <TableCell>Value (Asset Currency)</TableCell>
                <TableCell>Value ({baseCurrency})</TableCell>
                <TableCell>P/L (Asset Currency)</TableCell>
                <TableCell>P/L ({baseCurrency})</TableCell>
                <TableCell>Balance After</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell>Delete</TableCell>
                <TableCell>Edit</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(tx => {
                // Improved: Use tx.currency if present, else fallback to 1.0
                const rate = tx.currency ? (fxRates[tx.currency] || 1.0) : 1.0;
                const valueBase = (tx.value || 0) * rate;
                const plBase = (tx.pl || 0) * rate;
                const assetSymbol = tx.currency ? getSymbol(tx.currency) : '-';
                return (
                  <TableRow key={tx.id || tx.datetime + tx.symbol + tx.action}>
                    <TableCell>{tx.datetime ? new Date(tx.datetime).toLocaleString() : ''}</TableCell>
                    <TableCell>{tx.action}</TableCell>
                    <TableCell>{tx.symbol}</TableCell>
                    <TableCell>{tx.name}</TableCell>
                    <TableCell>{tx.asset_type}</TableCell>
                    <TableCell>{tx.quantity}</TableCell>
                    <TableCell>{tx.price}</TableCell>
                    <TableCell>{assetSymbol} {tx.value}</TableCell>
                    <TableCell>{getSymbol(baseCurrency)} {valueBase.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                    <TableCell>{assetSymbol} {tx.pl}</TableCell>
                    <TableCell>{getSymbol(baseCurrency)} {plBase.toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                    <TableCell>{tx.balance_after}</TableCell>
                    <TableCell>{tx.notes}</TableCell>
                    <TableCell><IconButton onClick={() => handleDelete(tx.id)} size="small"><DeleteIcon /></IconButton></TableCell>
                    <TableCell><IconButton onClick={() => handleEditOpen(tx)} size="small"><EditIcon /></IconButton></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <Dialog open={!!editTx} onClose={() => setEditTx(null)}>
        <DialogTitle>Edit Transaction</DialogTitle>
        <DialogContent>
          <TextField label="Notes" value={editFields.notes} onChange={e => handleEditChange('notes', e.target.value)} fullWidth sx={{ mb: 2 }} />
          <TextField label="Value" type="number" value={editFields.value} onChange={e => handleEditChange('value', e.target.value)} fullWidth sx={{ mb: 2 }} />
          <TextField label="Price" type="number" value={editFields.price} onChange={e => handleEditChange('price', e.target.value)} fullWidth sx={{ mb: 2 }} />
          <TextField label="Quantity" type="number" value={editFields.quantity} onChange={e => handleEditChange('quantity', e.target.value)} fullWidth sx={{ mb: 2 }} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditTx(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditSave}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 
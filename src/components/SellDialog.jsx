import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography } from '@mui/material';

function SellDialog({ open, onClose, onSubmit, asset }) {
  const [quantity, setQuantity] = useState('');

  useEffect(() => {
    setQuantity('');
  }, [asset, open]);

  const handleSell = (e) => {
    e.preventDefault();
    if (!quantity || !asset) return;
    onSubmit(asset.symbol, parseFloat(quantity));
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Sell Asset</DialogTitle>
      <form onSubmit={handleSell}>
        <DialogContent>
          <Typography variant="h6" mb={2}>Sell Asset</Typography>
          <Typography>Symbol: <b>{asset ? asset.symbol : ''}</b></Typography>
          <Typography>Max Quantity: <b>{asset ? asset.quantity : ''}</b></Typography>
          <TextField
            label="Quantity to Sell"
            type="number"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            fullWidth
            margin="normal"
            required
            inputProps={{ min: 0, max: asset ? asset.quantity : undefined }}
            sx={{ fontSize: 22, mb: 2 }}
            color={quantity > (asset ? asset.quantity : 0) ? 'error' : 'primary'}
          />
          {quantity > (asset ? asset.quantity : 0) && (
            <Typography color="error" variant="body2">Cannot sell more than you own!</Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" color="error">Sell</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default SellDialog; 
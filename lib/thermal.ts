// The initial 48 mm printable width must be calibrated on the physical Z92.
export const thermalStyles = `
.receipt-paper { width: 48mm; margin: 0 auto; color: #000; background: #fff; font: 11px/1.45 Arial, sans-serif; overflow-wrap: anywhere; }
.receipt-paper p { margin: 0 0 3px; }
.receipt-paper h2 { font-size: 15px; font-weight: 800; margin: 0 0 5px; }
.receipt-row { display: flex; flex-wrap: wrap; justify-content: space-between; column-gap: 6px; margin: 3px 0; }
.receipt-row > :last-child { text-align: right; margin-left: auto; max-width: 100%; overflow-wrap: anywhere; min-width: 0; font-variant-numeric: tabular-nums; }
.receipt-section { border-top: 1px dashed #000; margin-top: 8px; padding-top: 8px; }
.receipt-item { margin-bottom: 8px; break-inside: auto; }
.receipt-paper h2, .receipt-paper h3 { break-after: avoid; }
.receipt-paper h3 { font-size: 12px; font-weight: 800; margin: 8px 0 4px; }
.receipt-paper, .receipt-section { break-inside: auto; }
.receipt-row { break-inside: avoid; }
body:has(> .thermal-document) > :not(.thermal-document) { display: none; }
.receipt-preview { width: 58mm; box-sizing: border-box; }
.receipt-total { font-weight: 800; font-size: 13px; }
@media print {
  @page { size: auto; margin: 0; }
  html, body { width: 58mm !important; min-width: 0 !important; height: auto !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; background: #fff !important; }
  body > :not(.receipt-overlay) { display: none !important; }
  .receipt-overlay, .receipt-shell, .receipt-preview { display: block !important; position: static !important; width: 58mm !important; max-width: none !important; height: auto !important; max-height: none !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; box-shadow: none !important; background: #fff !important; }
  .receipt-controls { display: none !important; }
  .receipt-paper { padding: 3mm 0 8mm; }
  .receipt-paper * { color: #000 !important; border-color: #000 !important; }
}
`;

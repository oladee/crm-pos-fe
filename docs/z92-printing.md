# Z92 browser receipt printing — hardware release gate

Status: software implementation only; physical terminal printing is NOT verified.

## Before rollout

1. On the Z92, open a completed transaction receipt and select **Print receipt**.
2. Verify the existing Android print dialog lists the built-in printer. If absent, stop rollout: this PWA cannot access the hardware SDK or install a print service.
3. Select 58 mm roll paper, portrait, no headers/footers, no extra margins, and normal/100% scale where the dialog offers these controls.
4. Print a short receipt and a 40-item receipt with long names, fractional quantities, discounts, tax, large totals and provider charges.
5. Verify no clipping, overlap, unexpected scaling, missing items, blank pages or unreadable text. Verify the footer clears the tear edge.
6. Calibrate the initial 48 mm content width against physical output before release. CSS cannot force an Android driver to offer roll media.
7. Cancel the print dialog, then retry. Test paper-out, reload paper and retry from history. Closing the dialog never marks a receipt as printed.

## Deployment and behavior

Deploy the POS backend and frontend together. Transfer responses add optional `confirmedAt`; local sale receipt metadata retains processor, reference, fee, payable amount and confirmation time. Older sales remain printable without those fields.

`GET /pos/payments/transfers?includePaid=true` also returns paid transfers from the authenticated till, subject to the existing location/cashier scope, allowing recovery after the PWA was closed. Default list behavior is unchanged.

Manual confirmation and paid status refreshes save the same receipt. The non-interrupting **View receipt** notice opens it; Sales history supports repeat printing. Repeated confirmations do not decrement cached stock twice. Reprints never send sale or inventory mutations.

Dates use Africa/Lagos (WAT). Store name is the configured location name. Provider charges are separate from merchandise totals. Browser paper selection controls page size; CSS requests zero page margins and isolates 48 mm receipt content.

No automatic printing, APK wrapper, printer-status detection or physical-print success tracking is included.

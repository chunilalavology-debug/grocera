/** Matches backend `VALID_ADMIN_TRANSITION_STATUSES` (WooCommerce-inspired + legacy). */
export const ORDER_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'processing', label: 'Processing' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'packed', label: 'Packed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'on_the_way', label: 'On the way' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refunded', label: 'Refunded' },
  { value: 'failed', label: 'Failed' },
];

export function orderStatusLabel(status) {
  const row = ORDER_STATUS_OPTIONS.find((o) => o.value === status);
  return row ? row.label : status || '—';
}

export function orderStatusBadgeVariant(status) {
  if (status === 'delivered' || status === 'completed') return 'success';
  if (status === 'cancelled' || status === 'failed' || status === 'refunded') return 'danger';
  if (status === 'on_hold' || status === 'pending' || status === 'confirmed') return 'warning';
  return 'info';
}

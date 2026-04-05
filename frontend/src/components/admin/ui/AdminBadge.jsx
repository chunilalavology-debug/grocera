import React from 'react';

const variants = {
  success: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-600/20',
  warning: 'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-600/20',
  danger: 'bg-red-50 text-red-800 ring-1 ring-inset ring-red-600/15',
  neutral: 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-500/10',
  info: 'bg-sky-50 text-sky-900 ring-1 ring-inset ring-sky-600/20',
  muted: 'bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200',
};

/**
 * Shopify-style pill badge
 */
export function AdminBadge({ children, variant = 'neutral', className = '', as: Comp = 'span' }) {
  return (
    <Comp
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${variants[variant] || variants.neutral} ${className}`}
    >
      {children}
    </Comp>
  );
}

export default AdminBadge;

import React from 'react';

const base =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

const sizes = {
  sm: 'px-3 py-1.5 text-xs min-h-[32px]',
  md: 'px-4 py-2 text-sm min-h-[36px]',
  lg: 'px-5 py-2.5 text-sm min-h-[44px]',
};

const variants = {
  primary:
    'bg-[#008060] text-white shadow-sm hover:bg-[#006e52] focus-visible:ring-[#008060] active:scale-[0.98]',
  secondary:
    'bg-white text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 focus-visible:ring-slate-400',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-300 border border-transparent',
  danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50 focus-visible:ring-red-400',
  dangerSolid: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 shadow-sm',
};

export function AdminButton({
  children,
  variant = 'secondary',
  size = 'md',
  className = '',
  type = 'button',
  ...rest
}) {
  return (
    <button type={type} className={`${base} ${sizes[size]} ${variants[variant] || variants.secondary} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export default AdminButton;

import React from 'react';

export function AdminCard({ children, className = '', padding = 'p-5', title, subtitle, action }) {
  return (
    <section className={`admin-card-surface ${className}`.trim()}>
      {(title || subtitle || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title ? (
              <h2 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h2>
            ) : null}
            {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      <div className={title || subtitle || action ? padding : padding}>{children}</div>
    </section>
  );
}

export default AdminCard;

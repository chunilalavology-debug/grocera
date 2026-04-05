import React from 'react';

/**
 * Standard admin page frame (matches Products / Orders shell).
 * Uses design tokens from admin-tokens.css (8px rhythm, Inter, soft shadow).
 */
export function AdminPageShell({ title, description, actions, children, noPadding = false }) {
  return (
    <div className="admin-design-scope mx-auto max-w-[1600px] space-y-6 pb-12 font-sans text-slate-900">
      <div className="admin-card-surface overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-[var(--admin-space-2)]">
          <div>
            <h1 className="admin-shell-title">{title}</h1>
            {description ? (
              typeof description === 'string' ? (
                <p className="admin-shell-desc">{description}</p>
              ) : (
                <div className="admin-shell-desc">{description}</div>
              )
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        <div className={noPadding ? '' : 'p-5 sm:p-6'}>{children}</div>
      </div>
    </div>
  );
}

export default AdminPageShell;

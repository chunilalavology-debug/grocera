import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import AdminButton from './AdminButton';

/**
 * Accessible confirm dialog (replaces window.confirm for premium UX)
 */
export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onClose,
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-modal-title">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity"
        aria-label="Close dialog"
        onClick={loading ? undefined : onClose}
      />
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-900/10">
        <div className="flex items-start justify-between gap-3">
          <h2 id="confirm-modal-title" className="text-lg font-semibold text-slate-900 pr-8">
            {title}
          </h2>
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            onClick={loading ? undefined : onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        {description ? <p className="mt-2 text-sm text-slate-600 leading-relaxed">{description}</p> : null}
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <AdminButton variant="ghost" size="md" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </AdminButton>
          <AdminButton
            variant={variant === 'danger' ? 'dangerSolid' : 'primary'}
            size="md"
            disabled={loading}
            onClick={() => onConfirm()}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </AdminButton>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;

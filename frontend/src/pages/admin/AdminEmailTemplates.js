import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Save, Eye, ArrowLeft } from 'lucide-react';
import { AdminButton, AdminPageShell } from '../../components/admin/ui';

const VARIABLE_HELP = [
  '{{customerName}}',
  '{{customerEmail}}',
  '{{orderNumber}}',
  '{{orderId}}',
  '{{orderItemsHtml}}',
  '{{totalAmount}}',
  '{{shippingAddressHtml}}',
  '{{status}}',
  '{{statusLabel}}',
  '{{statusMessage}}',
  '{{trackingBlockHtml}}',
  '{{storeName}}',
  '{{contactName}}',
  '{{contactEmail}}',
  '{{queryType}}',
  '{{contactSubject}}',
  '{{contactMessage}}',
];

const quillModules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ color: [] }, { background: [] }],
    ['link'],
    ['clean'],
  ],
};

export default function AdminEmailTemplates() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState(null);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const selected = useMemo(() => list.find((t) => t.key === selectedKey), [list, selectedKey]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/email-templates');
      if (res.success && Array.isArray(res.data) && res.data.length) {
        setList(res.data);
        setSelectedKey((k) => k || res.data[0].key);
      }
    } catch {
      toast.error('Could not load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const t = list.find((x) => x.key === selectedKey);
    if (t) {
      setSubject(t.subject || '');
      setBodyHtml(t.bodyHtml || '');
    }
  }, [selectedKey, list]);

  const save = async () => {
    if (!selectedKey) return;
    try {
      setSaving(true);
      const res = await api.put(`/admin/email-templates/${encodeURIComponent(selectedKey)}`, {
        subject,
        bodyHtml,
      });
      if (res.success) {
        toast.success('Template saved');
        setList((prev) => prev.map((t) => (t.key === selectedKey ? { ...t, subject, bodyHtml } : t)));
      }
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const runPreview = async () => {
    if (!selectedKey) return;
    try {
      const res = await api.post('/admin/email-templates/preview', {
        key: selectedKey,
        subject,
        bodyHtml,
      });
      if (res.success && res.data) {
        setPreviewSubject(res.data.subject || '');
        setPreviewHtml(res.data.html || '');
        setPreviewOpen(true);
      }
    } catch (e) {
      toast.error(e.message || 'Preview failed');
    }
  };

  const insertVar = (v) => {
    const q = document.querySelector('.admin-email-quill .ql-editor');
    if (q) {
      q.focus();
      document.execCommand('insertText', false, v);
    } else {
      setBodyHtml((prev) => `${prev || ''}${v}`);
    }
  };

  return (
    <>
    <AdminPageShell
      title="Email templates"
      description="Edit subjects and HTML bodies. Each order fulfillment status has its own template (Order: Pending, Order: Processing, …) plus shared fallbacks. Customer status emails use {{customerName}}, {{orderNumber}}, {{statusMessage}}, {{orderItemsHtml}}, {{totalAmount}}, etc."
      actions={
        <>
          <AdminButton variant="secondary" size="md" type="button" onClick={() => void runPreview()}>
            <Eye className="h-4 w-4" />
            Preview
          </AdminButton>
          <AdminButton variant="primary" size="md" type="button" disabled={saving || !selectedKey} onClick={() => void save()}>
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save'}
          </AdminButton>
        </>
      }
      noPadding
    >
      <div className="border-b border-slate-100 px-5 py-3 sm:px-6">
        <Link
          to="/admin/settings/email"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#008060]"
        >
          <ArrowLeft className="h-4 w-4" />
          Email &amp; SMTP
        </Link>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500">Loading templates…</div>
      ) : (
        <div className="grid grid-cols-1 gap-0 lg:grid-cols-[240px_1fr]">
          <aside className="border-b border-slate-100 bg-slate-50/50 lg:border-b-0 lg:border-r">
            <nav className="flex flex-col gap-0.5 p-3">
              {list.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setSelectedKey(t.key)}
                  className={`rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                    selectedKey === t.key
                      ? 'bg-white text-[#008060] shadow-sm ring-1 ring-slate-200/80'
                      : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
                  }`}
                >
                  <span className="block truncate">{t.name}</span>
                  <span className="mt-0.5 block truncate text-xs font-normal text-slate-400">{t.key}</span>
                </button>
              ))}
            </nav>
          </aside>

          <div className="space-y-6 p-5 sm:p-6">
            {selected ? (
              <p className="text-sm text-slate-500">{selected.description}</p>
            ) : (
              <p className="text-sm text-slate-500">Select a template.</p>
            )}

            <div>
              <label className="admin-label">Subject</label>
              <input
                className="admin-field"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Order confirmation – #{{orderNumber}}"
              />
            </div>

            <div>
              <label className="admin-label">Body (HTML)</label>
              <p className="mb-2 text-xs text-slate-400">Insert variables (plain text tokens in subject or body):</p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {VARIABLE_HELP.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVar(v)}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px] text-slate-600 transition-colors hover:border-[#008060]/40 hover:bg-emerald-50/50"
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div className="admin-email-quill overflow-hidden rounded-[var(--admin-radius)] border border-slate-200 bg-white">
                <ReactQuill theme="snow" value={bodyHtml} onChange={setBodyHtml} modules={quillModules} className="min-h-[280px]" />
              </div>
            </div>
          </div>
        </div>
      )}

    </AdminPageShell>

    {previewOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Email preview"
        >
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Preview</p>
                <p className="text-sm font-medium text-slate-800">{previewSubject}</p>
              </div>
              <AdminButton variant="secondary" size="sm" type="button" onClick={() => setPreviewOpen(false)}>
                Close
              </AdminButton>
            </div>
            <iframe title="Email preview" className="min-h-[400px] w-full flex-1 border-0 bg-slate-50" srcDoc={previewHtml} />
          </div>
        </div>
      ) : null}
    </>
  );
}

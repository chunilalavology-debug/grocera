import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Bell, Eye, Save, Settings2 } from 'lucide-react';
import { AdminButton, AdminPageShell } from '../../components/admin/ui';

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

function splitVariables(help) {
  if (!help || typeof help !== 'string') return [];
  return help.split(/\s+/).map((s) => s.trim()).filter(Boolean);
}

function rowCanToggle(row) {
  return Boolean(row.toggleKey || row.orderStatusKey);
}

function isRowEnabled(row, n) {
  if (!n) return true;
  if (row.orderStatusKey) {
    return n.orderStatusEmail?.[row.orderStatusKey] !== false;
  }
  if (row.toggleKey) {
    return n[row.toggleKey] !== false;
  }
  return true;
}

export default function AdminEmailCenter() {
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [emailNotifications, setEmailNotifications] = useState(null);
  const [savingToggleId, setSavingToggleId] = useState(null);

  const [modalRow, setModalRow] = useState(null);
  const [modalTemplateKey, setModalTemplateKey] = useState(null);
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/email/workspace');
      if (res.success && res.data) {
        setCatalog(res.data.catalog);
        setTemplates(Array.isArray(res.data.templates) ? res.data.templates : []);
        setEmailNotifications(res.data.emailNotifications || null);
      }
    } catch {
      toast.error('Could not load email workspace');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => (catalog && Array.isArray(catalog.rows) ? catalog.rows : []), [catalog]);

  const openModal = (row) => {
    const keys = row.templateKeys || (row.templateKey ? [row.templateKey] : []);
    if (!keys.length) {
      toast.error('No template is linked to this notification.');
      return;
    }
    const firstKey = keys[0];
    const t = templates.find((x) => x.key === firstKey);
    setModalRow(row);
    setModalTemplateKey(firstKey);
    setSubject(t?.subject || '');
    setBodyHtml(t?.bodyHtml || '');
    setPreviewOpen(false);
  };

  useEffect(() => {
    if (!modalTemplateKey) return;
    const t = templates.find((x) => x.key === modalTemplateKey);
    if (t) {
      setSubject(t.subject || '');
      setBodyHtml(t.bodyHtml || '');
    }
  }, [modalTemplateKey, templates]);

  const saveToggle = async (row, on) => {
    if (!rowCanToggle(row)) return;
    try {
      setSavingToggleId(row.id);
      let body;
      if (row.orderStatusKey) {
        body = { emailNotifications: { orderStatusEmail: { [row.orderStatusKey]: on } } };
      } else {
        body = { emailNotifications: { [row.toggleKey]: on } };
      }
      const res = await api.put('/admin/settings', body);
      if (res.success) {
        toast.success(on ? 'Notification enabled' : 'Notification disabled');
        if (res.data?.emailNotifications) {
          setEmailNotifications(res.data.emailNotifications);
        }
      }
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSavingToggleId(null);
    }
  };

  const saveTemplate = async () => {
    if (!modalTemplateKey) return;
    try {
      setSavingTemplate(true);
      const res = await api.put(`/admin/email-templates/${encodeURIComponent(modalTemplateKey)}`, {
        subject,
        bodyHtml,
      });
      if (res.success) {
        toast.success('Template saved');
        setTemplates((prev) =>
          prev.map((t) => (t.key === modalTemplateKey ? { ...t, subject, bodyHtml } : t)),
        );
      }
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSavingTemplate(false);
    }
  };

  const runPreview = async () => {
    if (!modalTemplateKey) return;
    try {
      const res = await api.post('/admin/email-templates/preview', {
        key: modalTemplateKey,
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
    const q = document.querySelector('.admin-email-center-quill .ql-editor');
    if (q) {
      q.focus();
      document.execCommand('insertText', false, v);
    } else {
      setBodyHtml((prev) => `${prev || ''}${v}`);
    }
  };

  const modalKeys = modalRow?.templateKeys || (modalRow?.templateKey ? [modalRow.templateKey] : []);
  const varChips = modalRow ? splitVariables(modalRow.variables) : [];

  return (
    <>
      <AdminPageShell
        title="Email notifications"
        description="Turn transactional emails on or off, edit subjects and HTML, and preview with your live store branding (logo and footer). SMTP credentials stay under Email & SMTP."
        noPadding
      >
        <div className="border-b border-slate-100 px-5 py-3 sm:px-6 flex flex-wrap items-center gap-3 justify-between">
          <Link
            to="/admin/settings/email"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#2878b3]"
          >
            <ArrowLeft className="h-4 w-4" />
            Email &amp; SMTP
          </Link>
          <AdminButton variant="secondary" size="sm" type="button" disabled={loading} onClick={() => void load()}>
            Refresh
          </AdminButton>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
        ) : (
          <div className="px-5 py-6 sm:px-6">
            <div className="mb-6 flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e8f2fa] text-[#2878b3]">
                <Bell className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
              <p className="text-sm text-slate-600">
                Per–order-status toggles control the exact customer email for that status. Legacy “bucket” toggles in settings are still
                honored as a fallback when a per-status value has never been set.
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90">
                    <th className="px-4 py-3 font-semibold text-slate-700 w-28">On</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Notification</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 hidden lg:table-cell">Category</th>
                    <th className="px-4 py-3 font-semibold text-slate-700 w-24 text-center">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const canT = rowCanToggle(row);
                    const on = isRowEnabled(row, emailNotifications);
                    return (
                      <tr key={row.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3 align-top">
                          {canT ? (
                            <button
                              type="button"
                              role="switch"
                              aria-checked={on}
                              disabled={savingToggleId === row.id}
                              onClick={() => void saveToggle(row, !on)}
                              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                                on ? 'bg-[#2878b3]' : 'bg-slate-300'
                              } disabled:opacity-60`}
                            >
                              <span
                                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                                  on ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="font-semibold text-slate-800">{row.label}</div>
                          <p className="mt-1 text-xs text-slate-500 max-w-xl">{row.description}</p>
                        </td>
                        <td className="px-4 py-3 align-top text-slate-600 hidden lg:table-cell">{row.category}</td>
                        <td className="px-4 py-3 align-top text-center">
                          <button
                            type="button"
                            onClick={() => openModal(row)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:border-[#2878b3]/40 hover:text-[#2878b3]"
                            title="Template & preview"
                          >
                            <Settings2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </AdminPageShell>

      {modalRow ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Email template"
        >
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-400">Template</p>
                <p className="text-sm font-semibold text-slate-900">{modalRow.label}</p>
                {modalKeys.length > 1 ? (
                  <select
                    className="admin-select mt-2 max-w-full text-sm"
                    value={modalTemplateKey || ''}
                    onChange={(e) => setModalTemplateKey(e.target.value)}
                  >
                    {modalKeys.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-2">
                <AdminButton variant="secondary" size="sm" type="button" onClick={() => void runPreview()}>
                  <Eye className="h-4 w-4" />
                  Preview
                </AdminButton>
                <AdminButton variant="secondary" size="sm" type="button" onClick={() => setModalRow(null)}>
                  Close
                </AdminButton>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="admin-label">Subject</label>
                <input
                  className="admin-field"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Use {{variables}} in subject or body"
                />
              </div>
              <div>
                <label className="admin-label">Body (inner HTML)</label>
                <p className="mb-2 text-xs text-slate-400">
                  Store header, logo, and footer are added automatically when the email is sent.
                </p>
                <div className="mb-3 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {varChips.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVar(v)}
                      className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[10px] text-slate-600 hover:border-[#2878b3]/40"
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <div className="admin-email-center-quill overflow-hidden rounded-[var(--admin-radius)] border border-slate-200 bg-white">
                  <ReactQuill
                    theme="snow"
                    value={bodyHtml}
                    onChange={setBodyHtml}
                    modules={quillModules}
                    className="min-h-[240px]"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
              <AdminButton
                variant="primary"
                size="md"
                type="button"
                disabled={savingTemplate || !modalTemplateKey}
                onClick={() => void saveTemplate()}
              >
                <Save className="h-4 w-4" />
                {savingTemplate ? 'Saving…' : 'Save template'}
              </AdminButton>
            </div>
          </div>
        </div>
      ) : null}

      {previewOpen ? (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/50 p-4 backdrop-blur-sm sm:items-center"
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

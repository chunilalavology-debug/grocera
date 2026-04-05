import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Settings, Save, MessageCircle, RotateCcw } from 'lucide-react';
import { AdminButton, AdminPageShell } from '../../components/admin/ui';

function substituteContactNamePreview(template, customerName = 'Alex') {
  const n =
    customerName && String(customerName).trim() ? String(customerName).trim() : 'there';
  return String(template)
    .replace(/\{\{\s*name\s*\}\}/gi, n)
    .replace(/\{name\}/gi, n);
}

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminMail, setAdminMail] = useState('');
  const [contactFormToEmailPrimary, setContactFormToEmailPrimary] = useState('');
  const [contactFormToEmailSecondary, setContactFormToEmailSecondary] = useState('');
  const [homeFeaturedSectionTitle, setHomeFeaturedSectionTitle] = useState('Featured Categories');
  const [contactAutoReplyMessage, setContactAutoReplyMessage] = useState('');
  const [contactAutoReplyDefaultTemplate, setContactAutoReplyDefaultTemplate] = useState('');
  const [contactAutoReplyPreview, setContactAutoReplyPreview] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/settings');
      if (res.success && res.data) {
        setAdminMail(res.data.adminMail || '');
        setContactFormToEmailPrimary(res.data.contactFormToEmailPrimary || '');
        setContactFormToEmailSecondary(res.data.contactFormToEmailSecondary || '');
        setHomeFeaturedSectionTitle(res.data.homeFeaturedSectionTitle || 'Featured Categories');
        setContactAutoReplyMessage(
          res.data.contactAutoReplyMessage != null ? String(res.data.contactAutoReplyMessage) : '',
        );
        setContactAutoReplyDefaultTemplate(
          res.data.contactAutoReplyDefaultTemplate != null ? String(res.data.contactAutoReplyDefaultTemplate) : '',
        );
        setContactAutoReplyPreview(
          res.data.contactAutoReplyPreview != null ? String(res.data.contactAutoReplyPreview) : '',
        );
      }
    } catch {
      toast.error('Could not load settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const displayAutoReplyPreview = useMemo(() => {
    const draft = contactAutoReplyMessage.trim();
    const fallbackDefault = (contactAutoReplyDefaultTemplate || '').trim();
    const base = draft || fallbackDefault;
    if (!base) {
      return contactAutoReplyPreview || 'No auto-reply template configured yet.';
    }
    return substituteContactNamePreview(base, 'Alex');
  }, [contactAutoReplyMessage, contactAutoReplyDefaultTemplate, contactAutoReplyPreview]);

  const save = async () => {
    try {
      setSaving(true);
      const res = await api.put('/admin/settings', {
        adminMail,
        contactFormToEmailPrimary,
        contactFormToEmailSecondary,
        homeFeaturedSectionTitle,
        contactAutoReplyMessage,
      });
      if (res.success) {
        toast.success('Settings saved');
        if (res.data) {
          setAdminMail(res.data.adminMail || '');
          setContactFormToEmailPrimary(res.data.contactFormToEmailPrimary || '');
          setContactFormToEmailSecondary(res.data.contactFormToEmailSecondary || '');
          setHomeFeaturedSectionTitle(res.data.homeFeaturedSectionTitle || 'Featured Categories');
          setContactAutoReplyMessage(
            res.data.contactAutoReplyMessage != null ? String(res.data.contactAutoReplyMessage) : '',
          );
          setContactAutoReplyPreview(
            res.data.contactAutoReplyPreview != null ? String(res.data.contactAutoReplyPreview) : '',
          );
        }
      }
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminPageShell
      title="Notifications & homepage"
      description={
        <span>
          Notification inboxes. Store name, logo, and favicon are under{' '}
          <Link to="/admin/settings/general" className="font-semibold text-[#008060] hover:underline">
            General settings
          </Link>
          . For SMTP, test send, and encryption use{' '}
          <Link to="/admin/settings/email" className="font-semibold text-[#008060] hover:underline">
            Email &amp; SMTP
          </Link>
          ; for message content use{' '}
          <Link to="/admin/settings/templates" className="font-semibold text-[#008060] hover:underline">
            Email templates
          </Link>
          .
        </span>
      }
    >
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading settings…</div>
      ) : (
        <div className="space-y-8">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#ecfdf5] text-[#008060]">
              <Settings className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-4">
              <div>
                <label className="admin-label">Admin email</label>
                <input
                  type="email"
                  className="admin-field"
                  placeholder="admin@yourdomain.com"
                  value={adminMail}
                  onChange={(e) => setAdminMail(e.target.value)}
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  Primary admin contact on file. Outbound mail uses your SMTP settings under Email &amp; SMTP.
                </p>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <h2 className="admin-section-heading">Homepage</h2>
                <p className="mt-1 text-sm text-slate-500">Heading for the featured categories block on the storefront.</p>
                <div className="mt-4">
                  <label className="admin-label" htmlFor="home-featured-title">
                    Featured categories heading
                  </label>
                  <input
                    id="home-featured-title"
                    type="text"
                    className="admin-field"
                    maxLength={120}
                    value={homeFeaturedSectionTitle}
                    onChange={(e) => setHomeFeaturedSectionTitle(e.target.value)}
                    placeholder="Featured Categories"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <h2 className="admin-section-heading">Contact form</h2>
                <p className="mt-1 text-sm text-slate-500">
                  When someone submits the storefront contact form, notifications go to these addresses. If empty, the server uses env
                  defaults.
                </p>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="admin-label">Primary inbox</label>
                    <input
                      type="email"
                      className="admin-field"
                      placeholder="inbox@yourdomain.com"
                      value={contactFormToEmailPrimary}
                      onChange={(e) => setContactFormToEmailPrimary(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="admin-label">Secondary inbox (optional)</label>
                    <input
                      type="email"
                      className="admin-field"
                      placeholder="backup@yourdomain.com"
                      value={contactFormToEmailSecondary}
                      onChange={(e) => setContactFormToEmailSecondary(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <MessageCircle className="h-5 w-5" strokeWidth={2} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <h2 className="admin-section-heading">Automatic contact reply</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Sent by email and saved on each new message thread. Use{' '}
                        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{'{{name}}'}</code> or{' '}
                        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{'{name}'}</code> for the
                        customer&apos;s name. Leave empty to use the built-in default.
                      </p>
                    </div>
                    <label className="admin-label" htmlFor="contact-auto-reply">
                      Message body
                    </label>
                    <textarea
                      id="contact-auto-reply"
                      className="admin-field min-h-[200px] resize-y font-sans text-sm leading-relaxed"
                      placeholder={contactAutoReplyDefaultTemplate || 'Dear {{name}},\n\nThank you for contacting us…'}
                      value={contactAutoReplyMessage}
                      onChange={(e) => setContactAutoReplyMessage(e.target.value)}
                      maxLength={8000}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                        onClick={() => setContactAutoReplyMessage('')}
                      >
                        <RotateCcw className="h-4 w-4" aria-hidden />
                        Use built-in default
                      </button>
                      {contactAutoReplyDefaultTemplate ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
                          onClick={() => setContactAutoReplyMessage(contactAutoReplyDefaultTemplate)}
                        >
                          Load default text
                        </button>
                      ) : null}
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                        Customer preview
                      </p>
                      <p className="text-xs text-slate-500 mb-2">
                        Uses the name <strong>Alex</strong> for <code className="rounded bg-slate-100 px-1">{'{{name}}'}</code> /{' '}
                        <code className="rounded bg-slate-100 px-1">{'{name}'}</code>. Updates as you type; save to persist.
                      </p>
                      <div
                        className="max-h-52 overflow-y-auto rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap font-sans"
                        role="region"
                        aria-label="Resolved auto-reply preview"
                      >
                        {displayAutoReplyPreview}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-6">
            <AdminButton variant="primary" size="md" type="button" disabled={saving} onClick={() => void save()}>
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save settings'}
            </AdminButton>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}

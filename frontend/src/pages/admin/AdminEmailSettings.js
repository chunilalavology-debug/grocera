import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Mail, Save, Send, ShieldCheck } from 'lucide-react';
import { AdminButton, AdminPageShell } from '../../components/admin/ui';

const encOptions = [
  { value: 'tls', label: 'TLS (port 587)' },
  { value: 'ssl', label: 'SSL (port 465)' },
  { value: 'none', label: 'None' },
];

export default function AdminEmailSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [adminMail, setAdminMail] = useState('');
  const [contactFormToEmailPrimary, setContactFormToEmailPrimary] = useState('');
  const [contactFormToEmailSecondary, setContactFormToEmailSecondary] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpEncryption, setSmtpEncryption] = useState('tls');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpPassSet, setSmtpPassSet] = useState(false);
  const [smtpFromEmail, setSmtpFromEmail] = useState('');
  const [smtpFromName, setSmtpFromName] = useState('Zippyyy');
  const [testTo, setTestTo] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/settings');
      if (res.success && res.data) {
        const d = res.data;
        setAdminMail(d.adminMail || '');
        setContactFormToEmailPrimary(d.contactFormToEmailPrimary || '');
        setContactFormToEmailSecondary(d.contactFormToEmailSecondary || '');
        setSmtpHost(d.smtpHost || '');
        setSmtpPort(String(d.smtpPort ?? 587));
        setSmtpEncryption(d.smtpEncryption || 'tls');
        setSmtpUser(d.smtpUser || '');
        setSmtpPassSet(Boolean(d.smtpPassSet));
        setSmtpFromEmail(d.smtpFromEmail || '');
        setSmtpFromName(d.smtpFromName || 'Zippyyy');
        setSmtpPass('');
      }
    } catch {
      toast.error('Could not load email settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const smtpPayload = () => ({
    smtpHost,
    smtpPort: parseInt(smtpPort, 10) || 587,
    smtpEncryption,
    smtpUser,
    smtpPass: smtpPass || undefined,
    smtpFromEmail,
    smtpFromName,
  });

  const save = async () => {
    try {
      setSaving(true);
      const body = {
        adminMail,
        contactFormToEmailPrimary,
        contactFormToEmailSecondary,
        ...smtpPayload(),
      };
      if (!smtpPass) {
        delete body.smtpPass;
      }
      const res = await api.put('/admin/settings', body);
      if (res.success) {
        toast.success('Email settings saved');
        if (res.data) {
          setSmtpPassSet(Boolean(res.data.smtpPassSet));
          setSmtpPass('');
        }
      }
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const verifyOnly = async () => {
    try {
      setVerifying(true);
      const res = await api.post('/admin/settings/smtp/verify', smtpPayload());
      if (res.success) toast.success(res.message || 'SMTP verified');
    } catch (e) {
      toast.error(e.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const sendTest = async () => {
    if (!testTo.trim()) {
      toast.error('Enter a recipient for the test email');
      return;
    }
    try {
      setSendingTest(true);
      const body = { to: testTo.trim(), ...smtpPayload() };
      if (!smtpPass) delete body.smtpPass;
      const res = await api.post('/admin/settings/smtp/test', body);
      if (res.success) toast.success(res.message || 'Test sent');
    } catch (e) {
      toast.error(e.message || 'Test send failed');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <AdminPageShell
      title="Email & SMTP"
      description="Notification addresses and outgoing mail (WooCommerce-style). Order and contact emails use these settings and your saved templates."
      actions={
        <div className="flex flex-wrap gap-2">
          <Link
            to="/admin/settings/email-center"
            className="admin-btn admin-btn--secondary text-sm py-2 px-3"
          >
            Notifications &amp; templates
          </Link>
        </div>
      }
      noPadding
    >
      <div className="border-b border-slate-100 px-5 py-3 sm:px-6">
        <Link
          to="/admin/settings"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#2878b3]"
        >
          <ArrowLeft className="h-4 w-4" />
          All settings
        </Link>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-slate-500">Loading…</div>
      ) : (
        <div className="space-y-0 divide-y divide-slate-100">
          <section className="p-5 sm:p-6">
            <div className="mb-6 flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e8f2fa] text-[#2878b3]">
                <Mail className="h-5 w-5" strokeWidth={2} />
              </span>
              <div>
                <h2 className="admin-section-heading">Notification addresses</h2>
                <p className="mt-1 text-sm text-slate-500">Where admin alerts and contact-form copies are delivered.</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="admin-label">Admin email</label>
                <input
                  type="email"
                  className="admin-field"
                  value={adminMail}
                  onChange={(e) => setAdminMail(e.target.value)}
                  placeholder="orders@yourstore.com"
                />
                <p className="mt-1.5 text-xs text-slate-400">New order alerts for staff (falls back to server env if empty).</p>
              </div>
              <div>
                <label className="admin-label">Contact form — primary</label>
                <input
                  type="email"
                  className="admin-field"
                  value={contactFormToEmailPrimary}
                  onChange={(e) => setContactFormToEmailPrimary(e.target.value)}
                />
              </div>
              <div>
                <label className="admin-label">Contact form — secondary (optional)</label>
                <input
                  type="email"
                  className="admin-field"
                  value={contactFormToEmailSecondary}
                  onChange={(e) => setContactFormToEmailSecondary(e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="p-5 sm:p-6">
            <h2 className="admin-section-heading">SMTP configuration</h2>
            <p className="mt-1 text-sm text-slate-500">Host, port, encryption, and credentials used to send mail.</p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="admin-label">SMTP host</label>
                <input className="admin-field" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" />
              </div>
              <div>
                <label className="admin-label">Port</label>
                <input type="number" className="admin-field" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
              </div>
              <div>
                <label className="admin-label">Encryption</label>
                <select className="admin-select" value={smtpEncryption} onChange={(e) => setSmtpEncryption(e.target.value)}>
                  {encOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="admin-label">Username</label>
                <input className="admin-field" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} autoComplete="off" />
              </div>
              <div>
                <label className="admin-label">Password</label>
                <input
                  type="password"
                  className="admin-field"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder={smtpPassSet ? '•••••••• (leave blank to keep)' : 'App password / SMTP password'}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="admin-label">From email</label>
                <input
                  type="email"
                  className="admin-field"
                  value={smtpFromEmail}
                  onChange={(e) => setSmtpFromEmail(e.target.value)}
                  placeholder="noreply@yourstore.com"
                />
              </div>
              <div>
                <label className="admin-label">From name</label>
                <input className="admin-field" value={smtpFromName} onChange={(e) => setSmtpFromName(e.target.value)} />
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:flex-wrap sm:items-center">
              <AdminButton variant="secondary" size="md" type="button" disabled={verifying} onClick={() => void verifyOnly()}>
                <ShieldCheck className="h-4 w-4" />
                {verifying ? 'Verifying…' : 'Verify SMTP'}
              </AdminButton>
              <div className="flex min-w-[220px] flex-1 flex-wrap items-center gap-2">
                <input
                  type="email"
                  className="admin-field min-w-0 flex-1"
                  placeholder="Test recipient"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                />
                <AdminButton variant="secondary" size="md" type="button" disabled={sendingTest} onClick={() => void sendTest()}>
                  <Send className="h-4 w-4" />
                  {sendingTest ? 'Sending…' : 'Send test email'}
                </AdminButton>
              </div>
              <AdminButton variant="primary" size="md" type="button" disabled={saving} className="sm:ml-auto" onClick={() => void save()}>
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save settings'}
              </AdminButton>
            </div>
          </section>
        </div>
      )}
    </AdminPageShell>
  );
}

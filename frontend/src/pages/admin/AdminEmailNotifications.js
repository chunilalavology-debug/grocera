import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Bell, Save } from 'lucide-react';
import { AdminButton, AdminPageShell } from '../../components/admin/ui';

const ROWS = [
  {
    key: 'orderConfirmationUser',
    label: 'Order confirmation',
    recipient: 'Customer',
    hint: 'Sent when a new order is placed and paid (non–Zippyyy Ships grocery flow).',
  },
  {
    key: 'orderStatusProcessing',
    label: 'Order status — processing',
    recipient: 'Customer',
    hint: 'Confirmed, processing, on hold, or packed (one email per milestone group).',
  },
  {
    key: 'orderStatusShipped',
    label: 'Order status — shipped',
    recipient: 'Customer',
    hint: 'Shipped or on the way.',
  },
  {
    key: 'orderStatusDelivered',
    label: 'Order status — delivered',
    recipient: 'Customer',
    hint: 'Delivered or completed.',
  },
  {
    key: 'orderStatusCancelled',
    label: 'Order status — cancelled',
    recipient: 'Customer',
    hint: 'When an order is cancelled.',
  },
  {
    key: 'adminNewOrder',
    label: 'New order notification',
    recipient: 'Admin',
    hint: 'Uses the admin email from Notifications & homepage.',
  },
];

export default function AdminEmailNotifications() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggles, setToggles] = useState({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/settings');
      if (res.success && res.data?.emailNotifications) {
        setToggles(res.data.emailNotifications);
      }
    } catch {
      toast.error('Could not load email notification settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setOn = (key, value) => {
    setToggles((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    try {
      setSaving(true);
      const res = await api.put('/admin/settings', { emailNotifications: toggles });
      if (res.success) {
        toast.success('Notification settings saved');
        if (res.data?.emailNotifications) {
          setToggles(res.data.emailNotifications);
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
      title="Email notifications"
      description="Choose which transactional order emails are sent. SMTP and templates are configured under Email & SMTP and Email templates."
      noPadding
    >
      <div className="border-b border-slate-100 px-5 py-3 sm:px-6">
        <Link
          to="/admin/settings/email"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#2878b3]"
        >
          <ArrowLeft className="h-4 w-4" />
          Email &amp; SMTP
        </Link>
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
              Disabled types are skipped on the server before mail is queued. Failed sends are retried once; check server logs for SMTP
              errors.
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/90">
                  <th className="px-4 py-3 font-semibold text-slate-700 w-28">Enabled</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Email</th>
                  <th className="px-4 py-3 font-semibold text-slate-700 hidden md:table-cell">Content</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Recipient</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.key} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 align-top">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={toggles[row.key] !== false}
                        onClick={() => setOn(row.key, toggles[row.key] === false)}
                        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
                          toggles[row.key] !== false ? 'bg-[#2878b3]' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                            toggles[row.key] !== false ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="font-semibold text-slate-800">{row.label}</div>
                      <p className="mt-1 text-xs text-slate-500 md:hidden">{row.hint}</p>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-600 hidden md:table-cell">
                      <span className="text-xs text-slate-500">text/html</span>
                      <p className="mt-1 text-xs text-slate-500 max-w-md">{row.hint}</p>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">{row.recipient}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <AdminButton variant="primary" size="md" type="button" disabled={saving} onClick={() => void save()}>
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save'}
            </AdminButton>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}

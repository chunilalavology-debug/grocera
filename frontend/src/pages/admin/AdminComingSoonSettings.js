import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Rocket, Save } from 'lucide-react';
import { AdminButton, AdminPageShell, ToggleSwitch } from '../../components/admin/ui';

export default function AdminComingSoonSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [zippyShipsPageEnabled, setZippyShipsPageEnabled] = useState(false);
  const [headline, setHeadline] = useState('Zippy Ships is coming soon');
  const [message, setMessage] = useState('');
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings/zippy-coming-soon');
      if (res.success && res.data) {
        const c = res.data;
        setZippyShipsPageEnabled(Boolean(c.enabled));
        setHeadline(c.headline || 'Zippy Ships is coming soon');
        setMessage(c.message != null ? String(c.message) : '');
        setSubscriptionEnabled(c.subscriptionEnabled !== false);
      }
    } catch {
      toast.error('Could not load coming soon settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    try {
      setSaving(true);
      const res = await api.post('/settings/zippy-coming-soon', {
        enabled: zippyShipsPageEnabled,
        headline,
        message,
        subscriptionEnabled,
      });
      if (res.success) {
        toast.success('Coming soon settings saved');
        if (res.data) {
          const c = res.data;
          setZippyShipsPageEnabled(Boolean(c.enabled));
          setHeadline(c.headline || 'Zippy Ships is coming soon');
          setMessage(c.message != null ? String(c.message) : '');
          setSubscriptionEnabled(c.subscriptionEnabled !== false);
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
      title="Zippy Ships Coming Soon"
      description="Control only the Zippy Ships route teaser page. The rest of your storefront remains unaffected."
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
        <div className="space-y-8 px-5 py-6 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e8f2fa] text-[#2878b3]">
              <Rocket className="h-5 w-5" strokeWidth={2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-6">
              <div className="rounded-xl border border-[#2878b3]/20 bg-[#e8f2fa] px-4 py-3 text-sm text-slate-700">
                This switch only affects <code className="rounded bg-white px-1 text-xs">/zippy-ships</code> and{' '}
                <code className="rounded bg-white px-1 text-xs">/zippyyy-ships</code>.
              </div>

              <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
                <span>
                  <span className="font-semibold text-slate-800">Enable Zippy Ships coming soon page</span>
                  <p className="mt-0.5 text-sm text-slate-500">
                    ON shows teaser page on the Zippy Ships route. OFF opens the live ships experience.
                  </p>
                </span>
                <ToggleSwitch
                  checked={zippyShipsPageEnabled}
                  onChange={setZippyShipsPageEnabled}
                  label="Enable Zippy Ships coming soon page"
                />
              </div>

              <div className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
                <span>
                  <span className="font-semibold text-slate-800">Enable waitlist email input</span>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Show/hide the email subscription field on the coming soon page.
                  </p>
                </span>
                <ToggleSwitch
                  checked={subscriptionEnabled}
                  onChange={setSubscriptionEnabled}
                  label="Enable waitlist email input"
                />
              </div>

              <div>
                <label className="admin-label" htmlFor="cs-headline">
                  Headline
                </label>
                <input
                  id="cs-headline"
                  className="admin-field"
                  maxLength={200}
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                />
              </div>

              <div>
                <label className="admin-label" htmlFor="cs-message">
                  Message (optional)
                </label>
                <textarea
                  id="cs-message"
                  className="admin-field min-h-[120px] resize-y"
                  maxLength={2000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Short note for visitors…"
                />
              </div>

              <p className="text-xs text-slate-500">
                Save after changes. State is persisted in MongoDB and fetched fresh from API.
              </p>
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-6">
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

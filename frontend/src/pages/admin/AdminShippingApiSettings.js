import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Truck, Save, KeyRound, Plus, RefreshCw } from 'lucide-react';
import api from '../../services/api';
import { AdminButton, AdminCard, AdminPageShell } from '../../components/admin/ui';
import { getApiBaseUrl } from '../../config/apiBase';

export default function AdminShippingApiSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [commissionPercent, setCommissionPercent] = useState(30);
  const [configured, setConfigured] = useState(false);
  const [keySource, setKeySource] = useState('');
  const [easyshipApiKey, setEasyshipApiKey] = useState('');
  const [clients, setClients] = useState([]);
  const [newClientName, setNewClientName] = useState('');
  const [newClientCommission, setNewClientCommission] = useState('');
  const [creating, setCreating] = useState(false);

  const proxyRatesUrl = `${getApiBaseUrl().replace(/\/+$/, '')}/shipping/get-rates`;

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [sRes, cRes] = await Promise.all([
        api.get('/shipping/admin/settings'),
        api.get('/shipping/admin/clients'),
      ]);
      if (sRes?.success && sRes.data) {
        setEnabled(sRes.data.enabled !== false);
        setCommissionPercent(Number(sRes.data.commissionPercent ?? 30));
        setConfigured(Boolean(sRes.data.configured));
        setKeySource(String(sRes.data.keySource || ''));
      }
      if (cRes?.success && Array.isArray(cRes.data)) setClients(cRes.data);
    } catch (e) {
      toast.error(e?.message || 'Could not load shipping API settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSettings = async () => {
    try {
      setSaving(true);
      const body = {
        enabled,
        commissionPercent: Number(commissionPercent),
      };
      if (easyshipApiKey.trim()) body.easyshipApiKey = easyshipApiKey.trim();
      const res = await api.put('/shipping/admin/settings', body);
      if (res?.success) {
        toast.success('Shipping API settings saved');
        setEasyshipApiKey('');
        await load();
      } else {
        toast.error(res?.message || 'Save failed');
      }
    } catch (e) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const clearStoredKey = async () => {
    if (!window.confirm('Remove the stored Easyship key from the database? You can set it again below.')) return;
    try {
      setSaving(true);
      const res = await api.put('/shipping/admin/settings', {
        enabled,
        commissionPercent: Number(commissionPercent),
        easyshipApiKey: '',
      });
      if (res?.success) {
        toast.success('Stored Easyship key cleared');
        await load();
      }
    } catch (e) {
      toast.error(e?.message || 'Could not clear key');
    } finally {
      setSaving(false);
    }
  };

  const createClient = async () => {
    const name = newClientName.trim();
    if (name.length < 2) {
      toast.error('Enter a client name (at least 2 characters)');
      return;
    }
    try {
      setCreating(true);
      const payload = { clientName: name };
      const pct = newClientCommission.trim();
      if (pct !== '') payload.commissionPercent = Number(pct);
      const res = await api.post('/shipping/admin/clients', payload);
      if (res?.success && res.data?.apiKey) {
        try {
          await navigator.clipboard.writeText(res.data.apiKey);
          toast.success('Client created — API key copied to clipboard. Store it safely; it will not be shown again.');
        } catch {
          toast.success(`Client created. Copy this key now: ${res.data.apiKey}`, { duration: 15000 });
        }
        setNewClientName('');
        setNewClientCommission('');
        await load();
      } else {
        toast.error(res?.message || 'Create failed');
      }
    } catch (e) {
      toast.error(e?.message || 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const rotateClient = async (id) => {
    if (!window.confirm('Rotate this client key? The old key stops working immediately.')) return;
    try {
      const res = await api.post(`/shipping/admin/clients/${encodeURIComponent(id)}/rotate`, {});
      if (res?.success && res.data?.apiKey) {
        try {
          await navigator.clipboard.writeText(res.data.apiKey);
          toast.success('New key copied to clipboard');
        } catch {
          toast.success(`New key: ${res.data.apiKey}`, { duration: 15000 });
        }
        await load();
      }
    } catch (e) {
      toast.error(e?.message || 'Rotate failed');
    }
  };

  return (
    <AdminPageShell
      title="Shipping API (Easyship proxy)"
      description="Manage your Easyship credential and partner API keys. The real Easyship token never appears in the storefront — external businesses use your proxy with an x-api-key only."
    >
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading…</div>
      ) : (
        <div className="mx-auto max-w-4xl space-y-6">
          <AdminCard title="Easyship & commission" subtitle="Stored encrypted on the server." action={<Truck className="h-5 w-5 text-[#008060]" />}>
            <p className="text-sm text-slate-600">
              Status:{' '}
              <strong>{configured ? 'Easyship key configured' : 'Not configured'}</strong>
              {keySource ? (
                <span className="text-slate-500">
                  {' '}
                  ({keySource.replace(/_/g, ' ')})
                </span>
              ) : null}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              On Vercel, set <code className="rounded bg-slate-100 px-1">EASYSHIP_SETTINGS_SECRET</code> (or rely on{' '}
              <code className="rounded bg-slate-100 px-1">JWT_SECRET_KEY</code>) so keys can be encrypted in the database.
            </p>
            <label className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              Enable API sharing (proxy)
            </label>
            <div className="mt-4">
              <label className="admin-label">Default commission (%)</label>
              <input
                type="number"
                min={0}
                max={200}
                className="admin-field max-w-xs"
                value={commissionPercent}
                onChange={(e) => setCommissionPercent(Number(e.target.value))}
              />
              <p className="mt-1 text-xs text-slate-500">Applied as: final rate = Easyship rate × (1 + commission/100).</p>
            </div>
            <div className="mt-4">
              <label className="admin-label">Easyship API key</label>
              <input
                type="password"
                autoComplete="off"
                className="admin-field"
                placeholder="Paste new key to update (leave blank to keep current)"
                value={easyshipApiKey}
                onChange={(e) => setEasyshipApiKey(e.target.value)}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <AdminButton type="button" variant="primary" onClick={saveSettings} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Saving…' : 'Save'}
              </AdminButton>
              <AdminButton type="button" variant="secondary" onClick={clearStoredKey} disabled={saving}>
                Remove stored key
              </AdminButton>
            </div>
          </AdminCard>

          <AdminCard title="Partner API keys" subtitle="Businesses send this header: x-api-key: zippy_…" action={<KeyRound className="h-5 w-5 text-slate-600" />}>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-medium">Public endpoint</p>
              <code className="mt-1 block break-all text-xs">{proxyRatesUrl}</code>
              <p className="mt-2 text-xs text-slate-500">POST JSON body: origin/destination addresses, ZIPs, dimensions, weight (see API docs / backend partnerRateSchema).</p>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="admin-label">New client name</label>
                <input className="admin-field" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} placeholder="e.g. Acme Store" />
              </div>
              <div>
                <label className="admin-label">Override commission % (optional)</label>
                <input
                  className="admin-field"
                  value={newClientCommission}
                  onChange={(e) => setNewClientCommission(e.target.value)}
                  placeholder="Leave empty = use default above"
                />
              </div>
            </div>
            <AdminButton type="button" className="mt-3" variant="primary" onClick={createClient} disabled={creating}>
              <Plus className="mr-2 h-4 w-4" />
              {creating ? 'Creating…' : 'Create client & copy key'}
            </AdminButton>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <th className="py-2 pr-2">Name</th>
                    <th className="py-2 pr-2">Key id</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2 pr-2">Commission</th>
                    <th className="py-2 pr-2">Requests</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c._id} className="border-b border-slate-100">
                      <td className="py-2 pr-2 font-medium text-slate-800">{c.clientName}</td>
                      <td className="py-2 pr-2 font-mono text-xs">{c.keyId}</td>
                      <td className="py-2 pr-2">{c.status}</td>
                      <td className="py-2 pr-2">{c.commissionPercent != null ? `${c.commissionPercent}%` : '—'}</td>
                      <td className="py-2 pr-2">{c.requestCount ?? 0}</td>
                      <td className="py-2">
                        <AdminButton type="button" variant="secondary" size="sm" onClick={() => rotateClient(c._id)}>
                          <RefreshCw className="mr-1 h-3 w-3" />
                          Rotate key
                        </AdminButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {clients.length === 0 ? <p className="mt-3 text-sm text-slate-500">No partner clients yet.</p> : null}
            </div>
          </AdminCard>
        </div>
      )}
    </AdminPageShell>
  );
}

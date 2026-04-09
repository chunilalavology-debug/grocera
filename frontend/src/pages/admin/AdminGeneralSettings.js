import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Globe, ImageIcon, Sparkles, Save, Trash2, Upload } from 'lucide-react';
import { AdminButton, AdminCard, AdminPageShell } from '../../components/admin/ui';
import { useSiteBranding } from '../../context/SiteBrandingContext';
import { resolveBrandingAssetUrl, withAssetCacheBust } from '../../utils/brandingAssets';

function revokeIfBlob(url) {
  if (url && String(url).startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
}

export default function AdminGeneralSettings() {
  const { refresh: refreshPublicBranding } = useSiteBranding();
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  const [websiteName, setWebsiteName] = useState('Zippyyy');
  const [websiteLogoUrl, setWebsiteLogoUrl] = useState('');
  const [websiteFaviconUrl, setWebsiteFaviconUrl] = useState('');
  const [assetRevision, setAssetRevision] = useState(Date.now());

  const [logoPreview, setLogoPreview] = useState('');
  const [faviconPreview, setFaviconPreview] = useState('');
  const logoInputRef = useRef(null);
  const faviconInputRef = useRef(null);
  const logoPickRef = useRef(null);
  const faviconPickRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/settings');
      if (res.success && res.data) {
        const d = res.data;
        setWebsiteName(d.websiteName || 'Zippyyy');
        setWebsiteLogoUrl(resolveBrandingAssetUrl(d.websiteLogoUrl || ''));
        setWebsiteFaviconUrl(resolveBrandingAssetUrl(d.websiteFaviconUrl || ''));
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

  useEffect(() => {
    return () => {
      revokeIfBlob(logoPreview);
      revokeIfBlob(faviconPreview);
    };
  }, [logoPreview, faviconPreview]);

  const syncFromResponse = (data) => {
    if (!data) return;
    setWebsiteName(data.websiteName || 'Zippyyy');
    setWebsiteLogoUrl(resolveBrandingAssetUrl(data.websiteLogoUrl || ''));
    setWebsiteFaviconUrl(resolveBrandingAssetUrl(data.websiteFaviconUrl || ''));
    setAssetRevision(Date.now());
  };

  const saveWebsiteName = async () => {
    try {
      setSavingName(true);
      const res = await api.put('/admin/settings', { websiteName: websiteName.trim() || 'Zippyyy' });
      if (res.success) {
        toast.success('Website name saved');
        syncFromResponse(res.data);
        void refreshPublicBranding();
      }
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSavingName(false);
    }
  };

  const pickLogo = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    revokeIfBlob(logoPreview);
    logoPickRef.current = f;
    setLogoPreview(URL.createObjectURL(f));
  };

  const pickFavicon = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    revokeIfBlob(faviconPreview);
    faviconPickRef.current = f;
    setFaviconPreview(URL.createObjectURL(f));
  };

  const uploadLogo = async () => {
    const f = logoPickRef.current;
    if (!f) {
      toast.error('Choose an image first');
      return;
    }
    const fd = new FormData();
    fd.append('file', f);
    try {
      setUploadingLogo(true);
      const res = await api.post('/admin/settings/upload-logo', fd);
      if (!res?.success) {
        toast.error(res?.message || 'Upload failed');
        return;
      }
      toast.success('Logo uploaded');
      logoPickRef.current = null;
      revokeIfBlob(logoPreview);
      setLogoPreview('');
      syncFromResponse(res.data);
      void refreshPublicBranding();
    } catch (e) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setUploadingLogo(false);
    }
  };

  const uploadFavicon = async () => {
    const f = faviconPickRef.current;
    if (!f) {
      toast.error('Choose a favicon file first');
      return;
    }
    const fd = new FormData();
    fd.append('file', f);
    try {
      setUploadingFavicon(true);
      const res = await api.post('/admin/settings/upload-favicon', fd);
      if (!res?.success) {
        toast.error(res?.message || 'Upload failed');
        return;
      }
      toast.success('Favicon uploaded');
      faviconPickRef.current = null;
      revokeIfBlob(faviconPreview);
      setFaviconPreview('');
      syncFromResponse(res.data);
      void refreshPublicBranding();
    } catch (e) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setUploadingFavicon(false);
    }
  };

  const clearLogo = async () => {
    try {
      setUploadingLogo(true);
      const res = await api.put('/admin/settings', { websiteLogoUrl: '' });
      if (res.success) {
        toast.success('Logo removed');
        logoPickRef.current = null;
        revokeIfBlob(logoPreview);
        setLogoPreview('');
        syncFromResponse(res.data);
        void refreshPublicBranding();
      }
    } catch (e) {
      toast.error(e.message || 'Could not remove logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const clearFavicon = async () => {
    try {
      setUploadingFavicon(true);
      const res = await api.put('/admin/settings', { websiteFaviconUrl: '' });
      if (res.success) {
        toast.success('Favicon removed');
        faviconPickRef.current = null;
        revokeIfBlob(faviconPreview);
        setFaviconPreview('');
        syncFromResponse(res.data);
        void refreshPublicBranding();
      }
    } catch (e) {
      toast.error(e.message || 'Could not remove favicon');
    } finally {
      setUploadingFavicon(false);
    }
  };

  const displayLogo = logoPreview || withAssetCacheBust(websiteLogoUrl, assetRevision) || null;
  const displayFavicon = faviconPreview || withAssetCacheBust(websiteFaviconUrl, assetRevision) || null;

  return (
    <AdminPageShell
      title="General settings"
      description={
        <span>
          Store name, logo, and favicon appear on the storefront and browser tab. Notification inboxes live under{' '}
          <Link to="/admin/settings" className="font-semibold text-[#2878b3] hover:underline">
            Notifications &amp; homepage
          </Link>
          .
        </span>
      }
    >
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading…</div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-6">
          <AdminCard
            title="Website name"
            subtitle="Shown in the browser title bar and across the storefront header."
            action={
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e8f2fa] text-[#2878b3]">
                <Globe className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
            }
          >
            <label className="admin-label" htmlFor="site-name">
              Name
            </label>
            <input
              id="site-name"
              type="text"
              className="admin-field"
              maxLength={120}
              value={websiteName}
              onChange={(e) => setWebsiteName(e.target.value)}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <AdminButton
                type="button"
                variant="primary"
                onClick={() => void saveWebsiteName()}
                disabled={savingName}
              >
                <Save className="h-4 w-4" strokeWidth={2} aria-hidden />
                {savingName ? 'Saving…' : 'Save name'}
              </AdminButton>
            </div>
          </AdminCard>

          <AdminCard
            title="Website logo"
            subtitle="PNG, JPG, WebP, or SVG. Max 5MB. Used in the main navigation."
            action={
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <ImageIcon className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
            }
          >
            <p className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
              <span className="font-semibold text-slate-800">Recommended size:</span> wide horizontal logo, about{' '}
              <strong>200–320px wide × 48–72px tall</strong> (or SVG with similar proportions). Navbar displays it at
              roughly 40–56px height; very tall images may look small. <span className="font-semibold">Max file:</span>{' '}
              5MB.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-28 w-full max-w-[200px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-200 bg-slate-50">
                {displayLogo ? (
                  <img src={displayLogo} alt="" className="max-h-full max-w-full object-contain p-2" />
                ) : (
                  <span className="px-3 text-center text-xs text-slate-400">No logo</span>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={pickLogo}
                />
                <div className="flex flex-wrap gap-2">
                  <AdminButton
                    type="button"
                    variant="secondary"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" strokeWidth={2} aria-hidden />
                    {websiteLogoUrl || logoPreview ? 'Replace…' : 'Upload…'}
                  </AdminButton>
                  {(logoPreview || logoPickRef.current) && (
                    <AdminButton
                      type="button"
                      variant="primary"
                      onClick={() => void uploadLogo()}
                      disabled={uploadingLogo}
                    >
                      {uploadingLogo ? 'Uploading…' : 'Save logo'}
                    </AdminButton>
                  )}
                  {websiteLogoUrl ? (
                    <AdminButton
                      type="button"
                      variant="secondary"
                      onClick={() => void clearLogo()}
                      disabled={uploadingLogo}
                      className="border-red-200 text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                      Delete
                    </AdminButton>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500">
                  Choose a file to preview, then click Save logo. Delete removes the logo from the site (default graphic
                  is used again). On your own server, files live under <code className="text-[11px]">/uploads</code> on the
                  API host. <span className="font-medium text-slate-600">On Vercel</span>, uploads go to{' '}
                  <strong>Cloudinary</strong> (set <code className="text-[11px]">CLOUDINARY_*</code> env vars on the API
                  project) — local <code className="text-[11px]">/uploads</code> URLs break after deploy.
                </p>
                {websiteLogoUrl ? (
                  <p className="text-xs text-slate-500 break-all">
                    Current live logo:{' '}
                    <a className="text-[#2878b3] hover:underline" href={websiteLogoUrl} target="_blank" rel="noreferrer">
                      {websiteLogoUrl}
                    </a>
                  </p>
                ) : null}
              </div>
            </div>
          </AdminCard>

          <AdminCard
            title="Favicon"
            subtitle="ICO, PNG, SVG, or WebP. Max 512KB. Shown in browser tabs."
            action={
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Sparkles className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
            }
          >
            <p className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
              <span className="font-semibold text-slate-800">Recommended size:</span> square icon{' '}
              <strong>32×32px</strong> or <strong>48×48px</strong> (PNG, ICO, or SVG). Use a simple mark so it stays
              clear at tab size. <span className="font-semibold">Max file:</span> 512KB.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-200 bg-slate-50">
                {displayFavicon ? (
                  <img src={displayFavicon} alt="" className="max-h-full max-w-full object-contain p-1" />
                ) : (
                  <span className="px-1 text-center text-[10px] leading-tight text-slate-400">None</span>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept=".ico,.png,.svg,.webp,.jpg,.jpeg,image/*"
                  className="hidden"
                  onChange={pickFavicon}
                />
                <div className="flex flex-wrap gap-2">
                  <AdminButton
                    type="button"
                    variant="secondary"
                    onClick={() => faviconInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" strokeWidth={2} aria-hidden />
                    {websiteFaviconUrl || faviconPreview ? 'Replace…' : 'Upload…'}
                  </AdminButton>
                  {(faviconPreview || faviconPickRef.current) && (
                    <AdminButton
                      type="button"
                      variant="primary"
                      onClick={() => void uploadFavicon()}
                      disabled={uploadingFavicon}
                    >
                      {uploadingFavicon ? 'Uploading…' : 'Save favicon'}
                    </AdminButton>
                  )}
                  {websiteFaviconUrl ? (
                    <AdminButton
                      type="button"
                      variant="secondary"
                      onClick={() => void clearFavicon()}
                      disabled={uploadingFavicon}
                      className="border-red-200 text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                      Delete
                    </AdminButton>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500">
                  Small square icons work best. Invalid types or oversized files are rejected by the server.
                </p>
                {websiteFaviconUrl ? (
                  <p className="text-xs text-slate-500 break-all">
                    Current live favicon:{' '}
                    <a className="text-[#2878b3] hover:underline" href={websiteFaviconUrl} target="_blank" rel="noreferrer">
                      {websiteFaviconUrl}
                    </a>
                  </p>
                ) : null}
              </div>
            </div>
          </AdminCard>
        </div>
      )}
    </AdminPageShell>
  );
}

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Layout, Megaphone, ImageIcon, Save, Trash2, Upload, Copy } from 'lucide-react';
import api from '../../services/api';
import { AdminButton, AdminCard, AdminPageShell } from '../../components/admin/ui';
import { resolveBrandingAssetUrl, withAssetCacheBust } from '../../utils/brandingAssets';
import { useSiteBranding } from '../../context/SiteBrandingContext';

const DEFAULT_SLIDES = [
  '🥦 Fresh groceries delivered to your door – shop with ease 🥕',
  '🥦 Free delivery on orders over $50 – order now! 🥕',
  '🥦 Best quality, best prices – Zippyyy has it all 🥕',
];

const EMPTY_SOCIALS = {
  facebook: '',
  instagram: '',
  linkedin: '',
  twitter: '',
  snapchat: '',
  whatsapp: '',
};

export default function AdminStorefrontSettings() {
  const { refresh: refreshPublicBranding } = useSiteBranding();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingHero, setUploadingHero] = useState(false);
  const heroInputRef = useRef(null);

  const [marqueeEnabled, setMarqueeEnabled] = useState(true);
  const [marqueeBgColor, setMarqueeBgColor] = useState('#e9aa42');
  const [marqueeTextColor, setMarqueeTextColor] = useState('#ffffff');
  const [marqueeSpeed, setMarqueeSpeed] = useState(35);
  const [marqueeSlides, setMarqueeSlides] = useState(DEFAULT_SLIDES);

  const [headerIsFixed, setHeaderIsFixed] = useState(false);
  const [heroImage, setHeroImage] = useState('');
  const [heroOverlayColor, setHeroOverlayColor] = useState('rgba(0,0,0,0.45)');
  const [heroRevision, setHeroRevision] = useState(Date.now());
  const [socialLinks, setSocialLinks] = useState(EMPTY_SOCIALS);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/settings');
      if (res?.success && res.data) {
        const d = res.data;
        const slides = Array.isArray(d?.marquee?.slides)
          ? d.marquee.slides.map((s) => String(s || '').trim()).filter(Boolean)
          : [];
        setMarqueeEnabled(Boolean(d?.marquee?.enabled ?? true));
        setMarqueeBgColor(String(d?.marquee?.bgColor || '#e9aa42'));
        setMarqueeTextColor(String(d?.marquee?.textColor || '#ffffff'));
        setMarqueeSpeed(Math.max(8, Number(d?.marquee?.speed || 35)));
        setMarqueeSlides(slides.length ? slides : DEFAULT_SLIDES);

        setHeaderIsFixed(Boolean(d?.header?.isFixed ?? false));
        setHeroImage(resolveBrandingAssetUrl(String(d?.heroBanner?.image || '').trim()));
        setHeroOverlayColor(String(d?.heroBanner?.overlayColor || 'rgba(0,0,0,0.45)'));
        setHeroRevision(Date.now());
        setSocialLinks({
          facebook: String(d?.socialLinks?.facebook || ''),
          instagram: String(d?.socialLinks?.instagram || ''),
          linkedin: String(d?.socialLinks?.linkedin || ''),
          twitter: String(d?.socialLinks?.twitter || ''),
          snapchat: String(d?.socialLinks?.snapchat || ''),
          whatsapp: String(d?.socialLinks?.whatsapp || ''),
        });
      }
    } catch (e) {
      toast.error(e?.message || 'Could not load storefront settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addSlide = () => {
    setMarqueeSlides((prev) => [...prev, '']);
  };

  const copySlideAt = (idx) => {
    setMarqueeSlides((prev) => {
      const text = String(prev[idx] ?? '');
      const next = [...prev];
      next.splice(idx + 1, 0, text);
      return next;
    });
  };

  const save = async () => {
    try {
      setSaving(true);
      const payload = {
        marquee: {
          enabled: marqueeEnabled,
          bgColor: marqueeBgColor.trim() || '#e9aa42',
          textColor: marqueeTextColor.trim() || '#ffffff',
          speed: Math.max(8, Number(marqueeSpeed) || 35),
          slides: marqueeSlides.map((s) => String(s || '').trim()).filter(Boolean),
        },
        header: { isFixed: headerIsFixed },
        heroBanner: {
          image: String(heroImage || '').trim(),
          overlayColor: String(heroOverlayColor || '').trim() || 'rgba(0,0,0,0.45)',
        },
        socialLinks: {
          facebook: socialLinks.facebook.trim(),
          instagram: socialLinks.instagram.trim(),
          linkedin: socialLinks.linkedin.trim(),
          twitter: socialLinks.twitter.trim(),
          snapchat: socialLinks.snapchat.trim(),
          whatsapp: socialLinks.whatsapp.trim(),
        },
      };
      const res = await api.put('/admin/settings', payload);
      if (res?.success) {
        toast.success('Storefront settings saved');
        await Promise.all([load(), refreshPublicBranding()]);
      }
    } catch (e) {
      toast.error(e?.message || 'Could not save storefront settings');
    } finally {
      setSaving(false);
    }
  };

  const uploadHero = async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    try {
      setUploadingHero(true);
      const res = await api.post('/admin/settings/upload-hero-banner', fd);
      if (res?.success) {
        const nextHero = resolveBrandingAssetUrl(String(res?.data?.heroBanner?.image || '').trim());
        setHeroImage(nextHero);
        toast.success('Hero banner uploaded');
        await Promise.all([load(), refreshPublicBranding()]);
      } else {
        toast.error(res?.message || 'Upload failed');
      }
    } catch (e) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setUploadingHero(false);
    }
  };

  const socialKeys = useMemo(
    () => [
      ['facebook', 'Facebook'],
      ['instagram', 'Instagram'],
      ['linkedin', 'LinkedIn'],
      ['twitter', 'Twitter / X'],
      ['snapchat', 'Snapchat'],
      ['whatsapp', 'WhatsApp'],
    ],
    [],
  );

  return (
    <AdminPageShell
      title="Storefront settings"
      description="Control marquee, header behavior, hero banner, and footer social links."
    >
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading…</div>
      ) : (
        <div className="mx-auto max-w-4xl space-y-6">
          <AdminCard
            title="Marquee"
            subtitle="Top announcement strip settings."
            action={<Megaphone className="h-5 w-5 text-[#2878b3]" />}
          >
            <label className="inline-flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={marqueeEnabled}
                  onChange={(e) => setMarqueeEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-slate-200 rounded-full peer peer-checked:bg-[#2878b3] peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all shadow-inner"></div>
              </div>
              <span className="text-sm font-medium text-slate-700 group-hover:text-[#2878b3]">Enable marquee</span>
            </label>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <label className="admin-label">Background color</label>
                <input className="admin-field" value={marqueeBgColor} onChange={(e) => setMarqueeBgColor(e.target.value)} />
              </div>
              <div>
                <label className="admin-label">Text color</label>
                <input className="admin-field" value={marqueeTextColor} onChange={(e) => setMarqueeTextColor(e.target.value)} />
              </div>
              <div>
                <label className="admin-label">Speed (seconds per loop)</label>
                <input
                  type="number"
                  min={8}
                  max={120}
                  className="admin-field"
                  value={marqueeSpeed}
                  onChange={(e) => setMarqueeSpeed(Math.max(8, Number(e.target.value) || 35))}
                />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="admin-label !mb-0">Slides</label>
                <AdminButton type="button" variant="secondary" onClick={addSlide}>
                  Add slide
                </AdminButton>
              </div>
              {marqueeSlides.map((slide, idx) => (
                <div key={`slide-${idx}`} className="flex flex-wrap gap-2 sm:flex-nowrap">
                  <input
                    className="admin-field min-w-0 flex-1"
                    value={slide}
                    onChange={(e) =>
                      setMarqueeSlides((prev) => prev.map((x, i) => (i === idx ? e.target.value : x)))
                    }
                    placeholder={`Slide ${idx + 1}`}
                    maxLength={2000}
                  />
                  <AdminButton
                    type="button"
                    variant="secondary"
                    title="Duplicate this line"
                    onClick={() => copySlideAt(idx)}
                  >
                    <Copy className="h-4 w-4" />
                  </AdminButton>
                  <AdminButton
                    type="button"
                    variant="secondary"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                    onClick={() => setMarqueeSlides((prev) => prev.filter((_, i) => i !== idx))}
                    disabled={marqueeSlides.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </AdminButton>
                </div>
              ))}
            </div>
          </AdminCard>

          <AdminCard
            title="Header"
            subtitle="Choose static or sticky behavior."
            action={<Layout className="h-5 w-5 text-slate-600" />}
          >
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={headerIsFixed} onChange={(e) => setHeaderIsFixed(e.target.checked)} />
              Fixed header (sticky on scroll)
            </label>
          </AdminCard>

          <AdminCard
            title="Hero banner"
            subtitle="Upload banner image or use a direct image URL."
            action={<ImageIcon className="h-5 w-5 text-slate-600" />}
          >
            <div className="grid gap-4 md:grid-cols-[200px,1fr]">
              <div className="flex h-28 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-200 bg-slate-50">
                {heroImage ? <img src={withAssetCacheBust(heroImage, heroRevision)} alt="" className="h-full w-full object-cover" /> : <span className="text-xs text-slate-400">No hero image</span>}
              </div>
              <div className="space-y-3">
                <input
                  ref={heroInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (f) void uploadHero(f);
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <AdminButton type="button" variant="secondary" onClick={() => heroInputRef.current?.click()} disabled={uploadingHero}>
                    <Upload className="h-4 w-4" />
                    {uploadingHero ? 'Uploading…' : 'Upload image'}
                  </AdminButton>
                </div>
                <div>
                  <label className="admin-label">Image URL (optional)</label>
                  <input className="admin-field" value={heroImage} onChange={(e) => setHeroImage(e.target.value)} placeholder="https://..." />
                </div>
                {heroImage ? (
                  <p className="text-xs text-slate-500 break-all">
                    Current live hero image:{' '}
                    <a className="text-[#2878b3] hover:underline" href={heroImage} target="_blank" rel="noreferrer">
                      {heroImage}
                    </a>
                  </p>
                ) : null}
                <div>
                  <label className="admin-label">Overlay color (rgba)</label>
                  <input className="admin-field" value={heroOverlayColor} onChange={(e) => setHeroOverlayColor(e.target.value)} placeholder="rgba(0,0,0,0.45)" />
                </div>
              </div>
            </div>
          </AdminCard>

          <AdminCard title="Footer social links" subtitle="Icons appear only when a URL is provided.">
            <div className="grid gap-4 md:grid-cols-2">
              {socialKeys.map(([key, label]) => (
                <div key={key}>
                  <label className="admin-label">{label}</label>
                  <input
                    className="admin-field"
                    value={socialLinks[key]}
                    onChange={(e) => setSocialLinks((prev) => ({ ...prev, [key]: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              ))}
            </div>
          </AdminCard>

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <AdminButton type="button" variant="primary" onClick={() => void save()} disabled={saving}>
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save storefront settings'}
            </AdminButton>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}

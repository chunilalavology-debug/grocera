import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import api from '../services/api';
import { resolveBrandingAssetUrl, withAssetCacheBust } from '../utils/brandingAssets';

const SiteBrandingContext = createContext(null);

const DEFAULT_NAME = 'Zippyyy';
const DEFAULT_SITE_SETTINGS = {
  marquee: {
    enabled: true,
    bgColor: '#e9aa42',
    textColor: '#ffffff',
    speed: 35,
    slides: [
      '🥦 Fresh groceries delivered to your door – shop with ease 🥕',
      '🥦 Free delivery on orders over $50 – order now! 🥕',
      '🥦 Best quality, best prices – Zippyyy has it all 🥕',
    ],
  },
  header: { isFixed: false },
  heroBanner: {
    image: '',
    overlayColor: 'rgba(0,0,0,0.45)',
  },
  socialLinks: {
    facebook: '',
    instagram: '',
    linkedin: '',
    twitter: '',
    snapchat: '',
    whatsapp: '',
  },
};

function defaultFaviconHref() {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  const pub = process.env.PUBLIC_URL || '';
  return `${base}${pub}/favicon/logoRemo.svg`;
}

function faviconMimeTypeFromHref(href) {
  const base = String(href || '')
    .split('?')[0]
    .split('#')[0]
    .toLowerCase();
  if (/\.svg$/i.test(base)) return 'image/svg+xml';
  if (/\.ico$/i.test(base)) return 'image/x-icon';
  if (/\.webp$/i.test(base)) return 'image/webp';
  if (/\.jpe?g$/i.test(base)) return 'image/jpeg';
  if (/\.png$/i.test(base)) return 'image/png';
  return '';
}

/**
 * Replace static <link rel="icon"> entries so the tab icon can change after admin updates.
 * href must already be absolute and cache-busted.
 */
function applyFaviconToDocument(bustedHref) {
  if (typeof document === 'undefined') return;
  document.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']").forEach((el) => el.remove());
  const type = faviconMimeTypeFromHref(bustedHref);
  const append = (rel) => {
    const link = document.createElement('link');
    link.rel = rel;
    link.href = bustedHref;
    if (type) link.type = type;
    document.head.appendChild(link);
  };
  append('icon');
  append('shortcut icon');
}

export function SiteBrandingProvider({ children }) {
  const [websiteName, setWebsiteName] = useState(DEFAULT_NAME);
  const [websiteLogoUrl, setWebsiteLogoUrl] = useState('');
  const [websiteFaviconUrl, setWebsiteFaviconUrl] = useState('');
  const [siteSettings, setSiteSettings] = useState(DEFAULT_SITE_SETTINGS);
  const [brandingRevision, setBrandingRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const revisionRef = useRef(0);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get('/settings', {
        params: { _: Date.now() },
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
      });
      if (res.success && res.data) {
        const d = res.data;
        const name =
          d.websiteName && String(d.websiteName).trim() ? String(d.websiteName).trim() : DEFAULT_NAME;
        const rawLogo = String(d.websiteLogoUrl || d.logo || '').trim();
        const rawFavicon = String(d.websiteFaviconUrl || d.favicon || '').trim();
        setWebsiteName(name);
        setWebsiteLogoUrl(resolveBrandingAssetUrl(rawLogo));
        setWebsiteFaviconUrl(resolveBrandingAssetUrl(rawFavicon));
        setSiteSettings({
          marquee: {
            enabled: Boolean(d?.marquee?.enabled ?? true),
            bgColor: String(d?.marquee?.bgColor || '#e9aa42'),
            textColor: String(d?.marquee?.textColor || '#ffffff'),
            speed: Number(d?.marquee?.speed || 35),
            slides:
              Array.isArray(d?.marquee?.slides) && d.marquee.slides.length > 0
                ? d.marquee.slides.map((s) => String(s || '').trim()).filter(Boolean)
                : DEFAULT_SITE_SETTINGS.marquee.slides,
          },
          header: {
            isFixed: Boolean(d?.header?.isFixed ?? false),
          },
          heroBanner: {
            image: resolveBrandingAssetUrl(String(d?.heroBanner?.image || '').trim()),
            overlayColor: String(d?.heroBanner?.overlayColor || 'rgba(0,0,0,0.45)'),
          },
          socialLinks: {
            facebook: String(d?.socialLinks?.facebook || ''),
            instagram: String(d?.socialLinks?.instagram || ''),
            linkedin: String(d?.socialLinks?.linkedin || ''),
            twitter: String(d?.socialLinks?.twitter || ''),
            snapchat: String(d?.socialLinks?.snapchat || ''),
            whatsapp: String(d?.socialLinks?.whatsapp || ''),
          },
        });
        revisionRef.current += 1;
        setBrandingRevision(revisionRef.current);
      }
    } catch {
      /* keep previous / defaults */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let t;
    const schedule = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        void refresh();
      }, 400);
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') schedule();
    };
    window.addEventListener('focus', schedule);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearTimeout(t);
      window.removeEventListener('focus', schedule);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [refresh]);

  useEffect(() => {
    document.title = websiteName || DEFAULT_NAME;
  }, [websiteName]);

  useEffect(() => {
    const target = websiteFaviconUrl || defaultFaviconHref();
    const busted = withAssetCacheBust(target, brandingRevision);
    applyFaviconToDocument(busted);
  }, [websiteFaviconUrl, brandingRevision]);

  const websiteLogoSrc = useMemo(
    () => (websiteLogoUrl ? withAssetCacheBust(websiteLogoUrl, brandingRevision) : ''),
    [websiteLogoUrl, brandingRevision],
  );

  const value = useMemo(
    () => ({
      websiteName,
      websiteLogoUrl,
      websiteLogoSrc,
      websiteFaviconUrl,
      siteSettings,
      loading,
      refresh,
    }),
    [websiteName, websiteLogoUrl, websiteLogoSrc, websiteFaviconUrl, siteSettings, loading, refresh],
  );

  return (
    <SiteBrandingContext.Provider value={value}>{children}</SiteBrandingContext.Provider>
  );
}

export function useSiteBranding() {
  const ctx = useContext(SiteBrandingContext);
  if (!ctx) {
    throw new Error('useSiteBranding must be used within SiteBrandingProvider');
  }
  return ctx;
}

import React, { useEffect, useMemo, useState, useCallback } from "react";
import toast from "react-hot-toast";
import api from "../../services/api";
import { AdminButton } from "../../components/admin/ui";

const createDefaultSlide = () => ({
  title: "",
  subtitle: "",
  imageUrl: "",
  imageDisplayName: "",
  buttonText: "Shop Now",
  buttonLink: "/products",
  cardBgColor: "#f8fafc",
  textColor: "#1e293b",
  buttonBgColor: "#3090cf",
  buttonTextColor: "#ffffff",
  isActive: true,
});

const defaultState = {
  sectionBgColor: "#ffffff",
  autoPlay: true,
  autoPlayDelayMs: 3000,
  transitionDurationMs: 700,
  slidesPerViewDesktop: 3,
  slidesPerViewTablet: 2,
  slidesPerViewMobile: 1,
  slides: [createDefaultSlide()],
};

/** Match backend coerceHomeSliderSlides — legacy object-shaped slide lists. */
function coerceSlidesFromApi(slides) {
  if (slides == null) return [];
  if (Array.isArray(slides)) return slides;
  if (typeof slides === "object") {
    const keys = Object.keys(slides).filter((k) => /^\d+$/.test(k));
    if (keys.length > 0) {
      return keys
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => slides[k])
        .filter((s) => s != null);
    }
    if ("title" in slides || "imageUrl" in slides || "subtitle" in slides) return [slides];
  }
  return [];
}

function deriveFilenameFromUrl(url) {
  const u = String(url || "").trim();
  if (!u || u.startsWith("data:")) return "";
  try {
    const path = new URL(u).pathname;
    const seg = path.split("/").filter(Boolean).pop();
    return seg ? decodeURIComponent(seg) : "";
  } catch {
    return "";
  }
}

function normalizeSlide(raw) {
  if (!raw || typeof raw !== "object") return createDefaultSlide();
  const { _id, id, __v, imageDisplayName: idn, ...rest } = raw;
  const oid =
    _id != null
      ? String(_id)
      : id != null && /^[a-f0-9]{24}$/i.test(String(id))
        ? String(id)
        : undefined;
  const imageUrl = rest.imageUrl != null ? String(rest.imageUrl) : "";
  return {
    ...createDefaultSlide(),
    ...rest,
    _id: oid,
    title: rest.title != null ? String(rest.title) : "",
    subtitle: rest.subtitle != null ? String(rest.subtitle) : "",
    imageUrl,
    imageDisplayName:
      idn != null && String(idn).trim() !== ""
        ? String(idn).trim()
        : deriveFilenameFromUrl(imageUrl),
    buttonText: rest.buttonText != null ? String(rest.buttonText) : "Shop Now",
    buttonLink: rest.buttonLink != null ? String(rest.buttonLink) : "/products",
    isActive: rest.isActive !== false,
  };
}

export default function AdminSliderSettings() {
  const [form, setForm] = useState(defaultState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  /** Index of slide with editor open; null = all collapsed */
  const [openSlide, setOpenSlide] = useState(0);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/home-slider-settings", {
        params: { _: Date.now() },
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      });
      if (res?.success && res?.data) {
        const d = res.data;
        const slides = coerceSlidesFromApi(d.slides).map(normalizeSlide);
        setForm({
          ...defaultState,
          ...d,
          autoPlay: d.autoPlay !== false,
          autoPlayDelayMs: Number(d.autoPlayDelayMs ?? defaultState.autoPlayDelayMs),
          transitionDurationMs: Number(d.transitionDurationMs ?? defaultState.transitionDurationMs),
          slidesPerViewDesktop: Number(d.slidesPerViewDesktop ?? defaultState.slidesPerViewDesktop),
          slidesPerViewTablet: Number(d.slidesPerViewTablet ?? defaultState.slidesPerViewTablet),
          slidesPerViewMobile: Number(d.slidesPerViewMobile ?? defaultState.slidesPerViewMobile),
          slides,
        });
        setOpenSlide(slides.length > 0 ? 0 : null);
      }
    } catch (err) {
      toast.error(err?.message || "Failed to load slider settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const updateSlide = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      slides: prev.slides.map((slide, i) => (i === index ? { ...slide, [key]: value } : slide)),
    }));
  };

  const addSlide = () => {
    const newIndex = form.slides.length;
    setForm((prev) => ({ ...prev, slides: [...prev.slides, createDefaultSlide()] }));
    setOpenSlide(newIndex);
  };

  const removeSlide = (index) => {
    const nextSlides = form.slides.filter((_, i) => i !== index);
    let nextOpen = openSlide;
    if (nextSlides.length === 0) nextOpen = null;
    else if (openSlide === index) nextOpen = Math.min(index, nextSlides.length - 1);
    else if (openSlide != null && openSlide > index) nextOpen = openSlide - 1;
    setForm((prev) => ({ ...prev, slides: nextSlides }));
    setOpenSlide(nextOpen);
  };

  const copySlide = (index) => {
    setForm((prev) => {
      const src = prev.slides[index];
      if (!src) return prev;
      const raw = JSON.parse(JSON.stringify(src));
      delete raw._id;
      delete raw.id;
      const baseTitle = String(src.title || "").trim();
      raw.title = baseTitle ? `${baseTitle} (copy)` : `Slide ${index + 2} (copy)`;
      const clone = normalizeSlide(raw);
      const slides = [...prev.slides];
      slides.splice(index + 1, 0, clone);
      return { ...prev, slides };
    });
    setOpenSlide(index + 1);
    toast.success("Slide copied — edit below, then save.");
  };

  const moveSlide = (index, delta) => {
    const j = index + delta;
    if (j < 0 || j >= form.slides.length) return;
    setForm((prev) => {
      const slides = [...prev.slides];
      [slides[index], slides[j]] = [slides[j], slides[index]];
      return { ...prev, slides };
    });
    setOpenSlide((cur) => {
      if (cur == null) return cur;
      if (cur === index) return j;
      if (cur === j) return index;
      return cur;
    });
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const payload = {
        sectionBgColor: String(form.sectionBgColor || "#ffffff"),
        autoPlay: Boolean(form.autoPlay),
        autoPlayDelayMs: Math.max(1000, Math.min(20000, Number(form.autoPlayDelayMs) || 3000)),
        transitionDurationMs: Math.max(200, Math.min(3000, Number(form.transitionDurationMs) || 700)),
        slidesPerViewDesktop: Math.max(1, Math.min(4, Number(form.slidesPerViewDesktop) || 3)),
        slidesPerViewTablet: Math.max(1, Math.min(3, Number(form.slidesPerViewTablet) || 2)),
        slidesPerViewMobile: Math.max(1, Math.min(2, Number(form.slidesPerViewMobile) || 1)),
        slides: form.slides.map((s) => {
          const row = {
            title: String(s.title || "").trim(),
            subtitle: String(s.subtitle || "").trim().slice(0, 220),
            imageUrl: String(s.imageUrl || "").trim(),
            buttonText: String(s.buttonText || "Shop Now").trim().slice(0, 40) || "Shop Now",
            buttonLink: String(s.buttonLink || "/products").trim().slice(0, 1024) || "/products",
            cardBgColor: String(s.cardBgColor || "#f8fafc"),
            textColor: String(s.textColor || "#1e293b"),
            buttonBgColor: String(s.buttonBgColor || "#3090cf"),
            buttonTextColor: String(s.buttonTextColor || "#ffffff"),
            isActive: s.isActive !== false,
          };
          if (s._id && /^[a-f0-9]{24}$/i.test(String(s._id))) {
            row._id = String(s._id);
          }
          return row;
        }),
      };

      const res = await api.put("/admin/home-slider-settings", payload);
      if (res?.success) {
        toast.success("Saved — homepage uses active slides with title and image.");
        if (res?.data?.slides) {
          setForm((prev) => ({
            ...prev,
            ...res.data,
            slides: coerceSlidesFromApi(res.data.slides).map(normalizeSlide),
          }));
        }
      } else {
        toast.error(res?.message || "Failed to save settings");
      }
    } catch (err) {
      toast.error(err?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const uploadSlideImage = async (index, file) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/admin/home-slider-settings/upload", formData);

      const uploadedUrl = res?.data?.imageUrl;
      if (!res?.success || !uploadedUrl) {
        toast.error(res?.message || "Image upload failed");
        return;
      }

      const fileName = res?.data?.fileName || file.name || "";
      updateSlide(index, "imageUrl", uploadedUrl);
      updateSlide(index, "imageDisplayName", fileName);
      toast.success("Image uploaded — remember to save if you changed other fields.");
    } catch (err) {
      toast.error(err?.message || "Image upload failed");
    }
  };

  const slideSummaries = useMemo(
    () =>
      form.slides.map((s, i) => ({
        i,
        title: String(s.title || "").trim() || `Slide ${i + 1} (no title yet)`,
        active: s.isActive !== false,
        hasImage: Boolean(String(s.imageUrl || "").trim()),
      })),
    [form.slides],
  );

  if (loading) {
    return (
      <div className="admin-design-scope flex items-center justify-center py-20">
        <div className="text-sm font-medium text-slate-500">Loading slider settings…</div>
      </div>
    );
  }

  return (
    <div className="admin-design-scope mx-auto max-w-5xl space-y-6 pb-16 font-sans text-slate-900">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="admin-shell-title">Homepage slider</h1>
          <p className="admin-shell-desc max-w-xl">
            Same data as the storefront carousel (<code className="text-xs bg-slate-100 px-1 rounded">/user/home-slider-settings</code>
            ). Only slides marked <strong>active</strong> with a <strong>title and image</strong> appear on the site. Order here is the order on
            the homepage.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <AdminButton type="button" variant="secondary" size="md" onClick={() => void loadSettings()} disabled={loading}>
            Refresh
          </AdminButton>
          <AdminButton type="button" variant="primary" size="md" onClick={saveSettings} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </AdminButton>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide mb-4">Carousel behavior</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          <Field label="Section background">
            <input
              type="color"
              value={form.sectionBgColor}
              onChange={(e) => updateField("sectionBgColor", e.target.value)}
              className="h-9 w-full max-w-[120px] cursor-pointer rounded border border-slate-200"
            />
          </Field>
          <Field label="Auto-play">
            <select
              value={form.autoPlay ? "yes" : "no"}
              onChange={(e) => updateField("autoPlay", e.target.value === "yes")}
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm bg-white"
            >
              <option value="yes">On</option>
              <option value="no">Off</option>
            </select>
          </Field>
          <Field label="Delay between pages (ms)">
            <input
              type="number"
              min={1000}
              max={20000}
              step={100}
              value={form.autoPlayDelayMs}
              onChange={(e) => updateField("autoPlayDelayMs", e.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
            />
          </Field>
          <Field label="Slide animation (ms)">
            <input
              type="number"
              min={200}
              max={3000}
              step={50}
              value={form.transitionDurationMs}
              onChange={(e) => updateField("transitionDurationMs", e.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
            />
          </Field>
          <Field label="Cards per row — desktop">
            <input
              type="number"
              min={1}
              max={4}
              value={form.slidesPerViewDesktop}
              onChange={(e) => updateField("slidesPerViewDesktop", e.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
            />
          </Field>
          <Field label="Cards per row — tablet">
            <input
              type="number"
              min={1}
              max={3}
              value={form.slidesPerViewTablet}
              onChange={(e) => updateField("slidesPerViewTablet", e.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
            />
          </Field>
          <Field label="Cards per row — mobile">
            <input
              type="number"
              min={1}
              max={2}
              value={form.slidesPerViewMobile}
              onChange={(e) => updateField("slidesPerViewMobile", e.target.value)}
              className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
            />
          </Field>
        </div>
      </section>

      <section>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wide">Slides</h2>
          <AdminButton type="button" variant="secondary" size="sm" onClick={addSlide}>
            + Add slide
          </AdminButton>
        </div>

        <ul className="space-y-2">
          {form.slides.map((slide, index) => {
            const summary = slideSummaries[index];
            const isOpen = openSlide === index;
            const rowKey = slide._id ? `${slide._id}-${index}` : `idx-${index}`;
            return (
              <li key={rowKey} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="flex w-full items-center gap-2 p-3 hover:bg-slate-50/80 transition-colors">
                  <button
                    type="button"
                    onClick={() => setOpenSlide(isOpen ? null : index)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <div className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100 border border-slate-200">
                      {summary.hasImage ? (
                        <img src={slide.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[10px] text-slate-400 px-1 text-center">
                          No image
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-900 truncate">{summary.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {summary.active ? (
                          <span className="text-emerald-700">Active on site</span>
                        ) : (
                          <span className="text-slate-500">Hidden on site</span>
                        )}
                        {" · "}
                        <span className="text-slate-400">Position {index + 1}</span>
                      </div>
                    </div>
                    <span className="text-slate-400 text-sm shrink-0 tabular-nums">{isOpen ? "▲" : "▼"}</span>
                  </button>
                  <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => setOpenSlide(index)}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => copySlide(index)}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-800 hover:bg-slate-50"
                      title="Duplicate this slide (inserts below; same image and styling)"
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Remove this slide from the homepage slider?")) removeSlide(index);
                      }}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-md border border-red-200 bg-white text-red-700 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 px-4 py-4 bg-slate-50/50">
                    <div className="flex flex-wrap gap-2 mb-4">
                      <button
                        type="button"
                        onClick={() => moveSlide(index, -1)}
                        disabled={index === 0}
                        className="text-xs font-medium px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        Move up
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSlide(index, 1)}
                        disabled={index >= form.slides.length - 1}
                        className="text-xs font-medium px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        Move down
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSlide(index)}
                        className="text-xs font-medium px-3 py-1.5 rounded-md border border-slate-200 bg-white text-red-700 hover:bg-red-50"
                      >
                        Remove slide
                      </button>
                      <button
                        type="button"
                        onClick={() => copySlide(index)}
                        className="text-xs font-medium px-3 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      >
                        Copy slide
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      <div className="space-y-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Content</p>
                        <Field label="Headline">
                          <input
                            type="text"
                            value={slide.title}
                            onChange={(e) => updateSlide(index, "title", e.target.value)}
                            className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
                            maxLength={120}
                            placeholder="Main title on the card"
                          />
                        </Field>
                        <Field label="Subtitle (optional)">
                          <textarea
                            value={slide.subtitle || ""}
                            onChange={(e) => updateSlide(index, "subtitle", e.target.value)}
                            className="w-full min-h-[72px] rounded-md border border-slate-200 px-3 py-2 text-sm resize-y"
                            maxLength={220}
                            placeholder="Supporting line under the headline"
                          />
                        </Field>
                        <Field label="Image URL (optional if you upload)">
                          <input
                            type="url"
                            value={slide.imageUrl}
                            onChange={(e) => {
                              updateSlide(index, "imageUrl", e.target.value);
                              updateSlide(index, "imageDisplayName", deriveFilenameFromUrl(e.target.value));
                            }}
                            className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
                            placeholder="https://…"
                          />
                          {slide.imageDisplayName ? (
                            <p className="mt-1.5 text-xs text-slate-600 truncate" title={slide.imageDisplayName}>
                              File: <span className="font-medium text-slate-800">{slide.imageDisplayName}</span>
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                              Upload file
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  uploadSlideImage(index, file);
                                  e.target.value = "";
                                }}
                              />
                            </label>
                            {summary.hasImage ? (
                              <span className="text-[11px] text-slate-500">Preview below</span>
                            ) : null}
                          </div>
                          {summary.hasImage ? (
                            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white max-w-xs">
                              <img src={slide.imageUrl} alt="" className="max-h-40 w-full object-contain" />
                            </div>
                          ) : null}
                        </Field>
                        <Field label="Button label">
                          <input
                            type="text"
                            value={slide.buttonText}
                            onChange={(e) => updateSlide(index, "buttonText", e.target.value)}
                            className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
                            maxLength={40}
                          />
                        </Field>
                        <Field label="Button link">
                          <input
                            type="text"
                            value={slide.buttonLink}
                            onChange={(e) => updateSlide(index, "buttonLink", e.target.value)}
                            className="h-9 w-full rounded-md border border-slate-200 px-3 text-sm"
                            placeholder="/products or https://…"
                          />
                        </Field>
                      </div>

                      <div className="space-y-4">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Appearance</p>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Card background">
                            <input
                              type="color"
                              value={slide.cardBgColor}
                              onChange={(e) => updateSlide(index, "cardBgColor", e.target.value)}
                              className="h-9 w-full cursor-pointer rounded-md border border-slate-200"
                            />
                          </Field>
                          <Field label="Text color">
                            <input
                              type="color"
                              value={slide.textColor}
                              onChange={(e) => updateSlide(index, "textColor", e.target.value)}
                              className="h-9 w-full cursor-pointer rounded-md border border-slate-200"
                            />
                          </Field>
                          <Field label="Button background">
                            <input
                              type="color"
                              value={slide.buttonBgColor}
                              onChange={(e) => updateSlide(index, "buttonBgColor", e.target.value)}
                              className="h-9 w-full cursor-pointer rounded-md border border-slate-200"
                            />
                          </Field>
                          <Field label="Button text">
                            <input
                              type="color"
                              value={slide.buttonTextColor}
                              onChange={(e) => updateSlide(index, "buttonTextColor", e.target.value)}
                              className="h-9 w-full cursor-pointer rounded-md border border-slate-200"
                            />
                          </Field>
                        </div>

                        <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 cursor-pointer w-fit">
                          <input
                            type="checkbox"
                            checked={slide.isActive !== false}
                            onChange={(e) => updateSlide(index, "isActive", e.target.checked)}
                            className="rounded border-slate-300"
                          />
                          Show this slide on the homepage (when title and image are set)
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-200">
        <AdminButton type="button" variant="secondary" size="md" onClick={() => void loadSettings()} disabled={loading}>
          Refresh
        </AdminButton>
        <AdminButton type="button" variant="primary" size="md" onClick={saveSettings} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </AdminButton>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="block space-y-1.5">
      <span className="block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </div>
  );
}

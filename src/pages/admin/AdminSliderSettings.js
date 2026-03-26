import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../services/api";

const createDefaultSlide = () => ({
  title: "",
  imageUrl: "",
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

export default function AdminSliderSettings() {
  const [form, setForm] = useState(defaultState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        const res = await api.get("/admin/home-slider-settings");
        if (res?.success && res?.data) {
          setForm({
            ...defaultState,
            ...res.data,
            slides: Array.isArray(res.data.slides) && res.data.slides.length > 0 ? res.data.slides : [createDefaultSlide()],
          });
        }
      } catch (err) {
        toast.error(err?.message || "Failed to load slider settings");
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const updateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const updateSlide = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      slides: prev.slides.map((slide, i) => (i === index ? { ...slide, [key]: value } : slide)),
    }));
  };

  const addSlide = () => {
    setForm((prev) => ({ ...prev, slides: [...prev.slides, createDefaultSlide()] }));
  };

  const removeSlide = (index) => {
    setForm((prev) => {
      if (prev.slides.length <= 1) return prev;
      return { ...prev, slides: prev.slides.filter((_, i) => i !== index) };
    });
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const payload = {
        ...form,
        autoPlayDelayMs: Number(form.autoPlayDelayMs),
        transitionDurationMs: Number(form.transitionDurationMs),
        slidesPerViewDesktop: Number(form.slidesPerViewDesktop),
        slidesPerViewTablet: Number(form.slidesPerViewTablet),
        slidesPerViewMobile: Number(form.slidesPerViewMobile),
      };
      const res = await api.put("/admin/home-slider-settings", payload);
      if (res?.success) {
        toast.success("Slider settings saved");
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
      const res = await api.post("/admin/home-slider-settings/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const uploadedUrl = res?.data?.imageUrl;
      if (!res?.success || !uploadedUrl) {
        toast.error(res?.message || "Image upload failed");
        return;
      }

      updateSlide(index, "imageUrl", uploadedUrl);
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(err?.message || "Image upload failed");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-slate-500 font-medium">Loading slider settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-800">Home Slider Settings</h1>
            <p className="text-sm text-slate-500">Manage text, images, button links, colors, speed and slide count.</p>
          </div>
          <button
            type="button"
            onClick={saveSettings}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[#3090cf] hover:bg-[#246fa0] text-white text-sm font-semibold disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field label="Section Background">
            <input type="color" value={form.sectionBgColor} onChange={(e) => updateField("sectionBgColor", e.target.value)} className="h-10 w-full border border-slate-200 rounded-lg" />
          </Field>
          <Field label="Auto Play Delay (ms)">
            <input type="number" min={1000} max={20000} value={form.autoPlayDelayMs} onChange={(e) => updateField("autoPlayDelayMs", e.target.value)} className="h-10 w-full border border-slate-200 rounded-lg px-3 text-sm" />
          </Field>
          <Field label="Transition Duration (ms)">
            <input type="number" min={200} max={3000} value={form.transitionDurationMs} onChange={(e) => updateField("transitionDurationMs", e.target.value)} className="h-10 w-full border border-slate-200 rounded-lg px-3 text-sm" />
          </Field>
          <Field label="Auto Play">
            <select value={form.autoPlay ? "yes" : "no"} onChange={(e) => updateField("autoPlay", e.target.value === "yes")} className="h-10 w-full border border-slate-200 rounded-lg px-3 text-sm bg-white">
              <option value="yes">Enabled</option>
              <option value="no">Disabled</option>
            </select>
          </Field>
          <Field label="Slides Desktop">
            <input type="number" min={1} max={4} value={form.slidesPerViewDesktop} onChange={(e) => updateField("slidesPerViewDesktop", e.target.value)} className="h-10 w-full border border-slate-200 rounded-lg px-3 text-sm" />
          </Field>
          <Field label="Slides Tablet">
            <input type="number" min={1} max={3} value={form.slidesPerViewTablet} onChange={(e) => updateField("slidesPerViewTablet", e.target.value)} className="h-10 w-full border border-slate-200 rounded-lg px-3 text-sm" />
          </Field>
          <Field label="Slides Mobile">
            <input type="number" min={1} max={2} value={form.slidesPerViewMobile} onChange={(e) => updateField("slidesPerViewMobile", e.target.value)} className="h-10 w-full border border-slate-200 rounded-lg px-3 text-sm" />
          </Field>
        </div>
      </div>

      <div className="space-y-4">
        {form.slides.map((slide, index) => (
          <div key={index} className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Slide {index + 1}</h3>
              <button
                type="button"
                onClick={() => removeSlide(index)}
                disabled={form.slides.length <= 1}
                className="text-xs font-semibold px-3 py-1.5 rounded-md border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                Remove
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Field label="Title">
                <input type="text" value={slide.title} onChange={(e) => updateSlide(index, "title", e.target.value)} className="h-10 w-full border border-slate-200 rounded-lg px-3 text-sm" />
              </Field>
              <Field label="Image URL">
                <div className="space-y-2">
                  <input type="url" value={slide.imageUrl} onChange={(e) => updateSlide(index, "imageUrl", e.target.value)} className="h-10 w-full border border-slate-200 rounded-lg px-3 text-sm" placeholder="https://..." />
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer">
                    Upload from PC
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        uploadSlideImage(index, file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </Field>
              <Field label="Button Text">
                <input type="text" value={slide.buttonText} onChange={(e) => updateSlide(index, "buttonText", e.target.value)} className="h-10 w-full border border-slate-200 rounded-lg px-3 text-sm" />
              </Field>
              <Field label="Button Link">
                <input type="text" value={slide.buttonLink} onChange={(e) => updateSlide(index, "buttonLink", e.target.value)} className="h-10 w-full border border-slate-200 rounded-lg px-3 text-sm" placeholder="/products or https://..." />
              </Field>
              <Field label="Card Background">
                <input type="color" value={slide.cardBgColor} onChange={(e) => updateSlide(index, "cardBgColor", e.target.value)} className="h-10 w-full border border-slate-200 rounded-lg" />
              </Field>
              <Field label="Text Color">
                <input type="color" value={slide.textColor} onChange={(e) => updateSlide(index, "textColor", e.target.value)} className="h-10 w-full border border-slate-200 rounded-lg" />
              </Field>
              <Field label="Button Background">
                <input type="color" value={slide.buttonBgColor} onChange={(e) => updateSlide(index, "buttonBgColor", e.target.value)} className="h-10 w-full border border-slate-200 rounded-lg" />
              </Field>
              <Field label="Button Text Color">
                <input type="color" value={slide.buttonTextColor} onChange={(e) => updateSlide(index, "buttonTextColor", e.target.value)} className="h-10 w-full border border-slate-200 rounded-lg" />
              </Field>
            </div>

            <label className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-slate-700">
              <input type="checkbox" checked={slide.isActive !== false} onChange={(e) => updateSlide(index, "isActive", e.target.checked)} />
              Slide Active
            </label>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addSlide}
        className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-sm font-semibold"
      >
        + Add Slide
      </button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

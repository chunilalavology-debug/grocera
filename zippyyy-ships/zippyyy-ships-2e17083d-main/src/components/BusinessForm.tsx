import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Send, CheckCircle } from "lucide-react";
import deliveryTruck from "@/assets/delivery-truck.png";

const BusinessForm = () => {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    business: "",
    email: "",
    phone: "",
    message: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, this would send to zippyyycare@gmail.com via backend
    const mailtoLink = `mailto:zippyyycare@gmail.com?subject=Business Partner Inquiry from ${encodeURIComponent(form.name)}&body=${encodeURIComponent(
      `Name: ${form.name}\nBusiness: ${form.business}\nEmail: ${form.email}\nPhone: ${form.phone}\n\nMessage:\n${form.message}`
    )}`;
    window.open(mailtoLink, "_blank");
    setSubmitted(true);
  };

  const updateField = (field: string, value: string) => {
    setForm({ ...form, [field]: value });
  };

  return (
    <section id="business" className="py-10 sm:py-16 md:py-24 bg-surface">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="grid lg:grid-cols-2 gap-8 sm:gap-10 lg:gap-12 items-center max-w-6xl mx-auto">
          {/* Left: Copy + Image */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-[10px] uppercase tracking-widest font-semibold text-primary">
              Business Partners
            </span>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tighter text-foreground mt-2 sm:mt-3 text-balance">
              Bulk shipping for the <span className="text-primary">bold</span>.
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed max-w-md">
              Are you a business owner looking to place orders in bulk? We got you.
              We support local businesses that require shipping at affordable prices.
            </p>
            <p className="mt-3 text-muted-foreground leading-relaxed max-w-md">
              Want to tie in your local shipping? Partner with us and grow together.
              Share your details and one of our team members will get back to you soon.
            </p>
            <motion.img
              src={deliveryTruck}
              alt="Delivery truck"
              className="mt-6 sm:mt-8 w-full max-w-xs sm:w-72 mx-auto lg:mx-0 drop-shadow-xl"
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            />
          </motion.div>

          {/* Right: Form */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-card rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 shadow-float-lg"
          >
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <CheckCircle className="text-primary mx-auto mb-4" size={48} />
                <h3 className="text-2xl font-bold text-foreground mb-2">Thank you!</h3>
                <p className="text-muted-foreground">
                  We will be in touch very soon. Thank you for your interest in partnering with Zippyyy Ships!
                </p>
              </motion.div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <Building2 className="text-primary" size={20} />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Business Inquiry</h3>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2 block">Your Name</label>
                    <input
                      required
                      type="text"
                      value={form.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      className="w-full bg-secondary p-4 rounded-2xl text-foreground outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2 block">Business Name</label>
                    <input
                      required
                      type="text"
                      value={form.business}
                      onChange={(e) => updateField("business", e.target.value)}
                      className="w-full bg-secondary p-4 rounded-2xl text-foreground outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                      placeholder="Acme Inc."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2 block">Email</label>
                      <input
                        required
                        type="email"
                        value={form.email}
                        onChange={(e) => updateField("email", e.target.value)}
                        className="w-full bg-secondary p-4 rounded-2xl text-foreground outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                        placeholder="you@email.com"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2 block">Phone</label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => updateField("phone", e.target.value)}
                        className="w-full bg-secondary p-4 rounded-2xl text-foreground outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
                        placeholder="+1 234 567 890"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-2 block">Tell us about your needs</label>
                    <textarea
                      required
                      rows={4}
                      value={form.message}
                      onChange={(e) => updateField("message", e.target.value)}
                      className="w-full bg-secondary p-4 rounded-2xl text-foreground outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground resize-none"
                      placeholder="Shipping volume, products, routes..."
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full px-8 py-4 bg-primary text-primary-foreground font-bold rounded-full hover:scale-[1.02] active:scale-95 transition-transform shadow-glow flex items-center justify-center gap-2"
                  >
                    <Send size={18} />
                    Submit Inquiry
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default BusinessForm;

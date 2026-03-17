import React, { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import api from '../services/api';
import '../styles/pages/Contact.css';

function Contact() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    subject: '',
    message: '',
    inquiryType: 'general'
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.message.trim().length < 20) {
      return toast.error('Please provide a more detailed message (min. 20 characters).');
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading('Sending your message...');

    try {
      const payload = {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        subject: formData.subject,
        message: formData.message,
        queryType: formData.inquiryType
      };

      const response = await api.post(`/user/contactForm`, payload);

      if (response.success) {
        toast.success('Thank you! Your message has been received successfully.', {
          id: loadingToast,
          duration: 4000
        });
        setFormData({
          firstName: '', lastName: '', email: '',
          subject: '', message: '', inquiryType: 'general'
        });
      } else {
        toast.error('Submission failed. Please try again or contact support.', { id: loadingToast });
      }
    } catch (error) {
      if (error.message) {
        toast.error(error.message || 'Unable to connect. Please check your internet connection.', { id: loadingToast });
      }
      else {
        toast.error(
          'Unable to connect. Please check your internet connection.',
          { id: loadingToast }
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const SITE_COLOR = '#3090cf';
  const SITE_COLOR_DARK = '#2680b8';

  return (
    <div className="min-h-screen bg-[#f8fafc] py-10 sm:py-14 px-4 sm:px-6 lg:px-8 font-sans">
      <Toaster position="top-center" reverseOrder={false} />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-14">
          <div className="inline-block mb-4 w-14 h-1 rounded-full" style={{ backgroundColor: SITE_COLOR }} aria-hidden />
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-slate-900 mb-3 tracking-tight">
            Contact <span style={{ color: SITE_COLOR }}>Us</span>
          </h1>
          <p className="text-slate-500 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            Have questions or need help with an order? We're here for you.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10 items-start">
          {/* Left: Info cards */}
          <div className="space-y-5 order-2 lg:order-1">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
              <div className="w-10 h-1 rounded-full mb-4" style={{ backgroundColor: SITE_COLOR }} />
              <h3 className="text-slate-800 font-bold text-lg mb-2 flex items-center gap-2">
                <span aria-hidden>📍</span> Delivery
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                We provide nationwide delivery across the United States, ensuring fast and reliable service to customers in all 50 states.
              </p>
            </div>

            <div
              className="p-6 rounded-2xl shadow-md text-white"
              style={{ background: `linear-gradient(135deg, ${SITE_COLOR} 0%, ${SITE_COLOR_DARK} 100%)` }}
            >
              <h3 className="font-bold text-lg mb-2">24/7 Support</h3>
              <p className="text-white/90 text-sm leading-relaxed">
                We're operational 365 days a year so your orders and questions are always handled.
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
              <div className="w-10 h-1 rounded-full mb-4" style={{ backgroundColor: SITE_COLOR }} />
              <h3 className="text-slate-800 font-bold text-lg mb-2">Quick response</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                We aim to reply within 24 hours. For urgent order issues, mention your order number in the message.
              </p>
            </div>
          </div>

          {/* Right: Form */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200/80 overflow-hidden">
              <div className="px-6 sm:px-8 pt-8 pb-2 border-b border-slate-100">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-3">
                  <span className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: SITE_COLOR }} />
                  Send us a message
                </h2>
              </div>
              <div className="p-6 sm:p-8">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700">First name</label>
                      <input
                        type="text"
                        name="firstName"
                        required
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="contact-input w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white focus:border-[#3090cf] focus:ring-2 focus:ring-[#3090cf]/20 outline-none transition-all"
                        placeholder="Your first name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700">Last name</label>
                      <input
                        type="text"
                        name="lastName"
                        required
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className="contact-input w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white focus:border-[#3090cf] focus:ring-2 focus:ring-[#3090cf]/20 outline-none transition-all"
                        placeholder="Your last name"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700">Email</label>
                      <input
                        type="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleInputChange}
                        className="contact-input w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white focus:border-[#3090cf] focus:ring-2 focus:ring-[#3090cf]/20 outline-none transition-all"
                        placeholder="you@example.com"
                      />
                    </div>
                    <div className="space-y-1.5 relative">
                      <label className="text-sm font-semibold text-slate-700">Inquiry type</label>
                      <select
                        name="inquiryType"
                        value={formData.inquiryType}
                        onChange={handleInputChange}
                        className="contact-input w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white focus:border-[#3090cf] focus:ring-2 focus:ring-[#3090cf]/20 outline-none transition-all appearance-none cursor-pointer"
                      >
                        <option value="general">General inquiry</option>
                        <option value="order">Order & logistics</option>
                        <option value="technical">Technical support</option>
                        <option value="business">Business partnership</option>
                      </select>
                      <div className="absolute right-4 top-[38px] pointer-events-none text-slate-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Subject</label>
                    <input
                      type="text"
                      name="subject"
                      required
                      minLength={5}
                      value={formData.subject}
                      onChange={handleInputChange}
                      className="contact-input w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white focus:border-[#3090cf] focus:ring-2 focus:ring-[#3090cf]/20 outline-none transition-all"
                      placeholder="How can we help?"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Message</label>
                    <textarea
                      name="message"
                      required
                      rows={5}
                      value={formData.message}
                      onChange={handleInputChange}
                      className="contact-input w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/80 focus:bg-white focus:border-[#3090cf] focus:ring-2 focus:ring-[#3090cf]/20 outline-none transition-all resize-none"
                      placeholder="Include as much detail as you can, and your order number if it's about an order."
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="contact-submit-btn w-full text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" aria-hidden>
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Sending...
                      </>
                    ) : (
                      <>
                        Send message
                        <span className="text-lg" aria-hidden>→</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Contact;
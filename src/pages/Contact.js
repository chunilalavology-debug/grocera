import React, { useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import api from '../services/api';

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
    const loadingToast = toast.loading('Bheja ja raha hai...');

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

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <Toaster position="top-center" reverseOrder={false} />

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold text-slate-900 sm:text-5xl mb-4 italic">
            Zippyyy <span className="text-blue-600">Support</span>
          </h1>
          <p className="text-gray-500 text-lg max-w-xl mx-auto">
            Have questions about our services or need assistance with an order? We're here to help you 24/7.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* Info Section */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="text-blue-600 font-bold mb-4 flex items-center gap-2">
                <span>📍</span> Delivery Locations
              </h3>
              <div className="flex flex-wrap gap-2">
                {['Queens', 'Brooklyn', 'Manhattan', 'Long Island'].map(city => (
                  <span key={city} className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                    {city}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-2xl shadow-lg text-white">
              <h3 className="font-bold text-xl mb-2">24/7 Service</h3>
              <p className="text-blue-100 text-sm leading-relaxed">
                Our systems are operational 365 days a year to ensure your deliveries never stop.
              </p>
            </div>
          </div>

          {/* Form Section */}
          <div className="lg:col-span-2 bg-white rounded-3xl shadow-2xl shadow-slate-200/50 p-8 border border-white">
            <h2 className="text-2xl font-bold text-slate-800 mb-8 border-l-4 border-blue-600 pl-4">
              Send us a Message
            </h2>

            {/* Contact Form */}
            <div className="lg:col-span-8 bg-white rounded-3xl shadow-xl shadow-gray-200/40 p-10 border border-gray-50">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 ml-1">First Name</label>
                    <input
                      type="text"
                      name="firstName"
                      required
                      value={formData.firstName}
                      onChange={handleInputChange}
                      className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none border"
                      placeholder="Enter your first name" // Professional & Clear
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 ml-1">Last Name</label>
                    <input
                      type="text"
                      name="lastName"
                      required
                      value={formData.lastName}
                      onChange={handleInputChange}
                      className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none border"
                      placeholder="Enter your last name" // Consistent
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 ml-1">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none border"
                      placeholder="example@domain.com" // Standard email hint
                    />
                  </div>
                  <div className="space-y-2 relative">
                    <label className="text-sm font-semibold text-gray-700 ml-1">Inquiry Type</label>
                    <select
                      name="inquiryType"
                      value={formData.inquiryType}
                      onChange={handleInputChange}
                      className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none appearance-none cursor-pointer border"
                    >
                      <option value="general">Select inquiry type...</option> {/* Placeholder-like first option */}
                      <option value="general">General Inquiry</option>
                      <option value="order">Order & Logistics</option>
                      <option value="technical">Technical Support</option>
                      <option value="business">Business Partnership</option>
                    </select>
                    {/* Custom Arrow for Select */}
                    <div className="absolute right-5 top-[46px] pointer-events-none text-gray-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 ml-1">Subject</label>
                  <input
                    type="text"
                    name="subject"
                    required
                    minLength={5}
                    value={formData.subject}
                    onChange={handleInputChange}
                    className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none border"
                    placeholder="How can we assist you today?" // Engaging question
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700 ml-1">Message Detail</label>
                  <textarea
                    name="message"
                    required
                    rows="5"
                    value={formData.message}
                    onChange={handleInputChange}
                    className="w-full px-5 py-3.5 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none resize-none border"
                    placeholder="Please provide as much detail as possible, including order numbers if applicable..." // Specific guidance
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gray-900 hover:bg-blue-600 text-white font-bold py-4 rounded-2xl transition-all duration-300 shadow-xl shadow-gray-200 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-3 group"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2 font-medium">
                      <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing Request...
                    </span>
                  ) : (
                    <>
                      Submit Inquiry
                      <span className="text-lg group-hover:translate-x-1 transition-transform">→</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Contact;
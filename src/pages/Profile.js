import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import toast, { Toaster } from 'react-hot-toast';
import api from '../services/api';

function Profile() {
  const { user, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: ''
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || user.name?.split(' ')[0] || '',
        lastName: user.lastName || user.name?.split(' ').slice(1).join(' ') || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address?.street || '',
        city: user.address?.city || '',
        state: user.address?.state || 'NY',
        zipCode: user.address?.zipCode || ''
      });
    }
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    const loadingToast = toast.loading('Synchronizing your profile changes...');

    try {
      const payloads = {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        phone: profileData.phone,
        address: {
          street: profileData.address,
          city: profileData.city,
          state: profileData.state,
          zipCode: profileData.zipCode
        }
      };

      const res = await api.put('/auth/updateProfile', payloads);

      if (res.success) {
        toast.success(`Success! Your profile has been updated, ${profileData.firstName}.`, {
          id: loadingToast,
          duration: 4000
        });

        if (updateProfile) updateProfile(res.user);

        setIsEditing(false);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Unable to update profile at this moment. Please try again.';
      toast.error(errorMsg, { id: loadingToast });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <Toaster position="top-right" reverseOrder={false} />

      <div className="max-w-6xl mx-auto">
        {/* Profile Hero Header */}
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 mb-8 flex flex-col md:flex-row items-center gap-8">
          <div className="relative">
            <div className="w-28 h-28 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center text-white text-4xl font-bold shadow-2xl shadow-blue-200 rotate-3 group-hover:rotate-0 transition-transform">
              <span className="-rotate-3">{profileData.firstName[0]}{profileData.lastName[0]}</span>
            </div>
            <div className="absolute -bottom-2 -right-2 bg-green-500 w-6 h-6 rounded-full border-4 border-white shadow-sm"></div>
          </div>

          <div className="text-center md:text-left flex-1">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome back, {profileData.firstName}!
            </h1>
            <p className="text-slate-500 mt-1 font-medium italic">Manage your account details and delivery preferences below.</p>
          </div>

          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-8 py-3 bg-slate-900 text-white font-bold rounded-2xl hover:bg-blue-600 transition-all duration-300 shadow-lg shadow-slate-200 flex items-center gap-2 active:scale-95"
            >
              <span>Edit Account</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form Section */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-white overflow-hidden">
              <div className="p-8 md:p-10 space-y-10">

                {/* Section 1: Personal Details */}
                <section>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="h-8 w-1 bg-blue-600 rounded-full"></div>
                    <h3 className="text-xl font-bold text-slate-800 tracking-tight">Personal Details</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                      <input
                        type="text"
                        name="firstName"
                        required
                        value={profileData.firstName}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className={`w-full px-5 py-4 rounded-2xl transition-all outline-none border ${isEditing ? 'bg-white border-blue-200 focus:ring-4 focus:ring-blue-100' : 'bg-slate-50 border-transparent text-slate-500'}`}
                        placeholder="John"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                      <input
                        type="text"
                        name="lastName"
                        required
                        value={profileData.lastName}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className={`w-full px-5 py-4 rounded-2xl transition-all outline-none border ${isEditing ? 'bg-white border-blue-200 focus:ring-4 focus:ring-blue-100' : 'bg-slate-50 border-transparent text-slate-500'}`}
                        placeholder="Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Email (Primary)</label>
                      <input
                        type="email"
                        value={profileData.email}
                        disabled
                        className="w-full px-5 py-4 rounded-2xl bg-slate-100 border-transparent text-slate-400 italic cursor-not-allowed border"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                      <input
                        type="tel"
                        name="phone"
                        value={profileData.phone}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className={`w-full px-5 py-4 rounded-2xl transition-all outline-none border ${isEditing ? 'bg-white border-blue-200 focus:ring-4 focus:ring-blue-100' : 'bg-slate-50 border-transparent text-slate-500'}`}
                        placeholder="+1 (000) 000-0000"
                      />
                    </div>
                  </div>
                </section>

                {/* Section 2: Shipping Address */}
                <section>
                  <div className="flex items-center gap-3 mb-8">
                    <div className="h-8 w-1 bg-blue-600 rounded-full"></div>
                    <h3 className="text-xl font-bold text-slate-800 tracking-tight">Shipping Address</h3>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Street Address</label>
                      <input
                        type="text"
                        name="address"
                        value={profileData.address}
                        onChange={handleInputChange}
                        disabled={!isEditing}
                        className={`w-full px-5 py-4 rounded-2xl transition-all outline-none border ${isEditing ? 'bg-white border-blue-200 focus:ring-4 focus:ring-blue-100' : 'bg-slate-50 border-transparent text-slate-500'}`}
                        placeholder="Apt, Suite, Street Name"
                      />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2 space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">City</label>
                        <input
                          type="text"
                          name="city"
                          value={profileData.city}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`w-full px-5 py-4 rounded-2xl transition-all outline-none border ${isEditing ? 'bg-white border-blue-200 focus:ring-4 focus:ring-blue-100' : 'bg-slate-50 border-transparent text-slate-500'}`}
                          placeholder="Queens"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">State</label>
                        <input
                          type="text"
                          name="state"
                          value={profileData.state}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`w-full px-5 py-4 rounded-2xl transition-all outline-none border ${isEditing ? 'bg-white border-blue-200 focus:ring-4 focus:ring-blue-100' : 'bg-slate-50 border-transparent text-slate-500'}`}
                          placeholder="NY"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">ZIP</label>
                        <input
                          type="text"
                          name="zipCode"
                          value={profileData.zipCode}
                          onChange={handleInputChange}
                          disabled={!isEditing}
                          className={`w-full px-5 py-4 rounded-2xl transition-all outline-none border ${isEditing ? 'bg-white border-blue-200 focus:ring-4 focus:ring-blue-100' : 'bg-slate-50 border-transparent text-slate-500'}`}
                          placeholder="11375"
                        />
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              {/* Sticky Action Bar */}
              {isEditing && (
                <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-xs text-slate-400 font-medium hidden md:block">Unsaved changes will be lost.</p>
                  <div className="flex gap-4 w-full md:w-auto">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="flex-1 md:flex-none px-8 py-3 text-slate-600 font-bold hover:bg-slate-200 rounded-2xl transition-all"
                    >
                      Discard
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 md:flex-none px-10 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-xl shadow-blue-200 transition-all active:scale-95 disabled:opacity-70"
                    >
                      {isLoading ? 'Saving...' : 'Confirm Update'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Sidebar Section */}
          <div className="space-y-6">
            <h2 className="text-xl font-black text-slate-900 px-2 uppercase tracking-tight">Your Dashboard</h2>

            <div className="space-y-4">
              {/* Order History */}
              <a href="/orders" className="flex items-center p-6 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📦</div>
                <div className="ml-5">
                  <h4 className="font-bold text-slate-900">Track Orders</h4>
                  <p className="text-xs text-slate-500">View current & past orders</p>
                </div>
              </a>

              {/* Status Badge */}
              <div className="p-8 bg-slate-900 rounded-[2rem] text-white relative overflow-hidden">
                <div className="relative z-10">
                  <span className="text-[10px] font-black tracking-[0.2em] text-blue-400 uppercase">Premium Member</span>
                  <h3 className="text-2xl font-bold mt-2">Valued Member</h3>
                  <p className="text-slate-400 text-xs mt-2 leading-relaxed">Thank you for being a part of Zippyyy. Enjoy your exclusive benefits!</p>
                </div>
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <svg className="w-24 h-24" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                </div>
              </div>

              {/* Support */}
              <div onClick={() => window.location.href = '/contact'} className="p-6 bg-blue-50 rounded-3xl border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors">
                <h4 className="font-bold text-blue-900">Need Assistance?</h4>
                <p className="text-xs text-blue-700 mt-1">Our customer concierge is available 24/7.</p>
                <div className="mt-4 text-xs font-black text-blue-600 uppercase tracking-widest">Connect Now →</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
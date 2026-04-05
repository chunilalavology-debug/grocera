import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { User, Lock, ImageIcon, Save, Upload, Trash2, Eye, EyeOff } from 'lucide-react';
import { AdminButton, AdminCard, AdminPageShell } from '../../components/admin/ui';
import { useAuth } from '../../context/AuthContext';
import AdminUserAvatar from '../../components/AdminUserAvatar';
import { resolveBrandingAssetUrl } from '../../utils/brandingAssets';

function revokeIfBlob(url) {
  if (url && String(url).startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
}

/** Merge /auth/profile into auth context (sidebar, topbar) without wiping unrelated fields. */
function shapeUserForContext(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id ?? raw._id;
  return {
    id: id != null ? String(id) : undefined,
    email: raw.email,
    role: raw.role,
    name: raw.name != null ? String(raw.name) : '',
    firstName: raw.firstName,
    lastName: raw.lastName,
    profileImageUrl: raw.profileImageUrl != null ? String(raw.profileImageUrl) : '',
    profileAvatarKey: '',
    phone: raw.phone,
    address: raw.address,
  };
}

function patchAuthUserFromProfile(data) {
  if (!data) return {};
  return {
    name: data.username != null ? String(data.username) : '',
    profileImageUrl: data.profileImageUrl != null ? String(data.profileImageUrl) : '',
    profileAvatarKey: '',
  };
}

export default function AdminProfileSettings() {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [profileImageUrl, setProfileImageUrl] = useState('');

  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [previewUrl, setPreviewUrl] = useState('');
  const [imageVersion, setImageVersion] = useState(0);
  const filePickRef = useRef(null);
  const fileInputRef = useRef(null);

  const syncAuthFromRestProfile = useCallback(async () => {
    try {
      const res = await api.get('/auth/profile');
      if (res?.success && res.user) {
        const shaped = shapeUserForContext(res.user);
        if (shaped) updateUser(shaped);
      }
    } catch {
      /* non-fatal: admin payload already updated local form */
    }
  }, [updateUser]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/profile');
      if (!res?.success) {
        toast.error(res?.message || 'Could not load profile');
        return;
      }
      if (res.data) {
        const d = res.data;
        setUsername(d.username || '');
        setProfileImageUrl(d.profileImageUrl || '');
        updateUser(patchAuthUserFromProfile(d));
        await syncAuthFromRestProfile();
      }
    } catch (e) {
      toast.error(e?.message || 'Could not load profile');
    } finally {
      setLoading(false);
    }
  }, [updateUser, syncAuthFromRestProfile]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => revokeIfBlob(previewUrl);
  }, [previewUrl]);

  const syncFromServer = async (data) => {
    if (!data) return;
    setUsername(data.username || '');
    setProfileImageUrl(data.profileImageUrl || '');
    updateUser(patchAuthUserFromProfile(data));
    setImageVersion((v) => v + 1);
    await syncAuthFromRestProfile();
  };

  const saveUsername = async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      toast.error('Username is required');
      return;
    }
    try {
      setSavingProfile(true);
      const res = await api.put('/admin/profile', { username: trimmed });
      if (!res?.success) {
        toast.error(res?.message || 'Save failed');
        return;
      }
      toast.success('Profile saved');
      await syncFromServer(res.data);
    } catch (e) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setSavingProfile(false);
    }
  };

  const pickFile = (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const okType = /^image\/(jpeg|png|webp)$/i.test(f.type);
    const okName = /\.(jpe?g|png|webp)$/i.test(f.name || '');
    if (!okType && !okName) {
      toast.error('Use a JPG, PNG, or WebP image');
      return;
    }
    revokeIfBlob(previewUrl);
    filePickRef.current = f;
    setPreviewUrl(URL.createObjectURL(f));
  };

  const uploadAvatarFile = async () => {
    const f = filePickRef.current;
    if (!f) {
      toast.error('Choose an image first');
      return;
    }
    const fd = new FormData();
    fd.append('file', f);
    try {
      setUploadingAvatar(true);
      const res = await api.post('/admin/profile/upload-avatar', fd);
      if (!res?.success) {
        toast.error(res?.message || 'Upload failed');
        return;
      }
      toast.success('Photo updated');
      filePickRef.current = null;
      revokeIfBlob(previewUrl);
      setPreviewUrl('');
      await syncFromServer(res.data);
    } catch (e) {
      toast.error(e?.message || 'Upload failed');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    try {
      setSavingProfile(true);
      const res = await api.put('/admin/profile', { removeAvatar: true });
      if (!res?.success) {
        toast.error(res?.message || 'Could not remove photo');
        return;
      }
      toast.success('Photo removed');
      filePickRef.current = null;
      revokeIfBlob(previewUrl);
      setPreviewUrl('');
      await syncFromServer(res.data);
    } catch (e) {
      toast.error(e?.message || 'Could not remove photo');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    try {
      setSavingPassword(true);
      const res = await api.put('/admin/change-password', {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (!res?.success) {
        toast.error(res?.message || 'Could not update password');
        return;
      }
      toast.success(res.message || 'Password updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      toast.error(e?.message || 'Could not update password');
    } finally {
      setSavingPassword(false);
    }
  };

  const resolvedProfileUrl = profileImageUrl
    ? resolveBrandingAssetUrl(String(profileImageUrl).trim()) || profileImageUrl
    : '';
  const displayImageUrl = previewUrl || resolvedProfileUrl;
  const bustedImageUrl =
    displayImageUrl && !String(displayImageUrl).startsWith('blob:')
      ? `${displayImageUrl}${displayImageUrl.includes('?') ? '&' : '?'}v=${imageVersion}`
      : displayImageUrl;

  const previewUser = {
    ...user,
    name: username.trim() || user?.name,
    profileImageUrl: bustedImageUrl || '',
    profileAvatarKey: '',
  };

  return (
    <AdminPageShell
      title="Profile settings"
      description={
        <span>
          Your display name, password, and profile photo for the admin experience. Store branding is under{' '}
          <Link to="/admin/settings/general" className="font-semibold text-[#008060] hover:underline">
            General
          </Link>
          .
        </span>
      }
    >
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Loading profile…</div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-6">
          <AdminCard
            title="Profile"
            subtitle="Name shown in the admin header and sidebar."
            action={
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ecfdf5] text-[#008060]">
                <User className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
            }
          >
            <label className="admin-label" htmlFor="admin-username">
              Username
            </label>
            <input
              id="admin-username"
              type="text"
              className="admin-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="name"
              maxLength={120}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <AdminButton
                type="button"
                variant="primary"
                onClick={() => void saveUsername()}
                disabled={savingProfile}
              >
                <Save size={16} aria-hidden />
                {savingProfile ? 'Saving…' : 'Save name'}
              </AdminButton>
            </div>
          </AdminCard>

          <AdminCard
            title="Password"
            subtitle="At least 8 characters with uppercase, lowercase, and a number."
            action={
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ecfdf5] text-[#008060]">
                <Lock className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
            }
          >
            <label className="admin-label" htmlFor="admin-curr-pw">
              Current password
            </label>
            <div className="relative">
              <input
                id="admin-curr-pw"
                type={showCurrentPassword ? 'text' : 'password'}
                className="admin-field w-full pr-11"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                onClick={() => setShowCurrentPassword((v) => !v)}
                aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              </button>
            </div>
            <label className="admin-label mt-4 block" htmlFor="admin-new-pw">
              New password
            </label>
            <div className="relative">
              <input
                id="admin-new-pw"
                type={showNewPassword ? 'text' : 'password'}
                className="admin-field w-full pr-11"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                onClick={() => setShowNewPassword((v) => !v)}
                aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              </button>
            </div>
            <label className="admin-label mt-4 block" htmlFor="admin-confirm-pw">
              Confirm new password
            </label>
            <div className="relative">
              <input
                id="admin-confirm-pw"
                type={showConfirmPassword ? 'text' : 'password'}
                className="admin-field w-full pr-11"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <AdminButton
                type="button"
                variant="primary"
                onClick={() => void savePassword()}
                disabled={savingPassword}
              >
                {savingPassword ? 'Updating…' : 'Update password'}
              </AdminButton>
            </div>
          </AdminCard>

          <AdminCard
            title="Profile photo"
            subtitle="Upload a JPG, PNG, or WebP from your computer. Shown in the sidebar and top bar."
            action={
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ecfdf5] text-[#008060]">
                <ImageIcon className="h-5 w-5" strokeWidth={2} aria-hidden />
              </span>
            }
          >
            <p className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
              <span className="font-semibold text-slate-800">Recommended:</span> square image about{' '}
              <strong>200×200px</strong> (or larger, same ratio). <span className="font-semibold">Max file:</span> 3MB.
              On production (Vercel), the image is stored in your MongoDB database and served over the API; locally it may
              be saved under <code className="text-[11px]">/uploads/…</code> like store assets.
            </p>
            <div className="flex flex-wrap items-center gap-5">
              <AdminUserAvatar
                user={previewUser}
                className="admin-profile-settings-preview-avatar"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-xs font-medium text-slate-500">Preview</p>
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={pickFile}
                  />
                  <AdminButton type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                    <Upload size={16} aria-hidden />
                    Choose image
                  </AdminButton>
                  {(profileImageUrl || previewUrl) && (
                    <AdminButton
                      type="button"
                      variant="secondary"
                      onClick={() => void removeAvatar()}
                      disabled={savingProfile}
                    >
                      <Trash2 size={16} aria-hidden />
                      Remove photo
                    </AdminButton>
                  )}
                </div>
              </div>
            </div>

            {previewUrl && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <AdminButton
                  type="button"
                  variant="primary"
                  onClick={() => void uploadAvatarFile()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? 'Uploading…' : 'Save photo'}
                </AdminButton>
              </div>
            )}
          </AdminCard>
        </div>
      )}
    </AdminPageShell>
  );
}

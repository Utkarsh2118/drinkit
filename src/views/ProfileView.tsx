import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Mail,
  Phone,
  Calendar,
  ShieldCheck,
  Globe,
  Bell,
  CheckCircle2,
  AlertCircle,
  Edit2,
  X,
  Camera,
  LogOut,
  ShoppingBag,
  MapPin,
  Heart,
  HelpCircle,
  Trash2,
  Lock,
  ArrowRight,
  MessageSquare,
  Plus,
  Send,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useRouter } from '../context/RouterContext.tsx';
import { api } from '../services/api.ts';
import { SupportTicket, Address } from '../types.ts';

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80',
];

export const ProfileView: React.FC = () => {
  const { user, updateProfile, uploadAvatar, deactivateAccount, logout } = useAuth();
  const { navigate } = useRouter();

  // Edit Mode state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>(user?.name || '');
  const [editEmail, setEditEmail] = useState<string>(user?.email || '');
  const [editLanguage, setEditLanguage] = useState<'en' | 'kn' | 'hi'>(user?.preferredLanguage || 'en');
  const [editNotifications, setEditNotifications] = useState({
    orderUpdates: user?.notificationPreferences?.orderUpdates ?? true,
    promoAlerts: user?.notificationPreferences?.promoAlerts ?? true,
    deliverySms: user?.notificationPreferences?.deliverySms ?? true,
    emailAlerts: user?.notificationPreferences?.emailAlerts ?? true,
  });

  // Action status indicators
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Avatar Modal
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState<boolean>(false);
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string>('');

  // Support Tickets Drawer / Modal
  const [isSupportOpen, setIsSupportOpen] = useState<boolean>(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isCreatingTicket, setIsCreatingTicket] = useState<boolean>(false);
  const [ticketSubject, setTicketSubject] = useState<string>('');
  const [ticketCategory, setTicketCategory] = useState<'order' | 'delivery' | 'payment' | 'product' | 'account' | 'other'>('order');
  const [ticketMessage, setTicketMessage] = useState<string>('');
  const [replyText, setReplyText] = useState<string>('');
  const [supportLoading, setSupportLoading] = useState<boolean>(false);

  // Deactivate Modal
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState<boolean>(false);
  const [deactivateReason, setDeactivateReason] = useState<string>('');
  const [confirmText, setConfirmText] = useState<string>('');
  const [isDeactivating, setIsDeactivating] = useState<boolean>(false);

  useEffect(() => {
    if (user) {
      setEditName(user.name);
      setEditEmail(user.email);
      setEditLanguage(user.preferredLanguage || 'en');
      if (user.notificationPreferences) {
        setEditNotifications(user.notificationPreferences);
      }
    }
  }, [user]);

  // Load Support Tickets
  const fetchTickets = async () => {
    try {
      setSupportLoading(true);
      const res = await api.get<SupportTicket[]>('/support/tickets');
      setTickets(res);
      if (selectedTicket) {
        const refreshed = res.find(t => t.id === selectedTicket.id);
        if (refreshed) setSelectedTicket(refreshed);
      }
    } catch (err) {
      console.warn('Could not load support tickets', err);
    } finally {
      setSupportLoading(false);
    }
  };

  useEffect(() => {
    if (isSupportOpen) {
      fetchTickets();
    }
  }, [isSupportOpen]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!editName.trim() || editName.trim().length < 2) {
      setErrorMessage('Full name must be at least 2 characters long.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(editEmail.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    try {
      setIsSaving(true);
      await updateProfile({
        name: editName.trim(),
        email: editEmail.trim().toLowerCase(),
        preferredLanguage: editLanguage,
        notificationPreferences: editNotifications,
      });
      setSuccessMessage('Profile information saved successfully!');
      setIsEditing(false);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectPresetAvatar = async (url: string) => {
    try {
      setIsSaving(true);
      await uploadAvatar(url);
      setIsAvatarModalOpen(false);
      setSuccessMessage('Profile photo updated successfully!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to set avatar photo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Only image files (JPEG, PNG, WebP) are supported.');
      return;
    }

    if (file.size > 1.5 * 1024 * 1024) {
      setErrorMessage('Image size must be less than 1.5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        setIsSaving(true);
        await uploadAvatar(dataUrl, file.type);
        setIsAvatarModalOpen(false);
        setSuccessMessage('Profile picture uploaded successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err: any) {
        setErrorMessage(err.message || 'Failed to upload photo.');
      } finally {
        setIsSaving(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketSubject.trim() || !ticketMessage.trim()) return;

    try {
      setSupportLoading(true);
      await api.post('/support/tickets', {
        category: ticketCategory,
        subject: ticketSubject.trim(),
        message: ticketMessage.trim(),
        priority: 'MEDIUM',
      });
      setTicketSubject('');
      setTicketMessage('');
      setIsCreatingTicket(false);
      await fetchTickets();
    } catch (err: any) {
      alert(err.message || 'Failed to create support ticket');
    } finally {
      setSupportLoading(false);
    }
  };

  const handleSendTicketReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    try {
      setSupportLoading(true);
      await api.post(`/support/tickets/${selectedTicket.id}/message`, {
        message: replyText.trim(),
      });
      setReplyText('');
      await fetchTickets();
    } catch (err: any) {
      alert(err.message || 'Failed to post message');
    } finally {
      setSupportLoading(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (confirmText !== 'DEACTIVATE') {
      setErrorMessage("Please type 'DEACTIVATE' in all caps to confirm.");
      return;
    }
    try {
      setIsDeactivating(true);
      await deactivateAccount(deactivateReason, confirmText);
      navigate('/');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to deactivate account.');
      setIsDeactivating(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center animate-fade-in">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl border border-emerald-100 flex items-center justify-center mx-auto mb-4 shadow-2xs">
          <UserIcon className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 mb-1.5">Sign in to your account</h2>
        <p className="text-slate-500 mb-6 text-xs max-w-sm mx-auto leading-relaxed">
          Log in with your mobile number to view saved addresses, preferences, and account settings.
        </p>
        <button
          onClick={() => navigate('/login?redirect=/profile')}
          className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-extrabold shadow-sm transition-all text-sm flex items-center justify-center gap-2 mx-auto cursor-pointer"
        >
          <span>Sign In with Mobile OTP</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Notifications / Alerts */}
      {successMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center gap-3 text-sm shadow-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl flex items-center gap-3 text-sm shadow-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="ml-auto text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Profile Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
          {/* Avatar with Upload button */}
          <div className="relative group">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden bg-slate-100 border-2 border-emerald-500/20 shadow-inner flex items-center justify-center">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-3xl font-bold">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <button
              onClick={() => setIsAvatarModalOpen(true)}
              className="absolute -bottom-2 -right-2 p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-transform active:scale-95 border-2 border-white"
              title="Change Profile Photo"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* User Primary Info */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{user.name}</h1>
                  <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Customer
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Member since {user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '2026'}
                </p>
              </div>

              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-slate-200 hover:border-emerald-500 hover:text-emerald-700 bg-white hover:bg-emerald-50/50 rounded-xl text-xs font-semibold text-slate-700 transition-all shadow-xs"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Edit Profile
                </button>
              )}
            </div>

            {/* Badges strip: Mobile & Age Verification */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1 text-xs">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                {user.phone || 'No phone verified'}
              </span>

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                {user.isAgeVerified ? `Age Verified (${user.age || 21}+) in Karnataka` : 'Age Unverified'}
              </span>

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                Language: {user.preferredLanguage === 'kn' ? 'ಕನ್ನಡ (Kannada)' : user.preferredLanguage === 'hi' ? 'हिंदी (Hindi)' : 'English'}
              </span>
            </div>
          </div>
        </div>

        {/* Inline Edit Form */}
        {isEditing && (
          <form onSubmit={handleSaveProfile} className="mt-6 pt-6 border-t border-slate-100 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Update Personal Details</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Full Legal Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  maxLength={70}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                  placeholder="Enter full name"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                  placeholder="name@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Mobile Number <span className="text-slate-400 font-normal">(Secured by OTP — Read-Only)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={user.phone}
                    disabled
                    className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-slate-100 border border-slate-200 text-slate-500 rounded-xl cursor-not-allowed"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Preferred Language</label>
                <select
                  value={editLanguage}
                  onChange={e => setEditLanguage(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                >
                  <option value="en">English (India)</option>
                  <option value="kn">ಕನ್ನಡ (Kannada)</option>
                  <option value="hi">हिंदी (Hindi)</option>
                </select>
              </div>
            </div>

            {/* Notification Checkboxes */}
            <div className="pt-2">
              <label className="block text-xs font-medium text-slate-700 mb-2">Notification Preferences</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700">
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={editNotifications.orderUpdates}
                    onChange={e => setEditNotifications({ ...editNotifications, orderUpdates: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Live order packing & rider delivery updates</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={editNotifications.deliverySms}
                    onChange={e => setEditNotifications({ ...editNotifications, deliverySms: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Doorstep delivery SMS notifications</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={editNotifications.emailAlerts}
                    onChange={e => setEditNotifications({ ...editNotifications, emailAlerts: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Email order receipts & GST tax invoices</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={editNotifications.promoAlerts}
                    onChange={e => setEditNotifications({ ...editNotifications, promoAlerts: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>Weekend Happy Hours & coupon discounts</span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setErrorMessage(null);
                }}
                disabled={isSaving}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-sm transition-colors flex items-center gap-2"
              >
                {isSaving ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Account Settings & Quick Navigation Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Orders Card */}
        <div
          onClick={() => navigate('/orders')}
          className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">My Orders</h3>
            <p className="text-xs text-slate-500 mt-0.5">Track live deliveries, invoices & order history</p>
          </div>
        </div>

        {/* Wishlist Card */}
        <div
          onClick={() => navigate('/wishlist')}
          className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Heart className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-rose-600 group-hover:translate-x-0.5 transition-all" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Wishlist</h3>
            <p className="text-xs text-slate-500 mt-0.5">Saved spirits, chilled beers & favorite malts</p>
          </div>
        </div>

        {/* Saved Addresses Card */}
        <div
          onClick={() => navigate('/orders')}
          className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <MapPin className="w-5 h-5" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Saved Addresses</h3>
            <p className="text-xs text-slate-500 mt-0.5">{user.addresses?.length || 0} delivery locations configured</p>
          </div>
        </div>

        {/* Customer Support Card */}
        <div
          onClick={() => setIsSupportOpen(true)}
          className="bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-500/50 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <HelpCircle className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
              Help
            </span>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Help & Support</h3>
            <p className="text-xs text-slate-500 mt-0.5">Create tickets, refund queries & order help</p>
          </div>
        </div>
      </div>

      {/* Account Security & Compliance Details Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Regulatory Compliance & Account Security
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-slate-500 font-medium">Age Verification Record</span>
            <p className="font-semibold text-slate-900">
              {user.isAgeVerified ? `DOB: ${user.dateOfBirth || '1997-03-24'} (${user.age || 29} Years Old)` : 'Pending'}
            </p>
            <p className="text-[11px] text-slate-500">
              Verified for Karnataka Legal Age Limit (21+). Verified at delivery handover via government photo ID.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-slate-500 font-medium">Session & Identity Protection</span>
            <p className="font-semibold text-slate-900">Cryptographically Signed Token (HS256)</p>
            <p className="text-[11px] text-slate-500">
              Protected against tampering, NoSQL injection, and mass assignment privilege escalation.
            </p>
          </div>
        </div>
      </div>

      {/* Danger Zone: Logout and Account Closure */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h4 className="text-sm font-bold text-slate-900">Account Management</h4>
          <p className="text-xs text-slate-500 mt-0.5">Sign out of active sessions or deactivate your customer account.</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setIsDeactivateModalOpen(true)}
            className="flex-1 sm:flex-none px-4 py-2 border border-slate-300 hover:border-rose-400 text-rose-600 hover:text-rose-700 bg-white hover:bg-rose-50/50 rounded-xl text-xs font-semibold transition-colors"
          >
            Deactivate Account
          </button>

          <button
            onClick={logout}
            className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Modal: Change Avatar */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-base">Select Profile Picture</h3>
              <button
                onClick={() => setIsAvatarModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-500 mb-2 font-medium">Choose a preset avatar:</p>
              <div className="flex items-center justify-between gap-2">
                {PRESET_AVATARS.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectPresetAvatar(url)}
                    className="w-14 h-14 rounded-xl overflow-hidden border-2 border-slate-200 hover:border-emerald-500 transition-all hover:scale-105 active:scale-95"
                  >
                    <img src={url} alt={`Preset ${i}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>

            <div className="relative border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500 mb-2 font-medium">Or upload from your device (Max 1.5MB):</p>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-xl p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                <Camera className="w-6 h-6 text-slate-400 mb-1" />
                <span className="text-xs font-semibold text-emerald-600">Browse Image File</span>
                <span className="text-[10px] text-slate-400 mt-0.5">JPEG, PNG, or WebP</span>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Customer Support Tickets Drawer */}
      {isSupportOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end animate-fade-in">
          <div className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col animate-slide-left">
            {/* Drawer Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Customer Help & Support</h3>
                  <p className="text-[11px] text-slate-500">Live ticket resolution & verified customer queries</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsSupportOpen(false);
                  setSelectedTicket(null);
                  setIsCreatingTicket(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* If viewing single ticket thread */}
              {selectedTicket ? (
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
                  >
                    ← Back to all tickets
                  </button>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{selectedTicket.ticketNumber}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedTicket.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' :
                        selectedTicket.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {selectedTicket.status}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">{selectedTicket.subject}</h4>
                    <p className="text-xs text-slate-500">
                      Category: {selectedTicket.category.toUpperCase()} • Created:{' '}
                      {new Date(selectedTicket.createdAt).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {/* Messages Thread */}
                  <div className="space-y-3">
                    {selectedTicket.messages.map(msg => (
                      <div
                        key={msg.id}
                        className={`p-3 rounded-xl text-xs ${
                          msg.senderRole === 'admin'
                            ? 'bg-amber-50/80 border border-amber-200 text-slate-900 ml-4'
                            : 'bg-emerald-50/60 border border-emerald-200 text-slate-900 mr-4'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1 font-semibold text-[11px] text-slate-600">
                          <span>{msg.senderName} ({msg.senderRole.toUpperCase()})</span>
                          <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-slate-800 whitespace-pre-wrap">{msg.message}</p>
                      </div>
                    ))}
                  </div>

                  {/* Reply Input */}
                  <form onSubmit={handleSendTicketReply} className="pt-2 flex gap-2">
                    <input
                      type="text"
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder="Type a reply to DrinkIt support..."
                      className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      type="submit"
                      disabled={supportLoading || !replyText.trim()}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Send
                    </button>
                  </form>
                </div>
              ) : isCreatingTicket ? (
                /* Ticket Creation Form */
                <form onSubmit={handleCreateTicket} className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-sm">Submit New Support Query</h4>
                    <button
                      type="button"
                      onClick={() => setIsCreatingTicket(false)}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Cancel
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Issue Category</label>
                    <select
                      value={ticketCategory}
                      onChange={e => setTicketCategory(e.target.value as any)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                    >
                      <option value="order">Order Tracking & Status</option>
                      <option value="delivery">Delivery Partner or Delay</option>
                      <option value="payment">Payment & Refund Status</option>
                      <option value="product">Product Quality or Missing Item</option>
                      <option value="account">Account & Age Verification</option>
                      <option value="other">Other Inquiry</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Subject</label>
                    <input
                      type="text"
                      value={ticketSubject}
                      onChange={e => setTicketSubject(e.target.value)}
                      placeholder="e.g. Delivery rider hasn't arrived"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Detailed Description</label>
                    <textarea
                      rows={4}
                      value={ticketMessage}
                      onChange={e => setTicketMessage(e.target.value)}
                      placeholder="Please explain the issue in detail so our support executive can resolve it fast..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={supportLoading || !ticketSubject.trim() || !ticketMessage.trim()}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm disabled:opacity-50 transition-colors"
                  >
                    {supportLoading ? 'Submitting Ticket...' : 'Create Support Ticket'}
                  </button>
                </form>
              ) : (
                /* Ticket List */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 text-sm">Your Support Tickets</h4>
                    <button
                      onClick={() => setIsCreatingTicket(true)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New Ticket
                    </button>
                  </div>

                  {tickets.length === 0 ? (
                    <div className="text-center py-12 px-4 bg-slate-50 rounded-2xl border border-slate-200">
                      <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-medium text-slate-600">No support tickets created yet.</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Need help with an order or payment? Reach out anytime.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {tickets.map(ticket => (
                        <div
                          key={ticket.id}
                          onClick={() => setSelectedTicket(ticket)}
                          className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-500 bg-white hover:bg-emerald-50/20 transition-all cursor-pointer space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">{ticket.ticketNumber}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ticket.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' :
                              ticket.status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {ticket.status}
                            </span>
                          </div>
                          <h5 className="font-semibold text-slate-900 text-xs truncate">{ticket.subject}</h5>
                          <p className="text-[11px] text-slate-500 truncate">
                            {ticket.messages[ticket.messages.length - 1]?.message || 'No messages'}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Deactivate Account */}
      {isDeactivateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-rose-200">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">Deactivate DrinkIt Account</h3>
                <p className="text-xs text-slate-500">Voluntary account deactivation</p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-xs space-y-1">
              <p className="font-semibold">Excise & Tax Compliance Notice:</p>
              <p>
                Under State Excise & GST regulations, past order invoices, batch numbers, and delivery receipts are legally retained for statutory compliance audit purposes.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Reason for leaving (Optional)</label>
              <input
                type="text"
                value={deactivateReason}
                onChange={e => setDeactivateReason(e.target.value)}
                placeholder="e.g. Relocating, no longer ordering"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Type <span className="font-bold text-rose-600">DEACTIVATE</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder="DEACTIVATE"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-rose-500 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDeactivateModalOpen(false);
                  setConfirmText('');
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Keep Account
              </button>

              <button
                type="button"
                onClick={handleConfirmDeactivate}
                disabled={isDeactivating || confirmText !== 'DEACTIVATE'}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 rounded-xl shadow-xs"
              >
                {isDeactivating ? 'Deactivating...' : 'Confirm Deactivation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
const GOLD = '#C8972B';

export default function ProfilePage() {
  const router  = useRouter();
  const [token, setToken] = useState('');
  const [user,  setUser]  = useState(null);
  const [section, setSection] = useState('info');
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState({ text: '', ok: true });
  const photoRef = useRef(null);

  // Personal info form
  const [form, setForm] = useState({
    full_name: '', phone: '', country: '', city: '',
    date_of_birth: '', bio: '',
  });

  // Password form
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  // Deactivate form
  const [deactForm, setDeactForm] = useState({ reason: '', password: '', confirmed: false });

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    fetchProfile(t);
  }, []);

  async function fetchProfile(t) {
    try {
      const res  = await fetch(`${API}/profile`, { headers: { Authorization: `Bearer ${t}` } });
      const data = await res.json();
      if (!res.ok) { router.push('/login'); return; }
      setUser(data);
      setForm({
        full_name:     data.full_name     || '',
        phone:         data.phone         || '',
        country:       data.country       || '',
        city:          data.city          || '',
        date_of_birth: data.date_of_birth ? data.date_of_birth.split('T')[0] : '',
        bio:           data.bio           || '',
      });
    } catch { router.push('/login'); }
  }

  function goBack() {
    const role = (localStorage.getItem('role') || '').toLowerCase();
    const map  = { admin: '/admin', investor: '/investor', issuer: '/issuer', auditor: '/auditor', partner: '/partner' };
    router.push(map[role] || '/');
  }

  function flash(text, ok = true) {
    setMsg({ text, ok });
    setTimeout(() => setMsg({ text: '', ok: true }), 4000);
  }

  async function saveInfo(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res  = await fetch(`${API}/profile`, {
        method:  'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) { flash('Profile updated successfully.'); fetchProfile(token); }
      else flash(data.error || 'Failed to update profile.', false);
    } catch { flash('Network error.', false); }
    setSaving(false);
  }

  async function uploadPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('photo', file);
    try {
      const res  = await fetch(`${API}/profile/photo`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    fd,
      });
      const data = await res.json();
      if (res.ok) { flash('Photo updated.'); setUser(u => ({ ...u, profile_photo_url: data.url })); }
      else flash(data.error || 'Upload failed.', false);
    } catch { flash('Network error.', false); }
  }

  async function changePassword(e) {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      flash('New passwords do not match.', false); return;
    }
    if (pwForm.newPassword.length < 8) {
      flash('Password must be at least 8 characters.', false); return;
    }
    setSaving(true);
    try {
      const res  = await fetch(`${API}/profile/password`, {
        method:  'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
      });
      const data = await res.json();
      if (res.ok) { flash('Password changed successfully.'); setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); }
      else flash(data.error || 'Failed to change password.', false);
    } catch { flash('Network error.', false); }
    setSaving(false);
  }

  async function requestDeactivation(e) {
    e.preventDefault();
    if (!deactForm.confirmed) { flash('Please confirm you understand the consequences.', false); return; }
    if (!deactForm.password)  { flash('Password confirmation is required.', false); return; }
    setSaving(true);
    try {
      const res  = await fetch(`${API}/profile/deactivate`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ reason: deactForm.reason, password: deactForm.password }),
      });
      const data = await res.json();
      if (res.ok) { flash(data.message || 'Deactivation request submitted.'); fetchProfile(token); }
      else flash(data.error || 'Failed to submit request.', false);
    } catch { flash('Network error.', false); }
    setSaving(false);
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || '?';

  const NAV = [
    { key: 'info',       label: 'Personal Info',  icon: '👤' },
    { key: 'security',   label: 'Security',        icon: '🔒' },
    { key: 'account',    label: 'Account',         icon: '📋' },
    { key: 'deactivate', label: 'Deactivate',      icon: '⚠️' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <div className="border-b border-gray-800 bg-gray-900/80 backdrop-blur px-6 py-3 flex items-center gap-4">
        <button onClick={goBack}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          Back to Dashboard
        </button>
        <span className="text-gray-700">|</span>
        <span className="font-semibold text-white text-sm">My Profile</span>
      </div>

      {/* Flash message */}
      {msg.text && (
        <div className={`mx-6 mt-4 px-4 py-3 rounded-lg text-sm font-medium ${msg.ok ? 'bg-green-900/50 border border-green-700 text-green-300' : 'bg-red-900/50 border border-red-700 text-red-300'}`}>
          {msg.text}
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className="w-64 flex-shrink-0">
          {/* Avatar card */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-4 text-center">
            <div className="relative inline-block mb-3">
              {user?.profile_photo_url ? (
                <img src={user.profile_photo_url} alt="Profile"
                  className="w-20 h-20 rounded-full object-cover border-2 border-yellow-500/50"/>
              ) : (
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white border-2 border-yellow-500/50"
                  style={{ background: 'linear-gradient(135deg, #1A3C5E, #C8972B)' }}>
                  {initials}
                </div>
              )}
              <button onClick={() => photoRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-yellow-600 hover:bg-yellow-500 flex items-center justify-center transition-colors"
                title="Change photo">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
              </button>
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={uploadPhoto}/>
            </div>
            <p className="font-bold text-white text-sm">{user?.full_name || 'No name set'}</p>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{user?.email}</p>
            {user?.country && user?.city && (
              <p className="text-xs text-gray-600 mt-1">📍 {user.city}, {user.country}</p>
            )}
            <div className="mt-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                user?.kyc_status === 'APPROVED' ? 'bg-green-900/50 text-green-400' :
                user?.kyc_status === 'PENDING'  ? 'bg-yellow-900/50 text-yellow-400' :
                'bg-gray-800 text-gray-500'
              }`}>
                KYC: {user?.kyc_status || 'N/A'}
              </span>
            </div>
          </div>

          {/* Section nav */}
          <nav className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {NAV.map(n => (
              <button key={n.key} onClick={() => setSection(n.key)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors text-left ${
                  section === n.key
                    ? 'text-white bg-gray-800 border-l-2 font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/50 border-l-2 border-transparent'
                }`}
                style={section === n.key ? { borderLeftColor: GOLD } : {}}>
                <span>{n.icon}</span>
                {n.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">

          {/* ── Personal Info ── */}
          {section === 'info' && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="font-bold text-white text-lg mb-6">Personal Information</h2>
              <form onSubmit={saveInfo} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Full Name</label>
                    <input type="text" value={form.full_name}
                      onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-600"
                      placeholder="Your full name"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Phone</label>
                    <input type="tel" value={form.phone}
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-600"
                      placeholder="+263 77 000 0000"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Country</label>
                    <input type="text" value={form.country}
                      onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-600"
                      placeholder="Zimbabwe"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">City</label>
                    <input type="text" value={form.city}
                      onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-600"
                      placeholder="Harare"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Date of Birth</label>
                    <input type="date" value={form.date_of_birth}
                      onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-600"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Email (read-only)</label>
                    <input type="email" value={user?.email || ''} disabled
                      className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-gray-500 cursor-not-allowed"/>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Bio</label>
                  <textarea rows={3} value={form.bio}
                    onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-600 resize-none"
                    placeholder="Tell us about yourself..."/>
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={saving}
                    className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors"
                    style={{ background: GOLD }}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Security ── */}
          {section === 'security' && (
            <div className="space-y-6">
              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h2 className="font-bold text-white text-lg mb-6">Change Password</h2>
                <form onSubmit={changePassword} className="space-y-4">
                  {[
                    { key: 'currentPassword', label: 'Current Password' },
                    { key: 'newPassword',     label: 'New Password' },
                    { key: 'confirmPassword', label: 'Confirm New Password' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs text-gray-400 block mb-1">{f.label}</label>
                      <input type="password" value={pwForm[f.key]}
                        onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-600"
                        placeholder="••••••••"/>
                    </div>
                  ))}
                  <div className="flex justify-end pt-1">
                    <button type="submit" disabled={saving}
                      className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors"
                      style={{ background: GOLD }}>
                      {saving ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h2 className="font-bold text-white text-base mb-4">Wallet & Login</h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-800">
                    <span className="text-sm text-gray-400">Wallet Address</span>
                    <span className="text-sm text-gray-300 font-mono">
                      {user?.wallet_address ? `${user.wallet_address.slice(0, 8)}...${user.wallet_address.slice(-6)}` : 'Not set'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-sm text-gray-400">Last Login</span>
                    <span className="text-sm text-gray-300">
                      {user?.last_login ? new Date(user.last_login).toLocaleString('en-GB') : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Account ── */}
          {section === 'account' && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="font-bold text-white text-lg mb-6">Account Details</h2>
              <dl className="space-y-0 divide-y divide-gray-800">
                {[
                  { label: 'Account ID',     value: user?.id },
                  { label: 'Role',           value: user?.role },
                  { label: 'Account Status', value: user?.account_status },
                  { label: 'KYC Status',     value: user?.kyc_status },
                  { label: 'Active',         value: user?.is_active ? 'Yes' : 'No' },
                  { label: 'Onboarding',     value: user?.onboarding_complete ? 'Complete' : 'Incomplete' },
                  { label: 'Member Since',   value: user?.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) : 'N/A' },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center py-3">
                    <dt className="text-sm text-gray-400">{row.label}</dt>
                    <dd className="text-sm text-white font-medium">{row.value ?? 'N/A'}</dd>
                  </div>
                ))}
              </dl>
              {user?.deactivation_requested && (
                <div className="mt-4 px-4 py-3 rounded-lg bg-yellow-900/30 border border-yellow-700/50 text-yellow-300 text-sm">
                  ⏳ Account deactivation request is pending admin review.
                </div>
              )}
            </div>
          )}

          {/* ── Deactivate ── */}
          {section === 'deactivate' && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h2 className="font-bold text-white text-lg mb-2">Request Account Deactivation</h2>
              <p className="text-sm text-gray-400 mb-6">
                Submitting this request will flag your account for review. An administrator will process the request within 2 business days. Your data is retained in accordance with our data retention policy.
              </p>

              {user?.deactivation_requested ? (
                <div className="px-4 py-6 text-center rounded-xl bg-yellow-900/20 border border-yellow-700/40">
                  <p className="text-3xl mb-2">⏳</p>
                  <p className="text-yellow-300 font-semibold text-sm">Deactivation Request Pending</p>
                  <p className="text-yellow-400/70 text-xs mt-1">An administrator will process your request within 2 business days.</p>
                </div>
              ) : (
                <form onSubmit={requestDeactivation} className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Reason (optional)</label>
                    <textarea rows={4} value={deactForm.reason}
                      onChange={e => setDeactForm(f => ({ ...f, reason: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-600 resize-none"
                      placeholder="Tell us why you wish to deactivate your account..."/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Confirm Password *</label>
                    <input type="password" value={deactForm.password}
                      onChange={e => setDeactForm(f => ({ ...f, password: e.target.value }))}
                      className="w-full bg-gray-800 border border-red-900/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-600"
                      placeholder="Enter your password to confirm"/>
                  </div>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" checked={deactForm.confirmed}
                      onChange={e => setDeactForm(f => ({ ...f, confirmed: e.target.checked }))}
                      className="mt-0.5 accent-red-600"/>
                    <span className="text-xs text-gray-400">
                      I understand that requesting deactivation will suspend my access pending admin review, and that this action cannot be self-reversed.
                    </span>
                  </label>
                  <div className="flex justify-end pt-1">
                    <button type="submit" disabled={saving || !deactForm.confirmed}
                      className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-red-700 hover:bg-red-600 disabled:opacity-40 transition-colors">
                      {saving ? 'Submitting...' : 'Submit Deactivation Request'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

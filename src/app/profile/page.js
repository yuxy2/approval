'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error('Error fetching user:', err);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [router]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (newPassword !== confirmPassword) {
      setErrorMsg('Kata sandi baru dan konfirmasi kata sandi tidak cocok');
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg('Kata sandi baru harus minimal 6 karakter');
      return;
    }

    setFormLoading(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(data.message || 'Kata sandi berhasil diperbarui!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowCurrent(false);
        setShowNew(false);
        setShowConfirm(false);
      } else {
        setErrorMsg(data.error || 'Gagal mengubah kata sandi');
      }
    } catch (err) {
      console.error('Change password error:', err);
      setErrorMsg('Terjadi kesalahan jaringan. Silakan coba lagi.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/login');
        router.refresh();
      }
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center min-h-[70vh]">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#8B1A1A] border-r-transparent"></div>
        <p className="mt-4 text-xs text-slate-500 font-light">Memuat profil pengguna...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col w-full bg-slate-50">
      {/* Sticky Header / Navbar */}
      <header className="border-b border-slate-200 bg-white/85 backdrop-blur-md sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="/ee-logo-horizontal.svg" alt="Elevate Equity Logo" className="h-7 sm:h-9 object-contain" />
          </Link>

          <div className="flex items-center gap-2 sm:gap-4">
            {user && (
              <div className="flex items-center gap-2 sm:gap-4">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center bg-white border border-slate-200 hover:border-slate-350 text-slate-600 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded transition shadow-sm"
                >
                  ← <span className="hidden sm:inline ml-1">Kembali ke</span> Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center bg-white border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-semibold px-2.5 sm:px-3 py-1.5 rounded transition shadow-sm cursor-pointer"
                >
                  Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 w-full max-w-3xl mx-auto px-4 py-12 text-slate-900 space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif text-slate-950 font-medium tracking-wide uppercase">
            Profil Akun Pengguna
          </h1>
          <p className="text-xs text-slate-500 font-light mt-1 tracking-wider">
            Kelola kredensial akun dan keamanan kata sandi Anda
          </p>
        </div>

        {/* Profile Info Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
            Rincian Pengguna
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Nama Lengkap</span>
              <span className="font-semibold text-slate-800 block">{user?.name}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Alamat Email</span>
              <span className="font-semibold text-slate-800 block">{user?.email}</span>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Peran Hak Akses</span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-rose-50 text-[#8B1A1A] border border-[#8B1A1A]/10 uppercase tracking-wider mt-1">
                {user?.role === 'superadmin' ? 'Superadmin' : user?.role === 'contractor' ? 'Kontraktor' : 'Manajer Proyek (PM)'}
              </span>
            </div>
          </div>
        </div>

        {/* Change Password Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-2">
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
              Ubah Kata Sandi
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-light">
              Masukkan kata sandi saat ini dan tentukan kata sandi baru yang aman.
            </p>
          </div>

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-250 rounded-lg text-xs text-emerald-800 font-medium">
              ✅ {successMsg}
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-250 rounded-lg text-xs text-rose-800 font-medium animate-pulse">
              ⚠️ {errorMsg}
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
               <div>
                 <label htmlFor="current-pass" className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                   Kata Sandi Saat Ini
                 </label>
                 <div className="relative">
                   <input
                     id="current-pass"
                     type={showCurrent ? "text" : "password"}
                     required
                     value={currentPassword}
                     onChange={(e) => setCurrentPassword(e.target.value)}
                     placeholder="••••••••"
                     className="w-full bg-white border border-slate-200 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg pl-4 pr-10 py-2.5 text-sm text-slate-900 outline-none transition"
                   />
                   <button
                     type="button"
                     onClick={() => setShowCurrent(!showCurrent)}
                     className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#8B1A1A] focus:outline-none cursor-pointer"
                   >
                     {showCurrent ? (
                       <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                       </svg>
                     ) : (
                       <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                       </svg>
                     )}
                   </button>
                 </div>
               </div>

               <div>
                 <label htmlFor="new-pass" className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                   Kata Sandi Baru
                 </label>
                 <div className="relative">
                   <input
                     id="new-pass"
                     type={showNew ? "text" : "password"}
                     required
                     value={newPassword}
                     onChange={(e) => setNewPassword(e.target.value)}
                     placeholder="•••••••• (Minimal 6 karakter)"
                     className="w-full bg-white border border-slate-200 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg pl-4 pr-10 py-2.5 text-sm text-slate-900 outline-none transition"
                   />
                   <button
                     type="button"
                     onClick={() => setShowNew(!showNew)}
                     className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#8B1A1A] focus:outline-none cursor-pointer"
                   >
                     {showNew ? (
                       <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                       </svg>
                     ) : (
                       <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                       </svg>
                     )}
                   </button>
                 </div>
               </div>

               <div>
                 <label htmlFor="confirm-pass" className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                   Konfirmasi Kata Sandi Baru
                 </label>
                 <div className="relative">
                   <input
                     id="confirm-pass"
                     type={showConfirm ? "text" : "password"}
                     required
                     value={confirmPassword}
                     onChange={(e) => setConfirmPassword(e.target.value)}
                     placeholder="••••••••"
                     className="w-full bg-white border border-slate-200 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg pl-4 pr-10 py-2.5 text-sm text-slate-900 outline-none transition"
                   />
                   <button
                     type="button"
                     onClick={() => setShowConfirm(!showConfirm)}
                     className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#8B1A1A] focus:outline-none cursor-pointer"
                   >
                     {showConfirm ? (
                       <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                       </svg>
                     ) : (
                       <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                       </svg>
                     )}
                   </button>
                 </div>
               </div>
             </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <Link
                href="/"
                className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-600 transition"
              >
                Batal
              </Link>
              <button
                type="submit"
                disabled={formLoading}
                className="px-6 py-2.5 bg-[#8B1A1A] hover:bg-[#C0392B] text-white rounded-lg text-xs font-semibold shadow-md transition disabled:opacity-50 cursor-pointer"
              >
                {formLoading ? 'Menyimpan...' : 'Perbarui Kata Sandi'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

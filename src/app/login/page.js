'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password states
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        router.push('/');
        router.refresh();
      } else {
        setError(data.error || 'Gagal masuk. Silakan periksa kredensial Anda.');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Terjadi kesalahan jaringan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setForgotSuccess('');
    setForgotError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setForgotSuccess(data.message || 'Permintaan berhasil dikirimkan ke Superadmin.');
        setForgotEmail('');
      } else {
        setForgotError(data.error || 'Gagal mengirimkan permintaan.');
      }
    } catch (err) {
      console.error('Forgot password error:', err);
      setForgotError('Terjadi kesalahan jaringan. Silakan coba lagi.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center min-h-[80vh] px-4 py-12 sm:px-6 lg:px-8 bg-slate-50 relative overflow-hidden">
      {/* Background Decorative Gradient Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#8B1A1A]/5 blur-3xl -z-10"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#8B1A1A]/5 blur-3xl -z-10"></div>

      <div className="w-full max-w-md space-y-8 p-8 sm:p-10 rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-md shadow-xl transition-all duration-300 hover:shadow-2xl">
        <div className="text-center relative">
          <div className="flex justify-center mb-4">
            <img src="/ee-logo-horizontal.svg" alt="Elevate Equity Logo" className="h-10 object-contain" />
          </div>
          <h2 className="mt-2 text-2xl font-serif font-medium tracking-wide text-slate-950 uppercase">
            Masuk ke Portal
          </h2>
          <p className="mt-1.5 text-xs text-slate-500 font-light tracking-wide">
            "Elevate Equity"
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium animate-pulse">
            ⚠️ {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                Alamat Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pm@eeq.co.nz"
                className="w-full bg-white border border-slate-200 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-2.5 text-sm text-slate-900 outline-none transition-all duration-200 shadow-sm"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Kata Sandi
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotSuccess('');
                    setForgotError('');
                    setShowForgotModal(true);
                  }}
                  className="text-xs text-[#8B1A1A] hover:underline font-semibold cursor-pointer"
                >
                  Lupa Kata Sandi?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border border-slate-200 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg pl-4 pr-10 py-2.5 text-sm text-slate-900 outline-none transition-all duration-200 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#8B1A1A] focus:outline-none cursor-pointer"
                >
                  {showPassword ? (
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

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-xs font-bold uppercase tracking-widest rounded-lg text-white bg-[#8B1A1A] hover:bg-[#C0392B] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#8B1A1A] transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-[1px] cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-r-transparent"></span>
                  Memproses Masuk...
                </span>
              ) : (
                'Masuk'
              )}
            </button>
          </div>
        </form>

        <div className="text-center pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-400 font-light">
            Hubungi administrator untuk meminta pembuatan akun.
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-150 pb-3">
              <h3 className="font-serif text-slate-950 text-lg font-medium tracking-wide uppercase">
                Permintaan Reset Kata Sandi
              </h3>
              <button
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold p-1"
              >
                ✕
              </button>
            </div>

            {forgotSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-250 rounded-lg text-xs text-emerald-800 font-medium">
                ✅ {forgotSuccess}
              </div>
            )}

            {forgotError && (
              <div className="p-3 bg-rose-50 border border-rose-250 rounded-lg text-xs text-rose-800 font-medium">
                ⚠️ {forgotError}
              </div>
            )}

            <p className="text-xs text-slate-500 leading-relaxed">
              Masukkan alamat email Anda untuk mengajukan permohonan reset kata sandi ke **Superadmin**. Setelah disetujui, Anda akan menerima email konfirmasi berisi kata sandi sementara.
            </p>

            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wider">
                  Alamat Email
                </label>
                <input
                  id="forgot-email"
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="contractor@apartmentspecialists.co.nz"
                  className="w-full bg-white border border-slate-250 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-2 text-sm text-slate-900 outline-none transition-all"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 rounded text-xs font-semibold text-slate-600 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="px-5 py-2 bg-[#8B1A1A] hover:bg-[#C0392B] text-white rounded text-xs font-semibold shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {forgotLoading ? 'Mengirim...' : 'Kirim Permintaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

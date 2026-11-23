'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // 1. Password confirmation check
    if (password !== confirmPassword) {
      setError('Kata sandi tidak cocok');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Kata sandi harus minimal 6 karakter');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess(true);
        // Delay redirect slightly to show success feedback
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 1500);
      } else {
        setError(data.error || 'Gagal mendaftar. Silakan periksa rincian dan coba lagi.');
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError('Terjadi kesalahan jaringan. Silakan coba lagi.');
    } finally {
      if (!success) {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center min-h-[80vh] px-4 py-12 sm:px-6 lg:px-8 bg-slate-50 relative overflow-hidden">
      {/* Background Decorative Gradient Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#8B1A1A]/5 blur-3xl -z-10"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#8B1A1A]/5 blur-3xl -z-10"></div>

      <div className="w-full max-w-md space-y-6 p-8 sm:p-10 rounded-2xl border border-slate-200 bg-white/80 backdrop-blur-md shadow-xl text-center">
        <div className="flex justify-center mb-4">
          <img src="/ee-logo-horizontal.svg" alt="Elevate Equity Logo" className="h-10 object-contain" />
        </div>
        <div className="text-3xl block text-amber-500 mb-2">⚠️</div>
        <h2 className="text-xl font-serif font-semibold tracking-wide text-slate-950 uppercase">
          Pendaftaran Mandiri Dinonaktifkan
        </h2>
        <p className="text-sm text-slate-650 leading-relaxed font-light">
          Pendaftaran mandiri dinonaktifkan untuk portal Permohonan Variasi Elevate Equity.
          Semua akun pengguna internal harus dibuat secara resmi oleh Administrator Sistem.
        </p>
        <div className="pt-4 border-t border-slate-100">
          <Link
            href="/login"
            className="inline-block bg-[#8B1A1A] hover:bg-[#C0392B] text-white text-xs font-bold uppercase tracking-widest px-6 py-3 rounded-lg shadow transition"
          >
            ← Kembali ke Halaman Masuk
          </Link>
        </div>
      </div>
    </div>
  );
}

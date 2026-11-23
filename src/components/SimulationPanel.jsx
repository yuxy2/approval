'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SimulationPanel() {
  const [emails, setEmails] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const fetchEmails = async () => {
    try {
      const res = await fetch('/api/simulation/emails');
      if (res.ok) {
        const data = await res.json();
        setEmails(data);
      }
    } catch (err) {
      console.error('Error fetching simulated emails:', err);
    }
  };

  const clearInbox = async () => {
    try {
      const res = await fetch('/api/simulation/emails', { method: 'DELETE' });
      if (res.ok) {
        setEmails([]);
      }
    } catch (err) {
      console.error('Error clearing inbox:', err);
    }
  };

  useEffect(() => {
    fetchEmails();
    const interval = setInterval(fetchEmails, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-[#fafafa] border-b border-slate-200 text-xs text-slate-700 font-sans z-50 sticky top-0 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-2 w-2 rounded-full bg-[#C0392B] animate-ping"></span>
          <span className="font-bold text-[#8B1A1A] uppercase tracking-wider text-[10px]">
            🔧 Simulator Prototipe
          </span>
          <span className="text-slate-500">| Pengujian peran dalam satu peramban</span>
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/"
            className={`hover:text-[#8B1A1A] font-medium transition ${
              pathname === '/' ? 'text-[#8B1A1A] font-semibold underline underline-offset-4 decoration-[#8B1A1A]' : ''
            }`}
          >
            📋 Dashboard Utama
          </Link>
          <Link
            href="/new"
            className={`hover:text-[#8B1A1A] font-medium transition ${
              pathname === '/new' ? 'text-[#8B1A1A] font-semibold underline underline-offset-4 decoration-[#8B1A1A]' : ''
            }`}
          >
            ➕ Formulir Permohonan Baru
          </Link>

          {/* Email Inbox Toggle */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="relative px-3 py-1 bg-white border border-slate-200 hover:border-[#8B1A1A]/40 rounded flex items-center gap-1.5 transition text-[11px] font-medium text-slate-700 cursor-pointer"
          >
            ✉️ Simulasi Email
            {emails.length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#8B1A1A] text-white font-bold px-1.5 py-0.5 rounded-full text-[9px] min-w-[15px] text-center shadow-sm">
                {emails.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Simulated Email Dropdown Container */}
      {isOpen && (
        <div className="bg-white border-t border-slate-200 max-h-[300px] overflow-y-auto shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2 mb-3">
              <h4 className="font-semibold text-slate-800 flex items-center gap-2 text-sm">
                📬 Log Simulasi Kotak Keluar 
                <span className="text-xs text-slate-500 font-normal">
                  (Simulasi pemberitahuan otomatis ke PM / Klien)
                </span>
              </h4>
              {emails.length > 0 && (
                <button
                  onClick={clearInbox}
                  className="text-[10px] text-[#8B1A1A] hover:text-[#C0392B] font-semibold cursor-pointer"
                >
                  Bersihkan Kotak Masuk
                </button>
              )}
            </div>

            {emails.length === 0 ? (
              <p className="text-center py-6 text-slate-400 italic text-[11px]">
                Belum ada email yang dikirim. Ajukan permohonan untuk memicu notifikasi.
              </p>
            ) : (
              <div className="space-y-2 pb-2">
                {emails.map((email) => (
                  <div
                    key={email.id}
                    className="p-3 bg-[#fafafa] border border-slate-200 rounded-md hover:border-[#8B1A1A]/20 transition flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="bg-white px-1.5 py-0.5 rounded text-[10px] text-slate-500 border border-slate-200 font-medium">
                          Kepada: <strong className="text-slate-800 font-semibold">{email.to}</strong>
                        </span>
                        <span className="text-[10px] text-slate-450">
                          {new Date(email.sentAt).toLocaleTimeString('id-ID')}
                        </span>
                      </div>
                      <div className="text-xs text-slate-800 font-semibold flex items-center justify-between gap-2 flex-wrap">
                        <span>{email.subject}</span>
                        {email.type === 'FINAL_APPROVAL' && (
                          <span className="bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1">
                            📎 TERMASUK LAMPIRAN PDF
                          </span>
                        )}
                      </div>
                      <pre className="text-[10px] text-slate-600 font-sans whitespace-pre-wrap leading-tight mt-1 max-h-[80px] overflow-y-auto bg-white p-1.5 rounded border border-slate-150">
                        {email.body}
                      </pre>
                    </div>
                    {email.link && (
                      <div className="flex-shrink-0">
                        <a
                          href={email.link}
                          onClick={() => setIsOpen(false)}
                          className="inline-block bg-[#8B1A1A] hover:bg-[#C0392B] text-white font-bold px-3 py-1.5 rounded text-[11px] transition shadow-sm whitespace-nowrap"
                        >
                          🔗 Buka Tautan Formulir
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

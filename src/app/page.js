'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showExpiredPopup, setShowExpiredPopup] = useState(false);
  const [expiredList, setExpiredList] = useState([]);
  const [pendingResets, setPendingResets] = useState([]);

  // Search & Pagination & Superadmin reset popup states
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [showResetPopup, setShowResetPopup] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const fetchPendingResets = async () => {
    if (!user || user.role !== 'superadmin') return;
    try {
      const res = await fetch('/api/admin/password-resets');
      if (res.ok) {
        const data = await res.json();
        const resets = data.resets || [];
        setPendingResets(resets);
        if (resets.length > 0) {
          const dismissedIds = JSON.parse(sessionStorage.getItem('dismissedResetIds') || '[]');
          const hasNewResets = resets.some(r => !dismissedIds.includes(r.id));
          if (hasNewResets) {
            setShowResetPopup(true);
          }
        } else {
          setShowResetPopup(false);
        }
      }
    } catch (err) {
      console.error('Error fetching resets:', err);
    }
  };

  useEffect(() => {
    if (user?.role === 'superadmin') {
      fetchPendingResets();
      const interval = setInterval(fetchPendingResets, 5000);
      return () => clearInterval(interval);
    } else {
      setPendingResets([]);
    }
  }, [user]);

  const handleResetAction = async (id, action) => {
    try {
      const res = await fetch(`/api/admin/password-resets/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        fetchPendingResets();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to process password reset request.');
      }
    } catch (err) {
      console.error('Reset action error:', err);
    }
  };

  const isRequestExpired = (req) => {
    let activeNotifType = null;
    if (req.status === 'PENDING_PM' || req.status === 'REJECTED_TO_PM') {
      activeNotifType = ['PM_REVIEW', 'PM_ADJUST'];
    } else if (req.status === 'PENDING_CLIENT') {
      activeNotifType = ['CLIENT_SIGN_OFF'];
    }
    
    if (activeNotifType) {
      const activeNotif = req.notifications?.find(n => activeNotifType.includes(n.type));
      if (activeNotif && activeNotif.expires_at) {
        return new Date() > new Date(activeNotif.expires_at);
      }
    }
    return false;
  };

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    // Poll to keep in sync with workflow actions
    const interval = setInterval(fetchRequests, 3000);
    return () => clearInterval(interval);
  }, []);

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
        console.error('Error fetching user info:', err);
        router.push('/login');
      }
    };
    fetchUser();
  }, [router]);

  useEffect(() => {
    if (user && requests.length > 0) {
      const expiredReqs = requests.filter(req => {
        if (!isRequestExpired(req)) return false;
        return req.submitter_email?.toLowerCase() === user.email?.toLowerCase() || 
               req.pm_user?.email?.toLowerCase() === user.email?.toLowerCase();
      });

      if (expiredReqs.length > 0) {
        const alreadyShown = sessionStorage.getItem('hasShownExpiredRequestsPopup');
        if (!alreadyShown) {
          setExpiredList(expiredReqs);
          setShowExpiredPopup(true);
          sessionStorage.setItem('hasShownExpiredRequestsPopup', 'true');
        }
      }
    }
  }, [user, requests]);

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

  const getStatusBadge = (req) => {
    if (isRequestExpired(req)) {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
          Kedaluwarsa (Perlu Diajukan Ulang)
        </span>
      );
    }
    const status = req.status;
    switch (status) {
      case 'PENDING_PM':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#F5E8E8] text-[#8B1A1A] border border-[#8B1A1A]/20">
            Menunggu Tinjauan PM
          </span>
        );
      case 'PENDING_CLIENT':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            Menunggu Persetujuan Klien
          </span>
        );
      case 'REJECTED_TO_SUBMITTER':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
            Revisi ke Pemohon
          </span>
        );
      case 'REJECTED_TO_PM':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
            Revisi ke PM
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-brand-red/30">
            Variasi Disetujui
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const getActionLink = (req) => {
    if (isRequestExpired(req)) {
      return (
        <Link
          href={`/new?revisionId=${req.id}`}
          className="inline-block text-xs font-semibold bg-rose-50 border border-rose-200 hover:border-rose-300 text-rose-700 px-3.5 py-1.5 rounded transition"
        >
          Ajukan Ulang →
        </Link>
      );
    }
    // Find the latest token for PM or Client step from notifications
    const pmNotification = req.notifications?.find(n => n.type === 'PM_REVIEW' || n.type === 'PM_ADJUST');
    const clientNotification = req.notifications?.find(n => n.type === 'CLIENT_SIGN_OFF');
    
    // Status link can be accessed with any token
    const anyToken = req.notifications?.[0]?.unique_token;

    if (req.status === 'PENDING_PM' || req.status === 'REJECTED_TO_PM') {
      const pmToken = pmNotification?.unique_token || anyToken;
      if (pmToken) {
        return (
          <Link
            href={`/review/${pmToken}`}
            className="inline-block text-xs font-semibold bg-[#F5E8E8] border border-[#8B1A1A]/20 hover:border-[#8B1A1A]/40 text-[#8B1A1A] px-3.5 py-1.5 rounded transition"
          >
            {req.status === 'REJECTED_TO_PM' ? 'Penyesuaian PM →' : 'Penilaian PM →'}
          </Link>
        );
      }
    }
    
    if (req.status === 'PENDING_CLIENT') {
      const clientToken = clientNotification?.unique_token || anyToken;
      if (clientToken) {
        return (
          <Link
            href={`/approve/${clientToken}`}
            className="inline-block text-xs font-semibold bg-blue-50 border border-blue-200 hover:border-blue-300 text-blue-700 px-3.5 py-1.5 rounded transition"
          >
            Persetujuan Klien →
          </Link>
        );
      }
    }
    
    if (req.status === 'REJECTED_TO_SUBMITTER') {
      return (
        <Link
          href={`/new?revisionId=${req.id}`}
          className="inline-block text-xs font-semibold bg-rose-50 border border-rose-200 hover:border-rose-300 text-rose-700 px-3.5 py-1.5 rounded transition"
        >
          Formulir Revisi →
        </Link>
      );
    }

    if (anyToken) {
      return (
        <Link
          href={`/status/${anyToken}`}
          className="inline-block text-xs font-semibold bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 px-3.5 py-1.5 rounded transition"
        >
          Lihat Ringkasan
        </Link>
      );
    }

    return <span className="text-xs text-slate-400">-</span>;
  };

  const formatFinancialImpact = (req) => {
    // Find the PM costing event
    const pmEvent = req.workflow_events?.find(e => e.step_type === 'pm_review' && e.action === 'approve');
    if (!pmEvent) {
      if (req.status === 'PENDING_PM') {
        return <span className="text-xs text-slate-400 italic">Menunggu Tinjauan PM</span>;
      }
      return <span className="text-xs text-slate-400">Tanpa Dampak Biaya</span>;
    }
    
    if (pmEvent.financial_impact === 'none') {
      return <span className="text-xs text-slate-400">Tanpa Dampak Biaya</span>;
    }
    
    const prefix = pmEvent.financial_impact === 'increase' ? '+' : '-';
    const amount = Number(pmEvent.financial_amount) || 0;
    
    return (
      <span className={`font-semibold text-xs px-2 py-1 rounded ${
        pmEvent.financial_impact === 'increase' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
      }`}>
        {prefix}Rp {amount.toLocaleString('id-ID')}
      </span>
    );
  };

  const formatScheduleImpact = (req) => {
    const pmEvent = req.workflow_events?.find(e => e.step_type === 'pm_review' && e.action === 'approve');
    if (!pmEvent) {
      return <span className="text-slate-400">-</span>;
    }
    if (pmEvent.schedule_impact === 'none') {
      return <span className="text-slate-400">Tanpa Penundaan</span>;
    }
    const suffix = pmEvent.schedule_impact === 'adds' ? 'bertambah' : 'berkurang';
    return (
      <span className="text-xs text-slate-700 font-medium">
        {pmEvent.schedule_days} hari ({suffix})
      </span>
    );
  };

  // Apply search filtering
  const filteredRequests = React.useMemo(() => {
    return requests.filter(req => 
      (req.project_address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.submission_id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.submitter_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.submitter_role || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (req.status || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [requests, searchTerm]);

  // Paginate requests
  const paginatedRequests = React.useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredRequests.slice(startIndex, startIndex + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  return (
    <div className="flex-1 flex flex-col w-full">
      {/* Sticky Header / Navbar */}
      <header className="border-b border-slate-200 bg-white/85 backdrop-blur-md sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/ee-logo-horizontal.svg" alt="Elevate Equity Logo" className="h-9 object-contain" />
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-800">{user.name}</div>
                  <div className="text-[10px] text-slate-400 font-light">{user.email}</div>
                </div>
                <Link
                  href="/profile"
                  className="inline-flex items-center justify-center bg-white border border-slate-200 hover:border-[#8B1A1A]/30 hover:bg-red-50/50 text-[#8B1A1A] text-xs font-semibold px-3 py-1.5 rounded transition-all cursor-pointer shadow-sm"
                >
                  Profil
                </Link>
                <Link
                  href="/sheets"
                  className="inline-flex items-center justify-center bg-white border border-slate-200 hover:border-[#8B1A1A]/30 hover:bg-red-50/50 text-[#8B1A1A] text-xs font-semibold px-3 py-1.5 rounded transition-all cursor-pointer shadow-sm"
                >
                  Tampilan Spreadsheet
                </Link>
                {user.role === 'superadmin' && (
                  <Link
                    href="/manage-users"
                    className="relative inline-flex items-center justify-center bg-white border border-slate-200 hover:border-[#8B1A1A]/30 hover:bg-red-50/50 text-[#8B1A1A] text-xs font-semibold px-3 py-1.5 rounded transition-all cursor-pointer shadow-sm"
                  >
                    <span>Kelola Pengguna</span>
                    {pendingResets.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-600 text-[9px] font-bold text-white shadow-sm animate-bounce">
                        {pendingResets.length}
                      </span>
                    )}
                  </Link>
                )}
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center bg-white border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-semibold px-3 py-1.5 rounded transition-all cursor-pointer shadow-sm"
                >
                  Keluar
                </button>
              </div>
            ) : (
              <div className="h-6 w-24 bg-slate-100 animate-pulse rounded"></div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-slate-900">
      {/* Brand Header */}
      <div className="text-center mb-10 relative">
        <div className="absolute inset-0 flex items-center justify-center -z-10 opacity-5">
          <span className="font-serif text-[120px] text-[#8B1A1A] tracking-widest uppercase select-none">
            EE
          </span>
        </div>
        <div className="flex justify-center mb-4">
          <img src="/ee-logo-horizontal.svg" alt="Elevate Equity Logo" className="h-14 object-contain" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-serif text-slate-900 font-medium tracking-wide uppercase">
          Portal Permohonan Variasi
        </h1>
        <p className="text-sm text-slate-500 font-light mt-2 tracking-wider">
          "Elevate Equity"
        </p>
      </div>

      {/* Superadmin Password Reset Banner Alert */}
      {user?.role === 'superadmin' && pendingResets.length > 0 && (
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xl">🔑</span>
            <div>
              <h4 className="text-sm font-semibold text-amber-800">Permintaan Reset Kata Sandi Tertunda</h4>
              <p className="text-xs text-amber-600 mt-0.5">
                Terdapat {pendingResets.length} akun pengguna yang menunggu persetujuan reset kata sandi.
              </p>
            </div>
          </div>
          <Link
            href="/manage-users"
            className="text-xs font-bold text-amber-800 hover:text-amber-950 bg-amber-100 border border-amber-200 px-3.5 py-1.5 rounded transition shadow-sm"
          >
            Tinjau Permintaan &rarr;
          </Link>
        </div>
      )}

      {/* Action panel */}
      <div className="flex justify-between items-center mb-8 border-b border-[#eee] pb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Daftar Permohonan Aktif</h2>
          <p className="text-xs text-slate-500 font-light">Pantau status perubahan lingkup proyek</p>
        </div>
        <Link
          href="/new"
          className="inline-flex items-center gap-2 bg-[#8B1A1A] hover:bg-[#C0392B] text-white font-semibold px-5 py-2.5 rounded shadow-md transition text-sm"
        >
          <span>Buat Permohonan Variasi Baru</span>
        </Link>
      </div>

      {/* Search Bar */}
      {requests.length > 0 && (
        <div className="mb-6 max-w-md">
          <div className="relative">
            <input
              type="text"
              placeholder="Cari berdasarkan Lokasi Proyek, Pemohon, ID, atau status..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg pl-9 pr-4 py-2 focus:ring-1 focus:ring-[#8B1A1A] focus:border-[#8B1A1A] outline-none text-slate-800"
            />
            <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
          </div>
        </div>
      )}

      {/* Main list */}
      {loading ? (
        <div className="text-center py-20">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#8B1A1A] border-r-transparent"></div>
          <p className="mt-4 text-sm text-slate-500">Memuat data...</p>
        </div>
      ) : requests.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-lg border border-slate-200 bg-[#fafafa]">
          <h3 className="text-base font-semibold text-slate-700">Tidak ada permohonan ditemukan</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Mulai dengan membuat Permohonan Variasi baru dari lapangan atau manajemen sumber daya proyek.
          </p>
          <div className="mt-6">
            <Link
              href="/new"
              className="inline-flex items-center text-xs font-semibold text-[#8B1A1A] border border-[#8B1A1A]/30 hover:border-[#8B1A1A]/70 px-4 py-2 rounded transition"
            >
              Mulai Permohonan Pertama
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto glass-panel-glow rounded-lg border border-slate-200 bg-[#fafafa]">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] font-semibold">
              <tr>
                <th className="px-6 py-4">Lokasi / ID Proyek</th>
                <th className="px-6 py-4">Diajukan Oleh</th>
                <th className="px-6 py-4">Tanggal</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Dampak Biaya</th>
                <th className="px-6 py-4">Dampak Jadwal</th>
                <th className="px-6 py-4 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
              {paginatedRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500 italic">
                    Tidak ada permohonan yang sesuai dengan pencarian Anda.
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50/70 transition bg-white">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{req.project_address}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">ID: {req.submission_id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs font-medium">{req.submitter_name}</div>
                      <div className="text-[10px] text-slate-500">{req.submitter_role}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500">
                      {new Date(req.date_of_request).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(req)}</td>
                    <td className="px-6 py-4">{formatFinancialImpact(req)}</td>
                    <td className="px-6 py-4">{formatScheduleImpact(req)}</td>
                    <td className="px-6 py-4 text-right">
                      {getActionLink(req)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-600 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div>
              Menampilkan <strong>{filteredRequests.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> hingga <strong>{Math.min(currentPage * pageSize, filteredRequests.length)}</strong> dari <strong>{filteredRequests.length}</strong> data {filteredRequests.length < requests.length && `(difilter dari total ${requests.length} data)`}
            </div>
            <div className="flex items-center gap-2">
              <span>Tampilkan</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs focus:border-[#8B1A1A] outline-none shadow-sm cursor-pointer font-sans"
              >
                {[10, 15, 25].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <span>baris</span>
            </div>
          </div>

          {/* Navigation Controls */}
          {Math.ceil(filteredRequests.length / pageSize) > 1 && (
            <div className="flex items-center gap-1 select-none font-sans">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-50 disabled:hover:bg-transparent font-medium cursor-pointer transition"
              >
                ← Sebelumnya
              </button>
              {Array.from({ length: Math.ceil(filteredRequests.length / pageSize) }, (_, idx) => idx + 1).map(pageNum => (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`inline-flex items-center justify-center w-8 h-8 rounded border text-xs font-semibold cursor-pointer transition ${
                    currentPage === pageNum
                      ? 'bg-[#8B1A1A] border-[#8B1A1A] text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredRequests.length / pageSize)))}
                disabled={currentPage === Math.ceil(filteredRequests.length / pageSize)}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-50 disabled:hover:bg-transparent font-medium cursor-pointer transition"
              >
                Selanjutnya →
              </button>
            </div>
          )}
        </div>
      </>
      )}
      </div>

      {/* Expired Requests Login Notification Modal */}
      {showExpiredPopup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-lg w-full shadow-lg space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
              <span className="text-xl">⚠️</span>
              <h3 className="font-serif text-slate-900 text-lg font-medium tracking-wide uppercase">
                Permohonan Variasi Kedaluwarsa
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Permohonan variasi berikut telah melewati batas waktu dan memerlukan tindakan:
            </p>
            <div className="max-h-40 overflow-y-auto space-y-2 border border-slate-100 p-2.5 rounded bg-slate-50">
              {expiredList.map((req) => (
                <div key={req.id} className="flex justify-between items-center text-xs p-2 bg-white rounded border border-slate-200">
                  <div>
                    <div className="font-semibold text-slate-900">{req.project_address}</div>
                    <div className="text-[10px] text-slate-400">ID: {req.submission_id}</div>
                  </div>
                  {req.submitter_email?.toLowerCase() === user?.email?.toLowerCase() ? (
                    <Link
                      href={`/new?revisionId=${req.id}`}
                      onClick={() => setShowExpiredPopup(false)}
                      className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-150 px-2.5 py-1 rounded transition"
                    >
                      Ajukan Ulang Sekarang →
                    </Link>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      Pemohon Telah Diberitahu
                    </span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-rose-700 font-light leading-relaxed">
              * Permohonan yang kedaluwarsa tidak dapat disetujui atau ditolak oleh PM atau Klien. Pemohon harus mengajukan ulang untuk membuat tautan baru.
            </p>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowExpiredPopup(false)}
                className="px-6 py-2 bg-[#8B1A1A] hover:bg-[#C0392B] text-white rounded text-xs font-semibold shadow-sm transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Superadmin Password Reset Approval Centered Popup Modal */}
      {user?.role === 'superadmin' && pendingResets.length > 0 && showResetPopup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full shadow-lg space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
              <span className="text-xl">🔑</span>
              <h3 className="font-serif text-slate-900 text-lg font-medium tracking-wide uppercase">
                Permintaan Reset Kata Sandi Tertunda
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Terdapat {pendingResets.length} permintaan reset kata sandi tertunda yang menunggu persetujuan Anda.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowResetPopup(false);
                  const allIds = pendingResets.map(r => r.id);
                  sessionStorage.setItem('dismissedResetIds', JSON.stringify(allIds));
                }}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
              >
                Tutup
              </button>
              <Link
                href="/manage-users"
                className="px-4 py-2 bg-[#8B1A1A] hover:bg-[#C0392B] text-white rounded text-xs font-semibold shadow-sm transition"
              >
                Buka Manajemen Pengguna
              </Link>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

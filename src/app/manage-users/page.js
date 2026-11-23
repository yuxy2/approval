'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ManageUsers() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Search & Pagination & Password Reset requests states
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [pendingResets, setPendingResets] = useState([]);
  const [pendingResetIdToApprove, setPendingResetIdToApprove] = useState(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Modal / Form states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  // Form inputs
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('pm');
  const [formActive, setFormActive] = useState(true);
  const [showModalPassword, setShowModalPassword] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (data.user.role !== 'superadmin') {
          setError('Access Denied: Superadmin privileges required.');
          setLoading(false);
          return;
        }
        setCurrentUser(data.user);
        fetchUsers();
        fetchPendingResets();
      } catch (err) {
        console.error('Auth check error:', err);
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

  useEffect(() => {
    if (currentUser?.role === 'superadmin') {
      const interval = setInterval(fetchPendingResets, 5000);
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  const fetchPendingResets = async () => {
    try {
      const res = await fetch('/api/admin/password-resets');
      if (res.ok) {
        const data = await res.json();
        setPendingResets(data.resets || []);
      }
    } catch (err) {
      console.error('Error fetching resets:', err);
    }
  };

  const handleResetAction = async (id, action) => {
    try {
      const res = await fetch(`/api/admin/password-resets/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setSuccessMsg(`Permintaan reset kata sandi berhasil di-${action === 'approve' ? 'setujui' : 'tolak'}.`);
        fetchPendingResets();
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error || 'Gagal memproses permintaan reset kata sandi.');
      }
    } catch (err) {
      console.error('Reset action error:', err);
    }
  };

  const handleApproveClick = (resReq) => {
    const tempPassword = 'Temp' + Math.floor(1000 + Math.random() * 9000) + '!';
    const userObj = users.find(u => u.email.toLowerCase() === resReq.email.toLowerCase());
    if (userObj) {
      setEditingUser(userObj);
      setFormName(userObj.name);
      setFormEmail(userObj.email);
      setFormRole(userObj.role || 'pm');
      setFormActive(userObj.active);
      setFormPassword(tempPassword);
      setPendingResetIdToApprove(resReq.id);
      setShowEditModal(true);
    } else {
      handleResetAction(resReq.id, 'approve');
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
        fetchPendingResets();
      } else {
        const data = await res.json();
        setError(data.error || 'Gagal memuat data pengguna');
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Terjadi kesalahan saat memuat data pengguna.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          password: formPassword,
          role: formRole
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Pengguna ${formName} berhasil ditambahkan.`);
        setShowAddModal(false);
        resetForm();
        fetchUsers();
      } else {
        setError(data.error || 'Gagal menambahkan pengguna');
      }
    } catch (err) {
      setError('Terjadi kesalahan saat membuat pengguna.');
    }
  };

  const handleEditUser = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    try {
      const payload = {
        name: formName,
        email: formEmail,
        role: formRole,
        active: formActive
      };

      if (formPassword.trim() !== '') {
        payload.password = formPassword;
      }

      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        if (pendingResetIdToApprove) {
          const resetRes = await fetch(`/api/admin/password-resets/${pendingResetIdToApprove}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'approve', customPassword: formPassword }),
          });
          if (!resetRes.ok) {
            console.error('Failed to mark password reset request as approved');
          }
        }

        setSuccessMsg(pendingResetIdToApprove 
          ? `Permintaan reset kata sandi disetujui dan data pengguna diperbarui.` 
          : `Pengguna ${formName} berhasil diperbarui.`
        );
        setShowEditModal(false);
        resetForm();
        fetchUsers();
      } else {
        setError(data.error || 'Gagal memperbarui pengguna');
      }
    } catch (err) {
      setError('Terjadi kesalahan saat memperbarui pengguna.');
    }
  };

  const handleToggleActive = async (user) => {
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !user.active })
      });

      if (res.ok) {
        setSuccessMsg(`Status pengguna diperbarui.`);
        fetchUsers();
      } else {
        const data = await res.json();
        setError(data.error || 'Gagal mengubah status');
      }
    } catch (err) {
      setError('Terjadi kesalahan.');
    }
  };

  const handleDeleteUser = async (user) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus pengguna: ${user.name}? Permohonan variasi yang ditangani oleh pengguna ini akan dialihkan.`)) {
      return;
    }

    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Pengguna berhasil dihapus.`);
        fetchUsers();
      } else {
        setError(data.error || 'Gagal menghapus pengguna');
      }
    } catch (err) {
      setError('Terjadi kesalahan saat menghapus pengguna.');
    }
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormRole(user.role || 'pm');
    setFormActive(user.active);
    setFormPassword('');
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('pm');
    setFormActive(true);
    setEditingUser(null);
    setPendingResetIdToApprove(null);
    setShowModalPassword(false);
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

  // Apply search filtering
  const filteredUsers = React.useMemo(() => {
    return users.filter(u => 
      (u.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.role || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  // Paginate users
  const paginatedUsers = React.useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredUsers.slice(startIndex, startIndex + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  if (loading && users.length === 0) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-20 min-h-screen bg-slate-50">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#8B1A1A] border-r-transparent"></div>
        <p className="mt-4 text-sm text-slate-500">Memuat pengelola pengguna...</p>
      </div>
    );
  }

  if (error && users.length === 0) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-20 min-h-screen bg-slate-50 text-slate-900">
        <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg shadow max-w-md text-center">
          <span className="text-3xl block mb-2">🚫</span>
          <h2 className="font-semibold text-lg mb-1">Akses Dibatasi</h2>
          <p className="text-sm">{error}</p>
          <div className="mt-4">
            <Link href="/" className="inline-block bg-[#8B1A1A] text-white text-xs font-semibold px-4 py-2 rounded">
              Kembali ke Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col w-full min-h-screen bg-slate-50">
      {/* Sticky Header / Navbar */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur-md sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <img src="/ee-logo-horizontal.svg" alt="Elevate Equity Logo" className="h-7 sm:h-9 object-contain" />
          </Link>

          {/* Desktop Nav Actions */}
          <div className="hidden md:flex items-center gap-4">
            {currentUser && (
              <>
                <div className="text-right">
                  <div className="text-xs font-semibold text-slate-800">{currentUser.name}</div>
                  <div className="text-[10px] text-slate-400 font-light">{currentUser.email}</div>
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
                <Link
                  href="/"
                  className="inline-flex items-center justify-center bg-white border border-slate-200 hover:border-slate-350 text-slate-600 text-xs font-semibold px-3 py-1.5 rounded transition-all cursor-pointer shadow-sm"
                >
                  ← Kembali ke Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center bg-white border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-slate-600 hover:text-rose-700 text-xs font-semibold px-3 py-1.5 rounded transition-all cursor-pointer shadow-sm"
                >
                  Keluar
                </button>
              </>
            )}
          </div>

          {/* Mobile Nav Hamburger Toggle */}
          <div className="flex md:hidden items-center gap-2">
            {currentUser && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Buka Menu"
                className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:text-[#8B1A1A] hover:bg-slate-50 transition shadow-sm cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && currentUser && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-4 space-y-2.5 shadow-lg animate-fade-in">
            <div className="px-2 py-1.5 border-b border-slate-100 mb-2">
              <div className="text-xs font-bold text-slate-900">{currentUser.name}</div>
              <div className="text-[11px] text-slate-500 font-light truncate">{currentUser.email} (Superadmin)</div>
            </div>
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 w-full text-xs font-semibold text-slate-700 hover:text-[#8B1A1A] p-2.5 rounded-lg hover:bg-red-50/50 transition border border-transparent hover:border-[#8B1A1A]/20"
            >
              <span>📋</span> Dashboard Utama
            </Link>
            <Link
              href="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 w-full text-xs font-semibold text-slate-700 hover:text-[#8B1A1A] p-2.5 rounded-lg hover:bg-red-50/50 transition border border-transparent hover:border-[#8B1A1A]/20"
            >
              <span>👤</span> Profil Saya
            </Link>
            <Link
              href="/sheets"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2.5 w-full text-xs font-semibold text-slate-700 hover:text-[#8B1A1A] p-2.5 rounded-lg hover:bg-red-50/50 transition border border-transparent hover:border-[#8B1A1A]/20"
            >
              <span>📊</span> Tampilan Spreadsheet
            </Link>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="flex items-center gap-2.5 w-full text-xs font-semibold text-rose-650 hover:text-rose-750 p-2.5 rounded-lg hover:bg-rose-50 transition border border-rose-100"
            >
              <span>🚪</span> Keluar
            </button>
          </div>
        )}
      </header>

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-slate-900">
        {/* Banner Alert Alerts */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm relative animate-fade-in flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 font-bold ml-4">✕</button>
          </div>
        )}
        {successMsg && (
          <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded text-sm relative animate-fade-in flex items-center justify-between">
            <span>✓ {successMsg}</span>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800 font-bold ml-4">✕</button>
          </div>
        )}

        {/* Dashboard Title */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif text-slate-900 font-semibold uppercase tracking-wide">
              Manajemen Pengguna
            </h1>
            <p className="text-xs text-slate-500 font-light mt-1">
              Tambah, perbarui, atau hapus pengguna serta kelola parameter otorisasi hak akses sistem.
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-2 bg-[#8B1A1A] hover:bg-[#C0392B] text-white font-semibold px-5 py-2.5 rounded shadow-md transition text-sm cursor-pointer"
          >
            + Tambah Pengguna Baru
          </button>
        </div>

        {/* Pending Password Reset Requests Section */}
        {pendingResets.length > 0 && (
          <div className="mb-10 rounded-lg border border-red-200 bg-red-50/30 p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-[#8B1A1A] mb-4 flex items-center gap-2 uppercase tracking-wider">
              🔑 Permintaan Reset Kata Sandi Menunggu Konfirmasi
            </h2>
            <div className="overflow-x-auto rounded border border-red-150 bg-white">
              <table className="min-w-full divide-y divide-red-100 text-left text-xs">
                <thead>
                  <tr className="bg-red-50 text-red-800 uppercase tracking-wider text-[10px] font-semibold">
                    <th className="px-4 py-3">Rincian Pengguna</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Peran</th>
                    <th className="px-4 py-3">Waktu Pengajuan</th>
                    <th className="px-4 py-3 text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100 text-slate-700">
                  {pendingResets.map((resReq) => (
                    <tr key={resReq.id} className="hover:bg-red-50/10">
                      <td className="px-4 py-3 font-semibold text-slate-900">{resReq.name}</td>
                      <td className="px-4 py-3 font-mono">{resReq.email}</td>
                      <td className="px-4 py-3 capitalize">{resReq.role}</td>
                      <td className="px-4 py-3">{new Date(resReq.created_at).toLocaleString('id-ID')}</td>
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => handleResetAction(resReq.id, 'reject')}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded text-[10px] font-bold transition cursor-pointer"
                        >
                          Tolak
                        </button>
                        <button
                          onClick={() => handleApproveClick(resReq)}
                          className="px-3 py-1 bg-[#8B1A1A] hover:bg-[#C0392B] text-white rounded text-[10px] font-bold transition shadow-sm cursor-pointer"
                        >
                          Setujui (ACC)
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-6 max-w-md">
          <div className="relative">
            <input
              type="text"
              placeholder="Cari pengguna berdasarkan nama, email, atau peran..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg pl-9 pr-4 py-2 focus:ring-1 focus:ring-[#8B1A1A] focus:border-[#8B1A1A] outline-none text-slate-800"
            />
            <span className="absolute left-3 top-2 text-slate-400">🔍</span>
          </div>
        </div>

        {/* User List Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead className="bg-slate-50 text-slate-600 uppercase tracking-wider text-[10px] font-semibold">
              <tr>
                <th className="px-6 py-4">Rincian Pengguna</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Peran</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm text-slate-700 bg-white">
              {paginatedUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/50 transition">
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{u.name}</div>
                    <div className="text-[10px] text-slate-400">ID: {u.id}</div>
                  </td>
                  <td className="px-6 py-4 text-xs font-mono">{u.email}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      u.role === 'superadmin' 
                        ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                        : u.role === 'contractor'
                        ? 'bg-amber-50 text-amber-700 border border-amber-100'
                        : 'bg-blue-50 text-blue-700 border border-blue-100'
                    }`}>
                      {u.role === 'superadmin' ? 'Superadmin' : u.role === 'contractor' ? 'Kontraktor' : 'Pengguna PM'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {u.has_pending_reset ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                        ● permintaan-reset
                      </span>
                    ) : (
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border cursor-pointer transition-all ${
                          u.active 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {u.active ? '● Aktif' : '○ Nonaktif'}
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => openEditModal(u)}
                      className="inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-300 px-3 py-1.5 rounded transition cursor-pointer"
                    >
                      Ubah
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u)}
                      disabled={currentUser?.userId === u.id.toString()}
                      className={`inline-flex items-center text-xs font-semibold border px-3 py-1.5 rounded transition cursor-pointer ${
                        currentUser?.userId === u.id.toString()
                          ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                          : 'text-rose-600 hover:text-rose-800 border-rose-200 hover:border-rose-300'
                      }`}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-600 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div>
              Menampilkan <strong>{filteredUsers.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> hingga <strong>{Math.min(currentPage * pageSize, filteredUsers.length)}</strong> dari <strong>{filteredUsers.length}</strong> data {filteredUsers.length < users.length && `(difilter dari total ${users.length} data)`}
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
          {Math.ceil(filteredUsers.length / pageSize) > 1 && (
            <div className="flex items-center gap-1 select-none font-sans">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-50 disabled:hover:bg-transparent font-medium cursor-pointer transition"
              >
                ← Sebelumnya
              </button>
              {Array.from({ length: Math.ceil(filteredUsers.length / pageSize) }, (_, idx) => idx + 1).map(pageNum => (
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
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredUsers.length / pageSize)))}
                disabled={currentPage === Math.ceil(filteredUsers.length / pageSize)}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-50 disabled:hover:bg-transparent font-medium cursor-pointer transition"
              >
                Berikutnya →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ADD USER MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-serif font-semibold text-slate-800 text-lg uppercase tracking-wide">Buat Akun Pengguna</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded px-3 py-2 focus:ring-1 focus:ring-[#8B1A1A] focus:border-[#8B1A1A] outline-none text-slate-800"
                  placeholder="cth: Kurnia"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Alamat Email</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded px-3 py-2 focus:ring-1 focus:ring-[#8B1A1A] focus:border-[#8B1A1A] outline-none text-slate-800"
                  placeholder="cth: user@eeq.co.nz"
                />
              </div>
              <div>
                 <label className="block text-xs font-medium text-slate-700 mb-1.5">Kata Sandi</label>
                 <div className="relative">
                   <input
                     type={showModalPassword ? "text" : "password"}
                     required
                     value={formPassword}
                     onChange={(e) => setFormPassword(e.target.value)}
                     className="w-full text-sm border border-slate-300 rounded pl-3 pr-10 py-2 focus:ring-1 focus:ring-[#8B1A1A] focus:border-[#8B1A1A] outline-none text-slate-800"
                     placeholder="Minimal 6 karakter"
                     minLength={6}
                   />
                   <button
                     type="button"
                     onClick={() => setShowModalPassword(!showModalPassword)}
                     className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#8B1A1A] focus:outline-none cursor-pointer"
                   >
                     {showModalPassword ? (
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
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Tingkat Peran / Otorisasi</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded px-3 py-2 focus:ring-1 focus:ring-[#8B1A1A] focus:border-[#8B1A1A] outline-none text-slate-800 bg-white"
                >
                  <option value="pm">Pengguna PM (Akses Standar PM)</option>
                  <option value="contractor">Kontraktor (Akses Lapangan)</option>
                  <option value="superadmin">Superadmin (Kelola Semua Pengguna)</option>
                </select>
              </div>
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#8B1A1A] hover:bg-[#C0392B] text-white rounded text-xs font-semibold shadow transition cursor-pointer"
                >
                  Simpan Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-serif font-semibold text-slate-800 text-lg uppercase tracking-wide">Ubah Akun Pengguna</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded px-3 py-2 focus:ring-1 focus:ring-[#8B1A1A] focus:border-[#8B1A1A] outline-none text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Alamat Email</label>
                <input
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded px-3 py-2 focus:ring-1 focus:ring-[#8B1A1A] focus:border-[#8B1A1A] outline-none text-slate-800"
                />
              </div>
              <div>
                 <label className="block text-xs font-medium text-slate-700 mb-1.5 font-semibold text-slate-800">
                   Kata Sandi Baru <span className="text-slate-400 font-normal">(Kosongkan jika tidak ingin mengubah)</span>
                 </label>
                 <div className="relative">
                   <input
                     type={showModalPassword ? "text" : "password"}
                     value={formPassword}
                     onChange={(e) => setFormPassword(e.target.value)}
                     className="w-full text-sm border border-slate-300 rounded pl-3 pr-10 py-2 focus:ring-1 focus:ring-[#8B1A1A] focus:border-[#8B1A1A] outline-none text-slate-800"
                     placeholder="Min. 6 karakter (opsional)"
                     minLength={6}
                   />
                   <button
                     type="button"
                     onClick={() => setShowModalPassword(!showModalPassword)}
                     className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#8B1A1A] focus:outline-none cursor-pointer"
                   >
                     {showModalPassword ? (
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
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Tingkat Peran / Otorisasi</label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded px-3 py-2 focus:ring-1 focus:ring-[#8B1A1A] focus:border-[#8B1A1A] outline-none text-slate-800 bg-white"
                  disabled={currentUser?.userId === editingUser?.id.toString()}
                >
                  <option value="pm">Pengguna PM (Akses Standar PM)</option>
                  <option value="contractor">Kontraktor (Akses Lapangan)</option>
                  <option value="superadmin">Superadmin (Kelola Semua Pengguna)</option>
                </select>
                {currentUser?.userId === editingUser?.id.toString() && (
                  <p className="text-[10px] text-slate-400 mt-1">Anda tidak dapat mengubah tingkat peran akun Anda sendiri saat aktif.</p>
                )}
              </div>
              <div className="flex items-center gap-2 py-1">
                <input
                  type="checkbox"
                  id="formActiveCheck"
                  checked={formActive}
                  disabled={currentUser?.userId === editingUser?.id.toString()}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="w-4 h-4 text-[#8B1A1A] border-slate-300 rounded focus:ring-[#8B1A1A]"
                />
                <label htmlFor="formActiveCheck" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Akun Aktif / Diizinkan Masuk
                </label>
              </div>
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded text-xs font-semibold hover:bg-slate-50 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#8B1A1A] hover:bg-[#C0392B] text-white rounded text-xs font-semibold shadow transition cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

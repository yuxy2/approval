'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

export default function SheetsDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sorting state
  const [sortConfig, setSortConfig] = useState({ key: 'submission_id', direction: 'desc' });

  // Filtering states (per column)
  const [filters, setFilters] = useState({
    submission_id: '',
    project_address: '',
    submitter_name: '',
    submitter_role: '',
    date_of_request: '',
    status: '',
    pm_name: '',
    financial_impact: '',
    schedule_days: '',
    client_email: ''
  });

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Reset page when filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, sortConfig]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        setCurrentUser(data.user);
        fetchRequests();
      } catch (err) {
        console.error('Auth check error:', err);
        router.push('/login');
      }
    };
    checkAuth();
  }, [router]);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/requests');
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to fetch variation requests.');
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
      setError('An error occurred while loading requests.');
    } finally {
      setLoading(false);
    }
  };

  // Sort handler
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Filter input change handler
  const handleFilterChange = (columnKey, value) => {
    setFilters(prev => ({
      ...prev,
      [columnKey]: value
    }));
  };

  // Clear all filters
  const handleClearFilters = () => {
    setFilters({
      submission_id: '',
      project_address: '',
      submitter_name: '',
      submitter_role: '',
      date_of_request: '',
      status: '',
      pm_name: '',
      financial_impact: '',
      schedule_days: '',
      client_email: ''
    });
  };

  const getPMName = (req) => req.pm_user?.name || '-';
  
  const getFinancialImpactVal = (req) => {
    const pmEvent = req.workflow_events?.find(e => e.step_type === 'pm_review' && e.action === 'approve');
    if (!pmEvent || pmEvent.financial_impact === 'none') return 'Tidak Ada';
    const sign = pmEvent.financial_impact === 'increase' ? '+' : '-';
    return `${sign}Rp ${Number(pmEvent.financial_amount || 0).toLocaleString('id-ID')}`;
  };

  const getScheduleDaysVal = (req) => {
    const pmEvent = req.workflow_events?.find(e => e.step_type === 'pm_review' && e.action === 'approve');
    if (!pmEvent || pmEvent.schedule_impact === 'none') return 'Tanpa penundaan';
    const actionStr = pmEvent.schedule_impact === 'adds' ? 'bertambah' : 'berkurang';
    return `${pmEvent.schedule_days} hari (${actionStr})`;
  };

  // Apply sorting and filtering
  const processedRequests = React.useMemo(() => {
    let items = [...requests];

    // 1. Filter
    items = items.filter(req => {
      const pmEvent = req.workflow_events?.find(e => e.step_type === 'pm_review' && e.action === 'approve');
      
      const matchSubId = (req.submission_id || '').toLowerCase().includes(filters.submission_id.toLowerCase());
      const matchProjId = (req.project_address || '').toLowerCase().includes(filters.project_address.toLowerCase());
      const matchSubName = (req.submitter_name || '').toLowerCase().includes(filters.submitter_name.toLowerCase());
      const matchSubRole = (req.submitter_role || '').toLowerCase().includes(filters.submitter_role.toLowerCase());
      const matchClientEmail = (req.client_email || '').toLowerCase().includes(filters.client_email.toLowerCase());
      
      const matchDate = new Date(req.date_of_request).toLocaleDateString('id-ID').toLowerCase().includes(filters.date_of_request.toLowerCase());
      const matchStatus = (req.status || '').toLowerCase().includes(filters.status.toLowerCase());
      const matchPmName = getPMName(req).toLowerCase().includes(filters.pm_name.toLowerCase());
      const matchFinancial = getFinancialImpactVal(req).toLowerCase().includes(filters.financial_impact.toLowerCase());
      const matchSchedule = getScheduleDaysVal(req).toLowerCase().includes(filters.schedule_days.toLowerCase());

      return matchSubId && matchProjId && matchSubName && matchSubRole && matchDate && matchStatus && matchPmName && matchFinancial && matchSchedule && matchClientEmail;
    });

    // 2. Sort
    if (sortConfig.key) {
      items.sort((a, b) => {
        let valA, valB;

        if (sortConfig.key === 'pm_name') {
          valA = getPMName(a);
          valB = getPMName(b);
        } else if (sortConfig.key === 'financial_impact') {
          const pmA = a.workflow_events?.find(e => e.step_type === 'pm_review' && e.action === 'approve');
          const pmB = b.workflow_events?.find(e => e.step_type === 'pm_review' && e.action === 'approve');
          valA = pmA?.financial_impact === 'none' ? 0 : (Number(pmA?.financial_amount) || 0) * (pmA?.financial_impact === 'decrease' ? -1 : 1);
          valB = pmB?.financial_impact === 'none' ? 0 : (Number(pmB?.financial_amount) || 0) * (pmB?.financial_impact === 'decrease' ? -1 : 1);
        } else if (sortConfig.key === 'schedule_days') {
          const pmA = a.workflow_events?.find(e => e.step_type === 'pm_review' && e.action === 'approve');
          const pmB = b.workflow_events?.find(e => e.step_type === 'pm_review' && e.action === 'approve');
          valA = pmA?.schedule_impact === 'none' ? 0 : (pmA?.schedule_days || 0) * (pmA?.schedule_impact === 'reduces' ? -1 : 1);
          valB = pmB?.schedule_impact === 'none' ? 0 : (pmB?.schedule_days || 0) * (pmB?.schedule_impact === 'reduces' ? -1 : 1);
        } else {
          valA = a[sortConfig.key];
          valB = b[sortConfig.key];
        }

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (typeof valA === 'string') {
          return sortConfig.direction === 'asc'
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        } else {
          return sortConfig.direction === 'asc'
            ? valA - valB
            : valB - valA;
        }
      });
    }

    return items;
  }, [requests, sortConfig, filters]);

  // Paginate requests
  const paginatedRequests = React.useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return processedRequests.slice(startIndex, startIndex + pageSize);
  }, [processedRequests, currentPage, pageSize]);

  // Export to Excel handler
  const handleExportExcel = () => {
    if (processedRequests.length === 0) {
      alert('Tidak ada data yang dapat diekspor.');
      return;
    }

    // Format headers and data exactly for spreadsheet rows
    const worksheetData = processedRequests.map(req => {
      const pmEvent = req.workflow_events?.find(e => e.step_type === 'pm_review' && e.action === 'approve');
      return {
        'ID Permohonan': req.submission_id,
        'Lokasi / ID Proyek': req.project_address,
        'Tanggal': new Date(req.date_of_request).toLocaleDateString('id-ID'),
        'Nama Pemohon': req.submitter_name,
        'Jabatan Pemohon': req.submitter_role,
        'Email Pemohon': req.submitter_email,
        'Manajer Proyek': req.pm_user?.name || '-',
        'Email PM': req.pm_user?.email || '-',
        'Status': req.status,
        'Tipe Dampak Finansial': pmEvent?.financial_impact || 'none',
        'Dampak Finansial (Rp)': pmEvent?.financial_amount ? Number(pmEvent.financial_amount) : 0,
        'Tipe Dampak Jadwal': pmEvent?.schedule_impact || 'none',
        'Dampak Jadwal (Hari)': pmEvent?.schedule_days || 0,
        'Email Klien': req.client_email,
        'Deskripsi Lingkup': req.description || '',
        'Alasan Variasi': req.reason || '',
        'Dampak Proyek': req.project_impact || '',
        'Catatan Pemohon': req.submitter_notes || ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Permohonan Variasi');

    // Trigger download
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Elevate_Equity_Permohonan_Variasi_${dateStr}.xlsx`);
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

  if (loading && requests.length === 0) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-20 min-h-screen bg-slate-50">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[#8B1A1A] border-r-transparent"></div>
        <p className="mt-4 text-sm text-slate-500">Memuat data spreadsheet...</p>
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
                  href="/"
                  className="inline-flex items-center justify-center bg-white border border-slate-200 hover:border-slate-300 text-slate-600 text-xs font-semibold px-3 py-1.5 rounded transition-all cursor-pointer shadow-sm"
                >
                  ← Kembali ke Portal
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
              <div className="text-[11px] text-slate-500 font-light truncate">{currentUser.email}</div>
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

      <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-10 text-slate-900">
        
        {/* Banner error messages */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded text-sm relative animate-fade-in flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800 font-bold ml-4">✕</button>
          </div>
        )}

        {/* Dashboard Title & Actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif text-slate-900 font-semibold uppercase tracking-wide flex items-center gap-2">
              Tampilan Spreadsheet Permohonan
            </h1>
            <p className="text-xs text-slate-500 font-light mt-1">
              Tampilan spreadsheet seluruh log permohonan variasi. Cari, filter, urutkan, atau unduh berkas ke Excel.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleClearFilters}
              className="inline-flex items-center justify-center bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold px-4 py-2.5 rounded shadow-sm transition cursor-pointer"
            >
              Hapus Semua Filter
            </button>
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-2 bg-[#8B1A1A] hover:bg-[#C0392B] text-white font-semibold px-5 py-2.5 rounded shadow-md transition text-xs cursor-pointer uppercase tracking-wider font-bold"
            >
              Ekspor ke Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* Excel-like Grid/Table view */}
        <div className="overflow-x-auto rounded-lg border border-slate-300 bg-white shadow-md">
          <table className="min-w-full divide-y divide-slate-300 text-left border-collapse">
            
            {/* Headers row with sorting option */}
            <thead className="bg-slate-100 text-slate-700 text-[11px] font-bold uppercase tracking-wider sticky top-0 border-b border-slate-300">
              <tr>
                {[
                  { label: 'ID Permohonan', key: 'submission_id', width: '9%' },
                  { label: 'Lokasi Proyek', key: 'project_address', width: '13%' },
                  { label: 'Pemohon', key: 'submitter_name', width: '11%' },
                  { label: 'Jabatan', key: 'submitter_role', width: '10%' },
                  { label: 'Tanggal', key: 'date_of_request', width: '9%' },
                  { label: 'Status', key: 'status', width: '11%' },
                  { label: 'Manajer PM', key: 'pm_name', width: '11%' },
                  { label: 'Dampak Biaya', key: 'financial_impact', width: '11%' },
                  { label: 'Dampak Jadwal', key: 'schedule_days', width: '11%' },
                  { label: 'Email Klien', key: 'client_email', width: '14%' }
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => requestSort(col.key)}
                    className="px-4 py-3 border-r border-slate-200 cursor-pointer hover:bg-slate-200 select-none transition-all group"
                    style={{ width: col.width }}
                  >
                    <div className="flex items-center justify-between">
                      <span>{col.label}</span>
                      <span className="text-slate-400 group-hover:text-slate-700 ml-1.5">
                        {sortConfig.key === col.key 
                          ? (sortConfig.direction === 'asc' ? '▲' : '▼')
                          : '↕'}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>

              {/* Excel Filters input row */}
              <tr className="bg-slate-50 border-b border-slate-300">
                {Object.keys(filters).map((colKey) => (
                  <td key={colKey} className="px-2 py-1.5 border-r border-slate-200">
                    <input
                      type="text"
                      placeholder="Cari..."
                      value={filters[colKey]}
                      onChange={(e) => handleFilterChange(colKey, e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded px-1.5 py-1 text-[10px] text-slate-800 focus:border-[#8B1A1A] outline-none shadow-inner"
                    />
                  </td>
                ))}
              </tr>
            </thead>

            {/* Grid rows */}
            <tbody className="divide-y divide-slate-200 text-xs text-slate-800 bg-white font-mono">
              {processedRequests.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-400 italic">
                    Tidak ada data yang cocok. Bersihkan filter untuk melihat semua data.
                  </td>
                </tr>
              ) : (
                paginatedRequests.map((req, idx) => (
                  <tr 
                    key={req.id} 
                    className={`hover:bg-slate-100/75 transition-colors ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                    }`}
                  >
                    <td className="px-4 py-2.5 border-r border-slate-100 font-semibold text-slate-900">
                      {req.submission_id}
                    </td>
                    <td className="px-4 py-2.5 border-r border-slate-100 font-sans font-medium text-slate-800">
                      {req.project_address}
                    </td>
                    <td className="px-4 py-2.5 border-r border-slate-100 font-sans">
                      {req.submitter_name}
                    </td>
                    <td className="px-4 py-2.5 border-r border-slate-100 font-sans text-slate-500">
                      {req.submitter_role}
                    </td>
                    <td className="px-4 py-2.5 border-r border-slate-100 text-slate-500">
                      {new Date(req.date_of_request).toLocaleDateString('id-ID')}
                    </td>
                    <td className="px-4 py-2.5 border-r border-slate-100 font-sans">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        req.status === 'PENDING_CLIENT' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                        req.status === 'PENDING_PM' ? 'bg-rose-50 text-[#8B1A1A] border border-[#8B1A1A]/10' :
                        'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 border-r border-slate-100 font-sans">
                      {getPMName(req)}
                    </td>
                    <td className="px-4 py-2.5 border-r border-slate-100 font-sans">
                      {getFinancialImpactVal(req)}
                    </td>
                    <td className="px-4 py-2.5 border-r border-slate-100 font-sans">
                      {getScheduleDaysVal(req)}
                    </td>
                    <td className="px-4 py-2.5 border-r border-slate-100 text-slate-500 font-sans truncate max-w-[150px]" title={req.client_email}>
                      {req.client_email}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Spreadsheet Footer counter and Pagination */}
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-600 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div>
              Menampilkan <strong>{processedRequests.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> hingga <strong>{Math.min(currentPage * pageSize, processedRequests.length)}</strong> dari <strong>{processedRequests.length}</strong> data {processedRequests.length < requests.length && `(difilter dari total ${requests.length} data)`}
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
          {Math.ceil(processedRequests.length / pageSize) > 1 && (
            <div className="flex items-center gap-1 select-none font-sans">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-50 disabled:hover:bg-transparent font-medium cursor-pointer transition"
              >
                ← Sebelumnya
              </button>
              {Array.from({ length: Math.ceil(processedRequests.length / pageSize) }, (_, idx) => idx + 1).map(pageNum => (
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
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(processedRequests.length / pageSize)))}
                disabled={currentPage === Math.ceil(processedRequests.length / pageSize)}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-50 disabled:hover:bg-transparent font-medium cursor-pointer transition"
              >
                Selanjutnya →
              </button>
            </div>
          )}

          <div className="font-mono text-[10px] text-slate-400">
            Sesi Aktif: {currentUser?.name} ({currentUser?.role})
          </div>
        </div>

      </div>
    </div>
  );
}

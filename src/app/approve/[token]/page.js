'use client';

import React, { use, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

function parseAttachments(attachmentStr) {
  if (!attachmentStr) return [];
  try {
    const parsed = JSON.parse(attachmentStr);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {}
  
  if (attachmentStr.startsWith('data:')) {
    let name = 'Attachment';
    if (attachmentStr.startsWith('data:image/')) {
      const match = attachmentStr.match(/^data:image\/(\w+);base64,/);
      const ext = match ? match[1] : 'jpg';
      name = `Attachment.${ext}`;
    } else if (attachmentStr.startsWith('data:application/pdf')) {
      name = 'Attachment.pdf';
    }
    return [{ name, content: attachmentStr }];
  }
  return [];
}

function getFileBadge(filename, content) {
  const ext = filename.split('.').pop().toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || content?.startsWith('data:image/')) {
    return { label: 'IMAGE', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  }
  if (ext === 'pdf' || content?.startsWith('data:application/pdf')) {
    return { label: 'PDF', color: 'bg-rose-50 text-rose-700 border-rose-200' };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return { label: 'EXCEL', color: 'bg-green-50 text-green-750 border-green-200' };
  }
  if (['doc', 'docx'].includes(ext)) {
    return { label: 'WORD', color: 'bg-blue-50 text-blue-700 border-blue-200' };
  }
  return { label: 'DOC', color: 'bg-slate-50 text-slate-700 border-slate-200' };
}

export default function ClientSignOffPage({ params }) {
  const { token } = use(params);
  const router = useRouter();
  const canvasRef = useRef(null);

  const [requestData, setRequestData] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [showExpiredPopup, setShowExpiredPopup] = useState(false);
  const [clientAgreement, setClientAgreement] = useState(false);
  const [clientSignName, setClientSignName] = useState('');
  const [clientSignedAt, setClientSignedAt] = useState('');
  const [clientComments, setClientComments] = useState('');
  const [showViewerAttachment, setShowViewerAttachment] = useState(null);

  // Rejection notes
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const fetchRequestByToken = async () => {
    try {
      const res = await fetch(`/api/tokens/${token}`);
      if (res.ok) {
        const data = await res.json();
        setRequestData(data.request);
        setRole(data.role);

        const expired = data.expiresAt && new Date() > new Date(data.expiresAt);
        setIsExpired(expired);
        if (expired && data.request?.status === 'PENDING_CLIENT') {
          setShowExpiredPopup(true);
        }

        const req = data.request;
        setClientAgreement(req.status === 'APPROVED');

        // Find client approval event if exists
        const clientEvent = req.workflow_events?.find(e => e.step_type === 'client_review' && e.action === 'approve');
        if (clientEvent) {
          setClientSignName(clientEvent.client_name || '');
          if (clientEvent.client_date) {
            setClientSignedAt(clientEvent.client_date.split('T')[0]);
          }
        } else {
          setClientSignedAt(new Date().toISOString().split('T')[0]);
        }
      } else {
        alert('Invalid or expired token.');
        router.push('/');
      }
    } catch (err) {
      console.error('Error fetching request by token:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequestByToken();
  }, [token]);

  // Setup Canvas context
  useEffect(() => {
    if (requestData && requestData.status === 'PENDING_CLIENT' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.strokeStyle = '#8B1A1A'; // Brand red signature ink
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
    }
  }, [requestData]);

  // Drawing Handlers
  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    let clientX = 0;
    let clientY = 0;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    
    let clientX = 0;
    let clientY = 0;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasSigned(true);
    
    if (e.touches) {
      e.preventDefault();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const handleApprove = async () => {
    if (!clientAgreement) {
      alert('Silakan centang kotak Persetujuan Klien untuk melanjutkan.');
      return;
    }
    if (!clientSignName) {
      alert('Silakan masukkan nama penandatangan.');
      return;
    }
    if (!hasSigned) {
      alert('Silakan bubuhkan tanda tangan pada papan tanda tangan.');
      return;
    }
    setSubmitting(true);

    const canvas = canvasRef.current;
    const signatureImage = canvas.toDataURL();

    try {
      const res = await fetch(`/api/requests/${requestData.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CLIENT_APPROVE',
          token,
          signature: signatureImage,
          clientSignName,
          clientSignedAt: new Date(clientSignedAt).toISOString(),
          clientComments
        })
      });

      if (res.ok) {
        fetchRequestByToken(); // Reload to show signed receipt
      } else {
        const data = await res.json();
        alert('Persetujuan gagal: ' + (data.error || 'Terjadi kesalahan'));
      }
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan jaringan');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/requests/${requestData.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CLIENT_REJECT',
          token,
          rejectionNotes
        })
      });

      if (res.ok) {
        router.push(`/status/${token}`);
      } else {
        const data = await res.json();
        alert('Penolakan gagal: ' + (data.error || 'Terjadi kesalahan'));
      }
    } catch (err) {
      console.error(err);
      alert('Gagal memperbarui status');
    } finally {
      setSubmitting(false);
      setShowRejectModal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#8B1A1A] border-r-transparent"></div>
        <p className="ml-3 text-sm text-slate-500">Memuat persetujuan klien...</p>
      </div>
    );
  }

  if (!requestData) return null;

  const isApproved = requestData.status === 'APPROVED';
  const isRejected = requestData.status === 'REJECTED_TO_PM' || requestData.status === 'REJECTED_TO_SUBMITTER';
  const isLinkExpired = isExpired && requestData.status === 'PENDING_CLIENT';

  const pmEvent = requestData.workflow_events?.find(e => e.step_type === 'pm_review' && e.action === 'approve');
  const clientApprovedEvent = requestData.workflow_events?.find(e => e.step_type === 'client_review' && e.action === 'approve');

  if (role !== 'Client' || requestData.status !== 'PENDING_CLIENT') {
    if (!isApproved) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center text-slate-900">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-slate-700">Akses Persetujuan Dibatasi</h3>
          <p className="text-sm text-slate-550 mt-1 max-w-md">
            Tautan ini tidak valid untuk persetujuan klien, atau permohonan telah diproses sebelumnya.
          </p>
          <Link href={`/status/${token}`} className="mt-6 inline-flex items-center text-xs font-semibold text-[#8B1A1A] border border-[#8B1A1A]/30 hover:border-[#8B1A1A]/70 px-4 py-2 rounded transition">
            Lihat Halaman Status
          </Link>
        </div>
      );
    }
  }

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-slate-900">
      {/* Back Link */}
      <div className="mb-6 flex justify-between items-center">
        <Link href="/" className="text-xs text-slate-500 hover:text-[#8B1A1A] flex items-center gap-1.5 transition">
          ← Kembali ke Dashboard
        </Link>
        <Link href={`/status/${token}`} className="text-xs text-[#8B1A1A] hover:underline flex items-center gap-1 transition">
          🔍 Lihat Status Langsung & Riwayat
        </Link>
      </div>

      <div className="glass-panel-glow p-8 rounded-xl border border-slate-200 bg-[#fafafa]">
        {/* Corporate Document Header */}
        <div className="bg-[#e4dfdf] px-8 py-6 flex flex-col md:flex-row print:flex-row md:items-start print:items-center justify-between gap-8 print:gap-4 border-b border-slate-350 -mx-8 -mt-8 rounded-t-xl print:mx-0 print:mt-0 print:rounded-none mb-8">
          {/* Column 1: Logo */}
          <div className="flex-shrink-0 flex justify-center md:justify-start print:justify-start md:w-56 print:w-auto pt-1">
            <img src="/EE-wide.png" alt="Elevate Equity Logo" className="h-12 print:h-9 object-contain" />
          </div>
          {/* Column 2: Title */}
          <div className="flex-1 text-right print:text-right">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-sans font-bold tracking-[0.45em] text-slate-900 uppercase print:text-[32px] print:tracking-[0.28em] print:whitespace-nowrap">
              Permohonan Variasi
            </h1>
          </div>
        </div>

        {/* Subtitle / Step Details & Badges */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 mb-6 gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[10px] sm:text-[11px] text-slate-500 uppercase font-mono tracking-wider">
              Lokasi Proyek: <span className="font-semibold text-slate-700">{requestData.siteId || requestData.project_address}</span>
            </p>
            <div>
              {isApproved ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-250">
                  ✅ Disetujui
                </span>
              ) : isRejected ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-250">
                  ❌ Ditolak
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-250 animate-pulse">
                  ✍️ Menunggu Persetujuan Klien
                </span>
              )}
            </div>
          </div>
          <span className="text-[9px] sm:text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-semibold uppercase tracking-wider">
            Langkah 3: Persetujuan Klien — Peninjauan Akhir & Otorisasi Digital
          </span>
        </div>

        {/* Stacked Single-Column Flow */}
        <div className="space-y-8">
          
          {/* Read-Only Details Area (Section 1) */}
          <div className="space-y-6 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <div className="border-b border-slate-200 pb-2 mb-4">
              <h3 className="text-sm font-bold text-[#8B1A1A] uppercase tracking-wider">
                1. Riwayat Proyek & Lingkup Pekerjaan (Hanya Baca)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500 block font-semibold uppercase tracking-wider text-xs">Lokasi / ID Proyek</span>
                <span className="text-slate-900 font-medium text-base">{requestData.project_address}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold uppercase tracking-wider text-xs">Diajukan Oleh</span>
                <span className="text-slate-900 font-medium text-base">{requestData.submitter_name} ({requestData.submitter_role})</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-sm">
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Tanggal Permohonan</span>
                <span className="text-slate-955 font-bold text-base flex items-center gap-1.5 mt-0.5">
                  🗓️ {new Date(requestData.date_of_request).toLocaleDateString('id-ID')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold uppercase tracking-wider text-xs">Email Manajer Proyek</span>
                <span className="text-slate-900 text-base">{requestData.pm_user?.email || '-'}</span>
              </div>
            </div>

            <hr className="border-slate-100" />

            <div className="space-y-4 text-sm">
              <div>
                <span className="text-slate-500 font-bold block mb-1.5 uppercase tracking-wider text-xs">Deskripsi Variasi:</span>
                <p className="text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200 whitespace-pre-wrap leading-relaxed">
                  {requestData.description || 'Tidak ada deskripsi.'}
                </p>
              </div>

              <div>
                <span className="text-slate-500 font-bold block mb-1.5 uppercase tracking-wider text-xs">Alasan Variasi:</span>
                <p className="text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200 whitespace-pre-wrap leading-relaxed">
                  {requestData.reason || 'Tidak ada alasan.'}
                </p>
              </div>

              <div>
                <span className="text-slate-500 font-bold block mb-1.5 uppercase tracking-wider text-xs">Dampak Terhadap Proyek:</span>
                <p className="text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200 whitespace-pre-wrap leading-relaxed">
                  {requestData.project_impact || 'Tidak ada keterangan dampak.'}
                </p>
              </div>
            </div>
          </div>

          {/* Attachments Section */}
          {(requestData.contractor_attachment || requestData.prm_attachment) && (
            <div className="space-y-6">
              {requestData.contractor_attachment && parseAttachments(requestData.contractor_attachment).length > 0 && (
                <div className="space-y-4 bg-white p-6 rounded-lg border border-slate-200 shadow-sm text-left">
                  <h3 className="text-sm font-bold text-[#8B1A1A] uppercase tracking-wider border-b border-slate-100 pb-2">
                    Lampiran Pemohon Lapangan
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {parseAttachments(requestData.contractor_attachment).map((file, idx) => {
                      const badge = getFileBadge(file.name, file.content);
                      const isImg = file.content.startsWith('data:image/');
                      return (
                        <div key={idx} className="bg-[#fcf8f8] p-4 rounded-lg border border-[#8B1A1A]/10 shadow-sm flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {isImg ? (
                              <img src={file.content} alt={file.name} className="h-9 w-9 object-cover rounded border border-slate-200 bg-slate-50" />
                            ) : (
                              <div className="h-9 w-9 bg-slate-50 rounded border border-slate-200 flex items-center justify-center text-lg">
                                📄
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate text-slate-800 max-w-[180px]" title={file.name}>
                                {file.name}
                              </div>
                              <span className={`inline-block text-[8px] font-bold px-1.5 py-0.2 rounded border mt-0.5 ${badge.color}`}>
                                {badge.label}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const badgeInfo = getFileBadge(file.name, file.content);
                              setShowViewerAttachment({
                                type: badgeInfo.label.toLowerCase(),
                                content: file.content,
                                title: file.name
                              });
                            }}
                            className="inline-flex items-center justify-center bg-white border border-[#8B1A1A]/20 hover:border-[#8B1A1A]/40 text-[#8B1A1A] text-xs font-bold px-4 py-2.5 rounded-lg transition shadow-sm cursor-pointer whitespace-nowrap"
                          >
                            🔍 Lihat Berkas
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {requestData.prm_attachment && parseAttachments(requestData.prm_attachment).length > 0 && (
                <div className="space-y-4 bg-white p-6 rounded-lg border border-slate-200 shadow-sm text-left">
                  <h3 className="text-sm font-bold text-[#8B1A1A] uppercase tracking-wider border-b border-slate-100 pb-2">
                    Lampiran Manajer Proyek (PM)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {parseAttachments(requestData.prm_attachment).map((file, idx) => {
                      const badge = getFileBadge(file.name, file.content);
                      const isImg = file.content.startsWith('data:image/');
                      return (
                        <div key={idx} className="bg-[#fcf8f8] p-4 rounded-lg border border-[#8B1A1A]/10 shadow-sm flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {isImg ? (
                              <img src={file.content} alt={file.name} className="h-9 w-9 object-cover rounded border border-slate-200 bg-slate-50" />
                            ) : (
                              <div className="h-9 w-9 bg-slate-50 rounded border border-slate-200 flex items-center justify-center text-lg">
                                📄
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate text-slate-800 max-w-[180px]" title={file.name}>
                                {file.name}
                              </div>
                              <span className={`inline-block text-[8px] font-bold px-1.5 py-0.2 rounded border mt-0.5 ${badge.color}`}>
                                {badge.label}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const badgeInfo = getFileBadge(file.name, file.content);
                              setShowViewerAttachment({
                                type: badgeInfo.label.toLowerCase(),
                                content: file.content,
                                title: file.name
                              });
                            }}
                            className="inline-flex items-center justify-center bg-white border border-[#8B1A1A]/20 hover:border-[#8B1A1A]/40 text-[#8B1A1A] text-xs font-bold px-4 py-2.5 rounded-lg transition shadow-sm cursor-pointer whitespace-nowrap"
                          >
                            🔍 Lihat Berkas
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PM Assessment Details (Section 2) & Sign-off Area (Section 3) */}
          <div className="space-y-6">
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-[#8B1A1A] uppercase tracking-wider">
                  2. Penilaian Manajer Proyek (Hanya Baca)
                </h3>
              </div>

              {/* PM Assessment Stats */}
              <div className="p-6 bg-white border border-slate-200 rounded-lg space-y-4 shadow-sm text-sm">
                {pmEvent ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">Dampak Finansial</span>
                        <span className={`font-bold text-base uppercase ${pmEvent.financial_impact === 'increase' ? 'text-rose-600' : pmEvent.financial_impact === 'decrease' ? 'text-emerald-600' : 'text-slate-700'}`}>
                          {pmEvent.financial_impact === 'increase' ? 'Bertambah' : pmEvent.financial_impact === 'decrease' ? 'Berkurang' : 'Tidak Ada'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">Total Dampak Finansial</span>
                        <span className="text-slate-900 font-bold text-base">
                          {pmEvent.financial_impact === 'none' ? 'Tanpa dampak biaya' : `Rp ${Number(pmEvent.financial_amount).toLocaleString('id-ID')}`}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">Dampak Jadwal</span>
                        <span className="text-slate-900 font-bold text-base uppercase">
                          {pmEvent.schedule_impact === 'adds' ? 'Bertambah' : pmEvent.schedule_impact === 'reduces' ? 'Berkurang' : 'Tidak Ada'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">Total Dampak Jadwal</span>
                        <span className="text-slate-900 font-bold text-base">
                          {pmEvent.schedule_impact === 'none' ? 'Tanpa penundaan' : `${pmEvent.schedule_days} hari`}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">Penandatangan Perwakilan Perusahaan</span>
                        <span className="text-slate-900 font-bold">{pmEvent.company_rep_name}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">Status Persetujuan PM</span>
                        <span className="text-emerald-600 font-bold">Disetujui ✓</span>
                      </div>
                    </div>

                    {pmEvent.pm_notes && (
                      <div className="text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-600 italic leading-relaxed">
                        <span className="font-bold text-slate-800 block mb-0.5 not-italic uppercase tracking-wider text-[10px]">Catatan Penilaian PM:</span>
                        &quot;{pmEvent.pm_notes}&quot;
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-slate-500 italic">Tidak ada riwayat biaya PM (Pengajuan langsung PRM).</p>
                )}
              </div>

              {/* Client Sign-off Input */}
              {isApproved && clientApprovedEvent ? (
                /* APPROVED VIEW (Receipt) */
                <div className="space-y-4 p-6 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
                  <div className="text-center pb-2 border-b border-emerald-100">
                    <span className="text-sm text-emerald-800 font-bold tracking-widest uppercase">
                      ✓ Bukti Tanda Tangan Digital
                    </span>
                    <p className="text-xs text-slate-550 mt-1">
                      Tanggal Tanda Tangan Klien: {clientApprovedEvent.client_date ? new Date(clientApprovedEvent.client_date).toLocaleDateString('id-ID') : '-'}
                    </p>
                  </div>
                  
                  {clientApprovedEvent.signature_image && (
                    <div className="flex justify-center bg-white p-4 border border-slate-205 rounded-lg shadow-sm">
                      <img
                        src={clientApprovedEvent.signature_image}
                        alt="Tanda Tangan Klien"
                        className="max-h-[120px] object-contain border border-slate-200 bg-slate-50 p-2 rounded-md"
                      />
                    </div>
                  )}

                  <div className="text-slate-850 text-center font-bold text-base mt-2">
                    Nama Penandatangan: {clientApprovedEvent.client_name}
                  </div>

                  {clientComments && (
                    <div className="text-xs text-slate-500 italic text-center bg-white p-3 rounded-lg border border-slate-200">
                      Catatan: &quot;{clientComments}&quot;
                    </div>
                  )}
                </div>
              ) : isLinkExpired ? (
                /* EXPIRED VIEW */
                <div className="space-y-4 p-6 bg-rose-50 border border-rose-250 rounded-lg text-sm">
                  <div className="text-center pb-2 border-b border-rose-100">
                    <span className="text-sm text-rose-800 font-bold tracking-widest uppercase">
                      ⚠️ Tautan Permohonan Kedaluwarsa
                    </span>
                    <p className="text-xs text-slate-500 mt-1">
                      Batas waktu persetujuan untuk permohonan variasi ini telah berakhir.
                    </p>
                  </div>
                  <p className="text-slate-750 bg-white p-4 rounded-lg border border-rose-100 text-center leading-relaxed">
                    Tautan persetujuan permohonan ini telah kedaluwarsa. Anda tidak dapat menandatangani atau menolaknya. Pemohon (<strong>{requestData.submitter_name}</strong>) harus mengajukan ulang permohonan untuk membuat tautan baru yang aktif.
                  </p>
                </div>
              ) : (
                /* SIGN-OFF REQUIRED VIEW */
                <div className="space-y-6">
                  {/* Agreement Checkbox */}
                  <div className="flex items-start gap-3.5 p-4 bg-white border border-slate-300 rounded-lg shadow-sm">
                    <input
                      id="agreement"
                      type="checkbox"
                      checked={clientAgreement}
                      onChange={(e) => setClientAgreement(e.target.checked)}
                      className="h-5 w-5 border-slate-350 text-[#8B1A1A] focus:ring-[#8B1A1A] rounded mt-0.5 cursor-pointer"
                    />
                    <label htmlFor="agreement" className="text-sm text-slate-705 font-bold select-none cursor-pointer leading-relaxed">
                      Persetujuan Klien: Saya menyetujui lingkup variasi pekerjaan, dampak finansial, dan penyesuaian jadwal yang dirinci di atas.
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Nama Klien (Penandatangan)</label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Budi Santoso"
                        value={clientSignName}
                        onChange={(e) => setClientSignName(e.target.value)}
                        className="w-full bg-white border border-slate-300 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-3 text-base text-slate-800 outline-none transition shadow-sm font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Tanggal Tanda Tangan</label>
                      <input
                        type="date"
                        required
                        value={clientSignedAt}
                        onChange={(e) => setClientSignedAt(e.target.value)}
                        className="w-full bg-white border border-slate-300 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-3 text-base text-slate-800 outline-none transition shadow-sm h-12 bg-white font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Catatan Klien (Opsional)</label>
                    <input
                      type="text"
                      placeholder="Tambahkan komentar atau referensi..."
                      value={clientComments}
                      onChange={(e) => setClientComments(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-3 text-base text-slate-800 outline-none transition shadow-sm"
                    />
                  </div>

                  {/* Draw Box */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">Papan Tanda Tangan Digital</label>
                      {hasSigned && (
                        <button
                          type="button"
                          onClick={clearCanvas}
                          className="text-xs text-amber-600 hover:text-amber-500 font-bold cursor-pointer"
                        >
                          Hapus Tanda Tangan
                        </button>
                      )}
                    </div>
                    
                    <div className="relative border border-slate-300 rounded-lg overflow-hidden shadow-inner">
                      <canvas
                        ref={canvasRef}
                        width={600}
                        height={160}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className="signature-canvas w-full max-w-full bg-slate-50 cursor-crosshair"
                      />
                      {!hasSigned && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-xs text-slate-400 italic">
                          Klik / Sentuh dan bubuhkan tanda tangan di dalam kotak ini
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sign-off Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowRejectModal(true)}
                      className="flex-1 bg-white border border-rose-350 text-rose-700 font-bold py-3.5 px-6 h-12 rounded-lg text-sm hover:bg-rose-50 active:scale-95 transition text-center uppercase tracking-wider shadow-sm cursor-pointer"
                    >
                      ⚠️ Minta Penyesuaian Biaya / Lingkup
                    </button>
                    <button
                      type="button"
                      onClick={handleApprove}
                      disabled={submitting || !clientAgreement || !clientSignName || !hasSigned}
                      className="flex-1 bg-[#8B1A1A] hover:bg-[#C0392B] text-white font-bold py-3.5 px-6 h-12 rounded-lg text-sm active:scale-95 transition disabled:opacity-50 text-center uppercase tracking-wider shadow cursor-pointer"
                    >
                      {submitting ? 'Menyetujui...' : 'Tandatangani & Setujui Variasi ✓'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Decline/Revision Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full shadow-lg space-y-4 animate-fade-in">
            <h3 className="font-serif text-slate-900 text-lg font-bold tracking-wide uppercase">
              Minta Penyesuaian Biaya / Lingkup
            </h3>
            <p className="text-xs text-slate-500">
              Silakan tulis catatan yang menjelaskan kendala pada rincian biaya atau lingkup pekerjaan ini. Permohonan akan dikembalikan ke Manajer Proyek (PM) untuk disesuaikan.
            </p>
            <div>
              <label className="block text-[11px] text-slate-500 mb-1 uppercase font-bold tracking-wider">Keterangan Penyesuaian</label>
              <textarea
                required
                rows={3}
                placeholder="Jelaskan penyesuaian apa yang diperlukan..."
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-3 text-base text-slate-800 outline-none transition shadow-sm"
              />
            </div>
            <div className="flex justify-end gap-2.5 text-xs font-bold uppercase tracking-wider">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2.5 border border-slate-200 text-slate-500 hover:bg-slate-55 rounded-lg transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleReject}
                disabled={submitting || !rejectionNotes.trim()}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition disabled:opacity-50 cursor-pointer"
              >
                Kembalikan ke PM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expired Link Modal Popup */}
      {showExpiredPopup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full shadow-lg space-y-4 text-center">
            <div className="mx-auto w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-600 text-xl font-bold">
              ⚠️
            </div>
            <h3 className="font-serif text-slate-900 text-lg font-medium tracking-wide uppercase">
              Tautan Persetujuan Kedaluwarsa
            </h3>
            <p className="text-xs text-slate-500">
              Batas waktu persetujuan untuk permohonan variasi ini telah berakhir.
            </p>
            <p className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded border border-slate-100 leading-relaxed">
              Permohonan ini harus diajukan ulang oleh pemohon (<strong>{requestData.submitter_name}</strong>) untuk membuat tautan baru yang aktif.
            </p>
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setShowExpiredPopup(false)}
                className="px-6 py-2 bg-rose-650 hover:bg-rose-500 text-white rounded text-xs font-bold tracking-wider uppercase shadow-sm transition"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup File Viewer Modal */}
      {showViewerAttachment && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-serif font-bold text-slate-800 text-base uppercase tracking-wide">
                {showViewerAttachment.title || 'Pratinjau Lampiran'}
              </h3>
              <button 
                onClick={() => setShowViewerAttachment(null)} 
                className="text-slate-400 hover:text-slate-650 font-bold text-lg cursor-pointer h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex justify-center items-center bg-slate-105 min-h-[300px]">
              {showViewerAttachment.type === 'image' || showViewerAttachment.content.startsWith('data:image/') ? (
                <img 
                  src={showViewerAttachment.content} 
                  alt="Attachment Preview" 
                  className="max-w-full max-h-[60vh] object-contain rounded border border-slate-200 shadow-md bg-white p-2" 
                />
              ) : showViewerAttachment.content.includes('application/pdf') || showViewerAttachment.content.startsWith('data:application/pdf') ? (
                <iframe 
                  src={showViewerAttachment.content} 
                  title="PDF Document" 
                  className="w-full h-[60vh] border border-slate-200 rounded shadow-md bg-white"
                />
              ) : (
                <div className="text-center p-8 space-y-4">
                  <span className="text-4xl block">📄</span>
                  <p className="text-sm font-semibold text-slate-700 font-bold uppercase tracking-wider">Berkas Dokumen (Lampiran)</p>
                  <a 
                    href={showViewerAttachment.content} 
                    download={showViewerAttachment.title || 'attachment'}
                    className="inline-block bg-[#8B1A1A] hover:bg-[#C0392B] text-white font-bold px-6 py-2.5 rounded-lg text-xs transition shadow cursor-pointer uppercase tracking-wider"
                  >
                    📥 Unduh Lampiran
                  </a>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowViewerAttachment(null)}
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-650 rounded-lg text-xs font-bold hover:bg-slate-100 transition cursor-pointer uppercase tracking-wider"
              >
                Tutup Pratinjau
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

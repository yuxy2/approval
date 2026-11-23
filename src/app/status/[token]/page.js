'use client';

import React, { use, useState, useEffect } from 'react';
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

export default function StatusCheckPage({ params }) {
  const { token } = use(params);

  const [requestData, setRequestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  const [showViewerAttachment, setShowViewerAttachment] = useState(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`/api/tokens/${token}`);
      if (res.ok) {
        const data = await res.json();
        setRequestData(data.request);
        setRole(data.role);
      } else {
        alert('Invalid or expired token.');
      }
    } catch (err) {
      console.error('Error fetching status details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [token]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#8B1A1A] border-r-transparent"></div>
        <p className="ml-3 text-sm text-slate-500">Memuat lini masa status...</p>
      </div>
    );
  }

  if (!requestData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center text-slate-900">
        <div className="text-4xl mb-4">📋</div>
        <h3 className="text-lg font-semibold text-slate-700">Permohonan Tidak Ditemukan</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
          Silakan periksa tautan yang diberikan di email Anda atau hubungi admin.
        </p>
      </div>
    );
  }

  const getStatusDisplay = (status) => {
    switch (status) {
      case 'PENDING_PM':
        return {
          badge: '⏳ Menunggu Penilaian PM',
          color: 'bg-[#F5E8E8] text-[#8B1A1A] border-[#8B1A1A]/20',
          desc: 'Permohonan variasi telah diajukan dan sedang ditinjau untuk penilaian dampak biaya serta jadwal oleh Manajer Proyek.'
        };
      case 'PENDING_CLIENT':
        return {
          badge: '✉️ Menunggu Persetujuan Klien',
          color: 'bg-blue-50 text-blue-700 border-blue-200',
          desc: 'Rincian penyesuaian biaya dan jadwal telah disiapkan dan dikirimkan ke klien untuk persetujuan akhir.'
        };
      case 'REJECTED_TO_SUBMITTER':
        return {
          badge: '⚠️ Revisi ke Pemohon',
          color: 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse',
          desc: 'Manajer Proyek meminta revisi pada rincian lingkup proyek. Formulir dikembalikan ke pihak pemohon.'
        };
      case 'REJECTED_TO_PM':
        return {
          badge: '🔄 Revisi ke PM',
          color: 'bg-orange-50 text-orange-700 border-orange-200',
          desc: 'Klien meminta penyesuaian pada rincian biaya atau jadwal. Formulir dikembalikan ke Manajer Proyek.'
        };
      case 'APPROVED':
        return {
          badge: '✓ Variasi Disetujui',
          color: 'bg-emerald-50 text-emerald-700 border-emerald-250',
          desc: 'Permohonan variasi telah disetujui dan ditandatangani secara digital oleh klien. Berkas ini telah diarsipkan secara resmi.'
        };
      default:
        return {
          badge: status,
          color: 'bg-slate-50 text-slate-700 border-slate-200',
          desc: ''
        };
    }
  };

  const statusConfig = getStatusDisplay(requestData.status);

  const pmEvent = requestData.workflow_events?.find(e => e.step_type === 'pm_review' && e.action === 'approve');
  const clientEvent = requestData.workflow_events?.find(e => e.step_type === 'client_review' && e.action === 'approve');

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-slate-900">
      {/* Back Link & Action Bar */}
      <div className="mb-6 flex justify-between items-center no-print">
        <Link href="/" className="text-xs text-slate-500 hover:text-[#8B1A1A] flex items-center gap-1.5 transition">
          ← Kembali ke Dashboard
        </Link>
        <div className="flex gap-3 items-center">
          {requestData.status === 'APPROVED' && (
            <button
              onClick={() => window.print()}
              className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold uppercase tracking-wider transition shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              🖨️ Cetak Dokumen PDF Resmi
            </button>
          )}
          {requestData.status === 'PENDING_PM' && role === 'PM' && (
            <Link href={`/review/${token}`} className="text-xs bg-[#8B1A1A] hover:bg-[#C0392B] text-white px-3.5 py-2 rounded-lg font-bold uppercase tracking-wider transition shadow-sm">
              Buka Panel Penilaian PM →
            </Link>
          )}
          {requestData.status === 'PENDING_CLIENT' && role === 'Client' && (
            <Link href={`/approve/${token}`} className="text-xs bg-[#8B1A1A] hover:bg-[#C0392B] text-white px-3.5 py-2 rounded-lg font-bold uppercase tracking-wider transition shadow-sm">
              Buka Panel Persetujuan Klien →
            </Link>
          )}
          {requestData.status === 'REJECTED_TO_SUBMITTER' && (
            <Link href={`/new?revisionId=${requestData.id}`} className="text-xs bg-rose-600 hover:bg-rose-500 text-white px-3.5 py-2 rounded-lg font-bold uppercase tracking-wider transition">
              Perbaiki Formulir Pengajuan →
            </Link>
          )}
        </div>
      </div>

      {/* Single-Column Stacked Layout */}
      <div className="space-y-8">
        
        {/* 1. Live Status Card (no-print) */}
        <div className="glass-panel-glow p-6 rounded-xl border border-slate-205 bg-[#fafafa] text-center no-print">
          <span className="text-[10px] text-slate-500 uppercase tracking-widest block mb-2 font-bold">Status Terkini</span>
          <span className={`inline-flex items-center px-4 py-1.5 rounded text-sm font-bold border ${statusConfig.color}`}>
            {statusConfig.badge}
          </span>
          <p className="text-xs text-slate-650 mt-4 leading-relaxed font-medium max-w-2xl mx-auto">
            {statusConfig.desc}
          </p>
        </div>

        {/* 2. Main Details Summary Card (printable-card) */}
        <div className="printable-card glass-panel-glow p-8 rounded-xl border border-slate-200 bg-[#fafafa] space-y-8 shadow-sm">
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

          {/* Top Meta Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-8 text-sm border-b border-slate-200 pb-6 mb-6">
            <div className="flex gap-4">
              <span className="w-32 font-bold text-slate-600">Lokasi Proyek:</span>
              <span className="text-slate-900 font-medium">{requestData.project_address}</span>
            </div>
            <div className="flex gap-4">
              <span className="w-32 font-bold text-slate-600">ID Permohonan:</span>
              <span className="text-slate-900 font-mono font-medium">{requestData.submission_id}</span>
            </div>
            <div className="flex gap-4">
              <span className="w-32 font-bold text-slate-600">Tanggal Pengajuan:</span>
              <span className="text-slate-900 font-medium">{new Date(requestData.date_of_request).toLocaleDateString('id-ID')}</span>
            </div>
            <div className="flex gap-4">
              <span className="w-32 font-bold text-slate-600">Status:</span>
              <span className="text-[#8B1A1A] font-bold uppercase">{requestData.status}</span>
            </div>
          </div>

          {/* Section 1: Project Scope */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#8B1A1A] uppercase tracking-wider border-b border-slate-200 pb-1.5">
              Bagian 1: Rincian & Lingkup Proyek
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">Lokasi / ID Proyek</span>
                <span className="text-slate-900 font-medium text-base">{requestData.project_address}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">Diajukan Oleh</span>
                <span className="text-slate-900 font-medium text-base">
                  {requestData.submitter_name} ({requestData.submitter_role})
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">Email Pemohon</span>
                <span className="text-slate-900 text-base">{requestData.submitter_email}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">Manajer Proyek Ditugaskan</span>
                <span className="text-slate-900 font-medium text-base">
                  {requestData.pm_user?.name} ({requestData.pm_user?.email})
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">Tanggal Permohonan</span>
                <span className="text-slate-900 text-base">{new Date(requestData.date_of_request).toLocaleDateString('id-ID')}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">Email Klien</span>
                <span className="text-slate-900 text-base">{requestData.client_email}</span>
              </div>
            </div>

            <div className="space-y-4 pt-3 text-sm">
              <div>
                <span className="text-slate-500 font-bold block mb-1.5 uppercase tracking-wider text-xs">Deskripsi Perubahan Lingkup:</span>
                <p className="bg-white p-4 rounded-lg text-slate-700 leading-relaxed border border-slate-200 whitespace-pre-wrap">
                  {requestData.description}
                </p>
              </div>
              <div>
                <span className="text-slate-500 font-bold block mb-1.5 uppercase tracking-wider text-xs">Alasan Variasi:</span>
                <p className="bg-white p-4 rounded-lg text-slate-700 leading-relaxed border border-slate-200 whitespace-pre-wrap">
                  {requestData.reason}
                </p>
              </div>
              <div>
                <span className="text-slate-500 font-bold block mb-1.5 uppercase tracking-wider text-xs">Dampak Terhadap Proyek:</span>
                <p className="bg-white p-4 rounded-lg text-slate-700 leading-relaxed border border-slate-200 whitespace-pre-wrap">
                  {requestData.project_impact}
                </p>
              </div>
            </div>
          </div>

          {/* Attachments Section (no-print) */}
          {(requestData.contractor_attachment || requestData.prm_attachment) && (
            <div className="space-y-6 border-t border-slate-200 pt-6 no-print">
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

          {/* Section 2: PM Costing */}
          <div className="space-y-4 border-t border-slate-200 pt-6">
            <h3 className="text-sm font-bold text-[#8B1A1A] uppercase tracking-wider border-b border-slate-200 pb-1.5">
              Bagian 2: Penilaian Biaya Manajer Proyek
            </h3>
            
            {pmEvent ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">Dampak Finansial</span>
                  <span className={`font-bold text-base uppercase ${pmEvent.financial_impact === 'increase' ? 'text-rose-700' : 'text-emerald-705'}`}>
                    {pmEvent.financial_impact === 'increase' ? 'Bertambah' : pmEvent.financial_impact === 'decrease' ? 'Berkurang' : 'Tidak Ada'} ({pmEvent.financial_impact === 'none' ? 'Tanpa biaya' : `Rp ${Number(pmEvent.financial_amount).toLocaleString('id-ID')}`})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">Dampak Jadwal</span>
                  <span className="text-slate-900 font-bold text-base uppercase">
                    {pmEvent.schedule_impact === 'adds' ? 'Bertambah' : pmEvent.schedule_impact === 'reduces' ? 'Berkurang' : 'Tidak Ada'} ({pmEvent.schedule_impact === 'none' ? 'Tanpa penundaan' : `${pmEvent.schedule_days} hari`})
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">Nama Perwakilan Perusahaan</span>
                  <span className="text-slate-900 font-bold text-base">{pmEvent.company_rep_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">Tanggal Penilaian</span>
                  <span className="text-slate-900 text-base">{new Date(pmEvent.created_at || pmEvent.createdAt).toLocaleDateString('id-ID')}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-500 font-bold block mb-1.5 uppercase tracking-wider text-xs">Catatan Manajer Proyek:</span>
                  <p className="bg-white p-4 rounded-lg text-slate-750 border border-slate-200 italic leading-relaxed">
                    "{pmEvent.pm_notes || 'Tidak ada catatan.'}"
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">Belum ada penilaian PM yang dicatat.</p>
            )}
          </div>

          {/* Section 3: Client Sign-off */}
          <div className="space-y-4 border-t border-slate-200 pt-6">
            <h3 className="text-sm font-bold text-[#8B1A1A] uppercase tracking-wider border-b border-slate-200 pb-1.5">
              Bagian 3: Persetujuan & Tanda Tangan Klien
            </h3>
            
            {clientEvent ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">Nama Penandatangan Klien</span>
                  <span className="text-slate-900 font-bold text-base">{clientEvent.client_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-xs font-semibold uppercase tracking-wider">Tanggal Persetujuan</span>
                  <span className="text-slate-900 text-base">{new Date(clientEvent.client_date).toLocaleDateString('id-ID')}</span>
                </div>
                <div className="sm:col-span-2 flex justify-center py-4 bg-white border border-slate-200 rounded-lg shadow-sm">
                  {clientEvent.signature_image && (
                    <img
                      src={clientEvent.signature_image}
                      alt="Tanda tangan klien"
                      className="max-h-[100px] object-contain p-2 bg-slate-50 border border-slate-200 rounded-md"
                    />
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 italic">Belum ada tanda tangan persetujuan klien.</p>
            )}
          </div>

        </div>

        {/* 3. Event Log Timeline Card (no-print) */}
        <div className="glass-panel-glow p-6 rounded-xl border border-slate-200 bg-[#fafafa] no-print">
          <h3 className="text-sm font-bold text-[#8B1A1A] uppercase tracking-wider mb-6 border-b border-slate-200 pb-2">
            📅 Riwayat & Lini Masa Alur Persetujuan
          </h3>
          
          <div className="relative border-l border-slate-200 pl-6 ml-3 space-y-6">
            {requestData.workflow_events?.map((evt) => {
              let icon = '📝';
              let label = '';
              let details = '';
              
              if (evt.action === 'submit') {
                label = 'Permohonan Diajukan';
                details = `Diajukan oleh ${requestData.submitter_name} (${requestData.submitter_role})`;
              } else if (evt.action === 'approve') {
                if (evt.step_type === 'pm_review') {
                  icon = '✓';
                  label = 'Disetujui & Dinilai oleh PM';
                  details = `Penilaian biaya diselesaikan oleh ${evt.company_rep_name}`;
                } else if (evt.step_type === 'client_review') {
                  icon = '🤝';
                  label = 'Disetujui & Ditandatangani Klien';
                  details = `Ditandatangani secara digital oleh ${evt.client_name}`;
                }
              } else if (evt.action === 'reject') {
                icon = '🔄';
                if (evt.step_type === 'pm_review') {
                  label = 'Permintaan Revisi oleh PM';
                  details = `Dikembalikan ke pemohon untuk revisi: "${evt.pm_notes}"`;
                } else if (evt.step_type === 'client_review') {
                  label = 'Permintaan Revisi oleh Klien';
                  details = `Dikembalikan ke PM untuk penyesuaian: "${evt.pm_notes}"`;
                }
              } else if (evt.action === 'revise') {
                icon = '🔄';
                label = 'Direvisi & Diajukan Ulang';
                details = `Rincian yang diperbarui diajukan kembali`;
              }

              return (
                <div key={evt.id} className="relative">
                  <span className="absolute -left-[35px] top-0.5 bg-white border border-slate-250 rounded-full h-6 w-6 flex items-center justify-center text-xs text-[#8B1A1A] font-bold shadow-sm">
                    {icon}
                  </span>
                  <div className="text-sm">
                    <div className="font-bold text-slate-900">{label}</div>
                    <div className="text-slate-650 mt-0.5 leading-relaxed">{details}</div>
                    <div className="text-[10px] text-slate-450 mt-1">
                      {new Date(evt.created_at || evt.createdAt).toLocaleString('id-ID')}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Popup File Viewer Modal (no-print) */}
      {showViewerAttachment && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4 z-[60] animate-fade-in no-print">
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

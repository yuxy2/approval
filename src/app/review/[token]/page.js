'use client';

import React, { use, useState, useEffect } from 'react';
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

export default function PMReviewPage({ params }) {
  const { token } = use(params);
  const router = useRouter();

  const [requestData, setRequestData] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [showExpiredPopup, setShowExpiredPopup] = useState(false);

  // PM Step 2 specific inputs
  const [financialImpactType, setFinancialImpactType] = useState('none');
  const [financialImpactAmount, setFinancialImpactAmount] = useState('');
  const [scheduleImpactType, setScheduleImpactType] = useState('none');
  const [scheduleImpactDays, setScheduleImpactDays] = useState('');
  const [pmRepName, setPmRepName] = useState('');
  const [pmComments, setPmComments] = useState('');
  const [expirationDays, setExpirationDays] = useState('7');
  const [prmAttachments, setPrmAttachments] = useState([]);
  const [showViewerAttachment, setShowViewerAttachment] = useState(null);
  const [clientEmail, setClientEmail] = useState('');

  // Rejection logic
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const fetchRequestByToken = async () => {
    try {
      const res = await fetch(`/api/tokens/${token}`);
      if (res.ok) {
        const data = await res.json();
        setRequestData(data.request);
        setRole(data.role);

        const expired = data.expiresAt && new Date() > new Date(data.expiresAt);
        setIsExpired(expired);
        if (expired && (data.request?.status === 'PENDING_PM' || data.request?.status === 'REJECTED_TO_PM')) {
          setShowExpiredPopup(true);
        }

        const req = data.request;
        setClientEmail(req.client_email || '');
        if (req.prm_attachment) {
          setPrmAttachments(parseAttachments(req.prm_attachment));
        }
        
        // Find PM approval event if it exists
        const pmEvent = req.workflow_events?.find(e => e.step_type === 'pm_review');
        if (pmEvent) {
          setFinancialImpactType(pmEvent.financial_impact || 'none');
          setFinancialImpactAmount(pmEvent.financial_amount ? pmEvent.financial_amount.toString() : '');
          setScheduleImpactType(pmEvent.schedule_impact || 'none');
          setScheduleImpactDays(pmEvent.schedule_days ? pmEvent.schedule_days.toString() : '');
          setPmRepName(pmEvent.company_rep_name || '');
          setPmComments(pmEvent.pm_notes || '');
        } else {
          setPmRepName(req.pm_user?.name || '');
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

  const handleAction = async (actionType) => {
    setSubmitting(true);
    
    const payload = {
      action: actionType,
      token,
      financialImpactType,
      financialImpactAmount: financialImpactType === 'none' ? 0 : parseFloat(financialImpactAmount || 0),
      scheduleImpactType,
      scheduleImpactDays: scheduleImpactType === 'none' ? 0 : parseInt(scheduleImpactDays || 0),
      pmRepName,
      pmComments,
      prmAttachment: prmAttachments.length > 0 ? JSON.stringify(prmAttachments) : '',
      expirationDays: expirationDays,
      rejectionNotes: actionType === 'PM_REJECT' ? rejectionNotes : undefined,
      clientEmail
    };

    try {
      const res = await fetch(`/api/requests/${requestData.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        router.push(`/status/${token}`);
      } else {
        const err = await res.json();
        alert('Action failed: ' + (err.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('API error:', err);
      alert('Error updating status');
    } finally {
      setSubmitting(false);
      setShowRejectModal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#8B1A1A] border-r-transparent"></div>
        <p className="ml-3 text-sm text-slate-500">Memuat rincian penilaian PM...</p>
      </div>
    );
  }

  if (!requestData) return null;

  const isLinkExpired = isExpired && (requestData.status === 'PENDING_PM' || requestData.status === 'REJECTED_TO_PM');

  if (role !== 'PM' && requestData.status !== 'PENDING_PM' && requestData.status !== 'REJECTED_TO_PM') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center text-slate-900">
        <div className="text-4xl mb-4">⚠️</div>
        <h3 className="text-lg font-semibold text-slate-700">Akses Peninjauan Dibatasi</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-md">
          Tautan ini tidak valid untuk peninjauan PM, atau permohonan telah diproses sebelumnya.
        </p>
        <Link href={`/status/${token}`} className="mt-6 inline-flex items-center text-xs font-semibold text-[#8B1A1A] border border-[#8B1A1A]/30 hover:border-[#8B1A1A]/70 px-4 py-2 rounded transition">
          Lihat Halaman Status
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-slate-900">
      {/* Navigation */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <Link href="/" className="text-xs text-slate-500 hover:text-[#8B1A1A] flex items-center gap-1.5 transition">
          ← Kembali ke Dashboard
        </Link>
        <Link href={`/status/${token}`} className="text-xs text-[#8B1A1A] hover:underline flex items-center gap-1 transition">
          🔍 Lihat Status Langsung & Riwayat
        </Link>
      </div>

      <div className="glass-panel-glow p-4 sm:p-8 rounded-xl border border-slate-200 bg-[#fafafa]">
        {/* Corporate Document Header */}
        <div className="bg-[#e4dfdf] px-4 sm:px-8 py-5 sm:py-6 flex flex-col md:flex-row print:flex-row items-center md:items-start print:items-center justify-between gap-4 sm:gap-8 border-b border-slate-350 -mx-4 -mt-4 sm:-mx-8 sm:-mt-8 rounded-t-xl print:mx-0 print:mt-0 print:rounded-none mb-6 sm:mb-8 text-center md:text-right">
          {/* Column 1: Logo */}
          <div className="flex-shrink-0 flex justify-center md:justify-start print:justify-start md:w-56 print:w-auto pt-1">
            <img src="/EE-wide.png" alt="Elevate Equity Logo" className="h-9 sm:h-12 print:h-9 object-contain" />
          </div>
          {/* Column 2: Title */}
          <div className="flex-1 text-center md:text-right print:text-right">
            <h1 className="text-xl sm:text-3xl md:text-4xl font-sans font-bold tracking-[0.15em] sm:tracking-[0.3em] md:tracking-[0.45em] text-slate-900 uppercase print:text-[32px] print:tracking-[0.28em] print:whitespace-nowrap">
              Permohonan Variasi
            </h1>
          </div>
        </div>

        {/* Subtitle / Step Details & Badges */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 mb-6 gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <p className="text-[10px] sm:text-[11px] text-slate-500 uppercase font-mono tracking-wider break-all">
              Lokasi Proyek: <span className="font-semibold text-slate-700">{requestData.project_address}</span>
            </p>
            <div className="text-[10px] bg-[#F5E8E8] text-[#8B1A1A] px-2.5 py-0.5 rounded border border-[#8B1A1A]/20 font-bold">
              {requestData.status === 'REJECTED_TO_PM' ? '🔄 Revisi ke PM' : '⏳ Menunggu Penilaian PM'}
            </div>
          </div>
          <span className="text-[9px] sm:text-[10px] text-[#8B1A1A] bg-[#F5E8E8] px-2 py-0.5 rounded border border-[#8B1A1A]/20 font-semibold uppercase tracking-wider leading-relaxed">
            Langkah 2: Peninjauan PM — Penilaian Biaya & Verifikasi Rinci
          </span>
        </div>

        {/* Client Rejection warning banner */}
        {requestData.status === 'REJECTED_TO_PM' && (
          <div className="mb-8 p-4 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-800">
            <h4 className="font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5 text-orange-850">
              🔄 Klien Meminta Revisi Penilaian Biaya
            </h4>
            <p className="italic bg-white p-2.5 rounded mt-1 border border-orange-100">
              "{requestData.workflow_events?.find(e => e.step_type === 'client_review' && e.action === 'reject')?.pm_notes || 'Klien meminta penyesuaian biaya.'}"
            </p>
          </div>
        )}

        <div className="space-y-8">
          
          {/* Read-Only Request Details */}
          <div className="space-y-6 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-[#8B1A1A] uppercase tracking-wider border-b border-slate-100 pb-2">
              1. Lingkup Pengajuan Lapangan (Hanya Baca)
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-sm">
              <div>
                <span className="text-slate-500 block font-semibold uppercase tracking-wider text-xs">Lokasi / ID Proyek</span>
                <span className="text-slate-900 font-medium text-base">{requestData.project_address}</span>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold uppercase tracking-wider text-xs">Diajukan Oleh</span>
                <span className="text-slate-900 font-medium text-base">
                  {requestData.submitter_name} ({requestData.submitter_role})
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-sm">
                <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Tanggal Permohonan</span>
                <span className="text-slate-950 font-bold text-base flex items-center gap-1.5 mt-0.5">
                  🗓️ {new Date(requestData.date_of_request).toLocaleDateString('id-ID')}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block font-semibold uppercase tracking-wider text-xs">Email Klien</span>
                <span className="text-[#8B1A1A] font-medium text-base">{requestData.client_email || 'Belum diisi oleh pemohon'}</span>
              </div>
              {requestData.contractor_attachment && parseAttachments(requestData.contractor_attachment).length > 0 && (
                <div className="bg-[#fcf8f8] p-4 rounded-lg border border-[#8B1A1A]/10 shadow-sm space-y-3 sm:col-span-2">
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Lampiran Berkas Pemohon</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {parseAttachments(requestData.contractor_attachment).map((file, idx) => {
                      const badge = getFileBadge(file.name, file.content);
                      const isImg = file.content.startsWith('data:image/');
                      return (
                        <div key={idx} className="bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {isImg ? (
                              <img src={file.content} alt={file.name} className="h-9 w-9 object-cover rounded border border-slate-200 bg-slate-50" />
                            ) : (
                              <div className="h-9 w-9 bg-slate-50 rounded border border-slate-200 flex items-center justify-center text-lg">
                                📄
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold truncate text-slate-800 max-w-[150px]" title={file.name}>
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
                            className="inline-flex items-center justify-center bg-white border border-[#8B1A1A]/20 hover:border-[#8B1A1A]/40 text-[#8B1A1A] text-[10px] font-bold px-2.5 py-1.5 rounded transition shadow-sm cursor-pointer"
                          >
                            Lihat
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <hr className="border-slate-100" />

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 font-medium block mb-1">Deskripsi Variasi:</span>
                <p className="text-slate-700 bg-slate-50 p-3 rounded leading-relaxed border border-slate-200 whitespace-pre-wrap">
                  {requestData.description || 'Tidak ada deskripsi.'}
                </p>
              </div>

              <div>
                <span className="text-slate-500 font-medium block mb-1">Alasan Variasi:</span>
                <p className="text-slate-700 bg-slate-50 p-3 rounded leading-relaxed border border-slate-200 whitespace-pre-wrap">
                  {requestData.reason || 'Tidak ada alasan.'}
                </p>
              </div>

              <div>
                <span className="text-slate-500 font-medium block mb-1">Dampak Terhadap Proyek:</span>
                <p className="text-slate-700 bg-slate-50 p-3 rounded leading-relaxed border border-slate-200 whitespace-pre-wrap">
                  {requestData.project_impact || 'Tidak ada keterangan dampak.'}
                </p>
              </div>
            </div>
          </div>

          {/* PM Review & Costing Input */}
          <div className="space-y-5 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
            <h3 className="text-sm font-bold text-[#8B1A1A] uppercase tracking-wider border-b border-slate-100 pb-2">
              2. Penilaian & Biaya Manajer Proyek
            </h3>

            {isLinkExpired ? (
              <div className="space-y-4 p-5 bg-rose-50 border border-rose-200 rounded-lg text-xs">
                <div className="text-center pb-2 border-b border-rose-100">
                  <span className="text-xs text-rose-800 font-semibold tracking-widest uppercase">
                    ⚠️ Tautan Peninjauan Kedaluwarsa
                  </span>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Batas waktu penilaian PM untuk permohonan variasi ini telah berakhir.
                  </p>
                </div>
                <p className="text-slate-700 bg-white p-4 rounded border border-rose-100 text-center leading-relaxed">
                  Tautan penilaian permohonan ini telah kedaluwarsa. Anda tidak dapat meninjau atau mengirimkan biaya. Pemohon (<strong>{requestData.submitter_name}</strong>) harus mengajukan ulang permohonan untuk membuat tautan baru.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-5">
                  {/* Financial Impact Type Selection */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Dampak Finansial</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { key: 'increase', label: 'Bertambah' },
                        { key: 'decrease', label: 'Berkurang' },
                        { key: 'none', label: 'Tidak Ada' }
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setFinancialImpactType(item.key)}
                          className={`py-3 px-4 border rounded-lg text-sm font-bold uppercase tracking-wider transition ${
                            financialImpactType === item.key
                              ? 'bg-[#8B1A1A] text-white border-[#8B1A1A]'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-350'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Financial Impact Amount */}
                  {financialImpactType !== 'none' && (
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                        Total Dampak Finansial (Rp)
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-base font-bold text-slate-400">Rp</span>
                        <input
                          type="number"
                          required
                          placeholder="0"
                          value={financialImpactAmount}
                          onChange={(e) => setFinancialImpactAmount(e.target.value)}
                          className="w-full bg-white border border-slate-300 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg pl-12 pr-4 py-3 text-base text-slate-800 outline-none transition shadow-sm font-medium"
                        />
                      </div>
                    </div>
                  )}

                  {/* Schedule Impact Type Selection */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Dampak Jadwal</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { key: 'adds', label: 'Bertambah' },
                        { key: 'reduces', label: 'Berkurang' },
                        { key: 'none', label: 'Tidak Ada' }
                      ].map((item) => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setScheduleImpactType(item.key)}
                          className={`py-3 px-4 border rounded-lg text-sm font-bold uppercase tracking-wider transition ${
                            scheduleImpactType === item.key
                              ? 'bg-[#8B1A1A] text-white border-[#8B1A1A]'
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-350'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Schedule Impact Days */}
                  {scheduleImpactType !== 'none' && (
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                        Total Dampak Jadwal (hari)
                      </label>
                      <input
                        type="number"
                        required
                        placeholder="Contoh: 5"
                        value={scheduleImpactDays}
                        onChange={(e) => setScheduleImpactDays(e.target.value)}
                        className="w-full bg-white border border-slate-300 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-3 text-base text-slate-800 outline-none transition shadow-sm font-medium"
                      />
                    </div>
                  )}

                  {/* Document/PDF Attachment */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Lampiran Penilaian PM (Opsional)
                    </label>
                    <div className="mt-1 flex flex-col items-center justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg bg-[#fafafa] hover:border-[#8B1A1A]/50 transition-colors">
                      <div className="space-y-1 text-center w-full">
                        <span className="inline-block text-3xl mb-2">📄</span>
                        <div className="flex text-sm text-slate-650 justify-center">
                          <label htmlFor="prm-document" className="relative cursor-pointer bg-white rounded-md font-semibold text-[#8B1A1A] hover:text-[#C0392B] focus-within:outline-none px-2 py-0.5 border border-slate-200 shadow-sm">
                            <span>Unggah Berkas</span>
                            <input 
                              id="prm-document" 
                              name="prm-document" 
                              type="file" 
                              multiple
                              accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" 
                              onChange={(e) => {
                                const files = Array.from(e.target.files);
                                files.forEach(file => {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    setPrmAttachments(prev => [
                                      ...prev,
                                      { name: file.name, content: reader.result }
                                    ]);
                                  };
                                  reader.readAsDataURL(file);
                                });
                              }}
                              className="sr-only" 
                            />
                          </label>
                          <p className="pl-2 text-slate-500">atau seret & lepas berkas</p>
                        </div>
                        <p className="text-xs text-slate-400">PDF, Word, Excel, Gambar hingga 10MB (format campuran didukung)</p>
                      </div>
                      {prmAttachments.length > 0 && (
                        <div className="mt-6 w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {prmAttachments.map((file, index) => {
                            const badge = getFileBadge(file.name, file.content);
                            const isImg = file.content.startsWith('data:image/');
                            return (
                              <div key={index} className="relative bg-white border border-slate-200 rounded-lg p-3 shadow-sm flex items-center gap-3">
                                {isImg ? (
                                  <img src={file.content} alt={file.name} className="h-10 w-10 object-cover rounded border border-slate-200 bg-slate-50" />
                                ) : (
                                  <div className="h-10 w-10 bg-slate-50 rounded border border-slate-200 flex items-center justify-center text-xl">
                                    📄
                                  </div>
                                )}
                                <div className="flex-1 min-w-0 text-left">
                                  <div className="text-xs font-semibold truncate text-slate-800" title={file.name}>
                                    {file.name}
                                  </div>
                                  <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded border mt-1 ${badge.color}`}>
                                    {badge.label}
                                  </span>
                                </div>
                                <button 
                                  type="button" 
                                  onClick={() => {
                                    setPrmAttachments(prev => prev.filter((_, i) => i !== index));
                                  }}
                                  className="bg-rose-655 hover:bg-rose-500 text-white font-bold rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow cursor-pointer transition-transform hover:scale-110"
                                >
                                  ✕
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rep Name / Signature */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Nama Penandatangan Perwakilan Perusahaan
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Budi Santoso"
                      value={pmRepName}
                      onChange={(e) => setPmRepName(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-3 text-base text-slate-800 outline-none transition shadow-sm"
                    />
                  </div>

                  {/* Client Email */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                      Email Klien
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="Masukkan alamat email klien"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-3 text-base text-slate-800 outline-none transition shadow-sm"
                    />
                    <span className="text-xs text-slate-500 mt-1.5 block">
                      * Klien akan menerima tautan persetujuan dan tanda tangan di alamat email ini.
                    </span>
                  </div>

                  {/* Client Link Expiration */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Masa Berlaku Tautan Klien</label>
                    <select
                      value={expirationDays}
                      onChange={(e) => setExpirationDays(e.target.value)}
                      className="w-full bg-white border border-slate-350 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-3 text-base text-slate-800 outline-none transition shadow-sm h-12 bg-white"
                    >
                      <option value="1m">1 Menit (Uji Coba)</option>
                      <option value="5m">5 Menit (Uji Coba)</option>
                      <option value="10m">10 Menit (Uji Coba)</option>
                      <option value="1">1 Hari</option>
                      <option value="3">3 Hari</option>
                      <option value="7">7 Hari (Bawaan)</option>
                      <option value="14">14 Hari</option>
                      <option value="30">30 Hari</option>
                    </select>
                    <span className="text-xs text-slate-500 mt-1.5 block">
                      * Tautan aman yang dikirimkan ke klien akan otomatis kedaluwarsa setelah durasi ini.
                    </span>
                  </div>

                  {/* PM Comments */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Catatan / Komentar Manajer Proyek</label>
                    <textarea
                      rows={3}
                      placeholder="Tambahkan catatan internal atau rincian penjelasan estimasi biaya..."
                      value={pmComments}
                      onChange={(e) => setPmComments(e.target.value)}
                      className="w-full bg-white border border-slate-300 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-3 text-base text-slate-800 outline-none transition shadow-sm"
                    />
                  </div>

                </div>

                {/* Assessment Actions */}
                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(true)}
                    className="w-full sm:w-auto bg-white border border-rose-200 text-rose-700 font-semibold px-4 py-3 rounded-lg text-xs hover:bg-rose-50 active:scale-95 transition text-center cursor-pointer shadow-sm"
                  >
                    ⚠️ Minta Revisi ke Pemohon
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => handleAction('PM_APPROVE')}
                    disabled={submitting || !pmRepName || !clientEmail || (financialImpactType !== 'none' && !financialImpactAmount) || (scheduleImpactType !== 'none' && !scheduleImpactDays)}
                    className="w-full sm:w-auto bg-[#8B1A1A] hover:bg-[#C0392B] text-white font-bold px-6 py-3 rounded-lg text-xs active:scale-95 transition disabled:opacity-50 text-center shadow-sm cursor-pointer"
                  >
                    {submitting ? 'Mengirimkan...' : 'Setujui & Kirim ke Klien ✓'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full shadow-lg space-y-4">
            <h3 className="font-serif text-slate-900 text-lg font-medium tracking-wide uppercase">
              Minta Revisi dari Pemohon
            </h3>
            <p className="text-xs text-slate-500">
              Silakan cantumkan alasan permintaan revisi. Permohonan ini akan dikembalikan kepada pihak pemohon untuk diperbaiki.
            </p>
            <div>
              <label className="block text-[11px] text-slate-450 mb-1 uppercase font-medium">Alasan Revisi</label>
              <textarea
                required
                rows={3}
                placeholder="Jelaskan data apa yang kurang atau perlu diperbarui. Contoh: 'Mohon rincikan dampak terhadap jadwal di Bagian 3...'"
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded px-3 py-2 text-sm text-slate-800 outline-none transition"
              />
            </div>
            <div className="flex justify-end gap-2 text-xs font-semibold">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded transition"
              >
                Batal
              </button>
              <button
                onClick={() => handleAction('PM_REJECT')}
                disabled={submitting || !rejectionNotes}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded transition disabled:opacity-50"
              >
                Kirimkan untuk Revisi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expired Modal Popup */}
      {showExpiredPopup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full shadow-lg space-y-4 text-center">
            <div className="mx-auto w-12 h-12 bg-rose-50 rounded-full flex items-center justify-center text-rose-600 text-xl font-bold">
              ⚠️
            </div>
            <h3 className="font-serif text-slate-900 text-lg font-medium tracking-wide uppercase">
              Tautan Peninjauan Kedaluwarsa
            </h3>
            <p className="text-xs text-slate-500">
              Batas waktu untuk melakukan penilaian PM telah berakhir.
            </p>
            <p className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded border border-slate-100 leading-relaxed">
              Permohonan ini harus diajukan ulang oleh pemohon (<strong>{requestData.submitter_name}</strong>) untuk menghasilkan tautan peninjauan baru yang aktif.
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
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-200 transition"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex justify-center items-center bg-slate-100 min-h-[300px]">
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
                  className="w-full h-[60vh] border border-slate-200 rounded shadow-md" 
                />
              ) : (
                <div className="text-center p-8 space-y-4">
                  <span className="text-4xl block">📄</span>
                  <p className="text-sm font-semibold text-slate-700">Berkas Dokumen (Bukan gambar)</p>
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
                className="px-5 py-2.5 bg-white border border-slate-200 text-slate-650 rounded-lg text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
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

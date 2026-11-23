'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const ROLE_OPTIONS = [
  { value: 'Project Resource Manager', label: 'Project Resource Manager (PRM)' },
  { value: 'Lead Contractor', label: 'Lead Contractor (Kontraktor Utama)' },
  { value: 'Other', label: 'Lainnya' }
];

function parseAttachments(attachmentStr) {
  if (!attachmentStr) return [];
  try {
    const parsed = JSON.parse(attachmentStr);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {}
  
  if (attachmentStr.startsWith('data:')) {
    let name = 'Lampiran';
    if (attachmentStr.startsWith('data:image/')) {
      const match = attachmentStr.match(/^data:image\/(\w+);base64,/);
      const ext = match ? match[1] : 'jpg';
      name = `Lampiran.${ext}`;
    } else if (attachmentStr.startsWith('data:application/pdf')) {
      name = 'Lampiran.pdf';
    }
    return [{ name, content: attachmentStr }];
  }
  return [];
}

function getFileBadge(filename, content) {
  const ext = filename.split('.').pop().toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || content?.startsWith('data:image/')) {
    return { label: 'GAMBAR', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
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
  return { label: 'DOKUMEN', color: 'bg-slate-50 text-slate-700 border-slate-200' };
}

function SubmitterFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const revisionId = searchParams.get('revisionId');

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState('');
  
  // PM Dropdown staff list loaded from API
  const [pmList, setPmList] = useState([]);
  
  // Step 1 Form fields based on user specs
  const [projectAddress, setProjectAddress] = useState('');
  const [requestDate, setRequestDate] = useState('');
  const [submitterName, setSubmitterName] = useState('');
  const [submitterRole, setSubmitterRole] = useState(ROLE_OPTIONS[0].value);
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');
  const [projectImpact, setProjectImpact] = useState('');
  
  // Routing & PM/Client settings
  const [pmId, setPmId] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [expirationDays, setExpirationDays] = useState('7');
  const [contractorAttachments, setContractorAttachments] = useState([]);
  const isLeadContractor = submitterRole === 'Lead Contractor';

  // Reset client email if Lead Contractor is selected
  useEffect(() => {
    if (submitterRole === 'Lead Contractor') {
      setClientEmail('');
    }
  }, [submitterRole]);

  // Special PRM Role: fill Section 2 directly
  const [isPrmInitiator, setIsPrmInitiator] = useState(false);
  // PM Costing & Assessment fields (only visible when isPrmInitiator = true)
  const [financialImpactType, setFinancialImpactType] = useState('none');
  const [financialImpactAmount, setFinancialImpactAmount] = useState('');
  const [scheduleImpactType, setScheduleImpactType] = useState('none');
  const [scheduleImpactDays, setScheduleImpactDays] = useState('');
  const [pmRepName, setPmRepName] = useState('');
  const [pmComments, setPmComments] = useState('');

  // Fetch PM users list
  useEffect(() => {
    fetch('/api/pm-users')
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        setPmList(data);
        if (data.length > 0 && !pmId) {
          setPmId(data[0].id.toString());
        }
      })
      .catch((err) => console.error('Error fetching PM users:', err));
  }, []);

  // Load request if it is a revision
  useEffect(() => {
    if (revisionId) {
      setFetching(true);
      fetch(`/api/requests/${revisionId}`)
        .then((res) => res.ok ? res.json() : null)
        .then((data) => {
          if (data) {
            setProjectAddress(data.project_address || data.projectAddress);
            if (data.date_of_request || data.requestDate) {
              setRequestDate((data.date_of_request || data.requestDate).split('T')[0]);
            }
            setSubmitterName(data.submitter_name || data.submitterName);
            setSubmitterRole(data.submitter_role || data.submitterRole);
            setSubmitterEmail(data.submitter_email || data.submitterEmail);
            setDescription(data.description);
            setReason(data.reason);
            setProjectImpact(data.project_impact || data.projectImpact);
            setPmId(data.pm_id ? data.pm_id.toString() : (data.pmId ? data.pmId.toString() : ''));
            setClientEmail(data.client_email || data.clientEmail);
            
            // Rejection notes from PM or Client
            setRejectionNotes(data.rejectionNotes || data.workflow_events?.find(e => e.action === 'reject')?.pm_notes || '');
            setContractorAttachments(parseAttachments(data.contractor_attachment || ''));
          }
        })
        .catch((err) => console.error('Error fetching revision request:', err))
        .finally(() => setFetching(false));
    } else {
      setRequestDate(new Date().toISOString().split('T')[0]);
    }
  }, [revisionId]);

  // Sync PM rep name if role is PRM/PM
  useEffect(() => {
    if (submitterRole === 'Project Resource Manager') {
      setIsPrmInitiator(true);
      if (!pmRepName) setPmRepName(submitterName);
    } else {
      setIsPrmInitiator(false);
    }
  }, [submitterRole, submitterName]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pmId) {
      alert('Silakan pilih Manajer Proyek (PM).');
      return;
    }
    setLoading(true);

    const payload = {
      projectAddress,
      requestDate,
      submitterName,
      submitterRole,
      submitterEmail,
      pmId: pmId,
      clientEmail,
      description,
      reason,
      projectImpact,
      contractorAttachment: contractorAttachments.length > 0 ? JSON.stringify(contractorAttachments) : '',
      expirationDays: expirationDays,
      action: revisionId ? 'SUBMITTER_REVISE' : undefined
    };

    if (isPrmInitiator && financialImpactType) {
      payload.financialImpactType = financialImpactType;
      payload.financialImpactAmount = financialImpactType === 'none' ? 0 : parseFloat(financialImpactAmount || 0);
      payload.scheduleImpactType = scheduleImpactType;
      payload.scheduleImpactDays = scheduleImpactType === 'none' ? 0 : parseInt(scheduleImpactDays || 0);
      payload.pmRepName = pmRepName || submitterName;
      payload.pmComments = pmComments;
      payload.isDirectPrmSubmit = true;
    }

    try {
      const url = revisionId ? `/api/requests/${revisionId}` : '/api/requests';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        router.push('/');
      } else {
        const errorData = await res.json();
        alert('Gagal mengajukan: ' + (errorData.error || 'Terjadi kesalahan sistem'));
      }
    } catch (err) {
      console.error('Error submitting form:', err);
      alert('Terjadi kesalahan jaringan. Silakan periksa koneksi Anda.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#8B1A1A] border-r-transparent"></div>
        <p className="ml-3 text-sm text-slate-500">Memuat rincian revisi...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 text-slate-900">
      {/* Back link */}
      <div className="mb-6">
        <Link href="/" className="text-xs text-slate-500 hover:text-[#8B1A1A] flex items-center gap-1.5 transition">
          ← Kembali ke Dashboard
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

        {/* Subtitle / Step Details */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 mb-6 gap-3">
          <p className="text-[10px] sm:text-[11px] text-slate-500 uppercase font-mono tracking-wider">
            Lokasi Proyek: <span className="font-semibold text-slate-700">{projectAddress || "[Belum Diisi]"}</span>
          </p>
          <span className="text-[9px] sm:text-[10px] text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 font-semibold uppercase tracking-wider">
            Langkah 1: Pengajuan Variasi — Ajukan permohonan perubahan lingkup pekerjaan proyek
          </span>
        </div>

        {/* Rejection Alert Box */}
        {revisionId && rejectionNotes && (
          <div className="mb-8 p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            <h4 className="font-semibold uppercase tracking-wider mb-1 flex items-center gap-1.5 text-rose-800">
              ⚠️ Permintaan Revisi
            </h4>
            <p className="italic bg-white p-2.5 rounded mt-1 border border-rose-100">
              "{rejectionNotes}"
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Request Information */}
            <div className="space-y-5 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-[#8B1A1A] uppercase tracking-wider border-b border-slate-100 pb-2">
                1. Informasi Permohonan
              </h3>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Lokasi / ID Proyek</label>
                <span className="block text-xs text-slate-500 mb-2 leading-normal">
                  Format penulisan: <strong>[Unit]-[Nomor] [Nama Jalan]</strong> (contoh: <strong>1-105 Queen St</strong>)
                </span>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 1-105 Queen St"
                  value={projectAddress}
                  onChange={(e) => setProjectAddress(e.target.value)}
                  className="w-full bg-white border border-slate-300 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-3 text-base text-slate-900 font-medium outline-none transition shadow-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Tanggal Permohonan</label>
                  <input
                    type="date"
                    required
                    value={requestDate}
                    onChange={(e) => setRequestDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-3 text-base text-slate-900 font-semibold outline-none transition shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Peran / Jabatan</label>
                  <select
                    value={submitterRole}
                    onChange={(e) => setSubmitterRole(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-3 text-base text-slate-800 outline-none transition shadow-sm bg-white h-12"
                  >
                    {ROLE_OPTIONS.map((opt, idx) => (
                      <option key={idx} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Diajukan Oleh (Nama)</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Budi Santoso"
                    value={submitterName}
                    onChange={(e) => setSubmitterName(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-3 text-base text-slate-800 outline-none transition shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Email Anda</label>
                  <input
                    type="email"
                    required
                    placeholder="Email pemohon"
                    value={submitterEmail}
                    onChange={(e) => setSubmitterEmail(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-3 text-base text-slate-800 outline-none transition shadow-sm"
                  />
                </div>
              </div>
            </div>

            {/* Routing Settings */}
            <div className="space-y-5 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-[#8B1A1A] uppercase tracking-wider border-b border-slate-100 pb-2">
                2. Pengaturan Alur Persetujuan
              </h3>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Pilih Manajer Proyek (PM)</label>
                <select
                  value={pmId}
                  onChange={(e) => setPmId(e.target.value)}
                  className="w-full bg-white border border-slate-300 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-3 text-base text-slate-800 outline-none transition shadow-sm bg-white h-12"
                >
                  <option value="" disabled>-- Pilih PM --</option>
                  {pmList.map((pm) => (
                    <option key={pm.id} value={pm.id}>
                      {pm.name} ({pm.email})
                    </option>
                  ))}
                </select>
              </div>

              {submitterRole !== 'Lead Contractor' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Email Klien</label>
                  <input
                    type="email"
                    required={submitterRole !== 'Lead Contractor'}
                    placeholder="Masukkan alamat email klien"
                    value={clientEmail}
                    onChange={(e) => setClientEmail(e.target.value)}
                    className="w-full bg-white border border-slate-300 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-3 text-base text-slate-800 outline-none transition shadow-sm"
                  />
                  <span className="text-xs text-slate-500 mt-1.5 block">
                    * Tautan unik dan aman akan dikirimkan ke email ini untuk persetujuan & tanda tangan klien.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Masa Berlaku Tautan</label>
                <select
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(e.target.value)}
                  className="w-full bg-white border border-slate-300 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-3 text-base text-slate-800 outline-none transition shadow-sm bg-white h-12"
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
                  * Tautan verifikasi yang dikirim via email akan otomatis kedaluwarsa setelah durasi ini.
                </span>
              </div>
            </div>

          <hr className="border-slate-200" />

            {/* Scope & Variation Details */}
            <div className="space-y-5 bg-white p-6 rounded-lg border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-[#8B1A1A] uppercase tracking-wider border-b border-slate-100 pb-2">
                3. Rincian & Lingkup Variasi
              </h3>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Deskripsi Variasi</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Jelaskan perubahan lingkup pekerjaan yang sedang atau akan dilakukan..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-white border border-slate-300 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-3 text-base text-slate-800 outline-none transition shadow-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Alasan Variasi</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Mengapa variasi ini diperlukan? Contoh: 'Kondisi struktural tidak terduga di partisi kamar mandi'..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-white border border-slate-300 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-3 text-base text-slate-800 outline-none transition shadow-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Dampak Terhadap Proyek</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Jelaskan bagaimana hal ini memengaruhi gambar kerja, logistik, atau divisi kerja lain..."
                  value={projectImpact}
                  onChange={(e) => setProjectImpact(e.target.value)}
                  className="w-full bg-white border border-slate-300 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded-lg px-4 py-3 text-base text-slate-800 outline-none transition shadow-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  {isLeadContractor ? 'Foto Lapangan (Opsional)' : 'Lampiran Berkas (Opsional)'}
                </label>
                <div className="mt-1 flex flex-col items-center justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg bg-[#fafafa] hover:border-[#8B1A1A]/50 transition-colors">
                  <div className="space-y-1 text-center w-full">
                    <span className="inline-block text-3xl mb-2">{isLeadContractor ? '📷' : '📁'}</span>
                    <div className="flex text-sm text-slate-650 justify-center">
                      <label htmlFor="contractor-photo" className="relative cursor-pointer bg-white rounded-md font-semibold text-[#8B1A1A] hover:text-[#C0392B] focus-within:outline-none px-2 py-0.5 border border-slate-200 shadow-sm">
                        <span>{isLeadContractor ? 'Ambil Foto' : 'Unggah Berkas'}</span>
                        <input 
                          id="contractor-photo" 
                          name="contractor-photo" 
                          type="file" 
                          multiple={!isLeadContractor}
                          accept={isLeadContractor ? "image/*" : "image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"} 
                          capture={isLeadContractor ? "environment" : undefined}
                          onChange={(e) => {
                            const files = Array.from(e.target.files);
                            const filteredFiles = isLeadContractor 
                              ? files.filter(file => file.type.startsWith('image/')) 
                              : files;
                            if (isLeadContractor && filteredFiles.length < files.length) {
                              alert('Hanya foto/gambar kamera yang diizinkan untuk Kontraktor Utama.');
                            }
                            filteredFiles.forEach(file => {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setContractorAttachments(prev => [
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
                      <p className="pl-2 text-slate-500">{isLeadContractor ? 'via kamera' : 'atau seret & lepas berkas'}</p>
                    </div>
                    <p className="text-xs text-slate-400">
                      {isLeadContractor 
                        ? 'Khusus foto kamera langsung (PDF/Dokumen tidak diizinkan)' 
                        : 'PDF, Word, Excel, Gambar hingga 5MB (format campuran didukung)'}
                    </p>
                  </div>
                  {contractorAttachments.length > 0 && (
                    <div className="mt-6 w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {contractorAttachments.map((file, index) => {
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
                                setContractorAttachments(prev => prev.filter((_, i) => i !== index));
                              }}
                              className="bg-rose-650 hover:bg-rose-500 text-white font-bold rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow cursor-pointer transition-transform hover:scale-110"
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
            </div>

          {/* PRM Section 2 COSTING Fields (Visible only if submitter role is PM or Lead Contractor) */}
          {isPrmInitiator && (
            <div className="space-y-6 pt-4 border-t border-slate-200 bg-white p-5 rounded-lg border border-slate-100 shadow-sm">
              <div className="border-b border-slate-200 pb-2">
                <h3 className="text-xs font-semibold text-[#8B1A1A] uppercase tracking-wider">
                  ⚡ Penilaian Biaya PM (Mode Pengajuan Langsung PRM)
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Karena Anda mengajukan sebagai Manajer Sumber Daya Proyek, Anda dapat langsung melengkapi rincian biaya Bagian 2. Permohonan akan langsung diarahkan ke Klien.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">Dampak Finansial</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'increase', label: 'Bertambah' },
                      { key: 'decrease', label: 'Berkurang' },
                      { key: 'none', label: 'Tidak Ada' }
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setFinancialImpactType(item.key)}
                        className={`py-1.5 px-3 border rounded text-xs font-semibold uppercase tracking-wider transition ${
                          financialImpactType === item.key
                            ? 'bg-[#8B1A1A] text-white border-[#8B1A1A]'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {financialImpactType !== 'none' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      Total Dampak Finansial (Rp)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={financialImpactAmount}
                        onChange={(e) => setFinancialImpactAmount(e.target.value)}
                        className="w-full bg-white border border-slate-200 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded pl-9 pr-3 py-1.5 text-xs text-slate-800 outline-none transition"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-2">Dampak Jadwal</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'adds', label: 'Bertambah' },
                      { key: 'reduces', label: 'Berkurang' },
                      { key: 'none', label: 'Tidak Ada' }
                    ].map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setScheduleImpactType(item.key)}
                        className={`py-1.5 px-3 border rounded text-xs font-semibold uppercase tracking-wider transition ${
                          scheduleImpactType === item.key
                            ? 'bg-[#8B1A1A] text-white border-[#8B1A1A]'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {scheduleImpactType !== 'none' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">
                      Total Dampak Jadwal (hari)
                    </label>
                    <input
                      type="number"
                      placeholder="Contoh: 5"
                      value={scheduleImpactDays}
                      onChange={(e) => setScheduleImpactDays(e.target.value)}
                      className="w-full bg-white border border-slate-200 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded px-3 py-1.5 text-xs text-slate-800 outline-none transition"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Nama Penandatangan Perwakilan Perusahaan
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Budi Santoso"
                    value={pmRepName}
                    onChange={(e) => setPmRepName(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded px-3 py-1.5 text-xs text-slate-800 outline-none transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">
                    Catatan / Komentar Manajer Proyek
                  </label>
                  <input
                    type="text"
                    placeholder="Keterangan rincian estimasi biaya..."
                    value={pmComments}
                    onChange={(e) => setPmComments(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-[#8B1A1A] focus:ring-1 focus:ring-[#8B1A1A] rounded px-3 py-1.5 text-xs text-slate-800 outline-none transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Link
              href="/"
              className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 text-xs font-semibold px-5 py-2.5 rounded transition"
            >
              Batal
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="bg-[#8B1A1A] hover:bg-[#C0392B] text-white font-semibold px-6 py-2.5 rounded text-xs transition disabled:opacity-50"
            >
              {loading ? 'Mengirimkan...' : isPrmInitiator ? 'Kirim Langsung ke Klien →' : revisionId ? 'Ajukan Ulang Permohonan →' : 'Kirim untuk Ditinjau PM →'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default function SubmitterForm() {
  return (
    <Suspense fallback={
      <div className="flex-1 flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#8B1A1A] border-r-transparent"></div>
        <p className="ml-3 text-sm text-slate-500">Memuat formulir...</p>
      </div>
    }>
      <SubmitterFormContent />
    </Suspense>
  );
}

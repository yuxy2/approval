import { NextResponse } from 'next/server';
import { getRequestById, saveRequest, createWorkflowEvent } from '@/db';
import { sendNotification } from '@/utils/emails';
import { verifySession } from '@/utils/session';
import { generateRequestPDF } from '@/utils/pdf';
import { sendClientApprovalTelegramNotification, sendErrorTelegramNotification } from '@/utils/telegram';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const req = await getRequestById(id);
    
    if (!req) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    const session = await verifySession();
    if (session && session.role === 'pm' && String(req.pm_id) !== String(session.userId)) {
      return NextResponse.json({ success: false, error: 'Forbidden: You do not have permission to view this request' }, { status: 403 });
    }
    
    return NextResponse.json(req);
  } catch (error) {
    let session = null;
    let siteId = null;
    try {
      session = await verifySession();
    } catch (_) {}
    try {
      const p = await params;
      siteId = p.id;
    } catch (_) {}
    try {
      await sendErrorTelegramNotification(error, { siteId, session, path: request.nextUrl.pathname });
    } catch (tgErr) {
      console.error('Failed to send error notification to Telegram:', tgErr);
    }
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  let existingReq = null;
  let body = null;
  try {
    const { id } = await params;
    existingReq = await getRequestById(id);
    
    if (!existingReq) {
      return NextResponse.json({ success: false, error: 'Request not found' }, { status: 404 });
    }

    const session = await verifySession();
    if (session && session.role === 'pm' && String(existingReq.pm_id) !== String(session.userId)) {
      return NextResponse.json({ success: false, error: 'Forbidden: You do not have permission to modify this request' }, { status: 403 });
    }
    
    try {
      body = await request.json();
    } catch (err) {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }
    const { action } = body;
    const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    
    let updatedReqData = { ...existingReq };
    
    if (action === 'PM_APPROVE') {
      // 1. Set request status
      updatedReqData.status = 'PENDING_CLIENT';
      updatedReqData.prm_attachment = body.prmAttachment || null;
      if (body.clientEmail) {
        updatedReqData.client_email = body.clientEmail;
      }
      const saved = await saveRequest(updatedReqData);
      
      // 2. Create PM Review Approve event
      await createWorkflowEvent({
        request_id: saved.id,
        step_type: 'pm_review',
        action: 'approve',
        actor_email: saved.pm_user?.email || 'kurnia@apartmentspecialists.co.nz',
        financial_impact: body.financialImpactType || 'none',
        financial_amount: body.financialImpactAmount || 0,
        schedule_impact: body.scheduleImpactType || 'none',
        schedule_days: body.scheduleImpactDays || 0,
        company_rep_name: body.pmRepName,
        company_approved: true,
        pm_notes: body.pmComments || ''
      });
      
      // 3. Send notification to Client with Client token
      const amountStr = body.financialImpactType === 'none' ? 'Tidak ada dampak biaya' : `Rp ${Number(body.financialImpactAmount || 0).toLocaleString('id-ID')}`;
      const clientLink = `${origin}/approve/[token]`;
      
      await sendNotification({
        requestId: saved.id,
        recipientEmail: saved.client_email,
        type: 'CLIENT_SIGN_OFF',
        subject: `Tindakan Diperlukan: Persetujuan Permohonan Variasi untuk ${saved.project_address}`,
        body: `Halo,\n\nPermohonan Variasi untuk proyek "${saved.project_address}" telah disiapkan dan estimasi biaya telah dilengkapi oleh Manajer Proyek.\n\nDampak Finansial: ${amountStr}\nDampak Jadwal: ${body.scheduleImpactType === 'none' ? 'Tidak ada penundaan' : `${body.scheduleImpactDays} hari`}\nCatatan PM: "${body.pmComments || 'Tidak ada catatan'}"\n\nSilakan tinjau rinciannya dan tanda tangani persetujuan melalui tautan di bawah ini:`,
        link: clientLink,
        expirationDays: body.expirationDays || 7
      });

      // 4. Send notification to Submitter that PM approved and forwarded to Client
      const statusLink = `${origin}/status/[token]`;
      await sendNotification({
        requestId: saved.id,
        recipientEmail: saved.submitter_email,
        type: 'STATUS_UPDATE',
        subject: `Pembaruan: Permohonan Variasi untuk ${saved.project_address} Telah Disetujui PM`,
        body: `Halo ${saved.submitter_name},\n\nPermohonan Variasi Anda untuk "${saved.project_address}" telah ditinjau dan disetujui oleh Manajer Proyek (${body.pmRepName}).\n\nPermohonan telah diteruskan ke klien (${saved.client_email}) untuk persetujuan akhir dan tanda tangan.\n\nAnda dapat memantau status langsungnya di sini:`,
        link: statusLink
      });
      
      return NextResponse.json({ success: true, request: saved });

    } else if (action === 'PM_REJECT') {
      // 1. Set request status
      updatedReqData.status = 'REJECTED_TO_SUBMITTER';
      const saved = await saveRequest(updatedReqData);
      
      // 2. Create PM Review Reject event
      await createWorkflowEvent({
        request_id: saved.id,
        step_type: 'pm_review',
        action: 'reject',
        actor_email: saved.pm_user?.email || 'kurnia@apartmentspecialists.co.nz',
        pm_notes: body.rejectionNotes || 'Project Manager requested revision.'
      });
      
      // 3. Send notification to Submitter with token (Submitter can revise via /new?revisionId=X)
      // Since submitter revision is public-ish but needs security, we link back to their revision form
      const submitterLink = `${origin}/new?revisionId=${saved.id}`;
      
      await sendNotification({
        requestId: saved.id,
        recipientEmail: saved.submitter_email,
        type: 'STATUS_UPDATE',
        subject: `Revisi Diperlukan: Permohonan Variasi untuk ${saved.project_address} Dikembalikan`,
        body: `Halo ${saved.submitter_name},\n\nPermohonan Variasi Anda untuk "${saved.project_address}" memerlukan revisi.\n\nCatatan dari Manajer Proyek:\n"${body.rejectionNotes}"\n\nSilakan sesuaikan rincian lingkup dan ajukan ulang formulir menggunakan tautan di bawah ini:`,
        link: submitterLink
      });
      
      return NextResponse.json({ success: true, request: saved });

    } else if (action === 'CLIENT_APPROVE') {
      // 1. Set request status
      updatedReqData.status = 'APPROVED';
      const saved = await saveRequest(updatedReqData);
      
      // 2. Create Client Review Approve event
      await createWorkflowEvent({
        request_id: saved.id,
        step_type: 'client_review',
        action: 'approve',
        actor_email: saved.client_email,
        client_agreed: true,
        client_name: body.clientSignName,
        client_date: body.clientSignedAt || new Date().toISOString(),
        signature_image: body.signature,
        pm_notes: body.clientComments || '' // Reuse pm_notes column for client comments
      });

      // Re-fetch request details with all workflow events for the PDF generator
      const fullRequest = await getRequestById(saved.id);
      
      // Generate the PDF buffer
      let pdfBuffer = null;
      try {
        pdfBuffer = await generateRequestPDF(fullRequest);
      } catch (pdfErr) {
        console.error('Failed to generate PDF for attachment:', pdfErr);
      }
      
      // 3. Send notifications to ALL parties
      // Find PM costing details for the email
      const pmEvent = fullRequest.workflow_events?.find(e => e.step_type === 'pm_review' && e.action === 'approve') || body;
      
      // Send Telegram notification for client approval
      try {
        const clientEvent = {
          client_name: body.clientSignName,
          client_date: body.clientSignedAt || new Date().toISOString(),
          pm_notes: body.clientComments || ''
        };
        await sendClientApprovalTelegramNotification(saved, pmEvent, clientEvent);
      } catch (tgErr) {
        console.error('Failed to send Telegram approval notification:', tgErr);
      }

      const amountStr = pmEvent.financial_impact === 'none' ? 'Tidak ada dampak biaya' : `Rp ${Number(pmEvent.financial_amount || 0).toLocaleString('id-ID')}`;
      
      // We will send status view tokens to the parties
      const summaryLink = `${origin}/status/[token]`;
      
      // Submitter email
      await sendNotification({
        requestId: saved.id,
        recipientEmail: saved.submitter_email,
        type: 'FINAL_APPROVAL',
        subject: `DISETUJUI: Permohonan Variasi untuk ${saved.project_address} Telah Ditandatangani`,
        body: `Halo ${saved.submitter_name},\n\nKabar baik! Permohonan Variasi untuk "${saved.project_address}" telah DISETUJUI dan ditandatangani secara digital oleh klien.\n\nNama Penandatangan: ${body.clientSignName}\nDampak Finansial: ${amountStr}\n\nAnda dapat melihat salinan formulir resmi yang telah ditandatangani dan riwayat lini masa di sini:`,
        link: summaryLink,
        pdfBuffer
      });
      
      // PM email
      await sendNotification({
        requestId: saved.id,
        recipientEmail: saved.pm_user?.email || 'kurnia@apartmentspecialists.co.nz',
        type: 'FINAL_APPROVAL',
        subject: `DISETUJUI: Permohonan Variasi untuk ${saved.project_address} Telah Ditandatangani`,
        body: `Halo,\n\nKlien (${body.clientSignName}) telah menyetujui dan menandatangani Permohonan Variasi untuk "${saved.project_address}".\n\nDampak Finansial: ${amountStr}\nDampak Jadwal: ${pmEvent.schedule_impact === 'none' ? 'Tidak ada penundaan' : `${pmEvent.schedule_days} hari`}\n\nSilakan lanjutkan jadwal kerja dan pengadaan material terkait. Berkas resmi dapat dilihat di tautan berikut:`,
        link: summaryLink,
        pdfBuffer
      });
      
      // Client email
      await sendNotification({
        requestId: saved.id,
        recipientEmail: saved.client_email,
        type: 'FINAL_APPROVAL',
        subject: `DISETUJUI: Permohonan Variasi untuk ${saved.project_address} Telah Ditandatangani`,
        body: `Halo ${body.clientSignName},\n\nTerima kasih telah menyetujui dan menandatangani Permohonan Variasi untuk "${saved.project_address}".\n\nIni adalah tanda terima digital resmi Anda yang mengonfirmasi persetujuan tersebut.\nDampak Finansial: ${amountStr}\nDampak Jadwal: ${pmEvent.schedule_impact === 'none' ? 'Tidak ada penundaan' : `${pmEvent.schedule_days} hari`}\n\nAnda dapat melihat arsip dokumen dan lini masa kapan saja melalui tautan di bawah ini:`,
        link: summaryLink,
        pdfBuffer
      });
      
      return NextResponse.json({ success: true, request: saved });

    } else if (action === 'CLIENT_REJECT') {
      // 1. Set request status: Bounces to PM (REJECTED_TO_PM) - NOT Submitter
      updatedReqData.status = 'REJECTED_TO_PM';
      const saved = await saveRequest(updatedReqData);
      
      // 2. Create Client Review Reject event
      await createWorkflowEvent({
        request_id: saved.id,
        step_type: 'client_review',
        action: 'reject',
        actor_email: saved.client_email,
        pm_notes: body.rejectionNotes || 'Client declined. Cost adjust requested.'
      });
      
      // 3. Send notification to PM with token
      const pmLink = `${origin}/review/[token]`;
      
      await sendNotification({
        requestId: saved.id,
        recipientEmail: saved.pm_user?.email || 'kurnia@apartmentspecialists.co.nz',
        type: 'PM_REVIEW',
        subject: `REVISI: Klien Meminta Penyesuaian untuk ${saved.project_address}`,
        body: `Halo,\n\nKlien meminta penyesuaian/perubahan pada Permohonan Variasi untuk "${saved.project_address}".\n\nCatatan Revisi Klien:\n"${body.rejectionNotes}"\n\nSilakan sesuaikan rincian biaya/jadwal di Bagian 2 dan ajukan kembali permohonan melalui tautan di bawah ini:`,
        link: pmLink
      });

      // 4. Send notification to Submitter that Client rejected and bounced back to PM
      const statusLink = `${origin}/status/[token]`;
      await sendNotification({
        requestId: saved.id,
        recipientEmail: saved.submitter_email,
        type: 'STATUS_UPDATE',
        subject: `Pembaruan: Klien Meminta Penyesuaian untuk ${saved.project_address}`,
        body: `Halo ${saved.submitter_name},\n\nKlien meminta penyesuaian pada Permohonan Variasi untuk "${saved.project_address}".\n\nPermohonan telah dikembalikan ke Manajer Proyek untuk penyesuaian biaya dan jadwal kerja.\n\nCatatan Revisi Klien:\n"${body.rejectionNotes}"\n\nAnda dapat memantau statusnya di sini:`,
        link: statusLink
      });
      
      return NextResponse.json({ success: true, request: saved });

    } else if (action === 'SUBMITTER_REVISE') {
      // Submitter resubmits revised form
      updatedReqData.project_address = body.projectAddress;
      updatedReqData.date_of_request = new Date(body.requestDate || new Date());
      updatedReqData.submitter_name = body.submitterName;
      updatedReqData.submitter_role = body.submitterRole;
      updatedReqData.submitter_email = body.submitterEmail;
      updatedReqData.description = body.description || '';
      updatedReqData.reason = body.reason || '';
      updatedReqData.project_impact = body.projectImpact || '';
      updatedReqData.pm_id = String(body.pmId);
      updatedReqData.client_email = body.clientEmail;
      updatedReqData.contractor_attachment = body.contractorAttachment || null;
      
      // If PRM is revising directly with costings
      if (body.isDirectPrmSubmit) {
        updatedReqData.status = 'PENDING_CLIENT';
        updatedReqData.prm_attachment = body.prmAttachment || null;
      } else {
        updatedReqData.status = 'PENDING_PM';
      }
      
      const saved = await saveRequest(updatedReqData);
      
      // Create Submitter Revise event
      await createWorkflowEvent({
        request_id: saved.id,
        step_type: 'submission',
        action: 'revise',
        actor_email: saved.submitter_email
      });

      if (body.isDirectPrmSubmit) {
        // Record PM costing event
        await createWorkflowEvent({
          request_id: saved.id,
          step_type: 'pm_review',
          action: 'approve',
          actor_email: saved.submitter_email,
          financial_impact: body.financialImpactType || 'none',
          financial_amount: body.financialImpactAmount || 0,
          schedule_impact: body.scheduleImpactType || 'none',
          schedule_days: body.scheduleImpactDays || 0,
          company_rep_name: body.pmRepName || body.submitterName,
          company_approved: true,
          pm_notes: body.pmComments || ''
        });

        // Send direct client sign-off email
        const amountStr = body.financialImpactType === 'none' ? 'Tidak ada dampak biaya' : `Rp ${Number(body.financialImpactAmount || 0).toLocaleString('id-ID')}`;
        const clientLink = `${origin}/approve/[token]`;
        
        await sendNotification({
          requestId: saved.id,
          recipientEmail: saved.client_email,
          type: 'CLIENT_SIGN_OFF',
          subject: `Tindakan Diperlukan: Persetujuan Permohonan Variasi Direvisi untuk ${saved.project_address}`,
          body: `Halo,\n\nPermohonan Variasi yang telah direvisi untuk proyek "${saved.project_address}" telah disiapkan dan diperbarui.\n\nDampak Finansial: ${amountStr}\nDampak Jadwal: ${body.scheduleImpactType === 'none' ? 'Tidak ada penundaan' : `${body.scheduleImpactDays} hari`}\n\nSilakan tanda tangani persetujuan perubahan melalui tautan di bawah ini:`,
          link: clientLink,
          expirationDays: body.expirationDays || 7
        });
      } else {
        // Send PM review link
        const pmLink = `${origin}/review/[token]`;
        
        await sendNotification({
          requestId: saved.id,
          recipientEmail: saved.pm_user?.email || 'kurnia@apartmentspecialists.co.nz',
          type: 'PM_REVIEW',
          subject: `Tindakan Diperlukan: Permohonan Variasi Direvisi untuk ${saved.project_address}`,
          body: `Halo,\n\n${saved.submitter_name} telah mengajukan ulang versi revisi dari Permohonan Variasi untuk "${saved.project_address}".\n\nSilakan tinjau kembali melalui tautan di bawah ini:`,
          link: pmLink,
          expirationDays: body.expirationDays || 7
        });
      }
      
      return NextResponse.json({ success: true, request: saved });
    } else {
      return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    let session = null;
    let siteId = null;
    try {
      session = await verifySession();
    } catch (_) {}
    try {
      const p = await params;
      siteId = existingReq?.project_address || body?.projectAddress || p.id;
    } catch (_) {}
    try {
      await sendErrorTelegramNotification(error, { siteId, session, path: request.nextUrl.pathname });
    } catch (tgErr) {
      console.error('Failed to send error notification to Telegram:', tgErr);
    }
    console.error('API request POST error:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

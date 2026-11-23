import { NextResponse } from 'next/server';
import { getRequests, saveRequest, createWorkflowEvent } from '@/db';
import { sendNotification } from '@/utils/emails';
import { verifySession } from '@/utils/session';
import { sendErrorTelegramNotification } from '@/utils/telegram';

export async function GET() {
  try {
    const session = await verifySession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let list = await getRequests();
    if (session.role === 'pm') {
      list = list.filter(req => String(req.pm_id) === String(session.userId));
    } else if (session.role === 'contractor') {
      list = list.filter(req => req.submitter_email.toLowerCase() === session.email.toLowerCase());
    }
    // Role 'superadmin' sees all variation requests across the system
    
    return NextResponse.json(list);
  } catch (error) {
    let session = null;
    try {
      session = await verifySession();
    } catch (_) {}
    try {
      await sendErrorTelegramNotification(error, { siteId: null, session, path: '/api/requests (GET)' });
    } catch (tgErr) {
      console.error('Failed to send error notification to Telegram:', tgErr);
    }
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request) {
  let body = null;
  try {
    try {
      body = await request.json();
    } catch (err) {
      return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
    }

    if (!body) {
      return NextResponse.json({ success: false, error: 'Request body is required' }, { status: 400 });
    }
    
    const isLeadContractor = body.submitterRole === 'Lead Contractor';
    if (!body.projectAddress || (!body.clientEmail && !isLeadContractor) || !body.submitterName || !body.pmId) {
      return NextResponse.json({ 
        success: false, 
        error: isLeadContractor 
          ? 'Site ID, Submitter Name, and PM selection are required' 
          : 'Site ID, Submitter Name, Client Email, and PM selection are required' 
      }, { status: 400 });
    }
    
    // 1. Prepare variation request record details
    const newReqData = {
      projectAddress: body.projectAddress,
      requestDate: body.requestDate || new Date().toISOString().split('T')[0],
      submitterName: body.submitterName,
      submitterRole: body.submitterRole || 'Site Supervisor',
      submitterEmail: body.submitterEmail || 'site-team@apartment-specialists.com',
      pm_id: String(body.pmId),
      clientEmail: body.clientEmail || '',
      description: body.description || '',
      reason: body.reason || '',
      projectImpact: body.projectImpact || '',
      contractorAttachment: body.contractorAttachment || '',
      status: body.isDirectPrmSubmit ? 'PENDING_CLIENT' : 'PENDING_PM'
    };
    
    const savedRequest = await saveRequest(newReqData);
    const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    // 2. Create the submission workflow event
    await createWorkflowEvent({
      request_id: savedRequest.id,
      step_type: 'submission',
      action: 'submit',
      actor_email: savedRequest.submitter_email
    });

    // 3. Handle notifications and step routing
    if (body.isDirectPrmSubmit) {
      // PRM initiated both sections in one go. Record the PM costing approval event.
      await createWorkflowEvent({
        request_id: savedRequest.id,
        step_type: 'pm_review',
        action: 'approve',
        actor_email: savedRequest.submitter_email,
        financial_impact: body.financialImpactType || 'none',
        financial_amount: body.financialImpactAmount || 0,
        schedule_impact: body.scheduleImpactType || 'none',
        schedule_days: body.scheduleImpactDays || 0,
        company_rep_name: body.pmRepName || body.submitterName,
        company_approved: true,
        pm_notes: body.pmComments || ''
      });

      // Send direct sign-off link to Client
      const amountStr = body.financialImpactType === 'none' ? 'Tidak ada dampak biaya' : `Rp ${Number(body.financialImpactAmount || 0).toLocaleString('id-ID')}`;
      const clientLink = `${origin}/approve/[token]`;
      
      await sendNotification({
        requestId: savedRequest.id,
        recipientEmail: savedRequest.client_email,
        type: 'CLIENT_SIGN_OFF',
        subject: `Tindakan Diperlukan: Persetujuan Permohonan Variasi untuk ${savedRequest.project_address}`,
        body: `Halo,\n\nPermohonan Variasi baru untuk proyek "${savedRequest.project_address}" telah disiapkan dan dinilai oleh Manajemen Proyek.\n\nDampak Finansial: ${amountStr}\nDampak Jadwal: ${body.scheduleImpactType === 'none' ? 'Tidak ada penundaan' : `${body.scheduleImpactDays} hari`}\n\nSilakan tinjau rinciannya dan tanda tangani persetujuan melalui tautan aman di bawah ini:`,
        link: clientLink,
        expirationDays: body.expirationDays || 7
      });
      
    } else {
      // Normal flow: Site contractor initiates. Send PM review link.
      const pmLink = `${origin}/review/[token]`;
      
      await sendNotification({
        requestId: savedRequest.id,
        recipientEmail: savedRequest.pm_user?.email || 'kurnia@apartmentspecialists.co.nz',
        type: 'PM_REVIEW',
        subject: `Tindakan Diperlukan: Permohonan Variasi Baru untuk ${savedRequest.project_address}`,
        body: `Halo,\n\nPermohonan Variasi baru telah diajukan oleh ${savedRequest.submitter_name} (${savedRequest.submitter_role}) untuk proyek "${savedRequest.project_address}".\n\nSilakan tinjau lingkup perubahan dan masukkan penilaian biaya serta jadwal melalui tautan aman di bawah ini:`,
        link: pmLink,
        expirationDays: body.expirationDays || 7
      });
    }

    return NextResponse.json({ success: true, request: savedRequest });
  } catch (error) {
    console.error('API requests error:', error);
    let session = null;
    try {
      session = await verifySession();
    } catch (_) {}
    try {
      await sendErrorTelegramNotification(error, { siteId: body?.projectAddress, session, path: request.nextUrl.pathname });
    } catch (tgErr) {
      console.error('Failed to send error notification to Telegram:', tgErr);
    }
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

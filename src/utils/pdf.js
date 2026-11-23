import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';

/**
 * Generates an official PDF document of the signed Variation Request using pdfkit.
 * Returns a Promise that resolves to the binary PDF Buffer.
 */
export function generateRequestPDF(requestData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      

      const buffers = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', err => reject(err));

      // 1. Header background and layout
      doc.rect(0, 0, doc.page.width, 90).fill('#e4dfdf');

      // Separator line
      doc.moveTo(0, 90).lineTo(doc.page.width, 90).lineWidth(1).strokeColor('#cccccc').stroke();

      // Logo on the left
      const logoPath = path.join(process.cwd(), 'public/EE-wide.png');
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 29, { height: 32 });
      }

      // Title on the right (balanced opposite the logo)
      doc.fillColor('#111111')
         .font('Helvetica-Bold')
         .fontSize(22)
         .text('PERMOHONAN VARIASI', 170, 38, {
           width: doc.page.width - 220,
           align: 'right',
           characterSpacing: 5
         });

      // Meta details table
      let currentY = 115;
      doc.fillColor('#555555').font('Helvetica-Bold').fontSize(9).text('Lokasi Proyek: ', 50, currentY);
      doc.fillColor('#111111').font('Helvetica').text(requestData.project_address || '', 140, currentY);
      
      currentY += 15;
      doc.fillColor('#555555').font('Helvetica-Bold').text('ID Permohonan: ', 50, currentY);
      doc.fillColor('#111111').font('Helvetica').text(requestData.submission_id || '', 140, currentY);
      
      currentY += 15;
      doc.fillColor('#555555').font('Helvetica-Bold').text('Tanggal Pengajuan: ', 50, currentY);
      doc.fillColor('#111111').font('Helvetica').text(requestData.date_of_request ? new Date(requestData.date_of_request).toLocaleDateString('id-ID') : '', 140, currentY);

      currentY += 15;
      doc.fillColor('#555555').font('Helvetica-Bold').text('Status: ', 50, currentY);
      doc.fillColor('#8B1A1A').font('Helvetica-Bold').text(requestData.status || '', 140, currentY);

      currentY += 25;
      doc.moveTo(50, currentY).lineTo(doc.page.width - 50, currentY).lineWidth(1.5).strokeColor('#111111').stroke();
      
      currentY += 15;

      // Section 1 Details
      doc.fillColor('#8B1A1A').font('Helvetica-Bold').fontSize(12).text('BAGIAN 1: RINCIAN PEMOHON & LINGKUP PROYEK', 50, currentY);
      currentY += 16;
      doc.moveTo(50, currentY).lineTo(doc.page.width - 50, currentY).lineWidth(0.5).strokeColor('#cccccc').stroke();
      
      currentY += 12;
      doc.fillColor('#111111').font('Helvetica-Bold').fontSize(9).text('Nama Pemohon:', 50, currentY);
      doc.font('Helvetica').text(requestData.submitter_name || '', 140, currentY);
      doc.font('Helvetica-Bold').text('Peran / Bidang:', doc.page.width / 2, currentY);
      doc.font('Helvetica').text(requestData.submitter_role || '', doc.page.width / 2 + 80, currentY);

      currentY += 15;
      doc.font('Helvetica-Bold').text('Email Pemohon:', 50, currentY);
      doc.font('Helvetica').text(requestData.submitter_email || '', 140, currentY);
      doc.font('Helvetica-Bold').text('PM Ditugaskan:', doc.page.width / 2, currentY);
      doc.font('Helvetica').text(requestData.pm_user?.name || '', doc.page.width / 2 + 80, currentY);

      currentY += 25;
      doc.font('Helvetica-Bold').fontSize(10).text('Deskripsi Lingkup Variasi:', 50, currentY);
      currentY += 14;
      doc.font('Helvetica').fontSize(9).fillColor('#333333').text(requestData.description || 'Tidak ada deskripsi yang diberikan.', 50, currentY, { width: doc.page.width - 100, align: 'left' });
      currentY += doc.heightOfString(requestData.description || 'Tidak ada deskripsi yang diberikan.', { width: doc.page.width - 100 }) + 15;

      doc.fillColor('#111111').font('Helvetica-Bold').fontSize(10).text('Alasan Perubahan Lingkup / Permohonan Variasi:', 50, currentY);
      currentY += 14;
      doc.font('Helvetica').fontSize(9).fillColor('#333333').text(requestData.reason || 'Tidak ada alasan yang diberikan.', 50, currentY, { width: doc.page.width - 100, align: 'left' });
      currentY += doc.heightOfString(requestData.reason || 'Tidak ada alasan yang diberikan.', { width: doc.page.width - 100 }) + 15;

      doc.fillColor('#111111').font('Helvetica-Bold').fontSize(10).text('Dampak Terhadap Proyek / Catatan Logistik:', 50, currentY);
      currentY += 14;
      doc.font('Helvetica').fontSize(9).fillColor('#333333').text(requestData.project_impact || 'Tidak ada catatan dampak proyek.', 50, currentY, { width: doc.page.width - 100, align: 'left' });
      currentY += doc.heightOfString(requestData.project_impact || 'Tidak ada catatan dampak proyek.', { width: doc.page.width - 100 }) + 25;

      // Section 2 PM Assessment & Pricing
      const pmEvent = requestData.workflow_events?.find(e => e.step_type === 'pm_review' && e.action === 'approve');
      
      if (currentY > doc.page.height - 180) {
        doc.addPage();
        currentY = 50;
      }

      doc.fillColor('#8B1A1A').font('Helvetica-Bold').fontSize(12).text('BAGIAN 2: PENILAIAN BIAYA & JADWAL PM', 50, currentY);
      currentY += 16;
      doc.moveTo(50, currentY).lineTo(doc.page.width - 50, currentY).lineWidth(0.5).strokeColor('#cccccc').stroke();
      
      currentY += 12;
      if (pmEvent) {
        const sign = pmEvent.financial_impact === 'increase' ? '+' : (pmEvent.financial_impact === 'decrease' ? '-' : '');
        const amountStr = pmEvent.financial_impact === 'none' ? 'Tidak Ada Dampak Biaya' : `${sign}Rp ${Number(pmEvent.financial_amount).toLocaleString('id-ID')}`;
        const daysStr = pmEvent.schedule_impact === 'none' ? 'Tidak Ada Dampak Jadwal' : `${pmEvent.schedule_days} Hari (${pmEvent.schedule_impact === 'adds' ? 'Bertambah' : 'Berkurang'})`;

        doc.fillColor('#111111').font('Helvetica-Bold').fontSize(9).text('Dampak Finansial:', 50, currentY);
        doc.font('Helvetica').text(amountStr, 140, currentY);
        doc.font('Helvetica-Bold').text('Dampak Jadwal:', doc.page.width / 2, currentY);
        doc.font('Helvetica').text(daysStr, doc.page.width / 2 + 80, currentY);

        currentY += 15;
        doc.font('Helvetica-Bold').text('Perwakilan PM:', 50, currentY);
        doc.font('Helvetica').text(pmEvent.company_rep_name || '', 140, currentY);
        doc.font('Helvetica-Bold').text('Tanggal Penilaian:', doc.page.width / 2, currentY);
        doc.font('Helvetica').text(new Date(pmEvent.created_at).toLocaleDateString('id-ID'), doc.page.width / 2 + 80, currentY);

        currentY += 25;
        doc.font('Helvetica-Bold').fontSize(10).text('Catatan Penilaian Manajer Proyek:', 50, currentY);
        currentY += 14;
        doc.font('Helvetica').fontSize(9).fillColor('#333333').text(pmEvent.pm_notes || 'Tidak ada catatan yang diberikan oleh PM.', 50, currentY, { width: doc.page.width - 100 });
        currentY += doc.heightOfString(pmEvent.pm_notes || 'Tidak ada catatan yang diberikan oleh PM.', { width: doc.page.width - 100 }) + 25;
      } else {
        doc.fillColor('#555555').font('Helvetica-Oblique').fontSize(9).text('Belum ada penilaian biaya PM yang dicatat.', 50, currentY);
        currentY += 35;
      }

      // Section 3 Client Sign-off
      const clientEvent = requestData.workflow_events?.find(e => e.step_type === 'client_review' && e.action === 'approve');
      
      if (currentY > doc.page.height - 180) {
        doc.addPage();
        currentY = 50;
      }

      doc.fillColor('#8B1A1A').font('Helvetica-Bold').fontSize(12).text('BAGIAN 3: PERSETUJUAN & TANDA TANGAN DIGITAL KLIEN', 50, currentY);
      currentY += 16;
      doc.moveTo(50, currentY).lineTo(doc.page.width - 50, currentY).lineWidth(0.5).strokeColor('#cccccc').stroke();

      currentY += 12;
      if (clientEvent) {
        doc.fillColor('#111111').font('Helvetica-Bold').fontSize(9).text('Nama Otorisasi Klien:', 50, currentY);
        doc.font('Helvetica').text(clientEvent.client_name || '', 160, currentY);
        doc.font('Helvetica-Bold').text('Tanggal Persetujuan:', doc.page.width / 2, currentY);
        doc.font('Helvetica').text(new Date(clientEvent.client_date).toLocaleDateString('id-ID'), doc.page.width / 2 + 80, currentY);

        currentY += 25;
        doc.font('Helvetica-Bold').fontSize(10).text('Catatan Klien:', 50, currentY);
        currentY += 14;
        doc.font('Helvetica').fontSize(9).fillColor('#333333').text(clientEvent.pm_notes || 'Tidak ada catatan tambahan.', 50, currentY, { width: doc.page.width - 100 });
        currentY += doc.heightOfString(clientEvent.pm_notes || 'Tidak ada catatan tambahan.', { width: doc.page.width - 100 }) + 25;

        // Draw Signature image if exists
        if (clientEvent.signature_image && clientEvent.signature_image.startsWith('data:image/')) {
          if (currentY > doc.page.height - 120) {
            doc.addPage();
            currentY = 50;
          }
          doc.fillColor('#111111').font('Helvetica-Bold').fontSize(10).text('Tanda Tangan Digital Resmi Klien:', 50, currentY);
          currentY += 15;
          try {
            const base64Data = clientEvent.signature_image.replace(/^data:image\/\w+;base64,/, '');
            const sigBuffer = Buffer.from(base64Data, 'base64');
            doc.image(sigBuffer, 50, currentY, { height: 50 });
            currentY += 65;
          } catch (sigErr) {
            console.error('Failed to draw signature image in PDF:', sigErr);
            doc.font('Helvetica-Oblique').fontSize(9).text('[Gambar Tanda Tangan Digital Gagal]', 50, currentY);
            currentY += 20;
          }
        }
      } else {
        doc.fillColor('#555555').font('Helvetica-Oblique').fontSize(9).text('Menunggu persetujuan dan tanda tangan klien.', 50, currentY);
        currentY += 35;
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

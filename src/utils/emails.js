import { Resend } from 'resend';
import { logEmail, updateNotification, getRequestById } from '@/db';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Instantiate Resend if key is provided, otherwise use a placeholder (Disabled for now)
const resendApiKey = null;
const resend = null;

// Load Google Service Account credentials if file exists
let serviceAccount = null;
try {
  const saPath = path.join(process.cwd(), 'Service-account.json');
  if (fs.existsSync(saPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(saPath, 'utf8'));
  }
} catch (error) {
  console.error('Failed to load Service-account.json:', error);
}

const gmailSenderEmail = process.env.GMAIL_SENDER_EMAIL;
const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587;
const smtpUser = process.env.SMTP_USER;
const smtpPassword = process.env.SMTP_PASSWORD;
const emailFrom = process.env.EMAIL_FROM || 'Elevate Equity Form Approval <yusaufcok@gmail.com>';

/**
 * Helper to send email via Resend API
 */
/**
 * Helper to send email via Resend API
 */
async function sendViaResend(recipientEmail, subject, htmlContent, pdfBuffer, requestId) {
  if (!resend) return;
  
  let targetEmail = recipientEmail;
  let finalSubject = subject;
  
  if (emailFrom.includes('onboarding@resend.dev')) {
    targetEmail = 'yusaufcok@gmail.com';
    finalSubject = `[Test for ${recipientEmail}] ${subject}`;
  }

  const attachments = [];
  try {
    const localLogoPath = path.join(process.cwd(), 'public/EE-wide.png');
    if (fs.existsSync(localLogoPath)) {
      attachments.push({
        filename: 'EE-wide.png',
        path: localLogoPath,
        contentId: 'elevate_equity_logo',
      });
    }
  } catch (err) {}

  if (pdfBuffer) {
    attachments.push({
      filename: `Elevate_Equity_Variation_Request_${requestId || 'Approval'}.pdf`,
      content: pdfBuffer,
    });
  }

  await resend.emails.send({
    from: emailFrom,
    to: targetEmail,
    subject: finalSubject,
    html: htmlContent,
    attachments
  });
  console.log(`[Resend] Successfully sent email to ${targetEmail} (original: ${recipientEmail}) from ${emailFrom}`);
}

/**
 * Sends a notification, writes it to the database notifications log (for the simulator),
 * and triggers a real email via SMTP, Gmail OAuth2, or Resend.
 */
export async function sendNotification({ requestId, recipientEmail, type, subject, body, link, expirationDays, pdfBuffer, customSiteId }) {
  try {
    // 1. Write notification to the PostgreSQL database so the simulated inbox panel can show it
    const notification = await logEmail(requestId, recipientEmail, type, subject, body, link, expirationDays);
    const token = notification.unique_token;
    
    // Replace token placeholder in the link if present
    const finalLink = link ? link.replace('[token]', token) : '';
    const finalBody = body ? body.replace(/\[token\]/g, token) : '';
    
    // Update the notification with final link and body in the database
    if (finalLink !== link || finalBody !== body) {
      await updateNotification(notification.id, {
        link: finalLink,
        body: finalBody
      });
    }

    // Fetch request details to populate the Site ID dynamically
    let projectAddress = customSiteId || '404-85 Beach Rd'; // fallback default

    if (!customSiteId && requestId) {
      const requestData = await getRequestById(requestId);
      if (requestData && requestData.project_address) {
        projectAddress = requestData.project_address;
      }
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://43-173-20-217.sslip.io';

    const htmlContent = `
      <div style="background-color: #f7f9fa; padding: 30px 15px; font-family: Arial, Helvetica, sans-serif;">
        <div style="max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; overflow: hidden; color: #111111; box-shadow: 0 4px 10px rgba(0,0,0,0.03);">
          
          <!-- Document Header -->
          <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #e4dfdf; margin-bottom: 0;">
            <tr>
              <td align="left" valign="middle" style="padding: 15px 10px 15px 20px; width: 160px;">
                <img src="cid:elevate_equity_logo" alt="Elevate Equity Logo" style="max-height: 32px; width: auto; display: block;" />
              </td>
              <!-- Jarak Kiri (Left Gap) -->
              <td style="width: 30px;">&nbsp;</td>
              <td align="center" valign="middle" style="padding: 15px 20px 15px 10px; font-size: 26px; font-weight: bold; color: #111111; font-family: Arial, Helvetica, sans-serif; white-space: nowrap; letter-spacing: 0.25em; text-transform: uppercase;">
                Permohonan Variasi
              </td>
            </tr>
          </table>
          <hr style="border: 0; border-top: 2px solid #111111; margin: 0;" />

          <!-- Email Content Body -->
          <div style="padding: 30px;">
            <!-- Site ID -->
            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom: 15px;">
              <tr>
                <td style="font-size: 14px; color: #555555; vertical-align: middle; width: 110px;">
                  Lokasi Proyek:
                </td>
                <td style="font-size: 24px; font-weight: bold; color: #111111; vertical-align: middle;">
                  ${projectAddress}
                </td>
              </tr>
            </table>
            <hr style="border: 0; border-top: 2px solid #111111; margin: 5px 0 25px 0;" />

            <!-- Notification Alert Card (Bagian merah) -->
            <div style="border-left: 4px solid #8B1A1A; background-color: #fdfafb; border-top: 1px solid #f3e5e5; border-right: 1px solid #f3e5e5; border-bottom: 1px solid #f3e5e5; border-radius: 4px; padding: 18px; margin-bottom: 30px; font-size: 14px; line-height: 1.6; color: #333333;">
              <strong style="color: #8B1A1A; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; display: block; margin-bottom: 8px;">Rincian Pemberitahuan</strong>
              <div style="color: #4a5568;">
                ${finalBody.replace(/\n/g, '<br />')}
              </div>
              ${finalLink ? `
                <div style="margin-top: 15px;">
                  <a href="${finalLink}" style="background-color: #8B1A1A; color: #ffffff; font-weight: bold; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">
                    Buka Formulir Variasi
                  </a>
                </div>
              ` : ''}
            </div>

            <!-- Footer/Action Link Fallback -->
            ${finalLink ? `
              <div style="font-size: 11px; color: #a0aec0; text-align: center; margin-top: 30px; padding-top: 15px; border-top: 1.5px solid #111111; word-break: break-all;">
                Jika tombol di atas tidak berfungsi, salin dan tempel tautan berikut di peramban Anda:<br />
                <a href="${finalLink}" style="color: #8B1A1A; font-weight: bold; text-decoration: underline;">${finalLink}</a>
              </div>
            ` : ''}

            <div style="margin-top: 20px; font-size: 11px; color: #718096; text-align: center;">
              <p style="margin: 0;">Ini adalah pemberitahuan otomatis dari Portal Persetujuan Formulir Elevate Equity.</p>
              <p style="margin: 5px 0 0 0; font-size: 10px;">Mohon tidak membalas langsung ke email ini.</p>
            </div>
          </div>
          
        </div>
      </div>
    `;

    // 2. Trigger real email using SMTP, Gmail SMTP OAuth2 (Service Account) or fallback to Resend
    const attachments = [];
    try {
      const localLogoPath = path.join(process.cwd(), 'public/EE-wide.png');
      if (fs.existsSync(localLogoPath)) {
        attachments.push({
          filename: 'EE-wide.png',
          path: localLogoPath,
          cid: 'elevate_equity_logo'
        });
      }
    } catch (err) {
      console.error('Failed to locate logo for attachment:', err);
    }

    if (pdfBuffer) {
      attachments.push({
        filename: `Elevate_Equity_Variation_Request_${requestId || 'Approval'}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      });
    }

    if (smtpHost && smtpUser && smtpPassword) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPassword,
          },
        });

        const plainText = `${subject}\n\n${finalBody}\n\nTautan Formulir:\n${finalLink}\n\n---\nElevate Equity Form Approval Portal`;

        const info = await transporter.sendMail({
          from: emailFrom,
          to: recipientEmail,
          subject: subject,
          text: plainText,
          html: htmlContent,
          attachments,
          headers: {
            'X-Auto-Response-Suppress': 'OOF, AutoReply',
            'Auto-Submitted': 'auto-generated'
          }
        });

        console.log(`[SMTP] Successfully sent email to ${recipientEmail} | MessageID: ${info.messageId}`);
      } catch (smtpError) {
        console.error('[SMTP] Failed to send email via SMTP:', smtpError.message);
        if (resend) {
          console.log('[SMTP Fallback] Attempting to send via Resend...');
          await sendViaResend(recipientEmail, subject, htmlContent, pdfBuffer, requestId);
        } else {
          throw smtpError;
        }
      }
    } else if (serviceAccount && gmailSenderEmail) {
      try {
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: {
            type: 'OAuth2',
            user: gmailSenderEmail,
            serviceClient: serviceAccount.client_email,
            privateKey: serviceAccount.private_key,
          }
        });

        const info = await transporter.sendMail({
          from: `Elevate Equity Form Approval <${gmailSenderEmail}>`,
          to: recipientEmail,
          subject: subject,
          html: htmlContent,
          attachments
        });

        console.log(`[Gmail SMTP] Successfully sent email to ${recipientEmail} | MessageID: ${info.messageId}`);
      } catch (gmailError) {
        console.error('[Gmail SMTP] Failed to send email via Gmail:', gmailError.message);
        if (resend) {
          console.log('[Gmail SMTP Fallback] Attempting to send via Resend...');
          await sendViaResend(recipientEmail, subject, htmlContent, pdfBuffer, requestId);
        } else {
          throw gmailError;
        }
      }
    } else if (resend) {
      // Fallback to Resend if SMTP/Gmail are not configured
      await sendViaResend(recipientEmail, subject, htmlContent, pdfBuffer, requestId);
    } else {
      console.log(`[Simulator Log] Email logged for ${recipientEmail}. Subject: "${subject}"`);
    }

    return notification;
  } catch (err) {
    console.error('Error sending email notification:', err);
    // Continue execution to not block the app workflow if email fails
    return null;
  }
}

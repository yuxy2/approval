import prisma from './prisma.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.join(process.cwd(), 'src/db/db.json');

// Pre-seeded Project Managers for prototype fallback
const initialPmUsers = [
  { id: '6b0472d3f681bacdc11a2fac', name: "Yusauf Cok", email: "yusaufcok@gmail.com", active: true, role: "superadmin" },
  { id: '6b0472d3f681bacdc11a2fad', name: "Yusuf Mustofa", email: "yusufmustofa146@gmail.com", active: true, role: "pm" },
  { id: '6b0472d3f681bacdc11a2fae', name: "Sariden", email: "sariden256@gmail.com", active: true, role: "contractor" }
];

// Ensure db directory and file exists (safe for serverless/read-only filesystems like Vercel)
function ensureDb() {
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(dbPath)) {
      fs.writeFileSync(dbPath, JSON.stringify({ requests: [], pm_users: initialPmUsers, notifications: [], workflow_events: [], password_reset_requests: [] }, null, 2));
    } else {
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      let modified = false;
      if (!data.pm_users || data.pm_users.length === 0) {
        data.pm_users = initialPmUsers;
        modified = true;
      }
      if (!data.workflow_events) {
        data.workflow_events = [];
        modified = true;
      }
      if (!data.notifications) {
        data.notifications = [];
        modified = true;
      }
      if (!data.password_reset_requests) {
        data.password_reset_requests = [];
        modified = true;
      }
      if (modified) {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
      }
    }
  } catch (e) {
    // Graceful fallback for read-only serverless filesystems (Vercel)
  }
}

export function readDb() {
  ensureDb();
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    // Ignore read errors in ephemeral environments
  }
  return { requests: [], pm_users: initialPmUsers, notifications: [], workflow_events: [], password_reset_requests: [] };
}

export function writeDb(data) {
  ensureDb();
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    // In serverless / read-only filesystem environments (Vercel), ignore local file write
    return false;
  }
}

// Track whether we have detected database connection capability
let dbMode = 'unknown'; // 'prisma' or 'json'

async function getDbMode() {
  if (dbMode !== 'unknown') return dbMode;
  try {
    await prisma.$connect();
    dbMode = 'prisma';
    console.log('Database Mode: connected to MongoDB via Prisma.');
  } catch (err) {
    console.warn('Database Mode: Prisma MongoDB connection failed. Falling back to local JSON database.', err.message);
    dbMode = 'json';
  }
  return dbMode;
}

// Get all requests
export async function getRequests() {
  const mode = await getDbMode();
  if (mode === 'prisma') {
    try {
      return await prisma.variation_requests.findMany({
        orderBy: { updated_at: 'desc' },
        include: {
          pm_user: true,
          workflow_events: {
            orderBy: { created_at: 'asc' }
          },
          notifications: {
            orderBy: { sent_at: 'desc' }
          }
        }
      });
    } catch (err) {
      console.error('Prisma error in getRequests, falling back to JSON:', err);
    }
  }
  
  // JSON Fallback
  const db = readDb();
  const sorted = [...db.requests].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  return sorted.map(r => {
    const pm_user = db.pm_users.find(u => String(u.id) === String(r.pm_id));
    const w_events = db.workflow_events.filter(e => e.request_id === r.id);
    const notifs = db.notifications.filter(n => n.request_id === r.id);
    return {
      ...r,
      pm_user,
      workflow_events: w_events,
      notifications: notifs
    };
  });
}

// Get single request by ID
export async function getRequestById(id) {
  const mode = await getDbMode();
  if (mode === 'prisma') {
    try {
      return await prisma.variation_requests.findUnique({
        where: { id: String(id) },
        include: {
          pm_user: true,
          workflow_events: {
            orderBy: { created_at: 'asc' }
          },
          notifications: {
            orderBy: { sent_at: 'desc' }
          }
        }
      });
    } catch (err) {
      console.error(`Prisma error in getRequestById(${id}), falling back to JSON:`, err);
    }
  }

  // JSON Fallback
  const db = readDb();
  const r = db.requests.find(req => String(req.id) === String(id));
  if (!r) return null;
  const pm_user = db.pm_users.find(u => String(u.id) === String(r.pm_id));
  const w_events = db.workflow_events.filter(e => e.request_id === r.id);
  const notifs = db.notifications.filter(n => n.request_id === r.id);
  return {
    ...r,
    pm_user,
    workflow_events: w_events,
    notifications: notifs
  };
}

// Get request by token
export async function getRequestByToken(token) {
  const mode = await getDbMode();
  if (mode === 'prisma') {
    try {
      const notification = await prisma.notifications.findUnique({
        where: { unique_token: token },
        include: {
          variation_request: {
            include: {
              pm_user: true,
              workflow_events: {
                orderBy: { created_at: 'asc' }
              },
              notifications: {
                orderBy: { sent_at: 'desc' }
              }
            }
          }
        }
      });
      if (notification) {
        return {
          request: notification.variation_request,
          role: notification.type === 'PM_REVIEW' ? 'PM' : notification.type === 'CLIENT_SIGN_OFF' ? 'Client' : 'Status',
          notificationType: notification.type,
          expires_at: notification.expires_at
        };
      }
    } catch (err) {
      console.error(`Prisma error in getRequestByToken(${token}), falling back to JSON:`, err);
    }
  }

  // JSON Fallback
  const db = readDb();
  const notif = db.notifications.find(n => n.unique_token === token);
  if (!notif) return null;
  const request = await getRequestById(notif.request_id);
  return {
    request,
    role: notif.type === 'PM_REVIEW' ? 'PM' : notif.type === 'CLIENT_SIGN_OFF' ? 'Client' : 'Status',
    notificationType: notif.type,
    expires_at: notif.expires_at
  };
}

// Generate the auto-incrementing submission_id (e.g. VR-2026-001)
export async function generateSubmissionId() {
  const currentYear = new Date().getFullYear();
  const prefix = `VR-${currentYear}-`;

  const mode = await getDbMode();
  if (mode === 'prisma') {
    try {
      const lastRequest = await prisma.variation_requests.findFirst({
        where: { submission_id: { startsWith: prefix } },
        orderBy: { submission_id: 'desc' }
      });
      let nextNum = 1;
      if (lastRequest) {
        const parts = lastRequest.submission_id.split('-');
        const lastNum = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastNum)) {
          nextNum = lastNum + 1;
        }
      }
      return `${prefix}${String(nextNum).padStart(3, '0')}`;
    } catch (err) {
      console.error('Prisma generateSubmissionId failed:', err);
    }
  }

  // JSON Fallback
  const db = readDb();
  const yearRequests = db.requests.filter(r => r.submission_id?.startsWith(prefix));
  let nextNum = 1;
  if (yearRequests.length > 0) {
    const ids = yearRequests.map(r => {
      const parts = r.submission_id.split('-');
      return parseInt(parts[parts.length - 1], 10);
    }).filter(n => !isNaN(n));
    if (ids.length > 0) {
      nextNum = Math.max(...ids) + 1;
    }
  }
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

// Save or Update request
export async function saveRequest(requestData) {
  const pmId = String(requestData.pm_id || requestData.pmId);
  const dbData = {
    project_address: requestData.projectAddress || requestData.project_address,
    date_of_request: requestData.requestDate || requestData.date_of_request ? new Date(requestData.requestDate || requestData.date_of_request) : new Date(),
    submitter_name: requestData.submitterName || requestData.submitter_name,
    submitter_email: requestData.submitterEmail || requestData.submitter_email,
    submitter_role: requestData.submitterRole || requestData.submitter_role,
    description: requestData.description || '',
    reason: requestData.reason || '',
    project_impact: requestData.projectImpact || requestData.project_impact || '',
    submitter_notes: requestData.submitterNotes || requestData.submitter_notes || '',
    pm_id: pmId,
    client_email: requestData.clientEmail !== undefined ? requestData.clientEmail : (requestData.client_email || ''),
    status: requestData.status || 'PENDING_PM',
    contractor_attachment: requestData.contractorAttachment !== undefined ? requestData.contractorAttachment : (requestData.contractor_attachment !== undefined ? requestData.contractor_attachment : null),
    prm_attachment: requestData.prmAttachment !== undefined ? requestData.prmAttachment : (requestData.prm_attachment !== undefined ? requestData.prm_attachment : null),
  };

  const mode = await getDbMode();
  if (mode === 'prisma') {
    try {
      if (requestData.id) {
        return await prisma.variation_requests.update({
          where: { id: String(requestData.id) },
          data: dbData,
          include: {
            pm_user: true,
            workflow_events: true,
            notifications: true
          }
        });
      } else {
        const submission_id = requestData.submission_id || await generateSubmissionId();
        return await prisma.variation_requests.create({
          data: {
            submission_id,
            ...dbData
          },
          include: {
            pm_user: true,
            workflow_events: true,
            notifications: true
          }
        });
      }
    } catch (err) {
      console.error('Prisma error in saveRequest, falling back to JSON:', err);
    }
  }

  // JSON Fallback
  const db = readDb();
  let saved;
  if (requestData.id) {
    const idx = db.requests.findIndex(r => String(r.id) === String(requestData.id));
    if (idx !== -1) {
      db.requests[idx] = {
        ...db.requests[idx],
        ...dbData,
        date_of_request: dbData.date_of_request.toISOString(),
        updated_at: new Date().toISOString()
      };
      saved = db.requests[idx];
    }
  } else {
    const id = crypto.randomUUID();
    const submission_id = requestData.submission_id || await generateSubmissionId();
    saved = {
      id,
      submission_id,
      ...dbData,
      date_of_request: dbData.date_of_request.toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.requests.push(saved);
  }
  writeDb(db);
  
  // Attach PM User for consistency
  const pm_user = db.pm_users.find(u => String(u.id) === String(saved.pm_id));
  const w_events = db.workflow_events.filter(e => e.request_id === saved.id);
  const notifs = db.notifications.filter(n => n.request_id === saved.id);
  
  return {
    ...saved,
    pm_user,
    workflow_events: w_events,
    notifications: notifs
  };
}

// Create workflow event
export async function createWorkflowEvent(eventData) {
  const eventPayload = {
    request_id: String(eventData.request_id || eventData.requestId),
    step_type: eventData.step_type || eventData.stepType,
    action: eventData.action,
    actor_email: eventData.actor_email || eventData.actorEmail,
    financial_impact: eventData.financial_impact || eventData.financialImpact || null,
    financial_amount: (eventData.financial_amount !== undefined && eventData.financial_amount !== null && eventData.financial_amount !== '')
      ? Number(eventData.financial_amount || eventData.financialAmount)
      : null,
    schedule_impact: eventData.schedule_impact || eventData.scheduleImpact || null,
    schedule_days: (eventData.schedule_days !== undefined && eventData.schedule_days !== null && eventData.schedule_days !== '')
      ? parseInt(eventData.schedule_days || eventData.scheduleDays, 10)
      : null,
    company_rep_name: eventData.company_rep_name || eventData.companyRepName || null,
    company_approved: eventData.company_approved !== undefined ? eventData.company_approved : null,
    pm_notes: eventData.pm_notes || eventData.pmNotes || null,
    client_agreed: eventData.client_agreed !== undefined ? eventData.client_agreed : null,
    client_name: eventData.client_name || eventData.clientName || null,
    client_date: eventData.client_date || eventData.clientDate ? new Date(eventData.client_date || eventData.clientDate) : null,
    signature_image: eventData.signature_image || eventData.signature || null
  };

  const mode = await getDbMode();
  if (mode === 'prisma') {
    try {
      return await prisma.workflow_events.create({
        data: eventPayload
      });
    } catch (err) {
      console.error('Prisma error in createWorkflowEvent, falling back to JSON:', err);
    }
  }

  // JSON Fallback
  const db = readDb();
  const id = crypto.randomUUID();
  const savedEvent = {
    id,
    ...eventPayload,
    client_date: eventPayload.client_date ? eventPayload.client_date.toISOString() : null,
    created_at: new Date().toISOString()
  };
  
  db.workflow_events.push(savedEvent);
  
  // Touch request updated_at timestamp
  const reqIdx = db.requests.findIndex(r => r.id === eventPayload.request_id);
  if (reqIdx !== -1) {
    db.requests[reqIdx].updated_at = new Date().toISOString();
  }
  
  writeDb(db);
  return savedEvent;
}

// Log notification and return it
export async function logEmail(request_id, recipient_email, type, subject, body, link, expirationDays = 7) {
  const unique_token = crypto.randomUUID();
  let expires_at;
  const expStr = String(expirationDays);
  if (expStr.endsWith('m')) {
    const minutes = parseInt(expStr.slice(0, -1), 10) || 1;
    expires_at = new Date(Date.now() + minutes * 60 * 1000);
  } else {
    const days = parseInt(expStr, 10) || 7;
    expires_at = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  const mode = await getDbMode();
  if (mode === 'prisma' && request_id) {
    try {
      return await prisma.notifications.create({
        data: {
          request_id: String(request_id),
          recipient_email,
          type,
          unique_token,
          subject,
          body,
          link,
          expires_at
        }
      });
    } catch (err) {
      console.error('Prisma error in logEmail, falling back to JSON:', err);
    }
  }

  // JSON Fallback
  const db = readDb();
  const id = crypto.randomUUID();
  const savedNotif = {
    id,
    request_id,
    recipient_email,
    type,
    unique_token,
    subject,
    body,
    link,
    expires_at: expires_at ? expires_at.toISOString() : null,
    sent_at: new Date().toISOString()
  };
  
  db.notifications.push(savedNotif);
  writeDb(db);
  return savedNotif;
}

// Update notification details
export async function updateNotification(id, updateData) {
  const mode = await getDbMode();
  if (mode === 'prisma') {
    try {
      return await prisma.notifications.update({
        where: { id: String(id) },
        data: updateData
      });
    } catch (err) {
      console.error('Prisma error in updateNotification:', err);
    }
  }

  // JSON Fallback
  const db = readDb();
  const idx = db.notifications.findIndex(n => String(n.id) === String(id));
  if (idx !== -1) {
    db.notifications[idx] = {
      ...db.notifications[idx],
      ...updateData
    };
    writeDb(db);
    return db.notifications[idx];
  }
  return null;
}

// Get simulated email logs (notifications ordered by sent_at desc)
export async function getEmails() {
  const mode = await getDbMode();
  if (mode === 'prisma') {
    try {
      const list = await prisma.notifications.findMany({
        orderBy: { sent_at: 'desc' },
        take: 30
      });
      return list.map(n => ({
        id: n.id.toString(),
        to: n.recipient_email,
        subject: n.subject,
        body: n.body,
        link: n.link,
        type: n.type,
        sentAt: n.sent_at.toISOString()
      }));
    } catch (err) {
      console.error('Prisma error in getEmails, falling back to JSON:', err);
    }
  }

  // JSON Fallback
  const db = readDb();
  const sorted = [...db.notifications].sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());
  return sorted.slice(0, 30).map(n => ({
    id: n.id.toString(),
    to: n.recipient_email,
    subject: n.subject,
    body: n.body,
    link: n.link,
    type: n.type || 'STATUS_UPDATE',
    sentAt: n.sent_at
  }));
}

// Clear simulated email logs
export async function clearEmails() {
  const mode = await getDbMode();
  if (mode === 'prisma') {
    try {
      return await prisma.notifications.deleteMany();
    } catch (err) {
      console.error('Prisma error in clearEmails, falling back to JSON:', err);
    }
  }

  // JSON Fallback
  const db = readDb();
  db.notifications = [];
  writeDb(db);
  return { count: 0 };
}

// Get PM Users list (active only)
export async function getPmUsers() {
  const mode = await getDbMode();
  if (mode === 'prisma') {
    try {
      return await prisma.pm_users.findMany({
        where: { active: true },
        orderBy: { name: 'asc' }
      });
    } catch (err) {
      console.error('Prisma error in getPmUsers, falling back to JSON:', err);
    }
  }

  // JSON Fallback
  const db = readDb();
  return db.pm_users.filter(u => u.active === true);
}

// Get all users (active & inactive for admin management page)
export async function getAllPmUsers() {
  const mode = await getDbMode();
  if (mode === 'prisma') {
    try {
      return await prisma.pm_users.findMany({
        orderBy: { name: 'asc' }
      });
    } catch (err) {
      console.error('Prisma error in getAllPmUsers, falling back to JSON:', err);
    }
  }

  // JSON Fallback
  const db = readDb();
  return db.pm_users;
}

// Get PM User by Email
export async function getPmUserByEmail(email) {
  if (!email) return null;
  const mode = await getDbMode();
  if (mode === 'prisma') {
    try {
      return await prisma.pm_users.findUnique({
        where: { email: email.toLowerCase() }
      });
    } catch (err) {
      console.error(`Prisma error in getPmUserByEmail(${email}), falling back to JSON:`, err);
    }
  }

  // JSON Fallback
  const db = readDb();
  return db.pm_users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

// Create PM User
export async function createPmUser({ name, email, password, role = "pm" }) {
  const mode = await getDbMode();
  if (mode === 'prisma') {
    try {
      const existing = await prisma.pm_users.findUnique({
        where: { email: email.toLowerCase() }
      });
      if (existing) {
        return await prisma.pm_users.update({
          where: { id: existing.id },
          data: {
            password,
            name,
            role
          }
        });
      }

      return await prisma.pm_users.create({
        data: {
          name,
          email: email.toLowerCase(),
          password,
          active: true,
          role
        }
      });
    } catch (err) {
      console.error('Prisma error in createPmUser, falling back to JSON:', err);
    }
  }

  // JSON Fallback
  const db = readDb();
  const existingIdx = db.pm_users.findIndex(u => u.email.toLowerCase() === email.toLowerCase());
  if (existingIdx !== -1) {
    db.pm_users[existingIdx].password = password;
    db.pm_users[existingIdx].name = name;
    db.pm_users[existingIdx].role = role;
    writeDb(db);
    return db.pm_users[existingIdx];
  }

  const newUser = {
    id: crypto.randomUUID(),
    name,
    email: email.toLowerCase(),
    password,
    active: true,
    role
  };
  db.pm_users.push(newUser);
  writeDb(db);
  return newUser;
}

// Update PM User
export async function updatePmUser(id, updateData) {
  const userId = String(id);
  const mode = await getDbMode();
  if (mode === 'prisma') {
    try {
      return await prisma.pm_users.update({
        where: { id: userId },
        data: updateData
      });
    } catch (err) {
      console.error(`Prisma error in updatePmUser(${id}), falling back to JSON:`, err);
    }
  }

  // JSON Fallback
  const db = readDb();
  const idx = db.pm_users.findIndex(u => String(u.id) === userId);
  if (idx !== -1) {
    db.pm_users[idx] = {
      ...db.pm_users[idx],
      ...updateData
    };
    writeDb(db);
    return db.pm_users[idx];
  }
  return null;
}

// Delete PM User
export async function deletePmUser(id) {
  const userId = String(id);
  const mode = await getDbMode();
  if (mode === 'prisma') {
    try {
      // Reassign variation requests to another superadmin first
      const backupAdmin = await prisma.pm_users.findFirst({
        where: {
          active: true,
          role: 'superadmin',
          NOT: { id: userId }
        }
      });
      if (backupAdmin) {
        await prisma.variation_requests.updateMany({
          where: { pm_id: userId },
          data: { pm_id: backupAdmin.id }
        });
      }
      return await prisma.pm_users.delete({
        where: { id: userId }
      });
    } catch (err) {
      console.error(`Prisma error in deletePmUser(${id}), falling back to JSON:`, err);
    }
  }

  // JSON Fallback
  const db = readDb();
  const idx = db.pm_users.findIndex(u => String(u.id) === userId);
  if (idx !== -1) {
    const deleted = db.pm_users[idx];
    
    // Reassign JSON requests
    const backupAdmin = db.pm_users.find(u => u.active && u.role === 'superadmin' && String(u.id) !== userId);
    if (backupAdmin) {
      db.requests = db.requests.map(r => String(r.pm_id) === userId ? { ...r, pm_id: backupAdmin.id } : r);
    }
    
    db.pm_users.splice(idx, 1);
    writeDb(db);
    return deleted;
  }
  return null;
}

// Password Reset Requests (backed by MongoDB Prisma Model)
export async function getPasswordResetRequests() {
  const mode = await getDbMode();
  if (mode === 'prisma') {
    try {
      return await prisma.password_reset_requests.findMany({
        orderBy: { created_at: 'desc' }
      });
    } catch (err) {
      console.error('Prisma error in getPasswordResetRequests:', err);
    }
  }

  // JSON Fallback
  const db = readDb();
  return db.password_reset_requests || [];
}

export async function createPasswordResetRequest({ email, name, user_id, role }) {
  const mode = await getDbMode();
  if (mode === 'prisma') {
    try {
      return await prisma.password_reset_requests.create({
        data: {
          email: email.toLowerCase(),
          name: name || '',
          user_id: user_id ? String(user_id) : null,
          role: role || null,
          status: 'PENDING'
        }
      });
    } catch (err) {
      console.error('Prisma error in createPasswordResetRequest:', err);
    }
  }

  // JSON Fallback
  const db = readDb();
  if (!db.password_reset_requests) db.password_reset_requests = [];
  const newReq = {
    id: crypto.randomUUID(),
    email: email.toLowerCase(),
    name: name || '',
    user_id: user_id ? String(user_id) : null,
    role: role || null,
    status: 'PENDING',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  db.password_reset_requests.push(newReq);
  writeDb(db);
  return newReq;
}

export async function updatePasswordResetRequest(id, updateData) {
  const mode = await getDbMode();
  if (mode === 'prisma') {
    try {
      return await prisma.password_reset_requests.update({
        where: { id: String(id) },
        data: updateData
      });
    } catch (err) {
      console.error('Prisma error in updatePasswordResetRequest:', err);
    }
  }

  // JSON Fallback
  const db = readDb();
  if (!db.password_reset_requests) db.password_reset_requests = [];
  const idx = db.password_reset_requests.findIndex(r => String(r.id) === String(id));
  if (idx !== -1) {
    db.password_reset_requests[idx] = {
      ...db.password_reset_requests[idx],
      ...updateData,
      updated_at: new Date().toISOString()
    };
    writeDb(db);
    return db.password_reset_requests[idx];
  }
  return null;
}

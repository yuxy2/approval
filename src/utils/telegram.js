import os from 'os';
import { exec } from 'child_process';
import https from 'https';
import { readDb, writeDb } from '@/db';

const TELEGRAM_TOKEN = '8622295254:AAEh3MOTYb19G_xmQHDmnYyeCTq3MfKRBVE';

function telegramFetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const reqOptions = {
        hostname: parsedUrl.hostname,
        port: 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        },
        family: 4, // Force IPv4 to bypass docker container IPv6 DNS resolution issues
        timeout: 10000 // 10 seconds timeout
      };

      const req = https.request(reqOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: async () => {
              try {
                return JSON.parse(data);
              } catch (e) {
                throw new Error(`Failed to parse JSON response: ${data}`);
              }
            },
            text: async () => data
          });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(options.body);
      }
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

function getTelegramChatIds() {
  try {
    const db = readDb();
    return db.telegram_chat_ids || [];
  } catch (e) {
    return [];
  }
}

function addTelegramChatId(chatId) {
  try {
    const db = readDb();
    if (!db.telegram_chat_ids) {
      db.telegram_chat_ids = [];
    }
    if (!db.telegram_chat_ids.includes(chatId)) {
      db.telegram_chat_ids.push(chatId);
      writeDb(db);
      console.log(`[Telegram] Registered new chat ID: ${chatId}`);
      return true;
    }
  } catch (e) {
    console.error('Failed to add Telegram chat ID:', e);
  }
  return false;
}

export async function pollTelegramUpdates() {
  try {
    const res = await telegramFetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          const chatId = update.message?.chat?.id || update.channel_post?.chat?.id;
          if (chatId) {
            addTelegramChatId(chatId);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error polling Telegram updates:', err.message);
  }
}

export async function sendTelegramMessage(text) {
  await pollTelegramUpdates();
  const chatIds = getTelegramChatIds();
  if (chatIds.length === 0) {
    console.warn('[Telegram] No registered chat IDs. Send a message to @AS_FormApproval_bot first.');
    return;
  }
  
  for (const chatId of chatIds) {
    try {
      await telegramFetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'Markdown'
        })
      });
    } catch (err) {
      console.error(`[Telegram] Failed to send message to ${chatId}:`, err.message);
    }
  }
}

function getDiskSpace() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec('wmic logicaldisk where "DeviceID=\'C:\'" get FreeSpace,Size /value', (error, stdout) => {
        if (error) {
          resolve('Error reading disk');
          return;
        }
        resolve(stdout.trim());
      });
    } else {
      exec('df -h /', (error, stdout) => {
        if (error) {
          resolve('Error reading disk');
          return;
        }
        resolve(stdout.trim());
      });
    }
  });
}

function cpuAverage() {
  const cpus = os.cpus();
  let idleMs = 0;
  let totalMs = 0;
  if (!cpus || cpus.length === 0) return { idle: 0, total: 0 };
  cpus.forEach((cpu) => {
    for (const type in cpu.times) {
      totalMs += cpu.times[type];
    }
    idleMs += cpu.times.idle;
  });
  return { idle: idleMs / cpus.length, total: totalMs / cpus.length };
}

function calculateCpuUsage() {
  return new Promise((resolve) => {
    const start = cpuAverage();
    setTimeout(() => {
      const end = cpuAverage();
      const idleDiff = end.idle - start.idle;
      const totalDiff = end.total - start.total;
      if (totalDiff === 0) {
        resolve(0);
        return;
      }
      const usage = 100 - Math.round((100 * idleDiff) / totalDiff);
      resolve(usage);
    }, 1000);
  });
}

async function getSystemMetrics() {
  // RAM Usage
  const totalMemBytes = os.totalmem();
  const freeMemBytes = os.freemem();
  const usedMemBytes = totalMemBytes - freeMemBytes;
  const totalMemMB = (totalMemBytes / (1024 * 1024)).toFixed(0);
  const usedMemMB = (usedMemBytes / (1024 * 1024)).toFixed(0);
  const ramUsagePercent = ((usedMemBytes / totalMemBytes) * 100).toFixed(1);
  
  // CPU Usage
  const cpuUsagePercent = await calculateCpuUsage();
  
  // Disk space
  const diskRaw = await getDiskSpace();
  let diskSummary = 'Unknown';
  if (process.platform === 'win32') {
    const freeMatch = diskRaw.match(/FreeSpace=(\d+)/);
    const sizeMatch = diskRaw.match(/Size=(\d+)/);
    if (freeMatch && sizeMatch) {
      const free = parseInt(freeMatch[1], 10);
      const size = parseInt(sizeMatch[1], 10);
      const used = size - free;
      const freeGB = (free / (1024 * 1024 * 1024)).toFixed(1);
      const sizeGB = (size / (1024 * 1024 * 1024)).toFixed(1);
      const usedGB = (used / (1024 * 1024 * 1024)).toFixed(1);
      const usedPercent = ((used / size) * 100).toFixed(1);
      diskSummary = `Size: ${sizeGB}GB, Used: ${usedGB}GB (${usedPercent}%), Available: ${freeGB}GB`;
    } else {
      diskSummary = diskRaw || 'Unknown';
    }
  } else {
    const diskLines = diskRaw.split('\n');
    if (diskLines.length > 1) {
      const parts = diskLines[1].replace(/\s+/g, ' ').split(' ');
      if (parts.length >= 5) {
        diskSummary = `Size: ${parts[1]}, Used: ${parts[2]} (${parts[4]}), Available: ${parts[3]}`;
      }
    }
  }

  // Uptime
  const uptimeSeconds = os.uptime();
  const uptimeDays = Math.floor(uptimeSeconds / (24 * 3600));
  const uptimeHrs = Math.floor((uptimeSeconds % (24 * 3600)) / 3600);
  const uptimeMins = Math.floor((uptimeSeconds % 3600) / 60);
  const uptimeStr = `${uptimeDays}d ${uptimeHrs}h ${uptimeMins}m`;

  return {
    ram: `${usedMemMB}MB / ${totalMemMB}MB (${ramUsagePercent}%)`,
    cpu: `${cpuUsagePercent}%`,
    disk: diskSummary,
    uptime: uptimeStr
  };
}

function queueTelegramMessage(msg) {
  try {
    const db = readDb();
    if (!db.telegram_queue) {
      db.telegram_queue = [];
    }
    db.telegram_queue.push({
      text: msg,
      timestamp: new Date().toISOString()
    });
    writeDb(db);
    console.log(`[Telegram Queue] Queued new message: ${msg.substring(0, 45)}...`);
  } catch (e) {
    console.error('[Telegram Queue] Failed to queue message:', e);
  }
}

export async function sendClientApprovalTelegramNotification(requestData, pmEvent, clientEvent) {
  const amountStr = pmEvent.financial_impact === 'none' 
    ? 'Tanpa dampak biaya' 
    : `${pmEvent.financial_impact === 'increase' ? '+' : '-'}Rp ${Number(pmEvent.financial_amount).toLocaleString('id-ID')}`;
  
  const scheduleStr = pmEvent.schedule_impact === 'none' 
    ? 'Tanpa dampak jadwal' 
    : `${pmEvent.schedule_days} Hari (${pmEvent.schedule_impact === 'adds' ? 'Bertambah' : 'Berkurang'})`;

  const message = `
🤝 *VARIASI DISETUJUI KLIEN*
• *Lokasi Proyek:* \`${requestData.project_address}\`
• *ID Permohonan:* \`${requestData.submission_id}\`
• *Dampak Finansial:* \`${amountStr}\`
• *Dampak Jadwal:* \`${scheduleStr}\`
• *Ditandatangani Oleh:* \`${clientEvent.client_name}\`
• *Catatan:* \`${clientEvent.pm_notes || '-'}\`
  `.trim();

  // Accumulate to queue instead of sending in real-time
  queueTelegramMessage(message);
}

export async function sendErrorTelegramNotification(error, { siteId, session, path }) {
  const time = new Date().toLocaleString();
  const userStr = session ? `${session.name} (${session.email})` : 'Anonymous';
  const siteStr = siteId || 'N/A';
  
  const message = `
⚠️ *SYSTEM RUNTIME ERROR*
• *Time:* \`${time}\`
• *User:* \`${userStr}\`
• *Site ID:* \`${siteStr}\`
• *Path:* \`${path || 'N/A'}\`
• *Message:* \`${error.message || error}\`
  `.trim();

  // Accumulate to queue instead of sending in real-time
  queueTelegramMessage(message);
}

export function initTelegramBot() {
  if (global.telegramBotInitialized) return;
  global.telegramBotInitialized = true;

  console.log('[Telegram] Initializing Telegram Bot and Server Metrics monitor...');
  
  // Register startup log (Queued to avoid noisy immediate messages)
  setTimeout(() => {
    try {
      const text = `ℹ️ *SYSTEM RESTART:* Elevate Equity Form Approval Portal started successfully.`;
      console.log(`[Telegram Log] ${text}`);
    } catch (err) {
      console.error('Failed to log startup:', err.message);
    }
  }, 5000);

  // Helper to schedule timezone-aware daily server metrics summary at 06:00 AM
  function scheduleDailyMetrics() {
    const scheduleNext = () => {
      const now = new Date();
      const target = new Date();
      target.setHours(6, 0, 0, 0); // 06:00 AM today
      if (now >= target) {
        target.setDate(target.getDate() + 1); // 06:00 AM tomorrow
      }
      const delay = target.getTime() - now.getTime();
      console.log(`[Telegram] Next daily server metrics report scheduled in ${(delay / (1000 * 60 * 60)).toFixed(2)} hours (at ${target.toLocaleString()})`);
      
      setTimeout(async () => {
        try {
          await pollTelegramUpdates();
          const metrics = await getSystemMetrics();
          
          // Pull queued notifications from db.json
          let queuedNotifsText = '';
          try {
            const db = readDb();
            const queue = db.telegram_queue || [];
            if (queue.length > 0) {
              queuedNotifsText = `\n\n🔔 *QUEUED ALERTS (LAST 24 HOURS)*\n` + queue.map((q, idx) => `\n*Alert #${idx + 1}:*\n${q.text}`).join('\n\n');
              // Clear queue
              db.telegram_queue = [];
              writeDb(db);
            } else {
              queuedNotifsText = `\n\n🔔 *QUEUED ALERTS (LAST 24 HOURS)*\n• \`No approvals or errors recorded.\``;
            }
          } catch (qErr) {
            console.error('Failed to read or clear Telegram queue:', qErr.message);
          }

          const text = `
📊 *DAILY SERVER METRICS SUMMARY*

• *CPU Usage:* \`${metrics.cpu}\`
• *RAM Usage:* \`${metrics.ram}\`
• *Disk Usage:* \`${metrics.disk}\`
• *System Uptime:* \`${metrics.uptime}\`${queuedNotifsText}
          `.trim();
          
          await sendTelegramMessage(text);
        } catch (err) {
          console.error('Failed to send daily metrics report:', err.message);
        }
        scheduleNext(); // Schedule for the next day
      }, delay);
    };
    
    scheduleNext();
  }

  // Call daily summary scheduler
  scheduleDailyMetrics();
}

// Auto-initialize Telegram Bot when the module is loaded on server side
if (typeof window === 'undefined' && process.env.NEXT_PHASE !== 'phase-production-build') {
  try {
    initTelegramBot();
  } catch (err) {
    console.error('Error auto-initializing Telegram Bot:', err);
  }
}

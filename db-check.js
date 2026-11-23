const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('SSH Connection established successfully!');
  console.log('Running database inspection on server...');
  
  // Write a temporary node script on the server to print DB mode and user table
  const remoteNodeScript = `
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const fs = require('fs');
    const path = require('path');

    async function check() {
      console.log('=== Server Database Inspection ===');
      
      // Test Postgres Connection
      let dbMode = 'json';
      try {
        await prisma.$connect();
        dbMode = 'postgres';
        console.log('Database Connection: Connected to PostgreSQL.');
      } catch (err) {
        console.log('Database Connection: PostgreSQL Failed, falling back to JSON.');
      }

      if (dbMode === 'postgres') {
        try {
          const users = await prisma.pm_users.findMany({
            orderBy: { id: 'asc' }
          });
          console.log('\\nPM Users in Postgres:');
          users.forEach(u => {
            console.log(\`- ID: \${u.id}, Name: \${u.name}, Email: \${u.email}, Active: \${u.active}, HasPassword: \${!!u.password}\`);
          });
        } catch (err) {
          console.error('Error querying postgres users:', err.message);
        }
      }

      // Check JSON fallback database
      const dbPath = path.join(process.cwd(), 'src/db/db.json');
      if (fs.existsSync(dbPath)) {
        try {
          const jsonDb = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
          console.log('\\nPM Users in local db.json:');
          jsonDb.pm_users.forEach(u => {
            console.log(\`- ID: \${u.id}, Name: \${u.name}, Email: \${u.email}, Active: \${u.active}, HasPassword: \${!!u.password}\`);
          });
        } catch (err) {
          console.log('Error reading local db.json:', err.message);
        }
      } else {
        console.log('\\nLocal db.json does not exist.');
      }
      
      await prisma.$disconnect();
    }
    check();
  `;

  // Write remote script and run it inside the docker container
  const escapedScript = remoteNodeScript.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
  const runCmd = `echo "##BangBang50" | sudo -S docker exec ee_form_approval_web node -e "${escapedScript}"`;

  conn.exec(runCmd, (err, stream) => {
    if (err) {
      console.error('Execution error:', err);
      conn.end();
      return;
    }
    
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).on('error', (err) => {
  console.error('SSH Connection error:', err);
}).connect({
  host: '192.168.1.210',
  port: 22,
  username: 'asadmin',
  password: '##BangBang50'
});

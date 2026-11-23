const { Client } = require('ssh2');
const conn = new Client();

const command = 'systemctl restart docker && cd /root/ee_form_approval && docker compose down && cd .. && rm -rf ee_form_approval';

conn.on('ready', () => {
  console.log(`SSH Connection to 139.180.181.207 established for cleanup...`);
  console.log(`Running cleanup command: ${command}`);
  
  conn.exec(command, (err, stream) => {
    if (err) {
      console.error('Execution error:', err);
      conn.end();
      return;
    }
    
    stream.on('close', (code, signal) => {
      console.log(`\nCleanup finished with exit code ${code}`);
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
  host: '139.180.181.207',
  port: 22,
  username: 'root',
  password: 'F,2bu6Eu#)rJNX!3'
});

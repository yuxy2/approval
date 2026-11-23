const { Client } = require('ssh2');
const conn = new Client();

conn.on('ready', () => {
  console.log('SSH Connection established successfully!');
  console.log('Fetching production container logs (last 200 lines)...');
  
  const cmd = 'echo "##BangBang50" | sudo -S docker logs --tail 1000 ee_form_approval_web';
  
  conn.exec(cmd, (err, stream) => {
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

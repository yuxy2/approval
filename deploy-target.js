const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const conn = new Client();

const CONFIG = {
  host: '192.168.1.210',
  port: 22,
  username: 'asadmin',
  password: '##BangBang50',
  repoUrl: 'https://github.com/ApartmentSpecialists/AS-Form-Approval-WebApps.git',
  targetDir: '/home/asadmin/FE_form_approval'
};

const dockerComposeContent = `version: '3.8'

services:
  # Next.js Web Application Service
  web:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: ee_form_approval_web
    restart: always
    ports:
      - "3060:3000"
    user: "root"
    environment:
      # Connect directly to host's PostgreSQL database
      DATABASE_URL: "postgresql://postgres:Adminas2026!@192.168.1.210:5432/form_approval?schema=public"
      
      # SMTP Configuration Settings
      SMTP_HOST: "smtp.gmail.com"
      SMTP_PORT: 587
      SMTP_USER: "kurnia@apartmentspecialists.co.nz"
      SMTP_PASSWORD: "uifxbbihjavoskfn"
      EMAIL_FROM: "Form Approval <kurnia@apartmentspecialists.co.nz>"
      
      # Domain aplikasi produksi Anda (Penting untuk generate link di email)
      NEXT_PUBLIC_APP_URL: "http://192.168.1.210:3060"
    volumes:
      - ./src/db:/app/src/db
`;

conn.on('ready', () => {
  console.log('SSH Connection established successfully!');
  
  // 1. Check if the target directory exists
  const checkDirCmd = `if [ -d "${CONFIG.targetDir}" ]; then echo "exists"; else echo "not_exists"; fi`;
  
  conn.exec(checkDirCmd, (err, stream) => {
    if (err) {
      console.error('Failed to check directory:', err);
      conn.end();
      return;
    }
    
    stream.on('data', (data) => {
      const result = data.toString().trim();
      console.log(`Target directory exists: ${result === 'exists'}`);
      
      let setupCmd;
      if (result === 'exists') {
        setupCmd = [
          `cd ${CONFIG.targetDir}`,
          `git remote set-url origin ${CONFIG.repoUrl}`,
          `git fetch origin`,
          `git reset --hard origin/master`,
          `git pull origin master`
        ].join(' && ');
      } else {
        const parentDir = path.dirname(CONFIG.targetDir).replace(/\\/g, '/');
        setupCmd = [
          `mkdir -p ${parentDir}`,
          `cd ${parentDir}`,
          `git clone ${CONFIG.repoUrl} ${path.basename(CONFIG.targetDir)}`
        ].join(' && ');
      }
      
      console.log('Directory exists. Updating remote URL and pulling latest code changes...');
      
      conn.exec(setupCmd, (gitErr, gitStream) => {
        if (gitErr) {
          console.error('Git operations failed:', gitErr);
          conn.end();
          return;
        }
        
        gitStream.on('data', (d) => {
          process.stdout.write(d);
        }).on('close', (code) => {
          if (code !== 0) {
            console.error(`Git commands failed with code ${code}`);
            conn.end();
            return;
          }
          console.log('Git operation completed successfully.');
          
          // 2. Upload key assets
          console.log('Opening SFTP session...');
          conn.sftp((sftpErr, sftp) => {
            if (sftpErr) {
              console.error('SFTP session failed:', sftpErr);
              conn.end();
              return;
            }
            
            const filesToUpload = [
              { local: 'Service-account.json', remote: path.join(CONFIG.targetDir, 'Service-account.json') },
              { local: 'src/utils/pdf.js', remote: path.join(CONFIG.targetDir, 'src/utils/pdf.js') },
              { local: 'src/utils/telegram.js', remote: path.join(CONFIG.targetDir, 'src/utils/telegram.js') },
              { local: 'src/db/db.json', remote: path.join(CONFIG.targetDir, 'src/db/db.json') }
            ];
            
            let uploadPromise = Promise.resolve();
            filesToUpload.forEach(f => {
              if (fs.existsSync(f.local)) {
                uploadPromise = uploadPromise.then(() => new Promise((resolve, reject) => {
                  console.log(`Uploading local ${f.local} directly to the server via SFTP...`);
                  sftp.fastPut(f.local, f.remote.replace(/\\/g, '/'), (putErr) => {
                    if (putErr) {
                      reject(putErr);
                    } else {
                      console.log(`Successfully uploaded ${f.local}.`);
                      resolve();
                    }
                  });
                }));
              }
            });
            
            uploadPromise.then(() => {
              // 3. Write/overwrite docker-compose.yml
              console.log('Writing updated docker-compose.yml to the server...');
              const remoteDockerComposePath = path.join(CONFIG.targetDir, 'docker-compose.yml').replace(/\\/g, '/');
              
              sftp.writeFile(remoteDockerComposePath, dockerComposeContent, 'utf8', (writeErr) => {
                if (writeErr) {
                  console.error('Failed to write docker-compose.yml on server:', writeErr);
                  conn.end();
                  return;
                }
                
                console.log('Successfully wrote docker-compose.yml on the server.');
                
                // 4. Run docker-compose build and restart on the server
                console.log('Rebuilding and restarting docker containers...');
                const deployCmds = [
                  `cd ${CONFIG.targetDir}`,
                  `echo "${CONFIG.password}" | sudo -S docker compose down`,
                  `echo "${CONFIG.password}" | sudo -S docker compose up --build -d`
                ].join(' && ');
                
                conn.exec(deployCmds, (execErr, execStream) => {
                  if (execErr) {
                    console.error('Failed to execute docker compose command:', execErr);
                    conn.end();
                    return;
                  }
                  
                  execStream.on('data', (data) => {
                    process.stdout.write(data);
                  }).stderr.on('data', (data) => {
                    process.stderr.write(data);
                  }).on('close', (code) => {
                    console.log(`Docker compose deployment finished with exit code ${code}`);
                    
                    // Show running containers on the host
                    conn.exec(`echo "${CONFIG.password}" | sudo -S docker ps`, (psErr, psStream) => {
                      if (psErr) {
                        conn.end();
                        return;
                      }
                      console.log('\n=== Target Server Containers ===');
                      psStream.on('data', (data) => {
                        process.stdout.write(data);
                      }).on('close', () => {
                        conn.end();
                      });
                    });
                  });
                });
              });
            }).catch((promiseErr) => {
              console.error('Deployment flow aborted due to error:', promiseErr);
              conn.end();
            });
          });
        });
      });
    });
  });
}).on('error', (err) => {
  console.error('SSH Connection error:', err);
}).connect({
  host: CONFIG.host,
  port: CONFIG.port,
  username: CONFIG.username,
  password: CONFIG.password
});

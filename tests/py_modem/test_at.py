import os
import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(os.getenv('SSH_HOST', '192.168.225.1'), username=os.getenv('SSH_USERNAME', 'root'), password=os.getenv('SSH_PASSWORD', 'admin'), timeout=5)

commands = [
    "echo AT+GSN | /usr/bin/qcmd",
    "echo AT+QCCID | /usr/bin/qcmd",
    "echo AT+CIMI | /usr/bin/qcmd",
    "echo 'AT+COPS?' | /usr/bin/qcmd",
    "echo AT+CGPADDR=1 | /usr/bin/qcmd",
    'echo \'AT+QENG="servingcell"\' | /usr/bin/qcmd',
    "echo AT+CNUM | /usr/bin/qcmd",
]

for c in commands:
    print(f"=== CMD: {c} ===")
    stdin, stdout, stderr = ssh.exec_command(c)
    out = stdout.read().decode('utf-8', errors='ignore')
    print(out)

ssh.close()

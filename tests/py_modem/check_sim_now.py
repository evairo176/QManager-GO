import os
import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(os.getenv('SSH_HOST', '192.168.225.1'), username=os.getenv('SSH_USERNAME', 'root'), password=os.getenv('SSH_PASSWORD', 'admin'), timeout=5)

commands = [
    '/usr/bin/atcli_smd11 "AT+CPIN?"',
    '/usr/bin/atcli_smd11 "AT+QCCID"',
    '/usr/bin/atcli_smd11 "AT+CIMI"',
    '/usr/bin/atcli_smd11 "AT+COPS?"',
    '/usr/bin/atcli_smd11 "AT+CGPADDR=1"',
    '/usr/bin/atcli_smd11 "AT+QENG=\\"servingcell\\""',
]

for c in commands:
    print(f"=== {c} ===")
    stdin, stdout, stderr = ssh.exec_command(c)
    res = stdout.read().decode('utf-8', errors='ignore')
    print(res.encode('ascii', errors='ignore').decode('ascii'))

ssh.close()

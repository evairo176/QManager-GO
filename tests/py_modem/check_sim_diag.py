import os
import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(os.getenv('SSH_HOST', '192.168.225.1'), username=os.getenv('SSH_USERNAME', 'root'), password=os.getenv('SSH_PASSWORD', 'admin'), timeout=5)

commands = [
    '/usr/bin/atcli_smd11 "AT+QUIMSLOT?"',
    '/usr/bin/atcli_smd11 "AT+QSIMSTAT?"',
    '/usr/bin/atcli_smd11 "AT+QSIMDET?"',
    '/usr/bin/atcli_smd11 "AT+CFUN?"',
]

for c in commands:
    print(f"=== {c} ===")
    stdin, stdout, stderr = ssh.exec_command(c)
    res = stdout.read().decode('utf-8', errors='ignore')
    print(res.encode('ascii', errors='ignore').decode('ascii'))

ssh.close()

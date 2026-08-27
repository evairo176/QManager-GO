import os
import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(os.getenv('SSH_HOST', '192.168.225.1'), username=os.getenv('SSH_USERNAME', 'root'), password=os.getenv('SSH_PASSWORD', 'admin'), timeout=5)

commands = [
    '/usr/bin/atcli_smd11 "AT+CFUN?"',
    '/usr/bin/atcli_smd11 "AT+QUIMSLOT?"',
    '/usr/bin/atcli_smd11 "AT+CPIN?"',
    '/usr/bin/atcli_smd11 "AT+QSIMSTAT?"',
    '/usr/bin/atcli_smd11 "AT+QSIMDET?"',
]

for c in commands:
    print(f"=== {c} ===")
    stdin, stdout, stderr = ssh.exec_command(c)
    print(stdout.read().decode('utf-8', errors='ignore'))

ssh.close()

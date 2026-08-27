import os
import paramiko, time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(os.getenv('SSH_HOST', '192.168.225.1'), username=os.getenv('SSH_USERNAME', 'root'), password=os.getenv('SSH_PASSWORD', 'admin'), timeout=5)

commands = [
    '/usr/bin/atcli_smd11 "AT+CFUN=0"',
    '/usr/bin/atcli_smd11 "AT+QUIMSLOT=1"',
    '/usr/bin/atcli_smd11 "AT+CFUN=1"',
]

for c in commands:
    print(f"=== {c} ===")
    stdin, stdout, stderr = ssh.exec_command(c)
    print(stdout.read().decode('utf-8', errors='ignore'))
    time.sleep(1)

print("Waiting 5s for SIM initialization...")
time.sleep(5)

check_cmds = [
    '/usr/bin/atcli_smd11 "AT+CPIN?"',
    '/usr/bin/atcli_smd11 "AT+QCCID"',
    '/usr/bin/atcli_smd11 "AT+COPS?"',
]

for c in check_cmds:
    print(f"=== {c} ===")
    stdin, stdout, stderr = ssh.exec_command(c)
    print(stdout.read().decode('utf-8', errors='ignore'))

ssh.close()

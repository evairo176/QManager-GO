import os
import paramiko, time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(os.getenv('SSH_HOST', '192.168.225.1'), username=os.getenv('SSH_USERNAME', 'root'), password=os.getenv('SSH_PASSWORD', 'admin'), timeout=5)

print("Resetting radio stack (CFUN 0 -> 1)...")
ssh.exec_command('/usr/bin/atcli_smd11 "AT+CFUN=0"')
time.sleep(2)
ssh.exec_command('/usr/bin/atcli_smd11 "AT+CFUN=1"')

print("Waiting 10s for SIM registration...")
time.sleep(10)

commands = [
    '/usr/bin/atcli_smd11 "AT+CPIN?"',
    '/usr/bin/atcli_smd11 "AT+QCCID"',
    '/usr/bin/atcli_smd11 "AT+CIMI"',
    '/usr/bin/atcli_smd11 "AT+COPS?"',
    '/usr/bin/atcli_smd11 "AT+CGPADDR=1"',
]

for c in commands:
    print(f"=== {c} ===")
    stdin, stdout, stderr = ssh.exec_command(c)
    print(repr(stdout.read().decode('utf-8', errors='ignore')))

ssh.close()

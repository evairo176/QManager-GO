import os
import paramiko, time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(os.getenv('SSH_HOST', '192.168.225.1'), username=os.getenv('SSH_USERNAME', 'root'), password=os.getenv('SSH_PASSWORD', 'admin'), timeout=5)

print("Switching modem to SIM Slot 1...")
stdin, stdout, stderr = ssh.exec_command('/usr/bin/atcli_smd11 "AT+QUIMSLOT=1"')
print(stdout.read().decode('utf-8', errors='ignore'))

time.sleep(3)

commands = [
    '/usr/bin/atcli_smd11 "AT+QUIMSLOT?"',
    '/usr/bin/atcli_smd11 "AT+QSIMSTAT?"',
    '/usr/bin/atcli_smd11 "AT+CPIN?"',
    '/usr/bin/atcli_smd11 "AT+QCCID"',
    '/usr/bin/atcli_smd11 "AT+CIMI"',
]

for c in commands:
    print(f"=== {c} ===")
    stdin, stdout, stderr = ssh.exec_command(c)
    print(repr(stdout.read().decode('utf-8', errors='ignore')))

ssh.close()

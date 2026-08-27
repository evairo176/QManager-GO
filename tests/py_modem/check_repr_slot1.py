import os
import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(os.getenv('SSH_HOST', '192.168.225.1'), username=os.getenv('SSH_USERNAME', 'root'), password=os.getenv('SSH_PASSWORD', 'admin'), timeout=5)

stdin, stdout, stderr = ssh.exec_command('/usr/bin/atcli_smd11 "AT+QSIMSTAT?"')
print("QSIMSTAT:", repr(stdout.read().decode('utf-8', errors='ignore')))

stdin, stdout, stderr = ssh.exec_command('/usr/bin/atcli_smd11 "AT+QUIMSLOT?"')
print("QUIMSLOT:", repr(stdout.read().decode('utf-8', errors='ignore')))

ssh.close()

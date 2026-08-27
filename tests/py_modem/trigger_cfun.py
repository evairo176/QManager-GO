import os
import paramiko, time

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(os.getenv('SSH_HOST', '192.168.225.1'), username=os.getenv('SSH_USERNAME', 'root'), password=os.getenv('SSH_PASSWORD', 'admin'), timeout=5)

stdin, stdout, stderr = ssh.exec_command('/usr/bin/atcli_smd11 "AT+CFUN=1"')
stdout.channel.recv_exit_status()

print("Waiting 8s for poller cycle...")
time.sleep(8)

ssh.close()

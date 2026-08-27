import os
import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(os.getenv('SSH_HOST', '192.168.225.1'), username=os.getenv('SSH_USERNAME', 'root'), password=os.getenv('SSH_PASSWORD', 'admin'), timeout=5)

commands = [
    '/usr/bin/atcli_smd11 "AT+QENG=\\"servingcell\\""',
    '/usr/bin/atcli_smd11 "AT+QNWPREFCFG=\\"mode_pref\\""',
    '/usr/bin/atcli_smd11 "AT+QNWPREFCFG=\\"rat_acq_order\\""',
    '/usr/bin/atcli_smd11 "AT+QNWPREFCFG=\\"nr5g_disable_mode\\""',
]

for c in commands:
    print(f"=== {c} ===")
    stdin, stdout, stderr = ssh.exec_command(c)
    print(repr(stdout.read().decode('utf-8', errors='ignore')))

ssh.close()

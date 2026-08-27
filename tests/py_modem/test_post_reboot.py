import os
import paramiko

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

try:
    ssh.connect(os.getenv('SSH_HOST', '192.168.225.1'), username=os.getenv('SSH_USERNAME', 'root'), password=os.getenv('SSH_PASSWORD', 'admin'), timeout=5)
    print("SSH Connected successfully!")

    commands = [
        "systemctl status qmanager-core",
        "systemctl status lighttpd",
        "netstat -tulpn",
    ]

    for c in commands:
        print(f"=== {c} ===")
        stdin, stdout, stderr = ssh.exec_command(c)
        res = stdout.read().decode('utf-8', errors='ignore')
        print(res.encode('ascii', errors='ignore').decode('ascii'))

    ssh.close()
except Exception as e:
    print("SSH Connection failed:", e)

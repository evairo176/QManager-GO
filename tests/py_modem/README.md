# Modem Diagnostic Toolkit (Python)

Collection of lightweight Python SSH/AT diagnostic scripts for troubleshooting Quectel modems (RM520N, RM500Q, RG501Q, RM551E, etc.) directly over LAN SSH.

## Prerequisites

```bash
pip install -r requirements.txt
```

## Environment Configuration

Scripts load connection parameters from environment variables (or `.env` file):

- `SSH_HOST`: Target modem IP address (default: `192.168.225.1`)
- `SSH_USERNAME`: SSH username (default: `root`)
- `SSH_PASSWORD`: SSH password (default: `admin`)

## Tool Inventory

### SIM & Network Diagnostics
- `check_sim_now.py`: Query live SIM state (`AT+CPIN?`, `AT+QCCID`, `AT+CIMI`, `AT+COPS?`, `AT+CGPADDR`).
- `check_sim_diag.py`: Query hardware SIM detection registers (`AT+QSIMSTAT?`, `AT+QSIMDET?`).
- `switch_slot1.py`: Switch active SIM slot to Slot 1 (`AT+QUIMSLOT=1`).
- `test_sim_slot2.py`: Switch active SIM slot to Slot 2 (`AT+QUIMSLOT=2`).
- `register_sim.py`: Trigger radio reset (`AT+CFUN=0` -> `AT+CFUN=1`) and poll SIM registration status.

### AT Execution & Interface Probing
- `test_atcli_cmds.py`: Test direct execution via `/usr/bin/atcli_smd11`.
- `test_qcmd.py`: Inspect `/dev/smd*` serial devices and `qcmd` wrapper interface.
- `test_net_priority.py`: Query RAT acquisition order (`AT+QNWPREFCFG="rat_acq_order"`).

### Modem Service & Process Monitoring
- `read_status_json.py`: Read `/tmp/qmanager_status.json` cache from live modem.
- `test_post_reboot.py`: Check systemd services and port bindings post-reboot.
- `find_lighttpd.py`: Locate legacy webserver artifacts on modem filesystem.

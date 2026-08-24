/** A named AT command preset shown in the Commands popover. */
export interface ATCommandPreset {
  /** Stable identifier for i18n lookup. Only set on built-in presets; user-added custom commands leave this undefined. */
  id?: string;
  label: string;
  command: string;
}

/**
 * Default AT command presets loaded from the original `/etc/config/atcommands.user`.
 * Covers modem control (CFUN), network mode (QNWPREFCFG), SIM slots (QUIMSLOT),
 * APN management (CGDCONT), band queries, and IP passthrough (QMAP).
 */
export const DEFAULT_AT_COMMANDS: ATCommandPreset[] = [
  { id: "reboot", label: "Reboot", command: "AT+CFUN=1,1" },
  { id: "disconnect", label: "Disconnect", command: "AT+CFUN=0" },
  { id: "connect", label: "Connect", command: "AT+CFUN=1" },
  { id: "signal_info", label: "Signal Info", command: 'AT+QENG="servingcell"' },
  { id: "ca_info", label: "CA Info", command: "AT+QCAINFO" },
  { id: "get_sim_slot", label: "Get current SIM Slot", command: "AT+QUIMSLOT?" },
  { id: "switch_sim_slot_1", label: "Switch to SIM Slot 1", command: "AT+QUIMSLOT=1" },
  { id: "switch_sim_slot_2", label: "Switch to SIM Slot 2", command: "AT+QUIMSLOT=2" },
  { id: "get_apn_list", label: "Get current APN List", command: "AT+CGDCONT?" },
  { id: "set_apn_nrbroadband", label: "Set APN to NRBROADBAND", command: 'AT+CGDCONT=1,"IPV4V6","NRBROADBAND"' },
  { id: "show_imei", label: "Show Current IMEI", command: "AT+EGMR=0,7" },
  { id: "show_network_mode", label: "Show Current Network Mode", command: 'AT+QNWPREFCFG="mode_pref"' },
  { id: "set_network_mode_auto", label: "Set Network Mode to AUTO", command: 'AT+QNWPREFCFG="mode_pref",AUTO' },
  { id: "set_network_mode_5g_lte", label: "Set Network Mode to 5G NR/4G LTE Only", command: 'AT+QNWPREFCFG="mode_pref",NR5G:LTE' },
  { id: "set_network_mode_5g_only", label: "Set Network Mode to 5G NR Only", command: 'AT+QNWPREFCFG="mode_pref",NR5G' },
  { id: "set_network_mode_lte_only", label: "Set Network Mode to 4G LTE Only", command: 'AT+QNWPREFCFG="mode_pref",LTE' },
  { id: "check_sa_nsa_status", label: "Check SA/NSA disable status", command: 'AT+QNWPREFCFG="nr5g_disable_mode"' },
  { id: "enable_sa_nsa", label: "Enable Both SA and NSA", command: 'AT+QNWPREFCFG="nr5g_disable_mode",0' },
  { id: "disable_sa_only", label: "Disable SA Only", command: 'AT+QNWPREFCFG="nr5g_disable_mode",1' },
  { id: "disable_nsa_only", label: "Disable NSA Only", command: 'AT+QNWPREFCFG="nr5g_disable_mode",2' },
  { id: "get_5g_sa_bands", label: "Get Enabled 5G NR SA Bands", command: 'AT+QNWPREFCFG="nr5g_band"' },
  { id: "get_5g_nsa_bands", label: "Get Enabled 5G NR NSA Bands", command: 'AT+QNWPREFCFG="nsa_nr5g_band"' },
  { id: "get_4g_lte_bands", label: "Get Enabled 4G LTE Bands", command: 'AT+QNWPREFCFG="lte_band"' },
  { id: "view_ip_addresses", label: "View assigned IP addresses", command: 'AT+QMAP="WWAN"' },
  { id: "enable_ippt", label: "Enable IPPT (MAC passthrough)", command: 'AT+QMAP="MPDN_rule",0,1,0,1,1,"FF:FF:FF:FF:FF:FF"' },
  { id: "disable_ippt", label: "Disable IPPT", command: 'AT+QMAP="MPDN_rule",0' },
];

// lib/config-backup/sections.ts
import type { BackupSectionMeta, BackupSectionKey } from "@/types/config-backup";

export const BACKUP_SECTIONS: BackupSectionMeta[] = [
  {
    key: "network_mode_apn",
    label: "Network Mode and APN settings",
    description: "Scan mode, scan sequence, and all APN profiles",
    overlapGroup: "profile",
    defaultChecked: true,
  },
  {
    key: "bands",
    label: "Preferred LTE and 5G bands",
    description: "Locked LTE, NSA, and SA band lists",
    overlapGroup: null,
    defaultChecked: true,
  },
  {
    key: "tower_lock",
    label: "Tower Locking settings",
    description: "Locked LTE and 5G NR-SA cells",
    overlapGroup: null,
    defaultChecked: false,
  },
  {
    key: "ttl_hl",
    label: "TTL/HL settings",
    description: "TTL and hop-limit firewall rules",
    overlapGroup: "profile",
    defaultChecked: false,
  },
  {
    key: "imei",
    label: "IMEI Settings",
    description: "Current device IMEI",
    overlapGroup: "profile",
    defaultChecked: false,
  },
  {
    key: "profiles",
    label: "Custom SIM Profiles",
    description: "All saved profiles plus the active marker",
    overlapGroup: "profile-parent",
    defaultChecked: false,
  },
  {
    key: "sms_alerts",
    label: "SMS Alerts configuration",
    description: "Alert recipient and threshold settings",
    overlapGroup: null,
    defaultChecked: false,
  },
  {
    key: "watchdog",
    label: "Watchdog/Watchcat configuration",
    description: "All watchcat UCI keys and tier toggles",
    overlapGroup: null,
    defaultChecked: false,
  },
];

export type SelectionMap = Record<BackupSectionKey, boolean>;

const PROFILE_MEMBERS: BackupSectionKey[] = ["network_mode_apn", "ttl_hl", "imei"];

/**
 * Returns the set of section keys that should be UI-disabled given the current
 * selection. Implements the profile overlap rule: checking "profiles" disables
 * the three sections it covers, and checking any of those disables "profiles".
 *
 * Caller contract: the UI is responsible for treating checked + disabled as
 * effectively unchecked (i.e. render `checked={selection[key] && !disabled.has(key)}`).
 * This function does not mutate the selection.
 */
export function computeDisabledKeys(selection: SelectionMap): Set<BackupSectionKey> {
  const disabled = new Set<BackupSectionKey>();
  if (selection.profiles) {
    for (const m of PROFILE_MEMBERS) disabled.add(m);
  }
  if (PROFILE_MEMBERS.some((m) => selection[m])) {
    disabled.add("profiles");
  }
  return disabled;
}

export function initialSelection(): SelectionMap {
  const sel = {} as SelectionMap;
  for (const s of BACKUP_SECTIONS) sel[s.key] = s.defaultChecked;
  return sel;
}

export function selectedKeys(selection: SelectionMap): BackupSectionKey[] {
  return BACKUP_SECTIONS.map((s) => s.key).filter((k) => selection[k]);
}

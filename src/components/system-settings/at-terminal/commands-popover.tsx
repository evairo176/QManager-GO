"use client";

import { useState } from "react";
import { ChevronDownIcon, Trash2Icon } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { DEFAULT_AT_COMMANDS, type ATCommandPreset } from "@/constants/at-commands";
import { useTranslation } from "react-i18next";

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "qm_at_custom_commands";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadCustomCommands(): ATCommandPreset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ATCommandPreset[];
  } catch {
    return [];
  }
}

function saveCustomCommands(commands: ATCommandPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(commands));
  } catch {
    // ignore storage errors
  }
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface CommandsPopoverProps {
  onSelect: (command: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CommandsPopover({
  onSelect,
  inputRef,
}: CommandsPopoverProps) {
  const { t } = useTranslation("system-settings");
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  // Load custom commands once on mount via initializer
  const [customCommands, setCustomCommands] = useState<ATCommandPreset[]>(
    () => loadCustomCommands()
  );

  // Add form state
  const [newLabel, setNewLabel] = useState("");
  const [newCommand, setNewCommand] = useState("");
  const [addError, setAddError] = useState("");

  const totalCount = DEFAULT_AT_COMMANDS.length + customCommands.length;

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleAdd() {
    const trimmedLabel = newLabel.trim();
    const trimmedCommand = newCommand.trim();

    if (!trimmedLabel || !trimmedCommand) {
      setAddError(t("at_terminal.validate_fields_required"));
      return;
    }

    if (!trimmedCommand.toUpperCase().startsWith("AT")) {
      setAddError(t("at_terminal.validate_must_start_at"));
      return;
    }

    const allCommands = [...DEFAULT_AT_COMMANDS, ...customCommands];
    const isDuplicateCommand = allCommands.some(
      (p) => p.command.toLowerCase() === trimmedCommand.toLowerCase()
    );
    if (isDuplicateCommand) {
      setAddError(t("at_terminal.validate_command_duplicate"));
      return;
    }
    const isDuplicateLabel = allCommands.some(
      (p) => p.label.toLowerCase() === trimmedLabel.toLowerCase()
    );
    if (isDuplicateLabel) {
      setAddError(t("at_terminal.validate_label_duplicate"));
      return;
    }

    const updated = [
      ...customCommands,
      { label: trimmedLabel, command: trimmedCommand },
    ];
    setCustomCommands(updated);
    saveCustomCommands(updated);
    setNewLabel("");
    setNewCommand("");
    setAddError("");
  }

  function handleDelete(index: number) {
    const updated = customCommands.filter((_, i) => i !== index);
    setCustomCommands(updated);
    saveCustomCommands(updated);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="xs" aria-expanded={open}>
            {t("at_terminal.popover_trigger")}
            <ChevronDownIcon />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-80 p-0" align="end">
          <Command>
            <CommandInput placeholder={t("at_terminal.popover_search_placeholder")} />
            <CommandList>
              <CommandEmpty>{t("at_terminal.popover_no_results")}</CommandEmpty>

              <CommandGroup heading={t("at_terminal.popover_group_default")}>
                {DEFAULT_AT_COMMANDS.map((preset) => {
                  const label = preset.id
                    ? t(preset.id, { ns: "at-commands" })
                    : preset.label;
                  return (
                    <CommandItem
                      key={preset.command}
                      value={label}
                      onSelect={() => {
                        onSelect(preset.command);
                        setOpen(false);
                        inputRef.current?.focus();
                      }}
                    >
                      <span className="font-medium flex-1 min-w-0 truncate">
                        {label}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground truncate max-w-32">
                        {preset.command}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>

              {customCommands.length > 0 && (
                <CommandGroup heading={t("at_terminal.popover_group_custom")}>
                  {customCommands.map((preset) => (
                    <CommandItem
                      key={preset.command}
                      value={preset.label}
                      onSelect={() => {
                        onSelect(preset.command);
                        setOpen(false);
                        inputRef.current?.focus();
                      }}
                    >
                      <span className="font-medium flex-1 min-w-0 truncate">
                        {preset.label}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground truncate max-w-32">
                        {preset.command}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-2 border-t text-xs text-muted-foreground">
            <span>{t("at_terminal.popover_total_count", { count: totalCount })}</span>
            <button
              className="text-xs underline underline-offset-2 hover:text-foreground transition-colors"
              onClick={() => {
                setManageOpen(true);
                setOpen(false);
              }}
            >
              {t("at_terminal.popover_manage_button")}
            </button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Manage Commands Dialog */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("at_terminal.manage_title")}</DialogTitle>
            <DialogDescription>
              {t("at_terminal.manage_description")}
            </DialogDescription>
          </DialogHeader>

          {/* Custom command list */}
          {customCommands.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("at_terminal.manage_empty")}
            </p>
          ) : (
            <ul className="space-y-1">
              {customCommands.map((preset, index) => (
                <li
                  key={`${preset.command}-${index}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                >
                  <span className="flex-1 min-w-0">
                    <span className="font-medium text-sm block truncate">
                      {preset.label}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground block truncate">
                      {preset.command}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={t("at_terminal.manage_delete_aria", { label: preset.label })}
                    onClick={() => handleDelete(index)}
                  >
                    <Trash2Icon />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <Separator />

          {/* Add form */}
          <div className="flex gap-2">
            <Input
              placeholder={t("at_terminal.manage_name_placeholder")}
              aria-label={t("at_terminal.manage_name_aria")}
              value={newLabel}
              onChange={(e) => {
                setNewLabel(e.target.value);
                setAddError("");
              }}
              className="flex-1"
            />
            <Input
              placeholder={t("at_terminal.manage_command_placeholder")}
              aria-label={t("at_terminal.manage_command_aria")}
              value={newCommand}
              onChange={(e) => {
                setNewCommand(e.target.value);
                setAddError("");
              }}
              className="flex-1 font-mono"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
            <Button size="sm" onClick={handleAdd}>
              {t("at_terminal.manage_action_add")}
            </Button>
          </div>

          {addError && (
            <p className="text-xs text-destructive">{addError}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

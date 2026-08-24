"use client";

import { Switch } from "@/components/ui/switch";
import { Field, FieldLabel } from "@/components/ui/field";
import { TbInfoCircleFilled } from "react-icons/tb";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

interface StrongPasswordToggleProps {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function StrongPasswordToggle({
  id,
  checked,
  onCheckedChange,
  disabled,
}: StrongPasswordToggleProps) {
  return (
    <div className="border rounded-lg p-4 shadow-sm bg-background">
      <Field orientation="horizontal">
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="inline-flex" aria-label="More info" tabIndex={-1}>
              <TbInfoCircleFilled className="size-5 text-info" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Require uppercase, lowercase, and numeric characters.</p>
          </TooltipContent>
        </Tooltip>
        <FieldLabel htmlFor={id}>
          Use Strong Password
        </FieldLabel>
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
        />
      </Field>
    </div>
  );
}

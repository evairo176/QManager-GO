"use client";

import { useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2Icon,
  XCircleIcon,
  CopyIcon,
  ExternalLinkIcon,
} from "lucide-react";
import {
  IMEI_TAC_PRESETS,
  IMEI_CUSTOM_ID,
  getImeiTacPreset,
} from "@/constants/imei-presets";
import {
  generateImei,
  validateImei,
  parseImeiBreakdown,
} from "@/lib/imei-utils";

const IMEIToolsCard = () => {
  const { t } = useTranslation("cellular");
  const [selectedPresetId, setSelectedPresetId] = useState<string>(
    IMEI_TAC_PRESETS[0].id
  );
  const [customPrefix, setCustomPrefix] = useState("");
  const [imei, setImei] = useState("");

  const isCustom = selectedPresetId === IMEI_CUSTOM_ID;
  const activePrefix = isCustom
    ? customPrefix
    : (getImeiTacPreset(selectedPresetId)?.tac ?? "");
  const isValidPrefix = /^\d{8,12}$/.test(activePrefix);
  const showPrefixError = isCustom && customPrefix.length > 0 && !isValidPrefix;

  // Validation — derived, no state
  const is15Digits = /^\d{15}$/.test(imei);
  const isValid: boolean | null = is15Digits ? validateImei(imei) : null;
  const breakdown = is15Digits ? parseImeiBreakdown(imei) : null;

  const handlePresetChange = (value: string) => {
    setSelectedPresetId(value);
  };

  const handleCustomPrefixChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCustomPrefix(e.target.value.replace(/\D/g, "").slice(0, 12));
  };

  const handleGenerate = () => {
    if (!isValidPrefix) return;
    setImei(generateImei(activePrefix));
  };

  const handleImeiChange = (e: ChangeEvent<HTMLInputElement>) => {
    setImei(e.target.value.replace(/\D/g, "").slice(0, 15));
  };

  const handleCopy = () => {
    if (!imei) return;
    navigator.clipboard.writeText(imei).then(
      () => toast.success(t("core_settings.imei.tools_card.copy_success")),
      () => {
        const ta = document.createElement("textarea");
        ta.value = imei;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        toast.success(t("core_settings.imei.tools_card.copy_success"));
      },
    );
  };

  return (
    <Card className="@container/card @3xl/main:col-span-2">
      <CardHeader>
        <CardTitle>{t("core_settings.imei.tools_card.title")}</CardTitle>
        <CardDescription>
          {t("core_settings.imei.tools_card.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 content-start"
          onSubmit={(e) => {
            e.preventDefault();
            handleGenerate();
          }}
        >
          <div className="grid grid-cols-1 @xl/card:grid-cols-2 gap-6">
            <FieldSet>
              <FieldGroup>
                <Field>
                  <FieldLabel>{t("core_settings.imei.tools_card.preset_label")}</FieldLabel>
                  <Select
                    value={selectedPresetId}
                    onValueChange={handlePresetChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("core_settings.imei.tools_card.preset_placeholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {IMEI_TAC_PRESETS.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.label}
                        </SelectItem>
                      ))}
                      <SelectSeparator />
                      <SelectItem value={IMEI_CUSTOM_ID}>
                        {t("core_settings.imei.tools_card.preset_custom")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    {t("core_settings.imei.tools_card.preset_description")}
                  </FieldDescription>
                </Field>

                {isCustom && (
                  <Field>
                    <FieldLabel>{t("core_settings.imei.tools_card.custom_prefix_label")}</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        placeholder={t("core_settings.imei.tools_card.custom_prefix_placeholder")}
                        value={customPrefix}
                        onChange={handleCustomPrefixChange}
                        maxLength={12}
                        inputMode="numeric"
                        aria-invalid={showPrefixError}
                      />
                    </InputGroup>
                    {showPrefixError ? (
                      <FieldError>
                        {t("core_settings.imei.tools_card.custom_prefix_error", { count: customPrefix.length })}
                      </FieldError>
                    ) : (
                      <FieldDescription>
                        {t("core_settings.imei.tools_card.custom_prefix_description")}
                      </FieldDescription>
                    )}
                  </Field>
                )}
              </FieldGroup>
            </FieldSet>

            <FieldSet>
              <FieldGroup>
                <Field>
                  <FieldLabel>{t("core_settings.imei.tools_card.imei_label")}</FieldLabel>

                  <div className="flex items-center gap-2">
                    <InputGroup className="flex-1">
                      <InputGroupInput
                        placeholder={t("core_settings.imei.tools_card.imei_placeholder")}
                        value={imei}
                        onChange={handleImeiChange}
                        maxLength={15}
                        inputMode="numeric"
                        className="font-mono"
                      />
                      {imei.length > 0 && (
                        <InputGroupAddon align="inline-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <InputGroupButton
                                type="button"
                                size="icon-xs"
                                aria-label={t("core_settings.imei.tools_card.copy_aria")}
                                onClick={handleCopy}
                              >
                                <CopyIcon />
                              </InputGroupButton>
                            </TooltipTrigger>
                            <TooltipContent>
                              {t("core_settings.imei.tools_card.copy_tooltip")}
                            </TooltipContent>
                          </Tooltip>
                        </InputGroupAddon>
                      )}
                    </InputGroup>
                  </div>
                  <FieldDescription>
                    {t("core_settings.imei.tools_card.imei_description")}
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </FieldSet>
          </div>

          {breakdown && (
            <Field>
              <FieldLabel>{t("core_settings.imei.tools_card.breakdown_label")}</FieldLabel>
              <div className="grid grid-cols-4 gap-2 rounded-md border bg-muted/30 px-3 py-2 font-mono text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("core_settings.imei.tools_card.breakdown_validity")}
                  </p>
                  <p className="font-medium flex items-center gap-1">
                    {isValid ? (
                      <>
                        <CheckCircle2Icon className="size-4 text-green-500" />
                        {t("core_settings.imei.tools_card.breakdown_valid")}
                      </>
                    ) : (
                      <>
                        <XCircleIcon className="size-4 text-red-500" />
                        {t("core_settings.imei.tools_card.breakdown_invalid")}
                      </>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("core_settings.imei.tools_card.breakdown_tac")}
                  </p>
                  <p className="font-medium">{breakdown.tac}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("core_settings.imei.tools_card.breakdown_snr")}
                  </p>
                  <p className="font-medium">{breakdown.snr}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("core_settings.imei.tools_card.breakdown_check")}
                  </p>
                  <p className="font-medium">{breakdown.checkDigit}</p>
                </div>
              </div>
            </Field>
          )}

          <div className="flex items-center gap-x-4">
            <Button type="submit" disabled={!isValidPrefix}>
              {t("core_settings.imei.tools_card.generate_button")}
            </Button>

            <Button
              type="button"
              disabled={!is15Digits}
              onClick={() =>
                window.open(
                  `https://www.imei.info/?imei=${imei}`,
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              <ExternalLinkIcon className="size-4" />
              {t("core_settings.imei.tools_card.check_info_button")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default IMEIToolsCard;

"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TbInfoCircleFilled } from "react-icons/tb";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { CircleIcon } from "lucide-react";

import type {
  TowerLockConfig,
  TowerScheduleConfig,
} from "@/types/tower-locking";

interface ScheduleTowerLockingProps {
  config: TowerLockConfig | null;
  onScheduleChange: (schedule: TowerScheduleConfig) => Promise<boolean>;
}

const ScheduleTowerLockingComponent = ({
  config,
  onScheduleChange,
}: ScheduleTowerLockingProps) => {
  const { t } = useTranslation("cellular");

  // Local form state
  const [enabled, setEnabled] = useState(false);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("22:00");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);

  // Debounce timer ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleConfig = config?.schedule;

  // Sync from config (adjust state during render)
  const [prevSchedule, setPrevSchedule] = useState<TowerScheduleConfig | null>(null);
  if (scheduleConfig && scheduleConfig !== prevSchedule) {
    setPrevSchedule(scheduleConfig);
    setEnabled(scheduleConfig.enabled);
    setStartTime(scheduleConfig.start_time);
    setEndTime(scheduleConfig.end_time);
    setDays(scheduleConfig.days);
  }

  // Translated day labels — rebuilt when language changes
  const dayLabels = useMemo(() => [
    t("cell_locking.tower_locking.schedule.day_labels.sun"),
    t("cell_locking.tower_locking.schedule.day_labels.mon"),
    t("cell_locking.tower_locking.schedule.day_labels.tue"),
    t("cell_locking.tower_locking.schedule.day_labels.wed"),
    t("cell_locking.tower_locking.schedule.day_labels.thu"),
    t("cell_locking.tower_locking.schedule.day_labels.fri"),
    t("cell_locking.tower_locking.schedule.day_labels.sat"),
  ], [t]);

  // Debounced save — fires 800ms after last change
  const debouncedSave = useCallback(
    (schedule: TowerScheduleConfig) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        onScheduleChange(schedule);
      }, 800);
    },
    [onScheduleChange],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  // Toggle enable/disable — save immediately (not debounced)
  // Reverts local state if the backend rejects (e.g., no lock targets configured)
  const handleEnabledChange = async (checked: boolean) => {
    setEnabled(checked);
    // Cancel any pending debounced save
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const success = await onScheduleChange({
      enabled: checked,
      start_time: startTime,
      end_time: endTime,
      days,
    });
    if (!success) {
      // Backend rejected — revert toggle
      setEnabled(!checked);
      toast.warning(t("cell_locking.tower_locking.schedule.toast_no_targets"));
    }
  };

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    if (enabled) {
      debouncedSave({
        enabled,
        start_time: value,
        end_time: endTime,
        days,
      });
    }
  };

  const handleEndTimeChange = (value: string) => {
    setEndTime(value);
    if (enabled) {
      debouncedSave({
        enabled,
        start_time: startTime,
        end_time: value,
        days,
      });
    }
  };

  const handleDayToggle = (dayIndex: number) => {
    const newDays = days.includes(dayIndex)
      ? days.filter((d) => d !== dayIndex)
      : [...days, dayIndex].sort();

    setDays(newDays);
    if (enabled) {
      debouncedSave({
        enabled,
        start_time: startTime,
        end_time: endTime,
        days: newDays,
      });
    }
  };

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>{t("cell_locking.tower_locking.schedule.title")}</CardTitle>
        <CardDescription>
          {t("cell_locking.tower_locking.schedule.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2">
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="inline-flex" aria-label={t("cell_locking.tower_locking.schedule.enable_info_aria")}>
                    <TbInfoCircleFilled className="size-5 text-info" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {t("cell_locking.tower_locking.schedule.enable_tooltip")}
                  </p>
                </TooltipContent>
              </Tooltip>
              <p className="font-semibold text-muted-foreground text-sm">
                {t("cell_locking.tower_locking.schedule.enable_label")}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="schedule-locking"
                checked={enabled}
                onCheckedChange={handleEnabledChange}
              />
              <Label htmlFor="schedule-locking">
                {enabled ? t("state.enabled", { ns: "common" }) : t("state.disabled", { ns: "common" })}
              </Label>
            </div>
          </div>
          <Separator />
          <div className="flex flex-col gap-4 mt-4">
            <div className="flex items-center justify-between">
              <Label className="font-semibold text-muted-foreground text-sm">
                {t("cell_locking.tower_locking.schedule.start_time_label")}
              </Label>
              <Input
                type="time"
                className="w-32 h-8"
                value={startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="font-semibold text-muted-foreground text-sm">
                {t("cell_locking.tower_locking.schedule.end_time_label")}
              </Label>
              <Input
                type="time"
                className="w-32 h-8"
                value={endTime}
                onChange={(e) => handleEndTimeChange(e.target.value)}
              />
            </div>
          </div>
          <Separator />
          <fieldset className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
            <legend className="font-semibold text-muted-foreground text-sm">
              {t("cell_locking.tower_locking.schedule.repeat_on_label")}
            </legend>
            <div className="flex flex-wrap gap-2 mt-2" role="group" aria-label={t("cell_locking.tower_locking.schedule.repeat_on_aria")}>
              {dayLabels.map((day, index) => (
                <Toggle
                  aria-label={day}
                  key={day}
                  size="sm"
                  className="data-[state=on]:bg-transparent data-[state=on]:*:[svg]:fill-blue-500 data-[state=on]:*:[svg]:stroke-blue-500"
                  variant="outline"
                  pressed={days.includes(index)}
                  onPressedChange={() => handleDayToggle(index)}
                >
                  <CircleIcon />
                  {day}
                </Toggle>
              ))}
            </div>
          </fieldset>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScheduleTowerLockingComponent;

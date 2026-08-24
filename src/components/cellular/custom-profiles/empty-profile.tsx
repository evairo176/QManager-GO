import React from "react";
import { useTranslation } from "react-i18next";

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { UserRoundPenIcon } from "lucide-react";

const EmptyProfileComponent = () => {
  const { t } = useTranslation("cellular");
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <UserRoundPenIcon />
        </EmptyMedia>
        <EmptyTitle>{t("custom_profiles.empty_state.title")}</EmptyTitle>
        <EmptyDescription>
          {t("custom_profiles.empty_state.description_full")}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
};

export default EmptyProfileComponent;

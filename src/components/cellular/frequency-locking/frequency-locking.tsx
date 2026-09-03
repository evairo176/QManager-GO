"use client";

import { useTranslation } from "react-i18next";
import { Radio } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import LteFreqLockingComponent from "./lte-freq-locking";
import NrFreqLockingComponent from "./nr-freq-locking";
import { useFrequencyLocking } from "@/hooks/use-frequency-locking";
import { useModemStatus } from "@/hooks/use-modem-status";

const FrequencyLockingComponent = () => {
  const { t } = useTranslation("cellular");
  const freqLock = useFrequencyLocking();
  const { data: modemData } = useModemStatus();

  return (
    <div className="@container/main mx-auto flex flex-col gap-6">
      <PageHeader
      icon={Radio}
      title={t("cell_locking.frequency_locking.page.title")}
      description={t("cell_locking.frequency_locking.page.description")}
    />
      <div className="grid grid-cols-1 @3xl/main:grid-cols-2 grid-flow-row gap-4">
        <LteFreqLockingComponent
          modemState={freqLock.modemState}
          modemData={modemData}
          isLoading={freqLock.isLoading}
          isLocking={freqLock.isLteLocking}
          error={freqLock.error}
          towerLockActive={freqLock.towerLockLteActive}
          onLock={(earfcns) => freqLock.lockLte(earfcns)}
          onUnlock={() => freqLock.unlockLte()}
          onRefresh={freqLock.refresh}
        />
        <NrFreqLockingComponent
          modemState={freqLock.modemState}
          modemData={modemData}
          isLoading={freqLock.isLoading}
          isLocking={freqLock.isNrLocking}
          error={freqLock.error}
          towerLockActive={freqLock.towerLockNrActive}
          onLock={(entries) => freqLock.lockNr(entries)}
          onUnlock={() => freqLock.unlockNr()}
          onRefresh={freqLock.refresh}
        />
      </div>
    </div>
  );
};

export default FrequencyLockingComponent;

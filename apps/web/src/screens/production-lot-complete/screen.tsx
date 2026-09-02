import { AlertBanner, Button, Card, Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useCallback, useId, useState } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';
import { CompletePane } from './complete-pane';
import { toCompleteRequest } from './complete-request';
import { judgeCompletion } from './completion-judgment';
import { useLotCompleteEntry } from './entry-context';
import { ErrorBanner } from './error-banner';
import { LotListPane } from './lot-list-pane';
import { useLotComplete } from './mutations';
import { useLotDetail, useTargetLots, useVarianceReasons } from './queries';
import { useTerminalGate } from './terminal-gating';

const t = messages.productionLotComplete;

/** 방금 무엇을 했는가. 완료와 미달 마감은 결과 문구가 달라야 한다(R71). */
type Outcome = 'completed' | 'closedUnder';

/**
 * P-02-06 생산LOT 완료 처리.
 *
 * ⭐ **두 결말이 한 오퍼레이션이다** — 「완료 처리」와 「미달 마감」은 같은 경로를 부르고 **미달
 * 사유를 싣느냐로만** 갈린다. 그래서 버튼을 나누는 일이 화면의 몫이 된다(스펙 §3 · R71): 같은
 * 버튼이면 사용자가 미달을 인지하지 못한 채 누른다.
 *
 * ⛔ **완료를 되돌리는 경로가 없다**(§8-5 · `omf-mes#87`). 그래서 모르는 상태에서는 열지 않는다 —
 * 게이팅 조회 중·진척 미수신·사번 미확인이 전부 「닫힘」이다.
 *
 * ⛔ **라벨을 여기서 찍지 않는다**(§5-5 · K-4). LOT 라벨 출력은 `P-02-07` 이고, 인쇄를 완료에
 * 묶으면 인쇄 실패가 완료를 되돌리지 못한 채 남는다.
 */
export const ProductionLotCompleteScreen = () => {
  const titleId = useId();
  const entry = useLotCompleteEntry();
  const identity = usePopIdentity();
  const gate = useTerminalGate(identity.terminalId, identity.processId);

  const [selectedLotId, setSelectedLotId] = useState<number | null>(null);
  const [reasonCode, setReasonCode] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const lots = useTargetLots(entry.workOrderId);
  const detail = useLotDetail(selectedLotId);
  const reasons = useVarianceReasons();

  const workerNo = entry.workerNo;

  const judgment = judgeCompletion({
    gateAllowed: gate.verdict === 'allowed',
    hasWorkerNo: workerNo !== null,
    progress: detail.data?.progress ?? null,
    alreadyCompleted: (detail.data?.lot.completedAt ?? null) !== null,
    reasonCode,
    lotSelected: selectedLotId !== null,
  });

  const complete = useLotComplete({
    lotId: selectedLotId,
    workerNo: workerNo ?? '',
    onSuccess: () => {
      /*
       * 완료한 LOT 은 목록(`completed=false`)에서 빠진다 — 고른 상태로 두면 사라진 행을
       * 가리킨 채 오른쪽만 남는다. 선택을 풀고 결과만 남긴다.
       */
      setSelectedLotId(null);
      setReasonCode(null);
    },
  });

  const submit = (under: boolean): void => {
    if (selectedLotId === null || workerNo === null) return;

    const body = toCompleteRequest({ under, reasonCode, at: new Date() });

    if (body === null) return;

    setOutcome(under ? 'closedUnder' : 'completed');
    complete.write(body);
  };

  const selectLot = useCallback((lotId: number): void => {
    setSelectedLotId(lotId);
    setReasonCode(null);
    setOutcome(null);
  }, []);

  const reload = (): void => {
    void lots.refetch();
    void detail.refetch();
    complete.reset();
  };

  const gateText = gate.verdict === 'allowed' ? null : t.gate[gate.verdict];
  const succeeded = outcome !== null && complete.error === null && !complete.isSaving;

  return (
    <main className="pop-shell" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        <div className="pop-context-right">
          <Chip status={identity.terminalId === null ? 'warning' : 'info'}>
            {`${t.device.terminalLabel} ${identity.terminalId === null ? t.device.terminalUnknown : String(identity.terminalId)}`}
          </Chip>
        </div>
      </header>

      {/*
        게이팅이 막았으면 **화면 머리에 세운다.** 버튼 옆에만 두면 LOT 을 고르기 전에는 보이지
        않아, 작업자가 목록을 다 훑고 나서야 이 단말에서는 안 된다는 것을 안다.
      */}
      {gateText !== null && (
        <div className="banner-slot">
          <AlertBanner
            variant={gate.verdict === 'denied' ? 'warning' : 'error'}
            title={t.title}
            action={
              /* ⛔ 「확인할 수 없다」에만 다시 시도를 준다 — 「권한이 없다」는 눌러도 달라지지 않는다(G-3). */
              gate.verdict === 'unavailable' ? (
                <Button variant="outlined" size="sm" onClick={gate.retry}>
                  {t.gate.retry}
                </Button>
              ) : undefined
            }
          >
            {gateText}
          </AlertBanner>
        </div>
      )}

      {entry.workOrderId === null && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.title}>
            {t.entry.missingWorkOrder}
          </AlertBanner>
        </div>
      )}

      {lots.isError && (
        <div className="banner-slot">
          <AlertBanner variant="error" title={t.lotList.loadFailed}>
            {messages.httpError.description}
          </AlertBanner>
        </div>
      )}

      {complete.error !== null && (
        <ErrorBanner
          error={complete.error}
          title={t.error.completeTitle}
          onRetry={() => {
            submit(outcome === 'closedUnder');
          }}
          onReload={reload}
        />
      )}

      {succeeded && (
        <div className="banner-slot">
          <AlertBanner
            variant="success"
            title={outcome === 'completed' ? t.result.completed : t.result.closedUnder}
          >
            {t.result.nextStep}
          </AlertBanner>
        </div>
      )}

      <div className="pop-panes">
        <Card bordered className="pop-section" aria-label={t.lotList.sectionLabel}>
          <h2 className="pane-title">{t.lotList.sectionLabel}</h2>
          <LotListPane lots={lots.data ?? []} selectedLotId={selectedLotId} onSelect={selectLot} />
        </Card>

        <Card bordered className="pop-section" aria-label={t.detail.sectionLabel}>
          <h2 className="pane-title">{t.detail.sectionLabel}</h2>
          {detail.isError ? (
            <p className="field-error">{t.detail.loadFailed}</p>
          ) : (
            <CompletePane
              lot={detail.data?.lot ?? null}
              progress={detail.data?.progress ?? null}
              judgment={judgment}
              reasons={reasons.data ?? []}
              reasonCode={reasonCode}
              onReasonChange={setReasonCode}
              reasonsFailed={reasons.isError}
              serverReasonError={complete.fieldErrors.completionVarianceReasonCode ?? null}
              gateText={gateText}
              isSubmitting={complete.isSaving}
              onComplete={() => {
                submit(false);
              }}
              onCloseUnder={() => {
                submit(true);
              }}
            />
          )}
        </Card>
      </div>
    </main>
  );
};

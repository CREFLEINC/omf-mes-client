import type { ApiError, components } from '@omf-mes/api-client';
import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useRef, useState } from 'react';

import { PopSelect as Select } from '../../patterns/pop-select';

import { useApiClient } from '../../patterns/api-context';
import { usePopIdentity } from '../../patterns/pop-identity';
import {
  popGateDeniedText,
  popGateProcessId,
  popGateUnidentifiedText,
  usePopProcessGate,
} from '../../patterns/pop-process-gate';
import {
  PuActionBar,
  PuBand,
  PuButton,
  PuChip,
  PuCols,
  PuEmpty,
  PuField,
  PuFlow,
  PuHelpButton,
  PuIcon,
  PuInput,
  PuKeypad,
  PuNote,
  PuPager,
  PuScreen,
  PuSection,
  PuUnit,
  applyKeypadKey,
  puToast,
  useFitCount,
} from '../../patterns/pop-uniform';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { toApiError } from '../../patterns/request';
import { serverReasonOf } from '../../patterns/server-reason';
import { drainReworkResults, enqueueReworkResult, pendingReworkResultCount } from './outbox';
import {
  useDispositionDecisions,
  useReworkDefectCodes,
  useReworkSource,
  useReworkSourceLot,
  useReworkWorkOrders,
} from './queries';
import {
  EMPTY_QUANTITIES,
  quantityTotal,
  quantityVerdict,
  readQuantity,
  reworkDispositionProgress,
  decidedOnText,
  toProductionResult,
  toTypedQuantity,
  type QuantityDrafts,
  type QuantityKey,
} from './result';
import { useUomLookup } from './uom-lookup';
import { PopTopStatus } from '../../patterns/pop-top-status';
import './uniform.css';

type WorkOrder = components['schemas']['WorkOrder'];

const quantityKeys: QuantityKey[] = ['goodQty', 'defectQty', 'holdQty', 'scrapQty'];

/** 구획 안 두 단계(#295): ① 실적 입력(양품·보류·폐기) › ② 불량 등록(불량 수량·불량 코드). */
type Step = 'input' | 'defect';

const STEP_KEYS: Record<Step, QuantityKey[]> = {
  input: ['goodQty', 'holdQty', 'scrapQty'],
  defect: ['defectQty'],
};

export const ReworkResultRegisterScreen = () => {
  const t = messages.reworkResultRegister;
  /* 수량 칸 id 앞붙이. */
  const titleId = useId();
  const { client } = useApiClient();
  const identity = usePopIdentity();
  const [listPage, setListPage] = useState(1);
  const [folded, setFolded] = useState(false);
  /* 목록 구획 높이에 들어가는 건수(#295 · 구획 안 스크롤 없음) — 배포된 쪽의 요청 크기가 된다. */
  const listRef = useRef<HTMLDivElement>(null);
  const pageSize = useFitCount(listRef, { fallback: 4 });
  const { open: releasedOrders, planned: plannedOrders } = useReworkWorkOrders(listPage, pageSize);
  /*
   * 배포된 것 뒤에 **배포 전**을 잇는다 — 고를 수 있는 것이 위에 선다. 배포 전 줄은 표식만
   * 달고 고르지 못한다(서버가 그 상태의 실적을 받지 않는다 · omf-all-around#47).
   *
   * ⭐ 배포 전 줄은 배포된 줄이 끝난 «다음 자리»부터 잇는다(#295). 쪽 크기가 구획 높이로 정해져
   *    한 쪽에 더 얹으면 넘친다 — 배포된 줄이 다 찬 쪽 뒤로 이어 쪽을 나눈다.
   */
  const releasedItems = releasedOrders.data?.items ?? [];
  const releasedTotal = releasedOrders.data?.page.total ?? 0;
  const plannedAll = plannedOrders.data?.items ?? [];
  const plannedStart = Math.max(0, (listPage - 1) * pageSize - releasedTotal);
  const plannedRows =
    releasedOrders.isSuccess && listPage * pageSize > releasedTotal
      ? plannedAll.slice(plannedStart, plannedStart + Math.max(0, pageSize - releasedItems.length))
      : [];
  const plannedIds = new Set(plannedRows.map((row) => row.workOrderId));
  const rows = [...releasedItems, ...plannedRows];
  const listTotal = releasedTotal + plannedAll.length;
  const listPages = Math.max(1, Math.ceil(listTotal / Math.max(1, pageSize)));
  const defectCodeId = useId();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [step, setStep] = useState<Step>('input');
  /**
   * 지금 치고 있는 칸 — 오른쪽 키패드의 대상. 단계를 바꾸면 그 단계의 첫 칸이 된다(#295).
   */
  const [activeKey, setActiveKey] = useState<QuantityKey>('goodQty');
  const [drafts, setDrafts] = useState<QuantityDrafts>(EMPTY_QUANTITIES);
  /* 고른 불량 코드(`defectCodeId` 문자열). 비어 있으면 `null`. */
  const [defectCode, setDefectCode] = useState<string | null>(null);
  const defectCodes = useReworkDefectCodes();
  const [queued, setQueued] = useState(false);
  const [queueError, setQueueError] = useState(false);
  /** 서버가 거부한 까닭. 거부가 없으면 null */
  const [rejection, setRejection] = useState<ApiError | null>(null);
  const [pendingCount, setPendingCount] = useState(pendingReworkResultCount);
  const [isOnline, setIsOnline] = useState(() => globalThis.navigator.onLine);

  const selected = rows.find((row) => row.workOrderId === selectedId) ?? null;
  const nonconformanceId = selected?.reworkSourceNonconformanceId ?? null;
  const source = useReworkSource(nonconformanceId);
  const dispositions = useDispositionDecisions(nonconformanceId);
  const sourceLot = useReworkSourceLot(selected?.reworkSourceLotId ?? null);
  /*
   * 고른 W/O 의 공정으로 「실적 입력」을 판정한다 — 단말에 공정이 여럿이어도 그 W/O 가 어느 공정의
   * 일인지 안다. 고르기 전에는 판정할 공정이 없으므로 막지도 말하지도 않는다.
   */
  const selectedWorkOrder: WorkOrder | null = selected;
  const gate = usePopProcessGate({
    terminalId: identity.terminalId,
    processId: popGateProcessId(selectedWorkOrder?.processId, identity.processes),
    workOrder: { processName: selectedWorkOrder?.processName ?? null },
    flag: 'canInputResult',
  });
  const uom = useUomLookup();
  const progress = reworkDispositionProgress(dispositions.data?.items ?? []);
  /* 이 화면이 보이는 처분은 «재작업» 한 건이다 — 다른 유형은 이 W/O 의 근거가 아니다. */
  const reworkDecision =
    dispositions.data?.items.find((item) => item.dispositionTypeCode === 'REWORK') ?? null;
  const total = quantityTotal(drafts);
  const verdict = quantityVerdict(total, progress.remaining);
  const remaining = Math.max(0, progress.remaining - total);
  const uomLabel = selected === null ? '' : (uom.labelOf(selected.uomId) ?? '');
  const allowsDecimal = selected !== null && uom.decimalScaleOf(selected.uomId) > 0;
  useEffect(() => {
    setDrafts(EMPTY_QUANTITIES);
    /* 다른 작업지시로 옮기면 고른 불량 코드도 버린다(리뷰) — 앞 W/O 의 코드로 필수 검사를 넘지 않게. */
    setDefectCode(null);
    setQueued(false);
    setQueueError(false);
    setRejection(null);
    setStep('input');
    setActiveKey('goodQty');
  }, [selectedId]);
  useEffect(() => {
    const drain = () => {
      setIsOnline(true);
      void drainReworkResults(client)
        .then((result) => {
          setPendingCount(pendingReworkResultCount());
          setRejection(result.lastRejection);
          if (result.rejected > 0) setQueued(false);
        })
        .catch(() => setPendingCount(pendingReworkResultCount()));
    };
    const offline = () => setIsOnline(false);
    if (globalThis.navigator.onLine) drain();
    globalThis.addEventListener('online', drain);
    globalThis.addEventListener('offline', offline);
    return () => {
      globalThis.removeEventListener('online', drain);
      globalThis.removeEventListener('offline', offline);
    };
  }, [client]);
  const gateReason = ((): string | null => {
    if (selected === null) return null;
    switch (gate.verdict) {
      case 'unidentified':
        return popGateUnidentifiedText(t.gateUnidentified, null);
      case 'checking':
        return t.gateChecking;
      case 'unavailable':
        return t.gateUnavailable;
      case 'denied':
        return popGateDeniedText(gate, 'canInputResult');
      case 'allowed':
        return null;
    }
  })();
  /*
   * ⚠ **고를 목록이 없으면 필수로 막지 않는다**(리뷰 M1). 조회 실패·0건에 막으면 저장이 영영
   *    열리지 않는다 — 고른 코드는 아직 서버로 가지도 않는다. 칸 아래가 그 사정을 말하고 다시 부른다.
   */
  const defectCodeOptions = defectCodes.data?.items ?? [];
  const defectCodesUnavailable =
    defectCodes.isError || (defectCodes.isSuccess && defectCodeOptions.length === 0);
  const defectCodeRequired = readQuantity(drafts.defectQty) > 0 && !defectCodesUnavailable;
  const defectCodeMissing = defectCodeRequired && defectCode === null;
  const canSave =
    selected !== null &&
    source.isSuccess &&
    dispositions.isSuccess &&
    progress.remaining > 0 &&
    (verdict === 'partial' || verdict === 'complete') &&
    /* ⭐ 불량이 있으면 불량 코드가 필수다(스펙 §5-3 · 사용자 지시 2026-09-17). */
    !defectCodeMissing &&
    gateReason === null &&
    /* 사번이 없어 막힌 사유는 화면 맨 위 공용 띠가 말한다(사용자 지시 2026-09-17). */
    identity.workerNo !== null &&
    !queued;
  const save = () => {
    if (!canSave || selected === null || identity.workerNo === null) return;
    try {
      enqueueReworkResult(identity.workerNo, toProductionResult(selected, drafts, new Date()));
    } catch {
      setQueueError(true);
      return;
    }
    setQueueError(false);
    setPendingCount(pendingReworkResultCount());
    setQueued(true);
    /* 결과는 아래 가운데 알림으로(규칙 13 · #295). 저장 뒤 다시 누르지 못하게 `queued` 가 막는다. */
    puToast(t.queued);
    if (globalThis.navigator.onLine) {
      void drainReworkResults(client)
        .then((result) => {
          setPendingCount(pendingReworkResultCount());
          setRejection(result.lastRejection);
          if (result.rejected > 0) setQueued(false);
        })
        .catch(() => setPendingCount(pendingReworkResultCount()));
    }
  };
  /**
   * 「입력 초기화」가 열리는 조건 — **되돌릴 것이 있을 때만**.
   *
   * ⭐ **지우는 것과 짝을 맞춘다.** `reset` 은 수량뿐 아니라 저장 결과·오류 표시도 함께
   * 걷으므로, 저장 직후처럼 수량이 비고 진술만 남은 자리에서도 열려 있어야 한다.
   */
  const hasSomethingToReset =
    selected !== null &&
    (quantityKeys.some((key) => drafts[key] !== '') || queued || queueError || rejection !== null);

  const goStep = (next: Step) => {
    setStep(next);
    setActiveKey(STEP_KEYS[next][0] ?? 'goodQty');
  };

  const reset = () => {
    setDrafts(EMPTY_QUANTITIES);
    setDefectCode(null);
    setQueued(false);
    setQueueError(false);
    setRejection(null);
    goStep('input');
  };

  const setDraft = (key: QuantityKey, value: string) => {
    setDrafts((current) => ({ ...current, [key]: value }));
  };

  const defectQtyNumber = readQuantity(drafts.defectQty);

  /* ── 왼쪽: 재작업 작업지시 목록 ── */
  const listSection = (
    <PuSection
      title={t.workOrders}
      fold={{ label: t.workOrders, folded, onChange: setFolded }}
      split
    >
      <div ref={listRef} className="pu-list pu-fit rwu-list">
        {(releasedOrders.isError || plannedOrders.isError) && (
          <PuNote tone="bad">
            <b>{t.loadError}</b>{' '}
            <span>{serverReasonOf(toApiError(releasedOrders.error ?? plannedOrders.error))}</span>
          </PuNote>
        )}
        {releasedOrders.isSuccess && plannedOrders.isSuccess && listTotal === 0 && (
          <PuEmpty icon="list" title={t.empty} />
        )}
        {rows.map((row) => {
          const qty = t.qtyWithUom(String(row.orderQty), uom.labelOf(row.uomId) ?? '');

          if (plannedIds.has(row.workOrderId)) {
            /* 배포 전 — 고를 수 없다. 왜 못 고르는지 그 자리에서 말한다. */
            return (
              <div key={`p-${String(row.workOrderId)}`} className="pu-item rwu-item is-dim">
                <div className="pu-item-top">
                  <span className="no">{row.workOrderNo}</span>
                  <span className="chips">
                    <PuChip>{t.list.plannedChip}</PuChip>
                  </span>
                </div>
                <div className="pu-item-sub rwu-sub">
                  <span>{t.list.item}</span>
                  <b>{row.itemCode ?? `#${String(row.itemId)}`}</b>
                  <span>{t.list.qty}</span>
                  <b>{qty}</b>
                  <span>{t.list.status}</span>
                  <span className="w">{t.notReleased}</span>
                </div>
              </div>
            );
          }

          const isSelected = row.workOrderId === selectedId;
          /* 고른 작업지시는 지금 넣는 수량까지 더해 진행 막대가 따라 움직인다. */
          const current = Math.min(total, progress.remaining);
          const over = verdict === 'exceeded';
          const done = progress.completed + current;
          const pct = Math.min(100, (done / Math.max(progress.target, 1)) * 100);

          return (
            <button
              key={row.workOrderId}
              type="button"
              className={`pu-item rwu-item${isSelected ? ' is-selected' : ''}`}
              aria-pressed={isSelected}
              onClick={() => setSelectedId(row.workOrderId)}
            >
              <div className="pu-item-top">
                <span className="no">{row.workOrderNo}</span>
                <span className="chips">
                  <PuChip tone="info">{t.list.reworkChip}</PuChip>
                </span>
              </div>
              <div className="pu-item-sub rwu-sub">
                <span>{t.list.item}</span>
                <b>{row.itemCode ?? `#${String(row.itemId)}`}</b>
                {isSelected && reworkDecision !== null ? (
                  <>
                    <span>{t.list.disposition}</span>
                    <b>
                      {t.qtyWithUom(
                        String(reworkDecision.decisionQty),
                        uom.labelOf(reworkDecision.uomId) ?? '',
                      )}
                    </b>
                  </>
                ) : (
                  <>
                    <span>{t.list.qty}</span>
                    <b>{qty}</b>
                  </>
                )}
                {isSelected && sourceLot.data !== undefined && (
                  <>
                    <span>{t.list.sourceLot}</span>
                    <b className="w">{sourceLot.data.lot.lotNo}</b>
                  </>
                )}
                {isSelected && source.data !== undefined && (
                  <>
                    <span>{t.list.nonconformance}</span>
                    <b className="w">{source.data.description}</b>
                  </>
                )}
                {isSelected && dispositions.isSuccess && (
                  <>
                    <span>{t.list.progress}</span>
                    <span className="w rwu-prog">
                      <b>{t.progressValue(String(done), String(progress.target), uomLabel)}</b>
                      <span className="pu-progress">
                        <i className={over ? 'is-over' : undefined} style={{ width: `${pct}%` }} />
                      </span>
                    </span>
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <PuPager
        total={listTotal}
        page={listPage}
        pages={listPages}
        label={t.pageNav}
        onPage={(page) => {
          /* 쪽을 넘기면 고른 것을 놓는다 — 다른 쪽의 지시가 상세에 남지 않게 한다. */
          setSelectedId(null);
          setListPage(page);
        }}
      />
    </PuSection>
  );

  /* ── 가운데: 단계 줄 · 정보 띠 · 안내 · 수량 칸 ── */
  const verdictNote =
    selected === null || !dispositions.isSuccess
      ? null
      : verdict === 'empty'
        ? { tone: 'bad' as const, text: t.emptyQuantity }
        : verdict === 'exceeded'
          ? { tone: 'bad' as const, text: t.exceeded(progress.remaining, uomLabel) }
          : verdict === 'partial'
            ? { tone: 'warn' as const, text: t.partial(remaining, uomLabel) }
            : null;

  const quantityField = (key: QuantityKey) => {
    const inputId = `${titleId}-${key}`;

    return (
      <PuField key={key} label={t.quantities[key]} htmlFor={inputId}>
        <div className="pu-row">
          <PuInput
            id={inputId}
            numeric
            placeholder="0"
            value={drafts[key]}
            target={activeKey === key}
            inputMode="decimal"
            autoComplete="off"
            /* 칸을 누르면 오른쪽 키패드의 대상이 이 칸이 된다. */
            onFocus={() => setActiveKey(key)}
            onClick={() => setActiveKey(key)}
            /*
             * ⭐ **키보드로도 친다**(사용자 지시 2026-09-17). 친 값은 키패드와 같은 규칙으로 거른다 —
             *    숫자만, 소수점은 단위가 허락할 때 하나만.
             */
            onChange={(event) => setDraft(key, toTypedQuantity(event.target.value, allowsDecimal))}
          />
          {uomLabel !== '' && <PuUnit>{uomLabel}</PuUnit>}
        </div>
      </PuField>
    );
  };

  const centerSection =
    selected === null ? (
      <PuSection title={t.steps.input}>
        <PuEmpty icon="list" title={t.pickTitle} hint={t.pickHint} />
      </PuSection>
    ) : (
      <PuSection
        title={step === 'defect' ? t.steps.defect : t.steps.input}
        meta={
          <>
            <PuChip tone={verdict === 'exceeded' ? 'bad' : verdict === 'complete' ? 'ok' : 'info'}>
              {`${t.total} ${String(total)} / ${String(progress.remaining)}`}
            </PuChip>
            <PuHelpButton title={t.helpTitle}>
              <p className="pu-dialog-text">{t.reworkHint}</p>
              <p className="pu-dialog-text">{t.lotHint}</p>
            </PuHelpButton>
          </>
        }
      >
        <PuFlow
          label={t.steps.label}
          current={step === 'defect' ? 1 : 0}
          steps={[
            {
              label: t.steps.input,
              done: step === 'defect',
              onGo: step === 'defect' ? () => goStep('input') : undefined,
            },
            { label: t.steps.defect },
          ]}
        />
        <PuBand
          grid={3}
          label={t.workOrders}
          items={[
            {
              wide: true,
              label: (
                <>
                  <PuIcon name="list" />
                  {t.sourceLot}
                </>
              ),
              /* ⚠ 계약이 LOT 을 `lot` 아래에 감싸 준다 — 겉 응답이 곧 LOT 이 아니다. */
              value:
                sourceLot.data === undefined
                  ? t.unknown
                  : t.sourceLotValue(
                      sourceLot.data.lot.lotNo,
                      String(sourceLot.data.lot.initialQty),
                      uom.labelOf(sourceLot.data.lot.uomId) ?? '',
                    ),
            },
            {
              wide: true,
              label: (
                <>
                  <PuIcon name="check" />
                  {t.disposition}
                </>
              ),
              value:
                reworkDecision === null
                  ? t.unknown
                  : t.dispositionValue(
                      String(reworkDecision.decisionQty),
                      uom.labelOf(reworkDecision.uomId) ?? '',
                      decidedOnText(reworkDecision.decidedAt),
                    ),
            },
            {
              wide: true,
              label: (
                <>
                  <PuIcon name="warn" />
                  {t.nonconformance}
                </>
              ),
              value:
                source.data === undefined
                  ? t.unknown
                  : t.nonconformanceValue(source.data.nonconformanceNo, source.data.description),
            },
          ]}
        />
        {(source.isError || dispositions.isError) && (
          <PuNote tone="bad">
            <b>{t.loadError}</b>{' '}
            <span>{serverReasonOf(toApiError(source.error ?? dispositions.error))}</span>
          </PuNote>
        )}
        {verdictNote !== null && <PuNote tone={verdictNote.tone}>{verdictNote.text}</PuNote>}
        {gateReason !== null && <PuNote tone="warn">{gateReason}</PuNote>}
        {queueError && <PuNote tone="bad">{t.queueError}</PuNote>}
        {rejection !== null && (
          <PuNote tone="bad">
            <b>{t.rejected}</b> <span>{serverReasonOf(rejection) ?? t.rejectedHint}</span>
          </PuNote>
        )}
        <div className="pu-grid2">{STEP_KEYS[step].map(quantityField)}</div>
        {step === 'defect' && (
          <PuField label={t.defectCode} htmlFor={defectCodeId} required={defectCodeRequired}>
            <Select
              id={defectCodeId}
              options={defectCodeOptions.map((code) => ({
                value: String(code.defectCodeId),
                label: `${code.defectCode} ${code.defectName}`,
              }))}
              value={defectCode}
              onChange={setDefectCode}
              invalid={defectCodeMissing}
              placeholder={
                defectCodes.isSuccess && defectCodeOptions.length === 0
                  ? t.defectCodeEmpty
                  : t.defectCodePlaceholder
              }
              disabled={defectCodeOptions.length === 0}
            />
            {defectCodes.isError && (
              <PuNote
                tone="warn"
                action={
                  <PuButton size="sm" onClick={() => void defectCodes.refetch()}>
                    {t.defectCodeRetry}
                  </PuButton>
                }
              >
                {t.defectCodeLoadFailed}
              </PuNote>
            )}
          </PuField>
        )}
      </PuSection>
    );

  /* ── 오른쪽: 수량 키패드(생산 작업과 같은 「수량」 구획) ── */
  const keypadSection = (
    <PuSection
      title={t.keypad.title}
      meta={uomLabel === '' ? undefined : t.keypad.unit(uomLabel)}
      disabled={selected === null}
    >
      <PuKeypad
        targetLabel={selected === null ? null : t.quantities[activeKey]}
        decimal={allowsDecimal}
        disabled={selected === null}
        onKey={(key) => {
          setDrafts((current) => ({
            ...current,
            [activeKey]: applyKeypadKey(current[activeKey], key, { decimal: allowsDecimal }),
          }));
        }}
        onClearAll={() => setDraft(activeKey, '')}
      />
    </PuSection>
  );

  return (
    <main className="pop-ui rwu-root" aria-label={t.title}>
      <PopTopStatus>
        {/* 연결은 공통 메뉴 맨 위 줄이 모든 화면에 같게 보인다(#291) — 여기서는 미전송이 있을 때만 알린다. */}
        {pendingCount > 0 && (
          <Chip variant="status" size="md" status="warning">
            {t.pending(pendingCount)}
          </Chip>
        )}
      </PopTopStatus>

      {/* ⭐ 사번 미확인은 모든 POP 화면이 같은 맨 위 띠로 말한다(사용자 지시 2026-09-17). */}
      <PopWorkerMissingBanner workerNo={identity.workerNo} />

      <PuScreen
        actionBar={
          <PuActionBar>
            <PuButton icon="reset" disabled={!hasSomethingToReset} onClick={reset}>
              {t.reset}
            </PuButton>
            {step === 'defect' ? (
              <PuButton onClick={() => goStep('input')}>{t.prev}</PuButton>
            ) : (
              <PuButton disabled={selected === null} onClick={() => goStep('defect')}>
                {defectQtyNumber > 0
                  ? t.toDefectWithQty(t.qtyWithUom(drafts.defectQty, uomLabel))
                  : t.toDefect}
              </PuButton>
            )}
            <PuButton variant="primary" disabled={!canSave} onClick={save}>
              {t.save}
            </PuButton>
          </PuActionBar>
        }
      >
        <PuCols variant="lk">
          {listSection}
          {centerSection}
          {keypadSection}
        </PuCols>
      </PuScreen>
    </main>
  );
};

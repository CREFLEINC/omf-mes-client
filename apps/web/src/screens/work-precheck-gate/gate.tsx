import { AlertBanner, Button, Chip, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import {
  EMERGENCY_WORK_ORDER_TYPE_CODE,
  OVERRIDE_REASON_CODE,
  UNRESOLVED_CONTROL_LEVEL,
  type ControlLevelCode,
  type DecisionCode,
} from './codes';
import {
  toControlLevel,
  toTypeWindows,
  useInspectionAssignments,
  useLatestInspections,
  useOpenBreakdownCount,
  usePrecheckPolicy,
} from './queries';
import { useRecordDecision } from './mutations';
import { POP_TOUCH_SIZE } from './touch-spec';
import type { ControlOverride } from './types';
import { decide, type PrecheckTarget, type Verdict } from './verdict';

const t = messages.workPrecheckGate;

/**
 * `P-02-02` 작업 전 점검 이력 확인·통제.
 *
 * ⚠ **독립 화면이 아니라 `P-02-01` 위에 얹히는 게이트다**(스펙 §4). 작업 시작을 누르면
 * 판정이 돌고, **막을 때만 이 화면이 뜬다**(§9-3). 통과면 아무것도 보이지 않고 그대로
 * 세션이 열린다.
 *
 * ⛔ **라우트를 따로 두지 않는다.** 게이트는 진입도 이탈도 `P-02-01` 을 통한다 — 주소로
 * 직접 열면 「무엇을 시작하려다 막혔는지」가 없는 화면이 된다.
 *
 * ⛔ **판정하지 못한 상태를 통과로 다루지 않는다**(F-6). 조회가 실패하거나 연결이 끊기면
 * 시작하지 않고 사유를 말한다.
 */
export interface PrecheckGateProps {
  /** 시작하려는 작업지시. */
  workOrderId: number;
  workOrderNo: string;
  workOrderTypeCode?: string | null;
  /** 이 단말이 붙어 있는 설비. ⛔ 모르면 판정하지 않는다. */
  equipmentId: number | null;
  equipmentCode: string | null;
  equipmentName: string | null;
  /** 통제 수준의 범위 축. 비어도 되며 서버가 「지정 없음」으로 해석한다. */
  plantId: number | null;
  processId: number | null;
  /** 귀속 사번. 쓰기의 `X-Worker-No` 에 실린다. */
  workerNo: string;
  /** 단말 시계가 정한 이 시도의 시각(`date-time`). 재시도해도 바뀌지 않는다. */
  decidedAt: string;
  /** 단말이 보는 오늘(`YYYY-MM-DD`) — 주기 창을 여는 기준이다. */
  today: string;
  /** ⛔ 오프라인이면 판정하지 않는다. */
  isOnline: boolean;
  /** 판정을 통과했다. 우회면 세션 본문에 실을 값이 함께 온다. */
  onCleared: (override: ControlOverride | null) => void;
  /** 작업지시 선택으로 돌아간다. */
  onCancel: () => void;
}

/** 통제 수준을 화면의 말로. ⚠ 「적용 정책 없음」은 경고와 같은 처리지만 다르게 적는다. */
const levelText = (level: ControlLevelCode, isResolved: boolean): string => {
  if (!isResolved) return t.verdict.levelUnresolved;

  return level === 'BLOCK' ? t.verdict.levelBlock : t.verdict.levelWarn;
};

export const PrecheckGate = ({
  workOrderId,
  workOrderNo,
  workOrderTypeCode,
  equipmentId,
  equipmentCode,
  equipmentName,
  plantId,
  processId,
  workerNo,
  decidedAt,
  today,
  isOnline,
  onCleared,
  onCancel,
}: PrecheckGateProps) => {
  const titleId = useId();
  const [confirming, setConfirming] = useState<'proceed' | 'override' | null>(null);

  /* ⛔ 오프라인·설비 미확인이면 조회를 열지 않는다 — 캐시로 판정하면 통제가 무력해진다. */
  const canAsk = isOnline && equipmentId !== null;

  const policy = usePrecheckPolicy(plantId, processId, canAsk);
  const assignments = useInspectionAssignments(equipmentId, canAsk);

  const windows = useMemo(
    () => toTypeWindows(assignments.data, today),
    [assignments.data, today],
  );

  const inspections = useLatestInspections(
    equipmentId,
    windows ?? [],
    canAsk && assignments.isSuccess && windows !== null,
  );
  const breakdowns = useOpenBreakdownCount(equipmentId, canAsk);

  const isEmergency = (workOrderTypeCode ?? '').trim() === EMERGENCY_WORK_ORDER_TYPE_CODE;
  const controlLevel = policy.data === undefined ? UNRESOLVED_CONTROL_LEVEL : toControlLevel(policy.data);

  /*
   * ⛔ **확인하지 못한 것을 통과로 다루지 않는다.** 순서가 뜻이다 — 연결·설비를 먼저
   *    말하고, 그 다음이 조회 실패다. 고장 조회는 «막지 않는» 축이라 여기 들어오지 않는다.
   */
  const unavailable = ((): string | null => {
    if (!isOnline) return t.blocked.offline;
    if (equipmentId === null) return t.blocked.equipmentUnknown;
    if (workerNo.trim() === '') return t.blocked.workerMissing;
    if (policy.isError || assignments.isError || inspections.isError) return t.blocked.lookupFailed;
    /* ⛔ 부여를 읽지 못한 것을 「점검 대상 아님」으로 넘기지 않는다. */
    if (assignments.isSuccess && windows === null) return t.blocked.lookupFailed;

    return null;
  })();

  const isChecking =
    unavailable === null && (policy.isPending || assignments.isPending || inspections.isPending);

  const verdict: Verdict | null =
    unavailable === null && !isChecking
      ? decide({ controlLevel, isEmergency, targets: inspections.targets })
      : null;

  const record = useRecordDecision({
    workerNo,
    onSuccess: () => {
      /* 기록이 남은 뒤에만 세션을 연다 — 판정 없이 열린 세션을 만들지 않는다. */
      const settled = settledRef.current;

      settledRef.current = null;

      if (settled !== null) onCleared(settled.override);
    },
  });

  /**
   * 이 기록이 성공하면 세션으로 이어지는가.
   *
   * ⛔ **우회 값 자체를 두지 않는다.** 통과·경고 진행은 우회가 아니라 `null` 을 싣는데,
   * 그 `null` 을 「이어지지 않음」과 같은 모양으로 두면 **통과가 세션을 열지 못한다**
   * (실측 — 여섯 감지기가 이 한 줄로 함께 깨졌다). 감싸서 두 상태를 가른다.
   */
  const settledRef = useRef<{ override: ControlOverride | null } | null>(null);

  /**
   * 같은 판정을 두 번 남기지 않기 위한 자리.
   *
   * ⛔ **렌더 중에 쓰지 않는다** — 판정이 나올 때마다 기록이 나가는 경로라, 렌더가 두 번
   * 돌면 같은 판정이 두 줄 남는다(선례 `P-02-10` 리뷰 Major).
   */
  const recordedRef = useRef<string | null>(null);

  const send = (decisionCode: DecisionCode, override: ControlOverride | null) => {
    const stamp = `${workOrderId}:${decidedAt}:${decisionCode}`;

    if (recordedRef.current === stamp) return;

    recordedRef.current = stamp;
    /* 차단은 여기에 오지만 세션으로 이어지지 않는다 — 그때만 «이어지지 않음»으로 둔다. */
    settledRef.current = decisionCode === 'BLOCKED' ? null : { override };

    record.write({
      workOrderId,
      equipmentId: equipmentId ?? 0,
      decidedAt,
      controlLevelCode: controlLevel,
      decisionCode,
      basisInspectionId: verdict?.basisInspectionId ?? null,
      ...(override === null ? {} : { overrideReasonCode: override.reasonCode }),
    });
  };

  /*
   * ⭐ **통과와 차단은 판정이 나온 그 자리에서 기록한다**(§5-8 · §9-3) — 통과는 화면이 뜨지
   *    않고 지나가고, 차단은 세션이 열리지 않아 사건으로 남길 곳이 없다. 경고·우회는 사람이
   *    누른 뒤에 남는다.
   */
  useEffect(() => {
    if (verdict === null) return;
    if (verdict.decisionCode === 'PASSED') {
      send('PASSED', null);

      return;
    }

    if (verdict.decisionCode === 'BLOCKED') send('BLOCKED', null);
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- 판정 회차마다 한 번만 보낸다. */
  }, [verdict?.decisionCode, decidedAt]);

  /*
   * 통과면 아무것도 그리지 않는다 — 게이트는 막을 때만 보인다.
   *
   * ⛔ **기록이 실패했으면 그대로 사라지지 않는다.** 통과 판정이어도 기록이 남지 않으면
   *    세션이 열리지 않는데, 화면까지 없으면 작업자는 **아무 일도 일어나지 않은 것으로**
   *    본다 — 사유와 다시 시도할 자리를 남긴다.
   */
  if (verdict !== null && !verdict.isGateShown && record.error === null) return null;

  const recheck = () => {
    void policy.refetch();
    void assignments.refetch();
    void breakdowns.refetch();
    inspections.refetch();
  };

  const openBreakdownCount = breakdowns.data?.page?.total ?? 0;
  const isNotTargeted = windows?.length === 0 && assignments.isSuccess;

  return (
    <main className="pop-shell precheck-gate" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>

        <p className="pop-context pop-context-right">
          <span>{t.header.workOrderLabel(workOrderNo)}</span>
          <span>
            {equipmentCode === null || equipmentCode.trim() === ''
              ? t.header.equipmentUnknown
              : t.header.equipmentLabel(equipmentCode, equipmentName ?? '')}
          </span>
          <span>
            {workerNo.trim() === ''
              ? t.header.workerUnset
              : t.header.workerLabel(workerNo)}
          </span>
        </p>
      </header>

      <section className="precheck-gate-verdict">
        {unavailable !== null ? (
          <AlertBanner variant="error">{unavailable}</AlertBanner>
        ) : isChecking ? (
          <AlertBanner variant="info">{t.verdict.checking}</AlertBanner>
        ) : verdict?.reason === 'failed' ? (
          <AlertBanner variant="error">
            <strong>{t.verdict.blockedFailed}</strong>
            <span className="precheck-gate-detail">{t.verdict.blockedFailedDetail}</span>
            <span className="precheck-gate-detail">
              {levelText(controlLevel, policy.data?.resolved ?? false)}
            </span>
          </AlertBanner>
        ) : verdict?.decisionCode === 'BLOCKED' ? (
          <AlertBanner variant="error">
            <strong>{t.verdict.blockedMissing}</strong>
            <span className="precheck-gate-detail">{t.verdict.blockedMissingDetail}</span>
            <span className="precheck-gate-detail">
              {levelText(controlLevel, policy.data?.resolved ?? false)}
            </span>
          </AlertBanner>
        ) : (
          <AlertBanner variant="warning">
            <strong>{t.verdict.warned}</strong>
            <span className="precheck-gate-detail">{t.verdict.warnedDetail}</span>
            <span className="precheck-gate-detail">
              {levelText(controlLevel, policy.data?.resolved ?? false)}
            </span>
          </AlertBanner>
        )}
      </section>

      <section className="precheck-gate-history">
        <h2 className="precheck-gate-section-title">{t.history.title}</h2>

        <p className="precheck-gate-scope">
          {t.history.scope(
            equipmentCode ?? t.history.equipmentUnknown,
            windows?.[0]?.windowFrom ?? today,
          )}
        </p>

        {isNotTargeted ? (
          <p className="precheck-gate-empty">{t.history.notTargeted}</p>
        ) : (
          <ul className="precheck-gate-rows">
            {inspections.targets.map((target: PrecheckTarget) => (
              <li key={target.inspectionTypeCode} className="precheck-gate-row">
                <span className="precheck-gate-row-type">
                  {t.history.typeLabel(target.inspectionTypeCode)}
                </span>

                {target.latest === null ? (
                  <Chip variant="status" size="sm" status="error">
                    {t.history.none}
                  </Chip>
                ) : (
                  <>
                    <Chip
                      variant="status"
                      size="sm"
                      status={target.latest.overallResultCode === 'PASS' ? 'success' : 'error'}
                    >
                      {target.latest.overallResultCode === 'PASS'
                        ? t.history.pass
                        : t.history.fail}
                    </Chip>
                    <span className="precheck-gate-row-detail">
                      {t.history.entry(
                        target.latest.inspectedAt,
                        target.latest.workerNo ?? '',
                        target.latest.overallResultCode === 'PASS'
                          ? t.history.pass
                          : t.history.fail,
                      )}
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* ⚠ 「없음」이 「안 했음」이 아닐 수 있다 — 그 사실을 말하되 통과시키지는 않는다. */}
        {verdict?.reason === 'missing' && (
          <p className="precheck-gate-note">{t.history.unsentWarning}</p>
        )}

        {/* ⚠ 고장은 보이되 막지 않는다 — 점검과 축이 다르다. */}
        {openBreakdownCount > 0 && (
          <p className="precheck-gate-note">{t.history.openBreakdowns(openBreakdownCount)}</p>
        )}
      </section>

      <section className="precheck-gate-guide">
        <h2 className="precheck-gate-section-title">{t.guide.title}</h2>
        <p>{t.guide.step1}</p>
        <p>{t.guide.step2}</p>

        <p className="precheck-gate-note">
          {verdict?.reason === 'failed'
            ? t.guide.failedNoOverride
            : verdict?.canOverride === true
              ? t.guide.emergency
              : t.guide.emergencyOnly}
        </p>
      </section>

      {record.error !== null && (
        <div className="banner-slot">
          <AlertBanner variant="error">{t.blocked.recordFailed}</AlertBanner>
        </div>
      )}

      <div className="precheck-gate-actions">
        <Button type="button" variant="outlined" size={POP_TOUCH_SIZE} onClick={onCancel}>
          {t.actions.back}
        </Button>

        <Button
          type="button"
          variant="outlined"
          size={POP_TOUCH_SIZE}
          disabled={record.isSaving}
          onClick={recheck}
        >
          {t.actions.recheck}
        </Button>

        {verdict?.canProceed === true && (
          <Button
            type="button"
            variant="filled"
            size={POP_TOUCH_SIZE}
            disabled={record.isSaving}
            onClick={() => {
              setConfirming('proceed');
            }}
          >
            {record.isSaving ? t.actions.working : t.actions.proceed}
          </Button>
        )}

        {verdict?.canOverride === true && (
          <Button
            type="button"
            variant="filled"
            size={POP_TOUCH_SIZE}
            disabled={record.isSaving}
            onClick={() => {
              setConfirming('override');
            }}
          >
            {record.isSaving ? t.actions.working : t.actions.override}
          </Button>
        )}
      </div>

      <Dialog
        open={confirming !== null}
        onClose={() => {
          setConfirming(null);
        }}
        /* ⛔ 되돌릴 수 없는 조작이라 스크림을 눌러 닫지 않는다. */
        closeOnBackdropClick={false}
        title={confirming === 'override' ? t.confirm.overrideTitle : t.confirm.title}
        footer={
          <>
            <Button
              type="button"
              variant="text"
              size="lg"
              onClick={() => {
                setConfirming(null);
              }}
            >
              {t.confirm.cancel}
            </Button>

            <Button
              type="button"
              variant="filled"
              size="lg"
              onClick={() => {
                const mode = confirming;

                setConfirming(null);

                if (mode === 'override') {
                  send('OVERRIDDEN', { reasonCode: OVERRIDE_REASON_CODE });

                  return;
                }

                if (mode === 'proceed') send('WARNED', null);
              }}
            >
              {t.confirm.confirm}
            </Button>
          </>
        }
      >
        {confirming === 'override' ? t.confirm.overrideBody : t.confirm.body}
      </Dialog>
    </main>
  );
};

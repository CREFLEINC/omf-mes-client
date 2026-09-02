import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { usePopIdentity } from '../../patterns/pop-identity';
import { ActionBar } from './action-bar';
import { useIsOnline } from './connection';
import { useStartGate } from './gating';
import { useResumeWork, useStartWork, toResumeBody } from './mutations';
import { PopHeader } from './pop-header';
import { SelectionCard } from './selection-card';
import { useOpenSession, useTerminal, useWorkOrders, useWorkerLookup } from './queries';
import { toSessionRequest } from './session-request';
import { terminalNow } from './terminal-clock';
import type { WorkOrder } from './types';
import { WorkOrderList } from './work-order-list';
import { isHeld } from './work-order-status';
import { WorkerPanel } from './worker-panel';
import { verifyWorker } from './worker-verify';

/**
 * `P-02-01` 작업 시작(작업지시 선택).
 *
 * ⭐ **POP 태스크의 시작점이다.** 사번을 받고, 이 설비에 배포된 작업지시를 골라 **세션을
 * 연다** — 다른 POP 화면이 그 세션 위에서 돈다.
 *
 * ⛔ **오프라인에서 시작하지 않는다**(§6-1 · 통지 #556). 이 화면이 읽는 값이 전부 판정값이라,
 * 캐시로 진행하면 권한 없는 단말이 열리고 차단해야 할 작업이 열린다. **큐를 만들지 않는다.**
 *
 * ⛔ **점검 통제를 이 화면이 판정하지 않는다**(§5-2 · F-5). 판정하고 막는 것은 「작업 전 점검
 * 이력 확인·통제」(`P-02-02`)이고, 이 화면은 결과를 **보이고** 통과 시 세션을 연다.
 *
 * ⛔ **재개가 새 세션을 열지 않는다**(§5-4). 중단해도 세션은 열려 있고, 재개는 그 세션 안의
 * 사건이다 — 두 버튼은 **다른 경로**로 간다.
 */
export const WorkStartScreen = () => {
  const t = messages.workStart;
  /* 셸이 없는 화면이라 표제가 본문의 이름이 된다 — 이름 없는 랜드마크로 남기지 않는다. */
  const titleId = useId();

  /* ⛔ 단말·공정·사번은 셸이 채운다 — 화면이 토큰을 열어 읽지 않는다(F-2). */
  const identity = usePopIdentity();
  const isOnline = useIsOnline();

  const gate = useStartGate(identity.terminalId, identity.processId);
  const terminal = useTerminal(identity.terminalId);

  const equipmentId = terminal.data?.equipmentId ?? null;
  const equipmentCode = terminal.data?.equipmentCode ?? null;
  const equipmentName = terminal.data?.equipmentName ?? null;

  /*
   * ⭐ 셸이 사번을 이미 정했으면 그 값으로 선다 — 사번 경량 인증(`P-CO-01`)을 지나온 작업자에게
   *    같은 것을 두 번 묻지 않는다. 없으면 이 화면의 키패드로 받는다(스펙 §4 ① · §7 G-6).
   */
  const [confirmedNo, setConfirmedNo] = useState<string | null>(identity.workerNo);
  const [draft, setDraft] = useState('');
  /** 눌렀을 때만 조회한다 — 치는 동안 매 글자마다 물으면 아직 다 치지도 않은 사번으로 「없다」가 뜬다. */
  const [submittedNo, setSubmittedNo] = useState<string | null>(null);
  const lookup = useWorkerLookup(submittedNo);

  const workerError = ((): string | null => {
    if (submittedNo === null || confirmedNo !== null) return null;
    if (lookup.isError) return t.worker.lookupFailed;
    if (lookup.data === undefined) return null;

    const result = verifyWorker(lookup.data, submittedNo);

    if (result.kind === 'unknown') return t.worker.unknown;
    if (result.kind === 'inactive') return t.worker.inactive;

    return null;
  })();

  /*
   * 확인이 끝났으면 그 사번을 확정한다. `useEffect` 를 쓰지 않고 렌더 중에 상태를 옮기는 것을
   * 피하려고, 확정 판정만 여기서 하고 반영은 아래 버튼 처리에서 한다.
   */
  const verified =
    submittedNo !== null && lookup.data !== undefined
      ? verifyWorker(lookup.data, submittedNo)
      : null;

  if (confirmedNo === null && verified !== null && verified.kind === 'ok') {
    /* 렌더 중 상태 갱신 — React 가 같은 렌더에서 다시 그린다. 값이 같으면 다시 돌지 않는다. */
    setConfirmedNo(verified.workerNo);
  }

  const [isShowingAll, setShowingAll] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  const listEquipmentId = isShowingAll ? null : equipmentId;
  /*
   * ⚠ 설비를 모르는 채로 기본 목록을 열지 않는다 — 축 없이 물으면 「이 설비 배포분」이라고
   *    그린 화면에 다른 설비의 지시가 실린다. 그 상태는 목록 구획이 사유와 함께 말한다.
   */
  const isListAsked = isShowingAll || equipmentId !== null;
  const list = useWorkOrders(listEquipmentId, isListAsked);

  const rows = list.data?.items;
  /*
   * 고른 것을 «지금 목록에서» 다시 찾는다 — 줄을 복사해 들고 있으면 새로고침 뒤 사라진 W/O 로
   * 세션을 열게 된다.
   */
  const selected = (rows ?? []).find((row) => row.workOrderId === selectedId) ?? null;
  const isResume = selected !== null && isHeld(selected);

  /*
   * ⭐ **고른 지시의 «열린» 세션을 늘 확인한다** — 재개할 세션을 찾기 위해서만이 아니다.
   *    §6 이 「이미 진행 중인 세션이 있으면 새 시작 불가」라고 정했는데, 그 사실을 화면이
   *    아는 길이 이 조회다. ⛔ 서버의 409 를 기다려 말하지 않는다 — 계약이 그 응답을
   *    「충돌」로만 적어 두어, 409 를 「진행 중」으로 읽으면 뜻을 지어내는 것이 된다.
   */
  const openSession = useOpenSession(selected?.workOrderId ?? null, selected !== null);

  const startWork = useStartWork({
    workerNo: confirmedNo ?? '',
    onSuccess: () => {
      setOutcome(t.result.started(selected?.workOrderNo ?? ''));
      setSelectedId(null);
    },
  });

  const resumeWork = useResumeWork({
    workSessionId: openSession.data?.workSessionId ?? 0,
    workerNo: confirmedNo ?? '',
    onSuccess: () => {
      setOutcome(t.result.resumed(selected?.workOrderNo ?? ''));
      setSelectedId(null);
    },
  });

  /**
   * 시작·재개를 막는 사유. **순서가 뜻이다** — 단말이 못 하는 일이면 사번을 아무리 잘 넣어도
   * 열리지 않으므로 그 사실을 먼저 말한다.
   */
  const blockReason = ((): string | null => {
    if (gate.verdict === 'unidentified') return t.blocked.unidentified;
    if (gate.verdict === 'checking') return t.blocked.checking;
    if (gate.verdict === 'unavailable') return t.blocked.unavailable;
    if (gate.verdict === 'denied') return t.blocked.denied;
    /* ⛔ 오프라인은 큐가 아니라 거부다 — 사유와 다음 행동을 함께 보인다. */
    if (!isOnline) return t.blocked.offline;
    if (confirmedNo === null) return t.blocked.workerMissing;
    if (selected === null) return t.blocked.notSelected;

    if (openSession.isError) return t.resume.sessionLookupFailed;
    if (openSession.isPending) return t.resume.checking;

    if (isResume) {
      /* ⛔ 열린 세션이 없으면 재개하지 않는다 — 새로 열면 중단 구간이 사라진다. */
      if (openSession.data === null) return t.resume.sessionNotFound;
    } else if (openSession.data !== null) {
      /* ⛔ 세션이 이미 열려 있으면 새로 열지 않는다(§6). */
      return t.blocked.alreadyOpen;
    }

    return null;
  })();

  const retryLabel = gate.verdict === 'unavailable' ? t.blocked.retry : null;

  const writeError = isResume ? resumeWork.error : startWork.error;

  const submit = () => {
    if (selected === null || confirmedNo === null) return;

    setOutcome(null);

    if (isResume) {
      resumeWork.write(toResumeBody(terminalNow(new Date())));

      return;
    }

    startWork.write(
      toSessionRequest({ workOrder: selected, equipmentId, startedAt: terminalNow(new Date()) }),
    );
  };

  return (
    <main className="pop-shell work-start-screen" aria-labelledby={titleId}>
      <PopHeader
        titleId={titleId}
        equipmentCode={equipmentCode}
        equipmentName={equipmentName}
        workerNo={confirmedNo}
        /*
         * ⭐ 연결 여부는 «마지막 조회가 서버에 닿았는가»로 말한다 — 브라우저의 온라인 표시는
         *    산업용 패널 PC 에서 사실과 다르다. 아직 답을 못 받았으면 «모른다»로 둔다.
         */
        isConnected={list.isError ? false : list.isSuccess ? true : undefined}
      />

      <WorkerPanel
        draft={draft}
        confirmed={confirmedNo}
        onChange={setDraft}
        onSubmit={() => {
          setSubmittedNo(draft.trim());
        }}
        onReset={() => {
          setConfirmedNo(null);
          setSubmittedNo(null);
          setDraft('');
          setSelectedId(null);
        }}
        isChecking={submittedNo !== null && confirmedNo === null && lookup.isFetching}
        error={workerError}
      />

      <WorkOrderList
        workOrders={rows}
        isAsked={isListAsked}
        isLoading={isListAsked && list.isPending}
        isError={list.isError}
        total={list.data?.page.total}
        isShowingAll={isShowingAll}
        isEquipmentUnknown={equipmentId === null}
        canSelect={confirmedNo !== null}
        selectedId={selectedId}
        onSelect={(workOrder: WorkOrder) => {
          setOutcome(null);
          setSelectedId(workOrder.workOrderId);
        }}
        onToggleScope={() => {
          setSelectedId(null);
          setShowingAll((previous) => !previous);
        }}
        onRetry={() => {
          void list.refetch();
        }}
      />

      <SelectionCard workOrder={selected} equipmentId={equipmentId} equipmentCode={equipmentCode} />

      {outcome !== null && (
        <div className="banner-slot">
          <AlertBanner variant="success">{outcome}</AlertBanner>
        </div>
      )}

      {writeError !== null && (
        <div className="banner-slot">
          <AlertBanner variant="error">
            {writeError.kind === 'conflict' ||
            (writeError.kind === 'http' && writeError.status === 409)
              ? t.result.conflict
              : isResume
                ? t.result.resumeFailed
                : t.result.startFailed}
          </AlertBanner>
        </div>
      )}

      <ActionBar
        mode={isResume ? 'resume' : 'start'}
        blockReason={blockReason}
        retryLabel={retryLabel}
        onRetry={gate.retry}
        isSaving={isResume ? resumeWork.isSaving : startWork.isSaving}
        onReset={() => {
          setSelectedId(null);
          setOutcome(null);
        }}
        onSubmit={submit}
      />
    </main>
  );
};

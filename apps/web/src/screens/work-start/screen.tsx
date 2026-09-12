import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { soleProcessIdOf, usePopIdentity } from '../../patterns/pop-identity';
import { PrecheckGate } from '../work-precheck-gate/gate';
import { setWorkerSession, useWorkerSession } from '../../patterns/worker-session';
import { ActionBar } from './action-bar';
import { useIsOnline } from './connection';
import { useStartGate } from './gating';
import { useResumeWork, useStartWork, toResumeBody } from './mutations';
import { PopHeader } from './pop-header';
import { SelectionCard } from './selection-card';
import {
  useOpenSession,
  useTerminal,
  useUomCodes,
  useWorkOrders,
  useWorkerLookup,
} from './queries';
import { toSessionRequest } from './session-request';
import { assignedAtText, terminalNow } from './terminal-clock';
import type { ControlOverride, WorkOrder } from './types';
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
 * 이력 확인·통제」(`P-02-02`)이고, 이 화면은 결과를 **보이고** 통과 시 세션을 연다 —
 * 시작을 누르면 게이트가 먼저 서고, 게이트가 열어 준 뒤에야 이 화면이 세션을 연다.
 *
 * ⚠ **재개는 게이트를 지나지 않는다.** 통제는 「작업을 시작할 수 있는가」를 묻는 것이고
 * 재개는 이미 열린 세션 «안의» 사건이다(§5-4).
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

  /* 단위 이름 — 수량 뒤에 붙인다. 못 받으면 붙이지 않는다(지어내지 않는다). */
  const uoms = useUomCodes();
  const uomCodeOf = (uomId: number | undefined): string | null =>
    uomId === undefined ? null : (uoms.data?.get(uomId) ?? null);

  const gate = useStartGate(identity.terminalId, soleProcessIdOf(identity.processes));
  const terminal = useTerminal(identity.terminalId);

  const equipmentId = terminal.data?.equipmentId ?? null;
  const equipmentCode = terminal.data?.equipmentCode ?? null;
  const equipmentName = terminal.data?.equipmentName ?? null;

  /*
   * ⭐ **사번은 단말이 이미 들고 있을 수 있다.** 사번 경량 인증(`P-CO-01`)이 정한 값이
   *    `patterns/worker-session` 에 있고, 그 자리는 처음부터 「읽을 곳은 그 화면 밖」으로
   *    세워졌다. 지나온 작업자에게 같은 것을 두 번 묻지 않는다 — **이 화면은 그 자리를
   *    읽고, 여기서 확인한 사번도 같은 자리에 넣는다.** 두 벌을 만들지 않는다.
   *
   * ⚠ 셸이 채울 `pop-identity` 가 먼저다 — 단말 토큰에서 온 값이 있으면 그것이 정본이다.
   */
  const workerSession = useWorkerSession();
  const confirmedNo = identity.workerNo ?? workerSession?.worker.workerNo ?? null;

  const [draft, setDraft] = useState('');
  /** 눌렀을 때만 조회한다 — 치는 동안 매 글자마다 물으면 아직 다 치지도 않은 사번으로 「없다」가 뜬다. */
  const [submittedNo, setSubmittedNo] = useState<string | null>(null);
  const lookup = useWorkerLookup(submittedNo);

  /** 다른 공장 사번인지 견줄 기준. 단말이 선 공장이다 — 못 받았으면 견주지 않는다. */
  const homePlantId = terminal.data?.plantId ?? null;

  /*
   * ⚠ **다시 만들지 않는다.** 이 값은 아래 효과의 의존이라, 렌더마다 새 객체가 되면 효과가
   * 매 렌더 돈다 — 사번을 정하는 효과가 화면 밖 저장소를 건드리므로 그 소음이 곧 재렌더가 된다.
   */
  const verified = useMemo(
    () =>
      submittedNo !== null && lookup.data !== undefined
        ? verifyWorker(lookup.data, submittedNo, homePlantId)
        : null,
    [lookup.data, submittedNo, homePlantId],
  );

  const workerError = ((): string | null => {
    if (submittedNo === null || confirmedNo !== null) return null;
    if (lookup.isError) return t.worker.lookupFailed;
    if (verified === null) return null;
    if (verified.kind === 'unknown') return t.worker.unknown;
    if (verified.kind === 'inactive') return t.worker.inactive;

    return null;
  })();

  /*
   * 확인이 끝나면 단말의 「현재 작업자」를 정한다 — 이 값은 화면 지역 상태가 아니라 단말이
   * 들고 있는 것이라, 다음 화면으로 넘어가도 남아야 한다(`worker-session` 머리 주석).
   *
   * ⛔ **렌더 도중에 쓰지 않는다.** 화면 밖 저장소를 렌더에서 쓰면 「썼으니 다시 그린다 →
   * 아직 조건이 참이다 → 또 쓴다」가 성립할 수 있다 — 실제로 그 고리를 만들어 화면이 멈추는
   * 것을 봤다. 사번 경량 인증 화면(`P-CO-01`)도 같은 이유로 확인을 효과에서 매듭짓는다.
   *
   * ⚠ **한 번 확인한 사번은 다시 쓰지 않는다** — 어떤 사번을 이미 반영했는지 기억해 둔다.
   */
  const [appliedNo, setAppliedNo] = useState<string | null>(null);

  useEffect(() => {
    if (verified === null || verified.kind !== 'ok') return;
    if (submittedNo === null || appliedNo === submittedNo) return;

    setAppliedNo(submittedNo);
    setWorkerSession({
      worker: verified.worker,
      assignedAt: assignedAtText(new Date()),
      isOtherPlant: verified.isOtherPlant,
    });
  }, [verified, submittedNo, appliedNo]);

  const [isShowingAll, setShowingAll] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  const listEquipmentId = isShowingAll ? null : equipmentId;
  /*
   * ⚠ 설비를 모르는 채로 기본 목록을 열지 않는다 — 축 없이 물으면 「이 설비 배포분」이라고
   *    그린 화면에 다른 설비의 지시가 실린다. 그 상태는 목록 구획이 사유와 함께 말한다.
   */
  const isListAsked = isShowingAll || equipmentId !== null;
  /* 쪽 번호. 축(설비·전체 보기)이 바뀌면 첫 쪽으로 되돌린다 — 아래 전환 자리에서 함께 맞춘다. */
  const [listPage, setListPage] = useState(1);
  const list = useWorkOrders(listEquipmentId, isListAsked, listPage);

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

  /**
   * 이 시도가 언제 일어났는가. **한 번 정하면 성공할 때까지 붙든다.**
   *
   * ⛔ **누를 때마다 새로 만들면 안 된다.** 시각이 본문에 실리므로(`startedAt`·`occurredAt`)
   * 재시도마다 값이 달라지고, 그러면 **멱등 키의 지문도 매번 달라져 같은 쓰기가 새 쓰기로
   * 나간다** — 통신이 끊긴 뒤 다시 누르면 세션이 두 번 열리고 재개가 두 번 적재된다.
   * 멱등 키를 `until-applied` 로 둔 뜻이 시각 한 줄로 무너지는 자리다(선례 `tool-usage`).
   *
   * 값이 실제로 바뀌었을 때만 버린다 — 성공했거나, 다른 작업지시를 골랐거나.
   */
  const submitAtRef = useRef<string | null>(null);

  /**
   * 점검 통제 게이트가 열려 있는가 — 열려 있으면 그 시도의 시각이 들어 있다.
   *
   * ⭐ **시각을 상태로 든다.** 게이트가 판정 기록에 싣는 값이라, 다시 그리는 사이에 바뀌면
   * 같은 시도가 두 판정으로 남는다.
   */
  const [gateAt, setGateAt] = useState<string | null>(null);

  const navigate = useNavigate();

  /**
   * 시작·재개가 끝나면 **자재 투입 화면으로 보낸다**(사용자 지시 2026-09-08).
   *
   * ⚠ **스펙이 이 이동을 적어 두지는 않았다.** 프로세스는 `S3`(작업 전 점검) → `S6`(작업
   *   시작·4M 투입)로 이어지므로 «다음이 무엇인가»는 분명하지만, 「자동으로 넘어가라」는
   *   문장은 세 화면 스펙 어디에도 없다. 스펙이 화면 전환을 지시하는 자리는 「진행 중인
   *   세션이 있으면 그 세션으로 이동」 한 줄뿐이다.
   *
   * ⛔ **작업지시를 주소로 넘긴다.** 자재 투입 화면은 작업지시를 «주소가 소유한다»고 못 박았다
   *    (`material-input-scan/screen-params.ts`) — 화면이 기억해 두면 단말을 넘겨받은 다음
   *    작업자가 남의 작업지시에 자재를 투입한다.
   */
  const goToMaterialInput = (workOrderId: number): void => {
    void navigate(`/pop/material-input?workOrderId=${String(workOrderId)}`);
  };

  const startWork = useStartWork({
    workerNo: confirmedNo ?? '',
    onSuccess: () => {
      submitAtRef.current = null;
      setOutcome(t.result.started(selected?.workOrderNo ?? ''));
      setSelectedId(null);

      /*
       * ⚠ **문구가 화면에 남는 시간은 이동 전까지다.** 시작이 되면 자재 투입으로 넘어가므로
       *   (사용자 지시 2026-09-08) 이 문구를 실제로 읽는 것은 이동이 막혔을 때뿐이다.
       *   ⛔ 그렇다고 걷지 않는다 — 「시작하면 그 사실을 작업지시 번호와 함께 알린다」가
       *      스펙으로 못박혀 있고, 이동 없이 서는 갈래에서 유일한 확인 수단이다.
       */
      if (selected !== null) goToMaterialInput(selected.workOrderId);
    },
  });

  const resumeWork = useResumeWork({
    workSessionId: openSession.data?.workSessionId ?? null,
    workerNo: confirmedNo ?? '',
    onSuccess: () => {
      submitAtRef.current = null;
      setOutcome(t.result.resumed(selected?.workOrderNo ?? ''));
      setSelectedId(null);

      /*
       * ⚠ **문구가 화면에 남는 시간은 이동 전까지다.** 시작이 되면 자재 투입으로 넘어가므로
       *   (사용자 지시 2026-09-08) 이 문구를 실제로 읽는 것은 이동이 막혔을 때뿐이다.
       *   ⛔ 그렇다고 걷지 않는다 — 「시작하면 그 사실을 작업지시 번호와 함께 알린다」가
       *      스펙으로 못박혀 있고, 이동 없이 서는 갈래에서 유일한 확인 수단이다.
       */
      if (selected !== null) goToMaterialInput(selected.workOrderId);
    },
  });

  /**
   * 시작·재개를 막는 사유. **순서가 뜻이다** — 단말이 못 하는 일이면 사번을 아무리 잘 넣어도
   * 열리지 않으므로 그 사실을 먼저 말한다.
   */
  const block = ((): { code: 'notSelected' | 'other'; text: string } | null => {
    /*
     * ⚠ **사유를 «코드»와 함께 낸다.** 배너를 세울지는 「아무것도 안 골랐다」인지로 갈리는데,
     *   그것을 번역 문구가 같은지로 판정하면 다른 사유가 같은 문장을 쓰게 되는 날 그 배너까지
     *   함께 사라진다 — 화면이 조용히 말을 잃는다(리뷰 지적 2026-09-08).
     */
    const other = (text: string) => ({ code: 'other' as const, text });

    if (gate.verdict === 'unidentified') return other(t.blocked.unidentified);
    if (gate.verdict === 'checking') return other(t.blocked.checking);
    if (gate.verdict === 'unavailable') return other(t.blocked.unavailable);
    if (gate.verdict === 'denied') return other(t.blocked.denied);
    /* ⛔ 오프라인은 큐가 아니라 거부다 — 사유와 다음 행동을 함께 보인다. */
    if (!isOnline) return other(t.blocked.offline);
    if (confirmedNo === null) return other(t.blocked.workerMissing);
    if (selected === null) return { code: 'notSelected', text: t.blocked.notSelected };

    if (openSession.isError) return other(t.resume.sessionLookupFailed);
    if (openSession.isPending) return other(t.resume.checking);

    if (isResume) {
      /* ⛔ 열린 세션이 없으면 재개하지 않는다 — 새로 열면 중단 구간이 사라진다. */
      if (openSession.data === null) return other(t.resume.sessionNotFound);
    } else if (openSession.data !== null) {
      /* ⛔ 세션이 이미 열려 있으면 새로 열지 않는다(§6). */
      return other(t.blocked.alreadyOpen);
    }

    return null;
  })();

  const retryLabel = gate.verdict === 'unavailable' ? t.blocked.retry : null;

  const writeError = isResume ? resumeWork.error : startWork.error;

  const submit = () => {
    if (selected === null || confirmedNo === null) return;

    setOutcome(null);

    /* 붙들고 있던 시각이 있으면 그대로 쓴다 — 같은 시도의 재시도이기 때문이다. */
    submitAtRef.current ??= terminalNow(new Date());
    const at = submitAtRef.current;

    if (isResume) {
      resumeWork.write(toResumeBody(at));

      return;
    }

    /*
     * ⛔ **여기서 세션을 열지 않는다.** 작업 시작은 점검 통제 게이트를 지나야 한다(`P-02-02`
     *    §5-5). 게이트가 통과·경고 진행·우회 중 하나로 판정을 «기록한 뒤» 열어 주고, 그때
     *    아래 `startSession` 이 부른다.
     */
    setGateAt(at);
  };

  /**
   * 게이트가 열어 준 뒤에 세션을 연다. 우회면 그 사실이 본문에 함께 실린다.
   *
   * ⚠ 게이트가 붙들고 있던 시각을 그대로 쓴다 — 판정과 세션이 같은 시도임을 시각이 말한다.
   */
  const startSession = (override: ControlOverride | null) => {
    setGateAt(null);

    if (selected === null) return;

    startWork.write(
      toSessionRequest({
        workOrder: selected,
        equipmentId,
        startedAt: submitAtRef.current ?? terminalNow(new Date()),
        controlOverride: override,
      }),
    );
  };

  /**
   * 고른 것을 «비운다» — 시각·판정·결과 문구까지 함께 버린다.
   *
   * ⛔ `setSelectedId(null)` 만 하지 않는다. 붙들고 있던 시각(`submitAtRef`)은 멱등 키의
   * 지문이라 다음 선택으로 새어 가면 «다른 지시의 시작»이 같은 쓰기로 나간다.
   */
  const clearSelection = () => {
    submitAtRef.current = null;
    setGateAt(null);
    setOutcome(null);
    setSelectedId(null);
  };

  /**
   * 다른 것을 고르면 다른 쓰기다 — 붙들고 있던 시각을 버린다.
   *
   * ⭐ **고른 것을 한 번 더 누르면 해제한다.** 이 화면은 지시를 «하나»만 고른다(§5-A 가
   * `work_order_id` 한 건이고 상태도 「선택됨」 하나다). 고른 것을 무르는 길이 액션바
   * 버튼뿐이면, 손이 카드에 있는 채로 눈만 화면 아래 끝까지 다녀와야 한다.
   */
  const selectWorkOrder = (workOrder: WorkOrder) => {
    if (workOrder.workOrderId === selectedId) {
      clearSelection();

      return;
    }

    submitAtRef.current = null;
    setGateAt(null);
    setOutcome(null);
    setSelectedId(workOrder.workOrderId);
  };

  /**
   * 연결됐다고 말할 수 있는가. ⛔ **아직 답을 못 받았으면 `undefined`(모른다)다** — 셋을
   * 삼항 두 겹으로 겹쳐 쓰면 「모른다」가 「끊겼다」로 읽히기 쉬운 자리라 따로 세운다.
   */
  const connectionVerdict = list.isError ? false : list.isSuccess ? true : undefined;

  return (
    <main className="pop-shell pop-ui work-start-screen" aria-labelledby={titleId}>
      <PopHeader
        titleId={titleId}
        equipmentCode={equipmentCode}
        equipmentName={equipmentName}
        workerNo={confirmedNo}
        /*
         * ⭐ 연결 여부는 «마지막 조회가 서버에 닿았는가»로 말한다 — 브라우저의 온라인 표시는
         *    산업용 패널 PC 에서 사실과 다르다. 아직 답을 못 받았으면 «모른다»로 둔다.
         */
        isConnected={connectionVerdict}
      />

      {/*
       * 막힘 사유 — **머리줄 바로 아래**에 선다.
       *
       * ⭐ 「왜 못 하는지 + 무엇을 하면 되는지」를 함께 낸다(G-3 · §5-1 · §9-2). ⛔ 회색 버튼만
       *    두지 않는다 — 작업자는 단말이 고장 난 줄 안다.
       *
       * ⛔ **「아직 안 골랐다」는 여기 내지 않는다**(사용자 지시 2026-09-08). 화면에 들어오면
       *    아무것도 안 고른 것이 «정상 시작 상태»인데, 그것을 경고 배너로 내면 열자마자
       *    무언가 잘못된 것처럼 보인다. 그 안내는 선택 카드가 이미 제자리에서 하고 있고
       *    (`selection-card.tsx`), 시작 버튼도 그 사유로 잠긴 채 선다.
       *
       * ⚠ **자리는 설계가 정해 두지 않았다.** §6 은 사번 오류만 「인라인」으로 못박았고 시작
       *    불가 사유의 자리는 비어 있으며, §4 도면에도 이 배너가 없다. 한때 액션바 안에 두었는데
       *    ② 목록이 긴 화면에서 사유가 화면 맨 아래에 있어, 「왜 안 눌리지」 하고 버튼을 먼저
       *    보게 된다. 머리줄 아래는 이 셸이 「지금 이 화면에 걸린 것」을 말해 온 자리다.
       */}
      {block !== null && block.code !== 'notSelected' && (
        <div className="banner-slot">
          {/*
           * ⭐ **[ 다시 확인 ]은 띠의 조작 칸에 선다**(사용자 지시 2026-09-11 · POP 공통).
           *    글 사이에 끼워 두면 화면마다 자리와 크기가 갈린다 — 다른 POP 화면의 실패 띠가
           *    모두 `action` 으로 오른쪽 끝에 세우고 `sm` 으로 서 있다.
           */}
          <AlertBanner
            variant="warning"
            action={
              retryLabel === null ? undefined : (
                <Button type="button" variant="outlined" size="sm" onClick={gate.retry}>
                  {retryLabel}
                </Button>
              )
            }
          >
            {block.text}
          </AlertBanner>
        </div>
      )}

      {/*
       * ⛔ **사번을 이미 아는 자리에서는 이 구획을 세우지 않는다**(사용자 지시 2026-09-08).
       *
       * 스펙 §4 ① 은 사번 구획을 96px 로 그려 두었지만, 그것은 **진입 화면이 없던 때**의
       * 그림이다. 지금은 `P-CO-01`(사번 경량 인증)이 사번을 정해 `worker-session` 에 두고
       * 오므로, 여기서 다시 묻는 것은 같은 것을 두 번 묻는 것이다 — 작업자가 사번을 두 번
       * 친다.
       *
       * ⚠ **못 받았을 때는 남긴다.** 셸도 세션도 사번을 못 준 상태에서 자리까지 없애면
       *   작업자가 되돌아갈 길이 없다. 그때만 키패드를 세운다.
       *
       * 작업자를 바꾸는 길은 머리줄의 **로그아웃**이다 — 사번을 놓고 진입 화면으로 돌아간다.
       */}
      {confirmedNo === null && (
        <WorkerPanel
          draft={draft}
          confirmed={confirmedNo}
          onChange={setDraft}
          onSubmit={() => {
            setSubmittedNo(draft.trim());
          }}
          onReset={() => {
            /* 작업자를 바꾼다 — 단말이 들고 있던 사번을 비운다. */
            setWorkerSession(null);
            setAppliedNo(null);
            setSubmittedNo(null);
            setDraft('');
            setSelectedId(null);
          }}
          canChange={identity.workerNo === null}
          onRetry={() => {
            void lookup.refetch();
          }}
          isChecking={submittedNo !== null && confirmedNo === null && lookup.isFetching}
          error={workerError}
        />
      )}

      <WorkOrderList
        uomCodeOf={uomCodeOf}
        workOrders={rows}
        isAsked={isListAsked}
        isLoading={isListAsked && list.isPending}
        isError={list.isError}
        total={list.data?.page.total}
        pageMeta={list.data?.page}
        onPageChange={(page) => {
          /* 쪽을 넘기면 고른 것을 놓는다 — 다른 쪽의 지시를 고른 채로 두면 화면과 어긋난다. */
          setSelectedId(null);
          submitAtRef.current = null;
          setListPage(page);
        }}
        isShowingAll={isShowingAll}
        isEquipmentUnknown={equipmentId === null}
        canSelect={confirmedNo !== null}
        selectedId={selectedId}
        onSelect={selectWorkOrder}
        onToggleScope={() => {
          submitAtRef.current = null;
          setSelectedId(null);
          /* ⛔ 축이 바뀌면 첫 쪽으로 — 3쪽을 보던 중 전체 보기로 옮기면 빈 쪽이 뜬다. */
          setListPage(1);
          setShowingAll((previous) => !previous);
        }}
        onRetry={() => {
          void list.refetch();
        }}
      />

      <SelectionCard
        workOrder={selected}
        equipmentId={equipmentId}
        equipmentCode={equipmentCode}
        uomCodeOf={uomCodeOf}
      />

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
        isBlocked={block !== null}
        isSaving={isResume ? resumeWork.isSaving : startWork.isSaving}
        onSubmit={submit}
      />

      {/*
        점검 통제 게이트 — ⭐ **막을 때만 보인다**(`P-02-02` §9-3). 통과면 아무것도 그리지
        않고 판정만 남긴 뒤 세션을 연다. 이 화면 위에 덮이므로 여기서 마지막에 그린다.
      */}
      {gateAt !== null && selected !== null && confirmedNo !== null && (
        <PrecheckGate
          workOrderId={selected.workOrderId}
          workOrderNo={selected.workOrderNo}
          workOrderTypeCode={selected.workOrderTypeCode}
          equipmentId={equipmentId}
          equipmentCode={equipmentCode}
          equipmentName={equipmentName}
          plantId={terminal.data?.plantId ?? null}
          processId={soleProcessIdOf(identity.processes)}
          workerNo={confirmedNo}
          decidedAt={gateAt}
          /* 단말 시각의 «날짜»다 — 주기 창이 이 값을 기준으로 열린다. */
          today={gateAt.slice(0, 10)}
          isOnline={isOnline}
          onCleared={startSession}
          onCancel={() => {
            setGateAt(null);
          }}
        />
      )}
    </main>
  );
};

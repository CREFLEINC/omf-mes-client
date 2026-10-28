import { AlertBanner, Button } from '@crefle/web-ui';
import { messages, named } from '@omf-mes/i18n';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { useApiClient } from '../../patterns/api-context';

import { PopHeader } from '../../patterns/pop-header';
import { soleProcessIdOf, usePopIdentity } from '../../patterns/pop-identity';
import { PrecheckGate } from '../work-precheck-gate/gate';
import { setWorkerSession, useWorkerSession } from '../../patterns/worker-session';
import { ActionBar } from './action-bar';
import { CrewPanel, type CrewMember } from './crew-panel';
import { useIsOnline } from './connection';
import { useStartGate } from './gating';
import {
  useJoinSession,
  useLeaveSession,
  useResumeWork,
  useStartWork,
  toResumeBody,
} from './mutations';
import { plannedEquipmentText } from './row-view';
import { isOrderQtyFulfilled } from './quantity-fulfilled';
import { SelectionCard } from './selection-card';
import {
  fetchWorkersByNo,
  useOpenSession,
  useSessionWorkers,
  useTerminal,
  useUomCodes,
  useEquipmentChoices,
  useWorkOrders,
  useWorkerLookup,
} from './queries';
import { POP_TOUCH_SIZE } from './touch-spec';
import { toSessionRequest } from './session-request';
import { assignedAtText, terminalNow } from './terminal-clock';
import type { ControlOverride, WorkOrder, Worker } from './types';
import { WorkOrderList, type ListScope } from './work-order-list';
import { isHeld } from './work-order-status';
import { WorkerPanel } from './worker-panel';
import { verifyWorker } from './worker-verify';

/**
 * `P-02-01` 작업 시작(작업지시 선택).
 *
 * 유형: T-P-S 단독형의 틀(머리줄, 본문 좌우 2단, 하단 동작 바). W/O 를 정하는 앞 단계 화면이라
 *       POP 질문표가 유형을 정하지 않는다. 왼쪽 작업지시 목록, 오른쪽 작업 확인(작업자, 선택한
 *       작업지시, 다른 작업), 하단 바 「남은 일」과 주 동작 하나.
 * 이탈: C-3 주 동작 이름이 W/O 상태에 따라 [작업 시작], [재개], [작업 이어하기]로 바뀐다(경로가
 *       다른 세 동작이라 한 이름으로 둘 수 없다). C-11 머리줄을 화면이 조립한다(셸 공용 머리줄은
 *       POP 화면 전체 작업, omf-all-around#169). C-10 품목명과 금형은 계약에 없어 보이지 않는다
 *       (C-15 계약 대기).
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

  const terminal = useTerminal(identity.terminalId);

  const equipmentId = terminal.data?.equipmentId ?? null;
  const equipmentCode = terminal.data?.equipmentCode ?? null;
  const equipmentName = terminal.data?.equipmentName ?? null;
  /*
   * ⭐ **설비가 매핑되지 않은 단말.** 조회가 실패해 «모르는» 것과 가른다 — 서버가 답했고 그 답이
   *    「설비 없음」이다. 이 단말은 설비 축 없이 목록을 받는다(서버가 단말의 공정으로 거른다).
   */
  const isEquipmentMissing = terminal.isSuccess && equipmentId === null;

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

  /** 눌렀을 때만 조회한다 — 치는 동안 매 글자마다 물으면 아직 다 치지도 않은 사번으로 「없다」가 뜬다. */
  const [submittedNo, setSubmittedNo] = useState<string | null>(null);
  const lookup = useWorkerLookup(submittedNo);
  /** 사번 입력 창. [사번 입력]을 누르거나, 사번 없이 W/O 를 고르면 열린다. */
  const [isWorkerDialogOpen, setWorkerDialogOpen] = useState(false);

  /* 사번이 정해지면 창을 닫힌 상태로 돌린다. 작업자 묶음이 사번 입력 묶음을 대신한다. */
  useEffect(() => {
    if (confirmedNo !== null) setWorkerDialogOpen(false);
  }, [confirmedNo]);

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

  /* 목록의 설비 범위. 화면을 열면 단말 설비(기본)다(PG-37). */
  const [scope, setScope] = useState<ListScope>('default');
  /* 설비 팝업을 한 번이라도 열었는가. 다른 설비 목록은 그때 처음 묻는다. */
  const [isPickerOpened, setPickerOpened] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);

  const listEquipmentId = scope === 'default' ? equipmentId : scope === 'all' ? null : scope;
  /*
   * ⚠ 설비를 모르는 채로 기본 목록을 열지 않는다 — 축 없이 물으면 「이 설비 배포분」이라고
   *    그린 화면에 다른 설비의 지시가 실린다. 그 상태는 목록 구획이 사유와 함께 말한다.
   */
  const isListAsked = scope !== 'default' || equipmentId !== null || isEquipmentMissing;
  /* 쪽 번호. 축(설비·전체 보기)이 바뀌면 첫 쪽으로 되돌린다 — 아래 전환 자리에서 함께 맞춘다. */
  const [listPage, setListPage] = useState(1);
  /* 설비를 정하지 않은 지시는 단말 설비 목록에만 함께 받는다(PG-38). */
  const list = useWorkOrders(listEquipmentId, isListAsked, listPage, scope === 'default');
  const equipments = useEquipmentChoices(terminal.data?.plantId ?? null, isPickerOpened);
  const otherEquipments = (equipments.data ?? []).filter(
    (equipment) => equipment.equipmentId !== equipmentId,
  );

  const rows = list.data?.items;
  /*
   * 고른 것을 «지금 목록에서» 다시 찾는다 — 줄을 복사해 들고 있으면 새로고침 뒤 사라진 W/O 로
   * 세션을 열게 된다.
   */
  const selected = (rows ?? []).find((row) => row.workOrderId === selectedId) ?? null;
  const isResume = selected !== null && isHeld(selected);

  /*
   * ⭐ 시작할 수 있는지는 «고른 W/O 의 공정»으로 판정한다 — 단말에 공정이 여럿이어도 W/O 가 어느
   *    공정의 일인지 안다. 공정을 싣지 않는 서버면 단말의 유일한 공정으로 판정한다.
   */
  const gateProcessId = selected?.processId ?? soleProcessIdOf(identity.processes);
  const gate = useStartGate(identity.terminalId, gateProcessId);

  /*
   * ⭐ **고른 지시의 «열린» 세션을 늘 확인한다** — 재개할 세션을 찾기 위해서만이 아니다.
   *    §6 이 「이미 진행 중인 세션이 있으면 새 시작 불가」라고 정했는데, 그 사실을 화면이
   *    아는 길이 이 조회다. ⛔ 서버의 409 를 기다려 말하지 않는다 — 계약이 그 응답을
   *    「충돌」로만 적어 두어, 409 를 「진행 중」으로 읽으면 뜻을 지어내는 것이 된다.
   */
  const openSession = useOpenSession(selected?.workOrderId ?? null, selected !== null);

  /*
   * 함께 일하는 작업자. 열린 세션을 고른 동안은 그 세션의 지금 참여자를 넣고 빼고(즉시 반영),
   * 그 밖에서는 시작할 때 함께 보낼 부 작업자를 모은다.
   */
  const { client } = useApiClient();
  const crewSessionId = selected === null ? null : (openSession.data?.workSessionId ?? null);
  const sessionCrew = useSessionWorkers(crewSessionId);
  const [pendingCrew, setPendingCrew] = useState<Worker[]>([]);
  const joinCrew = useJoinSession({
    workSessionId: crewSessionId,
    workerNo: confirmedNo ?? '',
    onSuccess: () => undefined,
  });
  const leaveCrew = useLeaveSession({
    workSessionId: crewSessionId,
    workerNo: confirmedNo ?? '',
    onSuccess: () => undefined,
  });
  const mainWorker = verified?.kind === 'ok' ? verified.worker : (workerSession?.worker ?? null);
  const mainWorkerName = mainWorker?.workerName ?? null;
  const mainWorkerId = mainWorker?.workerId ?? 0;
  const crew: CrewMember[] =
    crewSessionId === null
      ? [
          ...(confirmedNo === null
            ? []
            : [
                {
                  key: 'main',
                  workerId: mainWorkerId,
                  workerNo: confirmedNo,
                  workerName: mainWorkerName,
                  role: 'MAIN' as const,
                  workSessionWorkerId: null,
                },
              ]),
          ...pendingCrew.map((worker) => ({
            key: `pending-${String(worker.workerId)}`,
            workerId: worker.workerId,
            workerNo: worker.workerNo,
            workerName: worker.workerName,
            role: 'SUB' as const,
            workSessionWorkerId: null,
          })),
        ]
      : (sessionCrew.data ?? []).map((member) => ({
          key: `session-${String(member.workSessionWorkerId)}`,
          workerId: member.workerId,
          workerNo: member.workerNo ?? null,
          workerName: member.workerName ?? null,
          /* 옛 행의 `OPERATOR` 는 부다 — 정은 `MAIN` 하나뿐이다. */
          role: member.workerRoleCode === 'MAIN' ? ('MAIN' as const) : ('SUB' as const),
          workSessionWorkerId: member.workSessionWorkerId,
        }));
  const crewWriteError = joinCrew.error ?? leaveCrew.error;

  /* 다른 세션으로 옮기면 앞 세션의 실패를 남기지 않는다. */
  useEffect(() => {
    joinCrew.reset();
    leaveCrew.reset();
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- 쓰기 객체는 렌더마다 새로 생긴다. */
  }, [crewSessionId]);

  /* 실패하면 지금 참여자를 다시 받는다 — 남이 먼저 바꿨을 수 있다. */
  useEffect(() => {
    if (crewWriteError !== null) void sessionCrew.refetch();
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- 조회 객체는 렌더마다 새로 생긴다. */
  }, [crewWriteError]);
  const crewError =
    crewSessionId !== null && sessionCrew.isError
      ? t.coWorkers.loadFailed
      : crewWriteError === null
        ? null
        : crewWriteError.kind === 'validation' || crewWriteError.kind === 'stateLocked'
          ? (crewWriteError.errors[0]?.message ?? t.coWorkers.failed)
          : t.coWorkers.failed;

  const addCrew = async (workerNo: string): Promise<string | null> => {
    if (crew.some((member) => member.workerNo === workerNo)) return t.coWorkers.duplicate;

    let found: Worker[];
    try {
      found = await fetchWorkersByNo(client, workerNo);
    } catch {
      return t.worker.lookupFailed;
    }

    const result = verifyWorker(found, workerNo, homePlantId);
    if (result.kind === 'unknown') return t.worker.unknown;
    if (result.kind === 'inactive') return t.worker.inactive;
    /* 서버가 단말 공장의 작업자만 받는다 — 보내기 전에 막는다. */
    if (result.isOtherPlant) return t.coWorkers.otherPlant;
    if (crew.some((member) => member.workerId === result.worker.workerId)) {
      return t.coWorkers.duplicate;
    }

    if (crewSessionId === null) {
      setPendingCrew((current) => [...current, result.worker]);
    } else {
      leaveCrew.reset();
      joinCrew.write({ workerId: result.worker.workerId, joinedAt: terminalNow(new Date()) });
    }

    return null;
  };

  const removeCrew = (member: CrewMember) => {
    if (member.workSessionWorkerId === null) {
      setPendingCrew((current) => current.filter((worker) => worker.workerId !== member.workerId));
      return;
    }

    joinCrew.reset();
    leaveCrew.write({
      workSessionWorkerId: member.workSessionWorkerId,
      leftAt: terminalNow(new Date()),
    });
  };

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

  /*
   * 설비 범위를 바꾼 뒤(설비 칸, [기본 설비로]) 새 목록이 오면, 고른 W/O 가 그 목록에 있을 때만
   * 고른 채로 둔다. 없으면 놓는다. 화면에 없는 카드가 오른쪽에 남아 있지 않게 하고, 하단 바가
   * 「작업지시를 고르세요」로 돌아간다(사용자 결정 2026-10-26, PG-30).
   */
  const scopeCheckRef = useRef(false);
  useEffect(() => {
    if (!scopeCheckRef.current || rows === undefined) return;

    scopeCheckRef.current = false;
    if (selectedId !== null && !rows.some((row) => row.workOrderId === selectedId)) {
      submitAtRef.current = null;
      setSelectedId(null);
    }
  }, [rows, selectedId]);

  /**
   * 지금 시작을 시도하고 있는 것 — **누른 순간의 작업지시와 시각을 통째로 붙든다.**
   *
   * ⭐ **시각을 상태로 든다.** 게이트가 판정 기록에 싣는 값이라, 다시 그리는 사이에 바뀌면
   * 같은 시도가 두 판정으로 남는다.
   *
   * ⛔ **고른 줄을 다시 찾아 쓰지 않는다**(#1148). `selected` 는 «지금 목록»에서 매번 다시
   *    찾는 값이라, 판정이 오가는 사이 목록이 새로 오면서 그 줄이 빠지면 **`null` 이 된다** —
   *    그러면 게이트가 사라져 판정 기록의 성공 처리기가 아예 불리지 않고(호출별 콜백은 부품이
   *    사라지면 버려진다), 세션 쓰기는 나가지 않은 채 화면은 아무 말도 하지 않는다. 판정만
   *    서버에 남는 자리가 이것이다. 시도를 붙들어 두면 목록이 어떻게 바뀌든 사슬이 끝까지 간다.
   */
  const [attempt, setAttempt] = useState<{ at: string; workOrder: WorkOrder } | null>(null);

  /**
   * 사슬이 끊겼는데 서버가 거절한 것도 아닌 자리 — **말없이 끝내지 않기 위한 한 칸**이다.
   */
  const [chainError, setChainError] = useState<string | null>(null);

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
      setPendingCrew([]);
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
   * 시작과 재개를 막는 사유. 순서가 뜻이다. 단말이 못 하는 일이면 사번을 아무리 잘 넣어도
   * 열리지 않으므로 그 사실을 먼저 말한다.
   *
   * 사유는 하단 바 「남은 일」 자리의 문장이 말한다(C-4). 머리말은 붙이지 않는다(사용자 결정 2026-10-23).
   * 사유를 코드와 함께 낸다. 문구가 같은지로 갈래를 판정하지 않는다.
   */
  const block = ((): {
    code: 'notSelected' | 'alreadyOpen' | 'workerMissing' | 'other';
    text: string;
  } | null => {
    const other = (text: string) => ({ code: 'other' as const, text });

    /* 사유별로 가른다(사용자 지시 2026-09-13). 매핑이 비어 있는 것은 등록 실패가 아니다. */
    if (gate.verdict === 'unidentified') {
      if (identity.terminalId === null || identity.processes === null) {
        return other(t.blocked.unidentified);
      }
      if (identity.processes.length === 0) return other(t.blocked.processNone);
      /*
       * 공정이 여럿인 단말은 W/O 를 고르기 전에는 판정할 공정이 없다. 막지 않고 고르게 둔다.
       * 고른 W/O 가 공정을 싣지 않는 서버에서만 여기서 막힌다.
       */
      if (selected !== null) return other(t.blocked.processMultiple);
    }
    if (gate.verdict === 'checking') return other(t.blocked.checking);
    if (gate.verdict === 'unavailable') return other(t.blocked.unavailable);
    if (gate.verdict === 'denied') {
      return other(
        selected?.processName === undefined
          ? t.blocked.denied
          : t.blocked.deniedProcess(selected.processName),
      );
    }
    /* 오프라인은 큐가 아니라 거부다. */
    if (!isOnline) return other(t.blocked.offline);
    if (confirmedNo === null) return { code: 'workerMissing', text: t.remaining.worker };
    if (selected === null) return { code: 'notSelected', text: t.remaining.select };

    if (openSession.isError) return other(t.resume.sessionLookupFailed);
    if (openSession.isPending) return other(t.resume.checking);

    if (isResume) {
      /* 열린 세션이 없으면 재개하지 않는다. 새로 열면 중단 구간이 사라진다. */
      if (openSession.data === null) return other(t.resume.sessionNotFound);
    } else if (openSession.data !== null) {
      /*
       * 세션이 이미 열려 있으면 새로 열지 않는다(§6). 이어갈 길은 하단 바 주 동작
       * [작업 이어하기]가 준다(#1148).
       */
      return { code: 'alreadyOpen', text: t.remaining.continue };
    }

    return null;
  })();

  /**
   * 지시 수량을 이미 채운 지시를 골랐는가 — **남은 일이 「마감」이라고 알린다**
   * (omf-all-around#45).
   *
   * ⛔ **막지 않는다.** 초과 생산·재작업으로 더 돌릴 수 있고 화면이 그것을 막을 근거가 없다 —
   *    `block` 에 넣지 않는 이유가 이것이다. [작업 시작]·[이어서 하기]는 그대로 선다.
   *
   * ⭐ **진행 중인 작업이 있으면 다른 문장이다**(사용자 확정 2026-09-21). 그 문장이 「진행
   *    중」까지 함께 말하므로 진행 중 안내(`remaining.continue`)를 겹쳐 세우지 않는다.
   */
  const closeNotice = ((): string | null => {
    if (selected === null || !isOrderQtyFulfilled(selected)) return null;

    /* ⚠ 아직 답을 못 받은 사이(`undefined`)에는 진행 중이라고 말하지 않는다 — 모르는 것이다. */
    return openSession.data != null ? t.closing.fulfilledWithOpenSession : t.closing.fulfilled;
  })();

  const retryLabel = gate.verdict === 'unavailable' ? t.blocked.retry : null;

  const writeError = isResume ? resumeWork.error : startWork.error;

  /**
   * 서버가 「지금 보고 있는 것이 사실과 다르다」고 답했는가.
   *
   * ⛔ **상태 코드 하나로 판정하지 않는다.** 4xx 가 계약 오류 봉투로 오면 정규화가 그것을
   * `conflict` 로 접으면서 상태 코드를 버린다 — 한쪽만 보면 실서버에서 갈래가 죽는다.
   */
  const isConflict = (error: NonNullable<typeof writeError>): boolean =>
    error.kind === 'conflict' || (error.kind === 'http' && error.status === 409);

  /**
   * ⭐ **어긋났으면 화면이 스스로 다시 묻는다**(#1148). 문구가 「목록을 새로 불러옵니다」라고
   *    적었으면 실제로 불러와야 한다 — 이 저장소는 자동 재조회를 꺼 두었으므로(`providers`)
   *    여기서 부르지 않으면 작업자가 단말을 새로 켤 때까지 옛 목록이 그대로 선다.
   *
   * ⚠ **같은 실패로 두 번 부르지 않는다** — 실패 객체를 기억해 두고 새것일 때만 움직인다.
   */
  const refetchedForRef = useRef<unknown>(null);

  useEffect(() => {
    if (writeError === null || refetchedForRef.current === writeError) return;
    if (!isConflict(writeError)) return;

    refetchedForRef.current = writeError;
    void list.refetch();
    void openSession.refetch();
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- 조회 객체는 렌더마다 새로 생긴다. */
  }, [writeError]);

  /**
   * 이 시작이 쓰는 설비. 설비가 없는 단말은 고른 W/O 의 계획 설비를 쓴다 — 점검한 설비와 실적이
   * 남는 설비가 같아야 해서 점검 판정 기록과 세션 본문이 같은 값을 싣는다.
   */
  const workEquipmentIdOf = (workOrder: WorkOrder): number | null =>
    equipmentId ?? workOrder.plannedEquipmentId ?? null;

  const writeSession = (target: WorkOrder, at: string, override: ControlOverride | null) => {
    startWork.write(
      toSessionRequest({
        workOrder: target,
        equipmentId: workEquipmentIdOf(target),
        startedAt: at,
        controlOverride: override,
        coWorkerIds: pendingCrew.map((worker) => worker.workerId),
      }),
    );
  };

  const submit = () => {
    if (selected === null || confirmedNo === null) return;

    setOutcome(null);
    setChainError(null);

    /* 붙들고 있던 시각이 있으면 그대로 쓴다 — 같은 시도의 재시도이기 때문이다. */
    submitAtRef.current ??= terminalNow(new Date());
    const at = submitAtRef.current;

    if (isResume) {
      resumeWork.write(toResumeBody(at));

      return;
    }

    /* 단말에도 W/O 에도 설비가 없으면 점검할 설비가 없다 — 게이트 없이 바로 연다. */
    if (workEquipmentIdOf(selected) === null) {
      writeSession(selected, at, null);

      return;
    }

    /*
     * ⛔ **여기서 세션을 열지 않는다.** 작업 시작은 점검 통제 게이트를 지나야 한다(`P-02-02`
     *    §5-5). 게이트가 통과·경고 진행·우회 중 하나로 판정을 «기록한 뒤» 열어 주고, 그때
     *    아래 `startSession` 이 부른다.
     */
    setAttempt({ at, workOrder: selected });
  };

  /**
   * 게이트가 열어 준 뒤에 세션을 연다. 우회면 그 사실이 본문에 함께 실린다.
   *
   * ⚠ 게이트가 붙들고 있던 시각을 그대로 쓴다 — 판정과 세션이 같은 시도임을 시각이 말한다.
   */
  const startSession = (override: ControlOverride | null) => {
    const target = attempt?.workOrder ?? null;

    setAttempt(null);

    /*
     * ⛔ **조용히 돌아가지 않는다**(#1148). 여기까지 왔다는 것은 판정이 **이미 서버에
     *    남았다**는 뜻이라, 아무 말 없이 끝내면 작업자는 아무 일도 없었다고 읽고 계속 누른다 —
     *    누를 때마다 판정만 한 줄씩 는다.
     */
    if (target === null) {
      setChainError(t.result.notOpened);

      return;
    }

    writeSession(target, attempt?.at ?? submitAtRef.current ?? terminalNow(new Date()), override);
  };

  /**
   * 고른 것을 «비운다» — 시각·판정·결과 문구까지 함께 버린다.
   *
   * ⛔ `setSelectedId(null)` 만 하지 않는다. 붙들고 있던 시각(`submitAtRef`)은 멱등 키의
   * 지문이라 다음 선택으로 새어 가면 «다른 지시의 시작»이 같은 쓰기로 나간다.
   */
  const clearSelection = () => {
    submitAtRef.current = null;
    setAttempt(null);
    setChainError(null);
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
    setAttempt(null);
    setChainError(null);
    setOutcome(null);
    setSelectedId(workOrder.workOrderId);

    /*
     * 사번이 없으면 고른 채로 사번 입력 창을 바로 연다(사용자 결정 2026-10-23, PG-27). 누른 것을
     * 무시하면 고장 난 것처럼 보인다. 확인하면 고른 W/O 그대로 주 동작이 열린다.
     */
    if (confirmedNo === null) setWorkerDialogOpen(true);
  };

  /**
   * 연결됐다고 말할 수 있는가. ⛔ **아직 답을 못 받았으면 `undefined`(모른다)다** — 셋을
   * 삼항 두 겹으로 겹쳐 쓰면 「모른다」가 「끊겼다」로 읽히기 쉬운 자리라 따로 세운다.
   */
  const connectionVerdict = list.isError ? false : list.isSuccess ? true : undefined;

  const isContinue = block?.code === 'alreadyOpen' && selected !== null;

  /**
   * 하단 바 「남은 일」 한 줄. 막힘 사유가 먼저다. 지시 수량을 채운 지시의 마감 안내는 막지 않는
   * 안내라 그다음이고, 「진행 중」까지 함께 말하므로 진행 중 안내를 겹쳐 세우지 않는다
   * (사용자 확정 2026-09-21, omf-all-around#45).
   */
  const remaining: { text: string } =
    block !== null && block.code !== 'alreadyOpen'
      ? block
      : closeNotice !== null
        ? { text: closeNotice }
        : (block ?? { text: isResume ? t.remaining.resume : t.remaining.ready });

  /* 설비 없는 단말은 이 시작이 쓸 W/O 의 설비를 보인다. 그것도 없으면 「설비 미지정」. */
  const selectionEquipmentText =
    isEquipmentMissing && selected !== null
      ? plannedEquipmentText(selected)
      : equipmentCode === null || equipmentCode.trim() === ''
        ? null
        : named(equipmentName, equipmentCode);

  return (
    <main className="pop-shell pop-ui work-start-screen" aria-labelledby={titleId}>
      <PopHeader
        titleId={titleId}
        title={t.title}
        terminalCode={terminal.data?.terminalCode ?? null}
        equipmentCode={equipmentCode}
        equipmentName={equipmentName}
        workerNo={confirmedNo}
        workerName={mainWorkerName}
        /*
         * 연결 여부는 마지막 조회가 서버에 닿았는가로 말한다. 브라우저의 온라인 표시는 산업용
         * 패널 PC 에서 사실과 다르다. 아직 답을 못 받았으면 모르는 것으로 둔다.
         */
        isConnected={connectionVerdict}
      />

      {/* 본문 좌우 2단(T-P-S). 왼쪽 대상 목록, 오른쪽 확인. 고른 결과를 목록 아래에 쌓지 않는다(C-2). */}
      <div className="pop-panes work-start-panes">
        <WorkOrderList
          uomCodeOf={uomCodeOf}
          workOrders={rows}
          isAsked={isListAsked}
          isLoading={isListAsked && list.isPending}
          isError={list.isError}
          total={list.data?.page.total}
          pageMeta={list.data?.page}
          onPageChange={(page) => {
            /* 쪽을 넘기면 고른 것을 놓는다. 다른 쪽의 지시를 고른 채로 두면 화면과 어긋난다. */
            setSelectedId(null);
            submitAtRef.current = null;
            setListPage(page);
          }}
          scope={scope}
          equipmentName={equipmentName?.trim() || equipmentCode?.trim() || null}
          equipmentText={
            equipmentCode === null || equipmentCode.trim() === ''
              ? null
              : named(equipmentName, equipmentCode)
          }
          otherEquipments={otherEquipments}
          onEquipmentPickerOpen={() => {
            setPickerOpened(true);
          }}
          isEquipmentMissing={isEquipmentMissing}
          isEquipmentUnknown={equipmentId === null && !isEquipmentMissing}
          selectedId={selectedId}
          onSelect={selectWorkOrder}
          onScopeChange={(next) => {
            if (next === scope) return;
            /* 고른 것은 새 목록에 있으면 남긴다. 새 목록이 오면 위 확인이 정한다(PG-30). */
            scopeCheckRef.current = true;
            /* 축이 바뀌면 첫 쪽으로. 3쪽을 보던 중 전체 설비로 옮기면 빈 쪽이 뜬다. */
            setListPage(1);
            setScope(next);
          }}
          onRetry={() => {
            void list.refetch();
          }}
        />

        <section className="pane work-start-side" aria-label={t.side.title}>
          <h2 className="pane-title">{t.side.title}</h2>

          {/* 결과와 오류는 구획 맨 위 전체 폭에 둔다(C-19 안내 상자). */}
          {outcome !== null && (
            <div className="banner-slot">
              <AlertBanner variant="success">{outcome}</AlertBanner>
            </div>
          )}

          {chainError !== null && (
            <div className="banner-slot">
              <AlertBanner variant="error">{chainError}</AlertBanner>
            </div>
          )}

          {writeError !== null && (
            <div className="banner-slot">
              <AlertBanner variant="error">
                {isConflict(writeError)
                  ? t.result.conflict
                  : isResume
                    ? t.result.resumeFailed
                    : t.result.startFailed}
              </AlertBanner>
            </div>
          )}

          {/*
           * 사번을 이미 아는 자리에서는 사번 입력을 세우지 않는다(사용자 지시 2026-09-08). 사번 경량
           * 인증(P-CO-01)이 정해 오므로 다시 묻지 않는다. 못 받았을 때만 사번 입력 창을 여는 버튼을 세운다.
           */}
          {confirmedNo === null ? (
            <WorkerPanel
              isOpen={isWorkerDialogOpen}
              onOpenChange={setWorkerDialogOpen}
              onSubmit={setSubmittedNo}
              onDiscard={() => {
                setSubmittedNo(null);
              }}
              onRetry={() => {
                void lookup.refetch();
              }}
              isChecking={submittedNo !== null && confirmedNo === null && lookup.isFetching}
              error={workerError}
            />
          ) : (
            <CrewPanel
              members={crew}
              disabled={!isOnline || joinCrew.isSaving || leaveCrew.isSaving}
              error={crewError}
              onAdd={addCrew}
              onRemove={removeCrew}
            />
          )}

          <SelectionCard
            workOrder={selected}
            equipmentId={equipmentId}
            equipmentText={selectionEquipmentText}
            isEquipmentUnassigned={
              isEquipmentMissing && selected !== null && selected.plannedEquipmentId == null
            }
            uomCodeOf={uomCodeOf}
          />
        </section>
      </div>

      <ActionBar
        mode={isContinue ? 'continue' : isResume ? 'resume' : 'start'}
        remaining={remaining.text}
        isBlocked={block !== null && !isContinue}
        /*
         * 판정을 기록하는 동안도 「시작 중」이다(#1148). 통과 판정이면 게이트가 아무것도 그리지
         * 않으므로, 이 사이에 표시가 없으면 화면이 멎은 것처럼 보인다.
         */
        isSaving={isResume ? resumeWork.isSaving : startWork.isSaving || attempt !== null}
        onSubmit={() => {
          /* 진행 중인 작업은 쓰기 없이 자재 투입으로 자리만 옮긴다. 재개(`RESUME` 적재)가 아니다. */
          if (isContinue) {
            goToMaterialInput(selected.workOrderId);

            return;
          }

          submit();
        }}
        leading={
          retryLabel === null ? undefined : (
            <Button type="button" variant="outlined" size={POP_TOUCH_SIZE} onClick={gate.retry}>
              {retryLabel}
            </Button>
          )
        }
      />

      {/*
        점검 통제 게이트 — ⭐ **막을 때만 보인다**(`P-02-02` §9-3). 통과면 아무것도 그리지
        않고 판정만 남긴 뒤 세션을 연다. 이 화면 위에 덮이므로 여기서 마지막에 그린다.
      */}
      {attempt !== null && confirmedNo !== null && (
        <PrecheckGate
          workOrderId={attempt.workOrder.workOrderId}
          workOrderNo={attempt.workOrder.workOrderNo}
          workOrderTypeCode={attempt.workOrder.workOrderTypeCode}
          equipmentId={workEquipmentIdOf(attempt.workOrder)}
          /* 단말에 설비가 없으면 W/O 의 설비로 점검한다 — 머리글·이력도 그 설비로 보인다. */
          equipmentCode={
            equipmentId === null ? (attempt.workOrder.plannedEquipmentCode ?? null) : equipmentCode
          }
          equipmentName={
            equipmentId === null ? (attempt.workOrder.plannedEquipmentName ?? null) : equipmentName
          }
          plantId={terminal.data?.plantId ?? null}
          processId={attempt.workOrder.processId ?? soleProcessIdOf(identity.processes)}
          workerNo={confirmedNo}
          decidedAt={attempt.at}
          /* 단말 시각의 «날짜»다 — 주기 창이 이 값을 기준으로 열린다. */
          today={attempt.at.slice(0, 10)}
          isOnline={isOnline}
          onCleared={startSession}
          onCancel={() => {
            setAttempt(null);
          }}
        />
      )}
    </main>
  );
};

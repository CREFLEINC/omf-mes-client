import { Breadcrumb, Button, Dialog, EmptyState, Icon, PageHeader, Tabs } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useOaAccess } from '../../patterns/oa-access';
import { toApiError } from '../../patterns/request';
import { usePageHub } from '../../patterns/page-hub';
import {
  InspectionHubCounts,
  type InspectionHubStatus,
} from '../../patterns/inspection-hub-counts';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import {
  PaneHeightSplitter,
  SplitOrientationToggle,
  useSplitOrientation,
} from '../../patterns/split-orientation';
import { CODE_GROUPS, labelOfCode, toCodeOptions } from './code-options';
import {
  EMPTY_FILTERS,
  QUEUE_STATUSES,
  withDraft,
  withStatus,
  readFilters,
  readPage,
  readSelectedId,
  toListQuery,
  toPageParams,
  toSearchParams,
  URL_KEYS,
  type QueueFilters,
} from './filters';
import { QueueLoadErrorBanner } from './load-error-banner';
import { PageNav } from './page-nav';
import { toPageView } from './pagination';
import { EMPTY_QUANTITY_DRAFT, toSendableNumber, type QuantityDraft } from './quantity-draft';
import { expectedJudgmentOf, needsJudgmentChangeReason } from './judgment-change';
import {
  useAcceptanceNumber,
  useCodeValues,
  useInspectionQueue,
  useInspectionRequestDetail,
  useInspectionRounds,
  useOqcSerialRecords,
  usePickedLotNumbers,
  useSaveInspectionResult,
} from './queries';
import { QueueFilterBar } from './queue-filter-bar';
import { QueueListTable } from './queue-list-table';
import { RequestDetailPane } from './request-detail-pane';
import { ResultFormPane } from './result-form-pane';
import { RoundHistory } from './round-history';
import { SerialJudgments } from './serial-judgments';
import { SerialOpenByScan } from './serial-open-by-scan';
import { SerialRecords } from './serial-records';
import {
  checkScannedSerial,
  serialBlockedReason,
  toSerialInputs,
  toSerialRow,
  type SerialRow,
} from './serials';
import { SkipPane } from './skip-pane';
import { InspectionHistoryPanel, useInspectionHistory } from '../inspection-history/panel';
import { latestRound } from './types';
import { useItemNames, useLotNumbers } from './reference-lookup';
import { useUomLookup } from './uom-lookup';
import { targetSignatureOf, type WriteTargetSignature } from './write-target';

/**
 * W-04-03 OQC 출하검사 판정.
 *
 * 목록과 상세(판정)를 나란히 두지 않고 갈아 끼운다(omf-all-around#136 · IQC #133 과 같은 짜임) — 의뢰를 고르면
 * (`?ir=`) 대상 정보·판정 입력만 서고, 「← 목록」으로 돌아오면 목록만 선다. 회차 이력 · 시리얼 기록 · 검사 이력은
 * 판정 아래 접는 구획이다.
 *
 * **주소가 조건의 정본이다.** 조건·쪽·고른 의뢰가 전부 주소에 산다 — 새로고침·뒤로가기·공유가
 * 같은 결과를 내야 하기 때문이다. 읽고 쓰는 규칙은 `filters.ts` 가 소유한다.
 *
 * ⭐ **저장이 한 번이고 되돌릴 수 없다.** 임시 저장을 두지 않으므로 이 화면에는 「완충 구간」이
 * 없다 — 그래서 **편집 초안과 서버 조회가 언제 만나는가**가 이 화면의 중심축이다. 아래 규칙 넷이
 * 그 자리를 지킨다(§9 R1~R4).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.oqcInspection;
const hubText = messages.common.inspectionHub;
/** 불합격 판정 코드 — 불합격 사유(선택) 칸을 세우고 비고로 싣는 기준(#136 · `judgment-direction.ts` 와 같은 값). */
const REJECTED = 'REJECTED';
const referenceT = messages.common.reference;

export const OqcInspectionScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  /* 검사 조회·판정 묶음(사이드바 한 줄 · 제목 아래 탭) 안이면 셸이 준다 — 셸 밖이면 `null`. */
  const hub = usePageHub();

  const filters = readFilters(searchParams);
  const page = readPage(searchParams);
  const selectedId = readSelectedId(searchParams);

  const queue = useInspectionQueue(toListQuery(filters, page));
  const detail = useInspectionRequestDetail(selectedId);
  const rounds = useInspectionRounds(selectedId);

  const round = latestRound(rounds.data ?? []);

  /**
   * 확정된 회차에서 **재검사 회차를 쓰는 중**인가.
   *
   * ⭐ **회차를 먼저 만들지 않는다.** 누르면 칸이 열릴 뿐이고 회차는 저장이 만든다 — 먼저
   * 만들면 열어 보고 그만둔 사람마다 빈 회차가 쌓인다.
   */
  const [isReinspecting, setIsReinspecting] = useState(false);

  /**
   * 재검사가 가리키는 **앞 회차**. 재검사 중이 아니면 `null`.
   *
   * ⭐ **지금 화면에 있는 회차로 매번 다시 판정한다** — 눌렀을 때의 식별자를 따로 들고 있지
   * 않는다. 들고 있으면 그 값이 화면의 회차와 어긋나는 상태가 생기고, 어느 쪽이 옳은지 정할
   * 근거가 코드 어디에도 없다.
   */
  const previousResultId = isReinspecting ? (round?.inspectionResultId ?? null) : null;
  const isReinspectingNow = previousResultId !== null;

  /** 방금 저장했는가. **상태가 아니라 결과다** — 고른 의뢰가 바뀌면 지워진다. */
  const [isJustSaved, setIsJustSaved] = useState(false);

  /**
   * 수량 초안. **고른 의뢰가 바뀌면 그 회차의 값으로 되돌아간다.**
   *
   * ⭐ **R1 — 되돌림을 참조가 아니라 값으로 판정한다.** 조회 응답이 다시 그려질 때마다 참조가
   * 달라지므로, 참조로 판정하면 그때마다 사용자가 치던 값이 사라진다(§9 D1).
   *
   * ⛔ **0을 미리 채우지 않는다** — 채우면 「검사자가 0으로 판정했다」와 「아직 아무것도 넣지
   * 않았다」가 화면에서 같아 보인다.
   */
  const [draft, setDraft] = useState<QuantityDraft>(EMPTY_QUANTITY_DRAFT);

  /**
   * 종합 판정 — ⛔ **값 목록을 화면에 고정하지 않는다.** 그룹을 «이름»으로 부른다:
   * `codeGroupId` 정수는 환경마다 다르므로 코드에 박지 않는다(omf-mes#179 회신).
   */
  const judgmentValues = useCodeValues(CODE_GROUPS.overallJudgment);
  const judgmentOptions = toCodeOptions(judgmentValues.data ?? []);
  /* 판정 코드가 하나도 없으면 저장할 길이 없다 — 입력 칸도 잠근다(#135). 읽는 중에는 잠그지 않는다. */
  const isInputLocked = judgmentValues.isSuccess && judgmentOptions.length === 0;

  const [judgment, setJudgment] = useState('');

  /*
   * 판정 변경 사유(omf-all-around#126) — 확정 저장에만 싣는다. 의뢰·회차가 바뀌거나 재검사를 열고 닫으면 비운다.
   */
  const [changeReason, setChangeReason] = useState('');
  /** 불합격 사유(선택 · #136) — 불합격을 골랐을 때만 칸이 서고, 저장에는 비고로 실린다. */
  const [rejectionReason, setRejectionReason] = useState('');

  /*
   * 검사한 시리얼(omf-all-around#68) — 그 의뢰에 매인다. 다른 의뢰를 고르면 보이지 않고, 시리얼로 연 의뢰는 그 시리얼을 첫 줄로 받는다.
   * 저장에 성공하거나 재검사를 열고 닫으면 비운다.
   */
  /** 목록에서 마지막으로 스캔한 시리얼과 그 LOT 을 피킹한 의뢰들 — 목록의 시리얼 번호 칸(#136). */
  const [scannedSerial, setScannedSerial] = useState<{
    serialNo: string;
    inspectionRequestIds: number[];
  } | null>(null);
  const [serialDraft, setSerialDraft] = useState<{
    inspectionRequestId: number | null;
    rows: SerialRow[];
  }>({
    inspectionRequestId: null,
    rows: [],
  });
  const serialRows = serialDraft.inspectionRequestId === selectedId ? serialDraft.rows : [];
  const setSerialRows = (rows: SerialRow[]): void =>
    setSerialDraft({ inspectionRequestId: selectedId, rows });

  /** 의뢰에 고정된 검사기준 버전의 합격판정개수 — 있으면 수량으로 종합 판정을 채운다(#126). */
  const acceptance = useAcceptanceNumber(detail.data?.inspectionPlanVersionId ?? null);
  const acceptanceNumber = acceptance.data ?? null;

  /**
   * ⭐ **R3 — 「이 누름이 겨눈 대상」을 누를 때 적어 두고 돌아와 대조한다.**
   *
   * 되돌릴 수 없는 쓰기가 나가 있는 동안 화면은 계속 움직인다. 이 표식이 없으면 늦게 도착한
   * 응답이 **누르지도 않은 의뢰 창에** 「판정을 저장했습니다」를 세우고, 검사자는 안 한 일을
   * 했다고 읽고 자리를 뜬다(§9 D3).
   */
  const writeTargetRef = useRef<WriteTargetSignature | null>(null);

  /**
   * 지금 화면이 겨누고 있는 대상. **`onSuccess` 가 이 값을 «누를 때의 것»으로 붙잡는다** —
   * 훅에 넘긴 콜백은 `write()` 를 부른 렌더의 것이므로, 그 렌더의 서명과 지금 표식을 견주면
   * 「그 사이에 대상이 바뀌었는가」가 그대로 드러난다.
   */
  const writeTarget = selectedId === null ? null : targetSignatureOf(selectedId, previousResultId);

  const save = useSaveInspectionResult(selectedId, () => {
    /*
     * ⛔ **겨눈 대상이 그대로일 때만 반영한다.** 표식이 비었거나(의뢰가 바뀌었다) 다른 것을
     * 가리키면(그 사이 다른 저장이 나갔다) 이 성공은 이 화면의 것이 아니다.
     */
    if (writeTargetRef.current === null || writeTargetRef.current !== writeTarget) return;

    writeTargetRef.current = null;
    setIsJustSaved(true);
    setSerialDraft({ inspectionRequestId: null, rows: [] });
  });

  const roundId = round?.inspectionResultId ?? null;
  const { acceptedQty, rejectedQty, heldQty } = round ?? {
    acceptedQty: 0,
    rejectedQty: 0,
    heldQty: 0,
  };

  const storedJudgment = round?.overallJudgmentCode ?? '';

  /**
   * 회차가 화면에 보일 값. 회차가 없으면 빈 초안이다.
   */
  const draftOf = (
    source: { acceptedQty: number; rejectedQty: number; heldQty: number } | null,
  ): QuantityDraft =>
    source === null
      ? EMPTY_QUANTITY_DRAFT
      : {
          accepted: String(source.acceptedQty),
          rejected: String(source.rejectedQty),
          held: String(source.heldQty),
        };

  /*
   * ⭐ **R2 — 의존성에 `selectedId` 가 반드시 든다.**
   *
   * 회차 값만 보면 **회차가 없는 의뢰끼리 옮길 때** 네 값이 모두 그대로여서(`null`·0·0·0)
   * effect 가 깨어나지 않고, 앞 의뢰에 친 수량이 다음 의뢰 화면에 남는다. 그대로 저장하면
   * **다른 LOT 에 엉뚱한 판정이 나가는데 그 쓰기는 되돌릴 수 없다** — 값이 그럴듯해서 아무도
   * 눈치채지 못한다(§9 D2). **이 한 줄이 없어도 화면은 정상으로 보인다.**
   *
   * ⛔ 여기서 「저장했습니다」를 지우지 않는다 — 저장이 **새 회차를 만들어** `roundId` 가 바뀌면
   * 곧바로 이리 오는데, 그때 지우면 성공 문구가 뜨자마자 사라진다. 그 표시를 지우는 것은
   * 아래 「대상이 바뀌었다」 effect 의 몫이다.
   */
  useEffect(() => {
    /*
     * 재검사 모드를 함께 푼다 — 저장이 새 회차를 만들면 `roundId` 가 바뀌어 여기로 오고, 그
     * 회차는 이제 «실재하는 회차»라 재검사 모드로 남아 있으면 다음 저장이 또 새 회차를 만든다.
     */
    setIsReinspecting(false);
    setJudgment(storedJudgment);
    setChangeReason('');
    setRejectionReason('');
    setDraft(draftOf(roundId === null ? null : { acceptedQty, rejectedQty, heldQty }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, roundId, acceptedQty, rejectedQty, heldQty, storedJudgment]);

  /*
   * 겨눈 대상이 바뀌었다 — **앞 대상의 쓰기는 이제 남의 것이다.**
   *
   * ⛔ 이 `null` 대입이 없으면 나가 있던 저장이 돌아와 **새 의뢰 창에** 성공을 알린다(§9 D3).
   * 화면은 멀쩡히 돌고 문구만 엉뚱한 자리에 선다 — **없어도 조용히 깨지는 자리다.**
   */
  useEffect(() => {
    writeTargetRef.current = null;
    setIsJustSaved(false);
  }, [selectedId]);

  const rows = queue.data?.rows ?? [];
  const pageView = toPageView(queue.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  /**
   * 조건을 바꾼다. **첫 쪽으로 가고 고른 의뢰가 풀린다** — 결과가 통째로 달라지므로 3쪽을 보다가
   * 좁히면 결과가 3쪽에 못 미쳐 「좁혔더니 아무것도 없다」로 보이고, 고른 의뢰는 새 결과에 없을
   * 수 있다. 두 일을 `toSearchParams` 가 한 자리에서 한다.
   */
  const applyFilters = (next: QueueFilters): void => {
    /* 상세가 목록 옆에 열려 있으면 그대로 둔다(#185) — 조회 한 번에 쓰던 판정 입력이 사라지지 않게. */
    const params = toSearchParams(next);
    if (selectedId !== null) params.set(URL_KEYS.selected, String(selectedId));
    setSearchParams(params);
  };

  /**
   * 탭 줄 상태 칩(#185). 첫 쪽으로 가지만 **고른 의뢰는 그대로 둔다** — 상세에서 눌러도 쓰던 판정 입력을
   * 잃지 않고, 목록으로 돌아가면 거른 결과가 선다.
   */
  const applyStatus = (statusCode: InspectionHubStatus | null): void => {
    const next = toSearchParams(withStatus(filters, statusCode));
    if (selectedId !== null) next.set(URL_KEYS.selected, String(selectedId));
    setSearchParams(next);
  };

  /** 쪽만 옮긴다 — 조건과 고른 의뢰는 그대로다. */
  const goToPage = (next: number): void => {
    setSearchParams(toPageParams(searchParams, next));
  };

  /** 시리얼로 연 의뢰 — 그 시리얼이 이 의뢰에 맞으면 첫 줄로 받는다(맞지 않으면 판정 구획에서 다시 스캔할 때 이유가 보인다). */
  const openBySerial: Parameters<typeof SerialOpenByScan>[0]['onOpen'] = (
    inspectionRequestId,
    scan,
  ) => {
    const fits =
      checkScannedSerial(scan, { inspectionRequestId, itemId: scan.itemId, rows: [] }) === null;
    /* 시리얼 초안은 옮겨 갈 때 싣는다 — 「계속 작성」을 고르면 지금 의뢰의 초안이 그대로 남아야 한다. */
    moveTo(inspectionRequestId, () => {
      setSerialDraft({ inspectionRequestId, rows: fits ? [toSerialRow(scan)] : [] });
    });
    setScannedSerial({
      serialNo: scan.serialNo,
      inspectionRequestIds: scan.pickedRequests.map((request) => request.inspectionRequestId),
    });
  };

  /* 고른 의뢰를 주소에 싣거나(`null` 이면) 뺀다 — 검색 조건 · 쪽은 그대로. */
  const openRequest = (inspectionRequestId: number | null): void => {
    const next = new URLSearchParams(searchParams);
    if (inspectionRequestId === null) next.delete(URL_KEYS.selected);
    else next.set(URL_KEYS.selected, String(inspectionRequestId));
    setSearchParams(next);
  };

  /*
   * 목록과 상세가 한 화면에 나란히 선다(#185) — 상세를 쓰는 중에 다른 줄을 누르거나(시리얼 스캔 포함) 상세를 닫으면,
   * 저장하지 않은 입력이 있을 때 바로 옮기지 않고 한 번 묻는다(#136 의 「목록으로」와 같은 팝업). `to` 가 `null` 이면 닫기다.
   */
  const [leaveTo, setLeaveTo] = useState<{ to: number | null; apply?: () => void } | null>(null);
  useEffect(() => {
    setLeaveTo(null);
  }, [selectedId]);
  const go = (to: number | null, apply?: () => void): void => {
    apply?.();
    openRequest(to);
  };
  const moveTo = (to: number | null, apply?: () => void): void => {
    if (to === selectedId) {
      apply?.();
      return;
    }
    if (selectedId !== null && hasUnsavedInput) {
      setLeaveTo(apply === undefined ? { to } : { to, apply });
      return;
    }
    go(to, apply);
  };
  const select = (inspectionRequestId: number): void => moveTo(inspectionRequestId);

  /* 목록 · 상세 배치 — 입하 예정 조회와 같은 좌우 분할, 가운데 막대로 폭을 나눈다(비율은 브라우저에 남는다). */
  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:oqc-inspection:split', 0.45);
  /* 좌우 · 상하 배치(사용자 지시 2026-10-26) — 세 탭이 같은 고름을 쓴다. */
  const layout = useSplitOrientation('omf-mes:inspection-hub:split-orientation');

  /**
   * 표 자리에 그릴 것. **네 갈래를 가른다** — 실패 · 부르는 중 · 이 쪽에 없음 · 조건에 맞는 것 없음.
   *
   * ⭐ **실패를 「결과 없음」으로 접지 않는다.** 접으면 요청이 실패했을 뿐인데 표가 「조건을
   * 넓혀 보세요」라고 말하고, 사용자는 조건을 넓히다가 결국 못 찾는다.
   *
   * ⭐ 「이 쪽에 없음」과 「조건에 맞는 것이 없음」도 합치지 않는다. 앞은 **쪽이 문제**라 앞쪽으로
   * 가면 풀리고, 뒤는 **조건이 문제**라 조건을 넓혀야 풀린다.
   */
  const emptyContent = queue.isError ? (
    <p className="field-note">{t.queue.unavailable}</p>
  ) : queue.isPending ? (
    <p className="field-note">{t.queue.loading}</p>
  ) : pageView.isBeyondLast ? (
    <p className="field-note">
      {t.pageNav.beyondLast}{' '}
      <Button variant="outlined" size="sm" onClick={() => goToPage(1)}>
        {t.pageNav.toFirstPage}
      </Button>
    </p>
  ) : (
    <EmptyState
      size="sm"
      live
      icon={<Icon name="search_off" size={40} />}
      title={t.queue.empty}
      description={t.queue.emptyHint}
    />
  );

  /**
   * 합계 제약의 오른쪽 변.
   *
   * ⭐ **재검사 중에는 의뢰의 대상 수량을 쓴다.** 그때 폼에는 회차를 넘기지 않으면서
   * (「아직 없는 새 회차」다) 수량만 그 회차에서 가져오면, 「이 회차는 없는 것으로 친다」와
   * 「그 회차의 검사수량으로 합계를 잰다」가 한 화면에서 어긋난다. 새 회차가 다시 검사하는
   * 대상은 앞 회차가 아니라 **의뢰**다.
   */
  const inspectedQty = isReinspectingNow
    ? (detail.data?.targetQty ?? 0)
    : (round?.inspectedQty ?? detail.data?.targetQty ?? 0);

  /*
   * 합격판정개수 기준 자동 판정(omf-all-around#126 · IQC #125 와 같다) — 기준에 합격판정개수가 있고 열린 회차일 때만.
   * 수량을 고치면 판정을 채우고(사용자가 다시 바꿀 수 있다), 다르게 고르면 변경 사유를 받아야 저장된다.
   * 이 화면은 회차가 있으면 잠그므로 「열린 회차」는 재검사 중이거나 회차가 아직 없을 때다.
   */
  const isOpenRound = isReinspectingNow || round === null;
  const expectedJudgment = isOpenRound ? expectedJudgmentOf(draft, acceptanceNumber) : null;
  const needsChangeReason = needsJudgmentChangeReason(judgment, expectedJudgment);
  const changeDraftAndJudge = (next: QuantityDraft): void => {
    setDraft(next);
    const expected = isOpenRound ? expectedJudgmentOf(next, acceptanceNumber) : null;
    if (expected !== null) setJudgment(expected);
  };

  /*
   * 떠날 때 물을 입력(#136 · IQC #133 과 같은 규칙) — 열린 회차(회차가 아직 없거나 재검사 중)에 수량 · 판정 · 변경 사유 ·
   * 검사한 시리얼 중 하나라도 들어 있으면 묻는다. 열린 회차의 기준은 늘 빈 상태다(이 화면은 회차가 있으면 잠근다).
   * ⛔ 잠긴 회차는 고칠 칸이 없으니 묻지 않는다. 저장 요청 본문 · 저장 조건과는 무관하다 — 묻는 데만 쓴다.
   */
  const hasUnsavedInput =
    isOpenRound &&
    (draft.accepted !== '' ||
      draft.rejected !== '' ||
      draft.held !== '' ||
      judgment !== '' ||
      changeReason.trim() !== '' ||
      /* 불합격 사유는 불합격 판정과 함께만 실린다 — 판정이 있으면 위에서 이미 묻는다(판정을 지워 남은 글은 셈하지 않는다). */
      serialRows.length > 0);

  /*
   * 품목·대상 LOT 은 번호마다 하나씩 이름으로 푼다(omf-all-around#40 · #136) — 목록에 선 줄과 고른 의뢰를 함께 넘긴다.
   * 단위 코드는 수량 옆에 붙이는 표시 전용이다 — 저장 요청의 `uomId` 와 무관하다.
   */
  const itemNames = useItemNames([...rows.map((row) => row.itemId), detail.data?.itemId]);
  const lotNumbers = useLotNumbers([detail.data?.lotId]);
  const uoms = useUomLookup();
  const uomCode = uoms.codeOf(detail.data?.uomId);

  /*
   * 검사 기본 정보의 셋째 칸(#136) — OA 사업부 계정은 시리얼로 검사하므로 시리얼 번호를, 그 밖은 대상 LOT 을 본다.
   * 출하요청 대상 의뢰에는 LOT 이 없어(편성 때 정해지지 않는다) 그 지시의 피킹 기록에서 읽는다. 둘 다 표시 전용이다.
   */
  const oaAccess = useOaAccess();
  const isOa = oaAccess === 'oa';
  const isShipmentTarget = detail.data?.targetTypeCode === 'SHIPMENT_REQUEST';
  const unitRecords = useOqcSerialRecords(selectedId, isOa && isShipmentTarget);
  /* 「시리얼별 출하검사 이력」 접는 줄의 건수 — 구획 안 표와 같은 조회다(#136). */
  const serialRecordCount = useOqcSerialRecords(selectedId, isShipmentTarget).data?.length;
  const pickedLots = usePickedLotNumbers(
    /* OA 여부를 아직 판단 중이면 부르지 않는다 — OA 계정에 쓰지 않을 조회가 한 번 나가지 않게. */
    oaAccess !== 'checking' && !isOa && isShipmentTarget && detail.data?.lotId == null
      ? (detail.data?.targetId ?? null)
      : null,
    detail.data?.itemId ?? 0,
  );
  const listOrUnregistered = (values: readonly string[]): string => {
    const [first] = values;
    if (first === undefined) return t.detail.unregistered;
    return values.length === 1 ? first : t.detail.more(first, values.length - 1);
  };
  const unitFact = ((): { kind: 'serial' | 'lot'; value: string } | undefined => {
    /* 시리얼은 출하작업지시 의뢰에만 있다 — LOT 대상 의뢰는 OA 계정이어도 대상 LOT 을 그대로 보인다. */
    if (isOa && isShipmentTarget) {
      const scanned =
        selectedId !== null && scannedSerial?.inspectionRequestIds.includes(selectedId) === true
          ? [scannedSerial.serialNo]
          : [];
      const recorded = (unitRecords.data ?? []).map((record) => record.serialNo);
      const values = [...new Set([...scanned, ...recorded])];
      if (values.length === 0 && unitRecords.isPending && unitRecords.fetchStatus !== 'idle')
        return { kind: 'serial', value: referenceT.loading };
      if (values.length === 0 && unitRecords.isError)
        return { kind: 'serial', value: referenceT.failed };
      return { kind: 'serial', value: listOrUnregistered(values) };
    }
    if (detail.data?.lotId != null || !isShipmentTarget) return undefined;
    if (pickedLots.isPending) return { kind: 'lot', value: referenceT.loading };
    if (pickedLots.isError) return { kind: 'lot', value: referenceT.failed };
    return { kind: 'lot', value: listOrUnregistered(pickedLots.data) };
  })();

  /**
   * 저장이 보낼 값을 만든다.
   *
   * 수량은 `toSendableNumber` 를 거친다 — 화면이 재는 자와 보내는 자가 같아야 한다.
   *
   * ⛔ **검사자·단말·재검사 사유를 보내지 않는다** — 앞 둘은 서버가 인증 주체에서 풀고
   * (omf-mes#173), 셋째는 값 목록이 없어 지어내면 서버가 모르는 값을 받는다.
   *
   * 고른 의뢰·단위를 **인자로 받는다** — 이 자리에 도달했으면 `null` 이 아니라는 사실이 타입이
   * 아니라 렌더 조건에 있어서, 단언으로 메우면 그 조건이 바뀔 때 조용히 어긋난다.
   */
  const saveResult = (inspectionRequestId: number, uomId: number, inspectedAt: string): void => {
    if (writeTarget === null) return;

    setIsJustSaved(false);
    /* ⭐ R3 — 누를 때 겨눈 대상을 적어 둔다. 돌아와 이 값과 대조한다. */
    writeTargetRef.current = writeTarget;

    save.write({
      inspectionRequestId,
      inspectedQty,
      acceptedQty: toSendableNumber(draft.accepted),
      rejectedQty: toSendableNumber(draft.rejected),
      heldQty: toSendableNumber(draft.held),
      uomId,
      /*
       * ⭐ **R4 — 고른 판정을 몸통에 싣는다.** 확정 저장이라 계약상 필수이기도 하고, 싣지
       * 않으면 저장 뒤 재조회가 «저장 전» 판정을 돌려주고 되돌림이 사용자가 고른 값을 덮는다 —
       * 이 화면은 확정이 한 번이라 **덮인 값 그대로 LOT 이 풀린다**(§9 D4).
       */
      overallJudgmentCode: judgment,
      /* 검사한 시각은 확인 창을 연 순간의 것이다 — 재시도에도 같은 값이어야 멱등 키가 유지된다. */
      inspectedAt,
      /*
       * 재검사면 앞 회차를 가리킨다 — 이 값이 있어야 서버가 회차를 +1 하고 사슬을 잇는다.
       * ⛔ 빠뜨리면 같은 의뢰에 회차 1이 두 번 만들어지려 해 `UNIQUE(의뢰, 회차)` 에 걸린다.
       */
      previousResultId,
      /* 자동 판정과 다르게 저장할 때만 싣는다(#126 · 서버 P-70). */
      ...(needsChangeReason ? { judgmentChangeReason: changeReason.trim() } : {}),
      ...(judgment === REJECTED && rejectionReason.trim() !== ''
        ? { remarks: rejectionReason.trim() }
        : {}),
      serials: toSerialInputs(serialRows),
    });
  };

  /**
   * 우측 창. **네 갈래다** — 고르지 않음 · 실패 · 부르는 중 · 상세.
   *
   * ⛔ 실패를 「고르지 않음」으로 접지 않는다. 접으면 고른 것이 사라진 것처럼 보여 사용자가 다시
   * 고르는데, 다시 골라도 같은 실패가 온다.
   */
  const detailContent =
    /* 고르지 않았으면 상세가 서지 않는다 — 목록만 선다(#136). 이 갈래는 아래 `selectedId` 를 좁히는 데만 쓴다. */
    selectedId === null ? null : detail.isError ? (
      <QueueLoadErrorBanner
        error={toApiError(detail.error)}
        onRetry={() => void detail.refetch()}
      />
    ) : detail.data === undefined ? (
      <p className="field-note">{t.detail.loading}</p>
    ) : (
      <>
        <RequestDetailPane
          detail={detail.data}
          uomCode={uomCode}
          itemNames={itemNames}
          lotNumbers={lotNumbers}
          unitFact={unitFact}
        />

        {/* OQC 생략(#119) — 출하작업지시 대상이고 판정이 아직 없을 때만. 확정 회차가 있으면 생략으로 덮지 않는다. */}
        {detail.data.targetTypeCode === 'SHIPMENT_REQUEST' &&
          rounds.data !== undefined &&
          rounds.data.every((row) => row.statusCode !== 'CONFIRMED') && (
            <SkipPane
              shipmentRequestId={detail.data.targetId}
              requestStatusCode={detail.data.statusCode}
            />
          )}

        {rounds.isError ? (
          /* 회차를 모르는 채로 저장을 열지 않는다 — 몇 회차인지 모르면 재검사인지도 모른다. */
          <QueueLoadErrorBanner
            error={toApiError(rounds.error)}
            onRetry={() => void rounds.refetch()}
          />
        ) : rounds.isPending ? (
          <p className="field-note">{t.result.loading}</p>
        ) : (
          <ResultFormPane
            /*
             * ⭐ **의뢰마다 새로 세운다.** 폼이 스스로 드는 상태(확인 창이 열려 있는가 · 오류를
             * 보일 때가 됐는가)는 «그 의뢰에 매인 것»이라, 대상이 바뀌면 함께 사라져야 한다.
             * 자리로만 이어 두면 다른 의뢰를 골랐는데 **앞 의뢰에서 열어 둔 확인 창이 새 의뢰의
             * 번호를 달고 그대로 서 있다** — 그 창의 단추는 되돌릴 수 없는 쓰기를 낸다.
             */
            key={selectedId}
            /*
             * ⭐ 재검사 중에는 **회차를 넘기지 않는다.** 넘기면 그 회차가 확정본이라 칸이 잠긴
             * 채로 남는다 — 지금 쓰는 것은 확정본이 아니라 «아직 없는 새 회차»다.
             */
            round={isReinspectingNow ? null : round}
            inspectionRequestNo={detail.data.inspectionRequestNo}
            inspectedQty={inspectedQty}
            uomCode={uomCode}
            hasLot={detail.data.lotId !== null}
            draft={draft}
            onChange={changeDraftAndJudge}
            judgmentOptions={judgmentOptions}
            judgment={judgment}
            onJudgmentChange={setJudgment}
            acceptanceNumber={acceptanceNumber}
            expectedJudgmentLabel={
              expectedJudgment === null
                ? null
                : (judgmentOptions.find((option) => option.value === expectedJudgment)?.label ??
                  expectedJudgment)
            }
            needsChangeReason={needsChangeReason}
            serialSection={
              detail.data.targetTypeCode === 'SHIPMENT_REQUEST' ? (
                <SerialJudgments
                  inspectionRequestId={selectedId}
                  itemId={detail.data.itemId}
                  rows={serialRows}
                  onChange={setSerialRows}
                  serverError={save.fieldErrors.serials}
                  disabled={save.isSaving || isInputLocked}
                />
              ) : undefined
            }
            serialBlockedReason={serialBlockedReason(serialRows, inspectedQty, draft.rejected)}
            isInputLocked={isInputLocked}
            changeReason={changeReason}
            onChangeReasonChange={setChangeReason}
            rejectionReason={rejectionReason}
            onRejectionReasonChange={setRejectionReason}
            onSave={(inspectedAt) => {
              saveResult(selectedId, detail.data.uomId, inspectedAt);
            }}
            isSaving={save.isSaving}
            isJustSaved={isJustSaved}
            fieldErrors={save.fieldErrors}
            saveError={save.error}
            onReload={() => void rounds.refetch()}
            isReinspecting={isReinspectingNow}
            onStartReinspection={() => {
              /* 새 회차는 빈 칸에서 시작한다 — 앞 회차의 값이 남으면 그대로 저장된다. */
              setIsJustSaved(false);
              setDraft(EMPTY_QUANTITY_DRAFT);
              setJudgment('');
              setChangeReason('');
              setRejectionReason('');
              /* 시리얼로 연 완료 의뢰면 그 시리얼이 첫 줄로 남는다 — 재검사하려고 찍은 것이다. */
              setIsReinspecting(true);
            }}
            onCancelReinspection={() => {
              setIsReinspecting(false);
              /*
               * ⛔ **확정본의 값을 되돌려 놓는다.** 비우면 그만둔 자리에 확정된 회차가 «수량
               * 없이» 놓인다 — 판정이 끝난 기록인데 화면이 비어 있으니 검사자는 자기가 방금
               * 그것을 지웠다고 읽는다.
               */
              setDraft(draftOf(round));
              setJudgment(storedJudgment);
              setChangeReason('');
              setRejectionReason('');
              setSerialDraft({ inspectionRequestId: null, rows: [] });
            }}
          />
        )}
      </>
    );

  /*
   * 참고 정보 — 판정 뒤에, 상세 카드 밖에 구획마다 접는 상자 하나로(#136 · IQC #133 과 같다). 내용과 동작은 그대로다.
   * 회차 이력은 회차가 둘 이상(재검사 중이면 하나 이상)일 때만 선다 — 서지 않으면 접는 상자도 두지 않는다.
   */
  const historyRevision = `${String(rounds.data?.length ?? 0)}:${JSON.stringify(round ?? null)}`;
  const historyCount = useInspectionHistory(selectedId, historyRevision).data?.events.length;
  const roundCount = rounds.data?.length ?? 0;
  const showsRoundHistory = roundCount > 1 || (isReinspectingNow && roundCount > 0);

  const auxContent =
    selectedId === null || detail.isError || detail.data === undefined ? null : (
      <div className="oqc-inspection-aux">
        {/* ⛔ 읽기 전용이다 — 앞 회차는 정정하지 않고 새 회차를 쌓는다(§5-3). */}
        {showsRoundHistory && (
          <details className="pane oqc-inspection-fold" open>
            <summary>{t.history.heading}</summary>
            <RoundHistory
              rounds={rounds.data ?? []}
              currentResultId={isReinspectingNow ? null : roundId}
              isReinspecting={isReinspectingNow}
              judgmentOptions={judgmentOptions}
            />
          </details>
        )}

        {/*
         * 검사 이력 · 시리얼별 검사 이력을 탭 하나로(#136). 시리얼 탭은 출하작업지시 의뢰만 — 저장하면 둘 다 새로 부른다.
         * 의뢰를 바꾸면 첫 탭에서 다시 시작한다.
         */}
        <section className="pane oqc-inspection-fold oqc-inspection-history-card">
          <Tabs
            key={selectedId}
            aria-label={messages.inspectionHistory.heading}
            items={[
              {
                value: 'history',
                label: messages.inspectionHistory.heading,
                content: (
                  <div className="oqc-inspection-tab-body">
                    <div className="oqc-inspection-tab-head">
                      <h3>{t.detail.historyTitle}</h3>
                      {historyCount !== undefined && (
                        <span className="oqc-inspection-fold-chip">
                          {t.detail.historyCount(historyCount)}
                        </span>
                      )}
                    </div>
                    <InspectionHistoryPanel
                      hideSourceLot
                      key={`${String(selectedId)}-${String(roundCount)}`}
                      inspectionRequestId={selectedId}
                      judgmentLabelOf={(code) => labelOfCode(judgmentOptions, code)}
                      revision={historyRevision}
                    />
                  </div>
                ),
              },
              ...(detail.data.targetTypeCode === 'SHIPMENT_REQUEST'
                ? [
                    {
                      value: 'serials',
                      label: t.serials.recordTab,
                      content: (
                        <div className="oqc-inspection-tab-body">
                          <div className="oqc-inspection-tab-head">
                            <h3>{t.serials.recordHeading}</h3>
                            {serialRecordCount !== undefined && (
                              <span className="oqc-inspection-fold-chip">
                                {t.serials.recordCount(serialRecordCount)}
                              </span>
                            )}
                          </div>
                          <SerialRecords inspectionRequestId={selectedId} />
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </section>
      </div>
    );

  return (
    <>
      {/* 탭 줄 오른쪽 건수 칩(#185) — 탭 묶음 안에서만 선다. */}
      <InspectionHubCounts
        inspectionTypeCode="OQC"
        statuses={QUEUE_STATUSES}
        active={filters.statusCode}
        onChange={applyStatus}
      />
      <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} />
      {/* 탭 묶음(검사 조회·판정) 안이면 탭 막대가 화면 이름을 말한다 — 경로·제목을 세우지 않는다(입하 예정 조회와 같다). */}
      {hub === null && (
        <PageHeader
          title={selectedId === null ? t.title : t.detail.sectionTitle}
          breadcrumb={
            <Breadcrumb
              items={[
                { label: t.breadcrumbRoot },
                { label: t.title },
                /* 상세(판정)를 열면 지금 자리를 한 단계 더 보인다(#136). */
                ...(selectedId === null ? [] : [{ label: t.detail.sectionTitle }]),
              ]}
              aria-label={messages.common.shell.breadcrumb}
            />
          }
        />
      )}

      {/*
       * 목록과 상세(판정)를 한 화면에 나란히 둔다(#185 · 입하 예정 조회와 같다) — 종전(#136)처럼 상세가 목록을
       * 갈아 끼우지 않는다. 의뢰를 고르면(`?ir=`) 오른쪽에 상세가 서고, 검색 조건 · 쪽은 주소에 남는다.
       */}
      {/* 검색 묶음 — 입하 예정 조회처럼 표와 다른 카드에 둔다(#185). 시리얼 스캔과 조회 조건이 한 줄에 선다. */}
      <section ref={aboveRef} className="pane oqc-inspection-panes oqc-inspection-search">
        <SerialOpenByScan
          onOpen={openBySerial}
          onFound={(scan) =>
            setScannedSerial({
              serialNo: scan.serialNo,
              inspectionRequestIds: scan.pickedRequests.map(
                (request) => request.inspectionRequestId,
              ),
            })
          }
        />

        <QueueFilterBar
          appliedFilters={filters}
          /* 상태는 탭 줄 칩이 맡는다 — 조회는 걸린 칩을 그대로 두고, 초기화는 함께 푼다. */
          onSearch={(next) => applyFilters(withDraft(filters, next))}
          onTogglePendingOnly={(next) =>
            applyFilters(withDraft(filters, { ...filters, pendingOnly: next }))
          }
          onReset={() => applyFilters(EMPTY_FILTERS)}
        />
      </section>

      <div
        ref={splitRef}
        className={`po-board-split inspection-split${layout.orientation === 'column' ? ' is-stacked' : ''}`}
        style={{ ...split.style, ...layout.style }}
      >
        <section
          className="pane oqc-inspection-panes oqc-inspection-queue-pane"
          aria-label={t.queue.heading}
        >
          {queue.isError && (
            <QueueLoadErrorBanner
              error={toApiError(queue.error)}
              onRetry={() => void queue.refetch()}
            />
          )}

          <QueueListTable
            scrollX={layout.orientation === 'row'}
            rows={rows}
            itemNames={itemNames}
            uomCodeOf={(row) => uoms.codeOf(row.uomId)}
            serialOf={(row) =>
              scannedSerial?.inspectionRequestIds.includes(row.inspectionRequestId) === true
                ? scannedSerial.serialNo
                : null
            }
            selectedId={selectedId}
            onSelect={select}
            empty={emptyContent}
          />

          {/*
           * ⛔ **셀 것이 없으면 그리지 않는다.** 조회가 끝나기 전이나 실패했을 때는 총계를
           * 모르는데, 그리면 대신 넘긴 0이 「전체 0건」이라는 **사실 주장**이 되어 화면에 선다.
           */}
          {queue.data !== undefined && (
            /*
             * 저장이 나가 있는 동안 쪽을 잠근다 — 쪽이 바뀌면 목록이 통째로 갈리는데, 그 사이
             * 돌아온 성공이 다른 목록 위에 서면 무엇에 대한 성공인지 읽을 수 없다.
             */
            <PageNav view={pageView} disabled={save.isSaving} onChange={goToPage} />
          )}
        </section>

        <PaneSplitter label={hubText.splitter} ratio={split.ratio} onChange={split.commit} />
        {layout.orientation === 'column' && (
          <PaneHeightSplitter
            label={hubText.heightSplitter}
            height={layout.listHeight}
            onChange={layout.changeListHeight}
          />
        )}

        <section
          className="pane oqc-inspection-panes oqc-inspection-detail"
          aria-label={t.detail.paneLabel}
        >
          {selectedId === null ? (
            <EmptyState
              size="sm"
              title={hubText.pickRequest}
              description={hubText.pickRequestHint}
            />
          ) : (
            <>
              <div className="oqc-inspection-back">
                <Button
                  variant="text"
                  size="md"
                  className="oqc-inspection-back-button"
                  onClick={() => moveTo(null)}
                >
                  {hubText.closeDetail}
                </Button>
              </div>
              {detailContent}
              {auxContent}
            </>
          )}
        </section>
      </div>

      {/*
       * 저장하지 않고 떠날지 묻는 팝업 — 한 줄 설명, [계속 작성](테두리) [저장하지 않고 이동](채움).
       * × 는 두지 않는다. Esc·바깥 누름은 «계속 작성»과 같다 — 입력은 그대로 남는다(IQC #133 과 같다).
       */}
      {leaveTo !== null && (
        <Dialog
          open
          onClose={() => setLeaveTo(null)}
          showCloseButton={false}
          title={t.detail.leaveUnsaved}
          footer={
            <>
              <Button
                variant="outlined"
                className="app-button-neutral"
                onClick={() => setLeaveTo(null)}
              >
                {t.detail.keepEditing}
              </Button>
              <Button variant="filled" onClick={() => go(leaveTo.to, leaveTo.apply)}>
                {t.detail.leaveAnyway}
              </Button>
            </>
          }
        >
          <p>{t.detail.leaveUnsavedNote}</p>
        </Dialog>
      )}
    </>
  );
};

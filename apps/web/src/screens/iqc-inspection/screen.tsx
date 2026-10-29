import {
  Breadcrumb,
  Button,
  Dialog,
  EmptyState,
  Icon,
  PageHeader,
  Tabs,
  useToast,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { OaOnlyGate } from '../../patterns/oa-only-gate';
import { toApiError } from '../../patterns/request';
import { sessionKeys, useSession } from '../../patterns/session';
import { usePageHub } from '../../patterns/page-hub';
import {
  InspectionHubCounts,
  type InspectionHubStatus,
} from '../../patterns/inspection-hub-counts';
import { PaneSplitter, useFitToViewport, usePaneSplit } from '../../patterns/po-board';
import {
  PaneHeightSplitter,
  SplitOrientationToggle,
  useSideBySideFits,
  useSplitOrientation,
} from '../../patterns/split-orientation';
import {
  EMPTY_FILTERS,
  LIST_PAGE_SIZES,
  PAGE_SIZE,
  QUEUE_STATUSES,
  readFilters,
  readPage,
  readPageSize,
  readSelectedId,
  toListQuery,
  toPageParams,
  toPageSizeParams,
  toSearchParams,
  URL_KEYS,
  type QueueFilters,
} from './filters';
import { PageNav } from '../../patterns/page-nav';
import { withDraft, withStatus } from '../oqc-inspection/filters';
import { QueueLoadErrorBanner } from './load-error-banner';
import {
  EMPTY_QUANTITY_DRAFT,
  formatMicro,
  toSendableNumber,
  type QuantityDraft,
} from './quantity-draft';
import { toPageView } from './pagination';
import { ClosedSummary } from './closed-summary';
import { CODE_GROUPS, toCodeOptions } from './code-options';
import { PlanViewDialog } from './plan-view-dialog';
import { MeasurementGrid } from './measurement-grid';
import { toMeasurementRows } from './measurement-rows';
import {
  useInspectionItemSpecs,
  useInspectionRequestDetail,
  useSamplingRule,
  useInspectionQueue,
  useInspectionRoundLock,
  useInspectionRounds,
  useCodeValues,
  useConfirmResult,
  useCauseCodes,
  useDefectCodes,
  useDraftRejectionRecords,
  useRejectedLotFollowUp,
  useMeasurements,
  useSaveDraft,
} from './queries';
import {
  EMPTY_FOUR_M_CHANGE,
  FourMChange,
  fourMBodyOf,
  fourMDraftOf,
  isFourMIncomplete,
  isSameFourM,
  type FourMChangeDraft,
} from './four-m-change';
import {
  autoJudgmentOf,
  expectedJudgmentOf,
  JudgmentChange,
  needsJudgmentChangeReason,
} from './judgment-change';
import { RejectedLotGuide } from './rejected-lot-guide';
import { DefectRows, defectSumOf, hasInvalidDefectQty } from './defect-rows';
import {
  EMPTY_DEFECT,
  defectDraftOf,
  resolveDefects,
  type DefectDraft,
  type DefectRecordInput,
} from './rejection-reason';
import { sampleQtyOf } from './sample-qty';
import { QueueFilterBar } from './queue-filter-bar';
import { QueueTable } from './queue-table';
import { ItemLevel } from './item-level';
import { RequestDetailPane } from './request-detail-pane';
import { IqcSkipPane } from './skip-pane';
import { ResultFormPane } from './result-form-pane';
import { WorkerConnectDialog } from './worker-connect-dialog';
import { RoundHistory } from './round-history';
import { AttachmentPanel, useAttachments } from '../inspection-documents/attachment-panel';
import { LotScan } from '../inspection-documents/lot-scan';
import { InspectionHistoryPanel, useInspectionHistory } from '../inspection-history/panel';
import { latestRound, previousRounds } from './types';
import {
  type ItemNameParts,
  useItemNames,
  useLotNumbers,
  useLotSuppliers,
} from './reference-lookup';
import { useUomLookup } from './uom-lookup';

/** 품목 풀이 → 검사 수준 창의 품목. 못 풀었으면 창을 열지 않는다(#133). */
const toLevelItem = (parts: ItemNameParts | null) =>
  parts === null ? null : { itemCode: parts.code, itemName: parts.name };

/** 끝난 검사 의뢰 — 입력 화면 대신 요약을 보인다(3단계 검증). */
const REQUEST_COMPLETED = 'COMPLETED';

/**
 * W-01-01 IQC 수입검사·판정 — **이 회차는 좌측 검사 대기 큐 하나다.**
 *
 * 화면 스펙 §3 은 좌우 2단이고 우측 2/3 가 진행 중인 1건이다. 그 창(의뢰 상세·측정치·수량
 * 판정·확정)은 다음 회차가 세우며, **미완성 부분을 노출하지 않으려고 라우트도 아직 열지
 * 않는다.** 그래서 여기서 `.two-pane` 을 만들지 않는다 — 빈 칸을 만들어 두면 「고장난 화면」이
 * 되고, 우측이 서는 회차에 그 칸을 함께 만드는 편이 정직하다.
 *
 * **주소가 조건의 정본이다.** 조건·쪽·고른 의뢰가 전부 주소에 산다 — 새로고침·뒤로가기·공유가
 * 같은 결과를 내야 하기 때문이다. 읽고 쓰는 규칙은 `filters.ts` 가 소유한다.
 *
 * ⛔ **「검사 시작」 버튼을 두지 않는다.** 요구서가 시작을 이벤트로 열거하지만 스펙 §3 에
 * 시작 버튼이 없고, 첫 임시 저장이 곧 검사 시작이며 서버가 그때 상태를 옮긴다(omf-mes#170 회신).
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.iqcInspection;
const hubText = messages.common.inspectionHub;
/** 종합 판정 불합격(시드 `INSPECTION_RESULT_OVERALL_JUDGMENT`) — 이 값일 때만 불합격 사유를 받는다. */
const REJECTED_JUDGMENT = 'REJECTED';

const IqcInspectionScreenBody = () => {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  /* 검사 조회·판정 묶음(사이드바 한 줄 · 제목 아래 탭) 안이면 셸이 준다 — 셸 밖이면 `null`. */
  const hub = usePageHub();

  const filters = readFilters(searchParams);
  const page = readPage(searchParams);
  const pageSize = readPageSize(searchParams);
  const selectedId = readSelectedId(searchParams);

  const queue = useInspectionQueue(toListQuery(filters, page, pageSize));
  const detail = useInspectionRequestDetail(selectedId);
  /* 검사자는 계정에 연결된 작업자다(omf-all-around#104) — 연결이 없으면 저장 전에 막는다. */
  const { session } = useSession();
  /* 계정에 작업자가 없으면 서버가 검사자를 못 풀어 저장·확정이 다 막힌다 — 입력 칸도 잠근다(#135). */
  const workerMissing = session?.worker === null;
  /* 작업자 미연결이면 이 화면에서 바로 사번을 잇는다(사용자 지시 2026-10-28 · #197). */
  const [isWorkerConnectOpen, setIsWorkerConnectOpen] = useState(false);
  const queryClient = useQueryClient();

  /*
   * 들어올 때 세션을 다시 읽는다(omf-all-around#104) — 다른 관리자가 이 계정의 작업자 지정을 해제·변경했어도
   * 세션 캐시(5분)가 남아 저장이 열려 보이지 않게 한다. 서버도 지정 없는 계정의 저장을 거부한다.
   */
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: sessionKeys.current });
  }, [queryClient]);
  const rounds = useInspectionRounds(selectedId);

  const round = latestRound(rounds.data ?? []);

  /**
   * 확정된 회차에서 **재검사 회차를 쓰는 중**인가.
   *
   * ⭐ **회차를 먼저 만들지 않는다.** 누르면 칸이 열릴 뿐이고 회차는 첫 임시 저장이 만든다 —
   * 「검사 시작」 액션을 두지 않고 첫 저장을 검사 시작으로 삼은 규율과 같다(확정 2026-08-21
   * §1.2). 먼저 만들면 열어 보고 그만둔 사람마다 빈 회차가 쌓이고, 그 순간 의뢰가
   * `COMPLETED` 에서 `IN_PROGRESS` 로 돌아가 대기 큐에 다시 뜬다.
   */
  const [isReinspecting, setIsReinspecting] = useState(false);

  /**
   * 재검사가 가리키는 **앞 회차**. 재검사 중이 아니면 `null`.
   *
   * ⭐ **지금 화면에 있는 회차로 매번 다시 판정한다** — 눌렀을 때의 식별자를 따로 들고 있지
   * 않는다. 들고 있으면 그 값이 화면의 회차와 어긋나는 상태가 생기고, 어느 쪽이 옳은지
   * 정할 근거가 코드 어디에도 없다.
   *
   * ⚠ 「최신이 확정본인가」를 여기서 다시 보지 않는다. 재검사는 확정본에서만 열리고, 회차가
   * 바뀌면 아래 되돌림이 모드를 푼다 — 같은 일을 두 자리에서 하면 뮤테이션이 그 중 한 자리를
   * 지워도 아무 시험도 죽지 않아, 어느 쪽이 실제로 지키는 것인지 알 수 없게 된다.
   */
  const reinspectingFrom = isReinspecting ? (round?.inspectionResultId ?? null) : null;
  const isReinspectingNow = reinspectingFrom !== null;

  /**
   * 고칠 회차. **확정된 회차는 고치지 않는다** — 정정이 아니라 재검사로 새 회차를 쌓는다(§5-3).
   * 그래서 확정본이면 `null` 이 되고 저장은 「새로 만들기」로 간다.
   */
  const editingResultId =
    round !== null && round.statusCode !== 'CONFIRMED' ? round.inspectionResultId : null;

  /*
   * 끝난 의뢰인가(3단계 검증) — 의뢰 COMPLETED · 최신 회차 확정이면 입력 화면 대신 읽기 전용 요약을 보인다.
   * 재작업 처분이 의뢰를 IN_PROGRESS 로 다시 열면(서버 P-43) 입력 화면과 [재검사]가 돌아온다.
   * 작성 중 회차가 있으면(확정 전) 지금처럼 그 회차를 편집한다.
   * 보류(HELD) 확정은 LOT 이 검사 대기에 남아 그대로 재검사한다 — 의뢰가 COMPLETED 여도 닫지 않는다.
   */
  const isClosed =
    !isReinspectingNow &&
    round?.statusCode === 'CONFIRMED' &&
    round.overallJudgmentCode !== 'HELD' &&
    detail.data?.statusCode === REQUEST_COMPLETED;

  /*
   * ⭐ 잠금 토큰을 얻으려고 회차 한 건을 따로 부른다 — 목록 200 에는 `ETag` 가 없고, 토큰
   * 보관소가 응답이 온 URL 경로를 열쇠로 쓴다. 고칠 회차가 있을 때만 부른다.
   */
  useInspectionRoundLock(editingResultId);

  /*
   * 마지막으로 서버에 남은 불합격 사유(omf-all-around#122) — 사유만 고쳐도 [임시 저장]이 켜지게 견주는 기준이다.
   * 저장 응답이 오면 그때 보낸 사유가 기준이 된다(`pendingRejection`).
   */
  const [savedDefects, setSavedDefects] = useState<DefectDraft[]>([EMPTY_DEFECT]);
  const pendingDefects = useRef<DefectDraft[]>([EMPTY_DEFECT]);

  /* 지금 나간 저장이 새 회차를 만드는 POST 인가 — 그 회차는 방금 보낸 사유가 곧 서버 값이라 되살리지 않는다(아래). */
  const savingNewRound = useRef(false);
  const skipRestoreOfCreated = useRef(false);

  const save = useSaveDraft(selectedId, editingResultId, () => {
    /* 저장 결과는 다른 화면처럼 오른쪽 아래 알림으로 낸다(사용자 지시 2026-10-28 · #197). */
    toast.show({ variant: 'success', description: t.result.saved });
    setSavedDefects(pendingDefects.current);
    setSavedHasDefects(pendingHasDefects.current);
    if (savingNewRound.current) skipRestoreOfCreated.current = true;
  });

  /**
   * 종합 판정 — ⛔ **값 목록을 화면에 고정하지 않는다.** 그룹을 «이름»으로 부른다:
   * `codeGroupId` 정수는 환경마다 다르므로 코드에 박지 않는다(omf-mes#179 회신).
   */
  const judgmentValues = useCodeValues(CODE_GROUPS.overallJudgment);
  const judgmentOptions = toCodeOptions(judgmentValues.data ?? []);

  const [judgment, setJudgment] = useState('');
  /*
   * 화면이 자동으로 채운 판정 — 근거가 사라지면(예: 전량 합격 뒤 보류를 넣음) 그 판정을 비워 사람이 고르게 한다. 사람이 고른
   * 판정은 건드리지 않는다(#197 리뷰).
   */
  const autoFilledJudgment = useRef<string | null>(null);

  /** 방금 확정했는가. **상태가 아니라 결과다** — 고른 의뢰가 바뀌면 지워진다. */
  const [isJustConfirmed, setIsJustConfirmed] = useState(false);

  const confirm = useConfirmResult(selectedId, editingResultId, () => {
    setIsJustConfirmed(true);
  });

  /*
   * 불합격 사유(omf-all-around#106) — 불합격이면 불량 코드·사유를 받아 임시 저장(P-48 · #122)과 확정(P-47 · #121)
   * 요청에 함께 싣는다. 서버가 같은 트랜잭션에서 그 회차의 불량 기록을 이 값으로 갈아 끼운다 — 확정이 실패해
   * 다시 눌러도 사유는 그때 입력 1벌이고, 합격·보류로 확정하면 서버가 그 회차의 기록을 지운다.
   */
  /*
   * 불량 내역(사용자 지시 2026-10-28 · #197) — 불합격 수량이 있으면 검사 수량 단계에서 불량 유형별로 받는다(여러 줄). 서버는
   * 최종 판정이 불합격일 때만 받으므로 그때만 싣는다.
   */
  const [defects, setDefects] = useState<DefectDraft[]>([EMPTY_DEFECT]);
  /* 「불합격 존재」 체크(사용자 지시 2026-10-28 · #197) — 켜야 불량 내역을 받고 싣는다. 저장된 불량 기록이 있으면 켠 채로 연다. */
  const [hasDefects, setHasDefects] = useState(false);
  const [savedHasDefects, setSavedHasDefects] = useState(false);
  const pendingHasDefects = useRef(false);
  /* 판정 변경 사유(omf-all-around#125) — 확정 요청에만 싣는다. 임시 저장은 받지 않으므로 의뢰가 바뀔 때 비운다. */
  const [changeReason, setChangeReason] = useState('');
  /* 판정 상세 창을 열 때의 값 — [취소]하면 이 값으로 되돌린다(사용자 지시 2026-10-27 · #185). */
  const detailSnapshot = useRef<{ defects: DefectDraft[]; changeReason: string } | null>(null);
  /*
   * 4M 변경품(omf-all-around#63) — LOT 의 성질이라 회차가 아니라 의뢰 LOT 에 붙는다. 서버 기록이 바뀌면(의뢰를
   * 바꾸거나 저장 뒤 재조회) 그 값으로 되돌린다. 자재 LOT 이 없는 의뢰는 칸을 두지 않고 요청에도 싣지 않는다.
   */
  const fourMTypes = useCodeValues(CODE_GROUPS.fourMChangeType);
  const fourMOptions = toCodeOptions(fourMTypes.data ?? []);
  const hasFourMTarget = detail.data?.lotId != null;
  const storedFourM = fourMDraftOf(detail.data?.fourMChange ?? null);
  const storedFourMKey = JSON.stringify(storedFourM);
  const [fourM, setFourM] = useState<FourMChangeDraft>(EMPTY_FOUR_M_CHANGE);
  useEffect(() => {
    setFourM(JSON.parse(storedFourMKey) as FourMChangeDraft);
  }, [selectedId, storedFourMKey]);
  /* 서버 기록과 같으면 싣지 않는다 — 생략은 «그대로»라 다른 회차·경로가 남긴 기록을 덮지 않는다. */
  const fourMChanged = hasFourMTarget && !isSameFourM(fourM, storedFourM);
  const fourMValue = fourMChanged ? fourMBodyOf(fourM) : undefined;
  /* 손대지 않은 예전 기록(변경 종류만 있고 내용 없음)은 막지 않는다 — 고칠 때만 내용을 요구한다(#133). */
  const fourMBlocked = fourMChanged && isFourMIncomplete(fourM);
  const isRejected = judgment === REJECTED_JUDGMENT;
  /*
   * 확정된 불합격 회차면 LOT 이 불량인지 보고 처분·반품으로 잇는다(omf-all-around#106 후속 (나)).
   * 확정된 회차는 판정과 관계없이 LOT 상태를 읽는다 — 검사 대기가 아니면 재검사 단추를 세우지 않는다(#185).
   */
  const followUp = useRejectedLotFollowUp(
    detail.data?.lotId ?? null,
    round?.statusCode === 'CONFIRMED',
  );

  const changeDraft = (next: QuantityDraft): void => {
    setDraft(next);
  };

  /**
   * 수량 초안. **고른 의뢰가 바뀌면 그 회차의 값으로 되돌아간다.**
   *
   * 되돌림을 참조가 아니라 **값**으로 판정한다 — 조회 응답이 다시 그려질 때마다 참조가
   * 달라지므로, 참조로 판정하면 그때마다 사용자가 치던 값이 사라진다.
   *
   * 회차가 없으면 빈 초안이다. ⛔ 0을 미리 채우지 않는다 — 채우면 「검사자가 0으로 판정했다」와
   * 「아직 아무것도 넣지 않았다」가 화면에서 같아 보인다.
   *
   * ⭐ **고른 의뢰(`selectedId`)가 의존성에 든다.** 회차 값만 보면 **회차가 없는 의뢰끼리
   * 옮길 때** 네 값이 모두 그대로여서(`null`·0·0·0) effect 가 깨어나지 않고, 앞 의뢰에 친
   * 수량이 다음 의뢰 화면에 남는다. 저장이 붙는 순간 **다른 LOT 에 앞 의뢰의 수량을 저장**하는
   * 길이 된다 — 값이 그럴듯해서 아무도 눈치채지 못한다.
   */
  const [draft, setDraft] = useState<QuantityDraft>(EMPTY_QUANTITY_DRAFT);

  /*
   * 불량 코드 · 원인은 「불량 등록」을 켰거나 고칠 회차가 있을 때 부른다 — 저장된 불량 기록을 되살리려면 코드가 있어야 한다.
   * 끈 채 불합격이면 불량 내역이 비었다고 막는다.
   */
  const needsDefectCodes = hasDefects || editingResultId !== null;
  const defectCodes = useDefectCodes(needsDefectCodes);
  /* 추정 원인(omf-all-around#130) — 선택 입력. */
  const causeCodes = useCauseCodes(needsDefectCodes);
  const resolvedDefects = hasDefects
    ? resolveDefects(defectCodes.data ?? [], defects, toSendableNumber(draft.rejected))
    : resolveDefects([], [], 0);

  const roundId = round?.inspectionResultId ?? null;
  const { acceptedQty, rejectedQty, heldQty } = round ?? {
    acceptedQty: 0,
    rejectedQty: 0,
    heldQty: 0,
  };

  const storedJudgment = round?.overallJudgmentCode ?? '';

  /**
   * 회차가 화면에 보일 값. 회차가 없으면 빈 초안이다.
   *
   * ⛔ 0을 미리 채우지 않는다 — 채우면 「검사자가 0으로 판정했다」와 「아직 아무것도 넣지
   * 않았다」가 화면에서 같아 보인다.
   */
  const draftOf = (
    source: {
      acceptedQty: number;
      rejectedQty: number;
      heldQty: number;
    } | null,
  ): QuantityDraft =>
    source === null
      ? EMPTY_QUANTITY_DRAFT
      : {
          accepted: String(source.acceptedQty),
          rejected: String(source.rejectedQty),
          held: String(source.heldQty),
        };

  useEffect(() => {
    /*
     * ⚠ 「저장했습니다」는 여기서 지우지 않는다 — 저장 뒤 다시 부른 회차 값으로 이 자리가 다시 돌면 방금 한 저장을
     * 지워 버린다(#133 실검증). 고른 의뢰가 바뀔 때(아래)와 값을 고칠 때(`changeDraft` 등) 지운다.
     */
    setIsJustConfirmed(false);
    /*
     * ⭐ 재검사 모드도 함께 푼다 — 저장이 새 회차를 만들면 `roundId` 가 바뀌어 여기로 오고,
     * 그 회차는 이제 «실재하는 작성중 회차»라 재검사 모드로 남아 있으면 다음 저장이 또 새
     * 회차를 만든다. 고른 의뢰가 바뀔 때 풀리는 것도 같은 자리다.
     */
    setIsReinspecting(false);
    autoFilledJudgment.current = null;
    setJudgment(storedJudgment);
    setDraft(draftOf(roundId === null ? null : { acceptedQty, rejectedQty, heldQty }));
  }, [selectedId, roundId, acceptedQty, rejectedQty, heldQty, storedJudgment]);

  /*
   * 불합격 사유는 «의뢰가 바뀔 때만» 비운다(3단계 검증 버그 · omf-all-around#106). 위 되돌림에 묶여 있으면 저장 응답이
   * 회차·판정을 바꾸는 순간 사유가 사라져 확정이 다시 잠겼다. 재검사 회차를 열 때는 그 자리에서 따로 비운다.
   */
  const restoredFor = useRef<number | null>(null);
  /* 되살린 기록의 코드가 코드 마스터에 없어 사유 글만 되살렸는가 — 그러면 코드를 새로 고르기 전에는 기록을 건드리지 않는다. */
  const restoredTextOnly = useRef(false);
  useEffect(() => {
    setDefects([EMPTY_DEFECT]);
    setSavedDefects([EMPTY_DEFECT]);
    setHasDefects(false);
    setSavedHasDefects(false);
    setChangeReason('');
    restoredFor.current = null;
    restoredTextOnly.current = false;
    skipRestoreOfCreated.current = false;
  }, [selectedId]);

  /*
   * 임시 저장된 사유를 되살린다(omf-all-around#122) — 확정 전 회차마다 «한 번만». 다시 부를 때마다 덮으면 저장 뒤
   * 재조회가 사용자가 치던 사유를 지운다. 기록이 상세 코드면 대분류를 찾아야 하므로 코드 마스터를 기다린다.
   */
  const draftRejection = useDraftRejectionRecords(editingResultId);
  useEffect(() => {
    if (editingResultId === null || restoredFor.current === editingResultId) return;
    restoredTextOnly.current = false;
    /* POST 로 막 만든 회차 — 되살리면 응답을 기다리는 사이 사용자가 고친 사유를 덮는다(#122 리뷰 m1). */
    if (skipRestoreOfCreated.current) {
      skipRestoreOfCreated.current = false;
      restoredFor.current = editingResultId;
      return;
    }
    const records = draftRejection.data;
    if (records === undefined) return;
    if (records.length === 0) {
      restoredFor.current = editingResultId;
      /* 불량 기록 없이 불합격 수량만 저장된 회차(예전 화면) — 그 수량을 코드 없는 한 줄로 연다(#197). */
      if (rejectedQty > 0) {
        const legacy = [{ ...EMPTY_DEFECT, qty: String(rejectedQty) }];
        setDefects(legacy);
        setSavedDefects(legacy);
        setHasDefects(true);
        setSavedHasDefects(true);
      }
      return;
    }
    if (defectCodes.data === undefined) return;
    const known = defectCodes.data;
    restoredFor.current = editingResultId;
    restoredTextOnly.current = records.some(
      (record) => !known.some((code) => code.defectCodeId === record.defectCodeId),
    );
    /* 불량 기록 여럿 → 불량 내역 줄 여럿(#197). */
    const restored = records.map((record) => defectDraftOf(known, record));
    setDefects(restored);
    setSavedDefects(restored);
    setHasDefects(true);
    setSavedHasDefects(true);
  }, [editingResultId, draftRejection.data, defectCodes.data]);

  /*
   * 마지막 저장 상태와 견줘 바뀐 것이 있는가 — 없으면 [임시 저장]을 끈다. 견주는 것은 세 수량 칸과
   * 종합 판정이다. 회차가 없거나 재검사 회차를 쓰는 중이면 기준은 빈 초기 상태다.
   * ⛔ 저장 요청 본문·계산·검증·확정 조건과는 무관하다 — 단추를 켜고 끄는 데만 쓴다.
   */
  const savedDraft = isReinspectingNow ? EMPTY_QUANTITY_DRAFT : draftOf(round);
  const savedJudgment = isReinspectingNow ? '' : storedJudgment;
  const hasChanges =
    draft.accepted !== savedDraft.accepted ||
    draft.rejected !== savedDraft.rejected ||
    draft.held !== savedDraft.held ||
    judgment !== savedJudgment ||
    (isRejected &&
      (hasDefects !== savedHasDefects ||
        (hasDefects && JSON.stringify(defects) !== JSON.stringify(savedDefects)))) ||
    fourMChanged;

  const rows = queue.data?.rows ?? [];
  const pageView = toPageView(queue.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  /**
   * 조건을 바꾼다. **첫 쪽으로 가고 고른 의뢰가 풀린다** — 결과가 통째로 달라지므로
   * 3쪽을 보다가 좁히면 결과가 3쪽에 못 미쳐 「좁혔더니 아무것도 없다」로 보이고, 고른 의뢰는
   * 새 결과에 없을 수 있다. 두 일을 `toSearchParams` 가 한 자리에서 한다.
   */
  const applyFilters = (next: QueueFilters): void => {
    // 같은 조건의 '조회'도 사용자가 서버를 다시 보겠다는 명시적 액션이다.
    // URL/React Query 키가 그대로면 외부 POP가 새로 만든 의뢰가 캐시에 가려진다.
    if (
      page === 1 &&
      next.itemId === filters.itemId &&
      next.supplierId === filters.supplierId &&
      next.keyword === filters.keyword &&
      next.pendingOnly === filters.pendingOnly &&
      next.statusCode === filters.statusCode
    ) {
      void queue.refetch();
    }
    /* 상세가 목록 옆에 열려 있으면 그대로 둔다(#185) — 조회 한 번에 쓰던 판정 입력이 사라지지 않게. */
    const params = toSearchParams(next);
    if (selectedId !== null) params.set(URL_KEYS.selected, String(selectedId));
    /* 고른 쪽 크기는 조회해도 그대로다(#197). */
    if (pageSize !== PAGE_SIZE) params.set(URL_KEYS.size, String(pageSize));
    setSearchParams(params);
  };

  /**
   * 탭 줄 상태 칩(#185). 첫 쪽으로 가지만 **고른 의뢰는 그대로 둔다** — 상세에서 눌러도 쓰던 판정 입력을
   * 잃지 않고, 목록으로 돌아가면 거른 결과가 선다.
   */
  const applyStatus = (statusCode: InspectionHubStatus | null): void => {
    const next = toSearchParams(withStatus(filters, statusCode));
    if (selectedId !== null) next.set(URL_KEYS.selected, String(selectedId));
    if (pageSize !== PAGE_SIZE) next.set(URL_KEYS.size, String(pageSize));
    setSearchParams(next);
  };

  /** 쪽만 옮긴다 — 조건과 고른 의뢰는 그대로다. */
  const goToPage = (next: number): void => {
    setSearchParams(toPageParams(searchParams, next));
  };

  /* 고른 의뢰를 주소에 싣거나(`null` 이면) 뺀다 — 검색 조건 · 쪽은 그대로. */
  const openRequest = (inspectionRequestId: number | null): void => {
    const next = new URLSearchParams(searchParams);
    if (inspectionRequestId === null) next.delete(URL_KEYS.selected);
    else next.set(URL_KEYS.selected, String(inspectionRequestId));
    setSearchParams(next);
  };

  /*
   * 목록과 상세가 한 화면에 나란히 선다(#185) — 상세를 쓰는 중에 다른 줄을 누르거나 상세를 닫으면,
   * 저장하지 않은 입력이 있을 때 바로 옮기지 않고 한 번 묻는다(#133 의 「목록으로」와 같은 팝업).
   * `to` 가 `null` 이면 상세 닫기다.
   */
  const [leaveTo, setLeaveTo] = useState<{ to: number | null; href?: string } | null>(null);
  useEffect(() => {
    setLeaveTo(null);
  }, [selectedId]);
  const moveTo = (to: number | null): void => {
    if (to === selectedId) return;
    if (selectedId !== null && hasUnsavedInput) {
      setLeaveTo({ to });
      return;
    }
    openRequest(to);
  };
  /* 고른 줄을 다시 누르면 고르지 않은 상태로 — 상세가 닫힌다(저장 안 한 입력이 있으면 먼저 묻는다 · 사용자 지시 2026-10-28 · #197). */
  const select = (inspectionRequestId: number): void =>
    moveTo(inspectionRequestId === selectedId ? null : inspectionRequestId);

  /* 다른 화면으로 이동(기본 정보 [기준 보기] · #185) — 같은 탭에서 옮긴다. 저장하지 않은 입력이 있으면 먼저 묻는다. */
  const navigate = useNavigate();
  /* 「기준 조회」 창(#197). */
  const [isPlanViewOpen, setIsPlanViewOpen] = useState(false);
  const leaveFor = (href: string): void => {
    if (selectedId !== null && hasUnsavedInput) {
      setLeaveTo({ to: selectedId, href });
      return;
    }
    void navigate(href);
  };

  /* 목록 · 상세 배치 — 입하 예정 조회와 같은 좌우 분할, 가운데 막대로 폭을 나눈다(비율은 브라우저에 남는다). */
  const { splitRef, aboveRef } = useFitToViewport();
  const split = usePaneSplit('omf-mes:iqc-inspection:split', 0.45);
  /* 좌우 · 상하 배치(사용자 지시 2026-10-26) — 세 탭이 같은 고름을 쓴다. */
  const layout = useSplitOrientation('omf-mes:inspection-hub:split-orientation');
  /*
   * 위아래로 쌓인 화면에서 의뢰를 고르거나 상세 주소로 들어오면 상세(입력 자리)가 바로 보이게 내린다(사용자 지시 2026-10-29 ·
   * #197). 나란히 설 때는 상세가 이미 옆에 보여 옮기지 않는다. 위 목록 · 상세 내용이 다 선 뒤에 한 번 옮긴다 — 먼저 옮기면
   * 늦게 선 목록이 상세를 다시 밀어낸다.
   */
  const sideBySideFits = useSideBySideFits();
  const isStacked = layout.orientation === 'column' || !sideBySideFits;
  const detailRef = useRef<HTMLElement>(null);
  const scrolledFor = useRef<number | null>(null);
  const isLaidOut =
    queue.data !== undefined && detail.data !== undefined && rounds.data !== undefined;
  useEffect(() => {
    if (selectedId === null) {
      scrolledFor.current = null;
      return;
    }
    if (!isStacked || !isLaidOut || scrolledFor.current === selectedId) return;
    scrolledFor.current = selectedId;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    detailRef.current?.scrollIntoView?.({
      block: 'start',
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  }, [selectedId, isStacked, isLaidOut]);

  /**
   * 표 자리에 그릴 것. **네 갈래를 가른다** — 실패 · 부르는 중 · 이 쪽에 없음 · 조건에 맞는 것 없음.
   *
   * ⭐ **실패를 「결과 없음」으로 접지 않는다.** 접으면 요청이 실패했을 뿐인데 표가 「조건을
   * 넓혀 보세요」라고 말하고, 사용자는 조건을 넓히다가 결국 못 찾는다 — 실제로 할 일은 다시
   * 시도하거나 담당자에게 알리는 것이고 그것은 배너가 말한다.
   *
   * ⭐ 「이 쪽에 없음」과 「조건에 맞는 것이 없음」도 합치지 않는다. 앞은 **쪽이 문제**라
   * 앞쪽으로 가면 풀리고, 뒤는 **조건이 문제**라 조건을 넓혀야 풀린다.
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

  /*
   * 회차가 있으면 그 회차의 검사수량이고, 없으면 기준 버전의 샘플링 규칙으로 정한다(omf-all-around#102).
   * 규칙을 아직 못 받았으면 의뢰수량 — 종전 동작이다.
   */
  const samplingRule = useSamplingRule(detail.data?.inspectionPlanVersionId ?? null);
  /* 검사기준 화면 주소 — 그 기준 · 버전을 바로 연다([기준 조회] 창의 [수정] · #197). */
  const planHref =
    samplingRule.data === undefined || detail.data?.inspectionPlanVersionId == null
      ? null
      : `/master-data/inspection-standard?plan=${String(samplingRule.data.inspectionPlanId)}&ver=${String(detail.data.inspectionPlanVersionId)}`;
  const inspectedQty =
    round?.inspectedQty ?? sampleQtyOf(detail.data?.targetQty ?? 0, samplingRule.data ?? null);

  /*
   * 합격판정개수 기준 자동 판정(omf-all-around#125) — 기준에 합격판정개수가 있을 때만. 수량을 고치면 판정을 채우고
   * (사용자가 다시 바꿀 수 있다), 다르게 고르면 변경 사유를 받아야 확정된다. 확정된 회차에는 걸지 않는다.
   * 합격판정개수가 없어도 검사 수량 전부가 합격이면 「합격」을 채운다 — 이때는 변경 사유를 받지 않는다(#197).
   * ⚠ 자동 채움은 불합격 사유 칸을 비우지 않는다 — 수량을 치는 도중 판정이 잠깐 바뀌어도 친 사유가 남는다.
   */
  const acceptanceNumber = samplingRule.data?.acceptanceNumber ?? null;
  const isOpenRound = isReinspectingNow || round?.statusCode !== 'CONFIRMED';
  const expectedJudgment = isOpenRound ? expectedJudgmentOf(draft, acceptanceNumber) : null;
  const needsChangeReason = needsJudgmentChangeReason(judgment, expectedJudgment);
  /*
   * 떠날 때 물을 입력 — 판정 변경 사유는 임시 저장에 실리지 않고 확정에만 실리므로(P-70) 위 「바뀐 것」에 없다.
   * 그래도 친 사유는 떠나면 사라지므로 묻는다(#133 실검증). 사유 칸이 서 있을 때만 묻는다(확정된 회차 · 자동 판정과 같은 판정에는 칸이 없다).
   * ⛔ 확정된 회차는 고칠 칸이 없으니 묻지 않는다 — 확정 직전에 고른 값이 「바뀐 것」으로 남아 있어도 이미 확정에 실렸다.
   */
  const hasUnsavedInput =
    isOpenRound && (hasChanges || (needsChangeReason && changeReason.trim() !== ''));
  /* 불량 내역 합계 → 불합격 수량 칸의 글. 0 이면 비운다. */
  const rejectedTextOf = (rows: readonly DefectDraft[]): string => {
    const sum = defectSumOf(rows);
    return sum > 0n ? formatMicro(sum) : '';
  };
  const applyAutoJudgment = (next: QuantityDraft): void => {
    const expected = isOpenRound ? autoJudgmentOf(next, acceptanceNumber, inspectedQty) : null;
    if (expected !== null) {
      autoFilledJudgment.current = expected;
      setJudgment(expected);
    } else if (autoFilledJudgment.current !== null && judgment === autoFilledJudgment.current) {
      autoFilledJudgment.current = null;
      setJudgment('');
    }
  };
  const changeDraftAndJudge = (next: QuantityDraft): void => {
    changeDraft(next);
    applyAutoJudgment(next);
  };
  /* 수량 옆 단위 코드(표시 전용). 회차는 의뢰의 단위로 저장되므로(저장 요청의 `uomId`) 의뢰 단위 하나를 쓴다. */
  const uoms = useUomLookup();

  /*
   * 품목·자재 LOT 은 **번호마다 하나씩** 이름으로 푼다 — 계약이 식별자만 싣고, 번호를 그대로
   * 보이면 검사자가 무엇을 검사하는지 알 수 없다(omf-all-around#40).
   *
   * 큐에 선 줄과 고른 의뢰를 **함께** 넘긴다 — 고른 의뢰가 다른 쪽에 있으면 큐에 없어서,
   * 큐만 넘기면 상세의 이름이 비는 자리가 생긴다.
   */
  const itemNames = useItemNames([...rows.map((row) => row.itemId), detail.data?.itemId]);
  const lotNumbers = useLotNumbers([...rows.map((row) => row.lotId), detail.data?.lotId]);
  const lotSuppliers = useLotSuppliers(rows.map((row) => row.lotId));
  const uomCode = uoms.codeOf(detail.data?.uomId);

  /*
   * 이력에 실을 회차. 평소에는 최신을 뺀 나머지이고, **재검사 중에는 최신도 함께 싣는다** —
   * 그 회차는 지금 쓰는 새 회차의 «앞»이 됐으므로 이력 쪽이 제자리다.
   */
  const historyRounds = isReinspectingNow
    ? [...(rounds.data ?? [])].sort((left, right) => right.inspectionRound - left.inspectionRound)
    : previousRounds(rounds.data ?? []);

  /*
   * ⚠ **검사 시점에 고정된 기준 버전으로 부른다** — 의뢰가 준 버전을 그대로 쓰고 「최신
   * 기준」을 찾지 않는다. 최신을 부르면 검사자가 재지 않은 항목이 그리드에 나타난다.
   */
  const itemSpecs = useInspectionItemSpecs(detail.data?.inspectionPlanVersionId ?? null);
  /*
   * ⚠ **재검사 중에는 앞 회차의 측정치를 그리지 않는다.** 그리면 아직 아무것도 재지 않은 새
   * 회차에 앞 회차의 값이 들어 있는 것처럼 보이고, 검사자가 그것을 자기가 잰 값으로 읽는다.
   */
  const measurements = useMeasurements(
    isReinspectingNow ? null : (round?.inspectionResultId ?? null),
  );

  const measurementRows = toMeasurementRows(
    itemSpecs.data ?? [],
    measurements.data ?? [],
    uoms.codeOf,
  );

  /**
   * 저장이 보낼 값을 만든다.
   *
   * 수량은 `toSendableNumber` 를 거친다 — 화면이 재는 자와 보내는 자가 같아야 한다.
   *
   * ⛔ **검사자·단말을 보내지 않는다** — 계약에서 사라졌다(omf-mes#173).
   *
   * 고른 의뢰를 **인자로 받는다** — 이 자리에 도달했으면 null 이 아니라는 사실이 타입이
   * 아니라 렌더 조건에 있어서, 단언으로 메우면 그 조건이 바뀔 때 조용히 어긋난다.
   */
  /**
   * 요청에 실을 불량 기록 — 불합격이고 불량 내역을 다 채웠으면 그 줄들, 아니면 빈 배열이다(#197). 서버는 불합격 판정에만
   * 불량 기록을 받는다 — 합격 · 보류면 빈 배열이 그 회차의 기록을 지운다.
   */
  const rejectionRows = (): DefectRecordInput[] =>
    !isRejected || !('rows' in resolvedDefects) ? [] : resolvedDefects.rows;

  const saveDraft = (inspectionRequestId: number, inspected: number, uomId: number): void => {
    const rows = rejectionRows();
    /*
     * ⛔ 이 회차의 사유를 아직 되살리지 못했으면(조회 중·실패) 사유 키를 싣지 않는다 — 빈 배열을 실으면 서버의 사유가
     * 지워진다(#122 리뷰 M2). 코드 없이 글만 되살린 경우도 코드를 고르기 전에는 같다.
     */
    const unknownOnServer =
      (editingResultId !== null && restoredFor.current !== editingResultId) ||
      (restoredTextOnly.current && rows.length === 0);
    /*
     * ⛔ 불합격인데 불량 줄이 덜 채워졌으면(코드 · 수량) 불량 키를 싣지 않는다 — 빈 배열을 실으면 서버가 이 회차의 기록을
     * 지운다(#197 리뷰). 적던 줄은 화면에 그대로 둔다.
     */
    const defectsIncomplete = isRejected && hasDefects && 'blocked' in resolvedDefects;
    const defectsBody = unknownOnServer || defectsIncomplete ? undefined : rows;
    pendingHasDefects.current = unknownOnServer
      ? savedHasDefects
      : defectsIncomplete || rows.length > 0;
    pendingDefects.current = unknownOnServer
      ? savedDefects
      : defectsIncomplete
        ? defects
        : rows.length === 0
          ? [EMPTY_DEFECT]
          : defects;
    savingNewRound.current = editingResultId === null;
    save.write({
      inspectionRequestId,
      inspectedQty: inspected,
      acceptedQty: toSendableNumber(draft.accepted),
      rejectedQty: toSendableNumber(draft.rejected),
      heldQty: toSendableNumber(draft.held),
      uomId,
      /*
       * ⛔ **고른 판정을 함께 싣는다.** 싣지 않으면 저장 뒤 재조회가 저장 전 판정을 돌려주고
       * 되돌림이 사용자가 고른 값을 덮는다 — 그러고 확정하면 «고른 것과 다른 판정»이 나가는데
       * 그 쓰기는 되돌릴 수 없다.
       */
      overallJudgmentCode: judgment,
      /* 검사한 시각은 지금이다. 순수 함수가 아니라 이 자리에서 읽는다. */
      inspectedAt: new Date().toISOString(),
      /*
       * 재검사면 앞 회차를 가리킨다 — 이 값이 있어야 서버가 회차를 +1 하고 사슬을 잇는다.
       * ⛔ 빠뜨리면 같은 의뢰에 회차 1이 두 번 만들어지려 해 `UNIQUE(의뢰, 회차)` 에 걸린다.
       */
      previousResultId: reinspectingFrom,
      defects: defectsBody,
      fourMChange: fourMValue,
    });
  };

  /**
   * 우측 창. **네 갈래다** — 고르지 않음 · 부르는 중 · 실패 · 상세.
   *
   * ⛔ 실패를 「고르지 않음」으로 접지 않는다. 접으면 고른 것이 사라진 것처럼 보여
   * 사용자가 다시 고르는데, 다시 골라도 같은 실패가 온다.
   */
  const detailContent = detail.isError ? (
    <div className="inspection-basic-card">
      <QueueLoadErrorBanner
        error={toApiError(detail.error)}
        onRetry={() => void detail.refetch()}
      />
    </div>
  ) : detail.data === undefined ? (
    <div className="inspection-basic-card">
      <p className="field-note">{t.detail.loading}</p>
    </div>
  ) : (
    <>
      <div className="inspection-basic-card">
        <RequestDetailPane
          detail={detail.data}
          itemNames={itemNames}
          lotNumbers={lotNumbers}
          planSlot={
            samplingRule.data === undefined ||
            detail.data.inspectionPlanVersionId === null ? undefined : (
              /*
               * 적용 검사 기준 — 버전 + [기준 조회]. 조회이므로 화면을 옮기지 않고 창으로 보인다(사용자 지시 2026-10-27 · #197).
               * 창의 [수정]이 같은 탭에서 검사기준 화면으로 옮긴다(저장 안 한 입력이 있으면 먼저 묻는다). 검사기준 화면은
               * 주소의 `plan`·`ver` 로 그 기준 · 버전을 바로 연다.
               */
              <span className="iqc-inspection-plan-cell">
                <span>{t.detail.planVersion(samplingRule.data.planVersion)}</span>
                {/* 옆 「검사 수준 · 지정」과 같은 단추(테두리 · md) — 사용자 지시 2026-10-26. */}
                <Button size="md" variant="outlined" onClick={() => setIsPlanViewOpen(true)}>
                  {t.detail.openPlan}
                </Button>
                {isPlanViewOpen && (
                  <PlanViewDialog
                    rule={samplingRule.data}
                    rows={measurementRows}
                    isLoading={itemSpecs.isLoading}
                    onClose={() => setIsPlanViewOpen(false)}
                    onEdit={() => {
                      setIsPlanViewOpen(false);
                      if (planHref !== null) leaveFor(planHref);
                    }}
                  />
                )}
              </span>
            )
          }
          levelSlot={
            <ItemLevel
              key={detail.data.itemId}
              itemId={detail.data.itemId}
              item={toLevelItem(itemNames.partsOf(detail.data.itemId))}
            />
          }
        />
      </div>
      {/* IQC 생략(#212) — 요청 정보 아래(OQC·PQC 와 같은 차례). 확정 회차가 있으면 생략으로 덮지 않는다. */}
      {detail.data.lotId !== null &&
        rounds.data !== undefined &&
        rounds.data.every((row) => row.statusCode !== 'CONFIRMED') && (
          <IqcSkipPane
            lotId={detail.data.lotId}
            requestStatusCode={detail.data.statusCode}
            skipBasisCode={detail.data.skipBasisCode}
            workerNo={session?.worker?.workerNo ?? null}
          />
        )}
      {isWorkerConnectOpen && session !== null && (
        <WorkerConnectDialog
          appUserId={session.userId}
          onClose={() => setIsWorkerConnectOpen(false)}
        />
      )}
      {rounds.isPending ? (
        <p className="field-note">{t.result.loading}</p>
      ) : isClosed && round !== null ? (
        <ClosedSummary
          round={round}
          fourMChangeLabel={
            detail.data.fourMChange === null
              ? null
              : [
                  fourMOptions.find(
                    (option) => option.value === detail.data.fourMChange?.changeTypeCode,
                  )?.label ?? detail.data.fourMChange.changeTypeCode,
                  detail.data.fourMChange.remarks,
                ]
                  .filter((part) => part !== undefined && part !== '')
                  .join(' · ')
          }
          judgmentOptions={judgmentOptions}
          uomCode={uomCode}
          followUp={
            followUp.data?.isDefective === true ? (
              <RejectedLotGuide nonconformanceId={followUp.data.nonconformanceId} />
            ) : null
          }
        />
      ) : (
        <ResultFormPane
          /* 의뢰마다 단계 진행 · 펼침을 새로 시작한다 — 앞 의뢰의 진행이 남지 않게(#197 리뷰). */
          key={selectedId}
          /*
           * ⭐ 재검사 중에는 **회차를 넘기지 않는다.** 넘기면 그 회차가 확정본이라 칸이
           * 잠긴 채로 남는다 — 지금 쓰는 것은 확정본이 아니라 «아직 없는 새 회차»다.
           */
          round={isReinspectingNow ? null : round}
          inspectedQty={inspectedQty}
          saveBlockedReason={
            workerMissing
              ? t.result.workerNotLinked
              : fourMBlocked
                ? t.result.fourMChange.blocked
                : null
          }
          isInputLocked={workerMissing}
          onConnectWorker={workerMissing ? () => setIsWorkerConnectOpen(true) : null}
          uomCode={uomCode}
          hasChanges={hasChanges}
          draft={draft}
          onChange={changeDraftAndJudge}
          onSave={() => {
            saveDraft(detail.data.inspectionRequestId, inspectedQty, detail.data.uomId);
          }}
          isSaving={save.isSaving || rounds.isFetching}
          fieldErrors={save.fieldErrors}
          saveError={save.error}
          onReload={() => void rounds.refetch()}
          judgmentOptions={judgmentOptions}
          judgment={judgment}
          /* 불량 내역은 검사 수량 단계의 것이라 판정을 바꿔도 지우지 않는다(#197) — 불합격이 아니면 싣지 않을 뿐이다. */
          onJudgmentChange={(code) => {
            autoFilledJudgment.current = null;
            setJudgment(code);
          }}
          onConfirm={() => {
            const rows = rejectionRows();
            confirm.write({
              overallJudgmentCode: judgment,
              ...(rows.length === 0 ? {} : { defects: rows }),
              ...(needsChangeReason ? { judgmentChangeReason: changeReason.trim() } : {}),
              ...(fourMValue === undefined ? {} : { fourMChange: fourMValue }),
            });
          }}
          isConfirming={confirm.isSaving}
          confirmError={confirm.error}
          renderDefects={
            isOpenRound
              ? () => (
                  <DefectRows
                    checked={hasDefects}
                    onCheckedChange={(checked) => {
                      setHasDefects(checked);
                      changeDraftAndJudge({
                        ...draft,
                        rejected: checked ? rejectedTextOf(defects) : '',
                      });
                    }}
                    codes={defectCodes.data ?? []}
                    causes={causeCodes.data ?? []}
                    rows={defects}
                    onChange={(next) => {
                      setDefects(next);
                      /* 불합격 수량은 불량 내역 수량의 합이다(사용자 시안 2026-10-28 · #197). */
                      changeDraftAndJudge({ ...draft, rejected: rejectedTextOf(next) });
                    }}
                    uomCode={uomCode}
                    disabled={confirm.isSaving || workerMissing}
                    notSaved={judgment !== '' && !isRejected}
                  />
                )
              : null
          }
          judgmentBelow={
            acceptanceNumber !== null && isOpenRound ? (
              <JudgmentChange
                needsReason={needsChangeReason}
                reason={changeReason}
                onReasonChange={(next) => {
                  setChangeReason(next);
                }}
                disabled={confirm.isSaving || workerMissing}
              />
            ) : null
          }
          judgmentHint={
            acceptanceNumber !== null && isOpenRound
              ? t.result.judgmentChange.basis(acceptanceNumber)
              : undefined
          }
          fourMSlot={
            hasFourMTarget && isOpenRound ? (
              <FourMChange
                draft={fourM}
                onChange={(next) => {
                  setFourM(next);
                }}
                disabled={confirm.isSaving || workerMissing}
              />
            ) : null
          }
          reinspectReplacement={
            followUp.data?.isDefective === true ? (
              <RejectedLotGuide nonconformanceId={followUp.data.nonconformanceId} />
            ) : null
          }
          confirmOnlyBlockedReason={
            isRejected && 'blocked' in resolvedDefects
              ? resolvedDefects.blocked
              : needsChangeReason && changeReason.trim() === ''
                ? t.result.judgmentChange.required
                : fourMBlocked
                  ? t.result.fourMChange.blocked
                  : null
          }
          /* ① 수량 [확정]으로 판정 단계로 넘어가며 최종 판정을 자동으로 채운다 — 채울 것이 없으면 그대로 둔다(사용자 지시 2026-10-29). */
          onQtyConfirm={() => applyAutoJudgment(draft)}
          /* 불량 수량에 수량이 아닌 값이 있으면 합계를 셀 수 없다고 보인다(표시 전용 · #197). */
          rejectedUncountable={hasDefects && hasInvalidDefectQty(defects)}
          /* 좌우 · 상하 배치 모두 수량 · 판정을 한 줄로(좁으면 위아래 · 사용자 지시 2026-10-27 · #185). */
          inlineJudgment
          hasJudgmentDetail={needsChangeReason}
          judgmentDone={judgment !== '' && !(needsChangeReason && changeReason.trim() === '')}
          fourMDone={fourM.checked && !isFourMIncomplete(fourM)}
          fourMSummary={
            fourM.checked ? t.result.stepSummary.fourMChanged : t.result.stepSummary.fourMNone
          }
          onJudgmentDetailOpen={() => {
            detailSnapshot.current = { defects, changeReason };
          }}
          onJudgmentDetailCancel={() => {
            if (detailSnapshot.current === null) return;
            setDefects(detailSnapshot.current.defects);
            setChangeReason(detailSnapshot.current.changeReason);
          }}
          reinspectBlockedReason={
            followUp.data?.isInspectionPending === false ? t.result.reinspectLotNotPending : null
          }
          isJustConfirmed={isJustConfirmed}
          isReinspecting={isReinspectingNow}
          onStartReinspection={() => {
            /* 새 회차는 빈 칸에서 시작한다 — 앞 회차의 값이 남으면 그대로 저장된다. */
            setDraft(EMPTY_QUANTITY_DRAFT);
            setJudgment('');
            setDefects([EMPTY_DEFECT]);
            setSavedDefects([EMPTY_DEFECT]);
            setHasDefects(false);
            setSavedHasDefects(false);
            setChangeReason('');
            setIsReinspecting(true);
          }}
          onCancelReinspection={() => {
            setIsReinspecting(false);
            /*
             * ⛔ **확정본의 값을 되돌려 놓는다.** 비우면 그만둔 자리에 확정된 회차가
             * «수량 없이» 놓인다 — 판정이 끝난 기록인데 화면이 비어 있으니 검사자는
             * 자기가 방금 그것을 지웠다고 읽는다.
             */
            setDraft(draftOf(round));
            setJudgment(storedJudgment);
          }}
        />
      )}
    </>
  );

  /*
   * 참고 정보 — 판정보다 뒤에, 상세 카드 밖에 구획마다 상자 하나로(omf-all-around#133). 측정치는 검사와 가장 가까워
   * 펼친 채 시작하고, 이전 회차 · 첨부 문서 · 검사 이력은 접힌 채 시작한다. 내용과 동작은 그대로다.
   */
  /* 회차가 바뀐 표식 — 저장·확정·재검사 뒤 이력을 새로 부른다. 접는 줄의 건수도 같은 조회를 쓴다(#133). */
  const historyRevision = `${String(rounds.data?.length ?? 0)}:${JSON.stringify(round ?? null)}`;
  const historyCount = useInspectionHistory(selectedId, historyRevision).data?.events.length;
  /* 첨부 탭 건수 — 첨부 구획과 같은 조회(캐시)다. LOT 이 없는 의뢰는 0 번 대상이라 부르지 않는다. */
  const attachments = useAttachments('LOT', detail.data?.lotId ?? 0, detail.data?.lotId != null);

  const auxContent =
    detail.isError || detail.data === undefined ? null : (
      /*
       * 검사 항목별 결과 · (이전 회차) · 첨부 파일 · 검사 이력을 탭 하나로(사용자 지시 2026-10-26 · #185 — OQC 상세와 같은 짜임).
       * 의뢰를 바꾸면 첫 탭에서 다시 시작한다. 이전 회차는 회차가 둘 이상일 때만, 첨부는 대상 LOT 이 있을 때만 선다.
       */
      <section className="pane iqc-inspection-panes iqc-inspection-aux iqc-inspection-aux-tabs">
        <Tabs
          key={selectedId}
          aria-label={messages.iqcInspection.detail.auxTabs}
          items={[
            {
              value: 'measurements',
              /* 탭마다 건수를 붙인다(사용자 지시 2026-10-27 · #185). */
              label: `${messages.iqcInspection.measurements.caption} ${messages.iqcInspection.detail.historyCount(measurementRows.length)}`,
              content: (
                <div className="iqc-inspection-tab-body iqc-inspection-fold">
                  {/*
                   * ⚠ **`isPending` 이 아니라 `isLoading` 이다.** 측정치 조회는 회차가 없을 때
                   * 비활성이고, 비활성이면 `isPending` 이 계속 참이라 아직 시작하지 않은 의뢰의
                   * 그리드가 영영 「불러오는 중」이 된다. `isLoading`(= pending && fetching)만
                   * 실제로 부르는 중을 잡는다.
                   */}
                  <MeasurementGrid
                    rows={measurementRows}
                    isLoading={itemSpecs.isLoading || measurements.isLoading}
                    scrollX
                    /* [기준 조회]와 같은 창을 연다(사용자 지시 2026-10-28 · #197). */
                    onViewPlan={
                      samplingRule.data === undefined ||
                      detail.data.inspectionPlanVersionId === null
                        ? undefined
                        : () => setIsPlanViewOpen(true)
                    }
                  />
                </div>
              ),
            },
            /* ⛔ 읽기 전용이다 — 앞 회차는 정정하지 않고 새 회차를 쌓는다(§5-3). */
            ...(historyRounds.length > 0
              ? [
                  {
                    value: 'rounds',
                    label: `${messages.iqcInspection.history.heading} ${messages.iqcInspection.detail.historyCount(historyRounds.length)}`,
                    content: (
                      <div className="iqc-inspection-tab-body iqc-inspection-fold">
                        <RoundHistory
                          rounds={historyRounds}
                          uomCode={uomCode}
                          judgmentOptions={judgmentOptions}
                          scrollX
                        />
                      </div>
                    ),
                  },
                ]
              : []),
            /* LOT 별 시험성적서 등 검사 문서(#58). */
            ...(detail.data.lotId !== null
              ? [
                  {
                    value: 'documents',
                    label:
                      attachments.data === undefined
                        ? messages.inspectionDocuments.heading
                        : `${messages.inspectionDocuments.heading} ${messages.iqcInspection.detail.historyCount(attachments.data.length)}`,
                    content: (
                      <div className="iqc-inspection-tab-body iqc-inspection-fold">
                        <AttachmentPanel
                          key={detail.data.lotId}
                          targetTypeCode="LOT"
                          targetId={detail.data.lotId}
                          scrollX
                          paged
                          bulkDownload
                          /*
                           * 올릴 수 있는 형식 · 크기 라벨 — 같은 줄 오른쪽 끝에 [파일 선택] [업로드](사용자 지시 2026-10-27 · #185).
                           * 클립 아이콘 + 안내, 크기 한도(「10MB」)만 주 색으로 강조(사용자 지시 2026-10-26).
                           */
                          toolbarStart={
                            <span className="iqc-inspection-head-badge iqc-inspection-docs-help">
                              <Icon name="attach_file" size={16} aria-hidden />
                              <span>
                                {messages.inspectionDocuments.help
                                  .split(/(\d+\s*MB)/)
                                  .map((part, index) =>
                                    /^\d+\s*MB$/.test(part) ? (
                                      <strong key={index} className="iqc-inspection-docs-limit">
                                        {part}
                                      </strong>
                                    ) : (
                                      part
                                    ),
                                  )}
                              </span>
                            </span>
                          }
                        />
                      </div>
                    ),
                  },
                ]
              : []),
            /* 검사 대상 이력(#61) — 회차를 저장·확정하면 새로 부른다. 탭 이름에 건수를 붙인다. */
            ...(selectedId !== null
              ? [
                  {
                    value: 'history',
                    label:
                      historyCount === undefined
                        ? messages.inspectionHistory.heading
                        : `${messages.inspectionHistory.heading} ${messages.iqcInspection.detail.historyCount(historyCount)}`,
                    content: (
                      <div className="iqc-inspection-tab-body iqc-inspection-fold">
                        <InspectionHistoryPanel
                          hideSourceLot
                          layout="table"
                          scrollX
                          paged
                          key={`${String(selectedId)}-${String(historyRounds.length)}`}
                          inspectionRequestId={selectedId}
                          judgmentLabelOf={(code) =>
                            judgmentOptions.find((option) => option.value === code)?.label ?? code
                          }
                          revision={historyRevision}
                        />
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </section>
    );

  return (
    <>
      {/* 탭 줄 오른쪽 건수 칩(#185) — 탭 묶음 안에서만 선다. */}
      <InspectionHubCounts
        inspectionTypeCode="IQC"
        statuses={QUEUE_STATUSES}
        active={filters.statusCode}
        onChange={applyStatus}
      />
      <SplitOrientationToggle orientation={layout.orientation} onChange={layout.change} />
      {/* 탭 묶음(검사 조회·판정) 안이면 탭 막대가 화면 이름을 말한다 — 경로·제목을 세우지 않는다(입하 예정 조회와 같다). */}
      {hub === null && (
        <PageHeader
          title={t.title}
          breadcrumb={
            <Breadcrumb
              items={[
                { label: t.breadcrumbRoot },
                { label: t.title },
                /* 상세(판정)를 열면 지금 자리를 한 단계 더 보인다(#133). */
                ...(selectedId === null ? [] : [{ label: t.detail.sectionTitle }]),
              ]}
              aria-label={messages.common.shell.breadcrumb}
            />
          }
        />
      )}

      {/*
       * 목록과 상세(판정)를 한 화면에 나란히 둔다(#185 · 입하 예정 조회와 같다) — 종전(#133)처럼 상세가 목록을
       * 갈아 끼우지 않는다. 의뢰를 고르면(`?ir=`) 오른쪽에 상세가 서고, 검색 조건 · 쪽은 주소에 남는다.
       */}
      {/* 검색 묶음 — 입하 예정 조회처럼 표와 다른 카드에 둔다(#185). LOT 스캔과 조회 조건이 한 줄에 선다. */}
      <section ref={aboveRef} className="pane iqc-inspection-panes iqc-inspection-search">
        {/* LOT 바코드로 대기 의뢰를 바로 연다(#58) — 목록 조건은 그대로 두고 선택만 한다. */}
        <LotScan inspectionTypeCode="IQC" onFound={select} />
        <QueueFilterBar
          appliedFilters={filters}
          /* 상태는 탭 줄 칩이 맡는다 — 조회는 걸린 칩을 그대로 두고, 초기화는 함께 푼다. */
          onSearch={(next) =>
            applyFilters(withDraft(filters, { ...next, pendingOnly: filters.pendingOnly }))
          }
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
          className="pane iqc-inspection-panes iqc-inspection-queue-pane"
          aria-label={t.queue.heading}
        >
          {queue.isError && (
            <QueueLoadErrorBanner
              error={toApiError(queue.error)}
              onRetry={() => void queue.refetch()}
            />
          )}

          <QueueTable
            /* 좌우 · 상하 배치 모두 열 폭을 끌어 넓히면 줄이지 않고 표 안에서 가로로 구른다(사용자 지시 2026-10-27 · #185). */
            scrollX
            rows={rows}
            itemNames={itemNames}
            lotNumbers={lotNumbers}
            suppliers={lotSuppliers}
            selectedId={selectedId}
            onSelect={select}
            empty={emptyContent}
          />

          {/*
           * ⛔ **셀 것이 없으면 그리지 않는다.** 조회가 끝나기 전이나 실패했을 때는 총계를
           * 모르는데, 그리면 대신 넘긴 0이 「전체 0건」이라는 **사실 주장**이 되어 화면에 선다.
           */}
          {/* 상세 탭 표와 같은 쪽 이동 — 총 건수 · 10 · 20 · 50건 · [처음] [이전] n/N [다음] [마지막](사용자 지시 2026-10-27 · #197). */}
          {queue.data !== undefined && (
            <PageNav
              meta={queue.data.page}
              sizes={LIST_PAGE_SIZES}
              /* 쪽 이동 단추는 종전처럼 크게, 건수 선택은 작게(사용자 지시 2026-10-27 · 2026-10-29 · #197). */
              buttonSize="md"
              onChangePage={goToPage}
              onChangeSize={(next) => setSearchParams(toPageSizeParams(searchParams, next))}
            />
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
          ref={detailRef}
          className="pane iqc-inspection-panes iqc-inspection-detail"
          aria-label={t.detail.heading}
        >
          {selectedId === null ? (
            <EmptyState
              size="sm"
              title={hubText.pickRequest}
              description={hubText.pickRequestHint}
            />
          ) : (
            <>
              {detailContent}
              {auxContent}
            </>
          )}
        </section>
      </div>

      {/*
       * 저장하지 않고 떠날지 묻는 팝업(#133) — 한 줄 설명, [계속 작성](테두리) [저장하지 않고 이동](채움).
       * × 는 두지 않는다. Esc·바깥 누름은 «계속 작성»과 같다 — 입력은 그대로 남는다.
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
              <Button
                variant="filled"
                onClick={() =>
                  leaveTo.href === undefined ? openRequest(leaveTo.to) : void navigate(leaveTo.href)
                }
              >
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

/**
 * OA 공장 전용(사용자 지시 2026-10-29) — 부품 공장은 수입검사 화면이 달라 따로 만든다. 계정 범위에 OA 공장이 없으면 안내만
 * 보이고 조회를 보내지 않는다.
 */
export const IqcInspectionScreen = () => (
  <OaOnlyGate title={t.title} breadcrumbRoot={t.breadcrumbRoot}>
    <IqcInspectionScreenBody />
  </OaOnlyGate>
);

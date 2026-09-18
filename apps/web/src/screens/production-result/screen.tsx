import { AlertBanner, Button, Card, Checkbox, Chip, Dialog, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { NumericKeypad } from '@omf-mes/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useRef, useState } from 'react';

import { OutboxStallBanner } from '../../patterns/outbox-stall-banner';
import { soleProcessIdOf, usePopIdentity } from '../../patterns/pop-identity';
import { PopSelect as Select } from '../../patterns/pop-select';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { PopWorkerTag } from '../../patterns/pop-worker-tag';
import { useResultEntry } from './entry-context';
import { useFlowGates } from './flow-gating';
import { useDocumentIssue, useLotComplete, useSerialIssue } from './flow-mutations';
import { useLabelPrintRunner, type PrintTarget } from './flow-print';
import {
  buildSessionEnd,
  isRetryableEndFailure,
  judgeSessionEnd,
  useOpenWorkSession,
  useWorkSessionEnd,
} from './session';
import { buildProductionLotLabel } from './label-tspl';
import {
  defaultPrinter,
  latestIssue,
  useCompletedLots,
  CurrentLotAmbiguousError,
  useCurrentLot,
  useLotDetail,
  useItem,
  useLotIssues,
  usePrinters,
  useReissueReasons,
  useSerials,
  useTagIssueSummary,
} from './flow-queries';
import {
  buildLotComplete,
  buildLotIssue,
  buildTagIssue,
  appliedGoodQty,
  canMatchIdentificationCount,
  chunkTargets,
  completedLotPageBoundary,
  hasSucceededIdentificationPrint,
  judgeLotScan,
  missingIdentificationCount,
  requiresIdentificationTag,
  nextBatchCount,
  type DocumentIssueCreate,
} from './flow-state';
import { useOutbox, type OutboxEntry } from './outbox';
import {
  GOOD_QTY_MAX_LENGTH,
  exceedsRemaining,
  formatQty,
  parseGoodQty,
  remainingQty,
} from './quantity-draft';
import { usePendingPqc, useWorkOrder } from './queries';
import { buildSaveBody } from './save-request';
import { useUomLookup } from './uom-lookup';
import { isEmergency } from './work-order-type';

const t = messages.productionResult;

/**
 * ⛔ **`IDENTIFICATION_TAG` 발행은 서버가 항상 422 `STATE_LOCKED` 로 거부한다**(대응표 P1
 * 「공용 문서 발행」· I-27 마감 결정). 눌러도 실패만 반복되므로 이 문서 유형의 발행 동작
 * 자체를 잠근다 — 아래 네 함수(`issueTags`·`retryTagDocumentIssue`·`restoreTagDocuments`·
 * `reissueTags`) 모두 이 상수를 먼저 보고, 참이면 `POST /app/document-issues` 를 부르지 않고
 * 돌아간다. 단추도 함께 비활성화해 «눌러도 반응 없음»이 아니라 지금 쓸 수 없는 동작으로
 * 보이게 한다. 서버가 지원을 시작하면 이 상수 하나만 되돌리면 된다.
 *
 * ⚠ **결과 저장 게이팅(`canOutput`)은 그대로 둔다.** 인식표 대상 품목은 인식표를 낼 수 없어
 * `hasTagDocuments` 가 참이 될 수 없고, 그래서 결과 저장도 함께 막힌다 — 이것을 완화하는 것은
 * 업무 규칙을 새로 정하는 일이라 여기서 임의로 정하지 않는다(추측 금지). 설계팀 확정을
 * 기다린다.
 */
const IDENTIFICATION_TAG_ISSUE_LOCKED = true;

type OutputPhase =
  | 'idle'
  | 'queued'
  | 'issuing'
  | 'printing'
  | 'scanReady'
  | 'issueFailed'
  | 'renditionFailed'
  | 'printFailed'
  | 'reportFailed'
  | 'legacyMismatch'
  | 'completing'
  | 'completed';

/**
 * 작업 세션 자동 종료의 진행 상태. **출력 흐름(`OutputPhase`)과 다른 축이다** — 저쪽은 LOT
 * 하나를 내보내는 동안의 단계이고, 이쪽은 작업지시를 다 돌린 뒤 한 번 일어나는 일이다.
 */
type SessionPhase = 'idle' | 'ending' | 'ended' | 'alreadyEnded' | 'failed' | 'denied';

/**
 * 사람이 [세션 종료 재시도] 를 눌러 세운 방아쇠.
 *
 * ⭐ **LOT 번호 자리에 앉지만 LOT 이 아니다.** 이 길로 올 때는 이미 LOT 이 없다 — 담을 번호가
 *    없어 `null` 을 넣으면 방아쇠가 서지 않는다. 어떤 LOT 번호와도 겹치지 않는 값을 쓴다.
 */
const RETRY_ARMED = -1;

const quantityInput = (value: string): string => {
  const cleaned = value.replace(/[^\d.]/gu, '');
  const [whole = '', ...fractions] = cleaned.split('.');
  /*
   * ⛔ **앞자리 0 을 쌓지 않는다**(사용자 지시 2026-09-10 · 키패드도 같은 규칙이다). `011` 은
   *    `11` 과 같은 수인데 글자가 달라, 되돌릴 수 없는 기록에 실리면 나중에 같은 값인지 눈으로
   *    판단해야 한다. ⚠ `0.5` 의 앞자리 0 은 남긴다 — 그것은 뜻을 갖는 자리다.
   */
  const trimmed = whole.replace(/^0+(?=\d)/u, '');
  const normalized = fractions.length === 0 ? trimmed : `${trimmed}.${fractions.join('')}`;

  return normalized.slice(0, GOOD_QTY_MAX_LENGTH);
};

const targetsOf = (
  issues: readonly { documentIssueLogId: number; target: { displayName: string } }[],
): PrintTarget[] =>
  issues.map((issue) => ({
    documentIssueLogId: issue.documentIssueLogId,
    label: issue.target.displayName,
  }));

/**
 * 라벨에 실을 값. **LOT 번호는 `lot.lotNo` 에서만 온다** — 마감 스캔이 대조하는 값과 같은
 * 자리라야 찍은 QR 이 그 스캔을 통과한다(`judgeLotScan`).
 */
interface LotLabelSource {
  lotNo: string;
  itemCode: string | undefined;
  workOrderNo: string | undefined;
  qty: number | null;
  uomCode: string | null;
}

/**
 * 인쇄 대상에 **화면이 직접 짠 라벨 명령을 실어** 보낸다.
 *
 * ⭐ **서버 렌디션을 쓰지 않는다**(사용자 지시 2026-09-16 · `label-tspl` 머리말). 서버 판은
 *   100 × 60 mm 좌표라 현장 80 × 30 mm 라벨지에서 잘려 나왔다. 배치는 단말 진단 인쇄
 *   (`Ctrl+Alt+P`)·자재 LOT 라벨과 같은 자리를 쓴다.
 *
 * ⚠ **현재 LOT 을 모르면 부르지 않는다** — 부르는 세 자리 모두 그 LOT 의 발행 기록을 손에 쥐고
 *   있다. 그때만 라벨이 있을 수 있다.
 */
const lotTargetsOf = (
  issues: readonly {
    documentIssueLogId: number;
    issueSeq: number;
    target: { displayName: string };
  }[],
  source: LotLabelSource,
): PrintTarget[] =>
  issues.map((issue) => ({
    documentIssueLogId: issue.documentIssueLogId,
    label: issue.target.displayName,
    command: buildProductionLotLabel({
      itemCode: source.itemCode ?? '-',
      lotNo: source.lotNo,
      qty: source.qty,
      uomCode: source.uomCode,
      issueSeq: issue.issueSeq,
      workOrderNo: source.workOrderNo ?? '-',
    }),
  }));

/** P-02-04 생산 실적·인식표·생산 LOT 라벨·스캔 마감을 한 주소와 한 상태 흐름으로 묶는다. */
export const ProductionFlowScreen = () => {
  const titleId = useId();
  const actualQtyId = useId();
  const scanId = useId();

  const entry = useResultEntry();
  const queryClient = useQueryClient();
  const identity = usePopIdentity();
  const workOrder = useWorkOrder(entry.workOrderId);
  const currentLot = useCurrentLot(entry.workOrderId);
  const pendingPqc = usePendingPqc(entry.workOrderId);
  const item = useItem(currentLot.data?.itemId ?? workOrder.data?.itemId ?? null);
  const lotPrinters = usePrinters('PRODUCTION_LOT_LABEL');
  const tagPrinters = usePrinters('IDENTIFICATION_TAG');
  const gates = useFlowGates(identity.terminalId, soleProcessIdOf(identity.processes));
  const uom = useUomLookup();

  const [actualQty, setActualQty] = useState('');
  const [outputPhase, setOutputPhase] = useState<OutputPhase>('idle');
  const [scanValue, setScanValue] = useState('');
  const [scanMismatch, setScanMismatch] = useState(false);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const [completedPage, setCompletedPage] = useState(1);
  const [appliedLotId, setAppliedLotId] = useState<number | null>(null);
  const [confirmedResultLotId, setConfirmedResultLotId] = useState<number | null>(null);
  /*
   * 방금 이 LOT 에 올라간 양품 수량. **라벨에 적을 수량의 출처다.**
   *
   * ⛔ **수량 칸(`actualQty`)을 라벨의 출처로 쓰지 않는다.** 그 칸은 LOT 이 서면 «계획 수량»으로
   *    미리 채워지므로(아래 LOT 전환 effect), 작업자가 고쳐 넣은 실적과 다를 수 있다. 큐를 통해
   *    올라간 실적은 그 칸을 거치지 않고 적용되기도 한다 — 그때 칸을 읽으면 **계획 수량이 라벨에
   *    찍힌다.** 라벨은 현장이 그대로 읽는 값이고 종이는 되돌릴 수 없다(리뷰 지적 2026-09-16).
   *
   * ⚠ **LOT 을 함께 붙들어 둔다.** 큐에 있던 실적이 LOT 조회보다 «먼저» 적용될 수 있어, LOT
   *   전환에서 비우는 방식으로는 방금 붙든 값이 지워진다(실측). 지우는 대신 «어느 LOT 의
   *   수량인지»를 함께 적어 두고, 지금 LOT 의 것일 때만 쓴다.
   */
  const [appliedLabelQty, setAppliedLabelQty] = useState<{ lotId: number; qty: number } | null>(
    null,
  );
  const [lotPrintTargets, setLotPrintTargets] = useState<PrintTarget[]>([]);
  const [tagPrintTargets, setTagPrintTargets] = useState<PrintTarget[]>([]);
  const [pendingTagIssue, setPendingTagIssue] = useState<DocumentIssueCreate | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [isTagReissueOpen, setIsTagReissueOpen] = useState(false);
  /*
   * 초과 확인 팝업. ⛔ **확인했다는 사실을 남기지 않는다** — 수량을 고쳐 다시 넘기면 다시
   * 물어야 한다. 팝업이 열려 있는 동안만 서는 상태다(스펙 §6 「차단하지 말고 확인 후 진행」).
   */
  const [tagReissueReason, setTagReissueReason] = useState<string | null>(null);
  const [pendingSerialQuantity, setPendingSerialQuantity] = useState(0);
  const [pendingTagDocuments, setPendingTagDocuments] = useState<DocumentIssueCreate[]>([]);
  const currentLotIdRef = useRef<number | null>(null);
  /*
   * 방금 이 화면이 LOT 을 마감했는가. **자동 세션 종료의 방아쇠다.**
   *
   * ⛔ **「지금 LOT 이 없다」만으로 닫지 않는다.** 그 조건만 보면 다른 사람이 이미 다 돌린
   *    작업지시를 열어 보기만 해도 세션이 닫힌다 — 되돌릴 수 없는 전이다. 닫는 근거는
   *    «이 단말이 마지막 LOT 을 마감했다»는 사실이라, 마감 성공에서 세우고 한 번 쓰면 내린다.
   *
   * ⚠ **상태가 아니라 참조다.** 이 값이 바뀌었다고 화면을 다시 그릴 이유가 없고, 렌더 중에
   *   읽히지도 않는다.
   *
   * ⭐ **어느 LOT 을 마감해 세웠는지 담는다**(리뷰 지적 ⑥). 참·거짓만 담았을 때는, 마감한 뒤
   *    «다음 LOT 이 서면» 방아쇠가 내려가지 않고 무기한 남았다 — 한참 뒤 창 포커스 재조회나
   *    옆 단말의 마감으로 목록이 비는 순간 그때 발동해, 이 단말이 마감하지도 않은 작업의 세션을
   *    닫는다. 세운 LOT 과 지금 LOT 을 견줄 수 있어야 「마지막이었는가」가 판정된다.
   */
  const endAfterRefetchRef = useRef<number | null>(null);
  /** 처음 보낸 종료 본문. 재시도가 **같은 값·같은 멱등 키**로 나가게 붙들어 둔다. */
  const sessionEndBodyRef = useRef<ReturnType<typeof buildSessionEnd> | null>(null);

  const completedLots = useCompletedLots(entry.workOrderId, isCompletedOpen, completedPage);
  const isTagTarget = item.data === undefined ? null : requiresIdentificationTag(item.data);
  const serials = useSerials(currentLot.data?.lotId ?? null, isTagTarget === true);
  const tagIssueSummary = useTagIssueSummary(serials.data?.items ?? [], isTagTarget === true);
  const reissueReasons = useReissueReasons(isTagReissueOpen);
  const lotIssues = useLotIssues(currentLot.data?.lotId ?? null);
  /*
   * ⭐ **마감이 실을 낙관적 잠금 값을 받아 두는 조회다**(#1005 · 공유계약 B-1). `ETag` 헤더가
   *    보관소의 `/trace/lots/{lotId}` 자리에 앉아야 `useLotComplete` 가 꺼내 쓸 수 있다.
   *
   * ⭐ **양품 누계의 출처이기도 하다**(#1095). 서버 구현 기준선이 `withProgress` 를 목록에서
   *    거둬 이 상세에만 남겼다 — 목록이 더는 진척을 주지 않는다.
   */
  const lotDetail = useLotDetail(currentLot.data?.lotId ?? null);
  const currentIssue = latestIssue(lotIssues.data);
  const lotPrinter = defaultPrinter(lotPrinters.data);
  const tagPrinter = defaultPrinter(tagPrinters.data);
  const serialCount = serials.data?.page.total ?? null;
  const parsedQty = parseGoodQty(actualQty);
  /*
   * 이 작업지시의 잔여수량 — **서버가 낸 값을 쓴다**(`quantity-draft`). 화면이 식을 새로
   * 세우지 않는다. 받지 못했으면 `null` 이고, 그것은 0 이 아니라 «모른다»다.
   */
  /*
   * ⚠ **음수로 온다.** 「지시 수량 − 양품 누계」라, 이미 지시를 넘겨 만든 지시는 `-4` 처럼
   *    내려온다(계약 `varianceQty` 설명 — 「양수면 미달분, 음수면 초과분」). 그대로 적으면
   *    「잔여 -4 EA」가 되어 읽는 사람이 음수를 수량으로 읽는다. 더 남은 것이 없다는 뜻이므로
   *    **0 으로 세운다** — 판정은 달라지지 않는다(0 이든 -4 든 넣는 수량은 전부 초과다).
   */
  const reportedRemaining = remainingQty(workOrder.data);
  const remaining = reportedRemaining === null ? null : Math.max(0, reportedRemaining);
  /** 지금 입력이 잔여를 넘는가. 잔여를 모르면 넘는지도 모른다 — 그때는 묻지 않는다. */
  const isOverrun = exceedsRemaining(actualQty, remaining);
  const tagMissing =
    parsedQty === null || serialCount === null
      ? null
      : missingIdentificationCount(parsedQty, serialCount);
  const isCurrentLotAmbiguous = currentLot.error instanceof CurrentLotAmbiguousError;
  const lot = currentLot.data ?? null;
  /* 진척은 상세에만 실린다(#1095) — 목록의 줄에서 찾으면 늘 「모름」이 된다. */
  const serverAppliedQty = appliedGoodQty(lotDetail.data?.lot);
  const hasAppliedResult =
    lot !== null && (serverAppliedQty !== null || confirmedResultLotId === lot.lotId);

  /*
   * 라벨에 실을 값. **수량은 서버가 센 양품 누계를 먼저 쓰고**, 아직 반영 전이면 방금 적용된
   * 실적 수량(`appliedLabelQty`)을 쓴다. 둘 다 모르면 **수량 줄을 뺀다**(`label-tspl`) —
   * ⛔ 수량 칸으로 되돌아가지 않는다(`appliedLabelQty` 머리말).
   */
  const lotLabelSource: LotLabelSource | null =
    lot === null
      ? null
      : {
          lotNo: lot.lotNo,
          itemCode: item.data?.itemCode ?? workOrder.data?.itemCode,
          workOrderNo: workOrder.data?.workOrderNo,
          qty:
            serverAppliedQty ?? (appliedLabelQty?.lotId === lot.lotId ? appliedLabelQty.qty : null),
          uomCode: uom.labelOf(lot.uomId ?? workOrder.data?.uomId),
        };

  const lotPrint = useLabelPrintRunner(entry.workerNo);
  const tagPrint = useLabelPrintRunner(entry.workerNo);

  const lotIssue = useDocumentIssue({
    workerNo: entry.workerNo ?? '',
    onSuccess: (result) => {
      if (lotLabelSource === null) return;

      const targets = lotTargetsOf(result.items, lotLabelSource);
      setLotPrintTargets(targets);
      setOutputPhase('printing');
      void lotPrint.run(targets);
    },
  });

  const tagDocumentIssue = useDocumentIssue({
    workerNo: entry.workerNo ?? '',
    onSuccess: (result) => {
      const targets = targetsOf(result.items);
      setPendingTagIssue(null);
      setSelectedTagIds([]);
      setIsTagReissueOpen(false);
      setTagReissueReason(null);
      setTagPrintTargets(targets);
      void tagPrint.run(targets);
    },
  });

  const serialIssue = useSerialIssue({
    workerNo: entry.workerNo ?? '',
    onSuccess: (result) => {
      const [first, ...rest] = chunkTargets(result.items).map((serialBatch) =>
        buildTagIssue(serialBatch, { printerName: tagPrinter?.printerName ?? null }),
      );
      if (first === undefined) return;

      setPendingTagDocuments(rest);
      setPendingTagIssue(first);
      tagDocumentIssue.write(first);
    },
  });

  const complete = useLotComplete({
    lotId: currentLot.data?.lotId ?? null,
    workerNo: entry.workerNo ?? '',
    onSuccess: () => {
      setOutputPhase('completed');
      setScanValue('');
      setScanMismatch(false);
      /*
       * ⭐ **여기서 세션을 닫지 않는다.** 이 LOT 이 마지막인지는 아직 모른다 — 작업지시 하나에
       *    선발행 LOT 이 여럿 달릴 수 있어, 다시 읽어 「다음 LOT 이 없다」가 확인된 뒤에
       *    닫는다(아래 자동 종료 effect).
       */
      endAfterRefetchRef.current = currentLot.data?.lotId ?? null;
      void currentLot.refetch();
    },
  });

  /*
   * ## 작업 세션 자동 종료
   *
   * 마지막 LOT 을 마감하고 나면 그 작업지시에서 더 생산할 것이 없다 — 그런데 세션은 열린 채
   * 남아, 관리웹의 W/O 마감이 `409 OPEN_SESSION_EXISTS` 로 막힌다. 현장은 그 사실을 볼 수
   * 없으므로 **닫는 것도 이 화면이 한다.**
   *
   * ⛔ **손으로 닫는 단추를 여기 두지 않는다.** [세션 종료] 단추는 `P-02-10`(작업 중단) 화면
   *    소관이고 이미 서 있다(2026-09-06 게이트 승인 · `omf-mes#79` · 2026-09-11 설계 회신에서
   *    「지우지 말라」로 재확인). 목표 수량을 못 채우고 접거나 교대로 넘길 때는 그 단추를 쓴다.
   *    같은 일을 하는 자리를 둘로 늘리면 어느 쪽이 정본인지 정할 근거가 없다.
   */
  const openSession = useOpenWorkSession(entry.workOrderId, identity.terminalId);
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('idle');

  const sessionEnd = useWorkSessionEnd({
    workSessionId: openSession.session?.workSessionId ?? null,
    workerNo: entry.workerNo ?? '',
    onSuccess: () => {
      setSessionPhase('ended');
      openSession.refetch();
    },
  });

  useEffect(() => {
    if (sessionEnd.error === null) return;

    /*
     * ⭐ **「이미 닫혀 있다」를 실패로 말하지 않는다.** 원하던 상태가 이미 서 있으므로 작업자가
     *    할 일이 없다 — 실패로 알리면 될 때까지 다시 누른다.
     */
    setSessionPhase(sessionEnd.error.kind === 'stateLocked' ? 'alreadyEnded' : 'failed');
  }, [sessionEnd.error]);

  useEffect(() => {
    /*
     * ⛔ **다음 LOT 이 섰으면 방아쇠를 내린다.** 방금 마감한 것이 마지막이 아니었다는 뜻이다 —
     *    내리지 않으면 한참 뒤 목록이 비는 다른 사건에 얹혀 발동한다(리뷰 지적 ⑥).
     */
    const armedLotId = endAfterRefetchRef.current;
    if (
      armedLotId !== null &&
      !currentLot.isFetching &&
      currentLot.data !== null &&
      currentLot.data !== undefined &&
      currentLot.data.lotId !== armedLotId
    ) {
      endAfterRefetchRef.current = null;
    }

    const verdict = judgeSessionEnd({
      triggered: endAfterRefetchRef.current !== null,
      isFetching: currentLot.isFetching,
      hasLot: currentLot.data !== null,
      gate: gates.complete,
      hasSession: openSession.session !== null,
      isSessionPending: openSession.isPending,
      hasWorkerNo: entry.workerNo !== null,
    });

    if (verdict === 'wait') return;

    /*
     * ⛔ **방아쇠는 «판정이 끝난 뒤» 내린다.** 먼저 내리고 조건을 보면, 세션 조회가 아직 안
     *    끝났거나 실패한 순간에 **요청도 안 나가고 배너도 안 뜬 채** 방아쇠만 사라진다 —
     *    작업자는 닫힌 줄 알고 관리웹은 계속 막힌다(독립 검증 2026-09-16 지적 ②).
     */
    endAfterRefetchRef.current = null;

    if (verdict === 'denied') {
      setSessionPhase('denied');
      return;
    }
    /* 닫아야 하는데 닫을 것을 모른다 — 「못 닫았다」로 말하고 다시 시도할 길을 남긴다. */
    if (verdict === 'unknown') {
      setSessionPhase('failed');
      return;
    }

    const body = buildSessionEnd(new Date());
    sessionEndBodyRef.current = body;
    setSessionPhase('ending');
    sessionEnd.write(body);
    /*
     * 쓰기 함수와 조회 결과는 렌더마다 달라진다. **LOT 이 비는 그 순간만** 이어서 처리한다 —
     * 의존성에 넣으면 같은 방아쇠가 여러 번 돈다.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentLot.isFetching,
    currentLot.data,
    openSession.session,
    openSession.isPending,
    gates.complete,
  ]);

  /*
   * ⚠ **작업지시가 바뀌면 방아쇠를 내린다.** 앞 지시에서 세운 방아쇠가 남아 있으면, 다른
   *   지시를 열었을 때 그쪽 LOT 이 비는 순간에 엉뚱하게 발동한다.
   */
  useEffect(() => {
    endAfterRefetchRef.current = null;
    sessionEndBodyRef.current = null;
    setSessionPhase('idle');
    /*
     * ⚠ **사번이 바뀌어도 내린다**(리뷰 지적 ⑥). 앞 작업자가 세운 방아쇠가 남으면, 그 종료가
     *   **뒤 작업자의 사번**으로 나간다 — 귀속이 어긋난 기록은 되돌릴 수 없다.
     */
  }, [entry.workOrderId, entry.workerNo]);

  /**
   * 다시 시도할 값이 있는가.
   *
   * ⛔ **「아직 못 보냈다」와 「보냈는데 거절당했다」를 가른다**(재리뷰 지적). 세션 조회가 실패했거나
   *    단말·사번을 몰라 멈춘 경우는 요청을 **한 번도 보내지 않았으므로 오류가 없다** — 그때
   *    `isRetryableEndFailure(null)` 이 `false` 라는 이유로 단추를 접으면, 다시 읽으면 풀릴 일에
   *    「종료할 수 없습니다」를 띄우고 빠져나갈 길까지 막는다. 순간적인 조회 실패 한 번에 작업자가
   *    다른 화면까지 걸어가게 된다.
   */
  const canRetrySessionEnd = sessionEnd.error === null || isRetryableEndFailure(sessionEnd.error);

  /**
   * 다시 보낸다 — **처음 보낸 것과 같은 본문으로.**
   *
   * ⛔ **끝 시각을 다시 찍지 않는다.** 두 가지가 한꺼번에 어긋난다. ① 멱등 키는 「이 값을 이
   *    대상에 한 번만」이라는 뜻이라 값이 바뀌면 새 키가 나가고, 그러면 서버가 앞 시도와 묶어
   *    주지 못해 **되돌릴 수 없는 전이가 두 번 실행될 여지**가 생긴다(C-1 #5 · 실측으로 시험이
   *    잡았다). ② 찍어야 할 시각은 «작업이 끝난 때»이지 «다시 눌러 본 때»가 아니다.
   */
  const retrySessionEnd = (): void => {
    sessionEnd.reset();
    setSessionPhase('ending');

    const body = sessionEndBodyRef.current;
    if (body !== null && openSession.session !== null && entry.workerNo !== null) {
      sessionEnd.write(body);
      return;
    }

    /*
     * 아직 한 번도 못 보낸 경우다 — 세션을 몰라 멈춰 있었다. **방아쇠를 다시 세우고 세션을
     * 다시 읽는다**: 답이 오면 위 효과가 이어서 보낸다.
     */
    endAfterRefetchRef.current = RETRY_ARMED;
    openSession.refetch();
  };

  const onResultApplied = (outboxEntry: OutboxEntry): void => {
    const allocation = outboxEntry.body.lotAllocations?.[0];
    const lotId = allocation?.lotId;
    if (lotId === undefined) return;

    setAppliedLotId(lotId);
    /* 이 LOT 에 실제로 실린 수량 — 큐에 들어간 본문이 정본이다. */
    const allocatedQty = allocation?.allocatedQty;
    setAppliedLabelQty(allocatedQty === undefined ? null : { lotId, qty: allocatedQty });
    setConfirmedResultLotId(lotId);
    setOutputPhase('issuing');
    /*
     * ⛔ **쓰기가 먹은 뒤 요약을 다시 읽는다**(#1093 ④). 잔여수량은 작업지시의 진척에서 오는데
     *    이 쓰기는 큐를 통해 나가므로 그 결과가 저절로 캐시에 반영되지 않는다 — 다시 읽지
     *    않으면 방금 올린 수량이 화면의 잔여에 없고, 작업자는 **새로 고쳐야** 맞는 값을 본다.
     */
    void workOrder.refetch();
  };

  const outbox = useOutbox({ onApplied: onResultApplied });

  useEffect(() => {
    const lot = currentLot.data;
    if (
      lot === null ||
      lot === undefined ||
      appliedLotId !== lot.lotId ||
      lotIssues.data === undefined
    ) {
      return;
    }

    setAppliedLotId(null);
    if (currentIssue !== null && lotLabelSource !== null) {
      const targets = lotTargetsOf([currentIssue], lotLabelSource);
      setLotPrintTargets(targets);
      setOutputPhase('printing');
      void lotPrint.run(targets);
      return;
    }

    lotIssue.write(buildLotIssue(lot.lotId, lotPrinter?.printerName ?? null));
    // 쓰기·인쇄 함수는 렌더마다 달라진다. 적용 LOT과 서버 이력 변화만 한 번 처리한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    appliedLotId,
    currentIssue?.documentIssueLogId,
    currentLot.data?.lotId,
    lotIssues.data,
    lotPrinter?.printerName,
  ]);

  useEffect(() => {
    if (lotPrint.state.phase === 'succeeded') {
      setOutputPhase(hasAppliedResult ? 'scanReady' : 'legacyMismatch');
    }
    if (lotPrint.state.phase === 'renditionFailed') {
      setOutputPhase('renditionFailed');
    }
    if (lotPrint.state.phase === 'printFailed' || lotPrint.state.phase === 'shellUnavailable') {
      setOutputPhase('printFailed');
    }
    if (lotPrint.state.phase === 'reportFailed') {
      setOutputPhase('reportFailed');
    }
  }, [hasAppliedResult, lotPrint.state.phase]);

  useEffect(() => {
    if (lotIssue.error !== null && outputPhase === 'issuing') setOutputPhase('issueFailed');
  }, [lotIssue.error, outputPhase]);

  useEffect(() => {
    if (complete.error !== null && outputPhase === 'completing') {
      setScanValue('');
      setOutputPhase('scanReady');
    }
  }, [complete.error, outputPhase]);

  useEffect(() => {
    if (outbox.rejection !== null && outputPhase === 'queued') setOutputPhase('idle');
  }, [outbox.rejection, outputPhase]);

  useEffect(() => {
    const lot = currentLot.data;
    const nextLotId = lot?.lotId ?? null;
    if (currentLotIdRef.current === nextLotId) return;
    currentLotIdRef.current = nextLotId;
    setActualQty(lot === null || lot === undefined ? '' : String(lot.initialQty));
    setOutputPhase('idle');
    setScanValue('');
    setScanMismatch(false);
    setLotPrintTargets([]);
    setTagPrintTargets([]);
    setPendingTagIssue(null);
    setSelectedTagIds([]);
    setIsTagReissueOpen(false);
    setTagReissueReason(null);
    setPendingSerialQuantity(0);
    setPendingTagDocuments([]);
    setConfirmedResultLotId((confirmedLotId) =>
      confirmedLotId === nextLotId ? confirmedLotId : null,
    );
    /*
     * ⚠ **여기서 양품 누계를 읽지 않는다**(#1095). 그 값의 출처가 상세로 옮겨졌는데, LOT 이
     *    바뀌는 이 순간의 상세는 «새 LOT 것이 아직 없는» 상태다 — 읽어 봐야 언제나 모르는
     *    값이고, 의존성에 없는 값을 읽는 자리만 남는다. **이미 적용된 실적이 있으면 아래
     *    효과가 수량을 그 값으로 다시 세운다.**
     */
  }, [currentLot.data]);

  useEffect(() => {
    if (lot === null || lotIssues.data === undefined || outputPhase !== 'idle') return;

    if (serverAppliedQty === null) {
      if (currentIssue !== null) setOutputPhase('legacyMismatch');
      return;
    }

    setActualQty(String(serverAppliedQty));
    if (currentIssue?.printOutcome === 'SUCCEEDED') {
      setOutputPhase('scanReady');
    } else if (currentIssue === null) {
      setOutputPhase('issueFailed');
    } else {
      setOutputPhase('printFailed');
    }
  }, [currentIssue, lot, lotIssues.data, outputPhase, serverAppliedQty]);

  useEffect(() => {
    if (
      tagPrint.state.phase !== 'succeeded' &&
      tagPrint.state.phase !== 'renditionFailed' &&
      tagPrint.state.phase !== 'printFailed' &&
      tagPrint.state.phase !== 'reportFailed'
    ) {
      return;
    }

    void queryClient.invalidateQueries({
      queryKey: ['production-flow', 'tag-issue-summary'],
    });

    if (tagPrint.state.phase !== 'succeeded') return;

    const [nextDocument, ...remainingDocuments] = pendingTagDocuments;
    if (nextDocument !== undefined) {
      setPendingTagDocuments(remainingDocuments);
      setPendingTagIssue(nextDocument);
      tagPrint.reset();
      tagDocumentIssue.write(nextDocument);
      return;
    }

    const nextSerialBatch = nextBatchCount(pendingSerialQuantity);
    if (nextSerialBatch !== null && lot !== null) {
      setPendingSerialQuantity(nextSerialBatch.remaining);
      tagPrint.reset();
      serialIssue.write({ lotId: lot.lotId, quantity: nextSerialBatch.quantity });
    }
    // 쓰기 함수는 렌더마다 달라진다. 인쇄 상태와 대기열 변화만 이어서 처리한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagPrint.state.phase, pendingTagDocuments, pendingSerialQuantity, lot?.lotId]);

  const hasPendingPqc =
    pendingPqc.isPending || pendingPqc.isError || (pendingPqc.data?.length ?? 0) > 0;
  const hasTagCountMatch =
    isTagTarget !== true ||
    (parsedQty !== null &&
      serialCount !== null &&
      canMatchIdentificationCount(parsedQty, serialCount));
  const summaryBySerialId = new Map(
    (tagIssueSummary.data ?? []).map((summary) => [summary.targetId, summary]),
  );
  const serialItems = serials.data?.items ?? [];
  const issuedSerials = serialItems.filter(
    (serial) => (summaryBySerialId.get(serial.serialNumberId)?.issueCount ?? 0) > 0,
  );
  const printedSerials = serialItems.filter((serial) =>
    hasSucceededIdentificationPrint(summaryBySerialId.get(serial.serialNumberId)),
  );
  const unissuedSerials = serialItems.filter(
    (serial) => summaryBySerialId.get(serial.serialNumberId)?.issueCount === 0,
  );
  const retryableSerials = issuedSerials.filter(
    (serial) => !hasSucceededIdentificationPrint(summaryBySerialId.get(serial.serialNumberId)),
  );
  const hasCompleteTagSummary =
    isTagTarget !== true ||
    (tagIssueSummary.data !== undefined &&
      serialCount === serialItems.length &&
      serialItems.every((serial) => summaryBySerialId.has(serial.serialNumberId)));
  const hasTagDocuments =
    isTagTarget !== true || (hasCompleteTagSummary && printedSerials.length === serialItems.length);
  /*
   * ⛔ **넣을 LOT 이 없으면 수량 칸도 잠근다**(사용자 지시 2026-09-16). 실적은 «LOT 에» 붙는
   *    값이라 LOT 이 없으면 받을 그릇이 없다 — 칸이 열려 있으면 작업자가 수를 쳐 넣고 아무
   *    일도 일어나지 않는 것을 보게 된다. 이 상태에서 할 일은 관리웹 쪽에 있다.
   */
  const isQuantityLocked =
    lot === null ||
    outputPhase !== 'idle' ||
    hasAppliedResult ||
    (lot !== null && outbox.isPendingForLot(lot.lotId));
  const canOutput =
    lot !== null &&
    parsedQty !== null &&
    parsedQty > 0 &&
    entry.workerNo !== null &&
    gates.input === 'allowed' &&
    gates.print === 'allowed' &&
    !hasPendingPqc &&
    isTagTarget !== null &&
    hasTagCountMatch &&
    hasTagDocuments &&
    lotPrinter !== null &&
    lotPrint.isShellAvailable &&
    outputPhase === 'idle' &&
    !outbox.isPendingForLot(lot.lotId) &&
    currentIssue === null &&
    !hasAppliedResult;

  /**
   * 잔여수량을 「모른다」고 할 때 **왜 모르는지**(#1094).
   *
   * ⛔ **셋을 한 문장으로 덮지 않는다.** 작업지시가 없는 것 · 아직 안 물어본 것 · 물어봤는데
   *    실패한 것은 작업자가 할 일이 다르다 — 하나는 진입 화면으로, 하나는 기다림, 하나는
   *    다시 시도다. 본보기는 자재 투입의 「아직 조회하지 않았습니다」다.
   */
  const remainingUnknownLabel =
    entry.workOrderId === null
      ? t.quantity.remainingNoWorkOrder
      : workOrder.isError
        ? t.quantity.remainingLoadFailed
        : workOrder.isPending
          ? t.quantity.remainingNotAsked
          : t.quantity.remainingUnknown;

  const queueOutput = (): void => {
    if (!canOutput || lot === null || parsedQty === null || entry.workOrderId === null) return;
    if (entry.workerNo === null) return;

    setOutputPhase('queued');
    outbox.enqueue(
      entry.workerNo,
      buildSaveBody({
        workOrderId: entry.workOrderId,
        lotId: lot.lotId,
        uomId: lot.uomId,
        goodQty: parsedQty,
        draft: { goodQty: actualQty, remarks: '' },
        occurredAt: new Date().toISOString(),
      }),
    );
  };

  const issueTags = (): void => {
    // 항상 422 로 거부되는 발행이다(위 IDENTIFICATION_TAG_ISSUE_LOCKED 주석) — 부르지 않는다.
    if (IDENTIFICATION_TAG_ISSUE_LOCKED) return;
    if (
      lot === null ||
      entry.workerNo === null ||
      tagMissing === null ||
      !Number.isInteger(tagMissing) ||
      tagMissing <= 0 ||
      gates.print !== 'allowed' ||
      tagPrinter === null
    ) {
      return;
    }

    const first = nextBatchCount(tagMissing);
    if (first === null) return;

    setPendingSerialQuantity(first.remaining);
    setPendingTagDocuments([]);
    tagPrint.reset();
    tagDocumentIssue.reset();
    serialIssue.write({ lotId: lot.lotId, quantity: first.quantity });
  };

  const retryLotIssue = (): void => {
    if (lot === null || entry.workerNo === null) return;

    lotIssue.write(buildLotIssue(lot.lotId, lotPrinter?.printerName ?? null));
    setOutputPhase('issuing');
  };

  const retryTagDocumentIssue = (): void => {
    if (IDENTIFICATION_TAG_ISSUE_LOCKED) return;
    if (pendingTagIssue === null || entry.workerNo === null) return;

    tagDocumentIssue.write(pendingTagIssue);
  };

  const restoreTagDocuments = (): void => {
    if (IDENTIFICATION_TAG_ISSUE_LOCKED) return;
    if (unissuedSerials.length === 0 || entry.workerNo === null || tagPrinter === null) return;

    const [first, ...rest] = chunkTargets(unissuedSerials).map((serialBatch) =>
      buildTagIssue(serialBatch, { printerName: tagPrinter.printerName }),
    );
    if (first === undefined) return;

    setPendingTagDocuments(rest);
    setPendingTagIssue(first);
    tagDocumentIssue.write(first);
  };

  const reissueTags = (): void => {
    if (IDENTIFICATION_TAG_ISSUE_LOCKED) return;
    if (tagReissueReason === null || entry.workerNo === null || selectedTagIds.length === 0) return;

    const selected = issuedSerials.filter((serial) =>
      selectedTagIds.includes(serial.serialNumberId),
    );
    if (selected.length === 0) return;

    if (tagPrinter === null) return;

    const [first, ...rest] = chunkTargets(selected).map((serialBatch) =>
      buildTagIssue(serialBatch, {
        reissueReasonCode: tagReissueReason,
        printerName: tagPrinter.printerName,
      }),
    );
    if (first === undefined) return;

    setPendingTagDocuments(rest);
    setPendingTagIssue(first);
    tagDocumentIssue.write(first);
  };

  const retryLotPrint = (): void => {
    const targets =
      lotPrintTargets.length > 0
        ? lotPrintTargets
        : currentIssue === null || lotLabelSource === null
          ? []
          : lotTargetsOf([currentIssue], lotLabelSource);

    if (targets.length === 0) return;
    setOutputPhase('printing');
    void lotPrint.run(targets);
  };

  const changeScan = (value: string): void => {
    setScanValue(value);
    setScanMismatch(false);
    if (lot === null || outputPhase !== 'scanReady' || complete.isSaving) return;

    const verdict = judgeLotScan(value, lot.lotNo);
    if (verdict === 'mismatch') {
      setScanMismatch(true);
      return;
    }
    if (verdict !== 'match' || gates.complete !== 'allowed' || entry.workerNo === null) return;

    setOutputPhase('completing');
    complete.write(buildLotComplete(new Date()));
  };

  const outputStatus = (() => {
    switch (outputPhase) {
      case 'queued':
        return outbox.isOnline ? t.flow.output.saving : t.flow.output.queued;
      case 'issuing':
        return t.flow.output.issuing;
      case 'printing':
        return t.flow.output.printing;
      case 'scanReady':
        return t.flow.output.printed;
      case 'issueFailed':
        return t.flow.output.issueFailed;
      case 'renditionFailed':
        return t.flow.output.renditionFailed;
      case 'printFailed':
        return lotPrint.state.phase === 'shellUnavailable'
          ? t.flow.output.shellUnavailable
          : t.flow.output.printFailed;
      case 'reportFailed':
        return t.flow.output.reportFailed;
      case 'legacyMismatch':
        return t.flow.output.legacyMismatch;
      case 'completing':
        return t.flow.scan.completing;
      case 'completed':
        return t.flow.scan.completed;
      case 'idle':
        return null;
    }
  })();

  /** 세션 종료 배너에 낼 한 줄. 연결이 끊긴 실패는 따로 말한다 — 할 일이 다르다. */
  const sessionStatusTitle = (() => {
    switch (sessionPhase) {
      case 'denied':
        return t.flow.session.denied;
      case 'failed':
        if (sessionEnd.error?.kind === 'network') return t.flow.session.offline;

        /* 다시 눌러도 같은 답이 오는 실패는 재시도 대신 «갈 곳»을 말한다(리뷰 지적 ②). */
        return canRetrySessionEnd ? t.flow.session.failed : t.flow.session.unrecoverable;
      /*
       * ⛔ **잘 닫힌 것은 말하지 않는다**(사용자 지시 2026-09-16). 닫히는 중·닫힘·이미 닫힘은
       *    작업자가 «할 일이 없는» 상태다 — 그 자리에 이미 「생산할 LOT이 없습니다」가 서 있고,
       *    안내를 하나 더 얹으면 두 줄이 같은 사건을 두 번 말한다.
       */
      case 'ending':
      case 'ended':
      case 'alreadyEnded':
      case 'idle':
        return '';
    }
  })();

  const uomLabel = uom.labelOf(lot?.uomId ?? workOrder.data?.uomId) ?? '';
  const completedBoundary = completedLotPageBoundary(completedLots.data?.page);

  return (
    <main className="pop-shell pop-ui production-flow" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        {workOrder.data === undefined ? null : (
          <p className="pop-context">
            {/* 긴급 W/O 에서 넘어왔으면 그 사실을 머리줄에 남긴다(`P-02-12` §5-1 · #1147). */}
            {isEmergency(workOrder.data) && (
              <>
                <Chip status="error" size="md">
                  {t.flow.header.emergency}
                </Chip>{' '}
              </>
            )}
            {`${t.flow.header.erpWorkOrder} ${workOrder.data.productionOrderNo ?? '—'} · ${t.flow.header.workOrder} ${workOrder.data.workOrderNo} · ${t.flow.header.item} ${item.data?.itemCode ?? workOrder.data.itemCode ?? '—'}`}
          </p>
        )}
        <div className="pop-context-right">
          {/*
           * 프린터 — **머리에 상시 보인다**(사용자 지시 2026-09-10). 라벨이 나오지 않을 때
           * 작업자가 가장 먼저 보는 곳이고, 없으면 「등록이 안 됐다」로 오해한다. 자매 화면
           * (`P-01-01`)이 같은 자리에 같은 모양으로 세운다.
           *
           * ⛔ **조회 중에는 아무것도 단정하지 않는다** — 「없음」이 잠깐 스치면 그 사이에
           *    오해가 생긴다. 없는 것과 못 받은 것을 같은 모양으로 그리지 않는다(G-9).
           */}
          {lotPrinters.isPending ? null : (
            <Chip status={lotPrinter === null ? 'warning' : 'success'}>
              {`${t.flow.output.printer} ${lotPrinter?.displayName ?? t.flow.output.printerUnknown}`}
            </Chip>
          )}
          <PopWorkerTag workerNo={entry.workerNo} />
          <Chip status={outbox.isOnline ? 'success' : 'warning'}>
            {outbox.isOnline
              ? messages.common.connection.online
              : messages.common.connection.offline}
          </Chip>
          {outbox.pendingCount > 0 && (
            <Chip status="warning">{t.sync.pending(outbox.pendingCount)}</Chip>
          )}
        </div>
      </header>

      {outbox.isStalled && <OutboxStallBanner onRetry={outbox.retryNow} />}

      {/* ⭐ 사번 미확인은 모든 POP 화면이 같은 맨 위 띠로 말한다(사용자 지시 2026-09-17). */}
      <PopWorkerMissingBanner workerNo={entry.workerNo} />

      {/*
       * ⛔ **작업지시 없이 들어온 화면을 말없이 비워 두지 않는다**(#1151). 공통 [화면 이동]은
       *    작업지시를 싣지 않아, 그 길로 오면 아래 값이 전부 비고 잔여수량 칸만 짧게 사유를 댄다
       *    — 무엇을 해야 하는지는 어디에도 없었다. 머리줄 바로 아래 한 곳에서 할 일을 말한다.
       */}
      {entry.workOrderId === null && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.entry.missingWorkOrder} />
        </div>
      )}

      {/*
       * ⛔ **가릴 수 없는 것과 못 불러온 것을 갈라 말한다**(#1095). 앞엣것은 다시 시도해도
       *    풀리지 않고 작업자가 할 일이 다르다 — 「불러오지 못했다」로 뭉뚱그리면 현장이
       *    새로고침만 반복한다.
       */}
      {currentLot.isError && (
        <div className="banner-slot">
          <AlertBanner
            variant={isCurrentLotAmbiguous ? 'warning' : 'error'}
            title={isCurrentLotAmbiguous ? undefined : t.flow.currentLot.loadFailed}
          >
            {isCurrentLotAmbiguous ? t.flow.currentLot.ambiguous : undefined}
          </AlertBanner>
        </div>
      )}
      {currentLot.data === null && (
        <div className="banner-slot">
          <AlertBanner variant="info" title={t.flow.currentLot.none} />
        </div>
      )}
      {pendingPqc.isError && (
        <div className="banner-slot">
          <AlertBanner variant="error" title={t.pqc.loadFailed} />
        </div>
      )}
      {(pendingPqc.data?.length ?? 0) > 0 && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={t.pqc.blockedTitle}>
            {t.pqc.blockedBody}
          </AlertBanner>
        </div>
      )}
      {item.isError && (
        <div className="banner-slot">
          <AlertBanner variant="error" title={t.flow.tag.targetUnknown} />
        </div>
      )}

      <div
        /*
         * ⚠ 두 칸 배치는 **태그 카드가 서지 않을 때 전부**다(#1147). 대상 여부를 아직 모르는
         *    동안(작업지시·품목을 못 받음)에도 카드는 없는데, `false` 일 때만 두 칸으로 두어
         *    빈 셋째 칸이 생기고 수량·라벨 카드가 좁아졌다(실측 312px · 두 칸이면 474px).
         */
        className={`production-flow-grid pop-fixed${
          isTagTarget === true ? '' : ' production-flow-grid-no-tags'
        }`}
      >
        <Card bordered className="pop-section production-flow-progress">
          <Card.Body>
            <div className="production-flow-section-head">
              <h2 className="pane-title">{t.flow.currentLot.title}</h2>
              <Button
                variant="outlined"
                onClick={() => {
                  setCompletedPage(1);
                  setIsCompletedOpen(true);
                }}
              >
                {t.flow.currentLot.completed}
              </Button>
            </div>
            <dl className="pop-figures">
              <div>
                <dt>{t.flow.currentLot.current}</dt>
                <dd>{lot?.lotNo ?? '—'}</dd>
              </div>
              <div>
                <dt>{t.flow.currentLot.title}</dt>
                <dd>
                  {/*
                   * ⛔⛔ **`Lot.workOrderSequenceNo`·`workOrderLotCount` 가 계약에서 빠졌다**
                   * (생성 타입 `components['schemas']['Lot']` · 2026-09-11 전달본 — 두 필드
                   * 모두 어느 스키마에도 없다). 지어낸 값으로 채우지 않는다(추측 금지) —
                   * `sequence()` 가 이미 갖고 있는 「모른다」 표시(`—`)를 그대로 쓴다. 서버가
                   * 다시 값을 주면 이 자리만 되돌리면 된다.
                   */}
                  {t.flow.currentLot.sequence(null, null)}
                </dd>
              </div>
            </dl>
          </Card.Body>
        </Card>

        <Card bordered className="pop-section production-flow-quantity">
          <Card.Body>
            <h2 className="pane-title">{t.flow.quantity.title}</h2>
            <dl className="pop-figures production-flow-target-qty">
              <div>
                <dt>{t.flow.quantity.target}</dt>
                <dd>{lot === null ? '—' : `${formatQty(lot.initialQty)} ${uomLabel}`}</dd>
              </div>
              {/*
               * ⭐ **잔여수량을 세운다**(스펙 §3-2 「잔여수량 380 / 500」). 아래 초과 알림이
               *    「잔여보다 얼마 많다」로 말하므로, 그 잔여가 같은 화면에 보여야 한다.
               * ⚠ 받지 못했으면 **「확인할 수 없습니다」로 적는다** — 0 으로 그리면 잔여가
               *    없다는 뜻이 되어, 모든 입력이 초과로 보인다.
               */}
              <div>
                <dt>{t.quantity.remaining}</dt>
                <dd>
                  {remaining === null
                    ? remainingUnknownLabel
                    : `${formatQty(remaining)} ${t.quantity.orderedSuffix(
                        formatQty(workOrder.data?.orderQty ?? 0),
                        uomLabel === '' ? null : uomLabel,
                      )}`}
                </dd>
              </div>
            </dl>
            <TextField
              id={actualQtyId}
              label={t.flow.quantity.actual}
              value={actualQty}
              disabled={isQuantityLocked}
              inputMode="decimal"
              trailingIcon={uomLabel}
              /*
               * ⛔ **LOT 이 없을 때는 수량을 나무라지 않는다**(사용자 지시 2026-09-16). 「0보다
               *    큰 수량을 입력하세요」는 «넣을 수 있는데 잘못 넣었다»는 말인데, 그 상태는
               *    애초에 넣을 곳이 없다 — 위 배너가 이미 진짜 할 일을 말하고 있다.
               */
              error={
                lot !== null && (parsedQty === null || parsedQty <= 0)
                  ? t.flow.quantity.invalid
                  : undefined
              }
              onChange={(event) => setActualQty(quantityInput(event.target.value))}
            />
            {/*
             * 초과를 **친 자리에서 바로 말한다**(#1040). 저장 직전에 되묻지 않으므로, 작업자가
             * 수를 고칠 수 있는 동안 눈에 들어와야 한다.
             *
             * ⛔ 막지 않는다 — 초과 생산은 허용이다(✓확정 QA #27 · `P-02-06` §5-4).
             * ⚠ 잔여를 모르면 넘었는지도 모른다 — `isOverrun` 이 그때 `false` 라 서지 않는다.
             */}
            {isOverrun && parsedQty !== null && remaining !== null && (
              <div className="production-flow-inline-note">
                <AlertBanner
                  variant="warning"
                  title={
                    remaining > 0
                      ? t.overrun.notice(
                          `${formatQty(parsedQty - remaining)} ${uomLabel}`.trim(),
                          `${formatQty(remaining)} ${uomLabel}`.trim(),
                        )
                      : t.overrun.noticeNoRemaining
                  }
                />
              </div>
            )}
            <NumericKeypad
              value={actualQty}
              /* 수를 받는 칸이다 — 앞자리 0 을 쌓지 않는다(사번 칸은 켜지 않는다). */
              dropLeadingZero
              disabled={isQuantityLocked}
              label={t.quantity.keypadLabel}
              backspaceLabel={t.quantity.backspace}
              clearLabel={t.quantity.clearGlyph}
              maxLength={GOOD_QTY_MAX_LENGTH}
              /*
               * ⛔ **정수 단위에는 소수점 키를 세우지 않는다**(사용자 지시 2026-09-10). 「개(EA)」에
               *    소수를 주면 넣을 수 없는 값을 넣게 되고, 실적은 되돌릴 수 없다. 무게 단위처럼
               *    계약이 소수를 허용하는 단위에서는 그대로 연다 — 자매 화면(`P-04-03`)이 같은
               *    규칙을 쓴다.
               */
              allowDecimal={uom.decimalScaleOf(lot?.uomId ?? workOrder.data?.uomId) > 0}
              decimalLabel={t.quantity.decimalKey}
              onChange={setActualQty}
            />
          </Card.Body>
        </Card>

        {isTagTarget === true && (
          <Card bordered className="pop-section production-flow-tags">
            <Card.Body>
              <h2 className="pane-title">{t.flow.tag.title}</h2>
              {serials.isError ? (
                <p className="field-error">{t.flow.tag.loadFailed}</p>
              ) : (
                <>
                  <p className="production-flow-count">
                    {t.flow.tag.issued}: {t.flow.tag.count(serialCount ?? 0)}
                  </p>
                  <div className="production-flow-serials" aria-label={t.flow.tag.issued}>
                    {issuedSerials.map((serial) => {
                      const summary = summaryBySerialId.get(serial.serialNumberId);
                      const outcome = summary?.lastPrintOutcome ?? 'PENDING';

                      return (
                        <Checkbox
                          key={serial.serialNumberId}
                          checked={selectedTagIds.includes(serial.serialNumberId)}
                          onChange={(event) =>
                            setSelectedTagIds((current) =>
                              event.target.checked
                                ? [...new Set([...current, serial.serialNumberId])]
                                : current.filter((id) => id !== serial.serialNumberId),
                            )
                          }
                        >
                          {`${serial.serialNo} · ${t.flow.tag.printOutcome[outcome]}`}
                        </Checkbox>
                      );
                    })}
                  </div>
                  {tagIssueSummary.isError && (
                    <p className="field-error">{t.flow.tag.summaryFailed}</p>
                  )}
                  {unissuedSerials.length > 0 && (
                    <Button
                      variant="outlined"
                      disabled={
                        IDENTIFICATION_TAG_ISSUE_LOCKED ||
                        tagDocumentIssue.isSaving ||
                        tagPrinter === null
                      }
                      onClick={restoreTagDocuments}
                    >
                      {t.flow.tag.restoreDocuments(unissuedSerials.length)}
                    </Button>
                  )}
                  {parsedQty !== null && serialCount !== null && serialCount > parsedQty && (
                    <p className="field-error">{t.flow.tag.tooMany}</p>
                  )}
                  {tagMissing === 0 && <p className="field-note">{t.flow.tag.matched}</p>}
                  {retryableSerials.length > 0 && (
                    <p className="field-error">
                      {t.flow.tag.printIncomplete(retryableSerials.length)}
                    </p>
                  )}
                  <Button
                    disabled={
                      IDENTIFICATION_TAG_ISSUE_LOCKED ||
                      tagMissing === null ||
                      tagMissing <= 0 ||
                      !Number.isInteger(tagMissing) ||
                      gates.print !== 'allowed' ||
                      entry.workerNo === null ||
                      serialIssue.isSaving ||
                      tagDocumentIssue.isSaving ||
                      tagPrint.state.phase === 'sending' ||
                      tagPrinter === null
                    }
                    onClick={issueTags}
                  >
                    {tagMissing === null ? t.flow.tag.title : t.flow.tag.issueMissing(tagMissing)}
                  </Button>
                  {(tagPrint.state.phase === 'renditionFailed' ||
                    tagPrint.state.phase === 'printFailed') &&
                    tagPrintTargets.length > 0 && (
                      <Button variant="outlined" onClick={() => void tagPrint.run(tagPrintTargets)}>
                        {t.flow.output.retryPrint}
                      </Button>
                    )}
                  {tagPrint.state.phase === 'reportFailed' && (
                    <>
                      <p className="field-error">{t.flow.tag.reportFailed}</p>
                      <Button variant="outlined" onClick={() => void tagPrint.retryReport()}>
                        {t.flow.output.retryReport}
                      </Button>
                    </>
                  )}
                  {issuedSerials.length > 0 && (
                    <Button
                      variant="outlined"
                      disabled={
                        IDENTIFICATION_TAG_ISSUE_LOCKED ||
                        selectedTagIds.length === 0 ||
                        tagPrinter === null
                      }
                      onClick={() => setIsTagReissueOpen(true)}
                    >
                      {t.flow.tag.reissue}
                    </Button>
                  )}
                  {tagPrinter === null && !tagPrinters.isPending && (
                    <p className="field-error">{t.flow.tag.printerUnavailable}</p>
                  )}
                  {tagDocumentIssue.error !== null && pendingTagIssue !== null && (
                    <Button variant="outlined" onClick={retryTagDocumentIssue}>
                      {t.flow.retry}
                    </Button>
                  )}
                </>
              )}
            </Card.Body>
          </Card>
        )}

        <Card bordered className="pop-section production-flow-output">
          <Card.Body>
            <h2 className="pane-title">{t.flow.output.title}</h2>
            <dl className="pop-figures">
              <div>
                <dt>{t.flow.currentLot.current}</dt>
                <dd>{lot?.lotNo ?? '—'}</dd>
              </div>
              <div>
                <dt>{t.flow.header.item}</dt>
                <dd>{item.data?.itemCode ?? workOrder.data?.itemCode ?? '—'}</dd>
              </div>
              <div>
                <dt>{t.flow.quantity.actual}</dt>
                <dd>{parsedQty === null ? '—' : `${formatQty(parsedQty)} ${uomLabel}`}</dd>
              </div>
              <div>
                <dt>{t.flow.output.printer}</dt>
                <dd>{lotPrinter?.displayName ?? t.flow.output.printerUnknown}</dd>
              </div>
            </dl>

            {outputPhase === 'legacyMismatch' ? (
              <Button disabled>{t.flow.output.mismatchBlocked}</Button>
            ) : outputPhase === 'issueFailed' ? (
              /*
               * ⛔ **눌러도 안 되면 비활성으로 보인다**(#1093 · 사용자 지시). 처리기가 LOT ·
               *    사번 없이는 조용히 되돌아온다 — 단추가 열린 채면 눌리고 아무 말이 없다.
               */
              <Button disabled={lot === null || entry.workerNo === null} onClick={retryLotIssue}>
                {t.flow.output.retryIssue}
              </Button>
            ) : outputPhase === 'reportFailed' ? (
              <Button onClick={() => void lotPrint.retryReport()}>
                {t.flow.output.retryReport}
              </Button>
            ) : outputPhase === 'renditionFailed' ||
              outputPhase === 'printFailed' ||
              (outputPhase === 'idle' && currentIssue !== null) ? (
              <Button onClick={retryLotPrint}>{t.flow.output.retryPrint}</Button>
            ) : (
              <Button
                disabled={!canOutput}
                /*
                 * ⛔ **초과라고 단추를 끄지도, 되묻지도 않는다** — 초과 생산은 허용이고
                 *    (✓확정 QA #27), 화면이 하는 일은 **말하는 것**이다(사용자 결정
                 *    2026-09-11). 초과는 수량 칸 아래에서 이미 말했고, 여기서 한 번 더
                 *    멈춰 세우면 허용된 작업마다 손짓이 하나씩 는다.
                 */
                onClick={queueOutput}
              >
                {t.flow.output.issue}
              </Button>
            )}

            {/*
             * 저장·발행·인쇄가 어떻게 됐는지는 **[생산 라벨 출력] 바로 아래에서 말한다**
             * (사용자 지시 2026-09-10). 누른 자리와 그 답이 한 자리에 모인다 — 화면 맨 위
             * 띠에 두었더니 눌러 놓고 눈이 위로 올라갔다.
             *
             * 두 소식이 같은 자리에 선다: 실적 저장이 먼저이고 발행·인쇄가 그다음이다.
             */}
            {outbox.rejection !== null && (
              <div className="banner-slot">
                <AlertBanner variant="error" title={t.save.failTitle} />
              </div>
            )}

            {outputStatus !== null && (
              <div className="banner-slot">
                <AlertBanner
                  variant={
                    outputPhase === 'issueFailed' ||
                    outputPhase === 'renditionFailed' ||
                    outputPhase === 'printFailed' ||
                    outputPhase === 'reportFailed' ||
                    outputPhase === 'legacyMismatch'
                      ? 'error'
                      : 'info'
                  }
                  title={outputStatus}
                />
              </div>
            )}

            {lotPrinter === null && !lotPrinters.isPending && (
              <p className="field-error">{t.flow.output.printerUnavailable}</p>
            )}
            {!lotPrint.isShellAvailable && (
              <p className="field-error">{t.flow.output.shellUnavailable}</p>
            )}
          </Card.Body>
        </Card>

        <Card bordered className="pop-section production-flow-scan">
          <Card.Body>
            <h2 className="pane-title">{t.flow.scan.title}</h2>
            <TextField
              id={scanId}
              label={t.flow.scan.label}
              /*
               * ⭐ **칸이 구획 폭을 다 쓴다**(사용자 지시 2026-09-10). LOT 번호는 서른 자리를
               * 넘길 수 있어, 기본 폭에서는 읽은 값이 칸 밖으로 밀려 눈으로 대조할 수 없다.
               */
              fullWidth
              value={scanValue}
              disabled={outputPhase !== 'scanReady' || gates.complete !== 'allowed'}
              error={scanMismatch && lot !== null ? t.flow.scan.mismatch : undefined}
              onChange={(event) => changeScan(event.target.value)}
            />
            {/*
             * ⚠ **한 번에 한 줄만 낸다**(사용자 지시 2026-09-10). 스캔이 어긋난 것과 마감이
             * 실패한 것이 함께 서면, 다음에 무엇을 해야 하는지가 두 문장으로 갈린다. 어긋남은
             * 칸이 이미 말하고 있으므로 마감 실패는 그때만 선다.
             */}
            {complete.error !== null && !scanMismatch && (
              <p className="field-error">{t.flow.scan.failed}</p>
            )}
            {/*
             * 작업 세션 자동 종료가 **어긋났을 때만** 선다.
             *
             * ⭐ **스캔 구획 바닥에 둔다**(사용자 지시 2026-09-16). 머리의 배너 자리에 세웠더니
             *    「생산할 LOT이 없습니다」 바로 아래 같은 크기의 줄이 하나 더 붙어 둘 중 어느
             *    것이 지금 할 일인지 흐려졌다. 세션을 닫는 것은 **마감 흐름의 끝**이라 그 흐름이
             *    끝나는 자리에 선다.
             *
             * ⛔ **잘 닫힌 것은 말하지 않는다**(같은 지시). 성공 안내를 얹으면 같은 사건이 두 번
             *    말해진다.
             *
             * ⛔ **서버 오류 원문을 싣지 않는다.** 작업자에게는 다음 행동만 말한다.
             */}
            {(sessionPhase === 'failed' || sessionPhase === 'denied') && (
              <div className="production-flow-inline-note production-flow-session-note">
                {/*
                 * ⭐ **노란 띠로 낸다**(사용자 지시 2026-09-16). 빨간 글씨는 «방금 친 값이
                 *    틀렸다»는 말이라 이 자리와 뜻이 다르다 — 값은 멀쩡하고, 뒤에서 하나가
                 *    덜 끝났을 뿐이다. 크기만 한 급 낮춘다(`pop.css`).
                 */}
                <AlertBanner variant="warning" title={sessionStatusTitle}>
                  {sessionPhase === 'failed' && canRetrySessionEnd && (
                    /* 채운 단추로 낸다(사용자 지시 2026-09-16) — POP 기본 채움이 빨강이다. */
                    <Button onClick={retrySessionEnd} disabled={sessionEnd.isSaving}>
                      {t.flow.session.retry}
                    </Button>
                  )}
                </AlertBanner>
              </div>
            )}
          </Card.Body>
        </Card>
      </div>

      <Dialog
        open={isCompletedOpen}
        onClose={() => setIsCompletedOpen(false)}
        title={t.flow.currentLot.completedTitle}
        /* ⛔ 바닥의 [닫기]와 같은 일을 하므로 X 를 두지 않는다 — 나가는 길은 하나다. */
        showCloseButton={false}
        /*
         * ⛔ **팝업 바깥을 눌러 닫히지 않는다**(사용자 지시 2026-09-10 · #1005). 터치 단말에서
         *    팝업은 화면 대부분을 덮어 손이 스치기 쉽고, 스크림 클릭이 닫기로 이어지면
         *    「누른 적 없는데 닫힌다」가 된다. 닫는 길은 아래 [닫기] 단추다.
         */
        closeOnBackdropClick={false}
        footer={
          <Button variant="outlined" onClick={() => setIsCompletedOpen(false)}>
            {t.flow.close}
          </Button>
        }
      >
        {completedLots.data === undefined || completedLots.data.items.length === 0 ? (
          <p>{t.flow.currentLot.completedEmpty}</p>
        ) : (
          <>
            <ol className="production-flow-completed-lots">
              {completedLots.data.items.map((completedLot) => (
                <li key={completedLot.lotId}>{completedLot.lotNo}</li>
              ))}
            </ol>
            <nav className="production-flow-completed-pages" aria-label={t.flow.currentLot.pageNav}>
              <Button
                variant="outlined"
                disabled={!completedBoundary.canPageUp}
                onClick={() => setCompletedPage(Math.max(1, completedBoundary.page - 1))}
              >
                {t.flow.currentLot.pageUp}
              </Button>
              <p className="field-note">
                {t.flow.currentLot.pagePosition(
                  completedBoundary.page,
                  completedBoundary.totalPages,
                )}
              </p>
              <Button
                variant="outlined"
                disabled={!completedBoundary.canPageDown}
                onClick={() => setCompletedPage(completedBoundary.page + 1)}
              >
                {t.flow.currentLot.pageDown}
              </Button>
            </nav>
          </>
        )}
      </Dialog>

      <Dialog
        open={isTagReissueOpen}
        onClose={() => setIsTagReissueOpen(false)}
        title={t.flow.tag.reissueReason}
        /* ⛔ 바닥의 [닫기]와 같은 일을 하므로 X 를 두지 않는다 — 나가는 길은 하나다. */
        showCloseButton={false}
        /*
         * ⛔ **팝업 바깥을 눌러 닫히지 않는다**(사용자 지시 2026-09-10 · #1005). 터치 단말에서
         *    팝업은 화면 대부분을 덮어 손이 스치기 쉽고, 스크림 클릭이 닫기로 이어지면
         *    「누른 적 없는데 닫힌다」가 된다. 닫는 길은 아래 [닫기] 단추다.
         */
        closeOnBackdropClick={false}
        footer={
          <>
            <Button variant="outlined" onClick={() => setIsTagReissueOpen(false)}>
              {t.flow.close}
            </Button>
            <Button
              disabled={
                IDENTIFICATION_TAG_ISSUE_LOCKED ||
                tagReissueReason === null ||
                tagDocumentIssue.isSaving
              }
              onClick={reissueTags}
            >
              {t.flow.tag.reissue}
            </Button>
          </>
        }
      >
        {reissueReasons.isError ? (
          <AlertBanner variant="error">{t.flow.tag.reasonLoadFailed}</AlertBanner>
        ) : !reissueReasons.isPending && (reissueReasons.data?.length ?? 0) === 0 ? (
          <AlertBanner variant="warning">{t.flow.tag.reasonEmpty}</AlertBanner>
        ) : (
          <Select
            aria-label={t.flow.tag.reissueReason}
            value={tagReissueReason}
            placeholder={t.flow.tag.reissueReasonPlaceholder}
            options={(reissueReasons.data ?? []).map((reason) => ({
              value: reason.code,
              label: reason.codeName,
            }))}
            onChange={setTagReissueReason}
          />
        )}
      </Dialog>
    </main>
  );
};

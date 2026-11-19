/**
 * P-02-04 생산 작업
 * 유형: T-P-W 작업형(실적 탭). 머리줄, 본문 좌우 2단(왼쪽 현재 LOT, 오른쪽 현재 단계 본문), 하단 동작 바.
 * LOT 하나를 「실적 입력 → 라벨 스캔」 두 단계로 끝내고 다음 LOT으로 넘어간다(C-5 단계 표시).
 * 이탈: 왼쪽 세로 작업 탭 없음(PI-01과 같음, 탭은 셸 작업). 머리줄은 공용 `PopHeader`를 화면이 놓는다(C-11).
 *       실패 뒤 다시 시도는 하단 바가 아니라 라벨 스캔 단계의 결과 줄 안 테두리 버튼이다(P04 빈틈).
 */
import { AlertBanner, Button, Checkbox, Dialog } from '@crefle/web-ui';
import type { ApiError } from '@omf-mes/api-client';
import { messages, named } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';

import { LoadErrorBanner } from '../../patterns/load-error-banner';
import type { SplitError } from '../../patterns/master';
import { serverReasonOf } from '../../patterns/server-reason';
import { masterName } from '../../patterns/master-name';
import { OutboxStallBanner } from '../../patterns/outbox-stall-banner';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { PopHeader } from '../../patterns/pop-header';
import { soleProcessIdOf, usePopIdentity } from '../../patterns/pop-identity';
import { PopSelect as Select } from '../../patterns/pop-select';
import {
  applyKeypadKey,
  PuActionBar,
  PuButton,
  PuChip,
  PuConfirm,
  PuCount,
  PuEmpty,
  PuField,
  PuFlow,
  PuInput,
  PuKeypad,
  PuNote,
  PuPager,
  PuRemoveButton,
  PuScanField,
  PuScreen,
  PuCols,
  PuSection,
  PuUnit,
  puToast,
  useClientPage,
  useFitCount,
  type PuKey,
  type PuTone,
} from '../../patterns/pop-uniform';
import { usePopWorkerEntry } from '../../patterns/pop-worker-entry';
import { PrinterChip } from '../pop-material-lot-label/printer-chip';
import {
  choosePrinter,
  rememberPrinterName,
  storedPrinterName,
} from '../pop-material-lot-label/printer-choice';
import { useShellSelectsPrinter } from '../pop-material-lot-label/queries';
import { toPrinterView } from '../pop-material-lot-label/types';
import {
  areDefectRowsReady,
  checkDefectRows,
  defectLabelOf,
  groupDefectCodes,
  toDefectInputs,
  type DefectRowDraft,
} from './defect-draft';
import { useResultEntry } from './entry-context';
import { UnderReasonDialog } from './under-reason-dialog';
import { blockedReason as closeBlockedReason, WorkOrderCloseAction } from './wo-close-action';
import { CLOSABLE_STATUSES } from './wo-close';
import { useFlowGates, type FlowGateVerdict } from './flow-gating';
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
  COMPLETED_LOT_PAGE_SIZE,
  CurrentLotUnreliableError,
  defaultPrinter,
  latestIssue,
  useCompletedLots,
  useCurrentLot,
  useLotDetail,
  useItem,
  useLotIssues,
  usePrinters,
  LOT_PRINTER_STORAGE_KEY,
  useReissueReasons,
  useVarianceReasons,
  useSerials,
  useTagIssueSummary,
} from './flow-queries';
import { forgetSentDefects, rememberSentDefects, storedSentDefects } from './sent-defects';
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
import { useProcessDefectCodes, useWorkOrder } from './queries';
import './uniform.css';
import { buildSaveBody } from './save-request';
import { useUomLookup } from './uom-lookup';
import { isEmergency } from './work-order-type';

const t = messages.productionResult;
/**
 * 이 화면에서 고른 LOT 라벨 프린터를 기억하는 열쇠(개선 명세 ⑤). 자재 LOT 라벨 화면과 같은 방식이지만
 * 열쇠는 따로다 — 두 화면이 다른 프린터를 쓸 수 있다.
 */
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

/** 저장 거부의 서버 이유 — 칸 오류와 서버 문구(`serverReasonOf`)를 함께 잇는다. */
const rejectionText = (rejection: SplitError): string | null => {
  const reason = rejection.error === null ? null : serverReasonOf(rejection.error);
  const text = [...Object.values(rejection.fieldErrors), ...(reason === null ? [] : [reason])]
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .join(' ');

  return text === '' ? null : text;
};

/** P-02-04 생산 실적·인식표·생산 LOT 라벨·스캔 마감을 한 주소와 한 상태 흐름으로 묶는다. */
export const ProductionFlowScreen = () => {
  const titleId = useId();
  const actualQtyId = useId();
  const scanId = useId();

  const remainingId = useId();
  const lotTitleId = useId();
  const stepTitleId = useId();
  const keypadTitleId = useId();
  const scanInputRef = useRef<HTMLInputElement>(null);

  const entry = useResultEntry();
  /*
   * ⭐ **사번이 없으면 실적을 받지 않는다**(PI-17과 같은 판단). 들어오자마자 공용 사번 입력 창을 열고,
   *    확인되면 같은 W/O에서 이어 간다. 맨 위 경고 띠 대신 하단 바 「남은 일」과 창이 말한다.
   */
  const workerEntry = usePopWorkerEntry(entry.workerNo);
  const queryClient = useQueryClient();
  const identity = usePopIdentity();
  const workOrder = useWorkOrder(entry.workOrderId);
  const currentLot = useCurrentLot(entry.workOrderId);
  /*
   * ⛔ PQC 는 이 화면에 띄우지 않는다(P-02-04 개선 명세 §1). 의뢰가 있든 없든 실적이 전체 폭을 쓰고,
   *    검사는 「PQC 제품 검사」(P-02-13)에서 한다.
   */
  const item = useItem(currentLot.data?.itemId ?? workOrder.data?.itemId ?? null);
  const lotPrinters = usePrinters('PRODUCTION_LOT_LABEL');
  const tagPrinters = usePrinters('IDENTIFICATION_TAG');
  /*
   * 기능 구성은 «이 W/O 의 공정»으로 판정한다 — 단말에 공정이 여럿이어도 W/O 가 어느 공정의 일인지
   * 안다(작업 시작과 같은 규칙). 공정을 싣지 않는 서버면 단말의 유일한 공정으로 판정한다.
   */
  const gates = useFlowGates(
    identity.terminalId,
    workOrder.data?.processId ?? soleProcessIdOf(identity.processes),
  );
  const uom = useUomLookup();

  const [actualQty, setActualQty] = useState('');
  /*
   * 불량 줄. 수량 칸이 여럿이라 키패드는 하나만 두고 지금 고른 칸(`activeQty`)에 친다 — 양품이면
   * `'good'`, 불량이면 그 줄의 키다.
   */
  const [defectRows, setDefectRows] = useState<DefectRowDraft[]>([]);
  const [activeQty, setActiveQty] = useState<string>('good');
  /** 이 화면에서 작업지시를 마감했다. */
  const [closedHere, setClosedHere] = useState(false);
  /** 불량만 적은 저장의 결과 — 큐에 넣는 것이 곧 성공이라 넣자마자 알린다 */
  const [defectNotice, setDefectNotice] = useState<'saved' | 'queued' | null>(null);
  /**
   * 이미 있는 유형을 골랐을 때 그 유형이 있는 줄 — 줄을 만들거나 바꾸지 않고 그 줄을 강조하고 안내 라벨을
   * 띄운다(사용자 지시 2026-11-16). 없으면 null.
   */
  const [duplicateRowKey, setDuplicateRowKey] = useState<string | null>(null);
  /** 이 화면에서 방금 마감한 LOT — 마감된 LOT 목록에서 강조한다(사용자 지시 2026-11-16). */
  const [justCompletedLotId, setJustCompletedLotId] = useState<number | null>(null);
  const nextDefectKey = useRef(1);
  const noProcessId = useId();
  /** 라벨로 이어지는 저장에 실린 불량 줄 — 그 항목이 적용될 때 그 줄만 비운다(멱등 키 → 줄 키) */
  const sentDefectRowKeys = useRef(new Map<string, string[]>());
  const defectCodes = useProcessDefectCodes(workOrder.data?.processId ?? null);
  const defectMajors = useMemo(() => groupDefectCodes(defectCodes.data ?? []), [defectCodes.data]);
  const [outputPhase, setOutputPhase] = useState<OutputPhase>('idle');
  /** 이 LOT 라벨이 인쇄에 성공해 서버에 보고됐는가. 그 뒤의 인쇄는 재출력(보고 없음)이다. */
  const isLotLabelPrinted = useRef(false);
  /**
   * 라벨이 이미 작업자 손에 있다(첫 인쇄 성공). 재출력이 실패해도 그 라벨로 스캔·마감할 수 있어야 한다 —
   * 프린터가 고장 나면 빠져나올 길이 없다(리뷰 지적 2026-11-16).
   */
  const [isLabelInHand, setIsLabelInHand] = useState(false);
  /*
   * 실적 입력 단계 안의 화면 쪽(사용자 지시 2026-11-16): ① 양품 → ② 불량. 화면 단계일 뿐이다 — 저장은
   * ② 의 [확인](종전 [LOT 라벨 출력])·불량만이면 [확인] → 확인 창 때 양품·불량을 한 번에 보낸다(사용자 지시
   * 2026-11-19). LOT 이 바뀌면 ① 로 돌아간다.
   */
  const [inputPage, setInputPage] = useState<'good' | 'defect'>('good');
  /*
   * ③ 라벨 스캔에서 [이전]으로 돌아가 보는 쪽(사용자 지시 2026-11-19). 실적은 이미 보냈으므로 보기만 한다 —
   * 칸은 잠겨 있고 [확인]은 다시 ③ 으로 간다. `null` 이면 ③ 을 본다.
   */
  const [scanBackPage, setScanBackPage] = useState<'good' | 'defect' | null>(null);
  /**
   * 이 LOT 에 보낸 불량 줄(유형 이름 · 수량). 라벨 스캔 단계에서 왼쪽 「입력한 실적」에 보인다(사용자 지시
   * 2026-11-16). 보낸 줄은 입력 칸에서 비워지므로 보낼 때 따로 적어 둔다. 단말 저장소에도 남겨 화면을 다시
   * 열어도 보인다(`sent-defects`). 기억이 없으면 모른다(`null`).
   */
  const [sentDefects, setSentDefects] = useState<{ label: string; qty: string }[] | null>(null);
  const [scanValue, setScanValue] = useState('');
  const [scanMismatch, setScanMismatch] = useState(false);
  /** 미달 LOT 의 라벨을 맞게 읽었다 — 사유를 고르면 마감한다 */
  const [isUnderReasonOpen, setUnderReasonOpen] = useState(false);
  /** [불량 등록] 확인 창(사용자 지시 2026-11-16) — 누르자마자 저장되지 않고 무엇을 등록할지 한 번 보인다. */
  const [isDefectConfirmOpen, setIsDefectConfirmOpen] = useState(false);
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

  /* 왼쪽 「현재 LOT」 구획 접기(#295 시안). 화면 안의 보기일 뿐이다. */
  const [isLotFolded, setIsLotFolded] = useState(false);
  /*
   * 마감된 LOT 은 왼쪽 구획에 목록으로 늘 보인다(사용자 지시 2026-11-16, 종전 [보기] 창). 한 쪽 건수는 구획 높이에
   * 들어가는 만큼이다(#295 규칙 1) — 서버가 쪽으로 주는 목록이라 요청 size 만 바꾼다(조건·정렬은 그대로).
   */
  const completedListRef = useRef<HTMLOListElement>(null);
  const completedPageSize = useFitCount(completedListRef, { fallback: COMPLETED_LOT_PAGE_SIZE });
  const completedSizeRef = useRef(completedPageSize);
  useEffect(() => {
    const previous = completedSizeRef.current;
    if (previous === completedPageSize) return;
    completedSizeRef.current = completedPageSize;
    /* 쪽 크기가 바뀌어도 보던 첫 줄이 든 쪽에 머문다(규칙 15). */
    setCompletedPage((page) => Math.floor(((page - 1) * previous) / completedPageSize) + 1);
  }, [completedPageSize]);
  const completedLots = useCompletedLots(entry.workOrderId, true, completedPage, completedPageSize);
  const isTagTarget = item.data === undefined ? null : requiresIdentificationTag(item.data);
  const serials = useSerials(currentLot.data?.lotId ?? null, isTagTarget === true);
  const tagIssueSummary = useTagIssueSummary(serials.data?.items ?? [], isTagTarget === true);
  const reissueReasons = useReissueReasons(isTagReissueOpen);
  const varianceReasons = useVarianceReasons(isUnderReasonOpen);
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
  /*
   * LOT 라벨 프린터 — 머리줄 칩에서 고른다(개선 명세 ⑤). 고른 것(이번 실행) → 이 단말에 기억한 것 →
   * 기본(셸이 알려 준 기동 지정값 → OS 기본) 순. 셸이 고른 프린터를 받지 못하면(브라우저·옛 설치본)
   * 고를 수 없고 기억한 값도 쓰지 않는다 — 고른 것처럼 보이는데 기본으로 나가지 않게.
   */
  const printerSelectable = useShellSelectsPrinter();
  const isPrinterSelectable = printerSelectable.data === true;
  const [pickedPrinter, setPickedPrinter] = useState<string | null>(null);
  const [rememberedPrinter] = useState(() => storedPrinterName(LOT_PRINTER_STORAGE_KEY));
  const lotPrinterViews = useMemo(
    () => (lotPrinters.data === undefined ? undefined : lotPrinters.data.map(toPrinterView)),
    [lotPrinters.data],
  );
  const printerChoice = choosePrinter(
    lotPrinterViews ?? [],
    pickedPrinter,
    isPrinterSelectable ? rememberedPrinter : null,
  );
  const lotPrinter =
    printerChoice.printer === null
      ? null
      : (lotPrinters.data?.find(
          (printer) => printer.printerName === printerChoice.printer?.printerName,
        ) ?? null);
  const shellPrinterName = isPrinterSelectable ? (lotPrinter?.printerName ?? null) : null;
  const tagPrinter = defaultPrinter(tagPrinters.data);
  const serialCount = serials.data?.page.total ?? null;
  const parsedQty = parseGoodQty(actualQty);
  const defectChecks = checkDefectRows(defectRows);
  const defectInputs = toDefectInputs(defectRows);
  /*
   * 손대지 않은 빈 줄(유형·수량 모두 없음)은 없는 줄로 본다 — ② 에 들어오면 빈 줄 1개를 미리 두므로, 불량이
   * 없으면 그대로 [확인]을 누를 수 있어야 한다(사용자 지시 2026-11-19). 빈 줄은 본래 보내지 않는다.
   */
  const filledDefectRows = defectRows.filter((row) => row.defectCodeId !== null || row.qty !== '');
  const areDefectsReady = areDefectRowsReady(filledDefectRows);
  /** 양품 없이 불량만 적는다 — LOT·라벨로 이어지지 않는다. */
  const isDefectOnly = (parsedQty === null || parsedQty === 0) && defectInputs.length > 0;
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
  /* 달성은 화면이 세지 않는다 — 서버가 W/O 축으로 낸 완료 판정이 정상·초과면 지시 수량에 이르렀다. */
  const completionJudgment = workOrder.data?.progress?.completionJudgmentCode;
  const isPlanAchieved = completionJudgment === 'NORMAL' || completionJudgment === 'OVER';
  /* 초과면 얼마나 넘었는지 — 서버의 차이(지시 − 양품)가 음수인 만큼이다. */
  const overVariance = workOrder.data?.progress?.varianceQty;
  const overAchievedQty =
    completionJudgment === 'OVER' && overVariance !== undefined && overVariance < 0
      ? -overVariance
      : null;
  const tagMissing =
    parsedQty === null || serialCount === null
      ? null
      : missingIdentificationCount(parsedQty, serialCount);
  /* 다시 읽기에 실패해도 React Query 는 앞 값을 남긴다 — 오류면 옛 LOT 으로 실적·마감을 내지 않게 비운다. */
  const lot = currentLot.isError ? null : (currentLot.data ?? null);
  /* 진척은 상세에만 실린다(#1095) — 목록의 줄에서 찾으면 늘 「모름」이 된다. */
  const serverAppliedQty = appliedGoodQty(lotDetail.data?.lot);
  /** 서버가 이 LOT 을 미달·정상·초과로 판정한 값 — 마감 본문의 사유 여부를 이것으로 가른다 */
  const lotJudgment = lotDetail.data?.lot.progress?.completionJudgmentCode ?? null;
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

  const lotPrint = useLabelPrintRunner(entry.workerNo, shellPrinterName);
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
    onSuccess: (completedLot) => {
      setOutputPhase('completed');
      puToast(t.flow.scan.completed);
      forgetSentDefects(completedLot.lotId);
      setJustCompletedLotId(completedLot.lotId);
      /* 방금 마감한 LOT 이 맨 위에 서게 첫 쪽으로 돌아가 다시 읽는다. */
      setCompletedPage(1);
      void completedLots.refetch();
      setScanValue('');
      setScanMismatch(false);
      /* 마감한 LOT 의 수량을 다음 LOT 이 서기 전까지 남기지 않는다 — 다음 LOT 이 서면 그 계획 수량이 들어온다. */
      setActualQty('');
      void lotDetail.refetch();
      /*
       * ⭐ **여기서 세션을 닫지 않는다.** 이 LOT 이 마지막인지는 아직 모른다 — 작업지시 하나에
       *    선발행 LOT 이 여럿 달릴 수 있어, 다시 읽어 「다음 LOT 이 없다」가 확인된 뒤에
       *    닫는다(아래 자동 종료 effect).
       */
      endAfterRefetchRef.current = currentLot.data?.lotId ?? null;
      void currentLot.refetch();
    },
  });

  /** 마감이 거부된 까닭 — 스캔 칸 아래에 선다. 사유 칸의 거부는 사유 창이 말한다(`reasonError`). */
  const [completeFailure, setCompleteFailure] = useState<string | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);

  /**
   * 마감이 거부되면 LOT 을 다시 읽고 그 상태로 무엇을 할지 가른다.
   *
   * ⚠ 화면이 들고 있던 판정이 낡았을 수 있다 — 미달로 보고 사유를 실었는데 서버는 이미 정상·초과면
   *   INVALID 로 거부한다. 그때 창을 다시 열면 같은 거부가 되풀이되므로, 새 판정이 미달이 아니면
   *   사유 없이 다시 마감한다. 서버 문구 대신 다시 읽은 상태로 알려진 거부를 가른다 — 문구는 바뀐다.
   */
  const handleCompleteFailure = async (error: ApiError): Promise<void> => {
    setScanValue('');
    setOutputPhase('scanReady');
    const items = error.kind === 'validation' || error.kind === 'stateLocked' ? error.errors : [];
    /* 다시 읽지 못했으면 옛 값으로 단정하지 않는다 — 「실적이 없다」로 읽으면 같은 실적을 또 올린다. */
    const reread = await lotDetail.refetch();
    const refreshed = reread.isError ? undefined : reread.data?.lot;
    const judgment = refreshed?.progress?.completionJudgmentCode ?? null;
    const reasonItem = items.find((item) => item.field === 'completionVarianceReasonCode');

    if (reasonItem !== undefined) {
      if (reasonItem.code !== 'REQUIRED' && judgment !== null && judgment !== 'UNDER') {
        setOutputPhase('completing');
        complete.write(buildLotComplete(new Date()));
        return;
      }
      setReasonError(reasonItem.message);
      setUnderReasonOpen(true);
      return;
    }
    if (refreshed?.completedAt != null) {
      setCompleteFailure(t.flow.scan.alreadyCompleted);
      void currentLot.refetch();
      return;
    }
    if (refreshed !== undefined && items.some((item) => item.code === 'STATE_LOCKED')) {
      setCompleteFailure(
        (refreshed.progress?.goodQty ?? 0) === 0
          ? t.flow.scan.noAllocation
          : judgment === 'UNDER'
            ? t.flow.scan.workOrderClosed(
                messages.workOrderClose.menuPath,
                messages.workOrderClose.correction.pane,
              )
            : (items[0]?.message ?? t.flow.scan.failed),
      );
      return;
    }
    setCompleteFailure(items[0]?.message ?? t.flow.scan.failed);
  };
  /* 효과는 마감 오류가 바뀔 때만 돈다 — 처리기는 매 렌더의 것을 읽는다. */
  const handleCompleteFailureRef = useRef(handleCompleteFailure);
  handleCompleteFailureRef.current = handleCompleteFailure;

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

  /* 「마감 완료」 강조는 다음 버튼을 누르면 사라진다(사용자 지시 2026-11-16). */
  useEffect(() => {
    if (justCompletedLotId === null) return undefined;
    const clear = (event: PointerEvent): void => {
      if (event.target instanceof Element && event.target.closest('button') !== null) {
        setJustCompletedLotId(null);
      }
    };
    document.addEventListener('pointerdown', clear, true);

    return () => document.removeEventListener('pointerdown', clear, true);
  }, [justCompletedLotId]);

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
      isSessionAbsent: openSession.isAbsent,
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
    /*
     * 닫을 세션이 없다고 확인됐다 — 할 일이 없으므로 말하지 않는다(사용자 지시 2026-11-16). 「이미 닫힘」과 같은
     * 상태로 둔다 — 둘 다 작업자가 할 일이 없고 배너도 없다.
     */
    if (verdict === 'none') {
      setSessionPhase('alreadyEnded');
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
    /* 이 저장에 실린 불량 줄만 비운다 — 앞서 쌓인 다른 항목이 적용될 때 지금 치는 줄을 지우지 않게. */
    const sentKeys = sentDefectRowKeys.current.get(outboxEntry.idempotencyKey);
    if (sentKeys !== undefined) {
      sentDefectRowKeys.current.delete(outboxEntry.idempotencyKey);
      setDefectRows((rows) => rows.filter((row) => !sentKeys.includes(row.key)));
      setActiveQty((current) => (sentKeys.includes(current) ? 'good' : current));
    }
    const allocation = outboxEntry.body.lotAllocations?.[0];
    const lotId = allocation?.lotId;
    if (lotId === undefined) {
      /* 불량만 적은 실적이다 — 라벨로 이어지지 않는다. 잔여만 다시 읽는다. */
      void workOrder.refetch();
      return;
    }

    setAppliedLotId(lotId);
    /* 이 LOT 에 실제로 실린 수량 — 큐에 들어간 본문이 정본이다. */
    const allocatedQty = allocation?.allocatedQty;
    setAppliedLabelQty(allocatedQty === undefined ? null : { lotId, qty: allocatedQty });
    setConfirmedResultLotId(lotId);
    setOutputPhase('issuing');
    /* 실적이 붙었으니 LOT 의 미달·정상 판정이 바뀐다 — 마감 때 낡은 판정으로 사유를 묻지 않게 다시 읽는다. */
    void lotDetail.refetch();
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
    if (complete.error !== null) void handleCompleteFailureRef.current(complete.error);
  }, [complete.error]);

  useEffect(() => {
    if (outbox.rejection === null || outputPhase !== 'queued') return;
    setOutputPhase('idle');
    /* 거부된 불량 줄은 서버에 없다 — 기억해 둔 것을 지운다(리뷰 지적 2026-11-16). */
    if (currentLot.data !== null && currentLot.data !== undefined) {
      forgetSentDefects(currentLot.data.lotId);
    }
    setSentDefects(null);
  }, [outbox.rejection, outputPhase, currentLot.data]);

  /* 서버가 거부하면 넣자마자 낸 「기록했습니다」는 사실이 아니다 — 거부 띠만 남긴다. */
  useEffect(() => {
    if (outbox.rejection !== null) setDefectNotice(null);
  }, [outbox.rejection]);

  useEffect(() => {
    const lot = currentLot.data;
    const nextLotId = lot?.lotId ?? null;
    if (currentLotIdRef.current === nextLotId) return;
    currentLotIdRef.current = nextLotId;
    setActualQty(lot === null || lot === undefined ? '' : String(lot.initialQty));
    setOutputPhase('idle');
    setSentDefects(nextLotId === null ? null : storedSentDefects(nextLotId));
    setInputPage('good');
    setScanBackPage(null);
    isLotLabelPrinted.current = false;
    setIsLabelInHand(false);
    setDuplicateRowKey(null);
    /* 손대지 않은 빈 줄(LOT 없음 때 미리 넣은 줄)은 새 LOT 으로 넘기지 않는다 — [LOT 라벨 출력]을 막지 않게. */
    setDefectRows((rows) => rows.filter((row) => row.defectCodeId !== null || row.qty !== ''));
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
    isTagTarget !== null &&
    hasTagCountMatch &&
    hasTagDocuments &&
    lotPrinter !== null &&
    lotPrint.isShellAvailable &&
    areDefectsReady &&
    outputPhase === 'idle' &&
    !outbox.isPendingForLot(lot.lotId) &&
    currentIssue === null &&
    !hasAppliedResult;

  /* 불량만 적을 때는 LOT·프린터·라벨이 필요 없다 — 사번·작업지시·투입 게이트만 본다. */
  const canSaveDefectsOnly =
    isDefectOnly &&
    areDefectsReady &&
    entry.workerNo !== null &&
    entry.workOrderId !== null &&
    gates.input === 'allowed' &&
    outputPhase === 'idle' &&
    (lot?.uomId ?? workOrder.data?.uomId) !== undefined;
  /** 불량 줄을 고칠 수 있는가 — 라벨로 이어지는 저장이 나간 뒤에는 그 실적에 실린 값이라 잠근다. */
  const areDefectsLocked = outputPhase !== 'idle' || entry.workOrderId === null;
  /** 공정이 없는 W/O 는 고를 불량 유형이 없다 — 받은 뒤에야 안다. */
  const hasNoProcess = workOrder.data !== undefined && workOrder.data.processId == null;

  const queueDefectsOnly = (): void => {
    const uomId = lot?.uomId ?? workOrder.data?.uomId;
    if (!canSaveDefectsOnly || entry.workerNo === null || entry.workOrderId === null) return;
    if (uomId === undefined) return;

    /* 큐에 넣는 것이 곧 성공이다(아웃박스 규칙) — 줄을 비우고 바로 다음 입력을 받는다. */
    outbox.enqueue(
      entry.workerNo,
      buildSaveBody({
        workOrderId: entry.workOrderId,
        lotId: null,
        uomId,
        goodQty: 0,
        draft: { goodQty: '0', remarks: '' },
        occurredAt: new Date().toISOString(),
        defects: defectInputs,
        session: openSession.session,
      }),
    );
    setDefectRows([]);
    setActiveQty('good');
    setDefectNotice(outbox.isOnline ? 'saved' : 'queued');
    puToast(outbox.isOnline ? t.flow.defects.saved : t.flow.defects.queued);
  };

  /*
   * 불량 줄 쪽 넘김(#295 규칙 1) — 구획 높이에 들어가는 만큼 보이고 나머지는 ‹ › 로 본다. 화면 안의 보기일 뿐이고
   * 보내는 줄은 늘 `defectRows` 전부다.
   */
  const defectListRef = useRef<HTMLUListElement>(null);
  const defectPageSize = useFitCount(defectListRef, { fallback: 5 });
  const defectPage = useClientPage(defectRows, defectPageSize);

  /**
   * [불량 추가]는 빈 줄 하나를 더한다(#295 시안 — 「유형 선택」 칸이 빨간 테두리로 선다). 새 줄이 있는 쪽으로
   * 넘기고 키패드는 그 줄 수량을 받는다. 유형·수량이 빈 줄은 지금처럼 저장을 잠근다(`areDefectRowsReady`).
   */
  const addDefectRow = (): void => {
    const key = `defect-${String(nextDefectKey.current)}`;
    nextDefectKey.current += 1;
    setDefectNotice(null);
    setDuplicateRowKey(null);
    setDefectRows((rows) => [...rows, { key, defectCodeId: null, qty: '' }]);
    setActiveQty(key);
    defectPage.showIndex(defectRows.length);
  };

  /** 줄의 유형을 고른다. 이미 다른 줄에 있는 유형이면 바꾸지 않고 그 줄을 강조한다(사용자 지시 2026-11-16). */
  const pickDefectCode = (rowKey: string, defectCodeId: number): void => {
    const taken = defectRows.find((row) => row.key !== rowKey && row.defectCodeId === defectCodeId);
    setDuplicateRowKey(taken?.key ?? null);
    if (taken !== undefined) {
      /*
       * 방금 [불량 추가]로 더한 빈 줄에서 고른 것이면 그 줄을 거둔다 — 같은 유형의 두 번째 줄은 생기지 않는다
       * (종전 「유형을 고른 뒤에 줄이 생긴다」와 같은 결과). 키패드는 그 유형이 있는 줄로 간다.
       */
      const row = defectRows.find((candidate) => candidate.key === rowKey);
      if (row !== undefined && row.defectCodeId === null && row.qty === '') {
        setDefectRows((rows) => rows.filter((candidate) => candidate.key !== rowKey));
        setActiveQty(taken.key);
      }
      return;
    }
    updateDefectRow(rowKey, { defectCodeId });
  };

  const updateDefectRow = (key: string, patch: Partial<DefectRowDraft>): void => {
    setDefectRows((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const removeDefectRow = (key: string): void => {
    setDuplicateRowKey(null);
    setDefectRows((rows) => rows.filter((row) => row.key !== key));
    if (activeQty === key) setActiveQty('good');
  };

  const activeDefectRow = defectRows.find((row) => row.key === activeQty) ?? null;

  const queueOutput = (): void => {
    if (!canOutput || lot === null || parsedQty === null || entry.workOrderId === null) return;
    if (entry.workerNo === null) return;

    setOutputPhase('queued');
    setScanBackPage(null);
    const sentRows = filledDefectRows.map((row) => ({
      label: defectLabelOf(defectMajors, row.defectCodeId) ?? '',
      qty: row.qty,
    }));
    setSentDefects(sentRows);
    rememberSentDefects(lot.lotId, sentRows);
    const sentKey = outbox.enqueue(
      entry.workerNo,
      buildSaveBody({
        workOrderId: entry.workOrderId,
        lotId: lot.lotId,
        uomId: lot.uomId,
        goodQty: parsedQty,
        draft: { goodQty: actualQty, remarks: '' },
        occurredAt: new Date().toISOString(),
        defects: defectInputs,
        session: openSession.session,
      }),
    );
    if (filledDefectRows.length > 0) {
      sentDefectRowKeys.current.set(
        sentKey,
        filledDefectRows.map((row) => row.key),
      );
    }
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
    /*
     * 한 번 인쇄에 성공한 라벨(서버에 성공으로 보고됨)은 재출력 길로만 다시 찍는다 — 보고를 또 보내면 서버가
     * 거절한다. 재출력이 실패해 [라벨 다시 인쇄]를 누를 때도 같다.
     */
    if (isLotLabelPrinted.current) {
      void lotPrint.reprint(targets);
      return;
    }
    void lotPrint.run(targets);
  };

  /** 스캔 칸이 열린다 — 스캔 대기, 또는 이미 손에 든 라벨의 재출력이 실패했을 때. */
  const canScan =
    outputPhase === 'scanReady' ||
    (isLabelInHand && (outputPhase === 'printFailed' || outputPhase === 'renditionFailed'));

  const changeScan = (value: string): void => {
    setScanValue(value);
    setScanMismatch(false);
    if (lot === null || !canScan || complete.isSaving) return;

    const verdict = judgeLotScan(value, lot.lotNo);
    if (verdict === 'mismatch') {
      setScanMismatch(true);
      return;
    }
    if (verdict !== 'match' || gates.complete !== 'allowed' || entry.workerNo === null) return;

    setCompleteFailure(null);
    setReasonError(null);
    /* 서버가 미달로 판정한 LOT 은 사유가 있어야 마감된다 — 보내기 전에 고르게 한다. */
    if (lotJudgment === 'UNDER') {
      complete.reset();
      setUnderReasonOpen(true);
      return;
    }

    setOutputPhase('completing');
    complete.write(buildLotComplete(new Date()));
  };

  const completeUnder = (reasonCode: string): void => {
    setUnderReasonOpen(false);
    setReasonError(null);
    if (lot === null || gates.complete !== 'allowed' || entry.workerNo === null) return;

    setOutputPhase('completing');
    complete.write(buildLotComplete(new Date(), reasonCode));
  };

  /* 사유를 고르지 않고 닫으면 마감하지 않고 스캔을 기다린다. */
  const cancelUnder = (): void => {
    setUnderReasonOpen(false);
    setReasonError(null);
    setScanValue('');
    complete.reset();
  };

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

  /**
   * LOT 하나의 단계(C-5). 사람이 정하는 묶음은 「실적」과 「부착 확인」 둘이다. 발행과 인쇄는 사람이 정하지
   * 않는 자동 진행이라 라벨 스캔 단계 안의 진행으로 둔다. 처음 여는 단계는 데이터로 정한다(T-W-C):
   * 실적이 서버에 있거나 큐에 있거나 라벨 발행 기록이 있으면 라벨 스캔이다. LOT이 없으면 단계도 없다.
   */
  const step: 'input' | 'scan' | null =
    lot === null
      ? null
      : outputPhase === 'idle' &&
          currentIssue === null &&
          !hasAppliedResult &&
          !outbox.isPendingForLot(lot.lotId)
        ? 'input'
        : 'scan';

  /*
   * 라벨이 나오면 스캔 칸에 포커스를 둔다. 작업자는 라벨을 붙이고 바로 스캐너를 당긴다(PG-21과 같은 판단).
   * 칸이 열리는 것은 이 상태뿐이다.
   */
  useEffect(() => {
    if (outputPhase === 'scanReady') {
      isLotLabelPrinted.current = true;
      setIsLabelInHand(true);
      scanInputRef.current?.focus();
    }
  }, [outputPhase]);

  /** 실패를 고치는 다시 시도. 결과 줄 안의 테두리 버튼이고 「남은 일」이 그 이름을 말한다. */
  const retryAction = ((): { label: string; run: () => void; disabled?: boolean } | null => {
    switch (outputPhase) {
      case 'issueFailed':
        /* ⛔ 눌러도 안 되면 비활성으로 보인다(#1093). 처리기가 LOT·사번 없이는 조용히 되돌아온다. */
        return {
          label: t.flow.output.retryIssue,
          run: retryLotIssue,
          disabled: lot === null || entry.workerNo === null,
        };
      case 'reportFailed':
        return { label: t.flow.output.retryReport, run: () => void lotPrint.retryReport() };
      case 'renditionFailed':
      case 'printFailed':
        return { label: t.flow.output.retryPrint, run: retryLotPrint };
      case 'idle':
        return currentIssue === null
          ? null
          : { label: t.flow.output.retryPrint, run: retryLotPrint };
      default:
        return null;
    }
  })();

  /**
   * 라벨 스캔 단계의 결과 한 줄(C-21 결과 안내). 진행 중(저장, 발행, 인쇄, 마감)은 하단 바 「남은 일」만
   * 말하고 여기에는 두지 않는다. 같은 일을 두 곳에서 말하지 않는다.
   */
  const outputResult = ((): { tone: 'info' | 'success' | 'error'; text: string } | null => {
    switch (outputPhase) {
      case 'scanReady':
        return { tone: 'info', text: t.flow.output.printed };
      case 'issueFailed':
        return { tone: 'error', text: t.flow.output.issueFailed };
      case 'renditionFailed':
        return { tone: 'error', text: t.flow.output.renditionFailed };
      case 'printFailed':
        return {
          tone: 'error',
          text:
            lotPrint.state.phase === 'shellUnavailable'
              ? t.flow.output.shellUnavailable
              : t.flow.output.printFailed,
        };
      case 'reportFailed':
        return { tone: 'error', text: t.flow.output.reportFailed };
      case 'legacyMismatch':
        return { tone: 'error', text: t.flow.output.legacyMismatch };
      case 'completed':
        return { tone: 'success', text: t.flow.scan.completed };
      default:
        return null;
    }
  })();

  /** 단말 기능 판정이 막을 때의 문구. 「확인 중」, 「확인 불가」, 「단말 미확인」은 권한 없음과 다르게 말한다. */
  const gateText = (verdict: FlowGateVerdict, denied: string): string | null => {
    switch (verdict) {
      case 'allowed':
        return null;
      case 'denied':
        return denied;
      case 'checking':
        return t.gate.checking;
      case 'unavailable':
        return t.gate.unavailable;
      case 'unidentified':
        return t.gate.unidentified;
    }
  };

  /**
   * 불량 줄의 첫 할 일. 덜 채운 줄이 없으면 `undefined`.
   * 유형·수량이 비었으면 `null` — 하단 바에 「불량 유형을 골라 주세요」·「불량 수량을 입력해 주세요」를 두지
   * 않는다(사용자 지시 2026-11-16). 빈 칸은 칸 자체가 보여 준다. 저장이 잠기는 기준은 그대로다.
   */
  const defectTodo = ((): string | null | undefined => {
    for (const row of filledDefectRows) {
      const check = defectChecks.get(row.key);
      if (check === undefined || check.complete) continue;
      if (check.typeMissing) return null;
      if (check.duplicate) return t.flow.next.defectDuplicate;

      return null;
    }

    return undefined;
  })();

  /**
   * 하단 바 「남은 일」(C-4, C-5). 주 동작 [생산 라벨 출력]이 잠긴 사유이고, 라벨 스캔 단계에서는 다음 할
   * 일이다. 앞의 것이 먼저다.
   */
  /*
   * 작업지시 마감의 자리. 계획 수량을 달성했거나 남은 LOT이 없으면 하단 바 주 동작이 [작업지시 마감]이다.
   * 그 전에는 현재 LOT 구획 아래의 테두리 버튼(이른 마감)이다. 마감한 뒤에 이끄는 다음 단계는 없다(#293).
   * 라벨 스캔 중이면 그 LOT을 먼저 끝낸다.
   */
  /*
   * 마감 성공은 이 화면이 아는 사실이라 따로 붙든다. 서버는 마감한 W/O를 POP 단말에 다시 읽어 주지 않아
   * (「단말 인증 범위 밖」) 다시 읽으면 옛 상태가 남는다(P04 빈틈).
   */
  const isWorkOrderClosed = workOrder.data?.statusCode === 'CLOSED' || closedHere;
  const isCloseMode =
    !isWorkOrderClosed &&
    workOrder.data !== undefined &&
    !currentLot.isError &&
    currentLot.data !== undefined &&
    (lot === null || (isPlanAchieved && step === 'input'));
  const closeBlock =
    workOrder.data === undefined
      ? null
      : closeBlockedReason({
          gate: gates.close,
          statusCode: workOrder.data.statusCode,
          isOnline: outbox.isOnline,
          pendingCount: outbox.pendingCount,
          workerNo: entry.workerNo,
        });

  /** 실적 입력 단계의 할 일. [생산 라벨 출력]이 잠긴 사유이기도 하다. */
  const inputStepText = (): string | null => {
    const next = t.flow.next;
    const gate =
      gateText(gates.input, t.gate.denied) ??
      (isDefectOnly ? null : gateText(gates.print, t.flow.gate.print));
    if (gate !== null) return gate;
    /* 불량만 등록할 때 [불량 등록]을 누르라는 문장은 두지 않는다 — 버튼이 불량 목록 아래에 바로 선다(사용자 지시 2026-11-16). */
    if (isDefectOnly) return defectTodo ?? null;
    /* 양품이 비거나 0 이면 [LOT 라벨 출력]만 잠근다 — 「양품을 입력해 주세요」는 두지 않는다(사용자 지시 2026-11-16). */
    if (parsedQty === null || parsedQty <= 0) return null;
    if (defectTodo !== undefined) return defectTodo;
    if (lotPrinters.isPending) return null;
    /* 프린터가 없으면 머리줄 칩이 「프린터 없음」으로 말한다 — 하단에 같은 말을 또 두지 않는다(사용자 지시 2026-11-16). */
    if (lotPrinter === null) return null;
    if (!lotPrint.isShellAvailable) return next.shell;
    if (isTagTarget === null) return item.isError ? next.tagUnknown : null;
    if (!hasTagCountMatch || !hasTagDocuments) return next.tag;

    /* 입력이 다 됐을 때의 문장은 두지 않는다(개선 명세 §1 「안내 문구」) — 막힌 이유만 하단 바가 말한다. */
    return null;
  };

  const nextText = ((): string | null => {
    const next = t.flow.next;
    if (entry.workOrderId === null) return next.noWorkOrder;
    if (entry.workerNo === null) return next.noWorker;
    /* 마감 완료는 오른쪽 위 안내 줄이 말한다(개선 명세 ⑨). */
    if (isWorkOrderClosed) return null;
    if (currentLot.error instanceof CurrentLotUnreliableError) {
      return t.flow.currentLot.unreliable(currentLot.error.lotNos.join(', '));
    }
    if (currentLot.isError) return t.flow.currentLot.loadFailed;
    if (currentLot.data === undefined) return null;
    if (isCloseMode) {
      /*
       * 작업 지시량 달성·LOT 없음은 오른쪽 위 안내 줄이 말한다(개선 명세 ④). 하단 바에는 막힌 이유만 —
       * [작업지시 마감]이 잠긴 이유, 그리고 테두리 [LOT 라벨 출력]이 잠긴 이유를 뒤에 잇는다(C-4).
       */
      const outputReason = lot !== null && !canOutput ? inputStepText() : null;
      const reasons = [closeBlock, outputReason].filter((text): text is string => text !== null);

      return reasons.length === 0 ? null : reasons.join('. ');
    }

    if (step === 'scan') {
      switch (outputPhase) {
        case 'queued':
          return outbox.isOnline ? next.saving : next.queued;
        case 'issuing':
          return next.issuing;
        case 'printing':
          /* 인쇄 중 문장은 두지 않는다(사용자 지시 2026-11-16) — 인쇄는 잠깐이고 끝나면 결과 줄이 말한다. */
          return null;
        case 'scanReady':
          /* 스캔 안내는 결과 줄(「LOT 라벨을 출력했습니다. 라벨을 붙인 뒤 스캔해 주세요.」)이 말한다. */
          return gateText(gates.complete, t.flow.gate.complete);
        case 'legacyMismatch':
          /* 결과 줄이 「실적 없이 만든 이전 라벨 이력이 있습니다.」라고 말한다 — 하단에 또 두지 않는다(사용자 지시 2026-11-16). */
          return null;
        case 'completing':
          return next.completing;
        case 'completed':
          return next.completed;
        default:
          /*
           * 실패는 결과 줄이 이유와 다시 시도 버튼으로 말한다 — 하단에 「○○을 눌러 주세요」를 또 두지 않는다
           * (사용자 지시 2026-11-16).
           */
          return retryAction === null ? next.saving : null;
      }
    }

    return inputStepText();
  })();

  /*
   * 막힌 이유·진행 중인 일 한 줄(#295). ⛔ 아래 작업 줄 왼쪽에는 글을 두지 않는다(규칙 3) — 단계 본문 위
   * 안내 줄로 옮겼다. 잠긴 버튼은 이 줄을 설명으로 잇는다(`aria-describedby`). 문장과 판정은 그대로다.
   */
  const nextTone: PuTone = currentLot.isError
    ? 'bad'
    : entry.workOrderId === null ||
        entry.workerNo === null ||
        (step === 'scan' && !isCloseMode && outputPhase !== 'scanReady')
      ? 'info'
      : 'warn';
  const statusNote =
    nextText === null ? null : (
      <PuNote tone={nextTone} id={remainingId} live>
        {nextText}
      </PuNote>
    );

  const uomLabel = uom.labelOf(lot?.uomId ?? workOrder.data?.uomId) ?? '';
  const completedBoundary = completedLotPageBoundary(completedLots.data?.page);
  const withUnit = (qty: number): string => `${formatQty(qty)} ${uomLabel}`.trim();
  /* 품목은 이름으로 알아본다(C-21). 이름을 못 받으면 W/O의 품목 코드다. */
  const itemCode = item.data?.itemCode ?? workOrder.data?.itemCode ?? null;
  const itemTitle =
    itemCode === null ? t.flow.currentLot.current : named(item.data?.itemName, itemCode);
  const workOrderGoodQty = workOrder.data?.progress?.goodQty ?? null;
  const isScanStep = step === 'scan';
  /** ③ 라벨 스캔을 보고 있다 — [이전]으로 앞 단계를 보는 중이 아니다. */
  const isScanView = isScanStep && scanBackPage === null;
  /*
   * 이른 작업지시 마감은 마감할 수 있는 상태일 때만 선다(C-3 보조 동작의 자리): 작업이 시작된 W/O이고
   * 실적이 하나라도 있다. #295 부터 아래 작업 줄 왼쪽(테두리)에 선다 — 종전에는 현재 LOT 구획 아래.
   */
  const canCloseEarly =
    !isCloseMode &&
    workOrder.data !== undefined &&
    CLOSABLE_STATUSES.includes(workOrder.data.statusCode) &&
    (workOrderGoodQty ?? 0) > 0;
  /* 작업지시 마감은 한 자리에만 선다(C-1 같은 이름의 버튼을 두 곳에 두지 않는다). */
  const closeAction = (variant: 'filled' | 'outlined') =>
    entry.workOrderId === null || workOrder.data === undefined ? null : (
      <WorkOrderCloseAction
        workOrderId={entry.workOrderId}
        workOrderNo={workOrder.data.workOrderNo}
        statusCode={workOrder.data.statusCode}
        workerNo={entry.workerNo}
        gate={gates.close}
        isOnline={outbox.isOnline}
        pendingCount={outbox.pendingCount}
        terminalId={identity.terminalId}
        uomLabel={uom.labelOf(workOrder.data.uomId) ?? ''}
        variant={variant}
        /* 작업 줄에는 글을 두지 않는다(규칙 3) — 잠긴 이유는 단계 본문 위 안내 줄에 잇는다. */
        reasonId={remainingId}
        onClosed={() => {
          setClosedHere(true);
        }}
      />
    );
  /*
   * 작업 세션 자동 종료가 **어긋났을 때만** 선다. 세션을 닫는 것은 마감 흐름의 끝이라 그 흐름이 끝나는
   * 자리(라벨 스캔 단계, 마지막 LOT을 마감한 뒤의 빈 단계 본문)에 둔다(사용자 지시 2026-09-16). 잘 닫힌
   * 것은 말하지 않는다. 서버 오류 원문을 싣지 않는다.
   */
  const sessionNote = (sessionPhase === 'failed' || sessionPhase === 'denied') && (
    <PuNote
      tone="warn"
      action={
        sessionPhase === 'failed' && canRetrySessionEnd ? (
          <PuButton size="sm" onClick={retrySessionEnd} disabled={sessionEnd.isSaving}>
            {t.flow.session.retry}
          </PuButton>
        ) : undefined
      }
    >
      {sessionStatusTitle}
    </PuNote>
  );

  /**
   * 작업 줄의 저장 버튼. ② 불량 등록에서는 [확인]이다(사용자 지시 2026-11-19 — 종전 ① 의 [LOT 라벨 출력]):
   * 누르는 조건(`canOutput`)·보내는 값·이어지는 발행·인쇄는 그대로다. LOT 을 아직 못 읽었거나 쓸 수 없을
   * 때(단계 없음)도 잠긴 [확인]이고, ③ 에서 라벨이 나오기 전에는 잠긴 [LOT 라벨 출력]이다(종전 그대로). 라벨을 출력해 스캔을 기다리는 동안은
   * [LOT 라벨 재인쇄]로 바뀐다(사용자 지시 2026-11-16). 재인쇄는 이미 발행한 같은 라벨을 지금 고른 프린터로
   * 다시 찍을 뿐이다 — 실적·발행 기록을 새로 만들지 않고, 인쇄 결과도 다시 보고하지 않는다(서버는 성공한
   * 발행에 두 번째 보고를 거절한다).
   */
  const outputButton = (variant: 'filled' | 'outlined'): ReactNode => {
    const look = variant === 'filled' ? 'primary' : 'default';
    /*
     * 양품 없이 불량만 넣었으면 라벨로 이어지지 않는다 — 불량만 등록한다(확인 창을 거친다). 누르는 조건·보내는
     * 값은 그대로다. LOT 이 없을 때(단계 없음)는 이름이 [불량 등록]이다.
     */
    if (isDefectOnly && outputPhase === 'idle' && !(step === 'input' && inputPage === 'good')) {
      return (
        <PuButton
          variant={look}
          disabled={!canSaveDefectsOnly}
          aria-describedby={remainingId}
          onClick={() => setIsDefectConfirmOpen(true)}
        >
          {step === 'input' ? messages.common.confirm : t.flow.defects.saveOnly}
        </PuButton>
      );
    }
    if (outputPhase === 'scanReady') {
      return (
        <PuButton variant={look} disabled={complete.isSaving} onClick={retryLotPrint}>
          {t.flow.output.reprint}
        </PuButton>
      );
    }
    return (
      <PuButton
        variant={look}
        disabled={!canOutput}
        aria-describedby={remainingId}
        onClick={queueOutput}
      >
        {step === 'scan' ? t.flow.output.issue : messages.common.confirm}
      </PuButton>
    );
  };

  /* ② 불량 → ① 양품. 넣은 양품·불량 줄은 그대로 둔다. */
  const goGood = (): void => {
    /* 손대지 않은 빈 줄(유형·수량 모두 없음)은 두고 가지 않는다 — ② 에 다시 오면 새 빈 줄을 둔다. */
    setDefectRows((rows) => rows.filter((row) => row.defectCodeId !== null || row.qty !== ''));
    setActiveQty('good');
    setInputPage('good');
  };
  /* ① 양품 → ② 불량. 넘어오면 불량 줄 1개를 미리 둔다(사용자 지시 2026-11-16). 이미 있으면 첫 줄을 고른다. */
  const goDefect = (): void => {
    setInputPage('defect');
    const first = defectRows[0];
    if (first !== undefined) {
      setActiveQty(first.key);
      defectPage.showIndex(0);
      return;
    }
    const key = `defect-${String(nextDefectKey.current)}`;
    nextDefectKey.current += 1;
    setDefectNotice(null);
    setDefectRows([{ key, defectCodeId: null, qty: '' }]);
    setActiveQty(key);
    defectPage.showIndex(0);
  };
  /* ③ 에서 [이전]으로 본 쪽을 지나 다시 ③ 으로 — 라벨을 붙이고 바로 스캔하도록 스캔 칸에 포커스를 둔다. */
  const returnToScan = (): void => {
    setScanBackPage(null);
    requestAnimationFrame(() => scanInputRef.current?.focus());
  };
  /*
   * ① 의 [확인] — 양품 수량을 넣었는지만 보고 ② 로 넘긴다(사용자 지시 2026-11-19). 저장하지 않는다. 0 도 넘긴다 —
   * 양품 없이 불량만 등록하는 길(② 에서 [확인] → 확인 창)이 그대로 있어야 한다.
   */
  const canConfirmGood =
    parsedQty !== null &&
    parsedQty >= 0 &&
    entry.workerNo !== null &&
    gates.input === 'allowed' &&
    !areDefectsLocked;
  /*
   * 작업 줄의 단계 버튼(사용자 지시 2026-11-19): ① [확인] · ② [이전] + [확인] · ③ [이전] + 그 단계의 주 동작.
   * 단계는 차례로만 나아간다 — ② 는 ① 의 [확인]으로만, ③ 은 ② 의 [확인](저장)으로만 열린다.
   */
  const stepButtons = (variant: 'filled' | 'outlined'): ReactNode => {
    const look = variant === 'filled' ? 'primary' : 'default';
    if (step === 'scan') {
      if (scanBackPage === 'good') {
        return (
          <PuButton variant={look} onClick={() => setScanBackPage('defect')}>
            {messages.common.confirm}
          </PuButton>
        );
      }
      if (scanBackPage === 'defect') {
        return (
          <>
            <PuButton onClick={() => setScanBackPage('good')}>{t.flow.work.toGood}</PuButton>
            <PuButton variant={look} onClick={returnToScan}>
              {messages.common.confirm}
            </PuButton>
          </>
        );
      }
      /* 발행·인쇄·마감이 도는 동안에는 [이전]을 막는다 — 지나간 쪽에서는 그 결과·다시 시도가 보이지 않는다. */
      const isOutputRunning =
        outputPhase === 'queued' ||
        outputPhase === 'issuing' ||
        outputPhase === 'printing' ||
        outputPhase === 'completing';
      return (
        <>
          <PuButton disabled={isOutputRunning} onClick={() => setScanBackPage('defect')}>
            {t.flow.work.toGood}
          </PuButton>
          {outputButton(variant)}
        </>
      );
    }
    if (step === 'input' && inputPage === 'good') {
      return (
        <PuButton
          variant={look}
          disabled={!canConfirmGood}
          aria-describedby={remainingId}
          onClick={goDefect}
        >
          {messages.common.confirm}
        </PuButton>
      );
    }
    if (step === 'input') {
      return (
        <>
          <PuButton onClick={goGood}>{t.flow.work.toGood}</PuButton>
          {outputButton(variant)}
        </>
      );
    }
    return outputButton(variant);
  };

  /** 불량 유형 고르기 칸의 후보 — 대분류 › 상세. 고르는 것은 상세다(`groupDefectCodes`). */
  const defectOptions = defectMajors.flatMap((major) =>
    major.minors.map((code) => ({
      value: String(code.defectCodeId),
      label: `${major.name} › ${masterName(code, code.defectName)}`,
    })),
  );
  const isDefectPage = step === 'input' && inputPage === 'defect';
  /** 넣을 LOT 이 없으면 불량만 등록한다 — 키패드는 고른 불량 줄을 받는다. */
  const isLotLoading = currentLot.data === undefined && !currentLot.isError;
  const isNoLotDefectMode =
    entry.workOrderId !== null && !isWorkOrderClosed && currentLot.data === null;
  const showsDefectsWithoutLot =
    lot === null && entry.workOrderId !== null && !isWorkOrderClosed && !isLotLoading;

  /*
   * 키패드가 지금 넣는 칸(#295 규칙 8) — 양품과 불량 수량이 같은 키패드를 쓴다. 넣을 칸이 없으면 `null`.
   */
  const padTarget: 'good' | DefectRowDraft | null =
    workerEntry.isMissing || isWorkOrderClosed || entry.workOrderId === null || isScanStep
      ? null
      : step === 'input' && inputPage === 'good'
        ? 'good'
        : isDefectPage || showsDefectsWithoutLot
          ? activeDefectRow
          : null;
  const padDecimal = uom.decimalScaleOf(lot?.uomId ?? workOrder.data?.uomId) > 0;
  const padLocked = padTarget === 'good' ? isQuantityLocked : areDefectsLocked;
  const padLabel =
    padTarget === null
      ? null
      : padTarget === 'good'
        ? t.flow.quantity.actual
        : (defectLabelOf(defectMajors, padTarget.defectCodeId) ??
          t.flow.defects.row(defectRows.indexOf(padTarget) + 1));
  const pressKey = (key: PuKey): void => {
    if (padTarget === null || padLocked) return;
    const next = (value: string): string =>
      quantityInput(applyKeypadKey(value, key, { decimal: padDecimal }));
    if (padTarget === 'good') {
      setActualQty(next);
      return;
    }
    updateDefectRow(padTarget.key, { qty: next(padTarget.qty) });
  };
  const clearPad = (): void => {
    if (padTarget === null || padLocked) return;
    if (padTarget === 'good') {
      setActualQty('');
      return;
    }
    updateDefectRow(padTarget.key, { qty: '' });
  };

  /** 불량 구획. LOT이 있으면 ② 불량 등록 단계, 없으면 안내 아래에 선다(불량만 등록). */
  const defectSection = (
    <section className="pr-defects" aria-label={t.flow.defects.title}>
      <div className="pr-sub">
        <h3>{t.flow.defects.title}</h3>
        <PuButton
          size="sm"
          disabled={areDefectsLocked || hasNoProcess}
          aria-describedby={hasNoProcess ? noProcessId : undefined}
          onClick={addDefectRow}
        >
          {t.flow.defects.add}
        </PuButton>
      </div>
      {hasNoProcess && (
        <PuNote tone="warn" id={noProcessId}>
          {t.flow.defects.noProcess}
        </PuNote>
      )}
      {defectCodes.isError && <PuNote tone="bad">{t.flow.defects.loadFailed}</PuNote>}
      {defectRows.length > 0 ? (
        <>
          {/* 칸 이름은 첫 줄 위에 한 번만 둔다. 줄마다 되풀이하지 않는다. */}
          <div className="pr-dhead" aria-hidden="true">
            <span>{t.flow.defects.type}</span>
            <span>{t.flow.defects.qty}</span>
            <span />
          </div>
          <ul ref={defectListRef} className="pr-drows pu-fit">
            {defectPage.items.map((row) => {
              const index = defectRows.indexOf(row);
              const rowName = t.flow.defects.row(index + 1);
              const check = defectChecks.get(row.key);
              return (
                <li
                  key={row.key}
                  className={row.key === duplicateRowKey ? 'pr-drow is-duplicate' : 'pr-drow'}
                  aria-label={rowName}
                >
                  {/* 유형은 칸 전체를 누르는 고르기 칸 → 선택 창(규칙 7). 비어 있으면 빨간 테두리(규칙 5). */}
                  <Select
                    aria-label={t.flow.defects.type}
                    value={row.defectCodeId === null ? null : String(row.defectCodeId)}
                    placeholder={t.flow.defects.choose}
                    options={defectOptions}
                    invalid={row.defectCodeId === null}
                    disabled={areDefectsLocked}
                    onClick={() => setActiveQty(row.key)}
                    onChange={(value) => {
                      if (value !== null) pickDefectCode(row.key, Number(value));
                    }}
                  />
                  <div className="pu-row">
                    <PuInput
                      aria-label={t.flow.defects.qty}
                      numeric
                      value={row.qty}
                      disabled={areDefectsLocked}
                      inputMode="decimal"
                      autoComplete="off"
                      target={
                        padTarget !== null && padTarget !== 'good' && padTarget.key === row.key
                      }
                      need={check !== undefined && (check.qtyMissing || check.qtyInvalid)}
                      onFocus={() => setActiveQty(row.key)}
                      onChange={(event) =>
                        updateDefectRow(row.key, { qty: quantityInput(event.target.value) })
                      }
                    />
                    <PuUnit>{uomLabel}</PuUnit>
                  </div>
                  <PuRemoveButton
                    label={t.flow.defects.remove(rowName)}
                    disabled={areDefectsLocked}
                    onClick={() => removeDefectRow(row.key)}
                  />
                </li>
              );
            })}
          </ul>
          <PuPager
            label={t.flow.defects.pageNav}
            total={defectRows.length}
            page={defectPage.page}
            pages={defectPage.pages}
            onPage={(next) => {
              defectPage.setPage(next);
              /* 쪽을 넘기면 그 쪽 첫 줄에 키패드가 넣는다(시안). */
              const first = defectRows[(next - 1) * defectPageSize];
              if (first !== undefined) setActiveQty(first.key);
            }}
          />
        </>
      ) : (
        <PuEmpty icon="list" title={t.flow.defects.emptyRows} hint={t.flow.defects.emptyHint} />
      )}
      {duplicateRowKey !== null && defectRows.some((row) => row.key === duplicateRowKey) && (
        <PuNote live>{t.flow.defects.duplicate}</PuNote>
      )}
      {defectNotice !== null && (
        <PuNote live>
          {defectNotice === 'saved' ? t.flow.defects.saved : t.flow.defects.queued}
        </PuNote>
      )}
    </section>
  );

  /*
   * 구획 안 단계 줄(규칙 4). 지금 단계보다 앞의 끝난 단계만 눌러 돌아간다 — 앞으로 건너뛰는 길은 없다(사용자 지시
   * 2026-11-19). 라벨 출력 뒤(③)에 돌아간 쪽은 보기만 한다.
   */
  const viewIndex = isScanStep
    ? scanBackPage === 'good'
      ? 0
      : scanBackPage === 'defect'
        ? 1
        : 2
    : isDefectPage
      ? 1
      : 0;
  const flow =
    step === null || isWorkOrderClosed ? null : (
      <PuFlow
        label={t.flow.work.stepsLabel}
        current={viewIndex}
        steps={[
          {
            label: t.flow.work.steps.input,
            done: isScanStep || isDefectPage,
            onGo: viewIndex === 0 ? undefined : isScanStep ? () => setScanBackPage('good') : goGood,
          },
          {
            label: t.flow.work.steps.defect,
            done: isScanStep,
            onGo: viewIndex === 2 ? () => setScanBackPage('defect') : undefined,
          },
          { label: t.flow.work.steps.scan, done: outputPhase === 'completed' },
        ]}
      />
    );
  /*
   * 불량만 등록하는 화면에 들어오면 불량 줄 1개를 미리 둔다(사용자 지시 2026-11-16 — ② 불량 등록 단계와 같게).
   * 들어올 때 한 번만이다. 저장한 뒤에는 「불량을 등록했습니다」만 남기고 줄을 다시 만들지 않는다.
   */
  useEffect(() => {
    if (!isNoLotDefectMode) return;
    const key = `defect-${String(nextDefectKey.current)}`;
    nextDefectKey.current += 1;
    setDefectRows((rows) => (rows.length > 0 ? rows : [{ key, defectCodeId: null, qty: '' }]));
    setActiveQty((current) => (current === 'good' ? key : current));
  }, [isNoLotDefectMode]);
  /* 라벨 출력 중에는 프린터를 바꾸지 못한다 — 나가는 도중에 대상이 바뀌면 어느 프린터로 갔는지 알 수 없다. */
  const isPrinterLocked =
    outputPhase === 'queued' ||
    outputPhase === 'issuing' ||
    outputPhase === 'printing' ||
    lotPrint.state.phase === 'sending';

  /* 실적 저장 거부(서버). 실적은 되돌아와 다시 입력한다. */
  const rejectionNote = outbox.rejection !== null && (
    <PuNote tone="bad">
      <b>{t.save.failTitle}</b> {rejectionText(outbox.rejection)}
    </PuNote>
  );

  const stepTitle = workerEntry.isMissing
    ? t.flow.work.steps.input
    : isScanView && !isWorkOrderClosed
      ? t.flow.work.steps.scan
      : isDefectPage || isNoLotDefectMode || (isScanStep && scanBackPage === 'defect')
        ? t.flow.work.steps.defect
        : t.flow.work.steps.input;

  /** 가운데 구획 본문 — 지금 단계의 일. */
  const stepBody = ((): ReactNode => {
    if (workerEntry.isMissing) {
      /* 사번이 없으면 단계 본문 대신 작업 시작의 「작업자」 묶음과 같은 빈 상태와 [사번 입력](PI-17). */
      return (
        <>
          {statusNote}
          <PuEmpty icon="list" title={messages.popChrome.workerNoDialog.empty}>
            <PuButton onClick={workerEntry.open}>{messages.popChrome.workerNoDialog.open}</PuButton>
          </PuEmpty>
        </>
      );
    }
    if (isScanView && !isWorkOrderClosed) {
      return (
        <>
          {flow}
          {statusNote}
          {/* 결과 한 줄(C-21). 실패면 그 자리에 다시 시도 버튼을 둔다. */}
          {outputResult !== null && (
            <PuNote
              tone={
                outputResult.tone === 'error'
                  ? 'bad'
                  : outputResult.tone === 'success'
                    ? 'ok'
                    : 'info'
              }
              live
              action={
                retryAction === null ? undefined : (
                  <PuButton
                    size="sm"
                    disabled={retryAction.disabled === true}
                    onClick={retryAction.run}
                  >
                    {retryAction.label}
                  </PuButton>
                )
              }
            >
              {outputResult.text}
            </PuNote>
          )}
          {/*
           * 스캔 칸(규칙 6). 값이 바뀔 때마다 대조하는 지금 동작 그대로다(`changeScan`) — Enter·[직접 입력]은
           * 칸 값을 바꾸는 것으로 끝나고 따로 보내지 않는다(같은 마감이 두 번 나가지 않게).
           */}
          <PuScanField
            label={t.flow.scan.label}
            inputId={scanId}
            inputRef={scanInputRef}
            value={scanValue}
            disabled={!canScan || gates.complete !== 'allowed'}
            error={scanMismatch && lot !== null ? t.flow.scan.mismatch(lot.lotNo) : undefined}
            onChange={changeScan}
            onSubmit={() => undefined}
          />
          {/* ⚠ 한 번에 한 줄만 낸다(사용자 지시 2026-09-10). 어긋남은 칸이 이미 말한다. */}
          {completeFailure !== null && !scanMismatch && (
            <PuNote tone="bad">{completeFailure}</PuNote>
          )}
          {sessionNote}
        </>
      );
    }
    if (lot === null || isWorkOrderClosed) {
      return (
        <>
          {statusNote}
          {rejectionNote}
          {isWorkOrderClosed ? (
            <PuNote>{t.flow.work.closed}</PuNote>
          ) : entry.workOrderId !== null && currentLot.data === null && !currentLot.isError ? (
            /*
             * 「LOT 없음」은 서버가 비었다고 답했을 때만 말한다. 불러오는 중이거나 못 불러왔으면 「없다」고
             * 단정하지 않는다. 두 안내가 겹치면 한 줄로 합친다(사용자 지시 2026-11-16).
             */
            <PuNote>{isPlanAchieved ? t.flow.work.planReachedNoLot : t.flow.work.noLot}</PuNote>
          ) : null}
          {sessionNote}
          {/* 넣을 LOT이 없어도 불량만 등록할 수는 있다(LOT 없이 저장하는 불량, 마감 전). */}
          {showsDefectsWithoutLot && defectSection}
        </>
      );
    }
    /* ③ 에서 돌아와 보는 ② — 이 LOT 에 보낸 불량(단말이 기억한 것)을 보기만 한다. 기억이 없으면 목록을 두지 않는다. */
    if (isScanStep && scanBackPage === 'defect') {
      return (
        <>
          {flow}
          {statusNote}
          <section className="pr-defects" aria-label={t.flow.defects.title}>
            <div className="pr-sub">
              <h3>{t.flow.defects.title}</h3>
            </div>
            {sentDefects === null ? null : sentDefects.length === 0 ? (
              <PuEmpty icon="list" title={t.flow.defects.emptyRows} />
            ) : (
              <ul className="pr-confirm-list">
                {sentDefects.map((row, index) => (
                  <li key={index}>
                    <span>{row.label}</span>
                    <b>{`${row.qty} ${uomLabel}`.trim()}</b>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      );
    }
    if (inputPage === 'defect' && !isScanStep) {
      return (
        <>
          {flow}
          {statusNote}
          {rejectionNote}
          {defectSection}
        </>
      );
    }
    return (
      <>
        {flow}
        {statusNote}
        {rejectionNote}
        {/* 작업지시량을 채워도 남은 LOT에 더 만들 수 있다 — 마감할 수 있다는 것을 먼저 알린다(④-1). */}
        {isPlanAchieved && <PuNote>{t.flow.work.planReached}</PuNote>}
        {/* 초과를 친 자리에서 바로 말한다(#1040). ⛔ 막지 않는다 — 초과 생산은 허용이다(✓확정 QA #27). */}
        {isOverrun && !isQuantityLocked && parsedQty !== null && remaining !== null && (
          <PuNote>
            {remaining > 0
              ? t.overrun.notice(withUnit(parsedQty - remaining), withUnit(remaining))
              : t.overrun.noticeNoRemaining}
          </PuNote>
        )}
        <PuField label={t.flow.quantity.actual} required htmlFor={actualQtyId}>
          <div className="pu-row">
            <PuInput
              id={actualQtyId}
              /* 칸 이름 옆 빨간 * 는 읽는 이름에 넣지 않는다. */
              aria-label={t.flow.quantity.actual}
              numeric
              value={actualQty}
              disabled={isQuantityLocked}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              target={padTarget === 'good'}
              need={actualQty === ''}
              onFocus={() => setActiveQty('good')}
              onChange={(event) => setActualQty(quantityInput(event.target.value))}
            />
            <PuUnit>{uomLabel}</PuUnit>
          </div>
        </PuField>
        {!isDefectOnly && parsedQty !== null && parsedQty <= 0 && (
          <PuNote tone="bad">{t.flow.quantity.invalid}</PuNote>
        )}
      </>
    );
  })();

  /* 다시 시도가 뜻이 있는 갈래: 현재 LOT 조회 실패, 단말 기능 확인 실패(G-3). */
  const leadRetry =
    !isWorkOrderClosed &&
    currentLot.isError &&
    !(currentLot.error instanceof CurrentLotUnreliableError) ? (
      <PuButton disabled={currentLot.isFetching} onClick={() => void currentLot.refetch()}>
        {t.flow.retry}
      </PuButton>
    ) : gates.input === 'unavailable' && step === 'input' ? (
      <PuButton onClick={gates.retry}>{t.flow.retry}</PuButton>
    ) : undefined;

  const hasBanner = outbox.isStalled || printerChoice.missingStoredName !== null;

  return (
    <main className="pr-uniform" aria-labelledby={titleId}>
      <PopHeader
        titleId={titleId}
        title={t.title}
        equipmentCode={identity.equipment?.equipmentCode ?? null}
        equipmentName={identity.equipment?.equipmentName ?? null}
        isConnected={outbox.isOnline}
        unsentCount={outbox.pendingCount}
        /* LOT 라벨 프린터 — 누르면 고른다(개선 명세 ⑤, 자재 LOT 라벨 화면과 같은 칩). 맨 위 줄 프린터 자리로 간다. */
        printer={
          <PrinterChip
            printers={lotPrinterViews}
            selected={printerChoice.printer}
            isLoading={lotPrinters.isPending}
            isError={lotPrinters.isError}
            isLocked={isPrinterLocked}
            onRetry={() => {
              void lotPrinters.refetch();
            }}
            noneLabel={t.flow.work.printerNone}
            showNone
            unknownLabel={t.flow.work.printerUnknown}
            retryLabel={messages.common.retry}
            onSelect={(name) => {
              setPickedPrinter(name);
              rememberPrinterName(name, LOT_PRINTER_STORAGE_KEY);
            }}
          />
        }
      />

      <PuScreen
        band={hasBanner}
        actionBar={
          /*
           * 버튼만(규칙 2·3). 일을 끝내는 버튼은 오른쪽, 빨간 주 버튼은 그때 할 일 하나 — 생산 중에는
           * 단계의 [확인](③ 은 그 단계의 일), 계획 수량을 달성했거나 남은 LOT이 없으면 [작업지시 마감]. 마감했으면 버튼이 없다.
           * ⛔ 초과라고 끄지도, 되묻지도 않는다 — 초과 생산은 허용이다(✓확정 QA #27).
           */
          <PuActionBar lead={leadRetry} label={messages.screenPatterns.actionBar.region}>
            {isWorkOrderClosed ? null : (
              <>
                {canCloseEarly && closeAction('outlined')}
                {isCloseMode
                  ? (lot !== null || isDefectOnly) && stepButtons('outlined')
                  : stepButtons('filled')}
                {isCloseMode && closeAction('filled')}
              </>
            )}
          </PuActionBar>
        }
      >
        {hasBanner && (
          <div className="pr-banners">
            {outbox.isStalled && <OutboxStallBanner onRetry={outbox.retryNow} />}
            {/* 기억해 둔 프린터가 목록에서 사라졌다 — 기본으로 돌아간 것을 말한다(개선 명세 ⑤ 2). */}
            {printerChoice.missingStoredName !== null && (
              <PuNote tone="warn">
                {messages.popMaterialLotLabel.printer.storedMissing(
                  printerChoice.missingStoredName,
                )}
              </PuNote>
            )}
          </div>
        )}

        {/* 세 열(규칙 1·8): 왼쪽 380 현재 LOT, 가운데 단계 본문, 맨 오른쪽 키패드. */}
        <PuCols variant="lk">
          <PuSection
            title={entry.workOrderId === null ? t.flow.currentLot.current : itemTitle}
            fold={{
              label: t.flow.currentLot.current,
              folded: isLotFolded,
              onChange: setIsLotFolded,
            }}
            meta={
              isPlanAchieved ? (
                <PuChip tone={overAchievedQty === null ? 'ok' : 'warn'}>
                  {overAchievedQty === null
                    ? t.overrun.achieved
                    : t.overrun.achievedOver(withUnit(overAchievedQty))}
                </PuChip>
              ) : undefined
            }
            className="pr-lot"
            labelId={lotTitleId}
            bodyClassName="pr-col-body"
          >
            {entry.workOrderId === null ? (
              <PuEmpty
                icon="list"
                title={t.flow.work.noWorkOrder}
                hint={t.flow.work.noWorkOrderHint}
              />
            ) : (
              <>
                {/* W/O 번호 · 공정 · 긴급은 제목 아래 한 줄(#291 · 시안). */}
                {workOrder.data !== undefined && (
                  <p className="pu-help pr-wo">
                    {isEmergency(workOrder.data) && (
                      <PuChip tone="bad">{messages.popChrome.header.emergency}</PuChip>
                    )}
                    <span className="pu-mono">{workOrder.data.workOrderNo}</span>
                    {workOrder.data.processName != null && workOrder.data.processName !== '' && (
                      <span>{` · ${workOrder.data.processName}`}</span>
                    )}
                  </p>
                )}

                {workOrder.isError && !isWorkOrderClosed && (
                  <LoadErrorBanner
                    error={workOrder.error}
                    onRetry={() => void workOrder.refetch()}
                  />
                )}

                {/* 작업지시 전체 진행: 이름, 「양품 / 작업지시량」과 잔량, 그 아래 막대. */}
                {workOrder.data !== undefined && workOrderGoodQty !== null && (
                  <div className="pr-progress">
                    <span className="pu-label">{t.flow.work.workOrderProgress}</span>
                    <div className="pr-progress-head">
                      <b>
                        {t.flow.work.workOrderProgressText(
                          formatQty(workOrderGoodQty),
                          formatQty(workOrder.data.orderQty),
                          uom.labelOf(workOrder.data.uomId) ?? '',
                        )}
                      </b>
                      {remaining !== null && remaining > 0 && (
                        <span className="pr-rest">
                          {t.flow.work.remaining(withUnit(remaining))}
                        </span>
                      )}
                    </div>
                    <div
                      className={
                        workOrderGoodQty > workOrder.data.orderQty
                          ? 'pu-progress pr-over'
                          : 'pu-progress'
                      }
                      role="progressbar"
                      aria-label={t.flow.work.workOrderProgress}
                      aria-valuemin={0}
                      aria-valuemax={workOrder.data.orderQty > 0 ? workOrder.data.orderQty : 1}
                      aria-valuenow={Math.min(
                        workOrderGoodQty,
                        Math.max(workOrder.data.orderQty, 1),
                      )}
                    >
                      <i
                        style={{
                          width: `${String(
                            workOrder.data.orderQty > 0
                              ? Math.min(100, (workOrderGoodQty / workOrder.data.orderQty) * 100)
                              : 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/*
                 * 라벨을 낸 뒤(스캔 대기 등)에는 이 LOT 에 넣은 실적을 보인다(사용자 지시 2026-11-16). 불량은 이
                 * 단말에서 보낸 것만 안다(단말 저장소) — 기억이 없으면 양품만 보인다.
                 */}
                {lot !== null && outputPhase !== 'idle' && parsedQty !== null && (
                  <dl className="pu-kv">
                    <dt>{t.flow.work.enteredResult}</dt>
                    <dd>
                      <span>
                        {t.flow.work.enteredGood(formatQty(parsedQty), uomLabel)}
                        {sentDefects === null || sentDefects.length === 0
                          ? null
                          : ` · ${t.flow.work.enteredDefect(
                              formatQty(sentDefects.reduce((sum, row) => sum + Number(row.qty), 0)),
                              uomLabel,
                            )}`}
                      </span>
                      {sentDefects !== null && sentDefects.length > 0 && (
                        <ul className="pr-entered-defects">
                          {sentDefects.map((row, index) => (
                            <li key={index}>{`${row.label} ${row.qty} ${uomLabel}`.trim()}</li>
                          ))}
                        </ul>
                      )}
                    </dd>
                  </dl>
                )}

                <hr className="pu-sep" />

                {/*
                 * 마감된 LOT — 최근 마감 순 목록과 마감 일시(사용자 지시 2026-11-16). 구획 높이에 들어가는 만큼
                 * 보이고 나머지는 쪽 넘김(규칙 1). ⚠ 서버는 LOT 생성 역순으로 준다 — 쪽 안에서는 마감 시각으로
                 * 다시 줄 세운다.
                 */}
                <section className="pr-completed" aria-label={t.flow.work.completedLots}>
                  <div className="pr-sub">
                    <h3>{t.flow.work.completedLots}</h3>
                    {completedLots.data !== undefined && (
                      <PuCount>{completedLots.data.page.total}</PuCount>
                    )}
                  </div>
                  {completedLots.data === undefined ? null : completedLots.data.items.length ===
                    0 ? (
                    <PuEmpty icon="box" title={t.flow.currentLot.completedEmpty} />
                  ) : (
                    <ol ref={completedListRef} className="pr-lots pu-fit">
                      {[...completedLots.data.items]
                        .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
                        .map((completedLot) => (
                          <li
                            key={completedLot.lotId}
                            className={
                              completedLot.lotId === justCompletedLotId ? 'is-new' : undefined
                            }
                          >
                            <span className="pu-mono">{completedLot.lotNo}</span>
                            {completedLot.lotId === justCompletedLotId && (
                              <PuChip tone="ok">{t.flow.currentLot.justCompleted}</PuChip>
                            )}
                            <span className="pr-at">
                              {formatPlantDateTime(completedLot.completedAt) ?? ''}
                            </span>
                          </li>
                        ))}
                    </ol>
                  )}
                  <PuPager
                    label={t.flow.currentLot.pageNav}
                    total={completedLots.data?.page.total ?? 0}
                    page={completedBoundary.page}
                    pages={completedBoundary.totalPages}
                    onPage={setCompletedPage}
                  />
                </section>

                {isTagTarget === true && (
                  <div className="pu-stack">
                    <h3 className="pr-sub">{t.flow.tag.title}</h3>
                    {serials.isError ? (
                      <PuNote tone="bad">{t.flow.tag.loadFailed}</PuNote>
                    ) : (
                      <>
                        <p className="pu-help">
                          {t.flow.tag.issued} {t.flow.tag.count(serialCount ?? 0)}
                        </p>
                        {tagIssueSummary.isError && (
                          <PuNote tone="bad">{t.flow.tag.summaryFailed}</PuNote>
                        )}
                        {parsedQty !== null && serialCount !== null && serialCount > parsedQty && (
                          <PuNote tone="bad">{t.flow.tag.tooMany}</PuNote>
                        )}
                        {tagMissing === 0 && <p className="pu-help">{t.flow.tag.matched}</p>}
                        {retryableSerials.length > 0 && (
                          <PuNote tone="bad">
                            {t.flow.tag.printIncomplete(retryableSerials.length)}
                          </PuNote>
                        )}
                        {/*
                         * 발행, 복구, 재출력은 서버가 늘 거부해 잠긴 동작이다(`IDENTIFICATION_TAG_ISSUE_LOCKED`).
                         * 늘 쓸 수 없는 기능은 화면에 두지 않는다(C-4). 상수를 되돌리면 다시 선다.
                         */}
                        {!IDENTIFICATION_TAG_ISSUE_LOCKED && (
                          <>
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
                                    {`${serial.serialNo} ${t.flow.tag.printOutcome[outcome]}`}
                                  </Checkbox>
                                );
                              })}
                            </div>
                            {unissuedSerials.length > 0 && (
                              <Button
                                variant="outlined"
                                disabled={tagDocumentIssue.isSaving || tagPrinter === null}
                                onClick={restoreTagDocuments}
                              >
                                {t.flow.tag.restoreDocuments(unissuedSerials.length)}
                              </Button>
                            )}
                            <Button
                              variant="outlined"
                              disabled={
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
                              {tagMissing === null
                                ? t.flow.tag.title
                                : t.flow.tag.issueMissing(tagMissing)}
                            </Button>
                            {(tagPrint.state.phase === 'renditionFailed' ||
                              tagPrint.state.phase === 'printFailed') &&
                              tagPrintTargets.length > 0 && (
                                <Button
                                  variant="outlined"
                                  onClick={() => void tagPrint.run(tagPrintTargets)}
                                >
                                  {t.flow.output.retryPrint}
                                </Button>
                              )}
                            {tagPrint.state.phase === 'reportFailed' && (
                              <>
                                <p className="field-error">{t.flow.tag.reportFailed}</p>
                                <Button
                                  variant="outlined"
                                  onClick={() => void tagPrint.retryReport()}
                                >
                                  {t.flow.output.retryReport}
                                </Button>
                              </>
                            )}
                            {issuedSerials.length > 0 && (
                              <Button
                                variant="outlined"
                                disabled={selectedTagIds.length === 0 || tagPrinter === null}
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
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </PuSection>

          <PuSection
            title={stepTitle}
            className="pr-step"
            labelId={stepTitleId}
            bodyClassName="pr-col-body"
          >
            {stepBody}
          </PuSection>

          <PuSection
            title={t.flow.keypad.title}
            labelId={keypadTitleId}
            meta={uomLabel === '' ? undefined : t.flow.keypad.unit(uomLabel)}
          >
            <PuKeypad
              targetLabel={padLabel}
              decimal={padDecimal}
              disabled={padLocked}
              onKey={pressKey}
              onClearAll={clearPad}
            />
          </PuSection>
        </PuCols>
      </PuScreen>

      <UnderReasonDialog
        open={isUnderReasonOpen}
        reasons={varianceReasons.data ?? []}
        isLoading={varianceReasons.isLoading}
        isError={varianceReasons.isError}
        error={reasonError}
        summary={
          lot === null
            ? null
            : {
                target: withUnit(lot.initialQty),
                actual: withUnit(lotDetail.data?.lot.progress?.goodQty ?? 0),
              }
        }
        onPick={completeUnder}
        onCancel={cancelUnder}
      />

      {/* [불량 등록] 확인 창(사용자 지시 2026-11-16) — 누르자마자 저장되지 않고 무엇을 등록할지 한 번 보인다. */}
      {isDefectConfirmOpen && (
        <PuConfirm
          title={t.flow.defects.confirmTitle}
          confirmLabel={t.flow.defects.confirmSave}
          cancelLabel={t.flow.defects.cancel}
          confirmDisabled={!canSaveDefectsOnly}
          onCancel={() => setIsDefectConfirmOpen(false)}
          onConfirm={() => {
            setIsDefectConfirmOpen(false);
            queueDefectsOnly();
          }}
        >
          <p className="pu-dialog-text">{t.flow.defects.confirmLead}</p>
          <ul className="pr-confirm-list">
            {filledDefectRows.map((row) => (
              <li key={row.key}>
                <span>{defectLabelOf(defectMajors, row.defectCodeId) ?? ''}</span>
                <b>{`${row.qty} ${uomLabel}`.trim()}</b>
              </li>
            ))}
          </ul>
          <PuNote>{t.flow.defects.confirmNote}</PuNote>
        </PuConfirm>
      )}

      <Dialog
        open={isTagReissueOpen}
        onClose={() => setIsTagReissueOpen(false)}
        title={t.flow.tag.reissueReason}
        /* ⛔ 바닥의 [닫기]와 같은 일을 하므로 X 를 두지 않는다 — 나가는 길은 하나다. */
        showCloseButton={false}
        /* ⛔ 팝업 바깥을 눌러 닫히지 않는다(사용자 지시 2026-09-10 · #1005). */
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
              label: masterName(reason, reason.codeName),
            }))}
            onChange={setTagReissueReason}
          />
        )}
      </Dialog>

      {workerEntry.dialog}
    </main>
  );
};

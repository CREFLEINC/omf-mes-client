import type { DispositionDecisionCreatedForward005 } from '@omf-mes/api-client';
import { Badge, Chip, Tabs, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { useApiClient } from '../../patterns/api-context';
import { lookupDisplayLabel } from '../../patterns/lookup-display';
import { requireIfMatch, useMasterWrite } from '../../patterns/master';
import {
  PaneLayoutToggle,
  PaneSplitter,
  useFitToViewport,
  usePaneLayout,
  usePaneSplit,
} from '../../patterns/po-board';
import { toApiError } from '../../patterns/request';
import {
  EMPTY_DECISION_FORM,
  hasDecisionInput,
  SORT,
  toDecisionCreateBody,
  validateDecisionForm,
  type DecisionCreateBody,
  type DecisionFormValue,
} from './decision-form';
import { DecisionResultCard, type DecisionResult } from './decision-result';
import {
  ConcessionHistory,
  ConcessionRequestDialog,
  PendingConcessionBox,
  useConcessions,
} from './concession-pane';
import { DecisionFormPane } from './decision-form-pane';
import { toDecisionLock } from './decision-lock';
import { DetailSlot } from './detail-slot';
import {
  codeOptionsOf,
  codeValueLabel,
  DISPOSITION_TYPE_CODES,
  dispositionOptionLock,
  dispositionTypeOptions,
  isClosedNonconformance,
  type DispositionOptionContext,
} from './disposition-codes';
import { DecisionHistory } from './decision-history';
import { FilterBar } from './filter-bar';
import {
  readPage,
  readPageSize,
  readPendingFilters,
  readSelectedDecisionId,
  readSelectedNonconformanceId,
  readTab,
  toAppliedSearchParams,
  toPendingListQuery,
  withSelectedDecision,
  withSelectedNonconformance,
  withTab,
  withPageSize,
  type PendingFilters,
  type ScreenTab,
} from './filters';
import {
  readHistoryFilters,
  toHistoryAppliedSearchParams,
  toHistoryListQuery,
  type HistoryFilters,
} from './history-filters';
import { HistoryFilterBar, HistoryList } from './history-tab';
import { LoadErrorBanner } from './load-error';
import {
  type DispositionLookup,
  useItemLookupFor,
  useNonconformanceStatusLookup,
  useSeverityLookup,
  useUomLookup,
} from './lookups';
import { NonconformanceList } from './nonconformance-list';
import { NowBand } from './now-band';
import { toPageView } from './pagination';
import { defaultPeriod } from './period';
import {
  dispositionKeys,
  nonconformanceDetailPath,
  useDecisionHistory,
  useDispositionDecisions,
  useNonconformanceDetail,
  usePendingNonconformances,
  useHistoryTotals,
  useLotStatuses,
  usePendingTotals,
} from './queries';
import { toRemainingQty } from './remaining-qty';
import { lotTail } from './sort-split-pane';
import {
  decisionUomIdOf,
  formatQty,
  toDecisionRow,
  toDetailView,
  toHistoryRow,
  sourceTextOf,
  toNonconformanceRow,
  type Nonconformance,
} from './types';

/** 취소된 부적합 — 처분 대기 목록에 두지 않는다(G2 L10). */
const CANCELLED_NONCONFORMANCE = 'CANCELLED';
const EMPTY_NONCONFORMANCES: Nonconformance[] = [];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * 저장에 실어 보내는 값. **대상 식별자를 함께 싣는다** — 멱등 키의 지문이 여기서 나오므로,
 * 경로에만 두면 다른 부적합에 같은 본문을 보낼 때 같은 키가 나간다.
 */
interface DecisionWriteVariables {
  nonconformanceId: number;
  body: DecisionCreateBody;
}

/** 결과를 아직 모르는 판정이 겨눈 부적합. 번호까지 기억해야 사용자에게 어디를 확인할지 말할 수 있다. */
interface PendingWriteTarget {
  nonconformanceId: number;
  nonconformanceNo: string;
}

/** 저장 순간의 폼과 대상 — 결과 카드 · 알림을 서버 응답과 함께 그린다(응답은 판정 한 건만 돌려준다). */
interface SubmittedDecision {
  nonconformanceId: number;
  form: DecisionFormValue;
  lotNos: { lotId: number; lotNoText: string }[];
  inboundLotNo: string | null;
  inspectionRequestNo: string | null;
}

/** 조회가 끝나기 전엔 `null` — 주소의 코드를 아직 판정할 수 없다. 끝나면 활성 코드 목록(빈 배열 포함). */
const settledCodes = (lookup: DispositionLookup): readonly string[] | null =>
  lookup.isLoading ? null : codeOptionsOf(lookup).map((option) => option.value);

/** 저장 순간의 폼 · 대상과 서버 응답으로 결과 카드의 값을 만든다. */
const toDecisionResult = (
  sent: SubmittedDecision,
  data: DispositionDecisionCreatedForward005 | undefined,
): DecisionResult => {
  if (sent.form.dispositionTypeCode !== SORT) {
    return {
      kind: 'whole',
      dispositionTypeCode: sent.form.dispositionTypeCode,
      lotCount: sent.lotNos.length,
      inboundLotNo: sent.inboundLotNo,
    };
  }
  const moved = new Set(sent.form.sortLotIds);
  const names = (rows: { lotNoText: string }[]): string =>
    rows.map((row) => lotTail(row.lotNoText)).join(', ');
  return {
    kind: 'sort',
    restLots: names(sent.lotNos.filter((lot) => !moved.has(lot.lotId))),
    movedLots: names(sent.lotNos.filter((lot) => moved.has(lot.lotId))),
    newInboundLotNo: data?.newInboundLotNo ?? null,
    newInspectionRequestNo: data?.newInspectionRequestNo ?? null,
    originalInspectionRequestNo: sent.inspectionRequestNo,
    newNonconformanceId: data?.newNonconformanceId ?? null,
    newNonconformanceNo: data?.newNonconformanceNo ?? null,
    goodQty: sent.form.goodQty.trim(),
    defectQty: sent.form.defectQty.trim(),
  };
};

export interface DispositionDecisionScreenProps {
  dispositionTypeCodes?: readonly string[];
  /** 기본 기간을 정하는 기준 날. 감지기가 실행하는 날에 결과가 좌우되지 않게 밖에서 받는다. */
  today?: Date;
  /** UTC 기준 분. 기본은 브라우저의 시간대다. */
  offsetMinutes?: number;
}

export const DispositionDecisionScreen = ({
  dispositionTypeCodes = DISPOSITION_TYPE_CODES,
  today,
  offsetMinutes,
}: DispositionDecisionScreenProps = {}) => {
  /*
   * 품질 승인 처리 화면과 같은 짜임(#223) — 조회 조건은 위 한 구획, 그 아래 목록 | 상세 및 판정이 나란히(좌우 · 상하 고름),
   * 가운데 막대로 폭을 나누고 고른 비율은 다음에 들어와도 남는다.
   */
  const { splitRef, aboveRef } = useFitToViewport();
  const paneLayout = usePaneLayout('omf-mes:dispositions:layout');
  const sideSplit = usePaneSplit('omf-mes:dispositions:split', 0.5);
  const stackSplit = usePaneSplit('omf-mes:dispositions:stack-split', 0.5);
  const split = paneLayout.layout === 'stack' ? stackSplit : sideSplit;
  const t = messages.dispositionDecision;
  const [searchParams, setSearchParams] = useSearchParams();
  const baseDate = useMemo(() => today ?? new Date(), [today]);
  const zone = useMemo(
    () => offsetMinutes ?? -baseDate.getTimezoneOffset(),
    [baseDate, offsetMinutes],
  );

  /* 심각도·상태 선택지는 공통코드 조회가 채운다(G-32). 주소의 코드는 목록이 서기 전(null)엔 버리지 않는다. */
  const severity = useSeverityLookup();
  const status = useNonconformanceStatusLookup();
  const severityCodes = useMemo(
    () => settledCodes(severity),
    [severity.entries, severity.isLoading],
  );
  const statusCodes = useMemo(() => settledCodes(status), [status.entries, status.isLoading]);
  const filters = useMemo(
    () => readPendingFilters(searchParams, baseDate, severityCodes, statusCodes),
    [baseDate, searchParams, severityCodes, statusCodes],
  );
  const page = readPage(searchParams);
  const size = readPageSize(searchParams);
  const tab = readTab(searchParams);
  const selectedId = readSelectedNonconformanceId(searchParams);
  /* 처분 이력 탭에서 고른 판정 한 건 — 고른 줄 표시용(#223). */
  const selectedDecisionId = readSelectedDecisionId(searchParams);
  /*
   * 기간이 막히면 `null`이고 조회가 열리지 않는다.
   *
   * ⚠ **이 화면에서는 그 갈래에 닿지 않는다** — `readPendingFilters`가 쓸 수 없는 기간을 최근
   * 한 달로 되돌리기 때문이다(L-3). 그래서 「막혔을 때」를 위한 방어 분기를 여기 두지 않는다 —
   * 닿지 않는 분기는 감지기가 물 수 없고, 물지 못하는 코드는 조용히 썩는다.
   * 갈래 자체는 조회 조건 쪽이 타입으로 들고 있어, 되돌리기를 없애면 컴파일이 먼저 잡는다.
   */
  /* ⚠ 보지 않는 목록은 부르지 않는다 — 탭마다 조회를 «닫는다». 원장 조회가 두 배가 된다. */
  const query = useMemo(
    () => (tab === 'pending' ? toPendingListQuery(filters, page, zone, size) : null),
    [filters, page, size, tab, zone],
  );
  const historyFilters = useMemo(
    () => readHistoryFilters(searchParams, baseDate, dispositionTypeCodes),
    [baseDate, dispositionTypeCodes, searchParams],
  );
  const historyQuery = useMemo(
    () => (tab === 'history' ? toHistoryListQuery(historyFilters, page, zone, size) : null),
    [historyFilters, page, size, tab, zone],
  );

  const list = usePendingNonconformances(query);
  const history = useDecisionHistory(historyQuery);
  /*
   * 탭 줄 칩의 건수(사용자 지시 · #223) — 지금 조건의 첫 쪽 조회 총수. 보고 있는 쪽이 첫 쪽이면 위 목록과 같은
   * 조회라 다시 나가지 않는다. 보지 않는 쪽은 첫 쪽 하나만 부른다.
   */
  const pendingCount = usePendingNonconformances(
    useMemo(() => toPendingListQuery(filters, 1, zone, size), [filters, size, zone]),
  ).data?.page.total;
  /* 상태 칩 — 공통코드 상태마다 지금 조건(상태는 빼고)의 건수. */
  /* 취소된 부적합(IQC 확정 취소로 생긴 `CANCELLED`)은 처분할 것이 아니다 — 처분 대기에서 뺀다(G2 L10). */
  const statusOptions = codeOptionsOf(status).filter(
    (option) => option.value !== CANCELLED_NONCONFORMANCE,
  );
  const statusTotals = usePendingTotals(
    useMemo(
      () =>
        statusOptions.flatMap((option) => {
          const query = toPendingListQuery({ ...filters, statusCode: option.value }, 1, zone, size);
          return query === null ? [] : [query];
        }),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- 선택지는 상태 조회가 바뀔 때만 바뀐다.
      [filters, size, zone, status.entries],
    ),
  );
  /* 처분 유형 칩 — 유형마다 지금 조건(유형은 빼고)의 건수. */
  const historyTypeOptions = dispositionTypeOptions(dispositionTypeCodes);
  const historyTypeTotals = useHistoryTotals(
    useMemo(
      () =>
        historyTypeOptions.flatMap((option) => {
          const query = toHistoryListQuery(
            { ...historyFilters, dispositionTypeCode: option.value },
            1,
            zone,
            size,
          );
          return query === null ? [] : [query];
        }),
      // eslint-disable-next-line react-hooks/exhaustive-deps -- 선택지는 주입된 코드 목록이 바뀔 때만 바뀐다.
      [historyFilters, size, zone, dispositionTypeCodes],
    ),
  );
  const historyCount = useDecisionHistory(
    useMemo(() => toHistoryListQuery(historyFilters, 1, zone, size), [historyFilters, size, zone]),
  ).data?.page.total;
  const detail = useNonconformanceDetail(selectedId);
  const concessions = useConcessions(selectedId);
  /* 상세 아래 탭 — 판정 이력 | 특채 요청 및 이력(#223). */
  const [sideTab, setSideTab] = useState<'decisions' | 'concessions'>('decisions');
  /* 특채 요청 팝업 — 처분 대기에서 고른 부적합에 대해 연다(사용자 지시 · #223). */
  const [isConcessionOpen, setIsConcessionOpen] = useState(false);
  const decisions = useDispositionDecisions(selectedId);
  /* 줄 · 상세에 보이는 품목은 첫 쪽 밖이어도 이름으로(G2 L-c). */
  const items = useItemLookupFor([
    ...(list.data?.items ?? []).map((item) => item.itemId),
    ...(history.data?.items ?? []).map((item) =>
      'itemId' in item && typeof item.itemId === 'number' ? item.itemId : null,
    ),
    detail.data?.itemId,
  ]);
  const uoms = useUomLookup();

  const rows = useMemo(
    () =>
      (list.data?.items ?? EMPTY_NONCONFORMANCES)
        .filter((item) => item.statusCode !== CANCELLED_NONCONFORMANCE)
        .map(toNonconformanceRow),
    [list.data],
  );
  /* 005 목록 「원천」 칸(G2 L8) — 행 모양은 그대로 두고 따로 넘긴다. */
  const sourceTexts = useMemo(
    () =>
      new Map(
        (list.data?.items ?? EMPTY_NONCONFORMANCES).map(
          (item) => [item.nonconformanceId, sourceTextOf(item)] as const,
        ),
      ),
    [list.data],
  );
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);
  const detailError = detail.isError ? toApiError(detail.error) : null;
  const isDetailNotFound = detailError?.kind === 'http' && detailError.status === 404;
  const remaining = toRemainingQty(decisions.data?.summary);
  const uomId = decisionUomIdOf(detail.data?.lots);
  const detailView = useMemo(
    () => (detail.data === undefined ? null : toDetailView(detail.data)),
    [detail.data],
  );
  const lotRows = detailView?.lots ?? [];
  const lotStatuses = useLotStatuses(
    useMemo(() => (detail.data?.lots ?? []).map((lot) => lot.lotId), [detail.data]),
  );
  const decisionRows = useMemo(
    () => (decisions.data?.items ?? []).map(toDecisionRow),
    [decisions.data],
  );

  const [form, setForm] = useState<DecisionFormValue>(EMPTY_DECISION_FORM);
  /* 저장 결과 카드 — 그 부적합을 보고 있는 동안만 보인다(005 시안). */
  const [result, setResult] = useState<{ nonconformanceId: number; result: DecisionResult } | null>(
    null,
  );
  const submitted = useRef<SubmittedDecision | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  /** 선택을 옮겨도 쓰기가 따라다니지 않도록, 겨눈 부적합을 기억한다. */
  const [pendingTarget, setPendingTarget] = useState<PendingWriteTarget | null>(null);
  const { client } = useApiClient();
  const queryClient = useQueryClient();
  const toast = useToast();

  /**
   * ⭐ **대상 식별자를 «본문 밖»이 아니라 쓰기 변수에 싣는다.**
   *
   * 멱등 키의 지문은 쓰기 변수에서 나오는데 `nonconformanceId`는 경로에 있다. 변수에 얹지
   * 않으면 **다른 부적합에 같은 본문을 보낼 때 같은 키가 나가고**, 서버가 전역 유일 제약으로
   * 중복을 걸러내면 두 번째 판정은 기록되지 않는데 화면은 성공으로 읽는다 — 되돌릴 수 없는
   * 원장 위의 조용한 유실이다(공유계약 C-1).
   */
  const write = useMasterWrite<DecisionWriteVariables, DispositionDecisionCreatedForward005>({
    request: async (variables, headers) => {
      const result = await client.POST(
        '/quality/nonconformances/{nonconformanceId}/disposition-decisions',
        {
          params: {
            path: { nonconformanceId: variables.nonconformanceId },
            header: {
              'Idempotency-Key': headers['Idempotency-Key'],
              /* ⛔ 계약이 이 헤더를 **필수**로 바꿨다 — 없으면 빈 값을 채우지 않고 멈춘다. */
              'If-Match': requireIfMatch(headers),
            },
          },
          body: variables.body,
        },
      );

      /*
       * ⭐ **raw `error`를 가로채 구조화 필드로 문구를 되말한다.** 공유 정규화기
       * (`packages/api-client/src/errors.ts:normalizeApiError`)는 `conflictCause`가 있어야
       * `kind: 'conflict'`로 분류하는데, 이 둘(`DISPOSITION_QTY_EXCEEDED`·`INVALID_STATE`)은
       * `conflictCause`를 싣지 않아 `kind: 'http'`로 떨어지며 `message` 원문만 남는다 — 공유
       * 정규화기는 고치지 않고 이 화면에서만 되말한다(`suspicious-material-hold/hold-execution.tsx`
       * L58-79와 같은 기법). ⛔ 서버 `message` 원문은 표시·파싱하지 않는다. 근거: W-03-10 §6 ·
       * 공유계약 A-9 ⓑ · omf-mes#253.
       */
      if (result.response.status !== 409 || !isRecord(result.error)) return result;

      /* 계약 형태별로 갈린 오류 타입을 원시 레코드로 본다 — 위 가드가 런타임 형태를 보장한다. */
      const raw = result.error as Record<string, unknown>;
      if (raw.code === 'DISPOSITION_QTY_EXCEEDED') {
        const remainingText = formatQty(
          typeof raw.remainingQty === 'number' ? raw.remainingQty : undefined,
        );
        return {
          ...result,
          error: { ...raw, message: t.form.qtyExceededByServer(remainingText) },
        };
      }
      if (raw.code === 'INVALID_STATE') {
        return { ...result, error: { ...raw, message: t.form.alreadyClosed } };
      }

      return result;
    },
    /* ⭐ 토큰은 부적합 «상세»가 내린다 — 저장 경로가 아니다(공유계약 B-1). */
    etagPath: selectedId === null ? null : nonconformanceDetailPath(selectedId),
    /* ⚠ 참조 이름 조회는 뿌리 키가 갈려 있어 여기 걸리지 않는다 — 판정으로 바뀌지 않는 값이다. */
    invalidateKeys: [dispositionKeys.all],
    knownFields: [
      'dispositionTypeCode',
      'decisionQty',
      'uomId',
      'reason',
      'lotIds',
      'goodQty',
      'defectQty',
    ],
    /* 되돌릴 수 없는 쓰기다 — 취소 API가 없고 LOT 상태 전이를 함께 부른다(공유계약 B-8). */
    keyLifetime: 'until-applied',
    onSuccess: (data) => {
      const sent = submitted.current;
      if (sent !== null) {
        const next = toDecisionResult(sent, data);
        setResult({ nonconformanceId: sent.nonconformanceId, result: next });
        /* 선별은 옮긴 LOT 이 어디로 갔는지 밝힌다 — 다음 처분은 그 새 부적합에서 한다(US7-2). */
        toast.show({
          variant: 'success',
          description:
            next.kind === 'sort'
              ? t.sort.toast(
                  next.movedLots,
                  next.newInboundLotNo ?? t.sort.newInboundLot,
                  next.newNonconformanceNo ?? t.values.unknownQty,
                )
              : t.form.success,
        });
      } else {
        toast.show({ variant: 'success', description: t.form.success });
      }
      setForm(EMPTY_DECISION_FORM);
      setShowErrors(false);
      setPendingTarget(null);
    },
  });

  useEffect(() => {
    setForm(EMPTY_DECISION_FORM);
    setShowErrors(false);
  }, [selectedId]);

  /* 서버가 되돌린 필드 오류가 화면 검증을 덮는다 — 계약이 정본이다. */
  const formContext = { remainingQty: remaining.value, lotCount: lotRows.length };
  const errors = { ...validateDecisionForm(form, formContext), ...write.fieldErrors };
  /* 005 — 처분 유형마다 막힘(종결 · 특채 결재 대기 · 선별 규칙 · 선별로 생긴 부적합의 정상). */
  const pendingConcession = concessions.data?.find((row) => row.statusCode === 'PENDING');
  const optionContext: DispositionOptionContext = {
    isClosed:
      detail.data !== undefined &&
      isClosedNonconformance(detail.data.statusCode, remaining.isSettled),
    hasPendingConcession: pendingConcession !== undefined,
    inboundLotNo: detailView?.inboundLotNo,
    lotCount: lotRows.length,
    decisionCount: decisions.data?.items.length ?? 0,
    isSortedOff: detailView?.sortedFrom !== null && detailView?.sortedFrom !== undefined,
  };
  const dispositionOptions = dispositionTypeOptions(dispositionTypeCodes).map((option) => {
    const hint = t.form.typeHint[option.value];
    const lockReason = dispositionOptionLock(option.value, optionContext);
    return {
      ...option,
      ...(hint === undefined ? {} : { hint }),
      ...(lockReason === undefined ? {} : { lockReason }),
    };
  });
  const concessionLock = dispositionOptionLock('CONCESSION', optionContext);
  const uomText = uomId === undefined ? '' : ` ${lookupDisplayLabel(uoms, uomId)}`;
  const isOtherTarget = pendingTarget !== null && pendingTarget.nonconformanceId !== selectedId;
  const lock = toDecisionLock({
    selectedId,
    isSaving: write.isSaving,
    writeError: write.error,
    detailError,
    uomId,
    dispositionTypeCodes,
    ...(isOtherTarget && pendingTarget !== null
      ? { otherPendingWriteNo: pendingTarget.nonconformanceNo }
      : {}),
  });

  const apply = (next: PendingFilters, nextPage = 1): void => {
    setSearchParams((current) => toAppliedSearchParams(current, next, nextPage));
  };

  const save = (): void => {
    setShowErrors(true);
    /*
     * 잠긴 동안에는 저장 버튼이 눌리지 않으므로 여기서 잠금을 다시 보지 않는다 —
     * 닿지 않는 분기는 감지기가 물 수 없다. 단위 좁히기만 남는다(타입이 요구한다).
     */
    if (uomId === undefined || selectedId === null) return;

    /* 검증을 통과하지 못하면 본문이 만들어지지 않는다 — 그 자체가 마지막 문이다. */
    const body = toDecisionCreateBody(form, uomId, formContext);
    if (body === undefined) return;

    submitted.current = {
      nonconformanceId: selectedId,
      form,
      lotNos: lotRows.map((lot) => ({ lotId: lot.lotId, lotNoText: lot.lotNoText })),
      inboundLotNo: detailView?.inboundLotNo ?? null,
      inspectionRequestNo: detailView?.inspectionRequestNo ?? null,
    };
    setPendingTarget({
      nonconformanceId: selectedId,
      nonconformanceNo: detail.data?.nonconformanceNo ?? String(selectedId),
    });
    write.write({ nonconformanceId: selectedId, body });
  };

  /**
   * 적용 여부를 모르는 저장에서 빠져나가는 길.
   * 서버 상태를 다시 읽고 오류 표시를 지운다 — **멱등 키는 버리지 않는다**(훅이 그렇게 둔다).
   */
  const checkOutcome = (): void => {
    const target = pendingTarget?.nonconformanceId ?? selectedId;
    if (target === null) return;

    /*
     * ⭐ **쓰기가 겨눈 부적합을 다시 읽는다 — 지금 «보고 있는» 것이 아니다.**
     * 선택을 옮긴 뒤 확인하면 화면은 겨냥된 레코드를 한 번도 읽지 않은 채 잠금만 지우게 되고,
     * 미해결 쓰기가 있었다는 사실이 화면에서 사라진다. 다른 것을 겨눴으면 그리로 데려간다.
     */
    void queryClient.invalidateQueries({ queryKey: dispositionKeys.detail(target) });
    void queryClient.invalidateQueries({ queryKey: dispositionKeys.decisions(target) });
    if (target !== selectedId) {
      setSearchParams((current) => withSelectedNonconformance(current, target));
    }

    write.reset();
    setPendingTarget(null);
  };

  const applyHistory = (next: HistoryFilters, nextPage = 1): void => {
    setSearchParams((current) => toHistoryAppliedSearchParams(current, next, nextPage));
  };

  const historyRows = useMemo(() => (history.data?.items ?? []).map(toHistoryRow), [history.data]);

  /*
   * 맨 위 한 줄(사용자 지시 · #223) — 왼쪽 「처분 대기 · 처분 이력」 탭(건수), 오른쪽 칩(처분 대기는 상태, 처분 이력은
   * 처분 유형 · 건수 · 누르면 그 값만, 다시 누르면 풀림)과 배치 고르기. 품질 승인 처리의 유형 탭 줄과 같은 모양이다.
   * 제목 · 경로 줄은 두지 않는다.
   */
  const countBadge = (
    count: number | undefined,
    label: (count: number | undefined) => string,
  ): ReactNode =>
    count !== undefined && count > 0 ? (
      <Badge count={count} max={99} aria-label={label(count)} />
    ) : undefined;
  const topBar = (
    <div className="quality-approval-type-bar">
      <Tabs
        className="quality-approval-type-tabs"
        aria-label={t.tabs.label}
        value={tab}
        onChange={(next) => setSearchParams((current) => withTab(current, next as ScreenTab))}
        items={[
          /* 건수는 검사 조회·판정 탭처럼 이름 옆 빨간 숫자 배지(0이면 두지 않는다 · 사용자 지시 · #223). */
          {
            value: 'pending',
            label: t.tabs.pending,
            badge: countBadge(pendingCount, t.tabs.pendingCount),
            content: null,
          },
          {
            value: 'history',
            label: t.tabs.history,
            badge: countBadge(historyCount, t.tabs.historyCount),
            content: null,
          },
        ]}
      />
      <div className="quality-approval-type-bar-tools">
        {/* 상태 칩은 처분 대기에서만 — 이력은 상태 축이 없다. 배치 고르기는 두 탭 같이(#223). */}
        {tab === 'pending' && (
          <div
            className="quality-approval-status-chips"
            role="group"
            aria-label={t.fields.statusCode}
          >
            {statusOptions.map((option, index) => {
              const isActive = filters.statusCode === option.value;
              return (
                <Chip
                  key={option.value}
                  variant="filter"
                  size="sm"
                  selected={isActive}
                  aria-pressed={isActive}
                  onClick={() => apply({ ...filters, statusCode: isActive ? '' : option.value })}
                >
                  {t.statusChip(option.label, statusTotals[index])}
                </Chip>
              );
            })}
          </div>
        )}
        {/* 처분 이력은 처분 유형 칩 — 건수 · 누르면 그 유형만, 다시 누르면 풀림(사용자 지시 · #223). */}
        {tab === 'history' && (
          <div
            className="quality-approval-status-chips"
            role="group"
            aria-label={t.fields.historyType}
          >
            {historyTypeOptions.map((option, index) => {
              const isActive = historyFilters.dispositionTypeCode === option.value;
              return (
                <Chip
                  key={option.value}
                  variant="filter"
                  size="sm"
                  selected={isActive}
                  aria-pressed={isActive}
                  onClick={() =>
                    applyHistory({
                      ...historyFilters,
                      dispositionTypeCode: isActive ? '' : option.value,
                    })
                  }
                >
                  {t.statusChip(option.label, historyTypeTotals[index])}
                </Chip>
              );
            })}
          </div>
        )}
        <PaneLayoutToggle
          layout={paneLayout.layout}
          onChange={paneLayout.change}
          labels={messages.qualityApproval.layout}
        />
      </div>
    </div>
  );

  return (
    <>
      {topBar}
      {/* 005 — 바뀌기 전 처분 방식을 알리는 띠(접힘으로 시작 · 처분 대기에서만). */}
      {tab === 'pending' && <NowBand />}
      {/* 두 탭이 같은 짜임(사용자 지시 · #223) — 위 조회 조건, 아래 목록 | 오른쪽 상세. 처분 이력은 판정 입력 없이 보기만. */}
      <section ref={aboveRef} className="pane po-board-filter" aria-label={t.panes.filter}>
        {tab === 'pending' ? (
          <FilterBar
            applied={filters}
            severity={severity}
            onApply={(next) => apply(next)}
            onReset={() =>
              apply({
                ...defaultPeriod(baseDate),
                itemId: '',
                severityCode: '',
                statusCode: '',
                sourceCode: '',
              })
            }
          />
        ) : (
          <HistoryFilterBar
            applied={historyFilters}
            onApply={(next) => applyHistory(next)}
            onReset={() =>
              applyHistory({ ...defaultPeriod(baseDate), itemId: '', dispositionTypeCode: '' })
            }
          />
        )}
      </section>
      <div
        ref={splitRef}
        className={`${paneLayout.className} disposition-split`}
        style={split.style}
      >
        <section
          className="pane po-board-pane po-board-scroll disposition-pane disposition-list-pane"
          aria-label={tab === 'pending' ? t.panes.list : t.panes.history}
        >
          {/* 제목은 두지 않는다 — 구획 이름(`aria-label`)으로만 남긴다(사용자 지시 · #223). */}
          {tab === 'pending' ? (
            <NonconformanceList
              rows={rows}
              sourceTexts={sourceTexts}
              items={items}
              severity={severity}
              status={status}
              isLoading={list.isPending}
              error={
                list.isError ? (
                  <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />
                ) : null
              }
              page={pageView}
              meta={list.data?.page ?? { page, size: 0, total: 0 }}
              selectedId={selectedId}
              onSelect={(id) =>
                setSearchParams((current) =>
                  withSelectedNonconformance(current, selectedId === id ? null : id),
                )
              }
              onChangeSize={(next) => setSearchParams((current) => withPageSize(current, next))}
              onChangePage={(nextPage) => apply(filters, nextPage)}
            />
          ) : (
            <HistoryList
              rows={historyRows}
              uoms={uoms}
              page={toPageView(
                history.data?.page ?? { page, size: 0, total: 0 },
                historyRows.length,
              )}
              meta={history.data?.page ?? { page, size: 0, total: 0 }}
              isLoading={history.isPending && historyQuery !== null}
              error={
                history.isError ? (
                  <LoadErrorBanner error={history.error} onRetry={() => void history.refetch()} />
                ) : null
              }
              selectedId={selectedDecisionId}
              onSelect={(row) =>
                setSearchParams((current) =>
                  withSelectedDecision(
                    current,
                    row.dispositionDecisionId === selectedDecisionId ? null : row,
                  ),
                )
              }
              onChangeSize={(next) => setSearchParams((current) => withPageSize(current, next))}
              onChangePage={(nextPage) => applyHistory(historyFilters, nextPage)}
            />
          )}
        </section>
        <PaneSplitter
          label={messages.qualityApproval.splitter}
          ratio={split.ratio}
          onChange={split.commit}
          orientation={paneLayout.layout === 'stack' ? 'horizontal' : 'vertical'}
        />
        {/*
         * 오른쪽은 한 구획 — 부적합 상세 · 처분 판정 · 처분 이력/특채 요청 이력 탭을 위에서 아래로(사용자 시안 · omf-all-around#223).
         */}
        <section
          className="pane po-board-pane po-board-scroll disposition-pane disposition-side"
          aria-label={tab === 'pending' ? t.panes.detailDecision : t.panes.historyDetail}
        >
          {/*
           * 머리 — 제목 왼쪽, 고른 부적합의 상태 오른쪽(사용자 시안 · #223). 고르기 전에는 제목 없이 안내만 —
           * 목록에서 고르면 제목과 상세가 선다(omf-all-around#228).
           */}
          {selectedId !== null && (
            <div className="disposition-side-head">
              <h2 className="pane-title">
                {tab === 'pending' ? t.panes.detailDecision : t.panes.historyDetail}
              </h2>
              {detail.data !== undefined && (
                <Chip
                  size="sm"
                  status={detail.data.statusCode === 'DECIDED' ? 'success' : 'warning'}
                >
                  {codeValueLabel(status, detail.data.statusCode)}
                </Chip>
              )}
            </div>
          )}
          <div className="disposition-side-part" aria-label={t.panes.detail} role="group">
            <DetailSlot
              selectedId={selectedId}
              detail={{
                isPending: detail.isPending,
                isError: detail.isError,
                isNotFound: isDetailNotFound,
                error: detail.error,
                view: detailView,
              }}
              items={items}
              severity={severity}
              uoms={uoms}
              onRetry={() => void detail.refetch()}
              emptyTitle={tab === 'pending' ? t.detail.select : t.detail.selectHistory}
              lotStatuses={lotStatuses}
              remainingText={
                remaining.value === undefined ? undefined : `${remaining.text}${uomText}`
              }
              onOpenNonconformance={(id) =>
                setSearchParams((current) => withSelectedNonconformance(current, id))
              }
            />
          </div>
          {/* 판정 입력은 처분 대기에서만 — 처분 이력은 보기만 한다(#223). */}
          {tab === 'pending' && selectedId !== null && detail.data !== undefined && (
            <>
              {/* 처분 판정 — 입력 카드와 단추. 남은 수량은 조회 시점 참고값이고 최종은 저장 때 서버가 낸다. */}
              <div
                className="disposition-side-part disposition-decision-card"
                role="group"
                aria-label={t.panes.decision}
              >
                <div className="disposition-side-head">
                  <h3 className="pane-subtitle">{t.form.heading}</h3>
                </div>
                {/* 적용 전 특채 — 결재 상태와 [특채 적용]을 이 상자에(시안 W0310-After · G2 M3). */}
                {pendingConcession !== undefined && (
                  <PendingConcessionBox concession={pendingConcession} lotCount={lotRows.length} />
                )}
                <DecisionFormPane
                  value={form}
                  errors={showErrors ? errors : write.fieldErrors}
                  remainingQty={remaining.value}
                  lockReason={lock.reason}
                  isUncertain={lock.isUncertain}
                  onCheckOutcome={checkOutcome}
                  dispositionOptions={dispositionOptions}
                  concession={{
                    hint: t.form.typeHint.CONCESSION ?? '',
                    lockReason: concessionLock,
                    onRequest: () => setIsConcessionOpen(true),
                  }}
                  lots={lotRows}
                  inboundLotNo={detailView?.inboundLotNo}
                  inspectionRequestNo={detailView?.inspectionRequestNo}
                  uomId={uomId}
                  uoms={uoms}
                  writeError={write.error}
                  isSaving={write.isSaving}
                  canCancel={hasDecisionInput(form)}
                  onChange={(next) => {
                    /* 고친 칸의 서버 오류만 지운다 — 남은 칸의 오류까지 지우면 못 본 채 다시 보낸다. */
                    if (next.dispositionTypeCode !== form.dispositionTypeCode)
                      write.clearFieldError('dispositionTypeCode');
                    if (next.reason !== form.reason) write.clearFieldError('reason');
                    if (next.sortLotIds !== form.sortLotIds) write.clearFieldError('lotIds');
                    if (next.goodQty !== form.goodQty) write.clearFieldError('goodQty');
                    if (next.defectQty !== form.defectQty) write.clearFieldError('defectQty');
                    setForm(next);
                  }}
                  onSave={save}
                  onCancel={() => {
                    setForm(EMPTY_DECISION_FORM);
                    setShowErrors(false);
                    /* 지운 값에 대한 서버 판정을 남기지 않는다 — 빈 칸에 붙은 오류는 풀 길이 없다. */
                    write.reset();
                  }}
                  onReload={checkOutcome}
                />
                {result !== null && result.nonconformanceId === selectedId && (
                  <DecisionResultCard
                    result={result.result}
                    onOpenNonconformance={(id) =>
                      setSearchParams((current) => withSelectedNonconformance(current, id))
                    }
                  />
                )}
              </div>
            </>
          )}
          {/* 처분 이력 · 특채 요청 이력 — 탭 둘(사용자 지시 · #223). 특채 승인은 W-03-09 의 결재가 한다. */}
          {selectedId !== null && detail.data !== undefined && (
            /* 판정 이력 · 특채 — 테두리 상자 안의 탭(검사 조회·판정 상세 탭 상자와 같은 모양 · 사용자 지시 · #223). */
            <Tabs
              className="disposition-side-tabs"
              size="md"
              aria-label={t.panes.decisions}
              value={sideTab}
              onChange={(next) => setSideTab(next as 'decisions' | 'concessions')}
              items={[
                {
                  value: 'decisions',
                  label:
                    `${t.panes.decisions} ${decisions.isPending ? '' : t.decisions.count(decisionRows.length)}`.trim(),
                  content: (
                    <DecisionHistory
                      rows={decisionRows}
                      uoms={uoms}
                      isLoading={decisions.isPending}
                      isError={decisions.isError}
                    />
                  ),
                },
                {
                  value: 'concessions',
                  label:
                    `${t.concession.foldTitle} ${concessions.data === undefined ? '' : t.concession.count(concessions.data.length)}`.trim(),
                  content: (
                    <ConcessionHistory nonconformanceId={selectedId} readOnly={tab === 'history'} />
                  ),
                },
              ]}
            />
          )}
        </section>
      </div>
      {isConcessionOpen &&
        tab === 'pending' &&
        selectedId !== null &&
        detail.data !== undefined && (
          <ConcessionRequestDialog
            nonconformanceId={selectedId}
            lots={lotRows}
            remainingQty={remaining.value}
            inboundLotNo={detailView?.inboundLotNo ?? null}
            uoms={uoms}
            today={today}
            onClose={(requested, lotCount) => {
              setIsConcessionOpen(false);
              if (requested) {
                /* 다LOT 전량 특채는 서버가 자재 관리 LOT 마다 특채 행을 만든 수를 알린다(D-14). */
                toast.show({
                  variant: 'success',
                  description:
                    lotCount === undefined
                      ? t.concession.requested
                      : t.concession.requestedLots(lotCount),
                });
                setSideTab('concessions');
              }
            }}
          />
        )}
    </>
  );
};

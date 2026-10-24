import type { ApiClient } from '@omf-mes/api-client';
import { useQueries, useQuery, type QueryClient, type UseQueryResult } from '@tanstack/react-query';

import { useApiClient } from '../../patterns/api-context';
import { fetchAllPages, type PageMeta } from '../../patterns/fetch-all-pages';
import { plantToday } from '../../patterns/plant-time';
import { shellSelectsPrinter, terminalPrinters } from '../../patterns/pop-terminal-printers';
import { ApiRequestError, runRequest, type ApiCallResult } from '../../patterns/request';
import { REISSUE_REASON_CODE_GROUP } from './codes';
import {
  toLineView,
  toPrinterView,
  toReceiptView,
  toTargetRow,
  toTargetRows,
  type LabelLineResponse,
  type LineView,
  type PrinterView,
  type ReceiptView,
  type TargetRow,
} from './types';

/**
 * 이 화면의 읽기.
 *
 * | 언제 | 무엇 |
 * | --- | --- |
 * | 발행 대기 | 라벨 미부착·미발행 입하 줄 전부 — 공급사로 묶는다(`pending`) |
 * | 다시 인쇄 | 최근 2주 안에 발행한 입하 줄 |
 *
 * ⭐ **줄 목록 경로를 먼저 부른다**(`GET /logistics/inbound-receipt-lines` · 장부 P-118 · omf-mes-server#826,
 *    omf-all-around#184 에서 요청). 입하 건을 가로질러 줄을 주고 LOT 번호·상태·마지막 발행을 함께 싣는다.
 * ⚠ **계약 대기다.** 서버가 그 경로를 모르면(404)·권한이 없으면(403) 예전 길 — 입하 «건» 목록을 끝까지
 *   받고 건마다 줄을 불러 화면이 모은다 — 로 돌아간다(`useLabelRows`). 계약에 실리면 이 되돌이를 걷는다.
 *
 * 경로 리터럴은 이 파일에만 둔다 — `openapi-fetch`가 경로를 리터럴 타입으로 요구해
 * 문자열 변수로 넘기면 타입 검사가 풀린다.
 */

type Client = ApiClient['client'];

/**
 * 목록이 무엇을 담는가 — 미발행(발행 대기) / 발행한 줄(다시 인쇄).
 *
 * ⛔ **「전체」를 두지 않는다.** 라인 응답에 발행 여부 칸이 없어 한 목록에 섞으면 줄마다
 *    무엇인지 말할 수 없다 — 질의 조건으로만 갈린다.
 */
export type IssuedView = 'unissued' | 'issued';

/**
 * 입하 건 목록 주기 갱신 간격.
 *
 * ⭐ **이 목록의 자료를 만드는 것은 이 화면이 아니다.** 작업자는 PDA 로 입하를 등록하고 POP 앞으로
 *    걸어와 라벨을 찍는다 — 화면이 스스로 다시 받지 않으면 앱을 껐다 켜야 보였다(omf-all-around#29).
 *
 * ⛔ **조회 화면에 자동 갱신을 두지 않는다는 관례의 예외다**(공유계약 L-6). 그 관례의 근거는 「사용자
 *    수만큼 부하가 곱해진다」인데, POP 단말은 **공장당 몇 대뿐**이다.
 */
export const LIST_REFRESH_MS = 20_000;

/**
 * 건마다의 줄 갱신 간격 — 건 목록보다 느리다.
 *
 * ⭐ 새 입하는 건 목록이 20초마다 데려오고, 새 건의 줄은 처음 보일 때 한 번 받는다. 이미 받은 줄이
 *    바뀌는 것은 이 단말이 찍었을 때(끝나면 그 건만 다시 받는다)나 다른 단말이 찍었을 때뿐이라 자주
 *    물을 까닭이 없다 — 대기 건이 백 건이면 20초마다 백 번 묻게 된다. 다른 단말이 먼저 찍은 줄은
 *    발행 직전에 다시 확인한다(`fetchFreshLines`).
 */
export const LINES_REFRESH_MS = 60_000;

/**
 * 발행 대기에 함께 받을 최근 입하 일수.
 *
 * ⚠ 건 목록의 `labelIssued=false` 는 「발행된 줄이 **하나도 없는** 건」이라, 줄 여럿 중 일부만 찍은
 *   건은 남은 줄까지 빠진다(#1241). 그런 건은 2026-10-24 전에 만든 다중 줄 입하뿐이라(장부 P-117 뒤로는
 *   건 하나에 줄 하나), 최근 며칠은 발행 조건 없이 받아 그 줄을 놓치지 않는다. 서버가 줄 목록을 열면 걷는다.
 */
export const PENDING_RECENT_DAYS = 3;

/** 다시 인쇄에서 보이는 기간(입하일 기준). 그보다 오래된 라벨은 스캔해도 찾지 못한다고 말한다. */
export const REPRINT_DAYS = 14;

/** 주기 갱신을 걸 것인가 — **발행 중에는 걸지 않는다**(도는 사이 목록이 바뀌면 결과가 줄을 잃는다). */
export const listRefetchInterval = (
  isIssuing: boolean,
  interval = LIST_REFRESH_MS,
): number | false => (isIssuing ? false : interval);

const RECEIPT_LIST_KEY = ['pop-material-lot-label', 'receipts'] as const;

/** 줄 목록 경로(P-118)의 캐시 — 보기마다 하나. */
export const rowKeys = {
  all: ['pop-material-lot-label', 'rows'] as const,
  view: (view: IssuedView) => ['pop-material-lot-label', 'rows', view] as const,
};

export const receiptKeys = {
  lists: RECEIPT_LIST_KEY,
  pending: [...RECEIPT_LIST_KEY, 'pending'] as const,
  issued: [...RECEIPT_LIST_KEY, 'issued'] as const,
  /** 모든 건·모든 보기의 줄 캐시. */
  allLines: ['pop-material-lot-label', 'receipt-lines'] as const,
  /** 보기를 빼고 부르면 그 건의 두 보기를 함께 가리킨다 — 발행 뒤 무효화가 그렇게 쓴다. */
  lines: (inboundReceiptId: number, view?: IssuedView) =>
    view === undefined
      ? (['pop-material-lot-label', 'receipt-lines', inboundReceiptId] as const)
      : (['pop-material-lot-label', 'receipt-lines', inboundReceiptId, view] as const),
};

/** `YYYY-MM-DD` 에서 날수를 더하고 뺀다(공장 달력의 날짜 문자열 그대로). */
export const shiftDate = (date: string, days: number): string => {
  const at = new Date(`${date}T00:00:00Z`);

  at.setUTCDate(at.getUTCDate() + days);

  return at.toISOString().slice(0, 10);
};

const fetchAllReceipts = async (
  client: Client,
  query: {
    labelIssued?: boolean;
    receiptDateFrom?: string;
  },
): Promise<ReceiptView[]> => {
  const all = await fetchAllPages((page, size) =>
    runRequest(() =>
      client.GET('/logistics/inbound-receipts', {
        /* 실물 라벨이 미부착인 건만 받는다(사전부착은 PDA 가 처리한다 · 스펙 §3-6). */
        params: { query: { ...query, supplierLotLabelAttached: false, page, size } },
      }),
    ),
  );

  return all.items.map(toReceiptView);
};

/** 같은 건이 두 목록에 함께 오면 하나로 — 먼저 온 쪽을 남긴다. */
const uniqueReceipts = (lists: readonly ReceiptView[][]): ReceiptView[] => {
  const byId = new Map<number, ReceiptView>();

  for (const receipt of lists.flat()) {
    if (!byId.has(receipt.inboundReceiptId)) byId.set(receipt.inboundReceiptId, receipt);
  }

  return [...byId.values()];
};

/** 취소된 입하 — 라벨을 낼 까닭이 없다. */
const CANCELLED_RECEIPT = 'CANCELLED';

/**
 * 발행 대기 입하 건 — 발행된 줄이 없는 건 전부 + 최근 며칠의 건(`PENDING_RECENT_DAYS` 머리말).
 */
export const usePendingReceipts = (
  enabled: boolean,
  isIssuing: boolean,
): UseQueryResult<ReceiptView[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: receiptKeys.pending,
    enabled,
    queryFn: async () => {
      const [untouched, recent] = await Promise.all([
        fetchAllReceipts(client, { labelIssued: false }),
        fetchAllReceipts(client, {
          receiptDateFrom: shiftDate(plantToday(), -PENDING_RECENT_DAYS),
        }),
      ]);

      return uniqueReceipts([untouched, recent]).filter(
        (receipt) => receipt.statusCode !== CANCELLED_RECEIPT,
      );
    },
    /* PDA 가 만든 입하가 스스로 떠야 한다 — 까닭은 `LIST_REFRESH_MS` 머리말에 있다. */
    refetchInterval: enabled ? listRefetchInterval(isIssuing) : false,
  });
};

/** 다시 인쇄 — 최근 2주 안에 입하돼 라벨을 낸 줄이 하나라도 있는 건. */
export const useIssuedReceipts = (
  enabled: boolean,
  isIssuing: boolean,
): UseQueryResult<ReceiptView[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: receiptKeys.issued,
    enabled,
    queryFn: () =>
      fetchAllReceipts(client, {
        labelIssued: true,
        receiptDateFrom: shiftDate(plantToday(), -REPRINT_DAYS),
      }),
    refetchInterval: enabled ? listRefetchInterval(isIssuing) : false,
  });
};

/*
 * 줄도 미부착·발행 두 조건으로 서버가 거른다 — 발번 단위가 「건」이 아니라 「줄」이다(스펙 §3-6).
 */
const fetchReceiptLines = async (
  client: Client,
  inboundReceiptId: number,
  view: IssuedView,
): Promise<LineView[]> => {
  const data = await runRequest(() =>
    client.GET('/logistics/inbound-receipts/{inboundReceiptId}/lines', {
      params: {
        path: { inboundReceiptId },
        query: { supplierLotLabelAttached: false, labelIssued: view === 'issued' },
      },
    }),
  );

  return data.items.map(toLineView);
};

export interface TargetRowsResult {
  rows: TargetRow[];
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * 건마다 줄을 받아 한 목록으로 편다.
 *
 * ⚠ **요청이 건 수만큼이다.** 줄 갱신을 건 목록보다 느리게 두어 감당한다(`LINES_REFRESH_MS`).
 */
export const useLineRows = (
  receipts: readonly ReceiptView[],
  view: IssuedView,
  isIssuing: boolean,
): TargetRowsResult => {
  const { client } = useApiClient();

  const results = useQueries({
    queries: receipts.map((receipt) => ({
      queryKey: receiptKeys.lines(receipt.inboundReceiptId, view),
      queryFn: () => fetchReceiptLines(client, receipt.inboundReceiptId, view),
      staleTime: LINES_REFRESH_MS,
      refetchInterval: listRefetchInterval(isIssuing, LINES_REFRESH_MS),
    })),
  });

  return {
    rows: results.flatMap((result, index) => {
      const receipt = receipts[index];

      return receipt === undefined || result.data === undefined
        ? []
        : toTargetRows(receipt, result.data);
    }),
    isPending: results.some((result) => result.isPending),
    // 한 건이라도 실패하면 목록이 불완전하다 — 일부만 보이는 것을 「전부」로 내지 않는다.
    isError: results.some((result) => result.isError),
    refetch: () => {
      for (const result of results) void result.refetch();
    },
  };
};

/**
 * 줄 목록 경로만 받는 모양으로 클라이언트를 좁혀 본다 — 생성 타입에 아직 없다(입고 관리
 * `progress-queries` 와 같은 길). 실행은 같은 클라이언트가 한다. 계약에 실리면 이 좁힘을 지운다.
 */
interface LabelLinesClient {
  GET(
    path: '/logistics/inbound-receipt-lines',
    init: {
      params: {
        query: {
          labelIssued: boolean;
          supplierLotLabelAttached: boolean;
          receiptDateFrom?: string;
          page: number;
          size: number;
        };
      };
    },
  ): Promise<ApiCallResult<{ items: LabelLineResponse[]; page: PageMeta }>>;
}

/** 서버가 줄 목록 경로를 모르거나(404) 권한이 없다(403) — 예전 길로 돌아갈 신호다. 다른 실패는 실패다. */
export const isLineListUnavailable = (error: unknown): boolean =>
  error instanceof ApiRequestError && (error.httpStatus === 404 || error.httpStatus === 403);

const fetchLabelLines = async (client: Client, view: IssuedView): Promise<TargetRow[]> => {
  const linesClient = client as unknown as LabelLinesClient;
  const all = await fetchAllPages((page, size) =>
    runRequest(() =>
      linesClient.GET('/logistics/inbound-receipt-lines', {
        params: {
          query: {
            labelIssued: view === 'issued',
            supplierLotLabelAttached: false,
            /* 다시 인쇄는 최근 2주만 — 발행한 줄은 끝없이 쌓인다(`REPRINT_DAYS`). */
            ...(view === 'issued'
              ? { receiptDateFrom: shiftDate(plantToday(), -REPRINT_DAYS) }
              : {}),
            page,
            size,
          },
        },
      }),
    ),
  );

  return all.items.map(toTargetRow);
};

export interface LabelRowsResult extends TargetRowsResult {
  /** 줄 목록 경로가 없어 입하 건 → 줄 모으기로 받았는가. 그때 줄에 LOT 번호·상태·마지막 발행이 없다. */
  isFallback: boolean;
}

/**
 * 한 보기의 줄 전부 — 줄 목록 경로(P-118)를 먼저 부르고, 없으면 예전 길로 모은다.
 *
 * ⚠ 404·403 이 한 번 오면 그 경로는 다시 묻지 않는다(`retry: false` · 주기 갱신도 멈춤) — 앞선 서버에서
 *   20초마다 없는 경로를 부르지 않는다. 서버를 올리면 화면을 다시 열 때 새 경로로 돌아온다.
 */
export const useLabelRows = (
  view: IssuedView,
  enabled: boolean,
  isIssuing: boolean,
): LabelRowsResult => {
  const { client } = useApiClient();

  const direct = useQuery({
    queryKey: rowKeys.view(view),
    enabled,
    retry: false,
    queryFn: () => fetchLabelLines(client, view),
    refetchInterval: (query) =>
      !enabled || isLineListUnavailable(query.state.error) ? false : listRefetchInterval(isIssuing),
  });
  const isFallback = enabled && direct.isError && isLineListUnavailable(direct.error);

  const pendingReceipts = usePendingReceipts(isFallback && view === 'unissued', isIssuing);
  const issuedReceipts = useIssuedReceipts(isFallback && view === 'issued', isIssuing);
  const receiptQuery = view === 'unissued' ? pendingReceipts : issuedReceipts;
  const gathered = useLineRows(isFallback ? (receiptQuery.data ?? []) : [], view, isIssuing);

  if (!isFallback) {
    return {
      rows: direct.data ?? [],
      isPending: enabled && direct.isPending,
      isError: direct.isError,
      refetch: () => {
        void direct.refetch();
      },
      isFallback: false,
    };
  }

  return {
    rows: gathered.rows,
    isPending: receiptQuery.isPending || gathered.isPending,
    isError: receiptQuery.isError || gathered.isError,
    refetch: () => {
      void receiptQuery.refetch();
      gathered.refetch();
    },
    isFallback: true,
  };
};

/**
 * 발행 직전에 고른 줄의 건을 **지금** 다시 받는다.
 *
 * ⛔ 줄은 1분마다만 다시 받으므로, 그 사이 다른 단말이 먼저 찍었을 수 있다. 낡은 `lotId` 로 등록을
 *    부르면 같은 자재에 LOT 이 하나 더 생길 수 있어, 보내기 전에 서버가 아는 지금 모양으로 맞춘다.
 */
export const fetchFreshLines = async (
  queryClient: QueryClient,
  client: Client,
  receiptIds: readonly number[],
  view: IssuedView,
): Promise<Map<number, LineView>> => {
  const lists = await Promise.all(
    [...new Set(receiptIds)].map((receiptId) =>
      queryClient.fetchQuery({
        queryKey: receiptKeys.lines(receiptId, view),
        queryFn: () => fetchReceiptLines(client, receiptId, view),
        staleTime: 0,
      }),
    ),
  );

  return new Map(lists.flat().map((line) => [line.inboundReceiptLineId, line]));
};

/**
 * 스캔한 LOT 번호로 LOT 을 찾는다 — **정확 일치**(`lotNo`). 부분 검색(`q`)은 여러 건이 와서 한 장을
 * 집지 못한다(계약 명시). 없으면 `null`.
 */
export const findLotByNo = async (
  client: Client,
  lotNo: string,
): Promise<{ lotId: number } | null> => {
  const data = await runRequest(() =>
    client.GET('/trace/lots', { params: { query: { lotNo, size: 1 } } }),
  );
  const lot = data.items[0];

  return lot === undefined ? null : { lotId: lot.lotId };
};

/**
 * 이 단말이 쓸 수 있는 프린터와 그 상태.
 *
 * ⛔ **`documentTypeCode`로 거르지 않는다.** 문서 유형 값 목록이 아직 확정되지 않아(착수 이슈
 * 미결 1) 화면이 값을 넣으면 서버가 모르는 코드로 걸러 **목록이 통째로 비어 올 수 있다.**
 * 거르지 않으면 최악이 「쓸 수 없는 프린터도 함께 보인다」이고, 거르면 최악이 「쓸 수 있는
 * 프린터가 없다고 보인다」다 — 뒤쪽이 더 나쁘다.
 *
 * ⚠ **비어 올 수 있다.** 서버가 무엇을 보고 목록을 만드는지가 미결이다(착수 이슈 6항).
 * 빈 목록은 정상 응답이므로 오류로 다루지 않고 빈 상태로 그린다.
 */
export const usePrinters = (): UseQueryResult<PrinterView[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['pop-material-lot-label', 'printers'],
    queryFn: async () => {
      /*
       * ⭐ **셸이 답할 수 있으면 단말에 실제로 붙은 프린터를 먼저 쓴다**(사용자 지시
       *    2026-09-08 · `patterns/pop-terminal-printers`). 브라우저에서는 통로가 없어
       *    `null` 이 오고, 그때는 아래 서버 목록을 그대로 쓴다.
       */
      const local = await terminalPrinters();

      if (local !== null) return local.map(toPrinterView);

      const data = await runRequest(() => client.GET('/app/printers', {}));

      return data.items.map(toPrinterView);
    },
  });
};

/** 셸이 고른 프린터로 보낼 수 있는가 — 모르면 `false`(화면은 고르는 칸을 막는다). */
export const useShellSelectsPrinter = (): UseQueryResult<boolean> =>
  useQuery({
    queryKey: ['pop-material-lot-label', 'printer-selectable'],
    queryFn: shellSelectsPrinter,
  });

/** 이미 등록된 라인의 LOT — 번호와 품질 상태(라벨을 낼 수 있는 상태인지 단추가 본다). */
export interface RegisteredLot {
  lotNo: string;
  statusCode: string;
}

/**
 * 다시 인쇄 표에 선 줄의 **LOT 번호와 상태.**
 *
 * 줄 응답은 `lotId` 만 싣는다. 번호는 라벨에 찍힌 것과 눈으로 대조하는 값이고, 상태는 라벨을 낼 수
 * 있는지(불량·폐기는 못 낸다)와 IQC 라벨을 함께 찍을지를 가른다. **보이는 줄의 것만** 묻는다.
 */
export const useLotDetails = (
  lotIds: readonly number[],
): ReadonlyMap<number, UseQueryResult<RegisteredLot>> => {
  const { client } = useApiClient();
  const uniqueIds = [...new Set(lotIds)];

  const results = useQueries({
    queries: uniqueIds.map((lotId) => ({
      queryKey: ['pop-material-lot-label', 'lot', lotId],
      queryFn: async (): Promise<RegisteredLot> => {
        const data = await runRequest(() =>
          client.GET('/trace/lots/{lotId}', { params: { path: { lotId } } }),
        );

        return { lotNo: data.lot.lotNo, statusCode: data.lot.statusCode };
      },
    })),
  });

  return new Map(
    uniqueIds.flatMap((lotId, index) => {
      const result = results[index];

      return result === undefined ? [] : [[lotId, result] as const];
    }),
  );
};

/** 재발행 사유 한 가지. 표시 문구는 **서버가 준 이름을 그대로** 쓴다. */
export interface ReissueReasonOption {
  code: string;
  name: string;
}

/**
 * 재발행 사유 선택지.
 *
 * ⛔ **화면이 값을 지어내지 않는다.** 값 목록은 서버가 코드 그룹으로 내려 준다(계약 명시).
 * ⛔ **채번 식별자(`codeGroupId`)를 하드코딩하지 않는다** — 환경마다 다르다.
 *
 * ⚠ **비어 올 수 있다.** 값 목록이 아직 확정되지 않은 코드 그룹이라(`omf-mes#145`) 운영
 * 데이터가 비어 있을 수 있고, 그때는 재인쇄를 열지 않고 사유를 보인다 — 사유 없이 보내면 422 다.
 */
export const useReissueReasons = (enabled: boolean): UseQueryResult<ReissueReasonOption[]> => {
  const { client } = useApiClient();

  return useQuery({
    queryKey: ['pop-material-lot-label', 'reissue-reasons'],
    enabled,
    queryFn: async () => {
      const data = await runRequest(() =>
        client.GET('/mdm/code-values', {
          params: { query: { codeGroupCode: REISSUE_REASON_CODE_GROUP } },
        }),
      );

      return data.items.map((item) => ({ code: item.code, name: item.codeName }));
    },
  });
};

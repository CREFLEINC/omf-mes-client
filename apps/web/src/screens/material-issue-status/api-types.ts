import type { components, paths } from '@omf-mes/api-client';

/**
 * W-02-11 이 쓰는 계약 타입(생성 타입, 서버 main 7cf18d3e 전달본)과 화면용 모양.
 *
 * 생성 타입은 003 의 표시 칸(`displayStatus` · `versionNo` · 이름 칸 · 부족 합)을 선택으로 둔다 — 서버 스키마의
 * `required` 에 없어서다. 서버는 목록 · 상세 · PUT · cancel 응답에 늘 싣는다(계약 §1 「화면 이름 칸」). 화면은
 * 받는 자리에서 한 번 채워(`toRequestView`) 쓴다 — 쓰는 곳마다 빈 값을 다시 판정하지 않게.
 */
type MaterialIssueRequest = components['schemas']['MaterialIssueRequest'];
type MaterialIssueRequestLine = components['schemas']['MaterialIssueRequestLine'];
type MaterialIssueRequestDetailResponse =
  components['schemas']['MaterialIssueRequestDetailResponse'];

export type MaterialIssueDisplayStatus = NonNullable<MaterialIssueRequest['displayStatus']>;

export type MaterialIssueRequestView = MaterialIssueRequest &
  Required<
    Pick<
      MaterialIssueRequest,
      | 'displayStatus'
      | 'versionNo'
      | 'workOrderNo'
      | 'destinationLocationName'
      | 'lineCount'
      | 'shortageQtyTotal'
      | 'dynamicShortageQtyTotal'
    >
  > & { productionPlanNo: string | null };

export type MaterialIssueRequestLineView = MaterialIssueRequestLine &
  Required<Pick<MaterialIssueRequestLine, 'itemCode' | 'itemName' | 'uomCode'>>;

export interface MaterialIssueRequestDetailView {
  materialIssueRequest: MaterialIssueRequestView;
  lines: MaterialIssueRequestLineView[];
}

export const toRequestView = (raw: MaterialIssueRequest): MaterialIssueRequestView => ({
  ...raw,
  displayStatus: raw.displayStatus ?? 'WAITING',
  versionNo: raw.versionNo ?? 0,
  workOrderNo: raw.workOrderNo ?? String(raw.workOrderId),
  destinationLocationName: raw.destinationLocationName ?? String(raw.destinationLocationId),
  lineCount: raw.lineCount ?? 0,
  shortageQtyTotal: raw.shortageQtyTotal ?? 0,
  dynamicShortageQtyTotal: raw.dynamicShortageQtyTotal ?? 0,
  productionPlanNo: raw.productionPlanNo ?? null,
});

export const toLineView = (raw: MaterialIssueRequestLine): MaterialIssueRequestLineView => ({
  ...raw,
  itemCode: raw.itemCode ?? String(raw.itemId),
  itemName: raw.itemName ?? '',
  uomCode: raw.uomCode ?? '',
});

export const toDetailView = (
  raw: MaterialIssueRequestDetailResponse,
): MaterialIssueRequestDetailView => ({
  materialIssueRequest: toRequestView(raw.materialIssueRequest),
  lines: raw.lines.map(toLineView),
});

export type MaterialIssueRequestListQuery = NonNullable<
  paths['/logistics/material-issue-requests']['get']['parameters']['query']
>;
export type MaterialIssueRequestUpdate = components['schemas']['MaterialIssueRequestUpdate'];
export type MaterialIssueRequestCancel = components['schemas']['MaterialIssueRequestCancel'];
export type MaterialIssueRequestHistoryItem =
  components['schemas']['MaterialIssueRequestHistoryItem'];
type PlannedStockRaw = components['schemas']['PlannedStockResponse'];
type PlannedStockRow = components['schemas']['PlannedStockRow'];
type PlannedStockRequestRaw = PlannedStockRow['requests'][number];

/**
 * 부족 보기의 배분 줄 — W-02-11 은 W/O 요청만 묻는다(`requestTypeCode=WORK_ORDER`). 생성 타입은 004 창고 보충 요청
 * 때문에 W/O 칸을 nullable 로 두지만, 이 화면이 받는 줄은 늘 W/O 가 있다. 받는 자리에서 한 번 좁힌다.
 */
export type PlannedShortageRequest = Omit<
  PlannedStockRequestRaw,
  'requestTypeCode' | 'workOrderId' | 'workOrderNo'
> & {
  requestTypeCode?: PlannedStockRequestRaw['requestTypeCode'];
  workOrderId: number;
  workOrderNo: string;
};

export type PlannedStockResponse = Omit<PlannedStockRaw, 'items'> & {
  items: (Omit<PlannedStockRow, 'requests'> & { requests: PlannedShortageRequest[] })[];
};

export const toPlannedShortageView = (raw: PlannedStockRaw): PlannedStockResponse => ({
  ...raw,
  items: raw.items.map((row) => ({
    ...row,
    requests: row.requests.flatMap((request) =>
      request.workOrderId === null || request.workOrderNo === null
        ? []
        : [{ ...request, workOrderId: request.workOrderId, workOrderNo: request.workOrderNo }],
    ),
  })),
});

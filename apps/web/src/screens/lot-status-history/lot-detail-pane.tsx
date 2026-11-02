import { AlertBanner, Button, Chip, Dialog, SkeletonText, Tabs } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { lookupDisplayLabelWithInactive, type LookupSource } from '../../patterns/lookup-display';
import type { FilterOption } from './lot-filter-bar';
import { LotHoldDocuments } from './lot-hold-documents';
import { LotTimeline } from './lot-timeline';
import { useFourMChangeTypeLabel } from '../four-m-inputs/panel';
import { MaterialLotUsage, ProductionLotInputs } from './lot-genealogy';
import { lotStatusTone } from './options';
import { useLotDetail } from './queries';
import { useItemNameSources } from './reference-options';
import { useUomCodeOf, withUom } from './uoms';
import { formatPlantDateTime } from '../../patterns/plant-time';
import { useSession } from '../../patterns/session';
import { toWebAccess } from '../../patterns/web-access';
import { LOT_TRACE_PATH, lotTraceHref } from '../lot-trace/trace-filters';

const t = messages.lotStatusHistory;
/** W/O 진행현황 조회(W-02-08) — 주소의 `q`·`workOrderId` 로 그 W/O 를 고른 채 연다. */
const WORK_ORDER_PROGRESS_PATH = '/production/work-order-progress';
const genealogyText = messages.lotGenealogy;
type HistoryTab = 'usage' | 'timeline' | 'holds';
const EMPTY = '—';

const formatDateTime = (value: string | null): string => {
  if (value === null) return EMPTY;
  return formatPlantDateTime(value) ?? value;
};

const labelOf = (options: readonly FilterOption[], value: string): string =>
  options.find((option) => option.value === value)?.label ?? t.values.unlisted(value);

interface LotDetailPaneProps {
  lotId: number;
  lotTypeOptions: readonly FilterOption[];
  statusOptions: readonly FilterOption[];
  /**
   * 투입 이력에서 연 생산 LOT 상세 팝업 안 — 제목은 팝업이 달고, 그 안에서 또 팝업을 열지 않는다
   * (사용자 2026-11-02). [생산 이력 조회]는 그대로 둔다.
   */
  inDialog?: boolean;
  /** 팝업으로 연 생산 LOT 의 작업지시 — [작업지시 이력 조회]가 그 W/O 진행현황을 연다(사용자 2026-11-02). */
  workOrder?: { workOrderId: number; workOrderNo: string };
}

/**
 * LOT 상세 — 목록 옆(상하 배치면 아래) 칸에 선다(검사 조회·판정과 같은 짜임 · 사용자 2026-10-30).
 * 종전에는 창(Dialog)으로 떴다. 목록에서 다른 LOT 을 고르면 이 칸이 그 LOT 으로 바뀐다.
 */
export const LotDetailPane = ({
  lotId,
  lotTypeOptions,
  statusOptions,
  inDialog = false,
  workOrder,
}: LotDetailPaneProps) => {
  const detail = useLotDetail(lotId);
  const navigate = useNavigate();
  const { session } = useSession();
  const traceHref =
    detail.data !== undefined && toWebAccess(session?.permissions).allows(LOT_TRACE_PATH)
      ? lotTraceHref({
          lotId,
          lotNo: detail.data.lotNo,
          lotTypeCode: detail.data.lotTypeCode,
        })
      : null;
  const fourMTypeLabel = useFourMChangeTypeLabel();
  const uomCodeOf = useUomCodeOf();
  const [historyTab, setHistoryTab] = useState<HistoryTab>('usage');
  /* 투입 이력에서 고른 생산 LOT — 그 LOT 의 상세 이력을 팝업으로 연다(사용자 2026-11-02). */
  const [openedLot, setOpenedLot] = useState<{
    lotId: number;
    lotNo: string;
    workOrderId: number;
    workOrderNo: string;
  } | null>(null);
  const workOrderHref =
    workOrder !== undefined && toWebAccess(session?.permissions).allows(WORK_ORDER_PROGRESS_PATH)
      ? `${WORK_ORDER_PROGRESS_PATH}?${new URLSearchParams({
          q: workOrder.workOrderNo,
          workOrderId: String(workOrder.workOrderId),
        }).toString()}`
      : null;
  const itemId = detail.data?.itemId;
  const itemNames = useItemNameSources(itemId === undefined ? [] : [itemId]);
  const itemSource: LookupSource = (itemId === undefined ? undefined : itemNames.get(itemId)) ?? {
    entries: [],
    isError: false,
    isLoading: true,
  };
  const retry = (
    <Button
      variant="outlined"
      size="sm"
      aria-label={t.detail.retryLabel(t.detail.title)}
      onClick={() => void detail.refetch()}
    >
      {t.detail.retry}
    </Button>
  );

  return (
    <>
      <div className="lot-status-pane-head lot-status-detail-head">
        {!inDialog && (
          <h2 className="pane-title" id="lot-status-detail-title">
            {t.detail.title}
          </h2>
        )}
        {/* LOT 생산 이력 조회로 간다(제목 줄 오른쪽 끝). 자재 LOT은 자재 LOT 탭, 생산 LOT은 제품 LOT 탭에서 연다. */}
        {traceHref !== null && (
          <Button variant="outlined" size="md" onClick={() => void navigate(traceHref)}>
            {t.detail.trace}
          </Button>
        )}
        {workOrderHref !== null && (
          <Button variant="outlined" size="md" onClick={() => void navigate(workOrderHref)}>
            {genealogyText.usage.workOrderHistory}
          </Button>
        )}
      </div>
      {detail.isPending && (
        <div role="status" aria-label={t.detail.loading}>
          <SkeletonText lines={3} />
        </div>
      )}
      {detail.isError && (
        <AlertBanner
          className="lot-detail-failure-banner"
          variant="error"
          title={t.detail.failed}
          action={retry}
        />
      )}
      {/*
       * 기본 정보 — 긴 값(LOT 번호·품목)은 첫 줄에 넓게, 짧은 값은 둘째 줄에 좁게 둔다
       * (사용자 지시 2026-09-19). 칸 배치는 app.css .lot-detail-fields.
       */}
      {detail.data !== undefined && (
        <dl className="lot-detail-fields" aria-label={t.detail.attributes}>
          {(
            [
              /* LOT 유형은 번호 왼쪽 라벨로 보인다 — 목록의 LOT 번호 칸과 같게(사용자 2026-10-30). */
              [
                'wide',
                t.detail.fields.lotNo,
                <span className="lot-no-with-type">
                  <Chip variant="status" status="info" size="sm">
                    {labelOf(lotTypeOptions, detail.data.lotTypeCode)}
                  </Chip>
                  {detail.data.lotNo}
                </span>,
              ],
              [
                'wide',
                t.detail.fields.item,
                lookupDisplayLabelWithInactive(itemSource, detail.data.itemId),
              ],
              [
                'short',
                t.detail.fields.status,
                <Chip variant="status" status={lotStatusTone(detail.data.statusCode)} size="sm">
                  {labelOf(statusOptions, detail.data.statusCode)}
                </Chip>,
              ],
              [
                'short',
                t.detail.fields.initialQty,
                withUom(String(detail.data.initialQty), uomCodeOf(detail.data.uomId)),
              ],
              ['short', t.detail.fields.expiryDate, detail.data.expiryDate ?? EMPTY],
              ['short', t.detail.fields.manufacturedAt, formatDateTime(detail.data.manufacturedAt)],
              /* IQC 에서 적은 4M 변경품 — 변경품일 때만 줄을 둔다(omf-all-around#63). */
              ...(detail.data.fourMChange === null
                ? []
                : ([
                    [
                      'wide',
                      t.detail.fields.fourMChange,
                      <>
                        <Chip variant="status" status="warning" size="sm">
                          {t.detail.fields.fourMChange}
                        </Chip>{' '}
                        {[
                          fourMTypeLabel(detail.data.fourMChange.changeTypeCode ?? ''),
                          detail.data.fourMChange.remarks,
                        ]
                          .filter((part) => part !== undefined && part !== '')
                          .join(' · ')}
                      </>,
                    ],
                  ] as const)),
            ] as const
          ).map(([size, label, value]) => (
            <div className="lot-detail-field" data-size={size} key={label}>
              <dt className="field-label">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {/* 투입 자재 계보(omf-all-around#166) — 생산 LOT 은 들어간 자재, 모든 LOT 은 그 LOT 이 들어간 제품. */}
      {detail.data?.sourceTypeCode === 'WORK_ORDER' && <ProductionLotInputs lotId={lotId} />}
      {/* 투입 이력 · LOT 변경 이력 · 보류 이력은 탭으로 묶는다(사용자 2026-10-30). */}
      {/* LOT 상세를 못 받아도 이력 탭은 선다 — 각 탭이 따로 부르고 따로 실패한다. */}
      <Tabs
        aria-label={t.detail.historyTabs}
        value={historyTab}
        onChange={(value) => setHistoryTab(value as HistoryTab)}
        items={[
          {
            value: 'usage',
            label: genealogyText.usage.heading,
            content:
              historyTab === 'usage' ? (
                <MaterialLotUsage
                  lotId={lotId}
                  {...(inDialog ? {} : { onOpenLot: setOpenedLot })}
                />
              ) : null,
          },
          {
            value: 'timeline',
            label: t.timeline.pane,
            content:
              historyTab === 'timeline' ? (
                <LotTimeline lotId={lotId} statusOptions={statusOptions} embedded />
              ) : null,
          },
          {
            value: 'holds',
            label: t.holdDocuments.pane,
            content: historyTab === 'holds' ? <LotHoldDocuments key={lotId} lotId={lotId} /> : null,
          },
        ]}
      />
      {openedLot !== null && (
        <Dialog
          open
          size="lg"
          title={genealogyText.usage.dialogTitle(openedLot.lotNo)}
          onClose={() => setOpenedLot(null)}
        >
          <div className="lot-status-detail-dialog lot-usage-detail-dialog">
            <LotDetailPane
              lotId={openedLot.lotId}
              lotTypeOptions={lotTypeOptions}
              statusOptions={statusOptions}
              inDialog
              workOrder={{
                workOrderId: openedLot.workOrderId,
                workOrderNo: openedLot.workOrderNo,
              }}
            />
          </div>
        </Dialog>
      )}
    </>
  );
};

import { AlertBanner, Breadcrumb, PageHeader, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import {
  readFilters,
  readPage,
  readSelection,
  toAppliedSearchParams,
  toListQuery,
  withSelection,
  type SearchFilters,
  type Selection,
} from './filters';
import {
  activeLines,
  addLineSource,
  hasLineInput,
  removeLine,
  setLineQty,
  toLineDrafts,
  validateLines,
  type LineDraft,
} from './line-draft';
import { LoadErrorBanner } from './load-error';
import { toSubmitLock } from './lock';
import {
  useCustomerOptions,
  useItemLookup,
  useLocations,
  useReasonOptions,
  useShipmentStatusLookup,
  useUomLookup,
  useWarehouses,
} from './lookups';
import { OutcomePane, type Outcome } from './outcome-pane';
import { toPageView } from './pagination';
import {
  EMPTY_RECEIPT_DRAFT,
  hasDraftInput,
  toGoodsReceiptBody,
  validateDraft,
  type ReceiptDraft,
} from './receipt-body';
import { ReceiptForm } from './receipt-form';
import {
  returnReceiptKeys,
  useFindLot,
  useReturnReceiptPost,
  useShipmentDetail,
  useShipmentList,
} from './queries';
import { SearchPane } from './search-pane';
import { ShipmentList } from './shipment-list';
import { toLotLineSource, toReturnLineSources, type ShipmentRow } from './types';

const selectionKeyOf = (selection: Selection): string =>
  selection.kind === 'shipment' ? `shipment:${String(selection.shipmentId)}` : selection.kind;

export const ReturnReceiptScreen = () => {
  const t = messages.returnReceipt;
  const [searchParams, setSearchParams] = useSearchParams();
  const today = useMemo(() => new Date(), []);
  const filters = useMemo(() => readFilters(searchParams, today), [searchParams, today]);
  const page = readPage(searchParams);
  const selection = useMemo(() => readSelection(searchParams), [searchParams]);
  const listQuery = useMemo(() => toListQuery(filters, page), [filters, page]);
  const selectedShipmentId = selection.kind === 'shipment' ? selection.shipmentId : null;

  const list = useShipmentList(listQuery);
  const detail = useShipmentDetail(selectedShipmentId);
  const customers = useCustomerOptions();
  const reasons = useReasonOptions();
  const statusLookup = useShipmentStatusLookup();
  const uoms = useUomLookup();
  const items = useItemLookup();
  const warehouses = useWarehouses();

  const [draft, setDraft] = useState<ReceiptDraft>(EMPTY_RECEIPT_DRAFT);
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [lotMessage, setLotMessage] = useState<string | undefined>(undefined);
  const warehouseId = draft.warehouseId === '' ? null : Number(draft.warehouseId);
  const locations = useLocations(warehouseId);
  const findLot = useFindLot();
  const toast = useToast();
  const queryClient = useQueryClient();

  const rows = list.data?.items ?? [];
  const pageView = toPageView(list.data?.page ?? { page, size: 0, total: 0 }, rows.length);

  /* 입고 창고 기본값 — 불량창고가 앞에 온다(§4-A 「불량창고 우선 입고」). 아직 안 골랐을 때만. */
  const firstWarehouse = warehouses.items[0];
  useEffect(() => {
    if (draft.warehouseId === '' && firstWarehouse !== undefined) {
      setDraft((current) =>
        current.warehouseId === ''
          ? { ...current, warehouseId: String(firstWarehouse.warehouseId) }
          : current,
      );
    }
  }, [draft.warehouseId, firstWarehouse]);

  /* 대상이 바뀌면 라인·오류·결과를 비운다 — 다른 출하의 수량이 따라오지 않게. 창고·위치는 남긴다. */
  const selectionKey = selectionKeyOf(selection);
  useEffect(() => {
    setLines([]);
    setShowErrors(false);
    setLotMessage(undefined);
    setOutcome(null);
    setDraft((current) => ({ ...current, reasonCode: '', remarks: '' }));
  }, [selectionKey]);

  /* 원 출하의 배분이 오면 라인이 선다 — 수량은 비운 채다(무엇이 돌아왔는지는 사용자가 안다). */
  const detailData = detail.data;
  useEffect(() => {
    if (selectedShipmentId !== null && detailData?.shipmentId === selectedShipmentId) {
      setLines(toLineDrafts(toReturnLineSources(detailData)));
    }
  }, [detailData, selectedShipmentId]);

  const lineErrors = useMemo(() => validateLines(lines), [lines]);
  const active = useMemo(() => activeLines(lines), [lines]);
  const draftErrors = validateDraft(draft);
  const warehouse =
    warehouses.items.find((each) => String(each.warehouseId) === draft.warehouseId) ?? null;

  const write = useReturnReceiptPost((created) => {
    toast.show({ variant: 'success', description: t.form.success });
    if (warehouse !== null) {
      setOutcome({ receiptNo: created.goodsReceipt.goodsReceiptNo, lines: active, warehouse });
    }
    setLines([]);
    setShowErrors(false);
    setDraft((current) => ({ ...current, reasonCode: '', remarks: '' }));
  });

  const lock = toSubmitLock({
    lineCount: lines.length,
    activeLineCount: active.length,
    hasLineErrors: Object.keys(lineErrors).length > 0,
    hasLocation: draft.locationId !== '',
    isSaving: write.isSaving,
    writeError: write.error,
  });

  const apply = (next: SearchFilters, nextPage = 1): void => {
    setSearchParams((current) => toAppliedSearchParams(current, next, nextPage));
  };

  const select = (next: Selection): void => {
    setSearchParams((current) => withSelection(current, next));
  };

  const onSelectRow = (row: ShipmentRow): void => {
    select(
      selectedShipmentId === row.shipmentId
        ? { kind: 'none' }
        : { kind: 'shipment', shipmentId: row.shipmentId },
    );
  };

  const onFindLot = (lotNo: string): void => {
    findLot.mutate(lotNo, {
      onSuccess: (lot) => {
        if (lot === null) {
          setLotMessage(t.lot.notFound(lotNo));
          return;
        }
        const added = addLineSource(lines, toLotLineSource(lot));
        if (added.duplicate !== null) {
          setLotMessage(t.lot.alreadyAdded(lot.lotNo));
          return;
        }
        setLines(added.drafts);
        setLotMessage(undefined);
      },
      onError: () => setLotMessage(t.lot.searchFailed),
    });
  };

  const submit = (): void => {
    setShowErrors(true);
    if (lock.reason !== undefined || warehouse === null || draft.locationId === '') return;
    if (active.length === 0) return;
    write.write(
      toGoodsReceiptBody({
        shipmentId: selectedShipmentId,
        warehouse,
        locationId: Number(draft.locationId),
        lines: active,
        draft,
        now: new Date(),
      }),
    );
  };

  /** 적용 여부를 모르는 저장에서 빠져나가는 길 — 다시 읽고 오류 표시를 지운다. 멱등 키는 훅이 지킨다. */
  const checkOutcome = (): void => {
    void queryClient.invalidateQueries({ queryKey: returnReceiptKeys.all });
    write.reset();
  };

  const cancel = (): void => {
    setLines((current) => current.map((line) => ({ ...line, qtyText: '' })));
    setDraft((current) => ({ ...current, reasonCode: '', remarks: '' }));
    setShowErrors(false);
    write.reset();
  };

  const visibleDraftErrors = { ...(showErrors ? draftErrors : {}), ...write.fieldErrors };

  return (
    <>
      <PageHeader
        title={t.title}
        breadcrumb={<Breadcrumb items={[{ label: t.breadcrumbRoot }, { label: t.title }]} />}
      />
      {/* 확정된 출하의 사후 경로가 이 화면 하나다 — 그 사실과 다음 화면을 상단에 상시 둔다(§5-1). */}
      <div className="banner-slot">
        <AlertBanner variant="info">{t.scopeNotice}</AlertBanner>
      </div>
      <div className="return-receipt-workspace">
        <section
          className="pane return-receipt-pane return-receipt-search-pane"
          aria-label={t.panes.search}
        >
          <h2 className="pane-title">{t.panes.search}</h2>
          <SearchPane
            applied={filters}
            customers={customers}
            isDirect={selection.kind === 'direct'}
            onApply={(next) => apply(next)}
            onReset={() =>
              setSearchParams((current) =>
                toAppliedSearchParams(current, readFilters(new URLSearchParams(), today), 1),
              )
            }
            onDirect={() =>
              select(selection.kind === 'direct' ? { kind: 'none' } : { kind: 'direct' })
            }
          />
          <ShipmentList
            rows={rows}
            isLoading={list.isPending && listQuery !== null}
            error={
              list.isError ? (
                <LoadErrorBanner error={list.error} onRetry={() => void list.refetch()} />
              ) : null
            }
            page={pageView}
            selectedShipmentId={selectedShipmentId}
            statusLookup={statusLookup}
            onSelect={onSelectRow}
            onChangePage={(nextPage) => apply(filters, nextPage)}
          />
        </section>
        <section className="pane return-receipt-pane" aria-label={t.panes.receipt}>
          <h2 className="pane-title">{t.panes.receipt}</h2>
          {outcome !== null ? (
            <OutcomePane outcome={outcome} uoms={uoms} onAnother={() => select({ kind: 'none' })} />
          ) : (
            <ReceiptForm
              target={{
                selection,
                shipmentNo:
                  detailData?.shipmentId === selectedShipmentId
                    ? (detailData?.shipmentNo ?? null)
                    : (rows.find((row) => row.shipmentId === selectedShipmentId)?.shipmentNo ??
                      null),
                isDetailPending: selectedShipmentId !== null && detail.isPending,
                detailError: detail.isError ? detail.error : null,
                onRetryDetail: () => void detail.refetch(),
              }}
              lotFind={{ isSearching: findLot.isPending, message: lotMessage, onFind: onFindLot }}
              lines={lines}
              lineErrors={showErrors || hasLineInput(lines) ? lineErrors : {}}
              activeLines={active}
              draft={draft}
              draftErrors={visibleDraftErrors}
              reasons={reasons}
              warehouses={warehouses}
              locations={locations}
              uoms={uoms}
              items={items}
              lock={lock}
              writeError={write.error}
              isSaving={write.isSaving}
              canCancel={hasLineInput(lines) || hasDraftInput(draft)}
              onChangeQty={(key, qtyText) =>
                setLines((current) => setLineQty(current, key, qtyText))
              }
              onRemoveLine={(key) => setLines((current) => removeLine(current, key))}
              onChangeDraft={(next) => {
                if (next.locationId !== draft.locationId)
                  write.clearFieldError('destinationLocationId');
                if (next.reasonCode !== draft.reasonCode) write.clearFieldError('reasonCode');
                setDraft(next);
              }}
              onSubmit={submit}
              onCancel={cancel}
              onCheckOutcome={checkOutcome}
            />
          )}
        </section>
      </div>
    </>
  );
};

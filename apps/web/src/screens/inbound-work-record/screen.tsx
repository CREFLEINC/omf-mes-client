import { DatePicker, EmptyState, Skeleton, Tabs, TextField, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { LoadErrorAlert } from '../../patterns/load-error-banner';
import { plantToday } from '../../patterns/plant-time';
import { Select } from '../../patterns/select';
import { DetailPanel } from './detail-panel';
import { FinalizeDialog } from './finalize-dialog';
import type { WorkRecordDetail, WorkRecordLot } from './forward-contract';
import { LotTable } from './lot-table';
import { usePlants, useWorkRecordList, workRecordKeys } from './queries';
import { parseView, VIEWS, type View } from './types';

const t = messages.inboundWorkRecord;

const NO_ROWS: WorkRecordLot[] = [];

/** 기본 입하일 기간 — 공장 오늘에서 30일 앞까지(C6 정함 — 설계는 기본값을 적지 않았다). */
const DEFAULT_DAYS = 30;

const daysBefore = (date: string, days: number): string => {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() - days);
  return at.toISOString().slice(0, 10);
};

const viewName = (view: View): string => t.views[view];
const viewHint = (view: View): string =>
  view === 'ready' ? t.views.readyHint : view === 'prog' ? t.views.progHint : t.views.finalHint;

/**
 * W-01-16 입하/입고 작업 기록(005 · omf-all-around#254 · screens/W-01-16.md · 시안 W0116-After). 「구매 / 자재 관리 ›
 * 입고 관리」 탭 묶음의 마지막 탭이다(머리 · 탭은 셸이 세운다). 새 흐름(`ON_FINALIZE`) 입하 LOT 만 — 이전 데이터는 나오지
 * 않는다(FR-051). 관리자가 P/O 매칭을 고치고 「마감 승인 대기」 건을 최종 마감한다(US8).
 *
 * ⛔ 시안의 「ERP 송신 상태」(보냄 · 반영 대기 / ERP 반영) 표시와 [ERP 반영] 흉내는 만들지 않는다 — #265.
 * 주소: 공장(`plant`) · 입하일(`from` · `to`) · 공급사(`supplier`) · 찾기(`q`) · 보기(`view`) · 연 입하 LOT(`open`).
 */
export const InboundWorkRecordScreen = () => {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = plantToday();
  const plantParam = searchParams.get('plant') ?? '';
  const from = searchParams.get('from') ?? daysBefore(today, DEFAULT_DAYS);
  const to = searchParams.get('to') ?? today;
  const supplierParam = searchParams.get('supplier') ?? '';
  const query = searchParams.get('q') ?? '';
  const view = parseView(searchParams.get('view'));
  const openParam = Number(searchParams.get('open') ?? '');
  const openId = Number.isInteger(openParam) && openParam > 0 ? openParam : null;

  const [finalizing, setFinalizing] = useState<WorkRecordDetail | null>(null);

  const plants = usePlants();
  const plant =
    plants.data?.find((row) => String(row.plantId) === plantParam) ?? plants.data?.[0] ?? null;
  const plantId = plant?.plantId ?? null;
  const lists: Record<View, ReturnType<typeof useWorkRecordList>> = {
    ready: useWorkRecordList('ready', plantId, from, to),
    prog: useWorkRecordList('prog', plantId, from, to),
    final: useWorkRecordList('final', plantId, from, to),
  };

  const update = (patch: Record<string, string | null>): void => {
    const next = new URLSearchParams(searchParams);
    for (const [name, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(name);
      else next.set(name, value);
    }
    setSearchParams(next, { replace: true });
  };

  const needle = query.trim().toLocaleLowerCase('ko-KR');
  const matches = (lot: WorkRecordLot): boolean =>
    (supplierParam === '' || String(lot.supplierId) === supplierParam) &&
    (needle === '' ||
      `${lot.inboundLotNo} ${lot.itemCode} ${lot.itemName}`
        .toLocaleLowerCase('ko-KR')
        .includes(needle));
  const rowsOf = (key: View): WorkRecordLot[] => (lists[key].data ?? NO_ROWS).filter(matches);

  const suppliers = [
    ...new Map(
      VIEWS.flatMap((key) => lists[key].data ?? NO_ROWS).map(
        (lot) => [lot.supplierId, lot] as const,
      ),
    ).values(),
  ].sort((left, right) => left.supplierName.localeCompare(right.supplierName, 'ko'));

  const current = lists[view];
  const rows = rowsOf(view);

  const reloadDetail = async (inboundLotId: number) => {
    void queryClient.invalidateQueries({ queryKey: workRecordKeys.lists });
    await queryClient.refetchQueries({ queryKey: workRecordKeys.detail(inboundLotId) });
    return queryClient.getQueryData<WorkRecordDetail>(workRecordKeys.detail(inboundLotId))
      ?.finalizeBlockers;
  };

  const filters = (
    <section className="filter-bar iwr-filters" aria-label={t.filters.label}>
      {(plants.data?.length ?? 0) > 1 && (
        <Select
          aria-label={t.filters.plant}
          value={plantId === null ? null : String(plantId)}
          options={(plants.data ?? []).map((row) => ({
            value: String(row.plantId),
            label: row.plantName,
          }))}
          onChange={(value) => update({ plant: value, supplier: null, open: null })}
        />
      )}
      <DatePicker
        mode="range"
        aria-label={t.filters.period}
        value={[from, to]}
        onChange={([nextFrom, nextTo]) => update({ from: nextFrom, to: nextTo, open: null })}
      />
      <Select
        aria-label={t.filters.supplier}
        value={supplierParam}
        options={[
          { value: '', label: t.filters.supplierAll },
          ...suppliers.map((lot) => ({
            value: String(lot.supplierId),
            label: `${lot.supplierName} ${lot.supplierCode}`,
          })),
        ]}
        onChange={(value) => update({ supplier: value })}
      />
      <TextField
        aria-label={t.filters.query}
        placeholder={t.filters.queryPlaceholder}
        type="search"
        value={query}
        onChange={(event) => update({ q: event.target.value })}
      />
    </section>
  );

  const table = (): ReactNode => {
    if (plants.isError)
      return <LoadErrorAlert error={plants.error} onRetry={() => void plants.refetch()} />;
    if (plants.isPending) return <Skeleton variant="rect" height="16rem" />;
    if (plantId === null) return <EmptyState size="sm" title={t.noPlant} />;
    if (current.isError)
      return <LoadErrorAlert error={current.error} onRetry={() => void current.refetch()} />;
    if (current.isPending) return <Skeleton variant="rect" height="16rem" />;
    if (rows.length === 0) return <EmptyState size="sm" title={t.list.empty(viewName(view))} />;
    return (
      <LotTable
        view={view}
        rows={rows}
        openId={openId}
        onOpen={(inboundLotId) => update({ open: String(inboundLotId) })}
      />
    );
  };

  return (
    <div className="iwr">
      {filters}
      <Tabs
        className="iwr-view-tabs"
        aria-label={t.views.label}
        value={view}
        onChange={(next) => update({ view: next, open: null })}
        items={VIEWS.map((key) => ({
          value: key,
          label: viewName(key),
          badge:
            lists[key].data === undefined ? undefined : (
              <span className="iwr-tab-count">{String(rowsOf(key).length)}</span>
            ),
          content: null,
        }))}
      />
      <p className="field-note">{viewHint(view)}</p>
      {table()}

      {openId !== null && finalizing === null && (
        <DetailPanel
          inboundLotId={openId}
          onClose={() => update({ open: null })}
          onFinalize={setFinalizing}
        />
      )}
      {finalizing !== null && (
        <FinalizeDialog
          detail={finalizing}
          onClose={() => setFinalizing(null)}
          onReload={() => reloadDetail(finalizing.inboundLotId)}
          onFinalized={(finalized) => {
            setFinalizing(null);
            void queryClient.invalidateQueries({ queryKey: workRecordKeys.all });
            update({ view: 'final', open: String(finalized.inboundLotId) });
            toast.show({
              variant: 'success',
              description: t.finalizeDialog.done(finalized.inboundLotNo),
            });
          }}
        />
      )}
    </div>
  );
};

import {
  AlertBanner,
  Button,
  Checkbox,
  type Column,
  EmptyState,
  SearchInput,
  Select,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import {
  useItemReferenceOptions,
  useLocationReferenceOptions,
  useWarehouseReferenceOptions,
  type ReferenceOptionsResult,
} from '../lot-status-history/reference-options';
import { useLotStatusOptions } from '../lot-status-history/options';
import { useWorkOrderCloseUomLookup } from '../work-order-close/candidate-references';
import {
  EMPTY_SUSPICIOUS_MATERIAL_FILTERS,
  reconcileSuspiciousMaterialSelection,
  toSelectedLotSnapshot,
  toSuspiciousMaterialQuery,
  type SelectedLotSnapshot,
  type SuspiciousMaterialFilters,
} from './candidate-model';

type Lot = components['schemas']['LotQualityStatus'];

interface Props {
  isLocked: boolean;
  selection: SelectedLotSnapshot[];
  onSelectionChange: (selection: SelectedLotSnapshot[]) => void;
}

const positiveId = (value: string): number | null => {
  const parsed = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const referenceLabel = (
  query: { data?: ReferenceOptionsResult; isPending: boolean; isError: boolean },
  id: number | undefined,
  fallback: string,
): string => {
  if (id === undefined || query.isPending || query.isError || query.data?.isTruncated !== false)
    return fallback;
  return query.data.entries.find((entry) => entry.value === String(id))?.label ?? fallback;
};

const sameSelection = (left: SelectedLotSnapshot[], right: SelectedLotSnapshot[]): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export const SuspiciousMaterialCandidatePane = ({
  isLocked,
  selection,
  onSelectionChange,
}: Props) => {
  const { client } = useApiClient();
  const [draft, setDraft] = useState(EMPTY_SUSPICIOUS_MATERIAL_FILTERS);
  const [filters, setFilters] = useState(EMPTY_SUSPICIOUS_MATERIAL_FILTERS);
  const [page, setPage] = useState(1);
  const candidates = useQuery({
    queryKey: ['suspicious-material-hold', 'candidates', filters, page],
    placeholderData: keepPreviousData,
    enabled: !isLocked,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/lot-statuses', {
          params: { query: toSuspiciousMaterialQuery(filters, page) },
        }),
      ),
  });
  const items = useItemReferenceOptions();
  const warehouses = useWarehouseReferenceOptions();
  const locations = useLocationReferenceOptions(positiveId(filters.warehouseId));
  const statuses = useLotStatusOptions();
  const uoms = useWorkOrderCloseUomLookup();
  const ready = candidates.data !== undefined && !candidates.isFetching && !candidates.isError;

  useEffect(() => {
    if (candidates.isError) {
      if (selection.length > 0) onSelectionChange([]);
      return;
    }
    if (!ready || candidates.data === undefined) return;
    const next = reconcileSuspiciousMaterialSelection(selection, {
      kind: 'SUCCESS',
      items: candidates.data.items,
    }).map((value) => ({
      ...value,
      locationLabel: selection.find(({ lotId }) => lotId === value.lotId)?.locationLabel,
      uomLabel: selection.find(({ lotId }) => lotId === value.lotId)?.uomLabel,
    }));
    if (!sameSelection(selection, next)) onSelectionChange(next);
  }, [candidates.data, candidates.isError, onSelectionChange, ready, selection]);

  const move = (nextFilters: SuspiciousMaterialFilters, nextPage: number): void => {
    if (isLocked) return;
    onSelectionChange([]);
    setPage(nextPage);
    setFilters(nextFilters);
  };
  const apply = (): void => move({ ...draft }, 1);
  const reset = (): void => {
    if (isLocked) return;
    setDraft(EMPTY_SUSPICIOUS_MATERIAL_FILTERS);
    move(EMPTY_SUSPICIOUS_MATERIAL_FILTERS, 1);
  };
  const toggle = (row: Lot): void => {
    if (isLocked) return;
    if (selection.some((value) => value.lotId === row.lotId))
      onSelectionChange(selection.filter((value) => value.lotId !== row.lotId));
    else {
      const snapshot = toSelectedLotSnapshot(row);
      const warehouse = referenceLabel(warehouses, row.warehouseId, '');
      const location = referenceLabel(locations, row.locationId, '');
      const unit =
        row.uomId === undefined || uoms.isLoading || uoms.isError || uoms.truncated
          ? ''
          : (uoms.entries.find(({ uomId }) => uomId === row.uomId)?.label ?? '');
      if (snapshot !== null)
        onSelectionChange([
          ...selection,
          {
            ...snapshot,
            locationLabel:
              warehouse === '' || location === '' ? null : `${warehouse} / ${location}`,
            uomLabel: unit === '' ? null : unit,
          },
        ]);
    }
  };
  const statusLabel = (code: string): string =>
    statuses.data?.isTruncated === false
      ? (statuses.data.items.find((item) => item.code === code)?.label ?? 'Lot Status 이름 미확인')
      : 'Lot Status 이름 미확인';
  const uomLabel = (id: number | undefined): string =>
    id !== undefined && !uoms.isLoading && !uoms.isError && !uoms.truncated
      ? (uoms.entries.find((value) => value.uomId === id)?.label ?? '단위 이름 미확인')
      : '단위 이름 미확인';
  const columns: Column<Lot>[] = [
    {
      key: 'select',
      header: '선택',
      render: (row) => (
        <Checkbox
          aria-label={`${row.lotNo} 선택`}
          checked={selection.some((value) => value.lotId === row.lotId)}
          disabled={isLocked || toSelectedLotSnapshot(row) === null}
          onChange={() => toggle(row)}
        />
      ),
    },
    {
      key: 'lot',
      header: 'LOT 번호',
      render: (row) =>
        row.fullyHeld ? `${row.lotNo} · 이미 전량 보류되어 선택할 수 없습니다.` : row.lotNo,
    },
    {
      key: 'item',
      header: '품목',
      render: (row) => referenceLabel(items, row.itemId, '품목 이름 미확인'),
    },
    {
      key: 'location',
      header: '위치',
      render: (row) =>
        `${referenceLabel(warehouses, row.warehouseId, '창고 이름 미확인')} / ${referenceLabel(locations, row.locationId, '위치 이름 미확인')}`,
    },
    {
      key: 'quantity',
      header: '보유 수량·단위',
      align: 'end',
      render: (row) =>
        `${row.onHandQty === undefined ? '수량 미확인' : String(row.onHandQty)} ${uomLabel(row.uomId)}`,
    },
    {
      key: 'status',
      header: 'Lot Status·최근 전이',
      render: (row) =>
        `${statusLabel(row.lotStatusCode)} · ${row.latestTransitionAt ?? '최근 전이 없음'}`,
    },
  ];
  const options = (data: ReferenceOptionsResult | undefined) =>
    data?.entries.map(({ value, label }) => ({ value, label })) ?? [];
  const statusOptions =
    statuses.data?.items.map((item) => ({ value: item.code, label: item.label })) ?? [];
  const filterSelects = [
    ['품목', 'itemId', options(items.data)],
    ['창고', 'warehouseId', options(warehouses.data)],
    ['Lot Status', 'lotStatusCode', statusOptions],
  ] as const;
  const meta = candidates.data?.page;
  const pages =
    meta === undefined || meta.size < 1 ? 1 : Math.max(1, Math.ceil(meta.total / meta.size));

  return (
    <section className="pane" aria-label="의심자재 후보">
      <div className="filter-bar">
        <SearchInput
          label="LOT 번호"
          value={draft.q}
          disabled={isLocked}
          onChange={(event) => setDraft((value) => ({ ...value, q: event.target.value }))}
          onSearch={apply}
        />
        {filterSelects.map(([label, key, entries]) => (
          <div key={key}>
            <span className="field-label">{label}</span>
            <Select
              aria-label={label}
              value={draft[key]}
              options={[{ value: '', label: '전체' }, ...entries]}
              disabled={isLocked}
              onChange={(value) => setDraft((current) => ({ ...current, [key]: value }))}
            />
          </div>
        ))}
        <Button disabled={isLocked} onClick={apply}>
          조회
        </Button>
        <Button variant="outlined" disabled={isLocked} onClick={reset}>
          초기화
        </Button>
      </div>
      <p role="status">{selection.length}건 선택</p>
      {candidates.isError ? (
        <AlertBanner
          variant="error"
          title="의심자재 후보를 불러오지 못했습니다."
          action={<Button onClick={() => void candidates.refetch()}>다시 시도</Button>}
        />
      ) : candidates.isPending ? (
        <div role="status" aria-label="의심자재 후보를 불러오는 중">
          <SkeletonText lines={3} />
        </div>
      ) : (
        <>
          <Table
            density="compact"
            columns={columns}
            rows={candidates.data.items}
            getRowId={(row) => String(row.lotId)}
            sort={null}
            empty={<EmptyState size="sm" live title="조건에 맞는 LOT이 없습니다." />}
          />
          <nav className="form-actions" aria-label="의심자재 후보 쪽 이동">
            <Button
              variant="outlined"
              disabled={isLocked || page <= 1}
              onClick={() => move(filters, page - 1)}
            >
              이전 쪽
            </Button>
            <Button
              variant="outlined"
              disabled={isLocked || page >= pages}
              onClick={() => move(filters, page + 1)}
            >
              다음 쪽
            </Button>
          </nav>
        </>
      )}
    </section>
  );
};

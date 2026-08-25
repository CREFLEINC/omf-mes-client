import {
  AlertBanner,
  Button,
  Card,
  Chip,
  type Column,
  EmptyState,
  SearchInput,
  Select,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import type { components, paths } from '@omf-mes/api-client';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useId, useState } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { useLotStatusOptions } from '../lot-status-history/options';
import { useItemReferenceOptions } from '../lot-status-history/reference-options';
import { LotStatusTransitionPreparation } from './transition-preparation';

type LotStatusCandidateQuery = NonNullable<
  NonNullable<paths['/quality/lot-statuses']['get']>['parameters']['query']
>;
export type LotStatusCandidate = components['schemas']['LotQualityStatus'];

export interface LotStatusCandidateFilters {
  q: string;
  itemId: string;
  lotStatusCode: string;
}

export const EMPTY_LOT_STATUS_CANDIDATE_FILTERS: LotStatusCandidateFilters = {
  q: '',
  itemId: '',
  lotStatusCode: '',
};

const positiveId = (value: string): number | undefined => {
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
};

export const toLotStatusCandidateQuery = (
  filters: LotStatusCandidateFilters,
  page: number,
): LotStatusCandidateQuery => {
  const query: LotStatusCandidateQuery = {};
  const itemId = positiveId(filters.itemId);
  if (filters.q !== '') query.q = filters.q;
  if (itemId !== undefined) query.itemId = itemId;
  if (filters.lotStatusCode !== '') query.lotStatusCode = filters.lotStatusCode;
  if (Number.isSafeInteger(page) && page > 1) query.page = page;
  return query;
};

export const lotStatusTransitionKeys = {
  candidates: (filters: LotStatusCandidateFilters, page: number) =>
    ['lot-status-transition', 'candidates', { ...filters }, page] as const,
};

const useCandidates = (filters: LotStatusCandidateFilters, page: number) => {
  const { client } = useApiClient();
  const query = toLotStatusCandidateQuery(filters, page);
  return useQuery({
    queryKey: lotStatusTransitionKeys.candidates(filters, page),
    placeholderData: keepPreviousData,
    queryFn: () => runRequest(() => client.GET('/quality/lot-statuses', { params: { query } })),
  });
};

const rowKey = (row: LotStatusCandidate): string =>
  `${row.lotId}:${row.warehouseId ?? '-'}:${row.locationId ?? '-'}`;
const emptyValue = '—';
const quantity = (value: number | undefined): string =>
  value === undefined ? emptyValue : new Intl.NumberFormat('ko-KR').format(value);
const formatDateTime = (value: string | undefined): string => {
  if (value === undefined) return emptyValue;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(value);
  return match === null ? value : `${match[1]} ${match[2]}`;
};

interface FilterSelectProps {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

const FilterSelect = ({ label, options, value, onChange }: FilterSelectProps) => {
  const id = useId();
  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <Select id={id} options={options} value={value} onChange={onChange} />
    </div>
  );
};

export const LotStatusTransitionCandidateScreen = () => {
  const [draft, setDraft] = useState(EMPTY_LOT_STATUS_CANDIDATE_FILTERS);
  const [filters, setFilters] = useState(EMPTY_LOT_STATUS_CANDIDATE_FILTERS);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<LotStatusCandidate | null>(null);
  const candidates = useCandidates(filters, page);
  const items = useItemReferenceOptions();
  const statuses = useLotStatusOptions();
  const itemOptions =
    items.data?.entries.map((entry) => ({ value: entry.value, label: entry.label })) ?? [];
  const statusOptions =
    statuses.data?.items.map((item) => ({ value: item.code, label: item.label })) ?? [];
  const itemLabel = (itemId: number): string =>
    itemOptions.find((option) => option.value === String(itemId))?.label ?? '품목 이름 미확인';
  const statusLabel = (code: string): string =>
    statusOptions.find((option) => option.value === code)?.label ?? `${code} (이름 미확인)`;
  const changePage = (next: number): void => {
    setPage(next);
    setSelected(null);
  };
  const apply = (): void => {
    setFilters({ ...draft });
    changePage(1);
  };
  const reset = (): void => {
    setDraft(EMPTY_LOT_STATUS_CANDIDATE_FILTERS);
    setFilters(EMPTY_LOT_STATUS_CANDIDATE_FILTERS);
    changePage(1);
  };
  const columns: Column<LotStatusCandidate>[] = [
    {
      key: 'lotNo',
      header: 'LOT 번호',
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          aria-label={`${row.lotNo} 선택`}
          aria-current={selected?.lotId === row.lotId ? true : undefined}
          onClick={() => setSelected(row)}
        >
          {row.lotNo}
        </button>
      ),
    },
    { key: 'item', header: '품목', render: (row) => itemLabel(row.itemId) },
    {
      key: 'status',
      header: '품질 상태',
      render: (row) => <Chip variant="status">{statusLabel(row.lotStatusCode)}</Chip>,
    },
    { key: 'onHand', header: '보유 수량', align: 'end', render: (row) => row.onHandQty ?? '—' },
    { key: 'held', header: '보류 수량', align: 'end', render: (row) => row.heldQty ?? '—' },
  ];
  const meta = candidates.data?.page;
  const totalPages = meta === undefined || meta.size < 1 ? 1 : Math.ceil(meta.total / meta.size);

  return (
    <section className="pane" aria-label="Lot Status 판정·전이 대상">
      <div className="filter-bar">
        <SearchInput
          label="LOT 번호"
          value={draft.q}
          onChange={(event) => setDraft((current) => ({ ...current, q: event.target.value }))}
          onSearch={apply}
        />
        <FilterSelect
          label="자재"
          options={[{ value: '', label: '전체' }, ...itemOptions]}
          value={draft.itemId}
          onChange={(itemId) => setDraft((current) => ({ ...current, itemId }))}
        />
        <FilterSelect
          label="품질 상태"
          options={[{ value: '', label: '전체' }, ...statusOptions]}
          value={draft.lotStatusCode}
          onChange={(lotStatusCode) => setDraft((current) => ({ ...current, lotStatusCode }))}
        />
        <Button onClick={apply}>조회</Button>
        <Button variant="outlined" onClick={reset}>
          초기화
        </Button>
      </div>
      {candidates.isError ? (
        <AlertBanner
          variant="error"
          title="LOT 후보를 불러오지 못했습니다."
          action={<Button onClick={() => void candidates.refetch()}>다시 시도</Button>}
        />
      ) : candidates.isPending ? (
        <div role="status" aria-label="LOT 후보를 불러오는 중">
          <SkeletonText lines={3} />
        </div>
      ) : (
        <>
          <Table
            density="compact"
            columns={columns}
            rows={candidates.data.items}
            getRowId={rowKey}
            sort={null}
            empty={<EmptyState size="sm" live title="조건에 맞는 LOT이 없습니다." />}
          />
          <nav className="form-actions" aria-label="LOT 후보 쪽 이동">
            <Button variant="outlined" disabled={page <= 1} onClick={() => changePage(page - 1)}>
              이전 쪽
            </Button>
            <Button
              variant="outlined"
              disabled={page >= totalPages}
              onClick={() => changePage(page + 1)}
            >
              다음 쪽
            </Button>
          </nav>
        </>
      )}
      {selected !== null && (
        <>
          <section aria-label="선택한 LOT">
            <Card bordered>
              <Card.Header>
                <h2>선택 LOT</h2>
                <dl className="filter-bar" aria-label="선택 LOT 식별">
                  {[
                    ['LOT 번호', selected.lotNo],
                    ['품목', itemLabel(selected.itemId)],
                  ].map(([label, value]) => (
                    <div className="field-cell" key={label}>
                      <dt className="field-label">{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </Card.Header>
              <Card.Body>
                <h3>현재 상태</h3>
                <dl className="filter-bar" aria-label="선택 LOT 현재 상태">
                  {[
                    ['Lot Status', statusLabel(selected.lotStatusCode)],
                    ['보유 수량', quantity(selected.onHandQty)],
                    ['보류 수량', quantity(selected.heldQty)],
                    ['가용 수량', quantity(selected.availableQty)],
                    ['최근 전이', formatDateTime(selected.latestTransitionAt)],
                    ['최근 사유', selected.latestReasonCode ?? emptyValue],
                  ].map(([label, value]) => (
                    <div className="field-cell" key={label}>
                      <dt className="field-label">{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </Card.Body>
            </Card>
          </section>
          <LotStatusTransitionPreparation key={rowKey(selected)} lot={selected} />
        </>
      )}
    </section>
  );
};

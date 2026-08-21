import { Breadcrumb, PageHeader, Tabs, type TabItem } from '@crefle/web-ui';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';

import {
  EMPTY_LOT_FILTERS,
  readLotFilters,
  readMode,
  toAppliedLotSearchParams,
  toModeSearchParams,
  type LotFilters,
  type ScreenMode,
} from './filters';
import { LotFilterBar, type FilterOption } from './lot-filter-bar';
import { useLotStatusOptions, useLotTypeOptions, type LotCodeOption } from './options';
import {
  useItemReferenceOptions,
  useWarehouseReferenceOptions,
  type ReferenceOption,
} from './reference-options';

const inactiveLabel = (label: string, isActive: boolean): string =>
  isActive ? label : `${label} (미사용)`;

const toCodeOptions = (items: readonly LotCodeOption[] | undefined): FilterOption[] =>
  items?.map((item) => ({
    value: item.code,
    label: inactiveLabel(item.label, item.isActive),
  })) ?? [];

const toReferenceOptions = (items: readonly ReferenceOption[] | undefined): FilterOption[] =>
  items?.map((item) => ({
    value: item.value,
    label: inactiveLabel(item.label, item.isActive),
  })) ?? [];

interface OptionState {
  isPending: boolean;
  isError: boolean;
  data?: { isTruncated: boolean };
}

const optionNote = (state: OptionState, name: string): string | undefined => {
  if (state.isPending) return `${name} 목록을 불러오는 중입니다.`;
  if (state.isError) return `${name} 목록을 불러오지 못했습니다.`;
  if (state.data?.isTruncated === true) return `일부 ${name}만 표시됩니다.`;
  return undefined;
};

interface LotModeProps {
  filters: LotFilters;
  onSearch: (filters: LotFilters) => void;
  onReset: () => void;
}

const LotMode = ({ filters, onSearch, onReset }: LotModeProps) => {
  const lotTypes = useLotTypeOptions();
  const lotStatuses = useLotStatusOptions();
  const warehouses = useWarehouseReferenceOptions();
  const items = useItemReferenceOptions();

  const lotTypeBlockReason = lotTypes.isPending
    ? 'LOT 유형 기준값을 불러오는 중입니다.'
    : lotTypes.isError
      ? 'LOT 유형 기준값을 불러오지 못했습니다.'
      : lotTypes.data?.isSeeded === false
        ? 'LOT 유형 기준값이 준비되지 않았습니다.'
        : undefined;
  const lotStatusNote =
    lotStatuses.data?.isSeeded === false
      ? '현재 상태 기준값이 준비되지 않았습니다.'
      : optionNote(lotStatuses, '현재 상태');

  return (
    <section className="pane" aria-label="LOT으로 찾기">
      <LotFilterBar
        appliedFilters={filters}
        lotTypeOptions={toCodeOptions(lotTypes.data?.items)}
        lotStatusOptions={toCodeOptions(lotStatuses.data?.items)}
        warehouseOptions={toReferenceOptions(warehouses.data?.entries)}
        itemOptions={toReferenceOptions(items.data?.entries)}
        lotTypeNote={
          lotTypes.data?.isTruncated === true ? '일부 LOT 유형만 표시됩니다.' : undefined
        }
        lotStatusNote={lotStatusNote}
        warehouseNote={optionNote(warehouses, '창고')}
        itemNote={optionNote(items, '품목')}
        lotTypeBlockReason={lotTypeBlockReason}
        onSearch={onSearch}
        onReset={onReset}
      />
    </section>
  );
};

export const LotStatusHistoryScreen = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = readMode(searchParams);
  const filters = useMemo(() => readLotFilters(searchParams), [searchParams]);

  const apply = (next: LotFilters): void => {
    setSearchParams((current) => toAppliedLotSearchParams(current, next, 1));
  };
  const changeMode = (next: string): void => {
    setSearchParams((current) => toModeSearchParams(current, next as ScreenMode));
  };

  const lotContent =
    mode === 'lot' ? (
      <LotMode filters={filters} onSearch={apply} onReset={() => apply(EMPTY_LOT_FILTERS)} />
    ) : null;
  const historyContent =
    mode === 'history' ? (
      <section className="pane" aria-label="이력으로 찾기">
        <p>보류 사건 이력 조회는 후속 단계에서 연결됩니다.</p>
      </section>
    ) : null;
  const tabs: TabItem[] = [
    { value: 'lot', label: 'LOT으로 찾기', content: lotContent },
    { value: 'history', label: '이력으로 찾기', content: historyContent },
  ];

  return (
    <>
      <PageHeader
        title="Lot Status 현황·변경이력 조회"
        breadcrumb={
          <Breadcrumb items={[{ label: '품질관리' }, { label: 'Lot Status 현황·변경이력 조회' }]} />
        }
      />
      <Tabs aria-label="Lot Status 조회 모드" items={tabs} value={mode} onChange={changeMode} />
    </>
  );
};

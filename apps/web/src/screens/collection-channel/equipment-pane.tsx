import { Button, type Column, EmptyState, SearchInput, SkeletonText, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useState } from 'react';

import { type MasterDataPlant, plantSelectOf } from '../../patterns/master-data-plant';
import { hasChangedFilters } from '../../patterns/filter-more';

import { UsageName } from '../../patterns/usage-chip';
import { ROW_PICK_CLASS, rowPickHandlers } from '../../patterns/row-pick';
import { type CodeOption, defaultEquipmentFilters } from './options';
import { SelectField } from './select-field';
import type { Equipment, EquipmentFilters } from './types';

const t = messages.collectionChannel;

export interface EquipmentPaneProps {
  items: Equipment[];
  isLoading: boolean;
  /** 전체 건수. 받은 것보다 크면 목록이 잘린 것이다 */
  total: number | null;
  appliedFilters: EquipmentFilters;
  onApplyFilters: (next: EquipmentFilters) => void;
  plantOptions: CodeOption[];
  /** 위 줄 사업부가 정한 공장 — 하나면 공장 칸을 감춘다. */
  plant?: MasterDataPlant;
  selectedEquipmentId: number | null;
  onSelect: (equipmentId: number) => void;
  /** 조회 실패 표시. null이 아니면 표·빈 상태 대신 이것을 낸다 */
  loadError: ReactNode;
}

/**
 * 「조회」를 눌러야 나가는 조건.
 *
 * ⛔ **한 벌을 나눠 갖지 않는다** — 즉시 적용되는 조건까지 초안이 품으면, 초안에 남아 있던
 * 옛 값이 방금 바꾼 것을 조용히 되돌린다(client#314·#316 에서 실제로 났던 결함이다).
 * 이 페인은 즉시 적용 조건이 아직 없지만, 형태를 형제 화면과 같게 두어 나중에 하나가 늘어도
 * 같은 결함이 다시 나지 않게 한다.
 */
const draftOf = (filters: EquipmentFilters): EquipmentFilters => ({
  q: filters.q,
  plantId: filters.plantId,
});

const hasAnyFilter = (filters: EquipmentFilters): boolean =>
  filters.q !== '' || filters.plantId !== '';

/**
 * 조회 줄과 목록을 따로 돌려준다 — 통일 배치(#350)에서 조회 줄은 조회 조건 상자에, 표는 목록 상자에 선다.
 */
export const useEquipmentPane = ({
  items,
  isLoading,
  total,
  appliedFilters,
  onApplyFilters,
  plantOptions,
  plant,
  selectedEquipmentId,
  onSelect,
  loadError,
}: EquipmentPaneProps): { filter: ReactNode; list: ReactNode } => {
  const [draft, setDraft] = useState<EquipmentFilters>(draftOf(appliedFilters));
  const { q: appliedQ, plantId: appliedPlantId } = appliedFilters;

  /* 밖에서 조건이 되돌려지면(초기화) 초안도 그것을 따라간다. */
  useEffect(() => {
    setDraft({ q: appliedQ, plantId: appliedPlantId });
  }, [appliedQ, appliedPlantId]);

  const applyDraft = (overrides: Partial<EquipmentFilters> = {}): void => {
    onApplyFilters({ ...appliedFilters, ...draft, ...overrides });
  };

  /*
   * ⛔ **초안을 손으로 거둔다 — 위 효과에 맡기지 않는다.** 효과는 «적용된 값이 달라졌을 때»만
   * 돈다. 적용된 검색어가 이미 비어 있는데 칸에만 낱말이 남아 있으면 효과가 돌지 않아
   * 칸이 그대로 남고, 그 상태로 「조회」를 누르면 거둔 줄 알았던 조건이 되살아난다.
   */
  const resetAll = (): void => {
    setDraft(draftOf(defaultEquipmentFilters));
    onApplyFilters(defaultEquipmentFilters);
  };

  /* 코드가 곧 고르는 손잡이다 — 줄마다 단추를 세우면 좁은 페인이 조작으로 덮인다. */
  const columns: Column<Equipment>[] = [
    {
      key: 'equipmentCode',
      header: t.fields.equipmentCode,
      width: '120px',
      render: (row) => (
        <button
          type="button"
          className={`link-cell ${ROW_PICK_CLASS}`}
          aria-current={row.equipmentId === selectedEquipmentId ? 'true' : undefined}
          aria-label={t.equipment.selectLabel(row.equipmentCode, row.equipmentName)}
          onClick={() => onSelect(row.equipmentId)}
        >
          {row.equipmentCode}
        </button>
      ),
    },
    {
      key: 'equipmentName',
      header: t.fields.equipmentName,
      /* 사용 여부는 칸이 아니라 이름 옆 「미사용」 라벨이다 — 좁은 페인에 칸을 하나 더 두지 않는다(#358). */
      render: (row) => <UsageName isActive={row.isActive}>{row.equipmentName}</UsageName>,
    },
  ];

  const emptySlot = hasAnyFilter(appliedFilters) ? (
    <EmptyState
      size="sm"
      live
      title={t.equipment.noMatchTitle}
      description={t.equipment.noMatchDescription}
      action={
        <Button variant="outlined" onClick={resetAll}>
          {messages.common.reset}
        </Button>
      }
    />
  ) : (
    <EmptyState
      size="sm"
      live
      title={t.equipment.emptyTitle}
      description={t.equipment.emptyDescription}
    />
  );

  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.equipment.loading}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <div
        className="wide-table collection-channel-table collection-channel-equipment-table"
        {...rowPickHandlers}
      >
        <Table
          density="compact"
          caption={
            <span className="collection-channel-table-caption">{t.equipment.paneTitle}</span>
          }
          columns={columns}
          rows={items}
          getRowId={(row) => String(row.equipmentId)}
          empty={emptySlot}
        />
      </div>
    );
  };

  const truncated = total !== null && total > items.length;

  const plantSelect = plantSelectOf(plant, draft.plantId, [
    { value: '', label: t.equipment.plantAll },
    ...plantOptions,
  ]);

  const filter = (
    <div className="filter-bar">
      <SearchInput
        label={t.equipment.searchLabel}
        placeholder={t.equipment.searchPlaceholder}
        value={draft.q}
        onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
        onSearch={(value) => applyDraft({ q: value })}
        clearLabel={messages.common.clear}
      />
      {plantSelect !== null && (
        <SelectField
          label={t.fields.plant}
          options={plantSelect.options}
          value={plantSelect.value}
          onChange={(value) => setDraft((prev) => ({ ...prev, plantId: value }))}
        />
      )}
      {/* 규범 2-1 — 뜻이 짝인 액션이 줄바꿈으로 갈라지지 않게 한 덩어리로 묶는다. */}
      <div className="field-cell field-cell-unlabeled">
        <div className="filter-actions">
          <Button onClick={() => applyDraft()}>{messages.common.search}</Button>
          {/* 「초기화」는 편집 중이거나 적용된 조건이 처음 값과 다를 때만 보인다(C-6). */}
          {hasChangedFilters(defaultEquipmentFilters, draft, appliedFilters) && (
            <Button variant="outlined" onClick={resetAll}>
              {messages.common.reset}
            </Button>
          )}
        </div>
      </div>
    </div>
  );

  /* 조건 칩을 두지 않는다 — 조건 둘이 모두 조회 줄에 보인다(C-6, 보이는 칸은 칩으로 겹쳐 적지 않는다). */
  const list = (
    <>
      {/* 잘림은 목록 «위»에 둔다 — 아래에 두면 찾는 설비가 없다고 판단한 뒤에야 읽힌다. */}
      {truncated && total !== null && (
        <p className="field-note collection-channel-truncated" role="status">
          {t.equipment.truncated(items.length, total)}
        </p>
      )}
      {listSlot()}
    </>
  );

  return { filter, list };
};

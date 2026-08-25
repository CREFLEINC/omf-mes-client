import {
  Button,
  Checkbox,
  type Column,
  EmptyState,
  SearchInput,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState, type ReactNode } from 'react';

import type { CodeOption } from './code-options';
import { SelectField } from './select-field';
import type { EquipmentInspectionItem, InspectionItemFilters } from './types';

const t = messages.equipmentMaster.inspectionItem;
const tv = messages.equipmentMaster.values;

export interface InspectionItemPaneProps {
  items: EquipmentInspectionItem[];
  isLoading: boolean;
  appliedFilters: InspectionItemFilters;
  onApplyFilters: (next: InspectionItemFilters) => void;
  typeOptions: CodeOption[];
  methodOptions: CodeOption[];
  onAdd: () => void;
  onEdit: (item: EquipmentInspectionItem) => void;
  loadError: ReactNode;
}

/** 조건에 값이 하나라도 걸려 있는가 — 빈 상태 문구를 가르는 기준이다. */
const hasAnyFilter = (filters: InspectionItemFilters): boolean =>
  filters.q !== '' || filters.inspectionTypeCode !== '' || filters.includeInactive;

/**
 * 점검 항목 **마스터** 목록.
 *
 * ⭐ **여기가 만드는 자리다**(설계 회신 `omf-mes#220` · 스펙 §5-1-1). 부여 창은 이 목록에서
 * **고르기만** 한다 — 창 안에 창을 만들지 않는다(공유계약 B-6 의 화면 판).
 *
 * ⭐ **부여 창이 쓰는 목록과 다르다.** 그쪽은 「고를 것」이라 살아 있는 것만 받지만, 여기는
 * 마스터라 **끈 것도 보여야 한다** — 다시 켜는 길이 여기뿐이다(B-4).
 */
export const InspectionItemPane = ({
  items,
  isLoading,
  appliedFilters,
  onApplyFilters,
  typeOptions,
  methodOptions,
  onAdd,
  onEdit,
  loadError,
}: InspectionItemPaneProps) => {
  /* 편집은 모아서 적용하고 해제는 즉시 — 형제 목록들과 같은 방아쇠 규약이다. */
  const [draft, setDraft] = useState<InspectionItemFilters>(appliedFilters);

  const applyDraft = (patch: Partial<InspectionItemFilters> = {}): void => {
    const next = { ...draft, ...patch };

    setDraft(next);
    onApplyFilters(next);
  };

  /** 코드값의 이름. ⛔ 모르면 지어내지 않고 코드를 그대로 쓴다(G-9). */
  const labelOf = (options: CodeOption[], code: string): string =>
    options.find((option) => option.value === code)?.label ?? code;

  const columns: Column<EquipmentInspectionItem>[] = [
    {
      key: 'itemCode',
      header: t.fields.itemCode,
      width: '140px',
      /* 이름이 곧 여는 손잡이다 — 줄마다 「수정」 단추를 세우면 표가 조작으로 덮인다. */
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          onClick={() => onEdit(row)}
          aria-label={t.openLabel(row.itemCode, row.itemName)}
        >
          {row.itemCode}
        </button>
      ),
    },
    { key: 'itemName', header: t.fields.itemName },
    {
      key: 'inspectionTypeCode',
      header: t.fields.inspectionType,
      width: '104px',
      render: (row) => labelOf(typeOptions, row.inspectionTypeCode),
    },
    {
      key: 'judgmentMethodCode',
      header: t.fields.judgmentMethod,
      width: '104px',
      render: (row) => labelOf(methodOptions, row.judgmentMethodCode),
    },
    {
      key: 'requiredFlag',
      header: t.fields.requiredFlag,
      width: '84px',
      render: (row) => (row.requiredFlag ? t.values.requiredYes : t.values.requiredNo),
    },
    {
      key: 'sequenceNo',
      header: t.fields.sequenceNo,
      width: '92px',
      render: (row) => String(row.sequenceNo),
    },
    {
      key: 'isActive',
      header: t.fields.isActive,
      width: '84px',
      render: (row) => (row.isActive ? tv.active : tv.inactive),
    },
  ];

  const emptySlot = hasAnyFilter(appliedFilters) ? (
    <EmptyState size="sm" live title={t.noMatchTitle} description={t.noMatchDescription} />
  ) : (
    <EmptyState size="sm" live title={t.emptyTitle} description={t.emptyDescription} />
  );

  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading}>
          <SkeletonText lines={4} />
        </div>
      );
    }

    return (
      <Table
        density="compact"
        columns={columns}
        rows={items}
        getRowId={(row) => String(row.equipmentInspectionItemId)}
        empty={emptySlot}
      />
    );
  };

  return (
    <section className="pane" aria-label={t.paneTitle}>
      <h3>{t.paneTitle}</h3>
      <p className="dialog-lead">{t.description}</p>

      <div className="filter-bar">
        <SearchInput
          label={t.searchLabel}
          placeholder={t.searchPlaceholder}
          value={draft.q}
          onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
          onSearch={(value) => applyDraft({ q: value })}
        />
        <SelectField
          label={t.fields.inspectionType}
          options={[{ value: '', label: t.typeAll }, ...typeOptions]}
          value={draft.inspectionTypeCode}
          onChange={(value) => applyDraft({ inspectionTypeCode: value })}
        />
        <div className="field-cell field-cell-unlabeled">
          {/* 해제 축이라 변경 즉시 적용한다. */}
          <Checkbox
            checked={draft.includeInactive}
            onChange={(event) => applyDraft({ includeInactive: event.target.checked })}
          >
            {messages.common.includeInactive}
          </Checkbox>
        </div>
        <Button className="field-cell-unlabeled" onClick={() => applyDraft()}>
          {messages.common.search}
        </Button>
        <Button className="field-cell-unlabeled" variant="outlined" onClick={onAdd}>
          {t.addAction}
        </Button>
      </div>

      {listSlot()}
    </section>
  );
};

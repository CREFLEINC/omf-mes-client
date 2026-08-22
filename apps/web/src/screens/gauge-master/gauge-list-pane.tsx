import {
  AlertBanner,
  Button,
  Checkbox,
  Chip,
  type Column,
  EmptyState,
  SearchInput,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useState } from 'react';

import { CalibrationBadge } from './calibration-badge';
import { judgeCalibration } from './calibration-status';
import {
  GAUGE_TYPE_OPTIONS,
  type CodeOption,
  codeLabel,
  defaultGaugeFilters,
  lookupLabel,
} from './code-options';
import { SelectField } from './select-field';
import type { Equipment, GaugeFilters } from './types';

export interface GaugeListPaneProps {
  items: Equipment[];
  isLoading: boolean;
  appliedFilters: GaugeFilters;
  onApplyFilters: (next: GaugeFilters) => void;
  plantOptions: CodeOption[];
  /** 공장 이름 풀이용 원본 — 좁힌 선택지가 아니라 전체에서 찾는다 */
  plantEntries: readonly { value: string; label: string }[];
  statusOptions: CodeOption[];
  /** 오늘. **인자로 받는다** — 화면이 시각을 읽으면 시험이 날짜에 흔들린다 */
  today: string;
  /**
   * 계측기 유형으로 거를 수 있는가. 거짓이면 전체 설비가 보이고 화면이 그 사실을 밝힌다.
   * ⚠ 값 목록이 아직 없다(설계 질의 `omf-mes#195`).
   */
  canFilterByType: boolean;
  /** 서버가 목록을 잘랐는가 — 밀림 조건이 무엇을 덮는지가 달라진다 */
  isTruncated: boolean;
  loadError: ReactNode;
}

const t = messages.gaugeMaster;

const hasAnyFilter = (filters: GaugeFilters): boolean =>
  filters.q !== '' ||
  filters.plantId !== '' ||
  filters.equipmentTypeCode !== '' ||
  filters.overdueOnly ||
  filters.includeInactive ||
  filters.includeDisposed;

/** 밀린 것 — 「아직 안 함」과 「만료」를 함께 잡는다. 둘 다 채워야 할 것이다. */
const isOverdue = (gauge: Equipment, today: string): boolean => {
  const { status } = judgeCalibration(gauge, today);

  return status === 'never' || status === 'expired';
};

export const GaugeListPane = ({
  items,
  isLoading,
  appliedFilters,
  onApplyFilters,
  plantOptions,
  plantEntries,
  statusOptions,
  today,
  canFilterByType,
  isTruncated,
  loadError,
}: GaugeListPaneProps) => {
  const [draft, setDraft] = useState<GaugeFilters>(appliedFilters);
  const { q: appliedQ, plantId: appliedPlantId, equipmentTypeCode: appliedType } = appliedFilters;

  useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      q: appliedQ,
      plantId: appliedPlantId,
      equipmentTypeCode: appliedType,
    }));
  }, [appliedQ, appliedPlantId, appliedType]);

  /*
   * ⚠ **밀림 조건은 화면이 건다** — 「아직 안 함」과 「만료」를 함께 잡는 질의 조건이 계약에
   * 없고, 「만료」는 애초에 저장된 값이 아니라 화면이 오늘과 견줘 판정하는 것이다(스펙 §5-2).
   */
  const visible = appliedFilters.overdueOnly
    ? items.filter((gauge) => isOverdue(gauge, today))
    : items;

  const columns: Column<Equipment>[] = [
    {
      key: 'equipmentCode',
      header: t.fields.gaugeCode,
    },
    { key: 'equipmentName', header: t.fields.gaugeName },
    {
      key: 'calibration',
      header: t.fields.calibration,
      render: (row) => <CalibrationBadge judgment={judgeCalibration(row, today)} />,
    },
    {
      key: 'statusCode',
      header: t.fields.status,
      render: (row) => codeLabel(row.statusCode, statusOptions),
    },
    {
      key: 'plantId',
      header: t.fields.plant,
      render: (row) => lookupLabel(plantEntries, String(row.plantId)),
    },
    {
      key: 'isActive',
      header: t.fields.isActive,
      render: (row) => (row.isActive ? t.values.active : t.values.inactive),
    },
  ];

  const emptySlot = hasAnyFilter(appliedFilters) ? (
    <EmptyState
      size="sm"
      live
      title={t.empty.noMatchTitle}
      description={t.empty.noMatchDescription}
      action={
        <Button variant="outlined" onClick={() => onApplyFilters(defaultGaugeFilters)}>
          {messages.common.reset}
        </Button>
      }
    />
  ) : (
    <EmptyState size="sm" live title={t.empty.noneTitle} description={t.empty.noneDescription} />
  );

  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.loading.gauges}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <Table
        density="compact"
        columns={columns}
        rows={visible}
        getRowId={(row) => String(row.equipmentId)}
        empty={emptySlot}
      />
    );
  };

  return (
    <section className="pane" aria-label={t.title}>
      {/*
       * ⚠ 지금 보이는 것이 계측기만은 아니라는 사실을 감추지 않는다(G-2).
       * 값 목록이 들어오면 이 배너는 저절로 사라진다.
       */}
      {!canFilterByType && <AlertBanner variant="warning">{t.typeFilterUnavailable}</AlertBanner>}

      <div className="filter-bar">
        <SearchInput
          label={t.filters.searchLabel}
          placeholder={t.filters.searchPlaceholder}
          value={draft.q}
          onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
          onSearch={(value) => onApplyFilters({ ...draft, q: value })}
        />
        <SelectField
          label={t.fields.plant}
          options={[{ value: '', label: t.filters.plantAll }, ...plantOptions]}
          value={draft.plantId}
          onChange={(value) => setDraft((prev) => ({ ...prev, plantId: value }))}
        />
        <SelectField
          label={t.fields.gaugeType}
          options={[{ value: '', label: t.filters.typeAll }, ...GAUGE_TYPE_OPTIONS]}
          value={draft.equipmentTypeCode}
          onChange={(value) => setDraft((prev) => ({ ...prev, equipmentTypeCode: value }))}
          note={messages.pendingCode.note}
        />
        {/* 해제 축이라 변경 즉시 적용한다. */}
        <div className="field-cell field-cell-unlabeled">
          <Checkbox
            checked={appliedFilters.overdueOnly}
            onChange={(event) =>
              onApplyFilters({ ...appliedFilters, overdueOnly: event.target.checked })
            }
          >
            {t.filters.overdueOnly}
          </Checkbox>
        </div>
        <div className="field-cell field-cell-unlabeled">
          <Checkbox
            checked={appliedFilters.includeInactive}
            onChange={(event) =>
              onApplyFilters({ ...appliedFilters, includeInactive: event.target.checked })
            }
          >
            {messages.common.includeInactive}
          </Checkbox>
        </div>
        <div className="field-cell field-cell-unlabeled">
          <Checkbox
            checked={appliedFilters.includeDisposed}
            onChange={(event) =>
              onApplyFilters({ ...appliedFilters, includeDisposed: event.target.checked })
            }
          >
            {t.filters.includeDisposed}
          </Checkbox>
        </div>
        <Button className="field-cell-unlabeled" onClick={() => onApplyFilters(draft)}>
          {messages.common.search}
        </Button>
        <Button
          className="field-cell-unlabeled"
          variant="outlined"
          onClick={() => onApplyFilters(defaultGaugeFilters)}
        >
          {messages.common.reset}
        </Button>
      </div>

      <div className="filter-bar">
        {appliedFilters.q !== '' && (
          <Chip
            variant="status"
            removeLabel={t.filters.chipRemoveKeyword}
            onRemove={() => onApplyFilters({ ...appliedFilters, q: '' })}
          >
            {t.filters.chipKeyword(appliedFilters.q)}
          </Chip>
        )}
        {appliedFilters.plantId !== '' && (
          <Chip
            variant="status"
            removeLabel={t.filters.chipRemovePlant}
            onRemove={() => onApplyFilters({ ...appliedFilters, plantId: '' })}
          >
            {t.filters.chipPlant(lookupLabel(plantEntries, appliedFilters.plantId))}
          </Chip>
        )}
        {appliedFilters.equipmentTypeCode !== '' && (
          <Chip
            variant="status"
            removeLabel={t.filters.chipRemoveType}
            onRemove={() => onApplyFilters({ ...appliedFilters, equipmentTypeCode: '' })}
          >
            {t.filters.chipType(appliedFilters.equipmentTypeCode)}
          </Chip>
        )}
        {appliedFilters.overdueOnly && (
          <Chip
            variant="status"
            removeLabel={t.filters.chipRemoveOverdue}
            onRemove={() => onApplyFilters({ ...appliedFilters, overdueOnly: false })}
          >
            {t.filters.overdueOnly}
          </Chip>
        )}
        {appliedFilters.includeInactive && (
          <Chip
            variant="status"
            removeLabel={t.filters.chipRemoveIncludeInactive}
            onRemove={() => onApplyFilters({ ...appliedFilters, includeInactive: false })}
          >
            {messages.common.includeInactive}
          </Chip>
        )}
        {appliedFilters.includeDisposed && (
          <Chip
            variant="status"
            removeLabel={t.filters.chipRemoveIncludeDisposed}
            onRemove={() => onApplyFilters({ ...appliedFilters, includeDisposed: false })}
          >
            {t.filters.includeDisposed}
          </Chip>
        )}
      </div>

      {/*
       * ⚠ **밀림 조건은 받아 온 것만 덮는다.** 서버가 목록을 잘랐는데 화면에서 거르면,
       * 잘려 나간 쪽의 밀린 계측기가 없는 것처럼 보인다 — 그 사실을 밝힌다.
       */}
      {appliedFilters.overdueOnly && isTruncated && (
        <AlertBanner variant="warning">{t.overdueOnLoadedOnly}</AlertBanner>
      )}

      {listSlot()}
    </section>
  );
};

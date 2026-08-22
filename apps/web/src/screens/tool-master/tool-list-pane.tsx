import {
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

import {
  SORT_OPTIONS,
  TOOL_TYPE_OPTIONS,
  type CodeOption,
  codeLabel,
  defaultToolFilters,
  lookupLabel,
  toToolSort,
} from './code-options';
import { PmBadge } from './pm-badge';
import { judgePm } from './pm-status';
import { SelectField } from './select-field';
import { availableShots, isOverUsed, shotUsage } from './shot-counts';
import { countText, figureText, ratioText } from './shot-text';
import type { Mold, ToolFilters } from './types';

export interface ToolListPaneProps {
  items: Mold[];
  isLoading: boolean;
  appliedFilters: ToolFilters;
  onApplyFilters: (next: ToolFilters) => void;
  plantOptions: CodeOption[];
  /** 공장 이름 풀이용 원본 — 좁힌 선택지가 아니라 전체에서 찾는다 */
  plantEntries: readonly { value: string; label: string }[];
  statusOptions: CodeOption[];
  onAdd: () => void;
  onEdit: (tool: Mold) => void;
  loadError: ReactNode;
}

const t = messages.toolMaster;

/**
 * 「조회」를 눌러야 나가는 조건. **체크칸과 정렬은 여기 없다** — 바꾸는 즉시 나간다.
 *
 * ⛔ **한 벌을 나눠 갖지 않는다.** 초안이 즉시 적용되는 조건까지 품으면, 체크칸을 켠 뒤
 * 「조회」를 누를 때 초안에 남아 있던 옛 값이 방금 켠 것을 조용히 되돌린다(client#314 에서
 * 실제로 났던 결함이다).
 */
interface DraftFilters {
  q: string;
  plantId: string;
  toolTypeCode: string;
}

const draftOf = (filters: ToolFilters): DraftFilters => ({
  q: filters.q,
  plantId: filters.plantId,
  toolTypeCode: filters.toolTypeCode,
});

/**
 * 조건이 하나라도 걸려 있는가. **정렬은 조건이 아니다** — 목록을 좁히지 않으므로
 * 「조건에 맞는 것이 없다」의 근거가 될 수 없다.
 */
const hasAnyFilter = (filters: ToolFilters): boolean =>
  filters.q !== '' ||
  filters.plantId !== '' ||
  filters.toolTypeCode !== '' ||
  filters.guaranteedShotCountMissing ||
  filters.pmDueOnly ||
  filters.includeInactive;

export const ToolListPane = ({
  items,
  isLoading,
  appliedFilters,
  onApplyFilters,
  plantOptions,
  plantEntries,
  statusOptions,
  onAdd,
  onEdit,
  loadError,
}: ToolListPaneProps) => {
  // 트리거 모델: 편집은 모아서 적용, 해제는 즉시.
  const [draft, setDraft] = useState<DraftFilters>(draftOf(appliedFilters));
  const { q: appliedQ, plantId: appliedPlantId, toolTypeCode: appliedType } = appliedFilters;

  /* 밖에서 조건이 되돌려지면(초기화·칩 제거) 초안도 그것을 따라간다. */
  useEffect(() => {
    setDraft({ q: appliedQ, plantId: appliedPlantId, toolTypeCode: appliedType });
  }, [appliedQ, appliedPlantId, appliedType]);

  /** 초안을 지금 적용된 조건 «위에» 얹는다 — 즉시 적용된 체크칸·정렬을 건드리지 않는다. */
  const applyDraft = (overrides: Partial<DraftFilters> = {}): void => {
    onApplyFilters({ ...appliedFilters, ...draft, ...overrides });
  };

  /*
   * ⛔ **초안을 손으로 거둔다 — 위 효과에 맡기지 않는다.**
   * 효과는 «적용된 값이 달라졌을 때»만 돈다. 적용된 검색어가 이미 비어 있는데 칸에만
   * 낱말이 남아 있으면 달라지는 값이 없어 효과가 돌지 않고, 칸이 그대로 남는다.
   * 그 상태로 「조회」를 누르면 초기화한 줄 알았던 조건이 되살아난다.
   */
  const resetAll = (): void => {
    setDraft(draftOf(defaultToolFilters));
    onApplyFilters(defaultToolFilters);
  };

  /**
   * 이름 칸. **미사용이면 표식을 붙인다** — 「미사용 포함」을 켜면 그 조건이 무엇을 데려왔는지
   * 알 수 있어야 하고, 칸을 하나 더 두면 표가 하한을 넘긴다(`docs/layout-conventions.md`).
   */
  const nameCell = (row: Mold): ReactNode =>
    row.isActive ? row.moldName : `${row.moldName}${t.values.inactiveSuffix}`;

  const usageCell = (row: Mold): ReactNode => {
    const figure = shotUsage(row);
    const text = figureText(figure, ratioText);

    return isOverUsed(figure) ? <span className="figure-alert">{text}</span> : text;
  };

  /**
   * 열 구성. **열을 줄이는 것이 먼저다**(`docs/layout-conventions.md`) — 계약의 `Mold` 에는
   * 필드가 열아홉 있으나 목록에는 일곱만 두고 나머지는 상세로 보낸다.
   *
   * ⭐ 누계 타발수·적정타수는 **사용 가능 타수와 초과율이 같은 사실을 담는다.**
   * ⭐ 공장은 **거르는 축으로 남기고** 칸은 두지 않는다 — 조회 조건과 칩이 그 값을 말한다.
   * ⭐ 사용 여부는 칸이 아니라 **이름에 붙는 표식**이다(아래 `nameCell`).
   *
   * 지정 폭 합 750px — 최소 폭 58rem(928px) 안에 들어가며 178px 이 툴명의 하한이 된다.
   */
  const columns: Column<Mold>[] = [
    {
      key: 'moldCode',
      header: t.fields.toolCode,
      width: '148px',
      /* 코드가 곧 여는 손잡이다 — 줄마다 「수정」 단추를 세우면 표가 조작으로 덮인다. */
      render: (row) => (
        <button type="button" className="link-cell" onClick={() => onEdit(row)}>
          {row.moldCode}
        </button>
      ),
    },
    { key: 'moldName', header: t.fields.toolName, render: nameCell },
    {
      key: 'toolTypeCode',
      header: t.fields.toolType,
      width: '104px',
      /* ⚠ 값 목록이 없어 지금은 코드가 그대로 선다 — 이름을 지어내지 않는다(G-9). */
      render: (row) => codeLabel(row.toolTypeCode, TOOL_TYPE_OPTIONS),
    },
    {
      key: 'pm',
      header: t.fields.pm,
      width: '126px',
      /* ⭐ 판정은 서버가 한다 — 화면은 받은 값을 그리기만 한다. */
      render: (row) => <PmBadge judgment={judgePm(row)} />,
    },
    {
      key: 'availableShotCount',
      header: t.fields.availableShotCount,
      align: 'end',
      width: '130px',
      render: (row) => figureText(availableShots(row), countText),
    },
    {
      key: 'shotUsageRatio',
      header: t.fields.shotUsageRatio,
      align: 'end',
      width: '130px',
      render: usageCell,
    },
    {
      key: 'statusCode',
      header: t.fields.status,
      width: '112px',
      render: (row) => codeLabel(row.statusCode, statusOptions),
    },
  ];

  const emptySlot = hasAnyFilter(appliedFilters) ? (
    <EmptyState
      size="sm"
      live
      title={t.empty.noMatchTitle}
      description={t.empty.noMatchDescription}
      action={
        <Button variant="outlined" onClick={resetAll}>
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
        <div role="status" aria-label={t.loading.tools}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    /*
     * 열이 많은 표 — 폭이 모자랄 때 내용을 짓누르는 대신 가로로 넘긴다.
     * 스크롤 상자는 디자인 시스템 `Table` 이 이미 갖고 있어 우리가 만들지 않는다.
     */
    return (
      <div className="wide-table">
        <Table
          density="compact"
          columns={columns}
          rows={items}
          getRowId={(row) => String(row.moldId)}
          empty={emptySlot}
        />
      </div>
    );
  };

  return (
    <section className="pane" aria-label={t.title}>
      <div className="filter-bar">
        <SearchInput
          label={t.filters.searchLabel}
          placeholder={t.filters.searchPlaceholder}
          value={draft.q}
          onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
          onSearch={(value) => applyDraft({ q: value })}
        />
        <SelectField
          label={t.fields.plant}
          options={[{ value: '', label: t.filters.plantAll }, ...plantOptions]}
          value={draft.plantId}
          onChange={(value) => setDraft((prev) => ({ ...prev, plantId: value }))}
        />
        <SelectField
          label={t.fields.toolType}
          options={[{ value: '', label: t.filters.typeAll }, ...TOOL_TYPE_OPTIONS]}
          value={draft.toolTypeCode}
          onChange={(value) => setDraft((prev) => ({ ...prev, toolTypeCode: value }))}
          note={messages.pendingCode.note}
        />
        {/* 정렬은 목록을 좁히지 않는다 — 모아서 적용할 이유가 없어 고르는 즉시 나간다. */}
        <SelectField
          label={t.filters.sortLabel}
          options={[...SORT_OPTIONS]}
          value={appliedFilters.sort}
          onChange={(value) => onApplyFilters({ ...appliedFilters, sort: toToolSort(value) })}
        />
        {/*
         * 해제 축이라 변경 즉시 적용한다. **셋을 한 덩어리로 묶는다** — 줄바꿈으로 갈라지면
         * 남은 체크칸이 무엇에 딸린 것인지 읽히지 않는다(규범 2-1 과 같은 갈래 · 브라우저
         * 확인에서 실제로 하나만 앞줄에 남았다).
         */}
        <div className="field-cell field-cell-unlabeled">
          <div className="check-group">
            <Checkbox
              checked={appliedFilters.guaranteedShotCountMissing}
              onChange={(event) =>
                onApplyFilters({
                  ...appliedFilters,
                  guaranteedShotCountMissing: event.target.checked,
                })
              }
            >
              {t.filters.guaranteedMissingOnly}
            </Checkbox>
            <Checkbox
              checked={appliedFilters.pmDueOnly}
              onChange={(event) =>
                onApplyFilters({ ...appliedFilters, pmDueOnly: event.target.checked })
              }
            >
              {t.filters.pmDueOnly}
            </Checkbox>
            <Checkbox
              checked={appliedFilters.includeInactive}
              onChange={(event) =>
                onApplyFilters({ ...appliedFilters, includeInactive: event.target.checked })
              }
            >
              {messages.common.includeInactive}
            </Checkbox>
          </div>
        </div>
        {/* 규범 2-1 — 뜻이 짝인 액션이 줄바꿈으로 갈라지지 않게 한 덩어리로 묶는다. */}
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button onClick={() => applyDraft()}>{messages.common.search}</Button>
            <Button variant="outlined" onClick={resetAll}>
              {messages.common.reset}
            </Button>
            <Button variant="outlined" onClick={onAdd}>
              {t.actions.addTool}
            </Button>
          </div>
        </div>
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
        {appliedFilters.toolTypeCode !== '' && (
          <Chip
            variant="status"
            removeLabel={t.filters.chipRemoveType}
            onRemove={() => onApplyFilters({ ...appliedFilters, toolTypeCode: '' })}
          >
            {t.filters.chipType(codeLabel(appliedFilters.toolTypeCode, TOOL_TYPE_OPTIONS))}
          </Chip>
        )}
        {appliedFilters.guaranteedShotCountMissing && (
          <Chip
            variant="status"
            removeLabel={t.filters.chipRemoveGuaranteedMissing}
            onRemove={() =>
              onApplyFilters({ ...appliedFilters, guaranteedShotCountMissing: false })
            }
          >
            {t.filters.guaranteedMissingOnly}
          </Chip>
        )}
        {appliedFilters.pmDueOnly && (
          <Chip
            variant="status"
            removeLabel={t.filters.chipRemovePmDue}
            onRemove={() => onApplyFilters({ ...appliedFilters, pmDueOnly: false })}
          >
            {t.filters.pmDueOnly}
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
      </div>

      {listSlot()}
    </section>
  );
};

import {
  Button,
  Checkbox,
  Chip,
  type Column,
  EmptyState,
  Icon,
  SearchInput,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useId, useState } from 'react';

import type { LookupSource } from '../../patterns/lookup-display';
import {
  SORT_OPTIONS,
  type CodeOption,
  codeLabel,
  defaultToolFilters,
  lookupLabel,
  selectableOptions,
  toToolSort,
} from './code-options';
import { PmBadge } from './pm-badge';
import { judgePm } from './pm-status';
import { SelectField } from './select-field';
import { availableShots, isOverUsed, type ShotFigure, shotUsage } from './shot-counts';
import { countText, figureText, ratioText } from './shot-text';
import type { Mold, ToolFilters } from './types';

export interface ToolListPaneProps {
  items: Mold[];
  /** 서버가 센 전체 건수. 한 쪽에 다 담기지 않아도 이 값은 전체다 — 잘림 안내는 화면이 따로 한다 */
  total: number | null;
  isLoading: boolean;
  appliedFilters: ToolFilters;
  onApplyFilters: (next: ToolFilters) => void;
  plantOptions: CodeOption[];
  /** 공장 이름과 조회 상태 — 좁힌 선택지가 아니라 전체에서 찾는다 */
  plantSource: LookupSource;
  /** 도구 유형 — 서버 공통코드가 정본이다(omf-all-around#52). */
  typeSource: LookupSource;
  /** 유형 선택지의 한계 안내(값 없음·조회 실패). 없으면 붙이지 않는다 */
  typeNote?: string;
  statusOptions: CodeOption[];
  onAdd: () => void;
  onEdit: (tool: Mold) => void;
  onImport: () => void;
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
  total,
  isLoading,
  appliedFilters,
  onApplyFilters,
  plantOptions,
  plantSource,
  typeSource,
  typeNote,
  statusOptions,
  onAdd,
  onEdit,
  onImport,
  loadError,
}: ToolListPaneProps) => {
  /* 「추가 필터」 이름표가 체크칸 무리의 이름이 된다 — 상자 없이 묶는 자리라 이름으로 잇는다. */
  const extraLabelId = useId();
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

  /**
   * 수치 칸 하나. **값이 아니라 «값이 없는 사유»면 흐린 글자로** 세운다 — 실제 수치가 먼저 읽히게.
   * ⛔ 두 사유(적정타수 없음·산출 불가)를 한 말로 합치지 않는다 — 채우면 풀리는 것과 그렇지
   *    않은 것이라 할 일이 다르다(`figureText`).
   */
  const figureCell = (figure: ShotFigure, format: (value: number) => string): ReactNode => {
    const text = figureText(figure, format);

    return figure.kind === 'value' ? (
      text
    ) : (
      <span className="tool-master-figure-missing">{text}</span>
    );
  };

  const usageCell = (row: Mold): ReactNode => {
    const figure = shotUsage(row);

    return isOverUsed(figure) ? (
      <span className="figure-alert">{figureText(figure, ratioText)}</span>
    ) : (
      figureCell(figure, ratioText)
    );
  };

  /**
   * 열 구성. **열을 줄이는 것이 먼저다**(`docs/layout-conventions.md`) — 계약의 `Mold` 에는
   * 필드가 열아홉 있으나 목록에는 일곱만 두고 나머지는 상세로 보낸다.
   *
   * ⭐ 누계 타발수·적정타수는 **사용 가능 타수와 초과율이 같은 사실을 담는다.**
   * ⭐ 공장은 **거르는 축으로 남기고** 칸은 두지 않는다 — 조회 조건과 칩이 그 값을 말한다.
   * ⭐ 사용 여부는 칸이 아니라 **이름에 붙는 표식**이다(아래 `nameCell`).
   *
   * ⭐ **사용자 지정 배치(2026-09-22) — 다음 작업자가 되돌리지 않는다.** 모든 칸을 가운데 정렬하고,
   *   폭을 백분율로 나눠 툴명이 표를 독차지하지 않게 한다(합 100%). 툴명이 남는 폭을 다 받으면
   *   넓은 화면에서 툴명과 나머지 칸 사이가 크게 벌어져 한 줄로 읽히지 않았다(실측 캡처).
   *   툴명은 값이 길어 조금 더 받되 다른 칸과 크게 차이 나지 않게 둔다.
   */
  const columns: Column<Mold>[] = [
    {
      key: 'moldCode',
      header: t.fields.toolCode,
      align: 'center',
      width: '14%',
      /* 코드가 곧 여는 손잡이다 — 줄마다 「수정」 단추를 세우면 표가 조작으로 덮인다. */
      render: (row) => (
        <button type="button" className="link-cell" onClick={() => onEdit(row)}>
          {row.moldCode}
        </button>
      ),
    },
    { key: 'moldName', header: t.fields.toolName, align: 'center', width: '18%', render: nameCell },
    {
      key: 'toolTypeCode',
      header: t.fields.toolType,
      align: 'center',
      width: '12%',
      /*
       * 이름표는 사용 중지된 코드도 푼다 — 안 그러면 옛 자료의 유형이 코드로 보인다.
       * ⛔ 못 찾으면 **코드를 그대로** 보인다(G-9) — 「알 수 없음」으로 덮으면 무엇이 걸려
       *    있는지조차 사라져 고칠 값을 못 찾는다.
       */
      render: (row) => codeLabel(row.toolTypeCode, typeSource.entries),
    },
    {
      key: 'pm',
      header: t.fields.pm,
      align: 'center',
      width: '14%',
      /* ⭐ 판정은 서버가 한다 — 화면은 받은 값을 그리기만 한다. */
      render: (row) => <PmBadge judgment={judgePm(row)} />,
    },
    {
      key: 'availableShotCount',
      header: t.fields.availableShotCount,
      align: 'center',
      width: '15%',
      render: (row) => figureCell(availableShots(row), countText),
    },
    {
      key: 'shotUsageRatio',
      header: t.fields.shotUsageRatio,
      align: 'center',
      width: '13%',
      render: usageCell,
    },
    {
      key: 'statusCode',
      header: t.fields.status,
      align: 'center',
      width: '14%',
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
      <div className="wide-table tool-master-table">
        <Table
          density="compact"
          caption={<span className="tool-master-table-caption">{t.paneTitle}</span>}
          columns={columns}
          rows={items}
          getRowId={(row) => String(row.moldId)}
          empty={emptySlot}
        />
      </div>
    );
  };

  return (
    <section className="pane tool-master-pane" aria-label={t.paneTitle}>
      {/*
       * ⭐ **관리 액션은 제목 줄 오른쪽에 둔다.** 등록·올리기는 조회 조건이 아니라 자료를 만드는
       *   일이다 — 조회·초기화와 한 줄에 섞이면 「무엇을 누르면 목록이 바뀌는가」가 흐려진다.
       *   본문은 찾는 자리, 제목 줄 오른쪽은 만드는 자리로 갈라 읽히게 한다.
       */}
      <div className="pane-heading-row tool-master-heading">
        <h2 className="pane-title">{t.paneTitle}</h2>
        <div className="tool-master-manage-actions">
          {/*
           * ⭐ **사용자 지정(2026-09-22) — 되돌리지 않는다.** 두 관리 액션의 무게를 가른다.
           *   「툴 생성」은 이 화면의 주 액션이라 채움 + 더하기 표식, 「엑셀 업로드」는 일괄 등록이라
           *   외곽선 + 올리기 표식. 둘이 같은 채움이면 무엇이 먼저인지 읽히지 않았다(실측 캡처).
           * 차례는 생성이 먼저다 — 형제 화면(검사 기준 목록)의 「추가 → 엑셀」 차례와 맞춘다.
           */}
          <Button leadingIcon={<Icon name="add" size={18} />} onClick={onAdd}>
            {t.actions.addTool}
          </Button>
          <Button
            variant="outlined"
            leadingIcon={<Icon name="upload" size={18} />}
            onClick={onImport}
          >
            {t.actions.importTools}
          </Button>
        </div>
      </div>
      <div className="filter-bar tool-master-filter">
        <SearchInput
          label={t.filters.searchLabel}
          placeholder={t.filters.searchPlaceholder}
          value={draft.q}
          onChange={(event) => setDraft((prev) => ({ ...prev, q: event.target.value }))}
          onSearch={(value) => applyDraft({ q: value })}
          clearLabel={messages.common.clear}
        />
        <SelectField
          label={t.fields.plant}
          options={[{ value: '', label: t.filters.plantAll }, ...plantOptions]}
          value={draft.plantId}
          onChange={(value) => setDraft((prev) => ({ ...prev, plantId: value }))}
        />
        <SelectField
          label={t.fields.toolType}
          options={[
            { value: '', label: t.filters.typeAll },
            ...selectableOptions(typeSource, draft.toolTypeCode),
          ]}
          value={draft.toolTypeCode}
          onChange={(value) => setDraft((prev) => ({ ...prev, toolTypeCode: value }))}
        />
        {/* 정렬은 목록을 좁히지 않는다 — 모아서 적용할 이유가 없어 고르는 즉시 나간다. */}
        <SelectField
          label={t.filters.sortLabel}
          options={[...SORT_OPTIONS]}
          value={appliedFilters.sort}
          onChange={(value) => onApplyFilters({ ...appliedFilters, sort: toToolSort(value) })}
        />
        {/*
         * ⭐ 조회·초기화는 **조건 칸과 같은 줄 끝**에 둔다 — 조건을 고른 손이 바로 닿는 자리이고,
         *   줄 반대편 끝으로 멀어지면 한 조회 영역으로 읽히지 않는다.
         *   규범 2-1 — 뜻이 짝인 두 액션이 줄바꿈으로 갈라지지 않게 한 덩어리로 묶는다.
         */}
        <div className="filter-actions tool-master-search-actions">
          <Button onClick={() => applyDraft()}>{messages.common.search}</Button>
          <Button variant="outlined" onClick={resetAll}>
            {messages.common.reset}
          </Button>
        </div>
      </div>

      {/*
       * ⭐ **2행 — 추가 필터 · 건수**(사용자 지정 2026-09-22 · 되돌리지 않는다). 체크칸이 검색칸 바로
       *   밑에 붙어 있으면 검색의 일부인지 따로인지 애매했다. 「기본 조건 → 추가 필터 → 결과」가 한눈에
       *   갈리도록 조건 격자에서 떼어 제 줄을 주고, 건수는 이 줄 오른쪽 끝에 둔다(바로 아래가 표다).
       * 해제 축이라 변경 즉시 적용한다. **셋을 한 덩어리로 묶는다** — 줄바꿈으로 갈라지면 남은 체크칸이
       * 무엇에 딸린 것인지 읽히지 않는다(규범 2-1). 상자는 두지 않고 이름표로만 묶는다.
       */}
      <div className="tool-master-extra-row">
        <span id={extraLabelId} className="tool-master-extra-label">
          {t.filters.extraLabel}
        </span>
        <div className="check-group" role="group" aria-labelledby={extraLabelId}>
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
        {/*
         * ⭐ 유형 안내는 **조건 칸 밑이 아니라 이 줄에** 한 줄로 둔다 — 칸 밑에 붙으면 그 칸만 키가
         *   커져 조회 줄의 입력 상자 높이가 어긋난다. 값이 있을 때는 아예 서지 않는다.
         */}
        {typeNote !== undefined && <p className="tool-master-type-note">{typeNote}</p>}
        {/*
         * ⭐ 건수는 **서버가 센 전체**다 — 한 쪽에 다 담기지 않아도 받은 줄 수로 세지 않는다. 잘렸는지는
         *   화면 위 안내가 따로 말한다. 불러오는 중·실패일 때는 셀 수 없으니 세우지 않는다.
         *   글자 결은 목록 건수 선례와 같은 `field-note`, 숫자는 천 단위 쉼표.
         */}
        {!isLoading && (loadError === null || loadError === undefined) && total !== null && (
          <p className="field-note tool-master-result-count" aria-live="polite">
            {t.resultTotal(new Intl.NumberFormat('ko-KR').format(total))}
          </p>
        )}
      </div>

      <div className="filter-bar tool-master-filter-chips">
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
            {t.filters.chipPlant(lookupLabel(plantSource, appliedFilters.plantId))}
          </Chip>
        )}
        {appliedFilters.toolTypeCode !== '' && (
          <Chip
            variant="status"
            removeLabel={t.filters.chipRemoveType}
            onRemove={() => onApplyFilters({ ...appliedFilters, toolTypeCode: '' })}
          >
            {t.filters.chipType(lookupLabel(typeSource, appliedFilters.toolTypeCode))}
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

import {
  AlertBanner,
  Button,
  Chip,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { type ReactNode, useEffect, useState } from 'react';

import { defaultPolicyFilters } from './options';
import { formulaText, isEnded, periodText, scopeText, type ScopeLookups } from './scope';
import type { OperationPolicy, PolicyFilters } from './types';

const t = messages.shotConversion;

export interface RatioListPaneProps {
  items: OperationPolicy[];
  isLoading: boolean;
  /** 전체 건수. 받은 것보다 크면 목록이 잘린 것이다 */
  total: number | null;
  appliedFilters: PolicyFilters;
  onApplyFilters: (next: PolicyFilters) => void;
  lookups: ScopeLookups;
  /** 종료 여부를 재는 기준. **밖에서 받는다** — 안에서 읽으면 시험이 붙들 수 없다 */
  today: string;
  onAdd: () => void;
  onEdit: (policy: OperationPolicy) => void;
  loadError: ReactNode;
}

/**
 * 비율 정책 표.
 *
 * ⛔ **여기서 「무엇이 이기는가」를 판정하지 않는다** — 그 답은 서버가 준다. 표는 **어떤
 * 정책들이 있는가**를 보이고, 겹칠 때의 규칙을 곁에 적어 둔다.
 */
export const RatioListPane = ({
  items,
  isLoading,
  total,
  appliedFilters,
  onApplyFilters,
  lookups,
  today,
  onAdd,
  onEdit,
  loadError,
}: RatioListPaneProps) => {
  const [draft, setDraft] = useState<string>(appliedFilters.effectiveOn);
  const { effectiveOn: appliedEffectiveOn } = appliedFilters;

  /* 밖에서 조건이 되돌려지면(초기화) 초안도 그것을 따라간다. */
  useEffect(() => {
    setDraft(appliedEffectiveOn);
  }, [appliedEffectiveOn]);

  /*
   * ⛔ **초안을 손으로 거둔다 — 위 효과에 맡기지 않는다.** 효과는 «적용된 값이 달라졌을 때»만
   * 돈다. 적용된 기준일이 이미 비어 있는데 칸에만 날짜가 남아 있으면 효과가 돌지 않아 칸이
   * 그대로 남고, 그 상태로 「조회」를 누르면 거둔 줄 알았던 조건이 되살아난다.
   */
  const resetAll = (): void => {
    setDraft(defaultPolicyFilters.effectiveOn);
    onApplyFilters(defaultPolicyFilters);
  };

  const columns: Column<OperationPolicy>[] = [
    {
      key: 'scope',
      header: t.fields.scope,
      /* 범위가 곧 여는 손잡이다 — 줄마다 단추를 세우면 표가 조작으로 덮인다. */
      render: (row) => (
        <button type="button" className="link-cell" onClick={() => onEdit(row)}>
          {scopeText(row, lookups)}
        </button>
      ),
    },
    {
      key: 'valueNumeric',
      header: t.fields.ratio,
      width: '92px',
      align: 'end',
      render: (row) => row.valueNumeric ?? t.fields.notRecorded,
    },
    {
      key: 'period',
      header: t.fields.period,
      width: '240px',
      /*
       * ⭐ **끝난 정책을 감추지 않고 표식을 붙인다** — 이 화면에는 지우는 길이 없어
       * 끝난 것이 곧 이력이다. 감추면 「왜 지금 값이 이것인지」를 되짚을 수 없다.
       *
       * ⛔ **표식을 «범위» 칸에 붙이지 않는다.** 범위는 축을 이어 만든 조립된 문장이고 값
       * 이름에 괄호가 들어갈 수 있어, 거기 붙이면 값 이름의 일부로 읽힌다. 끝났다는 것은
       * «기간»의 성질이다.
       */
      render: (row) => (
        <>
          {periodText(row)}
          {isEnded(row, today) && (
            <>
              {' '}
              <Chip variant="status" status="idle">
                {t.ratioList.ended}
              </Chip>
            </>
          )}
        </>
      ),
    },
    {
      key: 'formula',
      header: t.fields.formula,
      width: '128px',
      /* 값이 없으면 식을 지어내지 않는다 — 없다는 사실을 그대로 밝힌다(G-9). */
      render: (row) => formulaText(row) ?? t.fields.notRecorded,
    },
  ];

  const emptySlot =
    appliedFilters.effectiveOn === '' ? (
      <EmptyState
        size="sm"
        live
        title={t.ratioList.emptyTitle}
        description={t.ratioList.emptyDescription}
      />
    ) : (
      <EmptyState
        size="sm"
        live
        title={t.ratioList.noMatchTitle}
        description={t.ratioList.noMatchDescription}
        action={
          <Button variant="outlined" onClick={resetAll}>
            {messages.common.reset}
          </Button>
        }
      />
    );

  const listSlot = (): ReactNode => {
    if (loadError !== null && loadError !== undefined) return loadError;

    if (isLoading) {
      return (
        <div role="status" aria-label={t.ratioList.loading}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <Table
        density="compact"
        columns={columns}
        rows={items}
        getRowId={(row) => String(row.operationPolicyId)}
        empty={emptySlot}
      />
    );
  };

  const truncated = total !== null && total > items.length;

  return (
    <section className="pane" aria-label={t.ratioList.paneTitle}>
      <h3>{t.ratioList.paneTitle}</h3>

      <div className="filter-bar">
        <div className="field-cell">
          <TextField
            type="date"
            label={t.ratioList.effectiveOnLabel}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            helperText={t.ratioList.effectiveOnNote}
          />
        </div>
        {/* 규범 2-1 — 뜻이 짝인 액션이 줄바꿈으로 갈라지지 않게 한 덩어리로 묶는다. */}
        <div className="field-cell field-cell-unlabeled">
          <div className="filter-actions">
            <Button onClick={() => onApplyFilters({ effectiveOn: draft })}>
              {messages.common.search}
            </Button>
            <Button variant="outlined" onClick={resetAll}>
              {messages.common.reset}
            </Button>
            <Button variant="outlined" onClick={onAdd}>
              {t.actions.addPolicy}
            </Button>
          </div>
        </div>
      </div>

      {/*
       * ⭐ **겹치는 것이 정상이다** — 공장 기본 위에 품목 예외를 얹는 것이 이 표의 쓰임이다.
       * 규칙을 곁에 적지 않으면 사람마다 다르게 읽는다.
       */}
      <div className="banner-slot">
        <AlertBanner variant="info">
          <>
            <p>{t.ratioList.overlapNote}</p>
            <p>{t.ratioList.resolvedElsewhere}</p>
          </>
        </AlertBanner>
      </div>

      {truncated && total !== null && (
        <p className="field-note" role="status">
          {t.ratioList.listTruncated(items.length, total)}
        </p>
      )}

      {listSlot()}
    </section>
  );
};

import {
  AlertBanner,
  Checkbox,
  type Column,
  EmptyState,
  SkeletonText,
  Table,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import type { DisposalTarget } from './types';

const t = messages.productDisposalRequest;

export interface TargetListProps {
  rows: DisposalTarget[];
  selected: readonly number[];
  isLoading: boolean;
  error: ReactNode;
  items: LookupSource;
  uoms: LookupSource;
  onToggle: (dispositionDecisionId: number) => void;
  onToggleAll: () => void;
}

/**
 * ① 폐기 대상 — **후속 처리가 남은 처분 결정.**
 *
 * ⚠ **「폐기만」으로 좁히지 못한다**(G-2). 그래서 **처분을 열로 보여 사람이 가리게 하고** 그
 * 사실을 목록 머리에 적는다 — 감추면 재작업 판정 건을 폐기로 올린다.
 *
 * ⛔ 처분 유형은 **날코드 그대로** 보인다. 값 목록이 없어 이름을 붙일 수 없고, 지어내면 사용자가
 * 그 이름을 믿는다.
 */
export const TargetList = ({
  rows,
  selected,
  isLoading,
  error,
  items,
  uoms,
  onToggle,
  onToggleAll,
}: TargetListProps) => {
  const chosen = new Set(selected);

  const columns: Column<DisposalTarget>[] = [
    {
      key: 'select',
      header: (
        <Checkbox
          aria-label={t.targets.selectAll}
          checked={rows.length > 0 && rows.every((row) => chosen.has(row.dispositionDecisionId))}
          onChange={onToggleAll}
        />
      ),
      render: (row) => (
        <Checkbox
          aria-label={t.targets.selectRow(row.lotNo ?? String(row.dispositionDecisionId))}
          checked={chosen.has(row.dispositionDecisionId)}
          onChange={() => onToggle(row.dispositionDecisionId)}
        />
      ),
    },
    {
      key: 'lotNo',
      header: t.targets.fields.lotNo,
      /* ⚠ 못 받은 값을 빈칸으로 두지 않는다 — 「없는 LOT」으로 읽힌다(G-9). */
      render: (row) => row.lotNo ?? messages.common.reference.unknown,
    },
    {
      key: 'item',
      header: t.targets.fields.item,
      render: (row) =>
        row.itemId === null
          ? messages.common.reference.unknown
          : lookupDisplayLabel(items, row.itemId),
    },
    {
      key: 'qty',
      header: t.targets.fields.qty,
      align: 'end',
      render: (row) => `${String(row.decisionQty)} ${lookupDisplayLabel(uoms, row.uomId)}`,
    },
    {
      key: 'nonconformanceNo',
      header: t.targets.fields.nonconformanceNo,
      render: (row) => row.nonconformanceNo ?? messages.common.reference.unknown,
    },
    {
      /* ⭐ 이 열이 「폐기인가」를 사람이 가리는 자리다 — 화면이 못 거르므로 반드시 보인다. */
      key: 'disposition',
      header: t.targets.fields.disposition,
      render: (row) => row.dispositionTypeCode,
    },
    { key: 'decidedAt', header: t.targets.fields.decidedAt, render: (row) => row.decidedAt },
    { key: 'decidedBy', header: t.targets.fields.decidedBy, render: (row) => row.decidedBy },
  ];

  if (error !== null && error !== undefined) return error;

  if (isLoading) {
    return (
      <div role="status" aria-label={t.targets.loading}>
        <SkeletonText lines={4} />
      </div>
    );
  }

  return (
    <>
      {/*
       * A-11 — 좁히지 못한다는 사실과 판정이 선행이라는 사실을 «둘 다» 적는다. 앞은 지금 보이는
       * 것에 대한 말이고, 뒤는 안 보이는 것에 대한 말이다.
       */}
      <div className="banner-slot">
        <AlertBanner variant="warning">{t.targets.cannotNarrow}</AlertBanner>
      </div>
      <div className="banner-slot">
        <AlertBanner variant="info">{t.targets.judgmentRequired}</AlertBanner>
      </div>
      <Table
        density="compact"
        columns={columns}
        rows={rows}
        getRowId={(row) => String(row.dispositionDecisionId)}
        empty={
          <EmptyState
            size="sm"
            live
            title={t.targets.empty}
            description={t.targets.emptyDescription}
          />
        }
      />
    </>
  );
};

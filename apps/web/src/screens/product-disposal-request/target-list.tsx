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

/**
 * 처분 유형의 표시명.
 *
 * ⚠ **모르는 값이 오면 그 값을 그대로 보인다** — 지어낸 이름을 붙이면 사용자가 그것을 믿는다.
 * 계약이 셋으로 닫았지만 값이 «늘어나는» 것은 파괴 변경이 아니라서(등급 ⚠) 올 수 있다.
 */
const dispositionLabel = (code: string): string =>
  code in t.targets.disposition
    ? t.targets.disposition[code as keyof typeof t.targets.disposition]
    : code;

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
 * ⭐ **질의가 「폐기」로 좁힌다**(통지 `#674`) — 한때 못 좁혀 사람이 열을 보고 가리게 했다.
 *
 * ⭐ **그래도 처분 열은 남긴다.** 좁혀진 목록이라도 **무엇으로 판정된 것인지**는 보여야
 * 사용자가 「이게 왜 여기 있나」를 스스로 확인한다. 값이 `enum` 으로 닫혔으므로 표시명을
 * 붙인다 — 날코드를 그대로 내보이던 자리다.
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
      /* ⭐ 질의가 좁혀 주지만 «무엇으로 판정된 것인지»는 보인다 — 값이 닫혔으니 표시명을 붙인다. */
      key: 'disposition',
      header: t.targets.fields.disposition,
      render: (row) => dispositionLabel(row.dispositionTypeCode),
    },
    { key: 'decidedAt', header: t.targets.fields.decidedAt, render: (row) => row.decidedAt },
    {
      key: 'decidedBy',
      header: t.targets.fields.decidedBy,
      /* ⚠ `decidedBy` 는 식별자다 — 사람 이름은 계약이 따로 준다. 못 받았으면 그 사실을 적는다. */
      render: (row) => row.decidedByName ?? messages.common.reference.unknown,
    },
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
      {/* §5-2 — 판정이 선행이라는 사실을 적는다. 목록에 없는 것에 대한 말이라 목록 위에 선다. */}
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

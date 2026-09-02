import { Chip, type Column, EmptyState, Table } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import { formatHeldAt } from './as-of';
import type { LotHoldView } from './types';

const t = messages.productStockStatus;

/**
 * 열 폭 예산. **모든 열이 폭을 지정한다** — 이유는 `balance-table.tsx`와 같다.
 *
 * 계획이 이 표의 열을 넷으로 좁혔다 — 사유·상태·보류 시각·해제 조건. 보류 수량·단위·비고는
 * 이 화면에 없다(`types.ts`가 이유를 적었다).
 */
const WIDTH = {
  reason: '160px',
  status: '120px',
  heldAt: '140px',
  releaseCondition: '240px',
} as const;

const orEmptyMark = (value: string | null): ReactNode => value ?? t.values.empty;

/** 값 목록이 확정되지 않은 코드의 배지. 중립 변형 하나로만 쓴다. */
const codeChip = (code: string): ReactNode => (
  <Chip variant="status" size="sm">
    {code}
  </Chip>
);

export const buildHoldColumns = (): Column<LotHoldView>[] => [
  {
    key: 'reasonCode',
    header: t.detail.holds.reason,
    width: WIDTH.reason,
    render: (hold) => codeChip(hold.reasonCode),
  },
  {
    key: 'statusCode',
    header: t.detail.holds.status,
    width: WIDTH.status,
    render: (hold) => codeChip(hold.statusCode),
  },
  {
    key: 'heldAt',
    header: t.detail.holds.heldAt,
    width: WIDTH.heldAt,
    render: (hold) => formatHeldAt(hold.heldAt),
  },
  {
    key: 'releaseCondition',
    header: t.detail.holds.releaseCondition,
    width: WIDTH.releaseCondition,
    render: (hold) => orEmptyMark(hold.releaseCondition),
  },
];

export interface LotHoldTableProps {
  /** 계약이 **해제되지 않은 것만** 내려 준다 — 화면이 걸러 내지 않는다. */
  holds: LotHoldView[];
}

/**
 * 해제되지 않은 보류 목록. **조회만 한다** — 보류를 걸고 푸는 수단이 없다. 등록·해제는
 * 품질 도메인 화면의 소관이다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const LotHoldTable = ({ holds }: LotHoldTableProps) => (
  <div className="wide-table">
    <Table
      density="compact"
      caption={t.detail.holds.title}
      columns={buildHoldColumns()}
      rows={holds}
      getRowId={(hold) => String(hold.lotHoldId)}
      empty={
        <EmptyState
          size="sm"
          live
          title={t.detail.holds.emptyTitle}
          description={t.detail.holds.emptyDescription}
        />
      }
    />
  </div>
);

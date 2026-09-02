import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { heldLotDetail, plainLotDetail } from './fixtures';
import { LotHoldTable } from './lot-hold-table';

const t = messages.productStockStatus;

describe('LotHoldTable', () => {
  it('보류가 없으면 빈 상태를 낸다', () => {
    render(<LotHoldTable holds={plainLotDetail.holds} />);

    expect(screen.getByText(t.detail.holds.emptyTitle)).toBeInTheDocument();
  });

  it('사유·상태·보류 시각·해제 조건 넷만 낸다', () => {
    render(<LotHoldTable holds={heldLotDetail.holds} />);

    expect(screen.getByText('SAMPLE_HOLD_R_A')).toBeInTheDocument();
    /* 두 보류 모두 같은 상태 코드다 — 배지가 행마다 하나씩, 둘이 렌더된다. */
    expect(screen.getAllByText('SAMPLE_HOLD_S_A')).toHaveLength(2);
  });

  it('보류 시각을 MM-DD HH:mm으로 줄인다', () => {
    render(<LotHoldTable holds={heldLotDetail.holds} />);

    expect(screen.getByText('08-06 09:12')).toBeInTheDocument();
  });

  it('해제 조건이 없으면 대시로 낸다', () => {
    render(<LotHoldTable holds={heldLotDetail.holds} />);

    expect(screen.getAllByText(t.values.empty).length).toBeGreaterThan(0);
  });

  it('등록자 번호(heldBy)를 표시하지 않는다 — 이름을 풀 참조가 없다', () => {
    render(<LotHoldTable holds={heldLotDetail.holds} />);

    expect(screen.queryByText('9001')).not.toBeInTheDocument();
  });
});

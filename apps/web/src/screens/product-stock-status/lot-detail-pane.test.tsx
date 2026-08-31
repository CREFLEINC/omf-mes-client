import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router';

import type { LookupSource } from '../../patterns/lookup-display';
import { balance, heldLotDetail, plainLotDetail } from './fixtures';
import { LotDetailPane } from './lot-detail-pane';

const t = messages.productStockStatus;

const LOT_SOURCE: LookupSource = {
  entries: [{ value: '9401', label: 'SAMPLE-LOT-0001', isActive: true }],
  isError: false,
  isLoading: false,
};

describe('LotDetailPane', () => {
  it('머리글에 고른 LOT 이름을 낸다', () => {
    render(
      <MemoryRouter>
        <LotDetailPane
          row={balance({ lotId: 9401 })}
          detail={heldLotDetail}
          lotLookup={LOT_SOURCE}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: t.detail.heading('SAMPLE-LOT-0001') }),
    ).toBeInTheDocument();
  });

  it('보류가 없으면 빈 상태를 낸다', () => {
    render(
      <MemoryRouter>
        <LotDetailPane
          row={balance({ lotId: 9401 })}
          detail={plainLotDetail}
          lotLookup={LOT_SOURCE}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText(t.detail.holds.emptyTitle)).toBeInTheDocument();
  });

  it('Lot Status 화면으로 가는 링크를 낸다', () => {
    render(
      <MemoryRouter>
        <LotDetailPane
          row={balance({ lotId: 9401 })}
          detail={heldLotDetail}
          lotLookup={LOT_SOURCE}
        />
      </MemoryRouter>,
    );

    const link = screen.getByRole('link', { name: t.actions.lotStatusLink });
    expect(link).toHaveAttribute('href', '/quality/lot-status-transition');
  });
});

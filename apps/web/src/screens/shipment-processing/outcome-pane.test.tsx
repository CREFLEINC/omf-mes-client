import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { OutcomePane } from './outcome-pane';

describe('OutcomePane', () => {
  it('재고 차감·genealogy 종결·미확정 상태 안내를 항상 낸다', () => {
    render(<OutcomePane />);

    expect(
      screen.getByText(
        '이 출하 내역의 LOT 배분만큼 재고가 즉시 차감되고, 그 LOT의 genealogy가 종결됩니다.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(/이 화면은 확정하지 않으며/)).toBeInTheDocument();
    expect(screen.getByText('되돌릴 수 없습니다.')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { TaskHeader } from './task-header';

const FIELDS = [
  { label: '품목', value: 'ABC-123', strong: true },
  { label: '품목명', value: '하우징 커버 A' },
  { label: '자재 P/O', value: 'PO-2026-000123' },
];

describe('작업 헤더', () => {
  it('처리 중인 값을 이름과 함께 묶어 보인다', () => {
    render(<TaskHeader fields={FIELDS} />);

    const header = screen.getByRole('group', { name: '처리 중인 작업' });

    expect(header).toHaveTextContent('ABC-123');
    expect(header).toHaveTextContent('PO-2026-000123');
    /* 이름은 화면에 그리지 않지만 낭독기는 읽는다. */
    expect(screen.getByText('품목명')).toBeInTheDocument();
  });

  /* 360dp 한 줄에 그 이상은 읽히지 않는다. 넘친 값은 「자세히」로 보낸다. */
  it('늘 보이는 값은 넷까지만 그린다', () => {
    render(
      <TaskHeader
        fields={[
          ...FIELDS,
          { label: '위치', value: 'A-01' },
          { label: '공급사', value: 'SUP-001' },
        ]}
      />,
    );

    expect(screen.getByRole('group', { name: '처리 중인 작업' })).not.toHaveTextContent('SUP-001');
  });

  it('진행을 몇 개 중 몇 개로 보인다', () => {
    render(<TaskHeader fields={FIELDS} progress={{ done: 2, total: 5 }} />);

    expect(screen.getByText('2/5 완료')).toBeInTheDocument();
  });

  it('나머지는 「자세히」로 펼치고 접는다', async () => {
    const user = userEvent.setup();
    render(<TaskHeader fields={FIELDS} details={<p>누적 입하 200</p>} />);

    expect(screen.getByText('누적 입하 200')).not.toBeVisible();

    await user.click(screen.getByRole('button', { name: '자세히' }));
    expect(screen.getByText('누적 입하 200')).toBeVisible();

    await user.click(screen.getByRole('button', { name: '접기' }));
    expect(screen.getByText('누적 입하 200')).not.toBeVisible();
  });

  it('펼칠 것이 없으면 「자세히」 단추를 두지 않는다', () => {
    render(<TaskHeader fields={FIELDS} />);

    expect(screen.queryByRole('button', { name: '자세히' })).toBeNull();
  });
});

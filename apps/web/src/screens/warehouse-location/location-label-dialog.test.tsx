import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { LocationLabelDialog } from './location-label-dialog';

const previews = [
  { documentIssueLogId: 7001, locationCode: 'A-01', issueSeq: 1 },
  { documentIssueLogId: 7002, locationCode: 'A-02', issueSeq: 2 },
];

describe('LocationLabelDialog', () => {
  it('다건 렌더링의 성공·실패·진행 중 건수를 집계하고 실패 건을 재시도한다', async () => {
    const user = userEvent.setup();
    render(<LocationLabelDialog previews={previews} baseUrl="http://api.test" onClose={vi.fn()} />);

    const first = screen.getByRole('img', { name: 'A-01 Location 라벨 1회차' });
    const second = screen.getByRole('img', { name: 'A-02 Location 라벨 2회차' });
    fireEvent.load(first);
    fireEvent.error(second);

    expect(screen.getByText('이미지 성공 1건 · 실패 1건 · 불러오는 중 0건')).toBeVisible();

    await user.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(screen.getByText('이미지 성공 1건 · 실패 0건 · 불러오는 중 1건')).toBeVisible();
    expect(screen.getByRole('img', { name: 'A-02 Location 라벨 2회차' })).toBeInTheDocument();
  });
});

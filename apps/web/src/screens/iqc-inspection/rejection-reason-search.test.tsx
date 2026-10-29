import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_REJECTION, RejectionReason } from './rejection-reason';

const t = messages.iqcInspection.result.rejection;
const codes = [
  { defectCodeId: 1, defectCode: 'A', defectName: '외관', isActive: true },
  {
    defectCodeId: 2,
    defectCode: 'A-1',
    defectName: '스크래치',
    parentDefectCodeId: 1,
    isActive: true,
  },
  { defectCodeId: 3, defectCode: 'B', defectName: '치수', isActive: true },
  { defectCodeId: 4, defectCode: 'C', defectName: '치수 옛 코드', isActive: false },
];

const renderReason = () => {
  const onChange = vi.fn();
  render(
    <RejectionReason
      codes={codes}
      causes={[]}
      draft={EMPTY_REJECTION}
      onChange={onChange}
      disabled={false}
    />,
  );
  return { onChange };
};

/** 불량 코드 칸은 검색도 되고 고르기도 된다(사용자 지시 2026-10-28 · #197). */
describe('RejectionReason 불량 코드 검색 · 선택', () => {
  it('칸을 열면 목록 맨 위에 검색 칸이 있고, 그대로 목록에서 골라도 된다', async () => {
    const { onChange } = renderReason();

    await userEvent.click(screen.getByLabelText(t.major));
    expect(screen.getByRole('searchbox', { name: t.search })).toHaveFocus();
    /* 사용 중지 코드 · 상세 코드는 대분류 목록에 없다. */
    expect(screen.getAllByRole('option')).toHaveLength(2);
    await userEvent.click(screen.getByRole('option', { name: 'B · 치수' }));

    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_REJECTION, majorId: '3', minorId: '' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('검색어로 목록을 좁히고 Enter 로 고른다', async () => {
    const { onChange } = renderReason();

    await userEvent.click(screen.getByLabelText(t.major));
    await userEvent.type(screen.getByRole('searchbox', { name: t.search }), '치수');
    const list = screen.getByRole('listbox');
    expect(within(list).getAllByRole('option')).toHaveLength(1);
    await userEvent.keyboard('{Enter}');

    expect(onChange).toHaveBeenLastCalledWith({ ...EMPTY_REJECTION, majorId: '3', minorId: '' });
  });

  it('맞는 코드가 없으면 그렇다고 말한다', async () => {
    renderReason();

    await userEvent.click(screen.getByLabelText(t.major));
    await userEvent.type(screen.getByRole('searchbox', { name: t.search }), '없는코드');

    expect(screen.getByText(t.searchEmpty)).toBeInTheDocument();
  });
});

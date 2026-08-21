import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pickRange } from '../../test/date-picker';
import { EMPTY_HISTORY_FILTERS } from './filters';
import { HistoryFilterBar, type HistoryFilterBarProps } from './history-filter-bar';

const baseProps = (): HistoryFilterBarProps => ({
  appliedFilters: { ...EMPTY_HISTORY_FILTERS, from: '2026-08-01', to: '2026-08-07' },
  actorOptions: [
    { value: '601', label: '합성 담당자' },
    { value: '602', label: '합성 퇴직자 (미사용)' },
  ],
  onSearch: vi.fn(),
  onReset: vi.fn(),
});

describe('HistoryFilterBar', () => {
  it('기간·행위자·LOT을 모아서 조회할 때만 올린다', async () => {
    const props = baseProps();
    render(<HistoryFilterBar {...props} />);
    const user = userEvent.setup();

    await pickRange(user, screen.getByLabelText('기간'), '2026-07-20', '2026-07-25');
    await user.click(screen.getByLabelText('행위자'));
    await user.click(screen.getByRole('option', { name: '합성 퇴직자 (미사용)' }));
    await user.type(screen.getByLabelText('LOT'), 'SAMPLE-LOT-001');
    expect(props.onSearch).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '조회' }));
    expect(props.onSearch).toHaveBeenCalledWith({
      from: '2026-07-20',
      to: '2026-07-25',
      actor: '602',
      lot: 'SAMPLE-LOT-001',
    });
    expect(screen.queryByText('602')).not.toBeInTheDocument();
  });

  it.each([
    [{ from: '', to: '' }, '기간을 모두 선택한 뒤 조회할 수 있습니다.'],
    [{ from: '2026-08-07', to: '2026-08-01' }, '기간 종료는 시작보다 앞설 수 없습니다.'],
    [{ from: '2026-02-30', to: '2026-03-01' }, '유효한 기간을 선택해 주세요.'],
  ])('유효하지 않은 기간 %o이면 조회를 막고 사유를 잇는다', (period, reason) => {
    render(
      <HistoryFilterBar
        {...baseProps()}
        appliedFilters={{ ...EMPTY_HISTORY_FILTERS, ...period }}
      />,
    );

    const search = screen.getByRole('button', { name: '조회' });
    expect(search).toBeDisabled();
    expect(
      document.getElementById(search.getAttribute('aria-describedby') ?? ''),
    ).toHaveTextContent(reason);
  });

  it('같은 의미의 새 적용값은 편집 중인 초안을 지우지 않는다', async () => {
    const props = baseProps();
    const { rerender } = render(<HistoryFilterBar {...props} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('LOT'), 'DRAFT');
    rerender(
      <HistoryFilterBar
        {...props}
        appliedFilters={{ ...props.appliedFilters }}
        actorOptions={[...props.actorOptions]}
      />,
    );

    expect(screen.getByLabelText('LOT')).toHaveValue('DRAFT');
  });

  it('바깥의 적용 의미값이 바뀌면 뒤로가기 값으로 동기화한다', () => {
    const props = baseProps();
    const { rerender } = render(<HistoryFilterBar {...props} />);

    rerender(
      <HistoryFilterBar
        {...props}
        appliedFilters={{ from: '2026-07-01', to: '2026-07-31', actor: '601', lot: 'BACK' }}
      />,
    );

    expect(screen.getByLabelText('기간')).toHaveTextContent('2026-07-01 ~ 2026-07-31');
    expect(screen.getByLabelText('행위자')).toHaveTextContent('합성 담당자');
    expect(screen.getByLabelText('LOT')).toHaveValue('BACK');
  });

  it('URL 행위자가 목록에 없어도 내부 번호 대신 이름 확인 실패를 표시한다', async () => {
    render(
      <HistoryFilterBar
        {...baseProps()}
        appliedFilters={{ ...baseProps().appliedFilters, actor: '999' }}
        actorNote="일부 행위자만 표시됩니다."
      />,
    );
    const user = userEvent.setup();

    expect(screen.getByText('일부 행위자만 표시됩니다.')).toBeVisible();
    expect(screen.queryByText('999')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('행위자'));
    expect(screen.getByRole('option', { name: '선택한 행위자 (이름 확인 불가)' })).toBeVisible();
  });

  it('초기화는 화면 소유 handler에 위임한다', async () => {
    const props = baseProps();
    render(<HistoryFilterBar {...props} />);

    await userEvent.setup().click(screen.getByRole('button', { name: '초기화' }));
    expect(props.onReset).toHaveBeenCalledOnce();
  });
});

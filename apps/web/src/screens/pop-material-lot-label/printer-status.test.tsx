import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PrinterStatusIndicator } from './printer-status';
import { toHeadPrinter, type PrinterStatus, type PrinterView } from './types';

const printer = (
  status: PrinterStatus,
  statusMessage: string | null = '대기 중',
  isDefault = true,
): PrinterView => ({
  printerName: 'syn-label-printer',
  displayName: '합성 라벨 프린터 가',
  status,
  statusMessage,
  isDefault,
});

type IndicatorProps = Parameters<typeof PrinterStatusIndicator>[0];

/**
 * ⛔ 프린터에 `??`를 쓰지 않는다 — `null`을 넘겨도 기본값으로 대체돼 「프린터 없음」을
 * 잴 수 없다. 실제로 그렇게 써서 검사가 조용히 통과했다.
 */
const renderIndicator = (props: Partial<IndicatorProps> = {}) => {
  const resolved: IndicatorProps = {
    printer: printer('READY'),
    isLoading: false,
    isError: false,
    onRetry: vi.fn(),
    ...props,
  };

  return render(<PrinterStatusIndicator {...resolved} />);
};

describe('PrinterStatusIndicator', () => {
  /** 사용자 지시 2026-09-14 — 「이 프린터로 나갑니다」 같은 설명을 머리줄에 붙이지 않는다. */
  it('프린터 이름만 보이고 상태 설명은 붙이지 않는다', () => {
    const { unmount } = renderIndicator({ printer: printer('READY', '이 프린터로 나갑니다') });

    expect(screen.getByText('프린터 합성 라벨 프린터 가')).toBeInTheDocument();
    expect(screen.queryByText(/이 프린터로 나갑니다/)).not.toBeInTheDocument();
    unmount();

    renderIndicator({ printer: printer('OFFLINE', null) });
    expect(screen.getByText('프린터 합성 라벨 프린터 가')).toBeInTheDocument();
  });

  it('프린터가 없는 것과 상태를 확인하지 못한 것을 다른 문구로 낸다', () => {
    const { unmount } = renderIndicator({ printer: null });
    expect(screen.getByText('사용할 수 있는 프린터가 없습니다.')).toBeInTheDocument();
    unmount();

    renderIndicator({ isError: true });
    expect(screen.getByText('프린터 상태를 확인할 수 없습니다.')).toBeInTheDocument();
    expect(screen.queryByText('사용할 수 있는 프린터가 없습니다.')).not.toBeInTheDocument();
  });

  it('확인하지 못했을 때 다시 시도할 길을 준다', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    renderIndicator({ isError: true, onRetry });

    await user.click(screen.getByRole('button', { name: '다시 확인' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('조회 중에는 아무것도 단정하지 않는다 — 잠깐 「없음」으로 보이면 오해가 생긴다', () => {
    const { container } = renderIndicator({ isLoading: true, printer: null });

    expect(container).toBeEmptyDOMElement();
  });
});

describe('프린터 선택 자리', () => {
  /*
   * ⛔ **고르는 자리를 두지 않는다.** 인쇄는 기본 프린터로 나간다(사용자 지시 2026-09-08).
   *    누를 수 없는 버튼이 자리만 차지해 「왜 못 고르나」를 되묻게 했다.
   */
  it('프린터가 있어도 선택 버튼을 두지 않는다', () => {
    renderIndicator();

    expect(screen.queryByRole('button', { name: '프린터 선택' })).not.toBeInTheDocument();
  });
});
describe('toHeadPrinter', () => {
  it('기본 프린터가 있으면 그것을 고른다', () => {
    const chosen = toHeadPrinter([printer('READY', '대기 중', false), printer('BUSY', '인쇄 중')]);

    expect(chosen?.status).toBe('BUSY');
  });

  it('기본이 없으면 첫 번째를 고른다', () => {
    const first = printer('OFFLINE', '연결 끊김', false);

    expect(toHeadPrinter([first, printer('READY', '대기 중', false)])).toBe(first);
  });

  it('한 대도 없으면 없다고 한다 — 지어내지 않는다', () => {
    expect(toHeadPrinter([])).toBeNull();
  });
});

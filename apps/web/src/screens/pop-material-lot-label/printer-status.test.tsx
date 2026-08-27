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
  it('서버가 준 상태 설명을 그대로 쓴다 — 화면이 상태 값으로 문구를 조립하지 않는다', () => {
    renderIndicator({ printer: printer('READY', '용지 부족') });

    expect(screen.getByText('용지 부족')).toBeInTheDocument();
  });

  it('설명이 없으면 없다고 말한다 — 상태 값을 한국어로 옮기지 않는다', () => {
    renderIndicator({ printer: printer('OFFLINE', null) });

    expect(screen.getByText('상태 설명이 없습니다.')).toBeInTheDocument();
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

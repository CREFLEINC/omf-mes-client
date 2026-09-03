import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiRequestError } from '../../patterns/request';
import { DetailSlot, type DetailSlotProps } from './detail-slot';
import type { DispositionLookup } from './lookups';

const t = messages.dispositionDecision;

const lookup = (): DispositionLookup => ({
  entries: [
    { value: '5001', label: 'SYNTH-ITEM-1 · 합성 품목', isActive: true },
    { value: '7001', label: 'EA', isActive: true },
  ],
  truncated: false,
  isError: false,
  isLoading: false,
});

const baseProps = (): DetailSlotProps => ({
  selectedId: 41,
  detail: {
    isPending: false,
    isError: false,
    isNotFound: false,
    error: null,
    view: {
      nonconformanceNo: 'NC-TEST-0041',
      itemId: 5001,
      severityCode: 'CODE-B',
      statusCode: 'CODE-C',
      openedAtText: '2026-08-12 09:30',
      description: '도장 표면 박리',
      lots: [
        {
          nonconformanceLotId: 9001,
          lotId: 8001,
          lotNoText: 'LOT-TEST-0088',
          affectedQtyText: '320',
          uomId: 7001,
          qualityStatusText: 'CODE-D → CODE-E',
        },
      ],
    },
  },
  decisions: { rows: [], isLoading: false, isError: false },
  remaining: { value: 320, text: '320', isSettled: false },
  items: lookup(),
  uoms: lookup(),
  onRetry: vi.fn(),
});

const renderSlot = (overrides: Partial<DetailSlotProps> = {}) => {
  const props = { ...baseProps(), ...overrides };
  return { ...render(<DetailSlot {...props} />), props, user: userEvent.setup() };
};

const retry = (): HTMLElement | null =>
  screen.queryByRole('button', { name: messages.common.retry });

describe('DetailSlot 상태 갈래', () => {
  it('고르지 않았으면 할 일을 알린다', () => {
    renderSlot({ selectedId: null });

    expect(screen.getByText(t.detail.select)).toBeInTheDocument();
  });

  it('불러오는 중에는 상태를 알린다 — 빈 칸과 구분된다', () => {
    renderSlot({ detail: { ...baseProps().detail, isPending: true } });

    expect(screen.getByRole('status', { name: t.detail.loading })).toBeInTheDocument();
  });

  it('⭐ 없는 부적합(404)에는 다시 시도를 내지 않는다 — 눌러도 풀리지 않는다', () => {
    renderSlot({
      detail: {
        ...baseProps().detail,
        isError: true,
        isNotFound: true,
        error: new ApiRequestError({ kind: 'http', status: 404 }),
      },
    });

    expect(screen.getByText(t.detail.notFound)).toBeInTheDocument();
    expect(screen.getByText(t.detail.notFoundDescription)).toBeInTheDocument();
    expect(retry()).toBeNull();
  });

  it('그 밖의 실패에는 다시 시도를 낸다 — 눌러서 풀린다', async () => {
    const { props, user } = renderSlot({
      detail: {
        ...baseProps().detail,
        isError: true,
        error: new ApiRequestError({ kind: 'http', status: 500 }),
      },
    });

    const button = retry();
    expect(button).not.toBeNull();
    await user.click(button as HTMLElement);

    expect(props.onRetry).toHaveBeenCalledOnce();
  });

  it('없음과 그 밖의 실패를 뭉개지 않는다 — 404에는 오류 배너가 뜨지 않는다', () => {
    renderSlot({
      detail: {
        ...baseProps().detail,
        isError: true,
        isNotFound: true,
        error: new ApiRequestError({ kind: 'http', status: 404 }),
      },
    });

    expect(screen.queryByText(messages.httpError.title)).toBeNull();
  });

  it('정상이면 상세와 판정 이력을 함께 보인다', () => {
    renderSlot();

    expect(screen.getByText('도장 표면 박리')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: t.panes.decisions })).toBeInTheDocument();
  });

  it('상세가 아직 없으면 아무것도 그리지 않는다', () => {
    const { container } = renderSlot({ detail: { ...baseProps().detail, view: null } });

    expect(container).toBeEmptyDOMElement();
  });

  it('판정 이력 조회가 실패해도 상세는 그대로 보인다 — 둘은 다른 조회다', () => {
    renderSlot({ decisions: { rows: [], isLoading: false, isError: true } });

    expect(screen.getByText('도장 표면 박리')).toBeInTheDocument();
    expect(screen.getByText(t.decisions.unavailable)).toBeInTheDocument();
  });
});

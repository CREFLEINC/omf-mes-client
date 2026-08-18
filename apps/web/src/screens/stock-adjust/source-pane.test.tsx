import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SourcePane, type SourcePaneProps } from './source-pane';

const t = messages.stockAdjust;

const baseProps = (overrides: Partial<SourcePaneProps> = {}): SourcePaneProps => ({
  kind: 'count',
  onChangeKind: vi.fn(),
  discardCount: 0,
  countOptions: [{ value: '9101', label: 'SAMPLE-IC-9101 · 2026-08-17' }],
  countId: '9101',
  onChangeCount: vi.fn(),
  countWarehouseName: 'SAMPLE-WH-01 · 합성 창고 가',
  warehouseOptions: [{ value: '9201', label: 'SAMPLE-WH-01 · 합성 창고 가' }],
  warehouseId: '',
  onChangeWarehouse: vi.fn(),
  hasWarehouseError: false,
  onRetryWarehouses: vi.fn(),
  loadBlockReason: null,
  onLoadVariance: vi.fn(),
  ...overrides,
});

const renderPane = (overrides: Partial<SourcePaneProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<SourcePane {...props} />);

  return { ...result, props, user: userEvent.setup() };
};

const loadButton = (): HTMLElement => screen.getByRole('button', { name: t.actions.loadVariance });

/**
 * 원천은 **두 갈래**다(D-3의 탭 금지와 다른 축이다 — 이것은 자료의 출처이지 결재 상태가 아니다).
 */
describe('SourcePane — 원천 두 갈래', () => {
  it('실사 차이와 직접 등록 둘만 고를 수 있다', () => {
    renderPane();

    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: t.source.count })).toBeChecked();
  });

  it('원천을 바꾸면 그 사실이 위로 올라간다', async () => {
    const { props, user } = renderPane();

    await user.click(screen.getByRole('radio', { name: t.source.direct }));

    expect(props.onChangeKind).toHaveBeenCalledWith('direct');
  });

  /**
   * **바꾸기 전에 무엇을 잃는지 읽힌다**(C5). 누른 뒤에 알리면 이미 사라진 뒤다.
   */
  it('세운 줄이 있으면 사라진다는 사실을 미리 밝힌다', () => {
    renderPane({ discardCount: 3 });

    expect(screen.getByText(t.source.changeDiscardNote(3))).toBeInTheDocument();
  });

  /** 짝 방향 — 잃을 것이 없으면 안내를 내지 않는다. 「늘 뜬다」로 통과하지 않게 한다. */
  it('세운 줄이 없으면 안내를 내지 않는다', () => {
    renderPane();

    expect(screen.getByRole('radio', { name: t.source.direct })).toBeInTheDocument();
    expect(screen.queryByText(/사라집니다/)).not.toBeInTheDocument();
  });
});

describe('SourcePane — 실사 갈래', () => {
  it('대상 실사를 고르고 그 창고 이름이 함께 선다', () => {
    renderPane();

    expect(screen.getByLabelText(t.source.countField)).toBeInTheDocument();
    expect(screen.getByText('SAMPLE-WH-01 · 합성 창고 가')).toBeInTheDocument();
  });

  it('불러오기를 누르면 그 조작이 위로 올라간다', async () => {
    const { props, user } = renderPane();

    await user.click(loadButton());

    expect(props.onLoadVariance).toHaveBeenCalledTimes(1);
  });

  /** 잠갔으면 사유가 **반드시 함께 선다** — 사유 없는 잠금은 죽은 버튼과 구분되지 않는다. */
  it('막혔으면 사유가 접근 이름에 이어진다', () => {
    renderPane({ loadBlockReason: t.actionReasons.loadVarianceNeedsCount });

    expect(loadButton()).toBeDisabled();
    expect(loadButton()).toHaveAccessibleDescription(
      new RegExp(t.actionReasons.loadVarianceNeedsCount),
    );
  });

  it('열려 있으면 사유를 그리지 않는다 — 늘 서 있으면 읽히지 않는다', () => {
    renderPane();

    expect(loadButton()).toBeEnabled();
    expect(screen.queryByText(t.actionReasons.loadVarianceNeedsCount)).not.toBeInTheDocument();
  });

  it('선택지의 한계를 밝힌다', () => {
    renderPane({ countNote: t.lookups.truncated });

    expect(screen.getByText(t.lookups.truncated)).toBeInTheDocument();
  });

  /** 직접 등록 갈래의 창고 선택칸은 이 갈래에 없다 — 창고를 정하는 것은 고른 실사다. */
  it('창고를 고를 수 없다', () => {
    renderPane();

    expect(screen.getByLabelText(t.source.countField)).toBeInTheDocument();
    expect(screen.queryByLabelText(t.source.warehouseField)).not.toBeInTheDocument();
  });
});

/**
 * ⭐ **실사 참조가 비어 있는 것이 정상이다**(조심 ⑤ · C4).
 *
 * 빈 자리에 경고 표식을 붙이면 사용자가 무언가 잘못됐다고 읽고 실사를 찾아 헤맨다.
 */
describe('SourcePane — 직접 등록 갈래', () => {
  it('대상 실사가 빈 값 표식으로 보인다', () => {
    renderPane({ kind: 'direct' });

    expect(screen.getByText(t.source.countRefLabel)).toBeInTheDocument();
    expect(screen.getByText(t.values.empty)).toBeInTheDocument();
  });

  it('비어 있는 것이 정상이라는 사실을 적는다', () => {
    renderPane({ kind: 'direct' });

    expect(screen.getByText(t.source.directNote)).toBeInTheDocument();
  });

  /** 양성 앵커(빈 값 표식이 섰다)를 잡은 뒤 「경고가 없다」를 잰다. */
  it('경고 표식이 붙지 않는다', () => {
    renderPane({ kind: 'direct' });

    expect(screen.getByText(t.values.empty)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('대상 창고를 고른다 — 위치와 장부의 축이다', async () => {
    const { props, user } = renderPane({ kind: 'direct' });

    await user.click(screen.getByLabelText(t.source.warehouseField));
    await user.click(screen.getByRole('option', { name: 'SAMPLE-WH-01 · 합성 창고 가' }));

    expect(props.onChangeWarehouse).toHaveBeenCalledWith('9201');
  });

  /** 실사 갈래의 조작은 이 갈래에 서지 않는다 — 불러올 실사가 없다. */
  it('실사 차이 불러오기가 없다', () => {
    renderPane({ kind: 'direct' });

    expect(screen.getByLabelText(t.source.warehouseField)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.actions.loadVariance })).not.toBeInTheDocument();
  });
});

/**
 * ⭐ **창고 실패의 복구가 두 갈래 모두에 선다**(리뷰 R-1).
 *
 * 창고만 실패하면 직접 등록 갈래는 고를 창고가 없어 줄을 세울 수 없고, 복구 수단을 대상 구획
 * 안쪽에 두면 그 빈 상태에 가려 **화면 전체에 「다시 시도」가 한 개도 없는** 막다른 길이 된다.
 *
 * **안내가 말하는 것과 복구가 되살리는 것이 같다** — 이 블록은 창고 하나를 말하고 창고
 * 하나를 되살린다.
 */
describe('SourcePane — 창고 참조 실패', () => {
  it('직접 등록 갈래에서 사유와 복구 수단이 함께 선다', async () => {
    const { props, user } = renderPane({ kind: 'direct', hasWarehouseError: true });

    expect(screen.getByText(t.reasons.warehousesFailed)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: messages.common.retry }));

    expect(props.onRetryWarehouses).toHaveBeenCalledTimes(1);
  });

  /** 실사 갈래도 창고 이름을 여기서 보인다 — 그 실패의 복구도 같은 자리다. */
  it('실사 갈래에서도 사유와 복구 수단이 함께 선다', () => {
    renderPane({ kind: 'count', hasWarehouseError: true });

    expect(screen.getByText(t.reasons.warehousesFailed)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.retry })).toBeInTheDocument();
  });

  /** 짝 방향 — 실패하지 않으면 서지 않는다. 「늘 뜬다」로 통과하지 않게 한다. */
  it('실패하지 않으면 서지 않는다', () => {
    renderPane({ kind: 'direct' });

    expect(screen.getByLabelText(t.source.warehouseField)).toBeInTheDocument();
    expect(screen.queryByText(t.reasons.warehousesFailed)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.retry })).not.toBeInTheDocument();
  });
});

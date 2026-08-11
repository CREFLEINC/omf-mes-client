import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { pickDate } from '../../test/date-picker';
import type { SelectOption } from './types';
import { createUomConversionDraft, type UomConversionDraft } from './uom-conversion-draft';
import { UomConversionFormDialog } from './uom-conversion-form-dialog';

const draft = (overrides: Partial<UomConversionDraft> = {}): UomConversionDraft => ({
  ...createUomConversionDraft(),
  ...overrides,
});

const UOMS: SelectOption[] = [
  { value: '7001', label: 'SYN-UOM-01 · 합성 단위 A' },
  { value: '7003', label: 'SYN-UOM-03 · 합성 단위 C' },
];

const renderDialog = (overrides: Partial<Parameters<typeof UomConversionFormDialog>[0]> = {}) => {
  const onClose = vi.fn<() => void>();
  const onConfirm = vi.fn<(next: UomConversionDraft) => void>();

  render(
    <UomConversionFormDialog
      draft={draft()}
      isNew
      otherDrafts={[]}
      uomOptions={() => UOMS}
      onClose={onClose}
      onConfirm={onConfirm}
      {...overrides}
    />,
  );

  return { onClose, onConfirm, user: userEvent.setup() };
};

const filled = (overrides: Partial<UomConversionDraft> = {}): UomConversionDraft =>
  draft({
    fromUomId: '7001',
    toUomId: '7003',
    conversionRate: '2.5',
    effectiveFrom: '2026-01-01',
    ...overrides,
  });

describe('UomConversionFormDialog — 확인은 저장이 아니다', () => {
  it('창 안에 표에만 반영된다는 안내가 있다', () => {
    renderDialog();

    expect(
      screen.getByText('확인을 눌러도 아직 저장되지 않습니다. 표를 확인한 뒤 저장하세요.'),
    ).toBeInTheDocument();
  });

  it('확인을 누르면 고친 줄을 바깥에 알린다', async () => {
    const { onConfirm, user } = renderDialog({ draft: filled() });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0]?.[0]).toMatchObject({
      fromUomId: '7001',
      toUomId: '7003',
      conversionRate: '2.5',
    });
  });
});

/**
 * **환산 비율에 기본값을 지어내지 않는다.**
 * `1`을 미리 넣으면 사용자가 확인하지 않은 값이 저장되는데, 단위 환산에서 1은
 * 「같은 단위」라는 뜻이라 조용히 틀린 자료가 남는다.
 */
describe('UomConversionFormDialog — 새 줄의 기본값', () => {
  it('환산 비율 칸이 비어 있다', () => {
    renderDialog();

    expect(screen.getByLabelText('환산 비율')).toHaveValue(null);
  });
});

describe('UomConversionFormDialog — 검증', () => {
  it('필수 넷을 비우면 확인이 막힌다', async () => {
    const { onConfirm, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getAllByText('필수 입력 항목입니다.')).toHaveLength(4);
  });

  /* 계약 `ck_item_uom_distinct` */
  it('변환 전과 변환 후가 같으면 확인이 막힌다', async () => {
    const { onConfirm, user } = renderDialog({ draft: filled({ toUomId: '7001' }) });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(
      screen.getByText('변환 전 단위와 변환 후 단위는 서로 달라야 합니다.'),
    ).toBeInTheDocument();
  });

  /* 계약 `exclusiveMinimum: 0` — 확장 속성의 유효기한(일)(`minimum: 0`)과 규칙이 갈린다. */
  it('환산 비율 0을 거부한다', async () => {
    const { onConfirm, user } = renderDialog({ draft: filled({ conversionRate: '0' }) });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('환산 비율은 0보다 큰 수로 입력하세요.')).toBeInTheDocument();
  });

  it('소수점 여덟 자리를 통과시킨다', async () => {
    const { onConfirm, user } = renderDialog({ draft: filled({ conversionRate: '0.00012345' }) });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('유효 종료가 유효 시작보다 앞서면 두 칸 모두에 오류가 뜬다', async () => {
    const { onConfirm, user } = renderDialog({
      draft: filled({ effectiveFrom: '2026-03-01', effectiveTo: '2026-02-01' }),
    });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getAllByText('유효 종료는 유효 시작과 같거나 뒤여야 합니다.')).toHaveLength(2);
  });
});

/** M29 — `uq_item_uom_conversion`. 창이 다른 줄을 받아 중복을 미리 막는다. */
describe('UomConversionFormDialog — 중복 (M29)', () => {
  const existing = filled({ draftId: 'saved:4001' });

  it('세 값이 같은 줄이 이미 있으면 확인이 막힌다', async () => {
    const { onConfirm, user } = renderDialog({
      draft: filled({ draftId: 'new:9' }),
      otherDrafts: [existing],
    });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(
      screen.getByText('변환 전·변환 후·유효 시작이 같은 줄이 이미 있습니다.'),
    ).toBeInTheDocument();
  });

  /* 유효 종료·환산 비율은 유일 제약의 컬럼이 아니다 — 그것만 달라도 서버에게 같은 짝이다. */
  it('환산 비율만 다른 줄도 중복으로 막는다', async () => {
    const { onConfirm, user } = renderDialog({
      draft: filled({ draftId: 'new:9', conversionRate: '9' }),
      otherDrafts: [existing],
    });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  /* 수정할 때 세 값을 그대로 두는 것이 정상이다 — 자기 자신을 세면 고칠 수 없다. */
  it('자기 자신은 중복으로 세지 않는다', async () => {
    const { onConfirm, user } = renderDialog({
      draft: existing,
      isNew: false,
      otherDrafts: [existing],
    });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  /* 값을 고치는 중에 옛 오류가 남아 있으면 무엇을 고쳐야 하는지 알 수 없다. */
  it('유효 시작을 고치면 중복 오류가 사라진다', async () => {
    const { user } = renderDialog({
      draft: filled({ draftId: 'new:9' }),
      otherDrafts: [existing],
    });

    await user.click(screen.getByRole('button', { name: '확인' }));
    expect(
      screen.getByText('변환 전·변환 후·유효 시작이 같은 줄이 이미 있습니다.'),
    ).toBeInTheDocument();

    await pickDate(user, screen.getByLabelText('유효 시작'), '2026-06-01');

    expect(
      screen.queryByText('변환 전·변환 후·유효 시작이 같은 줄이 이미 있습니다.'),
    ).not.toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createExternalCodeDraft, type ExternalCodeDraft } from './external-code-draft';
import { ExternalCodeFormDialog } from './external-code-form-dialog';
import type { SelectOption } from './types';

const draft = (overrides: Partial<ExternalCodeDraft> = {}): ExternalCodeDraft => ({
  ...createExternalCodeDraft(),
  ...overrides,
});

const PARTNERS: SelectOption[] = [
  { value: '6001', label: 'SYN-PARTNER-01 · 합성 거래처 A' },
  { value: '6002', label: 'SYN-PARTNER-02 · 합성 거래처 B' },
];

const renderDialog = (overrides: Partial<Parameters<typeof ExternalCodeFormDialog>[0]> = {}) => {
  const onClose = vi.fn<() => void>();
  const onConfirm = vi.fn<(next: ExternalCodeDraft) => void>();

  render(
    <ExternalCodeFormDialog
      draft={draft()}
      isNew
      otherDrafts={[]}
      partnerOptions={() => PARTNERS}
      onClose={onClose}
      onConfirm={onConfirm}
      {...overrides}
    />,
  );

  return { onClose, onConfirm, user: userEvent.setup() };
};

const filled = (overrides: Partial<ExternalCodeDraft> = {}): ExternalCodeDraft =>
  draft({
    externalSystemCode: 'UNIERP',
    partnerId: '6001',
    externalItemCode: 'SYN-EXT-ITEM-01',
    ...overrides,
  });

describe('ExternalCodeFormDialog — 확인은 저장이 아니다', () => {
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
      externalSystemCode: 'UNIERP',
      partnerId: '6001',
      externalItemCode: 'SYN-EXT-ITEM-01',
    });
  });
});

describe('ExternalCodeFormDialog — OpenAPI 외부 시스템 enum', () => {
  it('계약이 닫은 세 값만 선택지로 낸다', async () => {
    const { user } = renderDialog();

    await user.click(screen.getByLabelText('외부 시스템'));
    expect(screen.getAllByRole('option')).toHaveLength(3);
    for (const code of ['EQUIPMENT_STANDARD_IF', 'TRACKING_SYSTEM', 'UNIERP']) {
      expect(screen.getByRole('option', { name: code })).toBeInTheDocument();
    }
  });

  it('선택한 코드로 행을 만들 수 있다', async () => {
    const { onConfirm, user } = renderDialog();

    await user.click(screen.getByLabelText('외부 시스템'));
    await user.click(screen.getByRole('option', { name: 'EQUIPMENT_STANDARD_IF' }));
    await user.type(screen.getByLabelText('외부 품목코드'), 'SYN-EXT-ITEM-09');
    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0]?.[0]).toMatchObject({
      externalSystemCode: 'EQUIPMENT_STANDARD_IF',
    });
  });
});

describe('ExternalCodeFormDialog — 검증', () => {
  it('필수 둘을 비우면 확인이 막힌다', async () => {
    const { onConfirm, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getAllByText('필수 입력 항목입니다.')).toHaveLength(2);
  });

  /* 계약이 널을 허용한다 — 비우면 「(전체)」라는 정상 값이다(A-7). */
  it('거래처를 비워도 확인이 통과한다', async () => {
    const { onConfirm, user } = renderDialog({ draft: filled({ partnerId: '' }) });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('거래처에 「(전체)」 선택지가 있다', async () => {
    const { user } = renderDialog();

    await user.click(screen.getByLabelText('거래처'));

    expect(screen.getByRole('option', { name: '(전체)' })).toBeInTheDocument();
  });

  it('외부 품목코드가 100자를 넘으면 확인이 막힌다', async () => {
    const { onConfirm, user } = renderDialog({
      draft: filled({ externalItemCode: 'A'.repeat(101) }),
    });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('외부 품목코드는 100자를 넘을 수 없습니다.')).toBeInTheDocument();
  });
});

/** M29 — `COALESCE(partner_id,0)` 접기(A-7). */
describe('ExternalCodeFormDialog — 중복 (M29)', () => {
  const existingWithoutPartner = filled({ draftId: 'saved:5502', partnerId: '' });

  it('거래처를 비운 두 줄은 확인이 막힌다', async () => {
    const { onConfirm, user } = renderDialog({
      draft: filled({ draftId: 'new:9', partnerId: '' }),
      otherDrafts: [existingWithoutPartner],
    });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/거래처를 비운 줄끼리도 같은 줄로 봅니다/)).toBeInTheDocument();
  });

  it('거래처가 다르면 통과한다', async () => {
    const { onConfirm, user } = renderDialog({
      draft: filled({ draftId: 'new:9', partnerId: '6002' }),
      otherDrafts: [filled({ draftId: 'saved:5501', partnerId: '6001' })],
    });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('자기 자신은 중복으로 세지 않는다', async () => {
    const { onConfirm, user } = renderDialog({
      draft: existingWithoutPartner,
      isNew: false,
      otherDrafts: [existingWithoutPartner],
    });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  /*
   * **거래처 칸에는 자기 오류가 없다.** 필수가 아니고 중복 문구는 외부 시스템 칸에 붙는다 —
   * 늘 비어 있을 오류 자리를 두면 「이 칸도 막힐 수 있다」는 뜻이 되어
   * 읽는 사람이 없는 규칙을 찾게 된다.
   */
  it('중복이어도 거래처 칸은 오류로 표시되지 않는다', async () => {
    const { user } = renderDialog({
      draft: filled({ draftId: 'new:9', partnerId: '' }),
      otherDrafts: [existingWithoutPartner],
    });

    await user.click(screen.getByRole('button', { name: '확인' }));

    // 외부 시스템 칸이 오류를 받았다는 것을 먼저 확인한다 — 그래야 아래 부재 단언이 헛돌지 않는다.
    expect(screen.getByLabelText('외부 시스템')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('거래처')).not.toHaveAttribute('aria-invalid', 'true');
  });

  /*
   * 외부 시스템과 거래처가 **함께** 유일 제약을 만든다 —
   * 중복 문구는 외부 시스템 칸에 붙으므로 거래처를 고쳤을 때도 지워야 한다.
   */
  it('거래처를 고치면 중복 오류가 사라진다', async () => {
    const { user } = renderDialog({
      draft: filled({ draftId: 'new:9', partnerId: '' }),
      otherDrafts: [existingWithoutPartner],
    });

    await user.click(screen.getByRole('button', { name: '확인' }));
    expect(screen.getByText(/거래처를 비운 줄끼리도 같은 줄로 봅니다/)).toBeInTheDocument();

    await user.click(screen.getByLabelText('거래처'));
    await user.click(screen.getByRole('option', { name: 'SYN-PARTNER-01 · 합성 거래처 A' }));

    expect(screen.queryByText(/거래처를 비운 줄끼리도 같은 줄로 봅니다/)).not.toBeInTheDocument();
  });
});

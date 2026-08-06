import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createQualificationDraft, type QualificationDraft } from './qualification-draft';
import { QualificationFormDialog } from './qualification-form-dialog';

const draft = (overrides: Partial<QualificationDraft> = {}): QualificationDraft => ({
  ...createQualificationDraft(),
  ...overrides,
});

const renderDialog = (overrides: Partial<Parameters<typeof QualificationFormDialog>[0]> = {}) => {
  const onClose = vi.fn<() => void>();
  const onConfirm = vi.fn<(next: QualificationDraft) => void>();

  render(
    <QualificationFormDialog
      draft={draft()}
      isNew
      otherDrafts={[]}
      processOptions={[{ value: '6001', label: '합성 공정 A' }]}
      onClose={onClose}
      onConfirm={onConfirm}
      {...overrides}
    />,
  );

  return { onClose, onConfirm, user: userEvent.setup() };
};

describe('QualificationFormDialog — 확인은 저장이 아니다 (C65)', () => {
  it('창 안에 표에만 반영된다는 안내가 있다', () => {
    renderDialog();

    expect(
      screen.getByText(
        '이 창의 확인은 저장이 아닙니다. 표에 반영된 뒤 「저장」을 눌러야 서버에 반영됩니다.',
      ),
    ).toBeInTheDocument();
  });

  it('확인을 누르면 고친 줄을 바깥에 알린다', async () => {
    const { onConfirm, user } = renderDialog();

    await user.click(screen.getByLabelText('자격 유형'));
    await user.click(screen.getByRole('option', { name: /선택지 준비 중/ }));
    await user.type(screen.getByLabelText('유효 시작'), '2026-08-01');
    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0]?.[0]).toMatchObject({
      qualificationTypeCode: 'PENDING',
      validFrom: '2026-08-01',
    });
  });
});

describe('QualificationFormDialog — 자리표시 (C73)', () => {
  /* 계약: 「공통코드 — 값 목록 미정 §8-5」. 값을 지어내지 않고 그 사실을 밝힌다. */
  it('자격 유형 선택지가 자리표시 하나뿐이고 안내가 붙는다', async () => {
    const { user } = renderDialog();

    await user.click(screen.getByLabelText('자격 유형'));

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(
      screen.getByText('선택지 준비 중입니다. 코드 목록이 확정되면 이 항목에서 고를 수 있습니다.'),
    ).toBeInTheDocument();
  });

  /* 계약이 비운 공정을 「모든 공정」으로 정했다(A-7) — 비우는 선택지가 있어야 한다. */
  it('공정에 「(전체 공정)」 선택지가 있다', async () => {
    const { user } = renderDialog();

    await user.click(screen.getByLabelText('공정'));

    expect(screen.getByRole('option', { name: /\(전체 공정\)/ })).toBeInTheDocument();
  });
});

describe('QualificationFormDialog — 검증 (C69·C71·C72)', () => {
  it('자격 유형과 유효 시작이 비면 확인이 막힌다', async () => {
    const { onConfirm, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getAllByText('필수 입력 항목입니다.')).toHaveLength(2);
  });

  it('유효 종료가 유효 시작보다 앞서면 두 칸 모두에 오류가 뜬다', async () => {
    const { onConfirm, user } = renderDialog({
      draft: draft({
        qualificationTypeCode: 'PENDING',
        validFrom: '2026-08-10',
        validTo: '2026-08-01',
      }),
    });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getAllByText('유효 종료는 유효 시작과 같거나 그 뒤여야 합니다.')).toHaveLength(2);
  });

  it('유효 종료만 비어 있으면 막지 않는다', async () => {
    const { onConfirm, user } = renderDialog({
      draft: draft({ qualificationTypeCode: 'PENDING', validFrom: '2026-08-01' }),
    });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('인증번호가 100자를 넘으면 확인이 막힌다', async () => {
    const { onConfirm, user } = renderDialog({
      draft: draft({
        qualificationTypeCode: 'PENDING',
        validFrom: '2026-08-01',
        certificateNo: 'A'.repeat(101),
      }),
    });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('인증번호는 100자를 넘을 수 없습니다.')).toBeInTheDocument();
  });

  /* C69 — 공정을 비운 두 줄은 계약의 유일 제약에서 같은 짝이다. */
  it('공정을 비운 같은 유형이 이미 있으면 확인이 막힌다', async () => {
    const existing = draft({ qualificationTypeCode: 'PENDING', validFrom: '2026-08-01' });
    const { onConfirm, user } = renderDialog({
      draft: draft({ qualificationTypeCode: 'PENDING', validFrom: '2026-08-02' }),
      otherDrafts: [existing],
    });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/자격 유형과 공정 짝이 이미 있습니다/)).toBeInTheDocument();
  });

  /* C69 — 수정할 때 유형·공정을 그대로 두는 것이 정상이다. */
  it('자기 자신은 중복으로 세지 않는다', async () => {
    const editing = draft({ qualificationTypeCode: 'PENDING', validFrom: '2026-08-01' });
    const { onConfirm, user } = renderDialog({
      draft: editing,
      isNew: false,
      otherDrafts: [editing],
    });

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('값을 고치면 그 칸의 오류가 지워진다', async () => {
    const { user } = renderDialog();

    await user.click(screen.getByRole('button', { name: '확인' }));
    expect(screen.getAllByText('필수 입력 항목입니다.')).toHaveLength(2);

    await user.type(screen.getByLabelText('유효 시작'), '2026-08-01');

    expect(screen.getAllByText('필수 입력 항목입니다.')).toHaveLength(1);
  });
});

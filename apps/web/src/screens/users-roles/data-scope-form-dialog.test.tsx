import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { DataScopeDraft } from './data-scope-draft';
import { DataScopeFormDialog, type DataScopeFormDialogProps } from './data-scope-form-dialog';

const BUSINESS_UNIT_OPTIONS = [
  { value: '2001', label: 'SYN-BU-01 · 합성 사업부 A' },
  { value: '2002', label: 'SYN-BU-02 · 합성 사업부 B' },
];

const PLANT_OPTIONS = [{ value: '4001', label: 'SYN-PLT-01 · 합성 공장 A' }];

const emptyDraft: DataScopeDraft = { draftId: 'new:1', businessUnitId: '', plantId: '' };

const renderDialog = (overrides: Partial<DataScopeFormDialogProps> = {}) => {
  const props: DataScopeFormDialogProps = {
    draft: emptyDraft,
    isNew: true,
    otherDrafts: [],
    businessUnitOptions: BUSINESS_UNIT_OPTIONS,
    plantOptions: PLANT_OPTIONS,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };

  render(<DataScopeFormDialog {...props} />);

  return { props, user: userEvent.setup() };
};

const confirmButton = (): HTMLElement => screen.getByRole('button', { name: '확인' });

describe('DataScopeFormDialog', () => {
  it('새 줄이면 제목이 추가다', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: '접근범위 추가' })).toBeInTheDocument();
  });

  it('고치는 줄이면 제목이 수정이다', () => {
    renderDialog({ isNew: false, draft: { ...emptyDraft, businessUnitId: '2001' } });

    expect(screen.getByRole('dialog', { name: '접근범위 수정' })).toBeInTheDocument();
  });

  /** 확인이 저장이라고 오해하면 창을 닫고 화면을 떠난다. */
  it('확인이 아직 저장이 아니라는 사실을 밝힌다', () => {
    renderDialog();

    expect(screen.getByText(/확인을 눌러도 아직 저장되지 않습니다/)).toBeInTheDocument();
  });

  it('두 축 모두 「(전체)」를 고를 수 있다', () => {
    renderDialog();

    expect(screen.getAllByText('(전체)').length).toBeGreaterThan(0);
  });

  /**
   * 계약의 `ck_user_data_scope_target`이 두 축 중 하나 이상을 요구한다.
   * **목 서버가 막지 않으므로** 화면이 막지 않으면 아무도 이 결함을 보지 못한다.
   */
  it('두 축이 모두 비면 확인이 비활성이고 사유가 보인다', () => {
    renderDialog();

    expect(confirmButton()).toBeDisabled();
    expect(
      screen.getByText('확인은 사업부와 공장 중 적어도 하나를 고른 뒤에 누를 수 있습니다.'),
    ).toBeInTheDocument();
  });

  it('한 축만 골라도 확인을 누를 수 있다', async () => {
    const { props, user } = renderDialog({ draft: { ...emptyDraft, businessUnitId: '2001' } });

    expect(confirmButton()).toBeEnabled();

    await user.click(confirmButton());

    expect(props.onConfirm).toHaveBeenCalledWith({
      draftId: 'new:1',
      businessUnitId: '2001',
      plantId: '',
    });
  });

  /** 유일 제약이 빈 축을 접어 판정한다 — 사업부만 고른 두 줄은 서버에게 같은 짝이다. */
  it('이미 있는 범위와 겹치면 확인이 비활성이고 사유가 보인다', () => {
    renderDialog({
      draft: { ...emptyDraft, businessUnitId: '2001' },
      otherDrafts: [{ draftId: 'saved:9001', businessUnitId: '2001', plantId: '' }],
    });

    expect(confirmButton()).toBeDisabled();
    expect(screen.getByText(/이미 있는 범위와 겹치지 않을 때/)).toBeInTheDocument();
  });

  it('자기 자신은 중복으로 세지 않는다 — 고치는 줄을 그대로 확인할 수 있다', () => {
    const self: DataScopeDraft = { draftId: 'saved:9001', businessUnitId: '2001', plantId: '' };

    renderDialog({ draft: self, isNew: false, otherDrafts: [self] });

    expect(confirmButton()).toBeEnabled();
  });

  it('축을 고치면 막힘이 풀리고 확인이 그 값으로 열린다', async () => {
    const { props, user } = renderDialog();

    expect(confirmButton()).toBeDisabled();

    await user.click(screen.getByLabelText('사업부'));
    await user.click(await screen.findByRole('option', { name: 'SYN-BU-01 · 합성 사업부 A' }));

    await user.click(confirmButton());

    expect(props.onConfirm).toHaveBeenCalledWith({
      draftId: 'new:1',
      businessUnitId: '2001',
      plantId: '',
    });
  });

  /** 고른 공장을 다시 「(전체)」로 되돌리는 것은 정상 조작이다 — 빈 축도 고른 값이다. */
  it('고른 축을 「(전체)」로 되돌릴 수 있다', async () => {
    const { props, user } = renderDialog({
      draft: { ...emptyDraft, businessUnitId: '2001', plantId: '4001' },
    });

    await user.click(screen.getByLabelText('공장'));
    await user.click(await screen.findByRole('option', { name: '(전체)' }));
    await user.click(confirmButton());

    expect(props.onConfirm).toHaveBeenCalledWith({
      draftId: 'new:1',
      businessUnitId: '2001',
      plantId: '',
    });
  });

  it('취소는 아무것도 확정하지 않고 닫는다', async () => {
    const { props, user } = renderDialog({ draft: { ...emptyDraft, businessUnitId: '2001' } });

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onConfirm).not.toHaveBeenCalled();
  });

  /**
   * 선택 목록이 잘리면 지금 고른 번호가 선택지에 없을 수 있다.
   * 그 값을 창이 조용히 버리면 **사용자가 손대지 않은 축이 확인 한 번에 지워진다.**
   * (그 값을 선택지에 남겨 두는 것은 창을 여는 쪽의 몫이다 — `selectableOptions`.)
   */
  it('선택 목록에 없는 값도 버리지 않고 그대로 확인한다', async () => {
    const { props, user } = renderDialog({ draft: { ...emptyDraft, businessUnitId: '9999' } });

    await user.click(confirmButton());

    expect(props.onConfirm).toHaveBeenCalledWith({
      draftId: 'new:1',
      businessUnitId: '9999',
      plantId: '',
    });
  });
});

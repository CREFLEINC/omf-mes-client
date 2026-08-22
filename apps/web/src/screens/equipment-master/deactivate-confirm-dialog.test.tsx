import { ToastProvider } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  DeactivateConfirmDialog,
  type DeactivateConfirmDialogProps,
} from './deactivate-confirm-dialog';

const t = messages.equipmentMaster.deactivate;

const renderDialog = (overrides: Partial<DeactivateConfirmDialogProps> = {}) => {
  const onConfirm = vi.fn();
  const onClose = vi.fn();

  render(
    <ToastProvider>
      <DeactivateConfirmDialog
        title={t.title}
        targetNote={t.target('GRP-A · 프레스 구역')}
        confirmLabel={t.confirm}
        impactNote={t.membersNone}
        reversibilityNote={t.notReversibleHere}
        isSaving={false}
        banner={null}
        onConfirm={onConfirm}
        onClose={onClose}
        {...overrides}
      />
    </ToastProvider>,
  );

  return { onConfirm, onClose };
};

describe('DeactivateConfirmDialog', () => {
  /* 내부 번호가 아니라 사람이 읽는 이름으로 무엇을 끄는지 밝힌다. */
  it('무엇을 끄는지 이름으로 밝힌다', () => {
    renderDialog();

    expect(screen.getByRole('dialog', { name: t.title })).toBeInTheDocument();
    expect(screen.getByText(t.target('GRP-A · 프레스 구역'))).toBeInTheDocument();
  });

  /* 끄면 무엇이 달라지는지는 부르는 쪽이 정한다 — 창은 받은 문장을 그대로 낸다. */
  it('받은 파급 문장을 그대로 낸다', () => {
    renderDialog({ impactNote: t.members(12) });

    expect(screen.getByText(t.members(12))).toBeInTheDocument();
    expect(screen.queryByText(t.membersNone)).toBeNull();
  });

  /* 종류가 다르면 제목도 달라야 한다 — 무엇을 끄는지 창을 다시 읽지 않아도 알아야 한다. */
  it('받은 제목을 그대로 쓴다', () => {
    renderDialog({ title: t.equipmentTitle });

    expect(screen.getByRole('dialog', { name: t.equipmentTitle })).toBeInTheDocument();
  });

  /*
   * ⚠ 계약에 다시 켜는 경로가 없다(`:activate` 없음 — 실측).
   * 되돌릴 수 없다는 사실을 감추면 사용자가 가볍게 누른다.
   */
  it('받은 되돌릴 수 없음 문장을 그대로 낸다', () => {
    renderDialog();

    expect(screen.getByText(t.notReversibleHere)).toBeInTheDocument();
  });

  /* 사용 중지와 폐기는 무게가 다르다 — 창이 한 문장으로 굳히면 그 차이가 사라진다. */
  it('폐기의 문장은 사용 중지의 것과 다르다', () => {
    renderDialog({ reversibilityNote: messages.equipmentMaster.dispose.notReversible });

    expect(screen.getByText(messages.equipmentMaster.dispose.notReversible)).toBeInTheDocument();
    expect(screen.queryByText(t.notReversibleHere)).toBeNull();
  });

  /*
   * 나가는 길을 바닥 버튼 둘로 좁힌다 — 창 머리의 X 손잡이는 진행 상태를 받지 않아
   * 전송 중에도 눌린다. 한쪽 문만 잠그면 잠근 적이 없는 것과 같다.
   */
  it('스크림을 눌러도 닫히지 않는다', () => {
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole('dialog'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('창 머리에 닫기 손잡이를 두지 않는다', () => {
    renderDialog();

    expect(screen.queryByRole('button', { name: messages.common.close })).toBeNull();
  });

  /* 창 본문이 펼침 목록을 자르는 결함이 남아 있어, 걸릴 자리를 만들지 않는다. */
  it('창 안에 선택칸을 두지 않는다', () => {
    renderDialog();

    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('버튼 문구가 곧 그 버튼이 하는 일이다', () => {
    renderDialog();

    expect(screen.getByRole('button', { name: t.confirm })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: messages.common.confirm })).toBeNull();
  });

  it('사용 중지를 누르면 파기가 아니라 실행을 부른다', async () => {
    const user = userEvent.setup();
    const { onConfirm, onClose } = renderDialog();

    await user.click(screen.getByRole('button', { name: t.confirm }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  /* 전송 중에 다시 누르면 같은 쓰기가 두 번 나가고, 취소하면 결과를 받을 자리가 사라진다. */
  it('전송 중에는 두 버튼을 모두 누를 수 없다', () => {
    renderDialog({ isSaving: true });

    expect(screen.getByRole('button', { name: t.confirm })).toBeDisabled();
    expect(screen.getByRole('button', { name: messages.common.cancel })).toBeDisabled();
  });

  it('실패 배너를 창 안에 낸다 — 창을 닫지 않고 이유를 보여야 다시 시도할 수 있다', () => {
    renderDialog({ banner: <p>저장하지 못했습니다</p> });

    expect(screen.getByText('저장하지 못했습니다')).toBeInTheDocument();
  });
});

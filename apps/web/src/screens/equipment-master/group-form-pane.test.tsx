import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PENDING_CODE_VALUE } from './code-options';
import { GroupFormPane, type GroupFormPaneProps } from './group-form-pane';
import type { GroupFormValues } from './types';

const t = messages.equipmentMaster;

const values: GroupFormValues = {
  plantId: '11',
  groupCode: 'GRP-A',
  groupName: '프레스 구역',
  groupTypeCode: PENDING_CODE_VALUE,
  parentGroupId: '',
};

const renderPane = (overrides: Partial<GroupFormPaneProps> = {}) => {
  const onChange = vi.fn();
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const onDeactivate = vi.fn();

  render(
    <GroupFormPane
      mode="edit"
      values={values}
      onChange={onChange}
      fieldErrors={{}}
      banner={null}
      codeLockReason={null}
      plantOptions={[{ value: '11', label: '제1공장' }]}
      parentOptions={[{ value: '', label: t.form.parentNone }]}
      isActive
      isDirty={false}
      isSaving={false}
      onSave={onSave}
      onCancel={onCancel}
      onDeactivate={onDeactivate}
      {...overrides}
    />,
  );

  return { onChange, onSave, onCancel, onDeactivate };
};

describe('GroupFormPane', () => {
  it('필수 칸에 필수 표시를 붙인다', () => {
    renderPane();

    expect(screen.getByRole('textbox', { name: /그룹코드/ })).toHaveAttribute('aria-required');
    expect(screen.getByRole('textbox', { name: /그룹명/ })).toHaveAttribute('aria-required');
    expect(screen.getByRole('combobox', { name: t.fields.groupType })).toHaveAttribute(
      'aria-required',
    );
  });

  /* 상위 그룹은 비워 둘 수 있다 — 최상위 그룹이 정상 상태다. */
  it('상위그룹은 필수가 아니다', () => {
    renderPane();

    expect(screen.getByRole('combobox', { name: t.fields.parentGroup })).not.toHaveAttribute(
      'aria-required',
    );
  });

  /* 공장은 등록에서만 정한다 — 수정에서 필수 표시를 남기면 고칠 수 없는 칸을 고치라고 말하는 셈이다. */
  it('공장은 등록에서만 필수 표시를 붙인다', () => {
    renderPane({ mode: 'create' });

    expect(screen.getByRole('combobox', { name: t.fields.plant })).toHaveAttribute('aria-required');
  });

  it('수정에서는 공장을 잠그고 사유를 보인다', () => {
    renderPane({ mode: 'edit' });

    expect(screen.getByRole('combobox', { name: t.fields.plant })).toBeDisabled();
    expect(screen.getByText(t.actionReasons.plantFixedAfterCreate)).toBeInTheDocument();
  });

  it('코드 잠금 사유가 있으면 코드 칸을 잠그고 그 사유를 보인다', () => {
    renderPane({ codeLockReason: '이미 3건에서 사용 중입니다.' });

    expect(screen.getByRole('textbox', { name: /그룹코드/ })).toBeDisabled();
    expect(screen.getByText('이미 3건에서 사용 중입니다.')).toBeInTheDocument();
  });

  it('잠금 사유가 없으면 코드 칸이 열려 있다', () => {
    renderPane({ codeLockReason: null });

    expect(screen.getByRole('textbox', { name: /그룹코드/ })).toBeEnabled();
  });

  /* 값 목록이 확정되지 않았다는 사실을 감추지 않는다 — 고를 것이 하나뿐인 이유를 밝힌다. */
  it('그룹유형에 값 목록 준비 중 안내를 붙인다', () => {
    renderPane();

    expect(screen.getByText(messages.pendingCode.note)).toBeInTheDocument();
  });

  /* 고를 수 없는 값이 있다는 사실을 밝히지 않으면 사용자는 값이 사라진 줄 안다. */
  it('수정에서는 상위그룹에 제외 사유를 붙인다', () => {
    renderPane({ mode: 'edit' });

    expect(screen.getByText(t.actionReasons.parentExcludesSelfAndDescendants)).toBeInTheDocument();
  });

  /* 등록에는 후손이 없어 뺄 것이 없다 — 없는 제약을 말하면 안 된다. */
  it('등록에서는 제외 사유를 붙이지 않는다', () => {
    renderPane({ mode: 'create' });

    expect(screen.queryByText(t.actionReasons.parentExcludesSelfAndDescendants)).toBeNull();
  });

  it('고친 것이 없으면 저장·취소를 누를 수 없다', () => {
    renderPane({ isDirty: false });

    expect(screen.getByRole('button', { name: messages.common.save })).toBeDisabled();
    expect(screen.getByRole('button', { name: messages.common.cancel })).toBeDisabled();
  });

  it('고친 것이 있으면 저장·취소가 열린다', async () => {
    const user = userEvent.setup();
    const { onSave, onCancel } = renderPane({ isDirty: true });

    await user.click(screen.getByRole('button', { name: messages.common.save }));
    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  /* 저장이 나가는 동안 다시 누르면 같은 쓰기가 두 번 나간다. */
  it('저장 중에는 저장을 다시 누를 수 없다', () => {
    renderPane({ isDirty: true, isSaving: true });

    expect(screen.getByRole('button', { name: messages.common.save })).toBeDisabled();
  });

  it('입력을 고치면 그 칸만 담아 알린다', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPane();

    await user.type(screen.getByRole('textbox', { name: /그룹명/ }), '!');

    expect(onChange).toHaveBeenCalledWith({ groupName: '프레스 구역!' });
  });

  /* 값을 보여 주기만 하면 되는 자리는 폼 컨트롤을 잠그지 말고 값 표기로 낸다. */
  it('사용 여부는 폼 컨트롤이 아니라 값으로 보인다', () => {
    renderPane({ isActive: false });

    expect(screen.getByText(t.values.inactive)).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: t.fields.isActive })).toBeNull();
  });

  it('사용 중지 버튼은 사용 중인 그룹의 수정에서만 선다', () => {
    renderPane({ mode: 'edit', isActive: true });

    expect(screen.getByRole('button', { name: messages.common.deactivate })).toBeInTheDocument();
  });

  /* 이미 중지된 것을 다시 중지할 수는 없다 — 누를 것이 없는 컨트롤을 두지 않는다. */
  it('이미 중지된 그룹에는 사용 중지 버튼을 두지 않는다', () => {
    renderPane({ mode: 'edit', isActive: false });

    expect(screen.queryByRole('button', { name: messages.common.deactivate })).toBeNull();
  });

  /* 아직 등록되지 않은 그룹에는 사용 중지할 대상이 없다. */
  it('등록 폼에는 사용 중지 버튼을 두지 않는다', () => {
    renderPane({ mode: 'create', isActive: true });

    expect(screen.queryByRole('button', { name: messages.common.deactivate })).toBeNull();
  });

  it('사용 중지를 누르면 그 뜻을 화면에 알린다', async () => {
    const user = userEvent.setup();
    const { onDeactivate } = renderPane({ mode: 'edit', isActive: true });

    await user.click(screen.getByRole('button', { name: messages.common.deactivate }));

    expect(onDeactivate).toHaveBeenCalledTimes(1);
  });

  /*
   * 사용 중지는 상세를 다시 불러오므로 저장하지 않은 입력이 말없이 사라진다.
   * 감추지 않고 잠그되 사유를 함께 낸다 — 비활성 컨트롤은 포커스를 받지 못한다.
   */
  it('고친 것이 있으면 사용 중지를 잠그고 사유를 컨트롤 설명으로 잇는다', () => {
    renderPane({ mode: 'edit', isActive: true, isDirty: true });

    const button = screen.getByRole('button', { name: messages.common.deactivate });
    expect(button).toBeDisabled();

    const describedBy = button.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    expect(document.getElementById(describedBy ?? '')).toHaveTextContent(
      t.actionReasons.deactivateNeedsCleanForm,
    );
  });

  it('고친 것이 없으면 사용 중지가 열려 있고 사유를 내지 않는다', () => {
    renderPane({ mode: 'edit', isActive: true, isDirty: false });

    expect(screen.getByRole('button', { name: messages.common.deactivate })).toBeEnabled();
    expect(screen.queryByText(t.actionReasons.deactivateNeedsCleanForm)).toBeNull();
  });
});

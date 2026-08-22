import { ToastProvider } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PENDING_CODE_VALUE } from './code-options';
import { EquipmentFormDialog, type EquipmentFormDialogProps } from './equipment-form-dialog';
import type { EquipmentHierarchy } from './hierarchy-text';
import type { EquipmentFormValues } from './types';

const t = messages.equipmentMaster;

const values: EquipmentFormValues = {
  equipmentCode: 'EQ-01',
  equipmentName: '프레스 1호기',
  equipmentTypeCode: PENDING_CODE_VALUE,
  productionLineId: '101',
  processId: '',
  calibrationRequired: false,
};

const hierarchy: EquipmentHierarchy = {
  plantName: '제1공장',
  groupNames: ['프레스라인 A'],
  equipmentName: '프레스 1호기',
  groupAssigned: true,
};

const renderDialog = (overrides: Partial<EquipmentFormDialogProps> = {}) => {
  const onChange = vi.fn();
  const onClose = vi.fn();
  const onSave = vi.fn();
  const onDeactivate = vi.fn();
  const onDispose = vi.fn();

  render(
    <ToastProvider>
      <EquipmentFormDialog
        mode="edit"
        values={values}
        onChange={onChange}
        fieldErrors={{}}
        banner={null}
        codeLockReason={null}
        groupOptions={[{ value: '101', label: 'GRP-A · 프레스 구역' }]}
        processOptions={[{ value: '', label: t.equipmentForm.processNone }]}
        hierarchy={hierarchy}
        statusCode="IN_SERVICE"
        lastCalibrationDate={null}
        calibrationDueDate={null}
        isActive
        statusOptions={[{ value: 'IN_SERVICE', label: '운용' }]}
        isSaving={false}
        onClose={onClose}
        onSave={onSave}
        onDeactivate={onDeactivate}
        onDispose={onDispose}
        {...overrides}
      />
    </ToastProvider>,
  );

  return { onChange, onClose, onSave, onDeactivate, onDispose };
};

describe('EquipmentFormDialog', () => {
  it('필수 칸에 필수 표시를 붙인다', () => {
    renderDialog();

    expect(screen.getByRole('textbox', { name: /설비코드/ })).toHaveAttribute('aria-required');
    expect(screen.getByRole('textbox', { name: /설비명/ })).toHaveAttribute('aria-required');
    expect(screen.getByRole('combobox', { name: t.fields.equipmentType })).toHaveAttribute(
      'aria-required',
    );
  });

  /* 소속 그룹·공정이 비는 것은 정상 상태다 — 없는 제약을 말하면 안 된다. */
  it('소속 그룹과 소속 공정은 필수가 아니다', () => {
    renderDialog();

    expect(screen.getByRole('combobox', { name: t.fields.parentGroup })).not.toHaveAttribute(
      'aria-required',
    );
    expect(screen.getByRole('combobox', { name: t.fields.process })).not.toHaveAttribute(
      'aria-required',
    );
  });

  /*
   * ⭐ 스크림 클릭으로 닫히지 않게 한다. 확인 창과 이유가 다르다 — 저쪽은 되돌릴 수 없는
   * 조작을 지키고 이쪽은 사용자가 친 값을 지킨다.
   */
  it('스크림을 눌러도 닫히지 않는다', () => {
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole('dialog'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('취소는 닫기를 부르고 저장을 부르지 않는다', async () => {
    const user = userEvent.setup();
    const { onClose, onSave } = renderDialog();

    await user.click(screen.getByRole('button', { name: messages.common.cancel }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  /* 전송 중에 다시 누르면 같은 쓰기가 두 번 나가고, 닫으면 결과를 받을 자리가 사라진다. */
  it('전송 중에는 두 버튼을 모두 누를 수 없다', () => {
    renderDialog({ isSaving: true });

    expect(screen.getByRole('button', { name: messages.common.save })).toBeDisabled();
    expect(screen.getByRole('button', { name: messages.common.cancel })).toBeDisabled();
  });

  it('계층 텍스트를 한 줄로 그린다', () => {
    renderDialog();

    expect(screen.getByText('제1공장 > 프레스라인 A > 프레스 1호기')).toBeInTheDocument();
  });

  it('소속 그룹이 없으면 그 사실을 밝힌다', () => {
    renderDialog({
      hierarchy: { ...hierarchy, groupNames: [], groupAssigned: false },
    });

    expect(screen.getByText(t.values.noGroupAssigned)).toBeInTheDocument();
  });

  /* 등록 중에는 아직 위치가 없다 — 지어내지 않는다. */
  it('계층이 없으면 그 자리를 아예 그리지 않는다', () => {
    renderDialog({ mode: 'create', hierarchy: null });

    expect(screen.queryByText(t.fields.hierarchy)).toBeNull();
  });

  /* 등록에는 아직 정해진 상태도 검교정 이력도 없다. */
  it('등록 폼에는 읽기 전용 칸을 두지 않는다', () => {
    renderDialog({ mode: 'create', hierarchy: null });

    expect(screen.queryByText(t.fields.status)).toBeNull();
    expect(screen.queryByText(t.fields.lastCalibrationDate)).toBeNull();
  });

  it('코드 잠금 사유가 있으면 코드 칸을 잠그고 그 사유를 보인다', () => {
    renderDialog({ codeLockReason: '이미 3건에서 사용 중입니다.' });

    expect(screen.getByRole('textbox', { name: /설비코드/ })).toBeDisabled();
    expect(screen.getByText('이미 3건에서 사용 중입니다.')).toBeInTheDocument();
  });

  /*
   * ⭐ 수명주기 액션을 한자리에 모은다 — 사용 중지와 폐기는 같은 축의 두 단계인데
   * 서로 다른 자리에 두면 한쪽을 찾은 사용자가 다른 쪽이 없다고 읽는다.
   */
  it('사용 중인 설비의 수정 창에 사용 중지와 폐기가 함께 선다', async () => {
    const user = userEvent.setup();
    const { onDeactivate } = renderDialog({ isActive: true });

    expect(screen.getByRole('button', { name: t.actions.disposeEquipment })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: messages.common.deactivate }));

    expect(onDeactivate).toHaveBeenCalledTimes(1);
  });

  /* 이미 중지된 것을 다시 중지할 수는 없다 — 누를 것이 없는 컨트롤을 두지 않는다. */
  it('이미 중지된 설비에는 사용 중지를 두지 않는다', () => {
    renderDialog({ isActive: false });

    expect(screen.queryByRole('button', { name: messages.common.deactivate })).toBeNull();
  });

  /* 아직 등록되지 않은 설비에는 중지할 대상이 없다. */
  it('등록 폼에는 사용 중지를 두지 않는다', () => {
    renderDialog({ mode: 'create', hierarchy: null, isActive: true });

    expect(screen.queryByRole('button', { name: messages.common.deactivate })).toBeNull();
  });

  it('전송 중에는 사용 중지도 누를 수 없다', () => {
    renderDialog({ isActive: true, isSaving: true });

    expect(screen.getByRole('button', { name: messages.common.deactivate })).toBeDisabled();
  });

  it('입력을 고치면 그 칸만 담아 알린다', async () => {
    const user = userEvent.setup();
    const { onChange } = renderDialog();

    await user.type(screen.getByRole('textbox', { name: /설비명/ }), '!');

    expect(onChange).toHaveBeenCalledWith({ equipmentName: '프레스 1호기!' });
  });
});

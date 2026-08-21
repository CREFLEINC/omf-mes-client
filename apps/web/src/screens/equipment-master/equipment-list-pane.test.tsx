import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { defaultEquipmentFilters } from './code-options';
import { EquipmentListPane } from './equipment-list-pane';
import { equipmentItems, makeEquipment } from './fixtures';
import type { EquipmentFilters } from './types';

const t = messages.equipmentMaster;

const renderPane = (overrides: Partial<Parameters<typeof EquipmentListPane>[0]> = {}) => {
  const onApplyFilters = vi.fn();
  const onAdd = vi.fn();
  const onEdit = vi.fn();
  const onDeactivate = vi.fn();

  render(
    <EquipmentListPane
      items={equipmentItems}
      isLoading={false}
      appliedFilters={defaultEquipmentFilters}
      onApplyFilters={onApplyFilters}
      onAdd={onAdd}
      onEdit={onEdit}
      onDeactivate={onDeactivate}
      loadError={null}
      {...overrides}
    />,
  );

  return { onApplyFilters, onAdd, onEdit, onDeactivate };
};

describe('EquipmentListPane', () => {
  it('설비를 표에 렌더한다', () => {
    renderPane();

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'EQ-01' })).toBeInTheDocument();
    expect(screen.getByText('EQ-02 설비')).toBeInTheDocument();
  });

  it('코드 셀을 누르면 그 설비로 onEdit을 부른다', async () => {
    const user = userEvent.setup();
    const { onEdit } = renderPane();

    await user.click(screen.getByRole('button', { name: 'EQ-02' }));

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ equipmentId: 2002 }));
  });

  it('빈 상태와 필터 바 양쪽에서 등록으로 갈 수 있다', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderPane({ items: [] });

    const buttons = screen.getAllByRole('button', { name: t.actions.addEquipment });
    expect(buttons).toHaveLength(2);
    await user.click(buttons[0] as HTMLElement);

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  /*
   * ⛔ 상태는 조건이 아니라 열이다 — 이 화면은 마스터라 폐기된 자산도 보여야 한다.
   * 값 목록이 아직 없어(omf-mes#185) 서버가 준 코드를 그대로 보인다.
   */
  it('운용 상태를 서버가 준 코드 그대로 보인다', () => {
    renderPane();

    expect(screen.getByRole('columnheader', { name: t.fields.status })).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('DISPOSED')).toBeInTheDocument();
  });

  it('검교정 대상 여부를 사람이 읽는 말로 보인다', () => {
    renderPane();

    expect(screen.getByText(t.values.calibrationYes)).toBeInTheDocument();
    expect(screen.getByText(t.values.calibrationNo)).toBeInTheDocument();
  });

  it('로딩 중에는 표 대신 스켈레톤을 낸다', () => {
    renderPane({ isLoading: true, items: [] });

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByRole('status', { name: t.loading.equipments })).toBeInTheDocument();
  });

  /* 실패를 「등록된 설비가 없습니다」로 보이면 사실과 다른 안내가 된다. */
  it('조회 실패 표시가 있으면 표도 빈 상태도 내지 않는다', () => {
    renderPane({ items: [], loadError: <p>조회에 실패했습니다</p> });

    expect(screen.getByText('조회에 실패했습니다')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByText(t.empty.equipmentNoneTitle)).toBeNull();
  });

  it('결과가 없어도 필터 바는 감추지 않는다', () => {
    renderPane({ items: [] });

    expect(screen.getByLabelText(t.equipmentFilters.searchLabel)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages.common.search })).toBeInTheDocument();
  });

  it('기본 조건에서 결과 0건이면 「등록된 설비가 없다」를 낸다', () => {
    renderPane({ items: [] });

    expect(screen.getByText(t.empty.equipmentNoneTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.equipmentNoMatchTitle)).toBeNull();
  });

  /* 두 빈 상태를 같은 문구로 그리면 조건 때문에 안 보이는 것을 「없다」로 읽는다. */
  it('조건을 적용한 결과 0건은 다른 문구를 내고 초기화로 되돌릴 수 있다', async () => {
    const user = userEvent.setup();
    const applied: EquipmentFilters = { ...defaultEquipmentFilters, q: 'ZZZ' };
    const { onApplyFilters } = renderPane({ items: [], appliedFilters: applied });

    expect(screen.getByText(t.empty.equipmentNoMatchTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.empty.equipmentNoneTitle)).toBeNull();

    const resets = screen.getAllByRole('button', { name: messages.common.reset });
    await user.click(resets[1] as HTMLElement);

    expect(onApplyFilters).toHaveBeenCalledWith(defaultEquipmentFilters);
  });

  /* 편집 중인 값은 draft에만 있어야 한다 — 치는 동안 조건 칩이 따라 움직이면 안 된다. */
  it('검색어를 치는 동안에는 조건을 적용하지 않는다', async () => {
    const user = userEvent.setup();
    const { onApplyFilters } = renderPane();

    await user.type(screen.getByLabelText(t.equipmentFilters.searchLabel), 'EQ');

    expect(onApplyFilters).not.toHaveBeenCalled();
  });

  it('조회를 누르면 편집한 조건을 적용한다', async () => {
    const user = userEvent.setup();
    const { onApplyFilters } = renderPane();

    await user.type(screen.getByLabelText(t.equipmentFilters.searchLabel), 'EQ');
    await user.click(screen.getByRole('button', { name: messages.common.search }));

    expect(onApplyFilters).toHaveBeenCalledWith({ ...defaultEquipmentFilters, q: 'EQ' });
  });

  /* 해제 축이라 모아서 적용하지 않는다 — 누른 즉시 결과가 달라져야 한다. */
  it.each([
    [t.equipmentFilters.calibrationRequiredOnly, 'calibrationRequired'],
    [messages.common.includeInactive, 'includeInactive'],
  ] as const)('%s 는 누른 즉시 적용한다', async (label, field) => {
    const user = userEvent.setup();
    const { onApplyFilters } = renderPane();

    await user.click(screen.getByRole('checkbox', { name: label }));

    expect(onApplyFilters).toHaveBeenCalledWith({ ...defaultEquipmentFilters, [field]: true });
  });

  it('적용된 조건마다 제거할 수 있는 칩이 선다', async () => {
    const user = userEvent.setup();
    const applied: EquipmentFilters = {
      q: 'EQ',
      equipmentTypeCode: 'PRESS',
      calibrationRequired: true,
      includeInactive: true,
    };
    const { onApplyFilters } = renderPane({ appliedFilters: applied });

    expect(screen.getByText(t.equipmentFilters.chipKeyword('EQ'))).toBeInTheDocument();
    // 값 목록이 없어 코드를 그대로 보인다 — 「알 수 없음」이 아니다.
    expect(screen.getByText(t.equipmentFilters.chipType('PRESS'))).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: t.equipmentFilters.chipRemoveCalibration }),
    );

    expect(onApplyFilters).toHaveBeenCalledWith({ ...applied, calibrationRequired: false });
  });

  /* 값 목록이 확정되지 않았다는 사실을 감추지 않는다. */
  it('설비유형 조건에 값 목록 준비 중 안내를 붙인다', () => {
    renderPane();

    expect(screen.getByText(messages.pendingCode.note)).toBeInTheDocument();
  });

  it('미사용 설비도 표식과 함께 보인다', () => {
    renderPane({ items: [makeEquipment(2003, 'EQ-03', { isActive: false })] });

    expect(screen.getByText(t.values.inactive)).toBeInTheDocument();
  });

  it('사용 중인 설비 줄에서 바로 중지할 수 있다', async () => {
    const user = userEvent.setup();
    const { onDeactivate } = renderPane({ items: [makeEquipment(2001, 'EQ-01')] });

    await user.click(screen.getByRole('button', { name: messages.common.deactivate }));

    expect(onDeactivate).toHaveBeenCalledWith(expect.objectContaining({ equipmentId: 2001 }));
  });

  /* 이미 중지된 것을 다시 중지할 수는 없다 — 누를 것이 없는 컨트롤을 두지 않는다. */
  it('이미 중지된 설비 줄에는 중지 버튼을 두지 않는다', () => {
    renderPane({ items: [makeEquipment(2003, 'EQ-03', { isActive: false })] });

    expect(screen.queryByRole('button', { name: messages.common.deactivate })).toBeNull();
  });
});

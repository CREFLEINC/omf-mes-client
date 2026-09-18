import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  lookupFixtures,
  warehouseFieldErrorFixtures,
  warehouseFormInitialValues,
} from './fixtures';
import { WarehouseFormPane } from './warehouse-form-pane';

const renderPane = (overrides: Partial<Parameters<typeof WarehouseFormPane>[0]> = {}) => {
  const onChange = vi.fn();
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const onDeactivate = vi.fn();
  const onActivate = vi.fn();

  render(
    <WarehouseFormPane
      mode="edit"
      values={warehouseFormInitialValues}
      onChange={onChange}
      fieldErrors={{}}
      banner={null}
      codeLockReason={null}
      isActive
      isDirty={false}
      isSaving={false}
      lookups={lookupFixtures}
      onSave={onSave}
      onCancel={onCancel}
      onDeactivate={onDeactivate}
      onActivate={onActivate}
      {...overrides}
    />,
  );

  return { onChange, onSave, onCancel, onDeactivate, onActivate };
};

const FIELD_LABELS = [
  '공장',
  '사업부',
  '창고 코드',
  '창고명',
  '창고 유형',
  '관리 수준',
  '외부 창고',
  '불량 창고',
  '거래처',
  '사용 상태',
];

describe('WarehouseFormPane', () => {
  it('10개 필드를 각각 접근성 라벨로 조회할 수 있다', () => {
    renderPane();

    for (const label of FIELD_LABELS) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  // 필수 표시(*)는 라벨과 같은 줄에 있어야 하지만 접근성 이름에는 섞이면 안 된다.
  // 기본 fixture는 isExternal이 false라 이 경로를 지나지 않으므로 따로 세운다.
  it('필수 항목이 되어도 라벨로 조회할 수 있다', () => {
    renderPane({ values: { ...warehouseFormInitialValues, isExternal: true } });

    expect(screen.getByLabelText('거래처')).toBeInTheDocument();
  });

  it('fieldErrors를 주입하면 창고코드와 거래처의 인라인 오류가 화면에 보인다', () => {
    renderPane({ fieldErrors: warehouseFieldErrorFixtures });

    expect(
      screen.getByText('이미 사용 중인 코드입니다. 다른 코드를 입력하세요.'),
    ).toBeInTheDocument();
    expect(screen.getByText('외부 창고이면 거래처를 지정해야 합니다.')).toBeInTheDocument();
  });

  it('codeLockReason을 주입하면 창고코드가 비활성이고 사유가 화면 텍스트로 보인다', () => {
    const reason = '이미 3건에서 사용 중이라 코드를 바꿀 수 없습니다.';
    renderPane({ codeLockReason: reason });

    expect(screen.getByLabelText('창고 코드')).toBeDisabled();
    expect(screen.getByText(reason)).toBeInTheDocument();
  });

  it('신규 등록 모드가 아니면 공장을 바꿀 수 없고 사유가 보인다', () => {
    renderPane({ mode: 'edit' });

    const reason = '공장은 등록 후 변경할 수 없습니다.';
    expect(screen.getByLabelText('공장')).toBeDisabled();
    expect(screen.getByLabelText('공장')).toHaveAccessibleDescription(reason);
    // 안내는 칸 아래가 아니라 라벨 줄에 둔다(omf-all-around#17 3차).
    expect(screen.getByText(reason).closest('.field-label')).not.toBeNull();
  });

  it('신규 등록 모드에서는 공장을 고를 수 있고 고정 안내가 없다', () => {
    renderPane({ mode: 'create' });

    expect(screen.getByLabelText('공장')).not.toBeDisabled();
    expect(screen.queryByText('공장은 등록 후 변경할 수 없습니다.')).not.toBeInTheDocument();
  });

  it('배너 슬롯에 넘긴 노드를 상단에 렌더한다', () => {
    renderPane({ banner: <p>저장 충돌 배너</p> });

    expect(screen.getByText('저장 충돌 배너')).toBeInTheDocument();
  });

  it('변경이 없으면 저장·취소가 비활성이다', () => {
    renderPane({ isDirty: false });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  });

  it('변경이 있으면 저장을 눌러 onSave를 부른다', async () => {
    const user = userEvent.setup();
    const { onSave } = renderPane({ isDirty: true });

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('저장 중에는 저장을 다시 누를 수 없다', () => {
    renderPane({ isDirty: true, isSaving: true });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
  });

  it('변경 이력은 비활성이고 그 사유가 화면 텍스트로 보인다', () => {
    renderPane();

    const reason = '변경 이력은 현재 제공되지 않습니다.';
    const button = screen.getByRole('button', { name: '변경 이력' });

    expect(button).toBeDisabled();
    expect(screen.getByText(reason)).toBeInTheDocument();
    // 화면에 보이는 것과 그 버튼의 설명인 것은 별개 조건이다. 배치를 바꿔도 연결이 끊기면 안 된다.
    expect(button).toHaveAccessibleDescription(reason);
  });

  it('사용 중이면 사용 중지를 눌러 onDeactivate를 부른다', async () => {
    const user = userEvent.setup();
    const { onDeactivate } = renderPane({ isActive: true });

    await user.click(screen.getByRole('button', { name: '사용 중지' }));

    expect(onDeactivate).toHaveBeenCalledTimes(1);
  });

  it('이미 미사용이면 사용 중지를 내지 않고 현재 값을 표기한다', () => {
    renderPane({ isActive: false });

    expect(screen.queryByRole('button', { name: '사용 중지' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('사용 상태')).toHaveTextContent('미사용');
  });

  it('신규 등록 폼에는 사용 중지가 없다 — 아직 만들어지지 않은 창고다', () => {
    renderPane({ mode: 'create', isActive: true });

    expect(screen.queryByRole('button', { name: '사용 중지' })).not.toBeInTheDocument();
  });

  it('창고명을 고치면 바뀐 필드만 담아 onChange를 부른다', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPane();

    await user.type(screen.getByLabelText('창고명'), '가');

    expect(onChange).toHaveBeenCalledWith({
      warehouseName: `${warehouseFormInitialValues.warehouseName}가`,
    });
  });

  /* 화면 정돈(omf-all-around#17) — 라벨 위·컨트롤 아래, 상태 칩과 액션 단추를 가른다. */
  it('외부창고·불량창고 토글은 칸 위 라벨로 이름을 갖는다', () => {
    renderPane();

    expect(screen.getByRole('switch', { name: '외부 창고' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '불량 창고' })).toBeInTheDocument();
  });

  it('사용 상태는 칩으로, 사용 중지는 단추로 따로 보인다', () => {
    renderPane();

    expect(screen.getByText('사용 중')).toBeInTheDocument();
    // 상태를 바꾸는 단추는 폼 칸이 아니라 바닥글에 있다(omf-all-around#17 3차).
    expect(
      screen.getByRole('button', { name: '사용 중지' }).closest('.form-actions'),
    ).not.toBeNull();
  });

  it('관리 수준이 창고일 때만 라벨 옆에 Location 안내가 보인다(폼의 현재 값 기준)', () => {
    const hint = 'Location을 지정하지 않습니다.';
    renderPane({ values: { ...warehouseFormInitialValues, managementLevelCode: 'WAREHOUSE' } });
    expect(screen.getByLabelText('관리 수준')).toHaveAccessibleDescription(hint);

    renderPane({ values: { ...warehouseFormInitialValues, managementLevelCode: 'CELL' } });
    expect(screen.getAllByText(hint)).toHaveLength(1);
  });

  it('거래처가 비어 있으면 선택칸에 안내 문구가 보인다', () => {
    renderPane({ values: { ...warehouseFormInitialValues, partnerId: '' } });

    expect(screen.getByText('거래처를 선택하세요')).toBeInTheDocument();
  });
});

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
      {...overrides}
    />,
  );

  return { onChange, onSave, onCancel, onDeactivate };
};

const FIELD_LABELS = [
  '공장',
  '사업부',
  '창고코드',
  '창고명',
  '창고유형',
  '관리수준',
  '외부창고',
  '거래처',
  '사용',
];

describe('WarehouseFormPane', () => {
  it('9개 필드를 각각 접근성 라벨로 조회할 수 있다', () => {
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

    expect(screen.getByText('이미 사용 중인 코드입니다. 다른 코드를 입력하세요.')).toBeInTheDocument();
    expect(screen.getByText('외부창고이면 거래처를 지정해야 합니다.')).toBeInTheDocument();
  });

  it('codeLockReason을 주입하면 창고코드가 비활성이고 사유가 화면 텍스트로 보인다', () => {
    const reason = '이미 3건에서 사용 중이라 코드를 바꿀 수 없습니다.';
    renderPane({ codeLockReason: reason });

    expect(screen.getByLabelText('창고코드')).toBeDisabled();
    expect(screen.getByText(reason)).toBeInTheDocument();
  });

  it('신규 등록 모드가 아니면 공장을 바꿀 수 없고 사유가 보인다', () => {
    renderPane({ mode: 'edit' });

    expect(screen.getByLabelText('공장')).toBeDisabled();
    expect(
      screen.getByText('등록 후에는 공장을 바꿀 수 없습니다. 다른 공장이면 창고를 새로 등록하세요.'),
    ).toBeInTheDocument();
  });

  it('신규 등록 모드에서는 공장을 고를 수 있다', () => {
    renderPane({ mode: 'create' });

    expect(screen.getByLabelText('공장')).not.toBeDisabled();
  });

  it('관리수준에는 선택지 준비 중 안내가 함께 보인다', () => {
    renderPane();

    expect(
      screen.getByText('선택지 준비 중입니다. 코드 목록이 확정되면 이 항목에서 고를 수 있습니다.'),
    ).toBeInTheDocument();
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

    expect(screen.getByRole('button', { name: '변경 이력' })).toBeDisabled();
    expect(screen.getByText('변경 이력 조회 규약이 확정되면 활성화됩니다.')).toBeInTheDocument();
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
    expect(screen.getByLabelText('사용')).toHaveTextContent('미사용');
  });

  it('창고명을 고치면 바뀐 필드만 담아 onChange를 부른다', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPane();

    await user.type(screen.getByLabelText('창고명'), '가');

    expect(onChange).toHaveBeenCalledWith({
      warehouseName: `${warehouseFormInitialValues.warehouseName}가`,
    });
  });
});

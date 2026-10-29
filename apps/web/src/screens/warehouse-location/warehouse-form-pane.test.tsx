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
  '외부 창고',
  '불량 창고',
  '사용 상태',
];

describe('WarehouseFormPane', () => {
  it('8개 필드를 각각 접근성 라벨로 조회할 수 있다', () => {
    renderPane();

    for (const label of FIELD_LABELS) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('fieldErrors를 주입하면 창고코드의 인라인 오류가 화면에 보인다', () => {
    renderPane({ mode: 'create', fieldErrors: warehouseFieldErrorFixtures });

    expect(
      screen.getByText('이미 사용 중인 코드입니다. 다른 코드를 입력하세요.'),
    ).toBeInTheDocument();
  });

  it('codeLockReason을 주입하면 창고코드가 비활성이고 사유가 화면 텍스트로 보인다', () => {
    const reason = '이미 3건에서 사용 중이라 코드를 바꿀 수 없습니다.';
    renderPane({ mode: 'create', codeLockReason: reason });

    expect(screen.getByLabelText('창고 코드')).toBeDisabled();
    expect(screen.getByText(reason)).toBeInTheDocument();
  });

  /* 고칠 수 없는 값은 흐린 입력칸이 아니라 글자로 보인다(사용자 지시 2026-10-29). */
  it('수정에서는 공장 · 창고 코드 · 창고명이 입력칸이 아닌 글자로 보인다', () => {
    renderPane({ mode: 'edit' });

    expect(screen.queryByRole('combobox', { name: '공장' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '창고 코드' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '창고명' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('창고 코드')).toHaveTextContent('WH-01');
    expect(screen.getByLabelText('창고명')).toHaveTextContent('1공장 자재창고');
    expect(screen.getByLabelText('공장')).toHaveTextContent('1공장');
    expect(screen.queryByText('공장은 등록 후 변경할 수 없습니다.')).not.toBeInTheDocument();
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

  it('쓸 수 없는 변경 이력 단추와 그 안내가 없다', () => {
    renderPane();

    expect(screen.queryByRole('button', { name: '변경 이력' })).not.toBeInTheDocument();
    expect(screen.queryByText('변경 이력은 현재 제공되지 않습니다.')).not.toBeInTheDocument();
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

  it('등록에서 창고명을 고치면 바뀐 필드만 담아 onChange를 부른다', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPane({ mode: 'create' });

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

  /* 위치 계층은 위치가 정한다 — 창고에서 관리 수준을 고르지 않는다(사용자 결정 2026-10-29). */
  it('관리 수준 칸이 없다', () => {
    renderPane({ mode: 'create' });

    expect(screen.queryByRole('combobox', { name: '관리 수준' })).not.toBeInTheDocument();
  });

  it('거래처 칸이 없다', () => {
    renderPane();

    expect(screen.queryByRole('combobox', { name: '거래처' })).not.toBeInTheDocument();
  });
});

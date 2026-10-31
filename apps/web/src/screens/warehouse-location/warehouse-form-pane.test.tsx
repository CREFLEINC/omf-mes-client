import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  locationFixtures,
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

/** 같은 창에 값만 바꿔 다시 그린다 — 받는 중 → 받음. */
const renderPaneWithRerender = (initial: Partial<Parameters<typeof WarehouseFormPane>[0]>) => {
  const props: Parameters<typeof WarehouseFormPane>[0] = {
    mode: 'edit',
    values: warehouseFormInitialValues,
    onChange: vi.fn(),
    fieldErrors: {},
    banner: null,
    codeLockReason: null,
    isActive: true,
    isDirty: false,
    isSaving: false,
    lookups: lookupFixtures,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    onDeactivate: vi.fn(),
    onActivate: vi.fn(),
    ...initial,
  };
  const view = render(<WarehouseFormPane {...props} />);
  return {
    rerender: (next: Partial<Parameters<typeof WarehouseFormPane>[0]>) =>
      view.rerender(<WarehouseFormPane {...props} {...next} />),
  };
};

describe('WarehouseFormPane', () => {
  /* 안 A(사용자 결정 2026-10-30) — 코드 · 창고명은 머리, 공장은 글자, 사업부 · 유형은 연필, 외부 · 불량 창고는 스위치. */
  it('수정에서는 값을 접근성 이름으로 찾을 수 있고 고칠 값만 연필이 있다', () => {
    renderPane();

    for (const label of [
      '공장',
      '창고 코드',
      '창고명',
      '사업부',
      '창고 유형',
      '외부 창고',
      '불량 창고',
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: '사업부 수정' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '창고 유형 수정' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '공장 수정' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('등록은 「창고 추가」 머리 아래 필수 칸과 외부 · 불량 스위치를 둔다', () => {
    renderPane({ mode: 'create' });

    expect(screen.getByRole('heading', { name: '창고 추가' })).toBeInTheDocument();
    for (const label of ['공장', '사업부', '창고 유형']) {
      expect(screen.getByRole('combobox', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole('textbox', { name: '창고 코드' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '창고명' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '불량 창고' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '외부 창고' })).not.toBeChecked();
    // 선택칸 셋은 직접 그린 별표, 입력칸 둘은 디자인 시스템이 required 로 그린다.
    expect(document.querySelectorAll('.required-mark')).toHaveLength(3);
    expect(screen.getByRole('textbox', { name: '창고 코드' })).toBeRequired();
  });

  it('저장된 값과 다른 칸만 이름 옆에 점을 찍는다', () => {
    renderPane({
      baseline: warehouseFormInitialValues,
      values: { ...warehouseFormInitialValues, warehouseTypeCode: 'GENERAL' },
    });

    expect(screen.getByText('창고 유형').closest('.location-facts-row')).toHaveClass('is-changed');
    expect(screen.getByText('사업부').closest('.location-facts-row')).not.toHaveClass('is-changed');
    expect(screen.getByText('일반')).toBeInTheDocument();
  });

  it('연필로 연 선택칸에서 고르면 그 칸만 담아 onChange를 부른다', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPane();

    await user.click(screen.getByRole('button', { name: '사업부 수정' }));
    await user.click(screen.getByRole('combobox', { name: '사업부' }));
    await user.click(screen.getByRole('option', { name: '물류본부' }));

    expect(onChange).toHaveBeenCalledWith({ businessUnitId: '22' });
  });

  it('불량 창고는 확인한 뒤에만 onChange를 부른다', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPane();

    await user.click(screen.getByRole('switch', { name: '불량 창고' }));
    expect(onChange).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog', { name: '불량 창고로 바꿀까요?' });
    await user.click(within(dialog).getByRole('button', { name: '확인' }));

    expect(onChange).toHaveBeenCalledWith({ isDefect: true });
  });

  it('Location 묶음은 목록을 받는 동안 자리만 잡고, 받으면 위치 수를 보인다', () => {
    const { rerender } = renderPaneWithRerender({ locations: { items: null, error: null } });

    expect(screen.getByRole('status', { name: 'Location을 불러오는 중' })).toBeInTheDocument();

    rerender({ locations: { items: locationFixtures, error: null } });
    expect(screen.getByLabelText('사용 중지')).toHaveTextContent('0');
    expect(
      within(screen.getByRole('region', { name: 'Location' })).getByText(
        String(locationFixtures.length),
      ),
    ).toBeInTheDocument();
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

  it('이미 미사용이면 사용 중지 대신 다시 사용을 내고 머리에 미사용을 표기한다', () => {
    renderPane({ isActive: false });

    expect(screen.queryByRole('button', { name: '사용 중지' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 사용' })).toBeInTheDocument();
    expect(screen.getByText('미사용')).toBeInTheDocument();
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

  /* 외부로 바꾸면 목록에서 숨는다(사용자 결정 2026-10-30 · 서버 #932) — 확인 창이 그 뒤를 알린다. */
  it('외부 창고도 확인한 뒤에만 onChange를 부르고, 켤 때는 숨겨진다고 알린다', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPane();

    await user.click(screen.getByRole('switch', { name: '외부 창고' }));
    expect(onChange).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog', { name: '외부 창고로 바꿀까요?' });
    expect(within(dialog).getByText(/목록에 나타나지 않습니다/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: '확인' }));

    expect(onChange).toHaveBeenCalledWith({ isExternal: true });
  });

  it('외부 창고는 머리에 표시가 붙는다', () => {
    renderPane({ values: { ...warehouseFormInitialValues, isExternal: true } });

    expect(screen.getByRole('switch', { name: '외부 창고' })).toBeChecked();
    expect(document.querySelector('.location-identity')?.textContent ?? '').toContain('외부 창고');
  });

  it('사용 상태는 칩으로, 사용 중지는 단추로 따로 보인다', () => {
    renderPane();

    expect(screen.getByText('사용 중')).toBeInTheDocument();
    // 상태를 바꾸는 단추는 폼 칸이 아니라 바닥글에 있다(omf-all-around#17 3차).
    expect(
      screen.getByRole('button', { name: '사용 중지' }).closest('.form-actions'),
    ).not.toBeNull();
  });

  it('거래처 칸이 없다', () => {
    renderPane();

    expect(screen.queryByRole('combobox', { name: '거래처' })).not.toBeInTheDocument();
  });
});

import { render, screen, within } from '@testing-library/react';
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
  const onDeactivate = vi.fn();
  const onActivate = vi.fn();

  render(
    <WarehouseFormPane
      values={warehouseFormInitialValues}
      onChange={onChange}
      fieldErrors={{}}
      banner={null}
      isActive
      lookups={lookupFixtures}
      onDeactivate={onDeactivate}
      onActivate={onActivate}
      {...overrides}
    />,
  );

  return { onChange, onDeactivate, onActivate };
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

  it('저장 · 취소는 없고(창 바닥에 있다), 사용 중지는 본문 「사용 상태」 줄에 있다', async () => {
    const user = userEvent.setup();
    const { onDeactivate } = renderPane();

    expect(screen.queryByRole('button', { name: '저장' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '취소' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Location' })).not.toBeInTheDocument();

    const stateRow = screen.getByText('사용 유무').closest('.warehouse-info-state');
    expect(stateRow).not.toBeNull();
    /* 상태 칩은 이 줄에 한 번만 — 머리에 두 번 두지 않는다. */
    /* 사용 여부는 전 화면 같은 「사용 / 미사용」 라벨(#358). */
    expect(screen.getAllByText('사용', { exact: true })).toHaveLength(1);
    await user.click(within(stateRow as HTMLElement).getByRole('button', { name: '사용 중지' }));
    expect(onDeactivate).toHaveBeenCalledOnce();
  });

  it('fieldErrors를 주입하면 창고코드의 인라인 오류가 화면에 보인다', () => {
    renderPane({ fieldErrors: warehouseFieldErrorFixtures });

    expect(
      screen.getByText('이미 사용 중인 코드입니다. 다른 코드를 입력하세요.'),
    ).toBeInTheDocument();
  });

  /* 고칠 수 없는 값은 흐린 입력칸이 아니라 글자로 보인다(사용자 지시 2026-10-29). */
  it('공장 · 창고 코드 · 창고명 · 창고 위치 코드는 입력칸이 아닌 글자로 보인다', () => {
    renderPane();

    expect(screen.queryByRole('combobox', { name: '공장' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '창고 코드' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '창고명' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('창고 코드')).toHaveTextContent('WH-01');
    expect(screen.getByLabelText('창고명')).toHaveTextContent('1공장 자재창고');
    expect(screen.getByLabelText('공장')).toHaveTextContent('1공장');
    expect(screen.queryByRole('textbox', { name: '창고 위치 코드' })).not.toBeInTheDocument();
  });

  it('배너 슬롯에 넘긴 노드를 상단에 렌더한다', () => {
    renderPane({ banner: <p>저장 충돌 배너</p> });

    expect(screen.getByText('저장 충돌 배너')).toBeInTheDocument();
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

    expect(screen.getByText('사용', { exact: true })).toBeInTheDocument();
    // 상태를 바꾸는 단추는 폼 칸이 아니라 「사용 상태」 줄에 있다.
    expect(
      screen.getByRole('button', { name: '사용 중지' }).closest('.warehouse-info-state'),
    ).not.toBeNull();
  });

  it('거래처 칸이 없다', () => {
    renderPane();

    expect(screen.queryByRole('combobox', { name: '거래처' })).not.toBeInTheDocument();
  });
});

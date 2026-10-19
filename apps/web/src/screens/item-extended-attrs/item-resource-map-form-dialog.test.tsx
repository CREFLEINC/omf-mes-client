import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { itemResourceMapFixtures } from './fixtures';
import {
  createItemResourceMapFormValues,
  toItemResourceMapFormValues,
  type ItemResourceMapFormValues,
} from './item-resource-map-draft';
import { ItemResourceMapFormDialog } from './item-resource-map-form-dialog';
import type { SelectOption } from './types';

const PROCESSES: SelectOption[] = [{ value: '3001', label: 'SYN-PROC-01 · 합성 공정 가' }];
const EQUIPMENTS: SelectOption[] = [
  { value: '8001', label: 'SYN-EQ-01 · 합성 설비 A' },
  { value: '8003', label: 'SYN-EQ-03 · 합성 설비 C' },
];
const MOLDS: SelectOption[] = [
  { value: '8501', label: 'SYN-MOLD-01 · 합성 금형 A' },
  { value: '8503', label: 'SYN-MOLD-03 · 합성 금형 C' },
  { value: '8504', label: 'SYN-MOLD-04 · 합성 금형 D' },
];

const renderDialog = (overrides: Partial<Parameters<typeof ItemResourceMapFormDialog>[0]> = {}) => {
  const onClose = vi.fn<() => void>();
  const onSave = vi.fn<(values: ItemResourceMapFormValues) => void>();

  render(
    <ItemResourceMapFormDialog
      row={null}
      initialValues={createItemResourceMapFormValues()}
      plantLabel="SYN-PLANT-01 · 합성 공장"
      rows={itemResourceMapFixtures}
      processOptions={() => PROCESSES}
      equipmentOptions={() => EQUIPMENTS}
      moldOptions={() => MOLDS}
      fieldErrors={{}}
      banner={null}
      isSaving={false}
      onClose={onClose}
      onSave={onSave}
      {...overrides}
    />,
  );

  return { onClose, onSave, user: userEvent.setup() };
};

describe('ItemResourceMapFormDialog — 표시', () => {
  it('등록·수정 제목이 갈린다', () => {
    renderDialog();
    expect(screen.getByRole('dialog', { name: '설비·금형 매핑 추가' })).toBeInTheDocument();
  });

  it('수정 창은 수정 제목이다', () => {
    const row = itemResourceMapFixtures[0]!;
    renderDialog({ row, initialValues: toItemResourceMapFormValues(row) });

    expect(screen.getByRole('dialog', { name: '설비·금형 매핑 수정' })).toBeInTheDocument();
  });

  it('공장은 읽기 전용이고 바꿀 수 없다는 안내가 있다', () => {
    renderDialog();

    expect(screen.getByLabelText('공장')).toHaveAttribute('readonly');
    expect(
      screen.getByText('공장은 바꿀 수 없습니다. 다른 공장이면 새로 등록하세요.'),
    ).toBeInTheDocument();
  });

  /* 공정을 비운 것이 정상 값(품목 공통)이다 — 자리표시가 아니라 값으로 보인다. */
  it('공정을 비우면 「품목 공통」으로 보이고 그 뜻을 안내한다', () => {
    renderDialog();

    expect(screen.getByLabelText('공정')).toHaveTextContent('품목 공통');
    expect(screen.getByText(/비우면 품목 공통입니다/)).toBeInTheDocument();
  });

  it('우선순위의 처음 값은 서버 기본값과 같다', () => {
    renderDialog();

    expect(screen.getByLabelText(/우선순위/)).toHaveValue(100);
  });
});

describe('ItemResourceMapFormDialog — 저장', () => {
  it('설비·금형이 둘 다 비면 저장하지 않고 설비 칸에 오류를 낸다', async () => {
    const { onSave, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText('설비나 금형 중 하나는 골라야 합니다.')).toBeInTheDocument();
  });

  it('금형만 골라도 저장한다', async () => {
    const { onSave, user } = renderDialog();

    await user.click(screen.getByLabelText('금형'));
    await user.click(screen.getByRole('option', { name: 'SYN-MOLD-03 · 합성 금형 C' }));
    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ moldId: '8503', equipmentId: '' }),
    );
  });

  it('설비를 고르면 「하나는 있어야」 오류가 사라진다', async () => {
    const { user } = renderDialog();

    await user.click(screen.getByRole('button', { name: '저장' }));
    await user.click(screen.getByLabelText('설비'));
    await user.click(screen.getByRole('option', { name: 'SYN-EQ-03 · 합성 설비 C' }));

    expect(screen.queryByText('설비나 금형 중 하나는 골라야 합니다.')).not.toBeInTheDocument();
  });

  it('이미 있는 조합이면 저장하지 않는다', async () => {
    const { onSave, user } = renderDialog({
      initialValues: { ...createItemResourceMapFormValues(), moldId: '8502' },
      moldOptions: () => [{ value: '8502', label: 'SYN-MOLD-02 · 합성 금형 B' }],
    });

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/같은 공정·설비·금형 매핑이 이미 있습니다/)).toBeInTheDocument();
  });

  it('수정 창은 고친 것이 없으면 저장이 닫혀 있다', async () => {
    const row = itemResourceMapFixtures[0]!;
    const { user } = renderDialog({ row, initialValues: toItemResourceMapFormValues(row) });

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();

    await user.clear(screen.getByLabelText('비고'));
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
  });

  it('서버가 준 칸 오류를 그 칸에 낸다', () => {
    renderDialog({ fieldErrors: { equipmentId: '이 공장의 설비가 아닙니다.' } });

    expect(screen.getByText('이 공장의 설비가 아닙니다.')).toBeInTheDocument();
  });
});

describe('ItemResourceMapFormDialog — 검색어로 좁히기', () => {
  it('검색어에 맞는 금형만 선택지에 남는다', async () => {
    const { user } = renderDialog();

    await user.type(screen.getByLabelText('금형 검색'), 'mold-04');
    await user.click(screen.getByLabelText('금형'));

    expect(screen.getByRole('option', { name: 'SYN-MOLD-04 · 합성 금형 D' })).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'SYN-MOLD-03 · 합성 금형 C' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: '(없음)' })).toBeInTheDocument();
  });

  it('고른 값은 검색어에 맞지 않아도 남는다', async () => {
    const { user } = renderDialog({
      initialValues: { ...createItemResourceMapFormValues(), moldId: '8501' },
    });

    await user.type(screen.getByLabelText('금형 검색'), 'mold-04');

    expect(screen.getByLabelText('금형')).toHaveTextContent('SYN-MOLD-01 · 합성 금형 A');
  });

  it('맞는 것이 없으면 그렇다고 알린다', async () => {
    const { user } = renderDialog();

    await user.type(screen.getByLabelText('설비 검색'), 'zzz');

    expect(screen.getByText('검색어에 맞는 항목이 없습니다.')).toBeInTheDocument();
  });

  it('검색칸에서 엔터를 쳐도 저장하지 않는다', async () => {
    const { onSave, user } = renderDialog({
      initialValues: { ...createItemResourceMapFormValues(), moldId: '8503' },
    });

    await user.type(screen.getByLabelText('금형 검색'), 'x{Enter}');

    expect(onSave).not.toHaveBeenCalled();
  });
});

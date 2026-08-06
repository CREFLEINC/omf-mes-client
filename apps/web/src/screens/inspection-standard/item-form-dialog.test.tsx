import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { inspectionItemSpecFixtures } from './fixtures';
import { ItemFormDialog } from './item-form-dialog';
import { toItemDrafts } from './item-order';
import { validateItemDraft, warnItemDraft } from './item-validation';
import type { ItemDraft } from './types';

const savedDrafts = (): ItemDraft[] => toItemDrafts(inspectionItemSpecFixtures);

const renderDialog = (overrides: Partial<Parameters<typeof ItemFormDialog>[0]> = {}) => {
  const onChange = vi.fn<(patch: Partial<ItemDraft>) => void>();
  const onClose = vi.fn<() => void>();
  const onSubmit = vi.fn<() => void>();

  render(
    <ItemFormDialog
      open
      mode="edit"
      values={savedDrafts()[0]!}
      onChange={onChange}
      fieldErrors={{}}
      fieldWarnings={{}}
      uomOptions={[{ value: '41', label: 'EA · 개' }]}
      equipmentOptions={[{ value: '6001', label: '합성 설비 A' }]}
      isSubmitting={false}
      onClose={onClose}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );

  return { onChange, onClose, onSubmit, user: userEvent.setup() };
};

describe('ItemFormDialog — 표시', () => {
  it('창이 열려 있다', () => {
    renderDialog();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('검사 항목 수정')).toBeInTheDocument();
  });

  it('추가 모드면 제목이 달라진다', () => {
    renderDialog({ mode: 'create' });

    expect(screen.getByText('검사 항목 추가')).toBeInTheDocument();
  });

  /*
   * 이 창의 확인은 서버 저장이 아니다 — 밝히지 않으면 확인을 누르고 창을 닫은 사용자가
   * 저장된 줄 안다.
   */
  it('확인이 표에만 반영된다는 사실을 창 안에서 밝힌다', () => {
    renderDialog();

    expect(
      screen.getByText('확인을 누르면 표에만 반영됩니다. 「저장」을 눌러야 서버에 반영됩니다.'),
    ).toBeInTheDocument();
  });

  /*
   * 계약의 `dataTypeCode` 값 목록이 [추정]이다 — 자료형으로 표시를 가르면
   * 지어낸 값에 화면 구조가 매달린다. 단위·목표값·상하한은 항상 보인다.
   */
  it('자료형과 무관하게 단위·목표값·상하한이 항상 보인다', () => {
    renderDialog({ values: { ...savedDrafts()[0]!, dataTypeCode: '' } });

    expect(screen.getByRole('combobox', { name: '단위' })).toBeInTheDocument();
    expect(screen.getByLabelText('목표값')).toBeInTheDocument();
    expect(screen.getByLabelText('하한')).toBeInTheDocument();
    expect(screen.getByLabelText('상한')).toBeInTheDocument();
  });

  it('값을 고치면 그 값만 알린다', () => {
    const { onChange } = renderDialog();

    fireEvent.change(screen.getByLabelText('측정 횟수'), { target: { value: '5' } });

    expect(onChange).toHaveBeenCalledWith({ measurementCount: '5' });
  });
});

describe('ItemFormDialog — 차단과 경고', () => {
  it('차단 오류는 그 칸 옆에 낸다', () => {
    renderDialog({
      fieldErrors: {
        inspectionItemCode: '같은 항목코드가 이 버전에 이미 있습니다. 다른 코드를 입력하세요.',
      },
    });

    expect(
      screen.getByText('같은 항목코드가 이 버전에 이미 있습니다. 다른 코드를 입력하세요.'),
    ).toBeInTheDocument();
  });

  /*
   * **경고이지 차단이 아니다.** 계약이 경고 등급으로 정했고, 화면이 막으면
   * 서버가 허용한 값을 넣을 방법이 없어진다.
   */
  it('목표값 범위 경고가 보이면서도 확인이 눌린다', async () => {
    const values: ItemDraft = {
      ...savedDrafts()[0]!,
      targetValue: '12',
      lowerLimit: '9',
      upperLimit: '11',
    };
    const { onSubmit, user } = renderDialog({
      values,
      fieldWarnings: warnItemDraft(values),
      fieldErrors: validateItemDraft(values, []),
    });

    expect(screen.getByText('목표값이 하한~상한 밖입니다. 의도한 값인지 확인하세요.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onSubmit).toHaveBeenCalled();
  });

  it('확인을 누르면 상위가 검증한다', async () => {
    const { onSubmit, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: '확인' }));

    expect(onSubmit).toHaveBeenCalled();
  });

  it('취소를 누르면 창을 닫으라고 알린다', async () => {
    const { onClose, user } = renderDialog();

    await user.click(screen.getByRole('button', { name: '취소' }));

    expect(onClose).toHaveBeenCalled();
  });
});

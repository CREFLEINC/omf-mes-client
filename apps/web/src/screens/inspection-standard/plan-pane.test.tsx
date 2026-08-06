import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { inspectionPlanFixtures } from './fixtures';
import { planToFormValues } from './plan-mappers';
import { PlanPane } from './plan-pane';
import type { PlanFormValues } from './types';

const ITEM_OPTIONS = [
  { value: '5001', label: 'SYN-ITEM-01 · 합성 품목 A' },
  { value: '5002', label: 'SYN-ITEM-02 · 합성 품목 B' },
];
const PROCESS_OPTIONS = [{ value: '9001', label: '합성 공정 A' }];
const ROUTING_OPTIONS = [{ value: '7003', label: 'SYN-ROUTE-01 · Rev 3' }];

const renderPane = (overrides: Partial<Parameters<typeof PlanPane>[0]> = {}) => {
  const onChange = vi.fn<(patch: Partial<PlanFormValues>) => void>();
  const onSave = vi.fn<() => void>();
  const onCancel = vi.fn<() => void>();

  render(
    <PlanPane
      mode="edit"
      plan={inspectionPlanFixtures[0]!}
      values={planToFormValues(inspectionPlanFixtures[0]!)}
      onChange={onChange}
      fieldErrors={{}}
      banner={null}
      optionsNotice={null}
      itemOptions={ITEM_OPTIONS}
      processOptions={PROCESS_OPTIONS}
      routingOptions={ROUTING_OPTIONS}
      routingDisabledReason={null}
      codeLockReason={null}
      isDirty={false}
      isSaving={false}
      onSave={onSave}
      onCancel={onCancel}
      {...overrides}
    />,
  );

  return { onChange, onSave, onCancel, user: userEvent.setup() };
};

describe('PlanPane — 표시', () => {
  it('상세 값으로 폼을 채운다', () => {
    renderPane();

    expect(screen.getByLabelText('기준코드')).toHaveValue('SYN-PLAN-01');
    expect(screen.getByLabelText('기준명')).toHaveValue('합성 검사기준 A');
  });

  /* 승인자 이름을 만들지 않는다 — 계약이 주는 것은 사용자 번호다. */
  it('승인된 기준은 승인 시각만 낸다', () => {
    renderPane({ plan: inspectionPlanFixtures[2]!, values: planToFormValues(inspectionPlanFixtures[2]!) });

    expect(screen.getByText('승인됨 · 2026-08-04 09:12')).toBeInTheDocument();
    expect(screen.queryByText(/4001/)).not.toBeInTheDocument();
  });

  it('승인 전이면 미승인으로 낸다', () => {
    renderPane();

    expect(screen.getByText('미승인')).toBeInTheDocument();
  });

  it('사용 여부를 값 표기로 낸다', () => {
    renderPane({ plan: inspectionPlanFixtures[2]!, values: planToFormValues(inspectionPlanFixtures[2]!) });

    expect(screen.getByText('미사용')).toBeInTheDocument();
  });

  /* 서버가 채우는 값을 미리 지어내 보이지 않는다. */
  it('등록 폼에서는 승인·사용 여부를 내지 않는다', () => {
    renderPane({
      mode: 'create',
      plan: null,
      values: {
        inspectionPlanCode: '',
        inspectionPlanName: '',
        inspectionTypeCode: '',
        itemId: '',
        processId: '',
        routingId: '',
      },
    });

    expect(screen.queryByText('미승인')).not.toBeInTheDocument();
    expect(screen.queryByText('미사용')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '기준 추가' })).toBeInTheDocument();
  });

  it('필수 칸에 필수 표시가 붙는다', () => {
    renderPane();

    expect(screen.getByLabelText('기준코드')).toHaveAttribute('aria-required');
    expect(screen.getByLabelText('기준명')).toHaveAttribute('aria-required');
    expect(screen.getByRole('combobox', { name: '검사 유형' })).toHaveAttribute('aria-required');
  });
});

describe('PlanPane — 잠금과 사유', () => {
  it('코드 잠금 사유는 그 칸 아래에 붙고 다른 칸은 열려 있다', () => {
    renderPane({ codeLockReason: '지금은 코드를 바꿀 수 없습니다.' });

    expect(screen.getByLabelText('기준코드')).toBeDisabled();
    expect(screen.getByLabelText('기준명')).toBeEnabled();
    expect(screen.getByText('지금은 코드를 바꿀 수 없습니다.')).toBeInTheDocument();
  });

  /*
   * 계약의 라우팅 조회가 품목을 필수로 둔다 — 고를 수 없는 칸을 활성으로 두면
   * 사용자가 무엇이 막혔는지 모른다.
   */
  it('품목을 고르지 않으면 라우팅 선택칸이 비활성이고 사유가 붙는다', () => {
    renderPane({
      values: { ...planToFormValues(inspectionPlanFixtures[0]!), itemId: '' },
      routingDisabledReason: '라우팅은 품목을 고른 뒤에 고를 수 있습니다. 먼저 품목을 고르세요.',
    });

    expect(screen.getByRole('combobox', { name: '라우팅' })).toBeDisabled();
    expect(
      screen.getByText('라우팅은 품목을 고른 뒤에 고를 수 있습니다. 먼저 품목을 고르세요.'),
    ).toBeInTheDocument();
  });

  it('품목을 고르면 라우팅 선택칸이 열린다', () => {
    renderPane();

    expect(screen.getByRole('combobox', { name: '라우팅' })).toBeEnabled();
  });
});

describe('PlanPane — 편집', () => {
  it('기준명을 고치면 그 값만 알린다', async () => {
    const { onChange, user } = renderPane();

    await user.type(screen.getByLabelText('기준명'), 'X');

    expect(onChange).toHaveBeenCalledWith({ inspectionPlanName: '합성 검사기준 AX' });
  });

  it('품목을 고르면 그 값을 알린다', async () => {
    const { onChange, user } = renderPane();

    await user.click(screen.getByRole('combobox', { name: '품목' }));
    await user.click(screen.getByRole('option', { name: 'SYN-ITEM-02 · 합성 품목 B' }));

    expect(onChange).toHaveBeenCalledWith({ itemId: '5002' });
  });

  it('고친 것이 없으면 저장과 취소가 모두 비활성이다', () => {
    renderPane();

    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
  });

  it('고친 것이 있으면 저장을 누를 수 있다', async () => {
    const { onSave, user } = renderPane({ isDirty: true });

    await user.click(screen.getByRole('button', { name: '저장' }));

    expect(onSave).toHaveBeenCalled();
  });

  it('필드 오류를 그 칸 옆에 낸다', () => {
    renderPane({ fieldErrors: { inspectionPlanCode: '이미 사용 중인 코드입니다.' } });

    expect(screen.getByText('이미 사용 중인 코드입니다.')).toBeInTheDocument();
  });
});

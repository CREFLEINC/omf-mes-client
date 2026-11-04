import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';

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

  /* 품목 칸은 서버에서 검색하는 선택칸이라 API 맥락이 있어야 선다(사용자 지시 2026-11-04). */
  const { unmount } = renderWithProviders(
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

  return { onChange, onSave, onCancel, unmount, user: userEvent.setup() };
};

describe('PlanPane — 표시', () => {
  it('상세 값으로 폼을 채운다', () => {
    renderPane();

    expect(screen.getByLabelText('기준코드')).toHaveValue('SYN-PLAN-01');
    expect(screen.getByLabelText('기준명')).toHaveValue('합성 검사기준 A');
  });

  /* 승인자 이름을 만들지 않는다 — 계약이 주는 것은 사용자 번호다. */
  it('승인된 기준은 승인 시각만 낸다', () => {
    renderPane({
      plan: inspectionPlanFixtures[2]!,
      values: planToFormValues(inspectionPlanFixtures[2]!),
    });

    // 승인 시각은 공장 시각(UTC+7) — +09:00 09:12 는 07:12 다(omf-all-around#20).
    expect(screen.getByText('승인됨 · 2026-08-04 07:12')).toBeInTheDocument();
    expect(screen.queryByText(/4001/)).not.toBeInTheDocument();
  });

  it('승인 전이면 미승인으로 낸다', () => {
    renderPane();

    expect(screen.getByText('미승인')).toBeInTheDocument();
  });

  it('사용 여부를 값 표기로 낸다', () => {
    renderPane({
      plan: inspectionPlanFixtures[2]!,
      values: planToFormValues(inspectionPlanFixtures[2]!),
    });

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
        defaultSkip: false,
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

  /* PQC 기준은 공정이 필수다(사용자 결정 2026-11-04). */
  it('PQC 기준이면 공정 칸에 필수 표시가 붙고, IQC 면 붙지 않는다', () => {
    const pqc = renderPane({ values: { ...planToFormValues(inspectionPlanFixtures[0]!), inspectionTypeCode: 'PQC' } });
    expect(screen.getByRole('combobox', { name: '공정' })).toHaveAttribute('aria-required');
    pqc.unmount();

    renderPane({ values: { ...planToFormValues(inspectionPlanFixtures[0]!), inspectionTypeCode: 'IQC' } });
    expect(screen.getByRole('combobox', { name: '공정' })).not.toHaveAttribute('aria-required');
  });

  /* 검사 유형이 PQC 면 공정 이름 오른쪽에 안내를 두고, 공정이 비면 빨간 테두리(사용자 지시 2026-11-04). */
  it('PQC 기준이면 공정 이름 옆에 안내가 서고, 공정이 비면 공정 칸이 빨갛다', () => {
    renderPane({
      values: { ...planToFormValues(inspectionPlanFixtures[0]!), inspectionTypeCode: 'PQC', processId: '' },
    });

    expect(screen.getByText('PQC는 공정을 선택해야 합니다.')).toHaveClass('inspection-standard-label-hint');
    expect(screen.getByRole('combobox', { name: '공정' })).toHaveAttribute('aria-invalid', 'true');
  });

  /* 비어 있는 필수 칸은 처음부터 테두리만 빨갛다 — 글은 띄우지 않는다(사용자 지시 2026-11-04). */
  it('비어 있는 필수 칸은 빨간 테두리가 선다', () => {
    renderPane({
      mode: 'create',
      plan: null,
      values: { ...planToFormValues(inspectionPlanFixtures[0]!), inspectionPlanName: '', inspectionTypeCode: '' },
    });

    expect(screen.getByLabelText('기준명')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('combobox', { name: '검사 유형' })).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('기준코드')).not.toHaveAttribute('aria-invalid', 'true');
  });
});

describe('PlanPane — 잠금과 사유', () => {
  /* 잠금 사유는 칸 이름 오른쪽에 짧게 둔다(사용자 지시 2026-11-04). */
  it('코드 잠금 사유는 그 칸 이름 오른쪽에 붙고 다른 칸은 열려 있다', () => {
    renderPane({ codeLockReason: '지금은 코드를 바꿀 수 없습니다.' });

    const code = screen.getByLabelText('기준코드');
    expect(code).toBeDisabled();
    expect(screen.getByLabelText('기준명')).toBeEnabled();
    const hint = screen.getByText('지금은 코드를 바꿀 수 없습니다.');
    expect(hint).toHaveClass('inspection-standard-label-hint');
    expect(code).toHaveAttribute('aria-describedby', hint.id);
  });

  /*
   * 계약의 라우팅 조회가 품목을 필수로 둔다 — 품목을 고르기 전에는 라우팅 칸 전체를 두지 않고
   * 품목 이름 오른쪽에 안내를 둔다(사용자 지시 2026-11-04).
   */
  it('품목을 고르지 않으면 라우팅 칸이 없고 품목 이름 옆에 안내가 있다', () => {
    renderPane({
      values: { ...planToFormValues(inspectionPlanFixtures[0]!), itemId: '' },
      routingDisabledReason: '품목을 선택하면 라우팅이 표시됩니다.',
    });

    expect(screen.queryByText('라우팅')).not.toBeInTheDocument();
    const hint = screen.getByText('품목을 선택하면 라우팅이 표시됩니다.');
    expect(hint).toHaveClass('inspection-standard-label-hint');
    expect(hint.closest('.field-label')).toHaveTextContent('품목');
  });

  /* 라우팅은 고르지 않는다 — 자동으로 채운 Rev 를 글자로만 보인다(사용자 지시 2026-11-04). */
  it('품목이 있으면 라우팅을 고르는 칸 없이 글자로 보인다', () => {
    renderPane({ values: { ...planToFormValues(inspectionPlanFixtures[0]!), routingId: '7003' }, autoRoutingId: '7003' });

    expect(screen.queryByRole('combobox', { name: '라우팅' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '라우팅' })).toHaveValue('SYN-ROUTE-01 · Rev 3');
    expect(screen.getByRole('textbox', { name: '라우팅' })).toHaveAttribute('readonly');
  });
});

describe('PlanPane — 편집', () => {
  it('기준명을 고치면 그 값만 알린다', async () => {
    const { onChange, user } = renderPane();

    await user.type(screen.getByLabelText('기준명'), 'X');

    expect(onChange).toHaveBeenCalledWith({ inspectionPlanName: '합성 검사기준 AX' });
  });

  /* 품목은 칸에서 바로 검색해 고른다 — 창이 열리지 않는다(사용자 지시 2026-11-04). 맨 앞 「전 품목 공통」이 비우는 자리다. */
  it('지정된 품목의 이름을 칸에 보이고, 「전 품목 공통」을 고르면 비운다', async () => {
    const { onChange, user } = renderPane({
      values: { ...planToFormValues(inspectionPlanFixtures[0]!), itemId: '5002' },
    });

    const field = screen.getByRole('combobox', { name: '품목' });
    expect(field).toHaveTextContent('SYN-ITEM-02 · 합성 품목 B');

    await user.click(field);
    expect(
      await screen.findByRole('searchbox', { name: messages.common.selectSearch }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: '전 품목 공통' }));

    expect(onChange).toHaveBeenCalledWith({ itemId: '' });
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

describe('PlanPane — 기본 생략(omf-all-around#212)', () => {
  const t = messages.inspectionStandard;

  it('PQC 기준이면 저장된 값(옛 생략 허용)으로 켜져 있고, 누르면 그 값을 바꾼다', async () => {
    const pqc = inspectionPlanFixtures[1]!;
    const { onChange, user } = renderPane({ plan: pqc, values: planToFormValues(pqc) });

    const box = screen.getByRole('checkbox', { name: t.fields.defaultSkip });
    expect(box).toBeChecked();
    await user.click(box);
    expect(onChange).toHaveBeenCalledWith({ defaultSkip: false });
  });

  it.each(['IQC', 'OQC'])('%s 기준에도 체크가 선다', (code) => {
    const plan = inspectionPlanFixtures.find((row) => row.inspectionTypeCode === code)!;
    renderPane({ plan, values: planToFormValues(plan) });
    expect(screen.getByRole('checkbox', { name: t.fields.defaultSkip })).toBeInTheDocument();
  });

  it('검사 유형을 고르기 전에는 체크가 없다', () => {
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
        defaultSkip: false,
      },
    });
    expect(screen.queryByRole('checkbox', { name: t.fields.defaultSkip })).not.toBeInTheDocument();
  });
});

import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { HeaderForm, type HeaderFormProps } from './header-form';
import { EMPTY_HEADER_DRAFT } from './types';

const t = messages.poRegister;

/**
 * 발주 정보 폼 — **인라인 오류가 실제로 그 칸에 붙는지 재는 자리**다.
 *
 * 이 회차의 화면은 늘 빈 오류를 넘기므로(오류는 등록을 누른 뒤에 보인다) 오류 표시 경로가
 * 화면 시험으로는 한 번도 렌더되지 않는다. 보내는 회차의 인라인 오류가 이 배선 위에 서므로
 * **그 배선을 여기서 미리 고정한다** — 나중에 오류가 안 보이는 원인을 폼과 화면 사이에서
 * 찾아 헤매지 않도록.
 */

const SUPPLIER_OPTIONS = [
  { value: '9301', label: 'SAMPLE-SUP-01 · 합성 공급사 가' },
  { value: '9302', label: 'SAMPLE-SUP-02 · 합성 공급사 나' },
];
const BUSINESS_UNIT_OPTIONS = [{ value: '9201', label: 'SAMPLE-BU-01 · 합성 사업부 가' }];
const PLANT_OPTIONS = [{ value: '9401', label: 'SAMPLE-PLT-01 · 합성 공장 가' }];

const baseProps = (overrides: Partial<HeaderFormProps> = {}): HeaderFormProps => ({
  values: { ...EMPTY_HEADER_DRAFT, supplierId: '9301', plantId: '9401' },
  supplierOptions: SUPPLIER_OPTIONS,
  businessUnitOptions: BUSINESS_UNIT_OPTIONS,
  plantOptions: PLANT_OPTIONS,
  fieldErrors: {},
  onChange: vi.fn(),
  ...overrides,
});

const renderForm = (overrides: Partial<HeaderFormProps> = {}) => {
  const props = baseProps(overrides);
  const result = render(<HeaderForm {...props} />);

  return { ...result, props, user: userEvent.setup() };
};

describe('HeaderForm — 칸 구성', () => {
  it('다섯 칸을 라벨로 찾을 수 있다', () => {
    renderForm();

    expect(screen.getByLabelText(t.fields.supplier)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.businessUnit)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.plant)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.orderDate)).toBeInTheDocument();
    expect(screen.getByLabelText(t.fields.expectedReceiptDate)).toBeInTheDocument();
  });

  /* 계약에 쓰는 경로가 없거나 서버가 정하는 값이라 칸 자체를 두지 않는다(계획 결정 6·7). */
  it('ERP 발주번호·상태 칸이 없다', () => {
    renderForm();

    expect(screen.queryByLabelText(/ERP/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/상태/)).not.toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(3);
  });

  it('필수 넷에는 필수 표시가 붙고 입고 예정일에는 붙지 않는다', () => {
    renderForm();

    expect(screen.getByLabelText(t.fields.supplier)).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText(t.fields.businessUnit)).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText(t.fields.plant)).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText(t.fields.orderDate)).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText(t.fields.expectedReceiptDate)).not.toHaveAttribute(
      'aria-required',
    );
  });

  it('고른 값을 그 칸의 이름으로 올린다', async () => {
    const { props, user } = renderForm();

    await user.click(screen.getByLabelText(t.fields.businessUnit));
    await user.click(screen.getByRole('option', { name: 'SAMPLE-BU-01 · 합성 사업부 가' }));

    expect(props.onChange).toHaveBeenCalledWith({ businessUnitId: '9201' });
  });
});

/**
 * **오류가 자기 칸에 붙는가.** 네 칸에 서로 다른 오류를 함께 실어, 한 칸의 오류가 다른 칸을
 * 가리키지 않는지 잰다 — 접근 설명으로 재므로 「보이기는 하는데 이어지지 않은」 상태도 잡힌다.
 */
describe('HeaderForm — 인라인 오류', () => {
  const ALL_ERRORS = {
    supplierId: t.errors.supplierRequired,
    businessUnitId: t.errors.businessUnitRequired,
    plantId: t.errors.plantRequired,
    orderDate: t.errors.orderDateRequired,
  };

  it('네 칸이 각각 자기 오류를 가리킨다', () => {
    renderForm({ values: EMPTY_HEADER_DRAFT, fieldErrors: ALL_ERRORS });

    expect(screen.getByLabelText(t.fields.supplier)).toHaveAccessibleDescription(
      new RegExp(t.errors.supplierRequired),
    );
    expect(screen.getByLabelText(t.fields.businessUnit)).toHaveAccessibleDescription(
      new RegExp(t.errors.businessUnitRequired),
    );
    expect(screen.getByLabelText(t.fields.plant)).toHaveAccessibleDescription(
      new RegExp(t.errors.plantRequired),
    );
    expect(screen.getByLabelText(t.fields.orderDate)).toHaveAccessibleDescription(
      new RegExp(t.errors.orderDateRequired),
    );
  });

  it('오류가 있는 칸만 잘못된 값으로 표시된다', () => {
    renderForm({ values: EMPTY_HEADER_DRAFT, fieldErrors: { plantId: t.errors.plantRequired } });

    expect(screen.getByLabelText(t.fields.plant)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(t.fields.supplier)).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('오류가 없으면 오류 문구를 그리지 않는다', () => {
    renderForm();

    // 짝 방향 — 칸 자체는 그려진다(아무것도 안 그려도 통과하지 않게 한다).
    expect(screen.getByLabelText(t.fields.supplier)).toBeInTheDocument();
    expect(screen.queryByText(t.errors.supplierRequired)).not.toBeInTheDocument();
  });
});

/**
 * **보조 문구·오류·경고 셋이 함께 서는 자리.**
 *
 * 하나만 이으면 나머지가 화면에는 보이는데 접근 이름에서 사라진다 — 셋을 동시에 실어
 * 세 문구가 모두 그 칸의 설명에 들어가는지 잰다.
 */
describe('HeaderForm — 보조 문구와 경고의 결합', () => {
  it('선택지 안내·오류·경고가 한 칸에 함께 이어진다', () => {
    renderForm({
      values: { ...EMPTY_HEADER_DRAFT, supplierId: '9302' },
      supplierNote: t.lookups.truncated,
      fieldErrors: { supplierId: t.errors.supplierRequired },
      supplierWarning: t.warnings.supplierChanged,
    });

    const supplier = screen.getByLabelText(t.fields.supplier);

    expect(supplier).toHaveAccessibleDescription(new RegExp(t.lookups.truncated));
    expect(supplier).toHaveAccessibleDescription(new RegExp(t.errors.supplierRequired));
    expect(supplier).toHaveAccessibleDescription(new RegExp(t.warnings.supplierChanged));
  });

  it('경고만 있으면 잘못된 값으로 표시하지 않는다 — 경고는 막지 않는다', () => {
    renderForm({
      values: { ...EMPTY_HEADER_DRAFT, supplierId: '9302' },
      supplierWarning: t.warnings.supplierChanged,
    });

    const supplier = screen.getByLabelText(t.fields.supplier);

    expect(supplier).toHaveAccessibleDescription(new RegExp(t.warnings.supplierChanged));
    expect(supplier).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('선택지를 불러오지 못했다는 안내가 그 칸 아래 선다', () => {
    renderForm({ businessUnitNote: t.lookups.failed });

    expect(screen.getByLabelText(t.fields.businessUnit)).toHaveAccessibleDescription(
      new RegExp(t.lookups.failed),
    );
  });
});

import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { AssignmentFormPane, type AssignmentFormPaneProps } from './assignment-form-pane';
import { emptyLineDraft } from './line-draft';

const t = messages.shipmentRequestCreate;

const customerLookup = {
  entries: [{ value: '8201', label: 'SAMPLE-CUST-01 · 합성 고객 가', isActive: true }],
  isError: false,
  isLoading: false,
};

const shipToPartnerLookup = {
  entries: [{ value: '8211', label: 'SAMPLE-SHIP-01 · 합성 납품처 가', isActive: true }],
  isError: false,
  isLoading: false,
};

const baseProps = (overrides: Partial<AssignmentFormPaneProps> = {}): AssignmentFormPaneProps => ({
  mode: 'standalone',
  customerId: '',
  shipToPartnerId: '',
  requestedShipDate: '',
  customerOptions: [{ value: '8201', label: 'SAMPLE-CUST-01 · 합성 고객 가' }],
  shipToPartnerOptions: [{ value: '8211', label: 'SAMPLE-SHIP-01 · 합성 납품처 가' }],
  customerLookup,
  shipToPartnerLookup,
  headerErrors: {},
  onChangeHeader: vi.fn(),
  lines: [emptyLineDraft()],
  lineErrors: {},
  itemLookup: { entries: [], isError: false, isLoading: false },
  uomLookup: { entries: [], isError: false, isLoading: false },
  itemOptions: [],
  uomOptions: [],
  availableQty: { of: () => ({ kind: 'unasked' }), refetchAll: () => undefined },
  onPatchLine: vi.fn(),
  onRemoveLine: vi.fn(),
  onAddLine: vi.fn(),
  isLocked: false,
  submitBlockReason: null,
  banner: null,
  created: null,
  onSubmit: vi.fn(),
  ...overrides,
});

describe('AssignmentFormPane — 단독 생성', () => {
  it('고객·납품처가 선택칸이다(완료 조건 C3)', () => {
    render(<AssignmentFormPane {...baseProps()} />);

    expect(screen.getByRole('combobox', { name: /고객/ })).toBeInTheDocument();
  });

  it('라인 추가 버튼이 있다', () => {
    render(<AssignmentFormPane {...baseProps()} />);

    expect(screen.getByRole('button', { name: t.actions.addLine })).toBeInTheDocument();
  });

  it('라인 추가를 누르면 상위에 알린다', async () => {
    const onAddLine = vi.fn<() => void>();
    const user = userEvent.setup();

    render(<AssignmentFormPane {...baseProps({ onAddLine })} />);
    await user.click(screen.getByRole('button', { name: t.actions.addLine }));

    expect(onAddLine).toHaveBeenCalledTimes(1);
  });
});

describe('AssignmentFormPane — 지시서 경유', () => {
  it('고객·납품처가 잠긴 값 표기다 — 선택칸이 아니다(완료 조건 C2)', () => {
    render(
      <AssignmentFormPane
        {...baseProps({ mode: 'fromOrder', customerId: '8201', shipToPartnerId: '8211' })}
      />,
    );

    expect(screen.getByText('SAMPLE-CUST-01 · 합성 고객 가')).toBeInTheDocument();
    expect(screen.getByText('SAMPLE-SHIP-01 · 합성 납품처 가')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /고객/ })).not.toBeInTheDocument();
  });

  it('라인 추가 버튼이 없다', () => {
    render(<AssignmentFormPane {...baseProps({ mode: 'fromOrder' })} />);

    expect(screen.queryByRole('button', { name: t.actions.addLine })).not.toBeInTheDocument();
  });

  it('지시서 경유 안내를 낸다', () => {
    render(<AssignmentFormPane {...baseProps({ mode: 'fromOrder' })} />);

    expect(screen.getByText(t.notes.fromOrderLocked)).toBeInTheDocument();
  });
});

describe('AssignmentFormPane — 제출', () => {
  it('막힌 사유가 없으면 편성 버튼이 열려 있고 누르면 알린다', async () => {
    const onSubmit = vi.fn<() => void>();
    const user = userEvent.setup();

    render(<AssignmentFormPane {...baseProps({ onSubmit })} />);
    const button = screen.getByRole('button', { name: t.actions.submit });

    expect(button).toBeEnabled();
    await user.click(button);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('막힌 사유가 있으면 잠긴다', () => {
    render(
      <AssignmentFormPane
        {...baseProps({ submitBlockReason: t.actionReasons.headerIncomplete })}
      />,
    );

    expect(screen.getByRole('button', { name: t.actions.submit })).toBeDisabled();
  });
});

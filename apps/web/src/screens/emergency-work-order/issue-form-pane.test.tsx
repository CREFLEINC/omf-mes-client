import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_ISSUE_FORM, type IssueFormValue } from './issue-form';
import { IssueFormPane, type IssueFormPaneProps } from './issue-form-pane';

const t = messages.emergencyWorkOrder.form;
const ITEM = { itemId: 5001, itemCode: 'SYN-ITEM-0001', itemName: '합성 품목', baseUomId: 11 };

const filled: IssueFormValue = {
  itemId: '5001',
  orderQty: '200',
  dueDate: '2026-08-06',
  remarks: '고객 긴급 요청',
};

const renderPane = (overrides: Partial<IssueFormPaneProps> = {}) => {
  const onChange = vi.fn();

  render(
    <IssueFormPane
      value={filled}
      errors={{}}
      item={ITEM}
      uomLabel="EA"
      onChange={onChange}
      {...overrides}
    />,
  );

  return { onChange, user: userEvent.setup() };
};

describe('IssueFormPane', () => {
  it('⛔ 유형 칸을 두지 않는다 — 고정은 입력이 아니다', () => {
    renderPane();

    expect(screen.queryByLabelText(/유형/)).not.toBeInTheDocument();
  });

  it('⛔ 품목을 여기서 고르지 않는다 — 고른 결과만 보인다', () => {
    renderPane();

    expect(screen.getByText(/SYN-ITEM-0001/)).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: t.item })).not.toBeInTheDocument();
  });

  it('고르기 전에는 품목 자리를 비운 것으로 보인다', () => {
    renderPane({ item: null });

    const cell = screen.getByText(t.item).closest('.field-cell');
    expect(cell).toHaveTextContent('—');
  });

  it('⛔ 수량 라벨에 단위를 붙인다 — 어느 단위의 수량인지가 사실이다', () => {
    renderPane({ uomLabel: 'BOX' });

    expect(screen.getByLabelText(/BOX/)).toBeInTheDocument();
  });

  it('사유에 왜 필수인지와 어디에 남는지를 함께 적는다', () => {
    renderPane();

    const reason = screen.getByLabelText(t.reason);
    expect(reason).toHaveAccessibleDescription(expect.stringContaining('유일한 기록'));
    expect(reason).toHaveAccessibleDescription(
      expect.stringContaining('모아 세는 기능은 없습니다'),
    );
  });

  it('납기를 비워도 된다고 적는다 — 빈 칸이 「덜 채운 것」으로 읽히지 않게', () => {
    renderPane();

    expect(screen.getByLabelText(t.plannedEnd)).toHaveAccessibleDescription(
      expect.stringContaining(t.dueHelp),
    );
  });

  describe('오류를 «손댄» 칸 옆에 낸다', () => {
    /*
     * ⛔ 화면에 들어서자마자 「입력하세요」가 세 칸에 떠 있으면, 아직 아무것도 하지 않은
     * 사람을 나무라는 꼴이 된다 — 무엇이 모자란지는 발행 버튼 옆 사유가 이미 말한다.
     */
    it('⛔ 건드리지 않은 칸은 붉게 물들지 않는다', () => {
      renderPane({
        value: EMPTY_ISSUE_FORM,
        errors: {
          orderQty: t.qtyRequired,
          remarks: t.reasonRequired,
          dueDate: t.dueInvalid,
        },
      });

      expect(screen.queryByText(t.qtyRequired)).not.toBeInTheDocument();
      expect(screen.queryByText(t.reasonRequired)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/EA/)).not.toHaveAttribute('aria-invalid', 'true');
    });

    it.each([
      ['수량', /EA/, { orderQty: t.qtyNotPositive }, t.qtyNotPositive],
      ['사유', t.reason, { remarks: t.reasonRequired }, t.reasonRequired],
    ])('%s 은 손댄 뒤부터 오류를 낸다', async (_name, label, errors, message) => {
      const { user } = renderPane({ value: EMPTY_ISSUE_FORM, errors });

      await user.type(screen.getByLabelText(label), '1');

      expect(screen.getByText(message)).toBeInTheDocument();
    });

    it('⛔ 손댄 칸은 유효하지 않다고 표시된다', async () => {
      const { user } = renderPane({ errors: { orderQty: t.qtyNotPositive } });

      await user.type(screen.getByLabelText(/EA/), '0');

      expect(screen.getByLabelText(/EA/)).toHaveAttribute('aria-invalid', 'true');
    });

    it('⛔ 한 칸을 손대도 다른 칸은 조용하다 — 칸마다 따로 센다', async () => {
      const { user } = renderPane({
        value: EMPTY_ISSUE_FORM,
        errors: { orderQty: t.qtyRequired, remarks: t.reasonRequired },
      });

      await user.type(screen.getByLabelText(/EA/), '1');

      expect(screen.getByText(t.qtyRequired)).toBeInTheDocument();
      expect(screen.queryByText(t.reasonRequired)).not.toBeInTheDocument();
    });
  });

  describe('고친 값을 그대로 올린다', () => {
    it.each([
      ['수량', /EA/, 'orderQty' as const, '5'],
      ['사유', t.reason, 'remarks' as const, '급'],
    ])('%s', async (_name, label, field, typed) => {
      const { onChange, user } = renderPane({ value: EMPTY_ISSUE_FORM });

      await user.type(screen.getByLabelText(label), typed);

      expect(onChange).toHaveBeenCalledWith({ ...EMPTY_ISSUE_FORM, [field]: typed });
    });
  });

  it('⛔ 승인·자원 배정·출고요청 컨트롤을 두지 않는다 — 확정은 컨트롤로 존재하지 않는다', () => {
    renderPane();
    const section = screen.getByRole('region', { name: t.title });

    expect(within(section).queryAllByRole('checkbox')).toHaveLength(0);
    expect(within(section).queryAllByRole('switch')).toHaveLength(0);
    expect(within(section).queryAllByRole('combobox')).toHaveLength(0);
  });
});

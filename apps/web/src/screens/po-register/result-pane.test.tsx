import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createdPoView } from './fixtures';
import { ResultPane } from './result-pane';
import type { CreatedPoView } from './types';

const t = messages.poRegister;

const renderPane = (overrides: Partial<CreatedPoView> = {}): void => {
  render(<ResultPane created={createdPoView(overrides)} />);
};

const pane = (): HTMLElement => screen.getByRole('region', { name: t.result.label });

describe('ResultPane — 만들어진 전표', () => {
  it('전표번호와 저장된 줄 수를 낸다', () => {
    renderPane();

    expect(screen.getByText(t.result.createdTitle('SAMPLE-PO-9001'))).toBeVisible();
    expect(within(pane()).getByText('SAMPLE-PO-9001')).toBeVisible();
    expect(screen.getByText(t.result.lineCount(1))).toBeVisible();
  });

  /**
   * **서버가 준 상태 코드를 그대로 낸다**(완료 조건 C20 · 공유계약 G-2). 값 목록이 확정되지
   * 않아 뜻을 옮길 근거가 없다 — 「등록 완료」로 바꿔 적으면 화면이 지어낸 뜻이 된다.
   */
  it('상태 코드를 그대로 내고 라벨이 시점을 밝힌다', () => {
    renderPane();

    expect(within(pane()).getByText('SAMPLE_PO_STATUS_A')).toBeVisible();
    expect(within(pane()).getByText(t.result.createdStatusCode)).toBeVisible();
  });

  /**
   * **되돌릴 수 없는 값이 사라지는 알림으로 나가지 않는다.** 전표번호는 적어 두거나 옮겨 적는
   * 값이라 몇 초 뒤에 없어지면 안 된다 — 살아 있는 영역으로 알리되 화면에 남는다.
   */
  it('사용자가 부르지 않은 시점에 나타나므로 살아 있는 영역으로 알린다', () => {
    renderPane();

    expect(screen.getByRole('status')).toHaveTextContent(t.result.createdTitle('SAMPLE-PO-9001'));
  });
});

describe('ResultPane — ERP 발주번호 두 갈래(C21)', () => {
  /** 값이 있으면 **그 값이 보인다.** 미매칭 표식은 서지 않는다. */
  it('값이 오면 그 값을 낸다', () => {
    renderPane();

    expect(within(pane()).getByText('SAMPLE-EPO-9001')).toBeVisible();
    expect(within(pane()).queryByText(t.result.erpUnmatched)).not.toBeInTheDocument();
    expect(within(pane()).queryByText(t.result.erpUnmatchedNote)).not.toBeInTheDocument();
  });

  /**
   * 비어 있으면 **표식과 안내가 함께** 선다(미결 #1의 처리 · `omf-mes#72`).
   *
   * 「연계에 실패했습니다」로 말하지 않는다 — MES가 먼저 만들고 매칭은 나중이라는 **순서**이고,
   * 실패와는 다른 사실이다.
   */
  it('비어 있으면 미매칭 표식과 안내가 함께 선다', () => {
    renderPane({ erpPurchaseOrderNo: null });

    expect(within(pane()).getByText(t.result.erpUnmatched)).toBeVisible();
    expect(within(pane()).getByText(t.result.erpUnmatchedNote)).toBeVisible();
  });

  /** ERP 발주번호는 **낼 자리는 있고 넣을 칸은 없다**(계획 결정 6). */
  it('ERP 발주번호를 고치는 칸이 없다', () => {
    renderPane({ erpPurchaseOrderNo: null });

    expect(within(pane()).getByText(t.result.erpPurchaseOrderNo)).toBeVisible();
    expect(within(pane()).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(pane()).queryByRole('combobox')).not.toBeInTheDocument();
  });
});

describe('ResultPane — 두지 않는 것', () => {
  /**
   * **승인 요청 버튼을 이 회차가 두지 않는다**(완료 조건 C23 · 계획 결정 9). 등록과 상신은
   * 별개 동작이고, 상신은 뒤따르는 회차가 붙인다 — 자리만 만들어 두면 눌러도 아무 일이 없는
   * 버튼이 된다.
   */
  it('버튼이 하나도 없다', () => {
    renderPane();

    expect(within(pane()).getByText('SAMPLE-PO-9001')).toBeVisible();
    expect(within(pane()).queryAllByRole('button')).toHaveLength(0);
  });

  /**
   * **내부 번호를 담을 자리가 없다**(`omf-mes#44`) — 받는 타입에 그 값이 없다.
   *
   * **업무 번호는 세지 않는다.** 전표번호와 ERP 발주번호는 사용자가 이 전표를 찾는 값이라
   * 보이는 것이 맞고, 그 글자 안에 내부 번호와 같은 숫자가 들어 있다.
   */
  it('업무 번호 밖에서 내부 번호가 글자로 나타나지 않는다', () => {
    renderPane();

    const text = (pane().textContent ?? '')
      .split('SAMPLE-EPO-9001')
      .join('')
      .split('SAMPLE-PO-9001')
      .join('');

    for (const id of ['9001', '9301', '9401', '9701']) expect(text).not.toContain(id);
  });
});

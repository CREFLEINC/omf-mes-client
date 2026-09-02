import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FixedTermsPane } from './fixed-terms';

const t = messages.emergencyWorkOrder.fixedTerms;

const pane = (): HTMLElement => {
  render(<FixedTermsPane />);

  return screen.getByRole('region', { name: t.title });
};

describe('FixedTermsPane', () => {
  it('확정 넷을 라벨과 값으로 함께 보인다', () => {
    const region = pane();

    for (const term of [t.type, t.approval, t.materialRequest, t.resource]) {
      const label = within(region).getByText(term.label);
      expect(label.closest('.field-cell')).toHaveTextContent(term.value);
    }
  });

  it('⛔ 이 구획에 컨트롤을 두지 않는다 — 확정을 기본값으로 그리면 확정이 무너진다', () => {
    const region = pane();

    for (const role of [
      'combobox',
      'listbox',
      'checkbox',
      'switch',
      'radio',
      'textbox',
      'spinbutton',
      'button',
      'link',
    ] as const) {
      expect(within(region).queryAllByRole(role)).toHaveLength(0);
    }
  });

  it('⛔ 자원 배정 구획을 만들지 않는다 — 비운 구획은 「못 채운 자리」로 읽힌다', () => {
    const region = pane();

    expect(within(region).queryAllByRole('region')).toHaveLength(0);
    expect(within(region).getByText(t.resource.note)).toBeInTheDocument();
  });

  it('자재 출고요청 안내에 확정 번호가 보인다 — 재확인을 정상 경로로 보내는 근거다', () => {
    const region = pane();

    expect(within(region).getByText(t.materialRequest.note)).toHaveTextContent(
      '2026-07-14 확정 #4·#5·#7·#8',
    );
  });

  it('자재가 부족할 때 갈 길을 함께 적는다 — 막힌 것만 알리면 화면 밖에서 처리한다', () => {
    const region = pane();

    expect(within(region).getByText(t.materialRequest.note)).toHaveTextContent(
      '추가 자재 출고 요청',
    );
  });

  it('내부 관리번호가 생긴다는 것과 ERP 발주와 무관하다는 것을 함께 알린다', () => {
    const region = pane();
    const notice = within(region).getByText(t.internalOrder);

    expect(notice).toHaveTextContent('내부 관리번호');
    expect(notice).toHaveTextContent('귀속되지 않습니다');
  });

  it('⛔ 안내를 흩지 않는다 — 다섯 문구가 전부 이 구획 안에 있다', () => {
    const region = pane();

    for (const text of [
      t.type.note,
      t.approval.note,
      t.materialRequest.note,
      t.resource.note,
      t.internalOrder,
    ]) {
      expect(within(region).getByText(text)).toBeInTheDocument();
    }
  });
});

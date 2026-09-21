import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FixedTermsPane } from './fixed-terms';
import { renderWithProviders } from '../../test/api-harness';

const t = messages.emergencyWorkOrder.fixedTerms;

const pane = (): HTMLElement => {
  /* 자재 출고요청 줄의 이동 단추가 라우터를 쓴다 — 프로바이더 하네스로 태운다. */
  renderWithProviders(<FixedTermsPane />);

  return screen.getByRole('region', { name: t.title });
};

describe('FixedTermsPane', () => {
  it('확정 넷을 라벨과 값으로 함께 보인다', () => {
    const region = pane();

    for (const term of [t.type, t.approval, t.materialRequest, t.resource]) {
      const label = within(region).getByText(term.label);
      expect(label.closest('.emergency-work-order-term')).toHaveTextContent(term.value);
    }
  });

  /*
   * ⛔ **확정을 무를 컨트롤을 두지 않는다** — 기본값으로 그리면 확정이 무너진다(G-4).
   * ⭐ 예외는 **갈 길을 가리키는 이동 단추 하나**뿐이다(자재 출고요청 → `W-02-10`). 이것은
   *   확정을 되돌리는 컨트롤이 아니라 확정이 가리키는 길이라 성격이 다르다(G-3).
   */
  it('이 구획에 확정을 무를 컨트롤을 두지 않는다 — 이동 단추 하나만 둔다', () => {
    const region = pane();

    for (const role of [
      'combobox',
      'listbox',
      'checkbox',
      'switch',
      'radio',
      'textbox',
      'spinbutton',
      'link',
    ] as const) {
      expect(within(region).queryAllByRole(role)).toHaveLength(0);
    }
    expect(
      within(region)
        .getAllByRole('button')
        .map((node) => node.textContent),
    ).toEqual([t.materialRequestLink]);
  });

  it('⛔ 자원 배정 구획을 만들지 않는다 — 비운 구획은 「못 채운 자리」로 읽힌다', () => {
    const region = pane();

    expect(within(region).queryAllByRole('region')).toHaveLength(0);
    expect(within(region).getByText(t.resource.note)).toBeInTheDocument();
  });

  /*
   * ⛔ **내부 정책 번호·확정 날짜를 화면에 내지 않는다**(사용자 결정 2026-09-21). 종전에는
   * 「왜 못 바꾸나」의 근거로 번호를 적었지만, 현장에서 쓰는 말이 아니라 읽는 데 방해가 된다.
   */
  it('자재 출고요청 안내에 내부 정책 번호·날짜를 내지 않는다', () => {
    const region = pane();

    expect(within(region).getByText(t.materialRequest.note)).not.toHaveTextContent(/확정 #\d/);
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

    expect(notice).toHaveTextContent('관리번호');
    expect(notice).toHaveTextContent('연결되지 않고');
  });

  /*
   * ⛔ **안내를 흩지 않는다** — 남긴 문구는 전부 이 구획 안에 있다. 유형·승인은 값만으로
   * 읽히므로 곁설명을 두지 않는다(사용자 결정 2026-09-21).
   */
  it('안내를 흩지 않는다 — 남긴 세 문구가 전부 이 구획 안에 있다', () => {
    const region = pane();

    for (const text of [t.materialRequest.note, t.resource.note, t.internalOrder]) {
      expect(within(region).getByText(text)).toBeInTheDocument();
    }
  });

  it('값만으로 읽히는 유형·승인에는 곁설명을 두지 않는다', () => {
    const region = pane();

    for (const term of [t.type, t.approval]) {
      expect(
        within(region).getByText(term.label).closest('.emergency-work-order-term'),
      ).toHaveTextContent(new RegExp(`^${term.label}\\s*${term.value}$`));
    }
  });
});

import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { goodsIssue, goodsIssueLineFixtures, INTERNAL_IDS } from './fixtures';
import { ResultPane, type ResultLineSummary } from './result-pane';
import { toReturnResultView, type ReturnResultView } from './types';

const t = messages.supplierReturn;

const ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 품목 가';
const LOT_LABEL = 'LOT-2026-900010';

const LINES: ResultLineSummary[] = [
  { ordinal: 1, item: ITEM_LABEL, lot: LOT_LABEL, qty: '30 SAMPLE-EA' },
  { ordinal: 2, item: '알 수 없음', lot: 'LOT-2026-900011', qty: '5 SAMPLE-EA' },
];

const result = (overrides: Partial<ReturnResultView> = {}): ReturnResultView => ({
  ...toReturnResultView(goodsIssue(), goodsIssueLineFixtures),
  ...overrides,
});

const renderPane = (overrides: Partial<ReturnResultView> = {}, lines = LINES) =>
  render(<ResultPane result={result(overrides)} lines={lines} />);

const pane = (): HTMLElement => screen.getByRole('status', { name: t.result.label });

describe('ResultPane — 화면이 확인한 것만 말한다', () => {
  /* **C49** — 전표 번호는 사용자가 나중에 이 전표를 찾을 때 쓰는 업무 번호다. */
  it('반품 전표 번호와 상태 코드를 낸다', () => {
    renderPane();

    expect(pane()).toHaveTextContent('GI-2026-950001');
    expect(pane()).toHaveTextContent('SAMPLE_GI_STATUS_A');
  });

  /*
   * **M36** — 목이 `postImmediately: true`에도 `DRAFT`를 되돌려 준다(실측). 상태 코드로
   * 「전기 완료」를 판정했다면 그 자리에서 거짓말을 한다 — 값으로 분기하지 않고 그대로 낸다.
   */
  it('상태 코드가 무엇이든 문구가 달라지지 않는다', () => {
    renderPane({ statusCode: 'SAMPLE_GI_STATUS_B' });

    expect(pane()).toHaveTextContent('SAMPLE_GI_STATUS_B');
    expect(pane()).toHaveTextContent(t.result.created);
    expect(pane().textContent ?? '').not.toContain('전기 완료');
  });

  it('상태 코드를 그대로 보인다는 사실을 밝힌다', () => {
    renderPane();

    expect(screen.getByText(t.result.statusNote)).toBeInTheDocument();
  });

  /*
   * **M37** — 응답에 수불·잔액 정보가 없다. 「재고가 차감됐습니다」는 **화면이 확인한 것이
   * 아니다** — 말하면 확인하지 않은 것을 말하는 것이 된다.
   */
  it('재고 차감을 말하지 않고 확인하지 않았다고 밝힌다', () => {
    renderPane();

    expect(screen.getByText(t.result.notConfirmed)).toBeInTheDocument();
    expect(pane().textContent ?? '').not.toContain('재고가 차감');
  });

  it('전기 요청을 함께 보냈다는 데까지만 말한다', () => {
    renderPane();

    expect(screen.getByText(t.result.created)).toBeInTheDocument();
  });

  /* **C49** — 줄 목록은 **서버가 되돌려 준 배열**에서 온다. 화면이 센 줄 수를 쓰지 않는다. */
  it('서버가 준 줄을 그대로 그린다', () => {
    renderPane();

    expect(pane()).toHaveTextContent(t.result.linePair(ITEM_LABEL, LOT_LABEL, '30 SAMPLE-EA'));
    expect(pane()).toHaveTextContent(
      t.result.linePair('알 수 없음', 'LOT-2026-900011', '5 SAMPLE-EA'),
    );
    expect(screen.getByText(t.result.linesNote)).toBeInTheDocument();
  });

  it('줄이 하나뿐이면 하나만 그린다', () => {
    renderPane({}, [LINES[0] as ResultLineSummary]);

    expect(pane()).toHaveTextContent(t.result.linePair(ITEM_LABEL, LOT_LABEL, '30 SAMPLE-EA'));
    expect(pane().textContent ?? '').not.toContain('LOT-2026-900011');
  });

  /*
   * **ERP는 적재이지 전송이 아니다**(계약이 못 박았다). 세 갈래의 문구가 서로 달라야 뜻이
   * 구분되고, **어느 갈래에도 「전송 완료」가 없다.**
   */
  it.each([
    [true, t.result.erpQueued],
    [false, t.result.erpNotQueued],
    [null, t.result.erpUnknown],
  ])('ERP 적재 여부가 %s면 그 갈래의 문구를 낸다', (erpMessageQueued, expected) => {
    renderPane({ erpMessageQueued });

    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(pane().textContent ?? '').not.toContain('전송 완료');
  });

  /*
   * **응답에 키가 없으면 「알 수 없음」이다.** `?? true`로 접으면 아무 근거 없이
   * 「적재됐다」로 읽힌다 — 이 구획에서 가장 비싼 오해다.
   */
  it('응답에 ERP 키가 없으면 모른다고 말한다', () => {
    render(
      <ResultPane
        result={toReturnResultView(
          { ...goodsIssue(), erpMessageQueued: undefined },
          goodsIssueLineFixtures,
        )}
        lines={LINES}
      />,
    );

    expect(screen.getByText(t.result.erpUnknown)).toBeInTheDocument();
  });

  /* **M50 · C50** — 이름을 보이고 번호를 내지 않는다. 도착지 이름을 풀지도 않는다. */
  it('내부 번호를 내지 않는다', () => {
    const { container } = renderPane();

    /* 짝 방향 — 이름과 업무 번호가 실제로 그려졌다. */
    expect(container.textContent ?? '').toContain(ITEM_LABEL);
    expect(container.textContent ?? '').toContain('GI-2026-950001');

    for (const id of INTERNAL_IDS) {
      expect(container.textContent ?? '').not.toContain(id);
    }
  });

  /*
   * 사용자가 부르지 않은 시점에 나타나는 내용이라 **살아 있는 영역**으로 알린다 —
   * 스크린리더 사용자가 결과를 놓치지 않아야 한다.
   */
  it('결과가 살아 있는 영역으로 알려진다', () => {
    renderPane();

    expect(pane()).toBeInTheDocument();
  });
});

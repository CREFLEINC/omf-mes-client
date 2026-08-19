import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { progressStep, progressStepFixtures } from './fixtures';
import { buildStepColumns, formatStepAt, StepsPane, STEPS_TABLE_MIN_WIDTH_PX } from './steps-pane';

const t = messages.documentProgress;

const rowTexts = (stepCode: string): string[] =>
  [...screen.getByRole('row', { name: new RegExp(stepCode) }).querySelectorAll('td')].map(
    (cell) => cell.textContent ?? '',
  );

describe('buildStepColumns — 열 구성과 폭', () => {
  const columns = buildStepColumns();

  it('네 열이다 — 단계 · 시각 · 처리자 · 원장', () => {
    expect(columns.map((column) => column.key)).toEqual([
      'stepCode',
      'occurredAt',
      'actorName',
      'ledger',
    ]);
  });

  /**
   * **모든 열이 폭을 지정하고 합을 표 하한 아래로 누르지 않는다.** 고정 배치에서 미지정 열은
   * 남는 폭의 잔여분을 받아 선언과 실렌더가 어긋난다(전례 `balance-table`의 실측 근거).
   */
  it('모든 열이 폭을 지정하고 합이 표 하한 이상이다', () => {
    expect(columns.filter((column) => column.width === undefined)).toHaveLength(0);

    const fixed = columns.reduce(
      (sum, column) => sum + Number.parseInt(column.width ?? '0px', 10),
      0,
    );

    expect(fixed).toBe(928);
    expect(fixed).toBeGreaterThanOrEqual(STEPS_TABLE_MIN_WIDTH_PX);
  });

  /**
   * ⭐ **원장 열이 이 표에서 가장 긴 문면을 담는다** — 번호와 영업일이 **한 칸에 짝으로** 서기
   * 때문이다. 하한을 i18n의 실제 문면에서 계산해 리터럴 동어반복을 피한다.
   */
  it('원장 열이 반쪽 사실 문면을 담는다', () => {
    const CHAR_WIDTH_PX = 7.5;
    const CELL_PADDING_PX = 32;
    const longest = Math.max(
      t.ledger.pair('SYN-TX-9001', '2026-08-06').length,
      t.ledger.noBusinessDate('SYN-TX-9001').length,
      t.ledger.noTransactionNo('2026-08-06').length,
    );
    const ledgerColumn = columns.find((column) => column.key === 'ledger');

    expect(Number.parseInt(ledgerColumn?.width ?? '0px', 10)).toBeGreaterThanOrEqual(
      longest * CHAR_WIDTH_PX + CELL_PADDING_PX,
    );
  });

  it('선언한 폭이 렌더 산출물의 열 폭과 같다', () => {
    const { container } = render(<StepsPane steps={progressStepFixtures} />);
    const rendered = [...container.querySelectorAll('col')].map((col) => col.style.width);

    expect(rendered).toEqual(columns.map((column) => column.width ?? ''));
  });
});

describe('formatStepAt', () => {
  /* 시간대를 옮기지 않는다 — 옮기면 같은 문서가 보는 사람마다 다른 시각으로 보인다. */
  it('날짜와 분까지만 남기고 시간대를 옮기지 않는다', () => {
    expect(formatStepAt('2026-08-06T09:14:00+09:00')).toBe('2026-08-06 09:14');
    expect(formatStepAt('2026-08-06T09:14:00Z')).toBe('2026-08-06 09:14');
  });

  /* 형식이 아니면 **원문 그대로** 낸다 — 화면이 서버가 보낸 값을 삼키지 않는다. */
  it('형식이 아니면 원문을 그대로 낸다', () => {
    expect(formatStepAt('SYN-NOT-A-DATE')).toBe('SYN-NOT-A-DATE');
  });
});

describe('StepsPane', () => {
  /**
   * ⭐ **응답 차례 그대로 그린다.** 계약이 시간순으로 내리므로 화면이 다시 세우면 같은 시각의
   * 두 단계 차례가 서버와 갈린다 — 사용자에게는 「경과가 뒤집힌」 화면이 된다.
   */
  it('응답 차례 그대로 그린다', () => {
    render(<StepsPane steps={progressStepFixtures} />);

    const rows = screen.getAllByRole('row').slice(1);

    expect(rows.map((row) => row.querySelector('td')?.textContent)).toEqual([
      'SYN_STEP_REGISTERED',
      'SYN_STEP_POSTED',
      'SYN_STEP_CHECKED',
      'SYN_STEP_CLOSED',
    ]);
  });

  /* 단계 코드는 **그대로** 낸다 — 값 목록이 공통코드 소관이라 화면이 뜻을 붙이면 조용히 틀린다. */
  it('단계 코드를 그대로 낸다', () => {
    render(<StepsPane steps={[progressStep({ stepCode: 'SYN_STEP_UNKNOWN' })]} />);

    expect(screen.getByText('SYN_STEP_UNKNOWN')).toBeInTheDocument();
  });

  it('행위자 이름을 그대로 낸다', () => {
    render(<StepsPane steps={progressStepFixtures} />);

    expect(rowTexts('SYN_STEP_REGISTERED')).toContain('홍길동');
  });

  /**
   * ⭐ **행위자 이름이 비면 그 사실을 적고 다른 값을 대신 내지 않는다**(omf-mes#44).
   * 계약이 「사람이 한 것이 아니면 비어 있다」라고 적었으므로 그 사실을 옮긴다.
   */
  it('행위자 이름이 비면 사람이 하지 않은 단계라고 적는다', () => {
    render(<StepsPane steps={progressStepFixtures} />);

    const texts = rowTexts('SYN_STEP_POSTED');

    expect(texts).toContain(t.steps.systemActor);
    /* 대신 낼 만한 다른 값(단계 코드·번호)이 그 칸에 들어오지 않았다. */
    expect(texts.filter((text) => text === 'SYN_STEP_POSTED')).toHaveLength(1);
  });

  /**
   * ⭐ **원장 번호와 영업일은 둘 다 있을 때만 짝으로 보인다.** 원장은 영업일이 키의 일부라
   * 번호만으로는 찾을 수 없다.
   */
  it('원장 번호와 영업일이 한 칸에 함께 보인다', () => {
    render(<StepsPane steps={progressStepFixtures} />);

    const ledgerCell = rowTexts('SYN_STEP_REGISTERED').at(-1) ?? '';

    expect(ledgerCell).toContain('SYN-TX-9001');
    expect(ledgerCell).toContain('2026-08-06');
  });

  it('영업일이 없으면 그 사실이 번호와 함께 보인다', () => {
    render(<StepsPane steps={progressStepFixtures} />);

    expect(rowTexts('SYN_STEP_CHECKED').at(-1)).toBe(t.ledger.noBusinessDate('SYN-TX-9003'));
  });

  it('원장을 만들지 않은 단계는 값 없음 표식이다', () => {
    render(<StepsPane steps={progressStepFixtures} />);

    expect(rowTexts('SYN_STEP_CLOSED').at(-1)).toBe(t.values.empty);
  });

  /* 원장 **진입을 만들지 않는다** — 원장 조회 화면이 이 저장소에 없다. 그 사실을 밝힌다. */
  it('원장으로 가는 손잡이가 없고 그 사실을 밝힌다', () => {
    render(<StepsPane steps={progressStepFixtures} />);

    expect(screen.getByText(t.steps.ledgerNote)).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  /* 경과가 0건인 문서도 실재한다 — 표를 늘 그리고 `empty` 슬롯이 그 갈래를 맡는다. */
  it('경과가 없으면 빈 상태 문구가 보인다', () => {
    render(<StepsPane steps={[]} />);

    expect(screen.getByText(t.steps.emptyTitle)).toBeInTheDocument();
  });

  /**
   * 표의 행 열쇠 — **단계 코드만으로는 가릴 수 없다.** 같은 코드가 여러 번 일어날 수 있어
   * 시각을 함께 잇는다. 미지정이면 인덱스가 React key가 되어 앞 줄이 사라질 때 뒷줄의 DOM
   * 노드가 대신 지워진다(사본 체크리스트 2번).
   */
  it('앞 줄이 사라져도 뒷줄의 DOM 노드가 그대로 남는다', () => {
    const { rerender } = render(<StepsPane steps={progressStepFixtures} />);
    const kept = screen.getByRole('row', { name: /SYN_STEP_CLOSED/ });

    rerender(<StepsPane steps={progressStepFixtures.slice(1)} />);

    expect(screen.getByRole('row', { name: /SYN_STEP_CLOSED/ })).toBe(kept);
  });

  /* 같은 단계 코드가 두 번 일어나도 서로 다른 행이다 — 시각이 그 둘을 가른다. */
  it('같은 단계 코드가 두 번 와도 두 행이다', () => {
    render(
      <StepsPane
        steps={[
          progressStep({ occurredAt: '2026-08-06T09:00:00+09:00' }),
          progressStep({ occurredAt: '2026-08-06T18:00:00+09:00' }),
        ]}
      />,
    );

    const table = screen.getByRole('table');

    expect(within(table).getAllByRole('row')).toHaveLength(3);
  });
});

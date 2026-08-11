import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { countResponse, summaryResponse } from './fixtures';
import { SummaryPane, type SummaryPaneProps } from './summary-pane';
import { toCountSummaryView, toCountView } from './types';

const t = messages.stocktaking;

const WAREHOUSE_LABEL = 'SAMPLE-WH-01 · 합성 창고 가';

const renderPane = (overrides: Partial<SummaryPaneProps> = {}) =>
  render(
    <SummaryPane
      count={toCountView(countResponse())}
      summary={toCountSummaryView(summaryResponse())}
      warehouseName={WAREHOUSE_LABEL}
      {...overrides}
    />,
  );

const summaryGroup = (): HTMLElement =>
  screen.getByRole('group', { name: t.detail.summaryLabel });

describe('SummaryPane — 제목줄', () => {
  it('실사번호·유형·창고·계획일·블라인드·상태를 보인다', () => {
    renderPane();

    const heading = screen.getByRole('group', { name: t.detail.label });

    expect(within(heading).getByText('IC-2026-900011')).toBeInTheDocument();
    expect(within(heading).getByText('SAMPLE_COUNT_TYPE_A')).toBeInTheDocument();
    expect(within(heading).getByText(WAREHOUSE_LABEL)).toBeInTheDocument();
    expect(within(heading).getByText('2026-08-06')).toBeInTheDocument();
    expect(within(heading).getByText('아니오')).toBeInTheDocument();
    expect(within(heading).getByText('SAMPLE_COUNT_STATUS_A')).toBeInTheDocument();
  });

  /* **C18** — 상태 코드를 값으로 분기하지 않고 서버가 준 문자열을 그대로 낸다. */
  it('상태 코드가 무엇이든 그대로 낸다', () => {
    renderPane({ count: toCountView(countResponse({ statusCode: 'SAMPLE_COUNT_STATUS_Z' })) });

    expect(screen.getByText('SAMPLE_COUNT_STATUS_Z')).toBeInTheDocument();
  });

  /* **#44** — 제목줄 어디에도 내부 번호가 없다. 짝 방향으로 이름이 보이는 것을 함께 단언한다. */
  it('제목줄에 내부 번호를 내지 않는다', () => {
    const { container } = renderPane();

    expect(screen.getByText(WAREHOUSE_LABEL)).toBeInTheDocument();
    expect(container.textContent ?? '').not.toContain('9001');
    expect(container.textContent ?? '').not.toContain('9101');
  });

  /*
   * **블라인드는 읽기 전용 표기다**(계획 결정 4). 실사 헤더를 고치는 오퍼레이션이 계약에
   * 없으므로 비활성 컨트롤을 두지 않는다 — 두면 「언젠가 켜질 것」으로 읽힌다.
   */
  it('블라인드 실사에는 바꿀 수 없다는 안내가 붙고 컨트롤이 없다', () => {
    renderPane({ count: toCountView(countResponse({ blindCount: true })) });

    expect(screen.getByText('예')).toBeInTheDocument();
    expect(screen.getByText(t.detail.blindNote)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  /* 짝 방향 — 블라인드가 아니면 그 안내를 내지 않는다. 남으면 화면이 거짓말을 한다. */
  it('블라인드가 아니면 그 안내를 내지 않는다', () => {
    renderPane();

    expect(screen.queryByText(t.detail.blindNote)).not.toBeInTheDocument();
  });
});

describe('SummaryPane — 요약 4칸', () => {
  it('네 칸의 라벨과 숫자가 서버 값 그대로다', () => {
    renderPane();

    const group = summaryGroup();

    expect(within(group).getByText(t.detail.planned)).toBeInTheDocument();
    expect(within(group).getByText('40')).toBeInTheDocument();
    expect(within(group).getByText(t.detail.counted)).toBeInTheDocument();
    expect(within(group).getByText('25')).toBeInTheDocument();
    expect(within(group).getByText(t.detail.uncounted)).toBeInTheDocument();
    expect(within(group).getByText('15')).toBeInTheDocument();
    expect(within(group).getByText(t.detail.variance)).toBeInTheDocument();
    expect(within(group).getByText('6')).toBeInTheDocument();
  });

  /*
   * **M21** — 요약은 **서버가 준 숫자**이고 화면이 세거나 빼서 만든 것이 아니다.
   * 합이 맞지 않는 요약을 그대로 보이는지가 그 판정의 유일한 잣대다 —
   * 「미실사 = 계획 − 카운트」처럼 화면이 계산하면 여기서 9 대신 15가 나온다.
   */
  it('합이 맞지 않는 요약도 서버가 준 대로 보인다', () => {
    renderPane({
      summary: toCountSummaryView(
        summaryResponse({ plannedCount: 40, countedCount: 25, uncountedCount: 9, varianceCount: 6 }),
      ),
    });

    const group = summaryGroup();

    expect(within(group).getByText('9')).toBeInTheDocument();
    expect(within(group).queryByText('15')).not.toBeInTheDocument();
  });

  /*
   * **자릿수 구분·반올림을 붙이지 않는다.** 화면이 값을 손대는 자리를 만들면 「서버가 준 대로
   * 보인다」가 곧 깨진다. 세 자리 픽스처로는 그 규칙이 아무것도 재지 못한다 — 서식을 붙여도
   * 결과가 같기 때문이다. 착수 이슈가 「창고 하나에 수백~수천 건」이라 했고 계약 예시도 네
   * 자리이므로 **실서버 값은 네 자리를 예사로 넘는다.**
   */
  it('네 자리가 넘는 건수에 자릿수 구분을 붙이지 않는다', () => {
    renderPane({
      summary: toCountSummaryView(
        summaryResponse({ plannedCount: 1240, countedCount: 1180, uncountedCount: 60, varianceCount: 12 }),
      ),
    });

    const group = summaryGroup();

    expect(within(group).getByText('1240')).toBeInTheDocument();
    expect(within(group).getByText('1180')).toBeInTheDocument();
    expect(within(group).queryByText('1,240')).not.toBeInTheDocument();
    expect(within(group).queryByText('1,180')).not.toBeInTheDocument();
  });

  it('0건도 그대로 보인다', () => {
    renderPane({
      summary: toCountSummaryView(
        summaryResponse({ plannedCount: 0, countedCount: 0, uncountedCount: 0, varianceCount: 0 }),
      ),
    });

    expect(within(summaryGroup()).getAllByText('0')).toHaveLength(4);
  });

  it('이 숫자가 서버에서 왔다는 사실을 밝힌다', () => {
    renderPane();

    expect(screen.getByText(t.detail.summaryNote)).toBeInTheDocument();
  });

  /* 네 칸 모두 단위가 「건」이다 — 수량이 아니라 라인 수라는 사실이 읽혀야 한다. */
  it('네 칸의 단위가 건이다', () => {
    renderPane();

    expect(within(summaryGroup()).getAllByText(t.detail.countUnit)).toHaveLength(4);
  });
});

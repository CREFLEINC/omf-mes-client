import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { quality, qualityBlock } from './quality.fixture';
import { toNiceRateTicks } from './viz';
import {
  IqcTab,
  NonconformanceTab,
  OqcTab,
  PqcTab,
  QualityGate,
  QualityOverviewTab,
  formatRate,
  rateDelta,
} from './quality-panels';

const t = messages.dashboard.quality;
const v = messages.dashboard.viz;

describe('품질 탭', () => {
  it('합격률은 서버 값 그대로, 모수가 없으면(null) 0%가 아니라 「—」 · 전월 대비 p', () => {
    expect(formatRate(96.4)).toBe('96.4%');
    expect(formatRate(null)).toBe(t.rateNone);
    expect(rateDelta(93.7, 87.2)).toEqual({ direction: 'up', text: t.deltaUp('6.5') });
    expect(rateDelta(94, 95)).toEqual({ direction: 'down', text: t.deltaDown('1') });
    expect(rateDelta(95, 95)).toEqual({ direction: 'flat', text: t.deltaFlat });
    expect(t.deltaUp('6.5')).toBe('↑ 6.5p');
    expect(rateDelta(null, 95)).toBeNull();
  });

  it('품질 종합 — 세 유형 합격률 · 금일 검사 LOT · 고객 반품 · 일별 3계열 · 최근 판정 · 현재 현황', () => {
    render(<QualityOverviewTab quality={quality()} />);

    expect(screen.getByRole('group', { name: t.passRateOf('IQC') })).toBeInTheDocument();
    /* 금일 검사 LOT — 합계 크게, 합격 · 불합격 · 검사 보류를 막대와 같은 색 점 + 이름 + 수량으로(사용자 지시 2026-10-19). */
    const lots = screen.getByRole('group', { name: t.todayLots });
    expect(lots).toHaveTextContent('12');
    expect(lots.querySelectorAll('.dash-lot-legend-item')).toHaveLength(3);
    expect(lots).toHaveTextContent(
      `${t.lotLegend.accepted}6${t.lotLegend.rejected}3${t.lotLegend.held}3`,
    );
    expect(screen.getByRole('group', { name: t.customerReturn })).toHaveTextContent('40');
    expect(screen.getByRole('group', { name: t.customerReturn })).toHaveTextContent(
      t.customerReturnNoteShort,
    );
    expect(screen.getByRole('img', { name: t.dailyTitleAll })).toBeInTheDocument();
    /* 불량현상이 빈 배열이면 「기록 없음」. */
    expect(screen.getByText(v.noRecords)).toBeInTheDocument();
    const recent = screen.getByRole('table', { name: t.recentLots });
    expect(within(recent).getByText(t.judgment.HELD)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: t.currentTitle })).toHaveTextContent(t.receiptHold);
  });

  it('⛔ 「선별」을 어디에도 쓰지 않는다 — MES 용어(검사 보류 · 전수 재검)를 쓴다', () => {
    const { container } = render(
      <>
        <QualityOverviewTab quality={quality()} />
        <IqcTab quality={quality()} />
        <PqcTab quality={quality()} />
        <OqcTab quality={quality()} />
        <NonconformanceTab quality={quality()} />
      </>,
    );

    expect(container.textContent).not.toContain('선별');
    expect(JSON.stringify(messages.dashboard)).not.toContain('선별');
  });

  it('IQC — 전수 재검이 null 이면 칸을 두지 않고, 값이 오면 투입 · 양품 복원을 보인다', () => {
    const { rerender } = render(<IqcTab quality={quality()} />);
    expect(screen.queryByText(t.fullReinspect)).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: t.topVendor })).toHaveTextContent('공급사 A');

    const q = quality();
    q.iqc.fullReinspect = { inputQty: 80, restoredQty: 70 };
    rerender(<IqcTab quality={q} />);
    expect(screen.getByText(t.fullReinspectNote('80', '70'))).toBeInTheDocument();
  });

  it('PQC — 최근 판정은 호기 열, 시안대로 LOT 열은 두지 않는다', () => {
    render(<PqcTab quality={quality()} />);

    const recent = screen.getByRole('table', { name: t.recentLotsOf('PQC') });
    expect(within(recent).getByText('EQ-01')).toBeInTheDocument();
    expect(within(recent).queryByRole('columnheader', { name: 'LOT' })).not.toBeInTheDocument();
    expect(screen.getByText(t.reworkLine('1'))).toBeInTheDocument();
  });

  it('PQC 호기별 불량률 — 높은 순, 같은 값은 설비 코드 자연 정렬(17-1 < 17-2 < 17-10)', () => {
    const q = quality();
    q.pqc.equipmentDefectRates = ['E-17-1', 'E-17-10', 'E-17-11', 'E-17-2', 'E-9-1'].map(
      (code, index) => ({
        equipmentId: index + 1,
        equipmentCode: code,
        defectRate: code === 'E-9-1' ? 7 : 5,
        ngQty: 1,
      }),
    );
    const { container } = render(<PqcTab quality={q} />);

    const labels = [...container.querySelectorAll('.dash-rank-label')].map((l) => l.textContent);
    expect(labels).toEqual(['E-9-1', 'E-17-1', 'E-17-2', 'E-17-10', 'E-17-11']);
  });

  it('OQC — 고객 반품 · 최근 판정(고객)만 두고 금액 · 클레임 칸은 없다', () => {
    render(<OqcTab quality={quality()} />);

    expect(screen.getByRole('group', { name: t.customerReturn })).toBeInTheDocument();
    expect(screen.getAllByRole('region')).toHaveLength(2);
  });

  it('부적합 — 조치 기한 초과가 null 이면 칸을 두지 않고, 값이 오면 보인다', () => {
    const q = quality();
    const { rerender } = render(<NonconformanceTab quality={q} />);
    expect(screen.queryByText(t.ncOverdue)).not.toBeInTheDocument();

    q.nonconformance.overdueCount = 2;
    rerender(<NonconformanceTab quality={q} />);
    expect(screen.getAllByText(t.ncOverdue).length).toBeGreaterThan(0);
  });

  it('섹션이 오지 않음과 첫 조회 실패를 가른다', () => {
    const { rerender } = render(
      <QualityGate quality={null} isLoading={false} isFailed={false}>
        {() => null}
      </QualityGate>,
    );
    expect(screen.getByText(t.absent)).toBeInTheDocument();

    rerender(
      <QualityGate quality={null} isLoading={false} isFailed>
        {() => null}
      </QualityGate>,
    );
    expect(screen.getByText(t.failed)).toBeInTheDocument();
  });

  /*
   * 품질 탭 레이아웃(사용자 지정 2026-10-16) — 주 그래프만 행 높이에 맞춰 커진다(`.dash-chart-fit`). 데이터가 없는
   * 그래프는 그 자리를 두지 않는다 — 빈 카드를 그래프 높이로 키우지 않는다. 틀은 품질 탭 전용 클래스다.
   */
  it('레이아웃 — 품질 탭 전용 틀, 데이터가 있는 주 그래프만 높이 맞춤 자리', () => {
    const { container, unmount } = render(<IqcTab quality={quality()} />);
    expect(container.querySelector('.dash-tab.dash-tab-quality')).not.toBeNull();
    expect(container.querySelectorAll('.dash-chart-fit')).toHaveLength(1);
    unmount();

    const empty = quality();
    empty.iqc = {
      ...empty.iqc,
      ...qualityBlock({
        dailyPassRates: [{ date: '2026-10-16', passRate: null }],
      }),
    };
    const second = render(<IqcTab quality={empty} />);
    expect(second.container.querySelector('.dash-chart-fit')).toBeNull();
    second.unmount();

    /* 부적합 파레토가 비었으면 높이 맞춤 자리를 두지 않는다. */
    const nc = render(<NonconformanceTab quality={quality()} />);
    expect(nc.container.querySelector('.dash-chart-fit')).toBeNull();
  });

  it('품질 종합 합격률 — 숫자와 % 를 나누고, 전월 값이 없으면 「전월 데이터 없음」, 있으면 증감 %p(사용자 지시 2026-10-19)', () => {
    const data = quality();
    data.pqc = { ...data.pqc, monthPassRate: 90.4, prevMonthPassRate: 92.7 };
    render(<QualityOverviewTab quality={data} />);

    expect(screen.getByRole('group', { name: t.passRateOf('IQC') })).toHaveTextContent(
      t.prevMissing,
    );
    const pqc = screen.getByRole('group', { name: t.passRateOf('PQC') });
    expect(pqc).toHaveTextContent('90.4%');
    expect(pqc).toHaveTextContent('전월 92.7% · ↓ 2.3%p');
    expect(pqc.querySelector('.dash-delta')).toHaveClass('dash-delta-bad');
  });

  it('품질 종합 일별 합격률 — 날짜 칸에 마우스를 올리면 날짜와 유형별 합격률', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<QualityOverviewTab quality={quality()} />);

    const hit = screen.getAllByRole('button', { name: /^2026\.10\.14/ })[0];
    if (hit === undefined) throw new Error('날짜 칸 단추가 없다');
    await user.hover(hit);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('2026.10.14');
    expect(tip).toHaveTextContent('IQC95%');
    unmount();
  });

  /* IQC · PQC · OQC · 부적합 탭 — 품질 종합과 같은 표기(사용자 확정 2026-10-19 · r3). */
  it('IQC · PQC · OQC — 합격률 칸은 품질 종합 형식, LOT 칸은 색 점 범례, 일별 그래프 툴팁', async () => {
    const user = userEvent.setup();
    const data = quality();
    data.pqc = { ...data.pqc, monthPassRate: 90.4, prevMonthPassRate: 92.7 };

    const iqc = render(<IqcTab quality={data} />);
    expect(iqc.container.querySelector('.dash-tab-quality-detail')).not.toBeNull();
    expect(screen.getByRole('group', { name: t.passRateOf('IQC') })).toHaveTextContent(
      t.prevMissing,
    );
    expect(
      screen.getByRole('group', { name: t.monthLots }).querySelectorAll('.dash-lot-legend-item'),
    ).toHaveLength(3);
    const hit = screen.getAllByRole('button', { name: /^2026\.10\.14/ })[0];
    if (hit === undefined) throw new Error('날짜 칸 단추가 없다');
    await user.hover(hit);
    expect(screen.getByRole('tooltip')).toHaveTextContent('IQC95%');
    iqc.unmount();

    const pqc = render(<PqcTab quality={data} />);
    expect(screen.getByRole('group', { name: t.passRateOf('PQC') })).toHaveTextContent(
      '전월 92.7% · ↓ 2.3%p',
    );
    pqc.unmount();

    render(<OqcTab quality={data} />);
    expect(screen.getByRole('group', { name: t.customerReturn })).toHaveTextContent(
      t.customerReturnNoteShort,
    );
  });

  it('보기 좋은 y축 눈금 — 범위는 그대로 두고 1 · 2 · 2.5 · 5 × 10ⁿ 간격만 고른다', () => {
    expect(toNiceRateTicks({ min: 0, max: 100 })).toEqual([0, 20, 40, 60, 80, 100]);
    expect(toNiceRateTicks({ min: 87.3, max: 100 })).toEqual([87.5, 90, 92.5, 95, 97.5, 100]);
    expect(toNiceRateTicks({ min: 92.6, max: 98.1 })).toEqual([93, 94, 95, 96, 97, 98]);
    expect(toNiceRateTicks({ min: 50, max: 50 })).toEqual([50]);
  });

  it('부적합 파레토 — 막대 값 글자는 누적선 위에 테두리와 함께 그린다', () => {
    const data = quality();
    data.nonconformance = {
      ...data.nonconformance,
      phenomena: [
        { defectCodeId: 1, defectCode: 'D01', defectName: '찍힘', qty: 20 },
        { defectCodeId: 2, defectCode: 'D02', defectName: '긁힘', qty: 10 },
      ],
    };
    const { container } = render(<NonconformanceTab quality={data} />);
    const svg = container.querySelector('.dash-tab-quality-detail svg');
    if (svg === null) throw new Error('파레토 그림이 없다');
    const values = svg.querySelectorAll('.dash-bar-value-halo');
    expect(values).toHaveLength(2);
    const line = svg.querySelector('.dash-line');
    const first = values[0];
    if (line === null || first === undefined) throw new Error('누적선이 없다');
    expect(line.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

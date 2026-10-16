import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { quality } from './quality.fixture';
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
    expect(rateDelta(93.7, 87.2)).toBe(t.deltaUp('6.5'));
    expect(rateDelta(94, 95)).toBe(t.deltaDown('1'));
    expect(rateDelta(null, 95)).toBeNull();
  });

  it('품질 종합 — 세 유형 합격률 · 금일 검사 LOT · 고객 반품 · 일별 3계열 · 최근 판정 · 현재 현황', () => {
    render(<QualityOverviewTab quality={quality()} />);

    expect(screen.getByRole('group', { name: t.passRateOf('IQC') })).toBeInTheDocument();
    /* 이름과 숫자 사이는 붙는 칸(U+00A0) — 화면 글자를 비교할 때는 보통 칸으로 본다. */
    expect(
      screen.getByText(t.lotBreakdown('6', '3', '3').replace(/\u00a0/g, ' ')),
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: t.customerReturn })).toHaveTextContent('40');
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
});

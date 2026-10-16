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
} from './quality-panels';

const t = messages.dashboard.quality;

describe('품질 탭', () => {
  it('합격률은 서버 값 그대로, 모수가 없으면(null) 0%가 아니라 「—」', () => {
    expect(formatRate(96.4)).toBe('96.4%');
    expect(formatRate(null)).toBe(t.rateNone);
  });

  it('품질 종합 — 세 유형 합격률 · 전월 · 금일 검사 LOT 보류 건수 · 최근 판정', () => {
    render(<QualityOverviewTab quality={quality()} />);

    expect(screen.getByText(t.monthPassRate('IQC'))).toBeInTheDocument();
    expect(screen.getAllByText(t.prevMonth(t.rateNone))).toHaveLength(3);
    expect(screen.getByText(t.lotBreakdown('6', '3', '3'))).toBeInTheDocument();
    /* 불량현상이 빈 배열이면 「기록 없음」. */
    expect(screen.getByText(t.noRecords)).toBeInTheDocument();
    const recent = screen.getByRole('table', { name: t.recentLots });
    expect(within(recent).getByText(t.judgment.HELD)).toBeInTheDocument();
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
    expect(JSON.stringify(t)).not.toContain('선별');
  });

  it('IQC — 전수 재검이 null 이면 칸을 두지 않는다 · 입고 보류 LOT · 최다 불량 업체', () => {
    render(<IqcTab quality={quality()} />);

    expect(screen.queryByText(t.fullReinspect)).not.toBeInTheDocument();
    expect(screen.getByText(t.receiptHold)).toBeInTheDocument();
    expect(screen.getAllByText('공급사 A').length).toBeGreaterThan(0);
  });

  it('IQC — 전수 재검 값이 오면 투입 · 양품 복원을 보인다', () => {
    const q = quality();
    q.iqc.fullReinspect = { inputQty: 80, restoredQty: 70 };
    render(<IqcTab quality={q} />);

    expect(screen.getByText(t.fullReinspectNote('80', '70'))).toBeInTheDocument();
  });

  it('PQC — LOT 번호가 없으면 「—」, 호기 열을 보인다', () => {
    render(<PqcTab quality={quality()} />);

    const recent = screen.getByRole('table', { name: t.recentLots });
    expect(within(recent).getByText('EQ-01')).toBeInTheDocument();
    expect(within(recent).getByText(t.none)).toBeInTheDocument();
    expect(screen.getByText(t.pendingLots)).toBeInTheDocument();
  });

  it('OQC — 「고객 반품」 수량', () => {
    render(<OqcTab quality={quality()} />);

    expect(screen.getByText(t.customerReturn)).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
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

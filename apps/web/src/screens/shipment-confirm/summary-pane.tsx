import { AlertBanner, StatCard } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import type { ElapsedSummary } from './elapsed';

const t = messages.shipmentConfirm;

export interface SummaryPaneProps {
  /** 조회 조건 전체의 미확정 건수. 쪽이 아니라 **총계**다. */
  total: number;
  /** 이 쪽에 받은 것으로 센 경과 구간. */
  page: ElapsedSummary;
  /** 이 쪽에 받은 것 중 이달 실물 출하분. */
  thisMonth: number;
}

/**
 * 적체 현황.
 *
 * ⚠ **총계와 구간별 수의 출처가 다르다.** 총계는 서버가 준 `page.total`이라 정확하지만, 경과
 * 구간은 **이 쪽에 받은 것으로만** 센다(공유계약 L-11) — 목록이 쪽 단위라 그럴 수밖에 없고,
 * 그 사실을 감추면 「26건 중 4건만 늦었구나」로 잘못 읽는다.
 */
export const SummaryPane = ({ total, page, thisMonth }: SummaryPaneProps) => (
  <section className="pane" aria-label={t.panes.summary}>
    <h2>{t.panes.summary}</h2>
    <div className="filter-bar">
      <StatCard label={t.summary.unconfirmed} value={t.summary.unit(total)} />
      <StatCard label={t.summary.overdue} value={t.summary.unit(page.overdue)} />
      <StatCard label={t.summary.critical} value={t.summary.unit(page.critical)} />
    </div>
    <p className="field-note">{t.summary.pageScoped}</p>

    {/*
     * §5-7 — ⚠ 이유가 «회계»가 아니다. 회계 전기일은 ERP 소관이고, 적체가 위험한 이유는
     * 마감된 기간을 연계가 거부하기 때문이다. 잘못된 이유를 적으면 남의 일로 읽힌다.
     */}
    {thisMonth > 0 && (
      <div className="banner-slot">
        <AlertBanner variant="warning">{t.summary.monthEndWarning(thisMonth)}</AlertBanner>
      </div>
    )}

    {/* A-11 — 못 보이는 것을 못 보인다고 적는다. 조용히 빼면 「없는 기능」으로 읽힌다. */}
    <div className="banner-slot">
      <AlertBanner variant="info">{t.withdrawn.autoConfirm}</AlertBanner>
    </div>
  </section>
);

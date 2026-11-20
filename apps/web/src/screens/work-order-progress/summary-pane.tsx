import { StatCard } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

export interface SummaryPaneProps {
  /**
   * 필터에 걸린 **전체** 건수. 서버가 준 값이다(`page.total`).
   * 아직 조회하지 않았거나 받지 못했으면 `null`.
   */
  total: number | null;
}

/**
 * 요약 구획 — **필터에 걸린 것 전부**를 센 숫자다(목록의 이 페이지가 아니다).
 *
 * ⛔ **목록을 받아 세지 않는다.** 공유계약 L-1이 정면으로 금지한 것이고, 실제로 셀 수도 없다 —
 * 화면이 손에 쥔 것은 50건인데 요약이 답해야 하는 질문은 「128건 중 몇 건인가」다. 모집단이
 * 다르므로 근사값도 아니고 **다른 수**가 나온다.
 *
 * ⚠ **그래서 지금은 「전체」 하나만 세운다.** 서버가 상태별 건수·수량 합계·달성률을 내려 주지
 * 않는다(omf-mes#265). 받을 수 없는 칸은 세우지 않는다 — 빈 칸과 그 이유를 늘 보이는 것은 군더더기다
 * (관리웹 정리 시안 A, 2026-11-20). 집계가 오면 그 칸을 더한다.
 *
 * ⚠ 상태 다섯의 이름은 **가정**이다(스펙 §5-4) — 상태 코드 값 목록이 아직 확정되지 않아
 * 값이 오면 카드가 늘거나 이름이 바뀔 수 있다.
 */
export const SummaryPane = ({ total }: SummaryPaneProps) => {
  const t = messages.workOrderProgress.summary;

  return (
    <section className="pane work-order-progress-pane" aria-label={t.title}>
      <h2 className="pane-title">{t.title}</h2>

      <div className="work-order-progress-summary-grid">
        <StatCard label={t.total} value={total === null ? t.unavailableMark : String(total)} />
      </div>
    </section>
  );
};

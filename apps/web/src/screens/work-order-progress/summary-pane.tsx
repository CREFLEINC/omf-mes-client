import { AlertBanner, StatCard } from '@crefle/web-ui';
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
 * ⚠ **그래서 지금은 「전체」 하나만 채운다.** 서버가 상태별 건수·수량 합계·달성률을 내려 주지
 * 않는다(omf-mes#265). 나머지 칸은 **비우되 이유를 적는다** — 감추면 「이 화면엔 원래 없다」로
 * 읽히고, 지어내면 거짓이 된다. **집계가 오면 비워 둔 칸만 채우면 되고 구조는 그대로다.**
 *
 * ⚠ 상태 다섯의 이름은 **가정**이다(스펙 §5-4) — 상태 코드 값 목록이 아직 확정되지 않아
 * 값이 오면 카드가 늘거나 이름이 바뀔 수 있다.
 */
export const SummaryPane = ({ total }: SummaryPaneProps) => {
  const t = messages.workOrderProgress.summary;

  /* 「전체」만 서버가 준 값이고, 나머지는 아직 받을 수 없는 자리다. */
  const cards = [
    { label: t.waiting },
    { label: t.running },
    { label: t.done },
    { label: t.closed },
    { label: t.delayed },
    { label: t.goodQty },
    { label: t.defectQty },
    { label: t.lossQty },
    { label: t.achievementRate },
  ];

  return (
    <section aria-label={t.title}>
      <h2 className="field-label">{t.title}</h2>

      <div className="filter-bar">
        <StatCard label={t.total} value={total === null ? t.unavailableMark : String(total)} />
        {cards.map((card) => (
          <StatCard key={card.label} label={card.label} value={t.unavailableMark} />
        ))}
      </div>

      <div className="banner-slot">
        <AlertBanner variant="info">{t.unavailable}</AlertBanner>
      </div>
    </section>
  );
};

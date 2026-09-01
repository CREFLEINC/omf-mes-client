import { AlertBanner, StatCard } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

/**
 * 요약 구획 — 계획은 `/inventory/balances` 응답의 `summary`(품목수·LOT수·보유·가용·보류
 * 합계 — 전부 필수)와 최상위 `expiryUnknownCount`로 이 구획을 채우라고 지시했다.
 *
 * ⚠ **그 필드들이 이 화면이 쓰는 API 타입에 아직 없다.** 설계 저장소의 OpenAPI 정본에는
 * `summary`가 있지만, 이 클라이언트가 생성한 계약에는 실려 있지 않다(`types.ts`가 원인을
 * 적어 두었다). `page.total`로 대신 채우는 것도 하지 않는다 — `page.total`은 지금 고른
 * 「묶기」축 안에서의 건수라 「품목수」·「LOT수」와 늘 같은 뜻이 아니고(위치별 보기에서는
 * 둘 다 아니다), 다른 뜻의 수를 같은 자리에 놓으면 화면이 잘못된 답을 정확한 답처럼
 * 낸다 — `work-order-progress`의 요약 구획이 「목록을 받아 세지 않는다」로 금지한 것과
 * 같은 함정이다.
 *
 * ⚠ **그래서 지금은 전부 「불러올 수 없음」이다.** 계약 생성물이 갱신되면 이 구획을
 * `summary` 필드로 채우고 `unavailable` 안내를 걷어낸다 — 구조는 이미 그대로 둘 수 있게
 * 짜여 있다(`work-order-progress`의 `SummaryPane`과 같은 형태).
 */
export const SummaryPanel = () => {
  const t = messages.productStockStatus.summary;

  const cards = [
    { key: 'itemCount', label: t.itemCount },
    { key: 'lotCount', label: t.lotCount },
    { key: 'onHandQty', label: t.onHandQty },
    { key: 'availableQty', label: t.availableQty },
    { key: 'blockedQty', label: t.blockedQty },
  ];

  return (
    <section aria-label={t.title}>
      <h2 className="field-label">{t.title}</h2>

      <div className="filter-bar">
        {cards.map((card) => (
          <StatCard key={card.key} label={card.label} value={t.unavailableMark} />
        ))}
      </div>

      <div className="banner-slot">
        <AlertBanner variant="info">{t.unavailable}</AlertBanner>
      </div>
    </section>
  );
};

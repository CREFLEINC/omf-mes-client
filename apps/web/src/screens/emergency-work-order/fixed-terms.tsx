import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

/**
 * W-02-07 「바꿀 수 없는 조건」 구획.
 *
 * ⛔ **이 구획에는 컨트롤이 하나도 없다.** 유형·승인·자재 출고요청·자원 배정 넷은 전부
 * 확정이라 사용자가 고를 것이 없고, 고를 수 없는 것을 컨트롤로 그리면 — 비활성이든 기본값
 * 꺼짐이든 — 「지금은 이렇지만 켤 수도 있는 것」으로 읽힌다. 확정을 기본값으로 구현하면
 * 확정이 무너진다(G-4). 그래서 넷을 **값**으로만 적는다.
 *
 * ⛔ **자원 배정은 구획 자체를 만들지 않는다.** 비어 있는 배정 구획을 두면 「채워야 하는데
 * 못 채운 자리」가 되고, 넷 중 이것만 성격이 달라진다. 여기 한 줄로 대신한다.
 *
 * 넷을 한 자리에 모은 이유는 흩어 놓으면 각각이 개별 제약으로 읽히기 때문이다 — 모아 놓아야
 * 「이 화면은 원래 이렇게 생겼다」로 읽힌다.
 */
export const FixedTermsPane = () => {
  const t = messages.emergencyWorkOrder.fixedTerms;
  const terms = [t.type, t.approval, t.materialRequest, t.resource];

  return (
    <section aria-label={t.title}>
      <h2 className="field-label">{t.title}</h2>
      <p>{t.lead}</p>

      <dl className="filter-bar">
        {terms.map((term) => (
          <div className="field-cell" key={term.label}>
            <dt className="field-label">{term.label}</dt>
            <dd>
              <strong>{term.value}</strong>
              <p>{term.note}</p>
            </dd>
          </div>
        ))}
      </dl>

      <div className="banner-slot">
        <AlertBanner variant="info">{t.internalOrder}</AlertBanner>
      </div>
    </section>
  );
};

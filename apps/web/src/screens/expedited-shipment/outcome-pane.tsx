import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.expeditedShipment;

/**
 * ⑤ **확정하면 일어나는 일** — 버튼 «바로 위»에 둔다(공유계약 J-7 · §5-2).
 *
 * ⭐ **원클릭이라 누르기 전에는 무엇이 일어나는지 알 수 없다.** 정상 흐름 넷을 하나로 접었으므로
 * 창고 경유·피킹·포장이 전부 빠지는데, 그것을 적지 않으면 **무엇을 건너뛰는지 모른 채 누른다.**
 *
 * ⭐ **마지막 두 줄이 「일어나지 않는 것」이다.** J-5가 「승인하면 무엇이 일어나는가」였다면
 * 이 화면은 **「건너뛰면 무엇이 안 일어나는가」**다.
 *
 * 조건 없이 항상 보인다 — 관문이 막혀 있어도 사용자가 이 화면의 성격을 미리 알아야 한다.
 * 정적 문구뿐이라 props가 없다.
 */
export const OutcomePane = () => (
  <section className="pane" aria-label={t.panes.outcome}>
    <h2>{t.panes.outcome}</h2>
    <div className="banner-slot">
      <AlertBanner variant="warning" title={t.outcome.irreversible}>
        <ul>
          <li>{t.outcome.receipt}</li>
          <li>{t.outcome.shipment}</li>
          <li>{t.outcome.unconfirmed}</li>
          <li>{t.outcome.rollback}</li>
          <li>{t.outcome.skipped}</li>
          <li>{t.outcome.qualityGate}</li>
        </ul>
      </AlertBanner>
    </div>
  </section>
);

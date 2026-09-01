import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.shipmentProcessing;

/**
 * ③확정하면 일어나는 일 — 항상 노출되는 결과 안내(계획서 결정).
 *
 * 되돌릴 수 없는 쓰기라 「무엇이 일어나는지」를 조건 없이 미리 밝힌다 — 관문이 막혀 있어도
 * 사용자가 이 화면의 성격을 미리 알아야 한다. 정적 문구뿐이라 props가 없다.
 */
export const OutcomePane = () => (
  <section className="pane" aria-label={t.panes.outcome}>
    <h2>{t.panes.outcome}</h2>
    <div className="banner-slot">
      <AlertBanner variant="warning" title={t.outcome.irreversible}>
        <ul>
          <li>{t.outcome.inventory}</li>
          <li>{t.outcome.unconfirmed}</li>
        </ul>
      </AlertBanner>
    </div>
  </section>
);

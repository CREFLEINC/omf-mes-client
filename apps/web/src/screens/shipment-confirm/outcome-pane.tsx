import { AlertBanner } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.shipmentConfirm;

export interface OutcomePaneProps {
  /** 고른 건수. 0이면 아직 고르지 않았다. */
  count: number;
}

/**
 * **확정하면 일어나는 것** — 버튼 «바로 위»에 둔다(공유계약 J-7 · §3).
 *
 * ⛔ **「전송됨」이라 쓰지 않는다**(§6). 대기열에 실리는 것과 실제로 나가는 것은 다르고,
 * 「전송됐습니다」라고 적으면 송신이 실패했을 때 **화면이 거짓말을 한 것**이 된다.
 *
 * ⚠ **관문을 두껍게 하지 않는다**(§5-3). 경고를 늘리면 경고 피로로 오히려 안 읽는다 —
 * 화면의 몫은 「확정 후에는 취소할 수 없습니다」를 여기 적는 것까지다.
 */
export const OutcomePane = ({ count }: OutcomePaneProps) => (
  <section className="pane" aria-label={t.panes.outcome}>
    <h2>{t.panes.outcome}</h2>
    <div className="banner-slot">
      <AlertBanner variant="warning" title={t.outcome.irreversible}>
        <ul>
          <li>{count === 0 ? t.outcome.idle : t.outcome.confirmed(count)}</li>
          <li>{t.outcome.erpQueued}</li>
          <li>{t.outcome.cancelBeforeOnly}</li>
        </ul>
      </AlertBanner>
    </div>
  </section>
);

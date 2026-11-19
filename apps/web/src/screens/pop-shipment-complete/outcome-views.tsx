import { AlertBanner, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { formatPlantDateTime } from '../../patterns/plant-time';
import {
  formatQty,
  qtyWithUom,
  totalsOf,
  uomOf,
  type Completion,
  type CompletionResult,
} from './model';

const t = messages.popShipmentComplete;

/** 스캔 대기 — 지시서를 여는 세 입구(시안 ①). 스캔 대기 때만 보인다. */
export const IdleView = () => (
  <section className="pop-ship-idle" aria-label={t.entry.heading}>
    <ul className="pop-ship-entries">
      {(
        [
          ['smartphone', t.entry.pda],
          ['print', t.entry.print],
          ['search', t.entry.search],
        ] as const
      ).map(([icon, entry]) => (
        <li key={icon} className="pop-ship-entry">
          <Icon name={icon} size={32} aria-hidden />
          <strong>{entry.title}</strong>
          <span>{entry.body}</span>
        </li>
      ))}
    </ul>
    <p className="pop-ship-idle__same">
      <Icon name="local_shipping" size={24} aria-hidden />
      <span>{t.entry.same}</span>
    </p>
  </section>
);

const requestLine = (completion: Completion): string =>
  `${completion.shipmentRequestNo}, ${completion.customer.partnerName}`;

export interface ResultViewProps {
  result: CompletionResult;
  workerNo: string | null;
}

/**
 * 완료 결과(시안 ⑥) — 다음 스캔 전까지 남는다(저절로 사라지지 않는다 — 출하 번호를 볼 시간을 준다).
 * ⛔ ERP 송신 여부는 말하지 않는다. 잘못 나갔을 때 갈 곳만 알린다.
 */
export const ResultView = ({ result, workerNo }: ResultViewProps) => {
  const totals = totalsOf(result.completion);

  return (
    <section className="pop-ship-outcome pop-ship-outcome--done" aria-label={t.result.title}>
      <div className="pop-ship-outcome__head">
        <Icon name="task_alt" size={40} aria-hidden />
        <div>
          <h2>{t.result.title}</h2>
          <p>
            <span className="pop-ship-outcome__label">{t.result.shipmentNo}</span>{' '}
            <strong className="pop-ship-outcome__no">{result.shipmentNo}</strong>
          </p>
        </div>
      </div>
      <dl className="pop-ship-outcome__facts">
        <div>
          <dt>{t.result.request}</dt>
          <dd>{requestLine(result.completion)}</dd>
        </div>
        <div>
          <dt>{t.result.completedAt}</dt>
          <dd>{formatPlantDateTime(result.completedAt) ?? ''}</dd>
        </div>
        {workerNo !== null && (
          <div>
            <dt>{t.result.worker}</dt>
            <dd>{workerNo}</dd>
          </div>
        )}
        <div>
          <dt>{t.result.qty}</dt>
          <dd>
            {t.result.qtyValue(
              qtyWithUom(totals.qty, uomOf(result.completion)),
              totals.lineCount,
              totals.lotCount,
              totals.over > 0 ? formatQty(totals.over) : null,
            )}
          </dd>
        </div>
        {result.completion.warehouses.length > 0 && (
          <div>
            <dt>{t.result.warehouses}</dt>
            <dd>
              {result.completion.warehouses
                .map((warehouse) =>
                  t.result.warehouseValue(
                    warehouse.warehouseName,
                    qtyWithUom(warehouse.qty, uomOf(result.completion)),
                  ),
                )
                .join(', ')}
            </dd>
          </div>
        )}
      </dl>
      <p className="field-note">{t.result.cancelHint}</p>
    </section>
  );
};

/**
 * 이미 출하 완료된 지시서(시안 ⑦) — 막힘이 아니라 끝난 일이라 노란 안내다(붉은 오류가 아니다). 확인 화면을
 * 열지 않고 완료된 출하 요약만 둔다.
 */
export const AlreadyView = ({ completion }: { completion: Completion }) => (
  <section className="pop-ship-outcome" aria-label={t.already.heading}>
    <AlertBanner variant="warning" icon="task_alt" title={t.already.title}>
      {t.already.body}
    </AlertBanner>
    {completion.completedShipment !== null && (
      <dl className="pop-ship-outcome__facts">
        <div>
          <dt>{t.already.shipmentNo}</dt>
          <dd className="pop-ship-outcome__no">{completion.completedShipment.shipmentNo}</dd>
        </div>
        <div>
          <dt>{t.already.request}</dt>
          <dd>{requestLine(completion)}</dd>
        </div>
        <div>
          <dt>{t.already.completedAt}</dt>
          <dd>{formatPlantDateTime(completion.completedShipment.completedAt) ?? ''}</dd>
        </div>
      </dl>
    )}
    <p className="field-note">{t.already.historyHint}</p>
  </section>
);

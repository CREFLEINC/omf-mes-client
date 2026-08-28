import { Button, Card } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import { popTouchClass } from '../../patterns/pop-touch';
import type { TargetRow } from './types';

const t = messages.popMaterialLotLabel.target;

export interface TargetCardProps {
  row: TargetRow | null;
  itemLookup: LookupSource;
  uomLookup: LookupSource;
  supplierLookup: LookupSource;
}

/**
 * 발번 대상 — 스펙 §3 의 오른쪽 구획이다.
 *
 * **입력이 없다.** 값은 전부 입하 라인에서 승계되며 사람이 고치지 않는다(§4-B).
 *
 * ⚠ **LOT 번호 자리를 두되 비운다.** 스펙은 발번 결과를 등록 전에 미리 보이지만 계약에 번호를
 * 채번하거나 예약하는 경로가 없다. 규칙을 지어내면 승인된 적 없는 채번이 화면에 굳으므로,
 * 자리를 두고 **왜 비었는지 밝힌다**(공유계약 A-11 — 물러난 수준을 명시한다).
 *
 * ⚠ **등록·인쇄·재인쇄를 감추지 않고 비활성으로 둔다**(F-1 — 「숨기지 않는다. 왜 못 하는지
 * 알아야 한다」). 부를 수 있는 경로가 아직 없다 — 검토 요청 omf-mes#245 ①.
 *
 * ⛔ **상태를 보이지 않는다.** 스펙은 「상태 Hold」를 그리지만 계약의 `Lot.statusCode`는
 * 품질 판정 축이고 `LotCreate`에 그 필드가 없다 — 화면이 보낼 수도 없다(omf-mes#245 ⑤).
 */
export const TargetCard = ({ row, itemLookup, uomLookup, supplierLookup }: TargetCardProps) => {
  if (row === null) return <p className="field-note">{t.empty}</p>;

  return (
    <>
      <Card>
        <dl className="pop-target-fields">
          <dt>{t.fields.item}</dt>
          <dd>{lookupDisplayLabel(itemLookup, row.itemId)}</dd>

          <dt>{t.fields.quantity}</dt>
          <dd>
            {row.receivedQty} {lookupDisplayLabel(uomLookup, row.uomId)}
          </dd>

          <dt>{t.fields.supplier}</dt>
          <dd>{lookupDisplayLabel(supplierLookup, row.supplierId)}</dd>
        </dl>
      </Card>

      <Card>
        <p className="pop-lot-label">{t.lotPreview.label}</p>
        <p className="field-note">{t.lotPreview.pending}</p>
      </Card>

      <div className="pop-target-actions">
        <Button className={popTouchClass('critical')} variant="filled" size="xl" disabled>
          {t.actions.issue}
        </Button>
        <Button className={popTouchClass('critical')} variant="outlined" size="xl" disabled>
          {t.actions.reissue}
        </Button>
      </div>
      <p className="field-note pop-wide-note">{t.actions.unavailable}</p>
    </>
  );
};

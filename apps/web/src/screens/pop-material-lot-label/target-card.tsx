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
 * **LOT 번호는 등록 전에 보일 수 없다.** 서버가 등록 시점에 매기므로(§5-2) 화면이 미리 만들면
 * 실제 번호와 달라진다. 자리를 두고 **언제 정해지는지 밝힌다**(스펙 §3 의 그림 그대로).
 *
 * ⛔ **상태를 보이지 않는다.** 스펙 §4-B 가 2026-08-25 종결로 확정했다 — 「Hold」는
 * `lot.status_code` 값이 아니고 입하 보류는 서버가 등록과 함께 자동으로 건다. 화면은 응답의
 * `held`로 보류 여부만 읽으므로 **등록 전에는 보일 것이 없다.**
 *
 * ⚠ **등록·인쇄·재인쇄를 감추지 않고 비활성으로 둔다**(F-1 — 「숨기지 않는다. 왜 못 하는지
 * 알아야 한다」). 스펙 §5-2 가 세 걸음을 확정했고 계약도 갖췄으나, 그 계약을 이 저장소에
 * 반영하려면 생성 타입 재생성이 필요하고 그것이 이번 이슈 범위 밖을 깨뜨린다.
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

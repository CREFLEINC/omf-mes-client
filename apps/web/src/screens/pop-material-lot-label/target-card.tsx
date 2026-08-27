import { AlertBanner, Card } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { lookupDisplayLabel, type LookupSource } from '../../patterns/lookup-display';
import type { LineView, ReceiptView } from './types';

const t = messages.popMaterialLotLabel.target;

export interface TargetCardProps {
  receipt: ReceiptView | null;
  line: LineView | null;
  itemLookup: LookupSource;
  uomLookup: LookupSource;
  supplierLookup: LookupSource;
}

/**
 * 발번 대상 — 고른 품목이 무엇인지 읽는 자리다.
 *
 * **입력이 없다.** 여기 값은 전부 입하 라인에서 승계되며 사람이 고치지 않는다(스펙 §4-B).
 *
 * ⛔ **LOT 번호 미리보기를 두지 않는다.** 스펙은 발번 결과를 미리 보이지만, 계약에 번호를
 * 채번하거나 예약하는 경로가 없어 화면이 무엇을 보여야 할지 정해진 것이 없다. 규칙을 지어내면
 * 설계가 승인한 적 없는 채번이 화면에 굳는다 — 검토 요청 omf-mes#245 ① 이 풀려야 선다.
 *
 * ⛔ **등록·인쇄·재인쇄 단추도 두지 않는다.** 같은 이유로 부를 수 있는 경로가 없다.
 *
 * ⛔ **상태를 보이지 않는다.** 스펙은 「상태 Hold」를 그리지만 계약의 `Lot.statusCode`는
 * **품질 판정 축**이고 계약이 「보류 건의 진행 상태와는 다른 축」이라고 못박았다. 게다가
 * `LotCreate`에 `statusCode`가 없어 **화면이 보낼 수도 없다.** 어느 축의 어떤 값을 보여야
 * 하는지는 설계 판단이다 — 검토 요청 omf-mes#245 ⑤.
 */
export const TargetCard = ({
  receipt,
  line,
  itemLookup,
  uomLookup,
  supplierLookup,
}: TargetCardProps) => {
  if (receipt === null || line === null) {
    return <p className="field-note">{t.empty}</p>;
  }

  return (
    <Card>
      <dl className="pop-target-fields">
        <dt>{t.fields.item}</dt>
        <dd>{lookupDisplayLabel(itemLookup, line.itemId)}</dd>

        <dt>{t.fields.quantity}</dt>
        <dd>
          {line.receivedQty} {lookupDisplayLabel(uomLookup, line.uomId)}
        </dd>

        <dt>{t.fields.supplier}</dt>
        <dd>{lookupDisplayLabel(supplierLookup, receipt.supplierId)}</dd>
      </dl>

      {/*
       * 공급사 LOT 이 이미 붙어 온 건은 이 화면의 대상이 아니다(사전부착 경로가 따로 있다).
       * 고를 수는 있게 두되 **왜 진행할 수 없는지 밝힌다** — 감추면 왜 안 되는지 알 수 없다.
       */}
      {line.supplierLotMissing ? null : (
        <AlertBanner variant="warning">{t.alreadyAttached}</AlertBanner>
      )}
    </Card>
  );
};

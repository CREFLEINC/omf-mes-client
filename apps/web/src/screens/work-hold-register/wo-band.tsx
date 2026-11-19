import { messages } from '@omf-mes/i18n';

import { useUomOptions } from '../../patterns/material-lot-batch';
import { usePopWorkOrder } from '../../patterns/pop-process-gate';
import { PuBand } from '../../patterns/pop-uniform';

const t = messages.workHoldRegister.band;

const QTY_FORMAT = new Intl.NumberFormat('ko-KR');

/**
 * 본문 맨 위 작업지시 띠(POP 통일 시안 #295) — 「작업지시 (W/O) · 번호 · 공정 · 제품 · 계획수량」.
 *
 * ⭐ 같은 W/O 상세를 다른 POP 화면과 같은 키로 읽는다(`usePopWorkOrder`) — 단계 줄도 이미 읽는 값이다.
 *    단위 이름은 단위 목록에서 푼다. 못 받은 값은 「—」로 둔다(지어내지 않는다).
 */
export const WorkOrderBand = ({ workOrderId }: { workOrderId: number }) => {
  const workOrder = usePopWorkOrder(workOrderId).data;
  const uoms = useUomOptions().data;
  const uomCode = uoms?.find((uom) => uom.uomId === workOrder?.uomId)?.uomCode ?? '';
  const dash = '—';

  return (
    <PuBand
      title={t.title}
      label={t.title}
      no={workOrder?.workOrderNo ?? dash}
      items={[
        { label: t.process, value: workOrder?.processName ?? dash },
        { label: t.item, value: workOrder?.itemCode ?? dash },
        {
          label: t.planQty,
          value:
            workOrder === undefined
              ? dash
              : `${QTY_FORMAT.format(workOrder.orderQty)} ${uomCode}`.trim(),
        },
      ]}
    />
  );
};

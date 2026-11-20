import { messages } from '@omf-mes/i18n';

import { formatPlantDateTime } from '../../patterns/plant-time';
import { PuKv, PuNote, PuSection } from '../../patterns/pop-uniform';
import { qtyWithUom, totalsOf, uomOf, type Completion, type CompletionResult } from './model';

const t = messages.popShipmentComplete;

const requestLine = (completion: Completion): string =>
  `${completion.shipmentRequestNo}, ${completion.customer.partnerName}`;

/** 완료한 POP 단말과 작업자(시안 ⑥⑦). 서버가 둘 다 실었을 때만 — 없으면 `null`. */
export const completedByOf = (completion: Completion): string | null => {
  const done = completion.completedShipment;
  if (done === null || done.completedTerminal === null || done.completedWorker === null)
    return null;
  return t.result.who(
    done.completedTerminal.terminalCode,
    done.completedWorker.workerName,
    done.completedWorker.workerNo,
  );
};

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
  const completedBy = completedByOf(result.completion);
  const items = [
    {
      label: t.result.shipmentNo,
      value: <b className="pu-mono">{result.shipmentNo}</b>,
    },
    { label: t.result.request, value: requestLine(result.completion) },
    { label: t.result.completedAt, value: formatPlantDateTime(result.completedAt) ?? '' },
    ...(completedBy !== null
      ? [{ label: t.result.completedBy, value: completedBy }]
      : workerNo !== null
        ? [{ label: t.result.worker, value: workerNo }]
        : []),
    {
      label: t.result.qty,
      value: t.result.qtyValue(
        qtyWithUom(totals.qty, uomOf(result.completion)),
        totals.lineCount,
        totals.lotCount,
        totals.over > 0 ? qtyWithUom(totals.over, uomOf(result.completion)) : null,
      ),
    },
    ...(result.completion.warehouses.length > 0
      ? [
          {
            label: t.result.warehouses,
            value: result.completion.warehouses
              .map((warehouse) =>
                t.result.warehouseValue(
                  warehouse.warehouseName,
                  qtyWithUom(warehouse.qty, uomOf(result.completion)),
                ),
              )
              .join(', '),
          },
        ]
      : []),
  ];

  return (
    <PuSection grow={false} label={t.result.title}>
      <PuNote tone="ok">{t.result.title}</PuNote>
      <PuKv items={items} />
    </PuSection>
  );
};

/**
 * 이미 출하 완료된 지시서(시안 ⑦) — 막힘이 아니라 끝난 일이라 노란 안내다(붉은 오류가 아니다). 확인 화면을
 * 열지 않고 완료된 출하 요약만 둔다.
 */
export const AlreadyView = ({ completion }: { completion: Completion }) => {
  const done = completion.completedShipment;
  const completedBy = completedByOf(completion);

  return (
    <PuSection grow={false} label={t.already.heading}>
      <PuNote tone="warn">{t.already.title}</PuNote>
      {done !== null && (
        <PuKv
          items={[
            { label: t.already.shipmentNo, value: <b className="pu-mono">{done.shipmentNo}</b> },
            { label: t.already.request, value: requestLine(completion) },
            { label: t.already.completedAt, value: formatPlantDateTime(done.completedAt) ?? '' },
            ...(completedBy !== null ? [{ label: t.result.completedBy, value: completedBy }] : []),
          ]}
        />
      )}
    </PuSection>
  );
};

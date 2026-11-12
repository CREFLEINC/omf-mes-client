import { Button, Icon } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { dispositionTypeLabel } from './disposition-codes';

/** 저장 뒤 결과 카드에 쓰는 값 — 저장 순간의 폼 · LOT 과 서버 응답을 묶는다. */
export type DecisionResult =
  | {
      kind: 'whole';
      dispositionTypeCode: string;
      lotCount: number;
      inboundLotNo: string | null;
    }
  | {
      kind: 'sort';
      /** 짧게 부른 LOT 번호들 — 「0001, 0002」. */
      restLots: string;
      movedLots: string;
      newInboundLotNo: string | null;
      newInspectionRequestNo: string | null;
      originalInspectionRequestNo: string | null;
      newNonconformanceId: number | null;
      newNonconformanceNo: string | null;
      goodQty: string;
      defectQty: string;
    };

export interface DecisionResultCardProps {
  result: DecisionResult;
  onOpenNonconformance: (nonconformanceId: number) => void;
}

/**
 * 판정 저장 결과(005 · mockups/W0310-After.html) — 판정 하나가 자재 관리 LOT 전부에 미친 일을 한 상자로 말한다.
 * 선별이면 남은 LOT · 옮긴 LOT(새 입하 LOT) · 새 부적합(링크) · 정보 수량.
 */
export const DecisionResultCard = ({ result, onOpenNonconformance }: DecisionResultCardProps) => {
  const t = messages.dispositionDecision;
  const unknown = t.values.unknownQty;

  if (result.kind === 'whole') {
    return (
      <div className="disposition-result" role="status">
        <strong>
          <Icon name="task_alt" size={18} aria-hidden />
          {t.form.resultClosed(dispositionTypeLabel(result.dispositionTypeCode))}
        </strong>
        <p>
          {t.form.resultLots(
            result.lotCount,
            t.form.resultWhat[result.dispositionTypeCode] ?? result.dispositionTypeCode,
          )}
        </p>
        {result.dispositionTypeCode === 'REWORK' && result.inboundLotNo !== null && (
          <p className="field-note">{t.form.reworkReopened(result.inboundLotNo)}</p>
        )}
      </div>
    );
  }

  const newNonconformanceId = result.newNonconformanceId;
  return (
    <div className="disposition-result" role="status">
      <strong>
        <Icon name="task_alt" size={18} aria-hidden />
        {t.sort.resultTitle}
      </strong>
      <p>
        <Icon name="check_circle" size={16} aria-hidden />
        {t.sort.resultRest(result.restLots)}
      </p>
      <p>
        <Icon name="call_split" size={16} aria-hidden />
        {t.sort.resultMoved(result.movedLots, result.newInboundLotNo ?? t.sort.newInboundLot)}
        {result.newInspectionRequestNo !== null && (
          <>
            {' '}
            {t.sort.resultIqc(result.newInspectionRequestNo, result.originalInspectionRequestNo)}
          </>
        )}
      </p>
      <p>
        <Icon name="link" size={16} aria-hidden />
        {t.sort.resultNewNonconformance}{' '}
        {newNonconformanceId === null ? (
          (result.newNonconformanceNo ?? unknown)
        ) : (
          <Button
            variant="text"
            size="sm"
            onClick={() => onOpenNonconformance(newNonconformanceId)}
          >
            {result.newNonconformanceNo ?? String(newNonconformanceId)}
          </Button>
        )}{' '}
        {t.sort.resultNewNonconformanceAfter}
      </p>
      {(result.goodQty !== '' || result.defectQty !== '') && (
        <p className="field-note">
          {t.sort.resultInfo(
            result.goodQty === '' ? unknown : result.goodQty,
            result.defectQty === '' ? unknown : result.defectQty,
          )}
        </p>
      )}
    </div>
  );
};

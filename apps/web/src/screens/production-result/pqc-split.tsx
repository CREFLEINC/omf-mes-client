import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';

import { useOutbox } from '../pqc-inspection/outbox';
import { PqcPanel } from '../pqc-panel/panel';
import { productionResultKeys } from './queries';

const t = messages.productionResult.pqc;

export interface PqcSplitProps {
  /** 오른쪽에 띄울 PQC 의뢰. `null`(검사 off)이면 나누지 않고 실적 화면만 그대로 그린다. */
  inspectionRequestId: number | null;
  /** 검사 off 로 «확인됐다»(조회가 끝났고 PQC 의뢰가 없다). 조회 중·실패면 `false` — 모르는 것을 미검사로 말하지 않는다. */
  isInspectionOff: boolean;
  workOrderId: number | null;
  workerNo: string | null;
  /** 실적 화면 본문(카드 격자). */
  children: ReactNode;
}

/**
 * 생산 실적(P-02-04) ↔ PQC 분할(omf-all-around#107).
 *
 * ⭐ **나누지 않을 때는 아무것도 감싸지 않는다** — 실적 격자가 `.pop-ui` 바로 아래에 서야 세로
 * 예산 규칙(`pop.css` 의 `.pop-ui > .pop-fixed.production-flow-grid`)이 그대로 걸린다.
 *
 * ⭐ 검사 on(그 W/O 에 PQC 의뢰가 있음)이면 늘 나눈다 — 닫는 단추가 없다(사용자 결정 2026-10-19). PQC 를 확정해
 * 서버가 받으면 의뢰를 다시 물어 확정 결과를 읽기 전용으로 보인다. 큐는 POP 단독 PQC 화면과 같은 오프라인
 * 큐(`useOutbox`)라 끊겨도 담긴 판정은 연결되면 나간다.
 */
export const PqcSplit = ({
  inspectionRequestId,
  isInspectionOff,
  workOrderId,
  workerNo,
  children,
}: PqcSplitProps) => {
  const outbox = useOutbox();
  const queryClient = useQueryClient();
  const { sentCount } = outbox;

  useEffect(() => {
    if (sentCount === 0 || workOrderId === null) return;
    void queryClient.invalidateQueries({
      queryKey: productionResultKeys.pqc(workOrderId),
    });
  }, [sentCount, queryClient, workOrderId]);

  const zoneHead = (
    <ZoneHead
      title={messages.productionResult.zone.title}
      note={messages.productionResult.zone.note}
      status={
        /* 검사 off 면 「PQC 미검사」를 중립 칩으로 알린다(사용자 지시 2026-10-19). on 이면 PQC 구획이 곧 표시다. */
        isInspectionOff ? (
          <Chip status="idle" size="md">
            {t.notInspected}
          </Chip>
        ) : null
      }
    />
  );

  if (inspectionRequestId === null) {
    return (
      <>
        {zoneHead}
        {children}
      </>
    );
  }

  return (
    <div className="production-flow-split pop-fixed">
      <div className="production-flow-zone">
        {zoneHead}
        {children}
      </div>
      <div className="production-flow-zone">
        <ZoneHead title={t.splitTitle} note={t.splitNote} />
        <section className="pane production-flow-pqc" aria-label={t.splitTitle}>
          <PqcPanel
            key={inspectionRequestId}
            inspectionRequestId={inspectionRequestId}
            submitter={outbox}
            workerNo={workerNo}
            requiresWorker
            withKeypad
            variant="split"
          />
        </section>
      </div>
    </div>
  );
};

/** 구획 머리 — 이름과 그 구획에서 하는 일(사용자 지시 2026-10-19 · 예시 배치). */
const ZoneHead = ({
  title,
  note,
  status = null,
}: {
  title: string;
  note: string;
  status?: ReactNode;
}) => (
  <div className="production-flow-zone-head pop-fixed">
    <h2 className="pane-title">{title}</h2>
    <p className="field-note">{note}</p>
    {status !== null && <span className="production-flow-zone-head__status">{status}</span>}
  </div>
);

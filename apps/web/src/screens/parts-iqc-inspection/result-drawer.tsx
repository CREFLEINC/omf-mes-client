import { Button, Dialog } from '@crefle/web-ui';
import type { InspectionResultSummaryForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';
import { useMeasurements } from '../iqc-inspection/queries';
import type { InboundInspection } from './inbound-queries';
import type { InspectionFormDrawer, InspectionFormDraft } from './inspection-detail';
import { LotMatchField } from './lot-match-field';

const t = messages.iqcInboundLot.drawer;

export interface ResultDrawerProps {
  inspection: InboundInspection;
  uomCode: string;
  /** 고칠 결과 — 새로 더하면 `null`. */
  editing: InspectionResultSummaryForward | null;
  /** 제목의 순번 — 고칠 때는 그 결과의 순번, 더할 때는 다음 순번. */
  seqNo: number;
  /** 지금 IQC 양식(`InspectionForm`)을 드로어 모드로 그린다 — 상세가 기준 · 도면 · 검사자를 이미 읽어 두었다. */
  renderForm: (args: {
    drawer: InspectionFormDrawer;
    draft: InspectionFormDraft | null;
    formKey: string;
    onDirtyChange: (dirty: boolean) => void;
  }) => ReactNode;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * 결과 추가 · 수정 — 오른쪽 드로어(936, 사용자 결정 2026-11-11 · screens/W-01-01.md). 지금 IQC 양식 그대로, 회차 · 이전 결과 ·
 * 재검사 사유 없이, 기본 정보 아래에 자재 관리 LOT 매칭(선택)을 둔다. 입력 중 닫으면 한 번 묻는다.
 */
export const ResultDrawer = ({
  inspection,
  uomCode,
  editing,
  seqNo,
  renderForm,
  onClose,
  onSaved,
}: ResultDrawerProps) => {
  const { client } = useApiClient();
  const resultId = editing?.inspectionResultId ?? null;
  const full = useQuery({
    queryKey: ['iqc-inbound-lot', 'result', resultId ?? 0] as const,
    enabled: resultId !== null,
    staleTime: 0,
    queryFn: () =>
      runRequest(() =>
        client.GET('/quality/inspection-results/{inspectionResultId}', {
          params: { path: { inspectionResultId: resultId as number } },
        }),
      ),
  });
  const measurements = useMeasurements(resultId);

  const initialMatch = editing?.matchedLotIds ?? [];
  const [matched, setMatched] = useState<number[]>([...initialMatch]);
  const [formDirty, setFormDirty] = useState(false);
  const [asking, setAsking] = useState(false);
  const matchDirty =
    matched.length !== initialMatch.length || matched.some((id) => !initialMatch.includes(id));
  const dirty = formDirty || matchDirty;

  const requestClose = () => {
    if (dirty) setAsking(true);
    else onClose();
  };

  const lots = inspection.lots ?? [];
  const others = (inspection.results ?? []).filter(
    (result) => result.inspectionResultId !== resultId,
  );
  const loading = resultId !== null && (full.isPending || measurements.isPending);

  const draft: InspectionFormDraft | null =
    editing === null || full.data === undefined
      ? null
      : {
          inspectionResultId: editing.inspectionResultId,
          versionNo: editing.versionNo,
          inspectedQty: full.data.inspectedQty,
          inspectedAt: full.data.inspectedAt ?? editing.inspectedAt,
          overallJudgmentCode: full.data.overallJudgmentCode,
          remarks: full.data.remarks ?? '',
          measured: measurements.data ?? [],
        };

  return (
    <>
      <Dialog
        open
        placement="right"
        size="lg"
        className="iqc-inbound-drawer"
        closeOnBackdropClick={false}
        title={editing === null ? t.addTitle(seqNo) : t.editTitle(seqNo)}
        onClose={requestClose}
      >
        {loading ? (
          <p className="field-note">{t.loading}</p>
        ) : (
          <>
            <p className="field-note iqc-inbound-drawer-note">{t.inputNote}</p>
            {renderForm({
              formKey: `${String(inspection.inspectionRequestId)}-${String(resultId ?? 'new')}`,
              draft,
              onDirtyChange: setFormDirty,
              drawer: {
                matchedLotIds: matched,
                matchField: (
                  <LotMatchField
                    lots={lots}
                    otherResults={others}
                    uomCode={uomCode}
                    value={matched}
                    onChange={setMatched}
                  />
                ),
                onCancel: requestClose,
                onSaved,
              },
            })}
          </>
        )}
      </Dialog>
      {asking && (
        <Dialog
          open
          size="sm"
          showCloseButton={false}
          closeOnBackdropClick={false}
          title={editing === null ? t.addTitle(seqNo) : t.editTitle(seqNo)}
          onClose={() => setAsking(false)}
          footer={
            <>
              <Button variant="outlined" onClick={() => setAsking(false)}>
                {t.discardStay}
              </Button>
              <Button
                onClick={() => {
                  setAsking(false);
                  onClose();
                }}
              >
                {t.discardLeave}
              </Button>
            </>
          }
        >
          <p className="dialog-text">{t.discardBody}</p>
        </Dialog>
      )}
    </>
  );
};

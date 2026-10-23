import { AlertBanner, Button, Chip, TextField, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useRef, useState, type FormEvent } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { usePopIdentity } from '../../patterns/pop-identity';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { useWorkerSession } from '../../patterns/worker-session';
import { HeaderPanel } from './header-panel';
import { NgPanel } from './ng-panel';
import { useOpenSheet, useSaveHeader, useSaveNgs, useSaveStep, useSheet } from './queries';
import { StepPanel } from './step-panel';

const t = messages.popInspectionSheet;

/**
 * P-02-15 제품 검사표 입력(POP · omf-all-around#89 · 설계보다 앞선 화면, 서버 장부 P-102).
 *
 * 종이 성적서(OP·PP향 제품검사표)를 대신한다 — 시리얼을 스캔하면 그 기기의 검사표를 열고(없으면 서버가 만든다),
 * 머리 값을 확인하고 단계마다 항목 판정을 넣는다. 서명·승인과 출력은 관리웹 「제품 검사표 조회」가 한다.
 *
 * ⚠ 모델의 검사표 기준이 확정돼 있어야 열린다(관리웹 「검사표 기준」). 메뉴는 검사 입력 공정 단말에만 뜬다.
 */
export const PopInspectionSheetScreen = () => {
  const titleId = useId();
  const toast = useToast();
  const identity = usePopIdentity();
  const workerSession = useWorkerSession();
  const workerNo = identity.workerNo?.trim() || workerSession?.worker.workerNo?.trim() || null;
  const worker = workerNo ?? undefined;

  const [serialDraft, setSerialDraft] = useState('');
  const [sheetId, setSheetId] = useState<number | null>(null);

  const sheet = useSheet(sheetId, worker);
  const open = useOpenSheet((opened) => setSheetId(opened.inspectionSheetId), worker);
  const saveHeader = useSaveHeader(
    sheetId,
    () => toast.show({ variant: 'success', description: t.header.saved }),
    worker,
  );
  // 임시 저장(판정 없이 항목만)이었는지 — 알림 문구를 가른다.
  const draftSave = useRef(false);
  const saveStep = useSaveStep(
    sheetId,
    () =>
      toast.show({
        variant: 'success',
        description: draftSave.current ? t.step.draftSaved : messages.common.saved,
      }),
    worker,
  );
  const saveNgs = useSaveNgs(
    sheetId,
    () => toast.show({ variant: 'success', description: t.ng.saved }),
    worker,
  );

  const data = sheet.data ?? null;
  const completed = data?.statusCode === 'COMPLETED';
  const disabled = workerNo === null || completed;

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const serialNo = serialDraft.trim();
    if (serialNo === '' || workerNo === null) return;
    setSheetId(null);
    open.write({ serialNo });
  };

  return (
    <main className="pop-shell pop-ui pop-inspection-sheet" aria-labelledby={titleId}>
      <header className="pop-header">
        <h1 id={titleId} className="pop-title">
          {t.title}
        </h1>
        <div className="pop-context-right">
          {workerNo !== null && (
            <Chip variant="status" size="md" status="success">
              {workerNo}
            </Chip>
          )}
        </div>
      </header>

      <PopWorkerMissingBanner workerNo={workerNo} />

      <section className="pane pop-fixed pop-inspection-sheet-top" aria-label={t.serial.label}>
        <form onSubmit={submit} className="pop-inspection-sheet-serial">
          <TextField
            label={t.serial.label}
            placeholder={t.serial.placeholder}
            size="lg"
            value={serialDraft}
            error={open.fieldErrors.serialNo}
            onChange={(event) => setSerialDraft(event.target.value)}
          />
          <Button
            type="submit"
            variant="outlined"
            size="lg"
            disabled={workerNo === null || open.isSaving}
          >
            {open.isSaving ? t.serial.opening : t.serial.open}
          </Button>
        </form>
        <SaveErrorBanner error={open.error} />
        {sheet.isError && <AlertBanner variant="error">{t.summary.loadFailed}</AlertBanner>}
        {data !== null && (
          <dl className="pop-figures pop-inspection-sheet-summary">
            <div>
              <dt>{t.summary.serial}</dt>
              <dd>{data.serialNo}</dd>
            </div>
            <div>
              <dt>{t.summary.model}</dt>
              <dd>{`${data.itemName} (${data.itemCode})`}</dd>
            </div>
            <div>
              <dt>{t.summary.lot}</dt>
              <dd>{data.lotNo}</dd>
            </div>
            <div>
              <dt>{t.summary.workOrder}</dt>
              <dd>{data.workOrderNo ?? '-'}</dd>
            </div>
            <div>
              <dt>{t.summary.status}</dt>
              <dd>{t.summary.statuses[data.statusCode] ?? data.statusCode}</dd>
            </div>
            <div>
              <dt>{t.summary.writer}</dt>
              <dd>{data.writtenWorkerName ?? '-'}</dd>
            </div>
          </dl>
        )}
        {completed && <AlertBanner variant="info">{t.summary.completed}</AlertBanner>}
      </section>

      {data !== null && (
        <div className="pop-panes">
          {/* 저장 뒤 다시 받은 검사표로 입력을 새로 채운다 — 서버가 정리한 값(공백 → 비움)이 화면과 같아지게. */}
          <div key={sheet.dataUpdatedAt}>
            <SaveErrorBanner
              error={saveHeader.error ?? saveStep.error ?? saveNgs.error}
              onReload={() => void sheet.refetch()}
            />
            <HeaderPanel
              sheet={data}
              disabled={disabled}
              isSaving={saveHeader.isSaving}
              onSave={saveHeader.write}
            />
            <NgPanel
              sheet={data}
              disabled={disabled}
              isSaving={saveNgs.isSaving}
              onSave={saveNgs.write}
            />
          </div>
          <StepPanel
            steps={data.steps}
            disabled={disabled}
            isSaving={saveStep.isSaving}
            onSave={(variables) => {
              draftSave.current = variables.body.firstJudgmentCode === undefined;
              saveStep.write(variables);
            }}
          />
        </div>
      )}
    </main>
  );
};

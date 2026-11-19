import { messages } from '@omf-mes/i18n';
import { useId, useRef, useState } from 'react';

import { SaveErrorBanner } from '../../patterns/master';
import { usePopIdentity } from '../../patterns/pop-identity';
import {
  PuBand,
  PuEmpty,
  PuNote,
  PuScanField,
  PuScreen,
  PuSection,
  puToast,
} from '../../patterns/pop-uniform';
import { PopWorkerMissingBanner } from '../../patterns/pop-worker-missing-banner';
import { useWorkerSession } from '../../patterns/worker-session';
import { HeaderPanel } from './header-panel';
import { NgPanel } from './ng-panel';
import { useOpenSheet, useSaveHeader, useSaveNgs, useSaveStep, useSheet } from './queries';
import { StepPanel } from './step-panel';
import './uniform.css';

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
  const sectionId = `${titleId}-top`;
  const identity = usePopIdentity();
  const workerSession = useWorkerSession();
  const workerNo = identity.workerNo?.trim() || workerSession?.worker.workerNo?.trim() || null;
  const worker = workerNo ?? undefined;

  const [serialDraft, setSerialDraft] = useState('');
  const [sheetId, setSheetId] = useState<number | null>(null);

  const sheet = useSheet(sheetId, worker);
  const open = useOpenSheet((opened) => setSheetId(opened.inspectionSheetId), worker);
  const saveHeader = useSaveHeader(sheetId, () => puToast(t.header.saved), worker);
  // 임시 저장(판정 없이 항목만)이었는지 — 알림 문구를 가른다.
  const draftSave = useRef(false);
  const saveStep = useSaveStep(
    sheetId,
    () => puToast(draftSave.current ? t.step.draftSaved : messages.common.saved),
    worker,
  );
  const saveNgs = useSaveNgs(sheetId, () => puToast(t.ng.saved), worker);

  const data = sheet.data ?? null;
  const completed = data?.statusCode === 'COMPLETED';
  const disabled = workerNo === null || completed;

  /* 스캐너의 Enter · [직접 입력] — 종전 [열기]와 같은 일(#295 규칙 7: 스캔 칸 한 모양). */
  const submit = (value: string): void => {
    const serialNo = value.trim();
    if (serialNo === '' || workerNo === null) return;
    setSheetId(null);
    open.write({ serialNo });
  };

  return (
    <PuScreen className="isheet-u" labelledBy={titleId}>
      <h1 id={titleId} className="pop-visually-hidden">
        {t.title}
      </h1>

      <PopWorkerMissingBanner workerNo={workerNo} />

      <PuSection title={t.summary.heading} grow={false} className="isheet-top" labelId={sectionId}>
        <PuScanField
          label={t.serial.label}
          placeholder={t.serial.placeholder}
          value={serialDraft}
          onChange={setSerialDraft}
          onSubmit={submit}
          done={data !== null && data.serialNo === serialDraft.trim()}
          error={open.fieldErrors.serialNo}
          disabled={workerNo === null || open.isSaving}
          autoFocus
        />
        <SaveErrorBanner error={open.error} />
        {sheet.isError && <PuNote tone="bad">{t.summary.loadFailed}</PuNote>}
        {data !== null && (
          <PuBand
            grid={3}
            label={t.summary.heading}
            items={[
              { label: t.summary.serial, value: <span className="pu-mono">{data.serialNo}</span> },
              { label: t.summary.model, value: `${data.itemName} (${data.itemCode})` },
              { label: t.summary.lot, value: data.lotNo },
              { label: t.summary.workOrder, value: data.workOrderNo ?? '-' },
              {
                label: t.summary.status,
                value: t.summary.statuses[data.statusCode] ?? data.statusCode,
              },
              { label: t.summary.writer, value: data.writtenWorkerName ?? '-' },
            ]}
          />
        )}
        {completed && <PuNote>{t.summary.completed}</PuNote>}
      </PuSection>

      {data === null ? (
        !sheet.isError && (
          <section className="pu-card isheet-empty" aria-label={t.summary.heading}>
            <PuEmpty icon="scan" title={t.summary.emptyTitle} />
          </section>
        )
      ) : (
        <div className="isheet-panes">
          {/* 저장 뒤 다시 받은 검사표로 입력을 새로 채운다 — 서버가 정리한 값(공백 → 비움)이 화면과 같아지게. */}
          <div key={sheet.dataUpdatedAt} className="isheet-col">
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
    </PuScreen>
  );
};

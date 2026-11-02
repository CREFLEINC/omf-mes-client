import { Breadcrumb, Chip, EmptyState, Icon, PageHeader } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

import { usePageHub } from '../../patterns/page-hub';
import type { SelectedLotSnapshot } from './candidate-model';
import { SuspiciousMaterialCandidatePane } from './candidate-pane';
import { SuspiciousMaterialHoldExecution } from './hold-execution';
import {
  type HoldInputLot,
  SuspiciousMaterialHoldImpact,
  SuspiciousMaterialHoldInputPane,
} from './hold-input-pane';
import { AffectedProductionLotsSection, MaterialDefectPane } from './material-defect-pane';

type Body = components['schemas']['LotHoldCreate'];
const t = messages.suspiciousMaterialHold;
const SUSPICIOUS_MATERIAL_TARGET_LOT_STATUS_CODE = 'INSPECTION_PENDING';

interface SuspiciousMaterialHoldFlowProps {
  targetLotStatusCode: string | null;
}

export const SuspiciousMaterialHoldFlow = ({
  targetLotStatusCode,
}: SuspiciousMaterialHoldFlowProps) => {
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<SelectedLotSnapshot[]>([]);
  const [body, setBody] = useState<Body | null>(null);
  const [pinned, setPinned] = useState(false);
  const [candidateReady, setCandidateReady] = useState(false);
  const [notices, setNotices] = useState<string[]>([]);
  const inputSelection = useMemo<HoldInputLot[]>(
    () =>
      selection.map((lot) => ({
        ...lot,
        locationLabel: lot.locationLabel ?? null,
        uomLabel: lot.uomLabel ?? null,
      })),
    [selection],
  );
  const changePinned = useCallback(
    (next: boolean): void => {
      if (next) void queryClient.cancelQueries({ queryKey: ['suspicious-material-hold'] });
      setPinned(next);
    },
    [queryClient],
  );
  const clear = (): void => {
    setSelection([]);
    setBody(null);
  };

  return (
    <div className="suspicious-material-hold-workspace">
      <SuspiciousMaterialCandidatePane
        isLocked={pinned}
        selection={selection}
        onSelectionChange={setSelection}
        onAvailabilityChange={setCandidateReady}
        detail={
          /*
           * 오른쪽 한 카드 「의심자재 보류 등록」 — 보류 입력 · [보류 등록] · 자재 불량 기록 · 영향 생산 LOT 을 가는 선으로
           * 가른 구획으로(사용자 시안 2026-11-02). 고르기 전에는 안내만.
           */
          <section className="pane suspicious-material-hold-card" aria-label={t.card.title}>
            {/*
             * 제목 줄 — 제목 바로 오른쪽에 고른 건수, 줄 오른쪽 끝에 등록을 막는 까닭 알약(사용자 2026-11-02).
             * 고른 건수는 목록 위가 아니라 여기 한 곳에만 둔다.
             */}
            <div className="suspicious-material-hold-card-head">
              <h2 className="pane-title">{t.card.title}</h2>
              {selection.length > 0 && (
                <Chip size="sm" role="status">
                  {messages.suspiciousMaterialHold.candidate.values.selected(selection.length)}
                </Chip>
              )}
              {selection.length > 0 && notices.length > 0 && (
                <div className="suspicious-material-hold-card-notes">
                  {notices.map((notice) => (
                    <p
                      key={notice}
                      className="iqc-inspection-action-note"
                      data-tone="info"
                      title={notice}
                    >
                      <Icon name="info" size={14} aria-hidden />
                      <span className="iqc-inspection-action-note-text">{notice}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
            {selection.length === 0 ? (
              <EmptyState
                size="sm"
                icon={<Icon name="arrow_selector_tool" size={24} />}
                title={messages.lotStatusHistory.detail.pick}
              />
            ) : (
              <>
                <SuspiciousMaterialHoldInputPane
                  selection={candidateReady ? inputSelection : []}
                  targetLotStatusCode={targetLotStatusCode}
                  isLocked={pinned}
                  onBodyChange={setBody}
                  onNoticesChange={setNotices}
                />
                {/*
                 * 보류 시 제한 사항 · [보류 등록]과 자재 불량 기록을 나란히(사용자 2026-11-02) — 카드가 좁으면 위아래로 쌓인다.
                 * 관련 생산 LOT 은 그 아래 전체 폭.
                 */}
                <div className="suspicious-material-hold-pair">
                  <div className="suspicious-material-hold-section">
                    <SuspiciousMaterialHoldImpact
                      selection={candidateReady ? inputSelection : []}
                    />
                    <SuspiciousMaterialHoldExecution
                      body={body}
                      selected={selection}
                      onConfirmationChange={changePinned}
                      onApplied={clear}
                      onReload={clear}
                    />
                  </div>
                  {/* omf-all-around#108 — 고른 LOT 하나의 자재 불량 기록(계보 기준 추정 · #166). */}
                  <MaterialDefectPane
                    selection={candidateReady ? selection : []}
                    isLocked={pinned}
                  />
                </div>
                <AffectedProductionLotsSection selection={candidateReady ? selection : []} />
              </>
            )}
          </section>
        }
      />
    </div>
  );
};

export const SuspiciousMaterialHoldScreen = () => {
  const hub = usePageHub();

  return (
    <div className="screen suspicious-material-hold-screen">
      {/* 탭 묶음 안이면 탭 막대가 화면 이름을 말한다 — 경로·제목을 세우지 않는다(omf-all-around#210). */}
      {hub === null && (
        <PageHeader
          title={t.title}
          breadcrumb={
            <Breadcrumb
              items={[{ label: t.breadcrumbRoot }, { label: t.title }]}
              aria-label={messages.common.shell.breadcrumb}
            />
          }
        />
      )}
      <SuspiciousMaterialHoldFlow
        targetLotStatusCode={SUSPICIOUS_MATERIAL_TARGET_LOT_STATUS_CODE}
      />
    </div>
  );
};

import { AlertBanner, Button, Chip, EmptyState, Skeleton, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId } from 'react';

import { causeNote, PLACEHOLDER_CAUSE_CODES } from './code-options';
import { FieldLabel } from './field-label';
import { SelectField } from './select-field';
import {
  completeLockReason,
  openDowntimeWarning,
  saveLockReason,
  startHandlingLockReason,
} from './transitions';
import { formatMoment, occurrenceLabel, statusLabel, type BreakdownDetailView } from './types';

const t = messages.equipmentFailure;

interface ReadOnlyRowProps {
  label: string;
  value: string;
}

/** 현장이 적은 칸. **입력칸으로 그리지 않는다** — 고칠 수 있을 것처럼 보이면 안 된다. */
const ReadOnlyRow = ({ label, value }: ReadOnlyRowProps) => (
  <div className="field-cell equipment-failure-readonly">
    <span className="field-label">{label}</span>
    <span>{value}</span>
  </div>
);

export interface DetailPaneProps {
  detail: BreakdownDetailView | null;
  isLoading: boolean;
  causeCode: string;
  handlingNote: string;
  fieldErrors: Record<string, string>;
  isSaving: boolean;
  onChangeCause: (value: string) => void;
  onChangeNote: (value: string) => void;
  onSave: () => void;
  onStartHandling: () => void;
  onComplete: () => void;
}

/**
 * 고장 하나의 상세 처리.
 *
 * ⭐ **화면이 두 층으로 갈린다** — 위는 **현장이 적은 것**(고칠 수 없다), 아래는 **사무가 적는
 * 것**(고칠 수 있다). 그 갈림을 감추지 않고 안내로 밝힌다: 감추면 사용자가 증상을 고치려다
 * 못 고치는 이유를 알 수 없고, 정정할 길(처리 내역에 덧붙이기)도 모른다.
 *
 * ⭐ **상태 전이 둘은 되돌릴 수 없다.** 그래서 버튼을 잠그는 사유를 늘 함께 낸다 — 잠그기만
 * 하고 이유를 감추면 사용자가 할 수 있는 것이 없다.
 *
 * ⚠ **완료가 비가동을 닫아 주지 않는다.** 끝나지 않은 비가동이 있으면 **완료를 누르기 전에**
 * 경고한다 — 완료한 뒤에는 되돌릴 수 없고, 비가동은 계속 열린 채 집계에서 빠진다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const DetailPane = ({
  detail,
  isLoading,
  causeCode,
  handlingNote,
  fieldErrors,
  isSaving,
  onChangeCause,
  onChangeNote,
  onSave,
  onStartHandling,
  onComplete,
}: DetailPaneProps) => {
  const noteId = useId();

  if (isLoading) return <Skeleton variant="rect" height="18rem" />;

  if (detail === null) {
    return <EmptyState size="sm" title={t.detail.emptyTitle} description={t.detail.empty} />;
  }

  const startReason = startHandlingLockReason(detail);
  const completeReason = completeLockReason(detail, causeCode, handlingNote);
  const saveReason = saveLockReason(detail);
  const downtimeWarning = openDowntimeWarning(detail);

  return (
    <>
      <div className="notification-card-meta">
        <strong>{detail.breakdownNo ?? String(detail.breakdownId)}</strong>
        <Chip size="sm">{statusLabel(detail.statusCode)}</Chip>
      </div>

      <h3>{t.detail.reportHeading}</h3>
      {/* ⛔ 현장 기록은 사무가 고치지 않는다. 감추지 않고 그 사실을 말한다. */}
      <p className="pane-lead">{t.detail.reportReadOnly}</p>

      <div className="form-grid">
        <ReadOnlyRow label={t.detail.symptom} value={detail.symptom} />
        <ReadOnlyRow
          label={t.detail.occurrenceState}
          value={occurrenceLabel(detail.occurrenceStateCode)}
        />
        <ReadOnlyRow
          label={t.detail.stoppedAt}
          /* ⭐ 비어 있음이 곧 「현장이 모른다」다 — 빈 칸으로 두면 자료가 빠진 것으로 읽힌다. */
          value={
            detail.stoppedAt === null ? t.detail.stoppedAtUnknown : formatMoment(detail.stoppedAt)
          }
        />
        <ReadOnlyRow label={t.detail.reportedAt} value={formatMoment(detail.reportedAt)} />
        <ReadOnlyRow label={t.detail.reporter} value={detail.reporterWorkerNo} />
        <ReadOnlyRow
          label={t.detail.photos}
          value={
            detail.attachmentCount === 0
              ? t.detail.noPhotos
              : `${t.detail.photoCount(detail.attachmentCount)} · ${t.detail.photosNotViewable}`
          }
        />
      </div>

      <h3>{t.detail.downtimeHeading}</h3>
      <div className="form-grid">
        <ReadOnlyRow
          label={t.detail.downtimeCountLabel}
          value={t.detail.downtimeCount(detail.linkedDowntimeCount)}
        />
        <ReadOnlyRow
          label={t.detail.downtimeMinutesLabel}
          value={
            detail.linkedDowntimeMinutes === null
              ? t.detail.downtimeMinutesUnknown
              : t.detail.downtimeMinutes(detail.linkedDowntimeMinutes)
          }
        />
      </div>

      {downtimeWarning !== null && (
        <div className="banner-slot">
          <AlertBanner variant="warning" title={downtimeWarning} />
        </div>
      )}

      <h3>{t.detail.handlingHeading}</h3>
      <div className="form-grid">
        <SelectField
          label={t.detail.causeCode}
          options={[...PLACEHOLDER_CAUSE_CODES]}
          value={causeCode}
          note={causeNote()}
          error={fieldErrors.causeCode}
          placeholder={t.codes.selectPlaceholder}
          disabled={PLACEHOLDER_CAUSE_CODES.length === 0 || saveReason !== null}
          wide
          onChange={onChangeCause}
        />

        <div className="field-cell form-grid-full">
          <FieldLabel htmlFor={noteId} label={t.detail.handlingNote} />
          {/* 오류 문구는 `TextField`가 스스로 그린다 — 밖에서 또 그리면 같은 말이 두 번 선다. */}
          <TextField
            id={noteId}
            value={handlingNote}
            disabled={saveReason !== null}
            error={fieldErrors.handlingNote}
            onChange={(event) => {
              onChangeNote(event.target.value);
            }}
          />
        </div>

        <ReadOnlyRow
          label={t.detail.maintenanceOrder}
          value={
            detail.handling.maintenanceOrderId === null
              ? t.detail.noMaintenanceOrder
              : String(detail.handling.maintenanceOrderId)
          }
        />
        <ReadOnlyRow
          label={t.detail.handledAt}
          value={
            detail.handling.handledAt === null
              ? t.table.notAvailable
              : formatMoment(detail.handling.handledAt)
          }
        />
      </div>

      <div className="form-actions">
        <Button variant="outlined" onClick={onSave} disabled={isSaving || saveReason !== null}>
          {t.detail.save}
        </Button>
        <Button
          variant="outlined"
          onClick={onStartHandling}
          disabled={isSaving || startReason !== null}
        >
          {t.actions.startHandling}
        </Button>
        <Button onClick={onComplete} disabled={isSaving || completeReason !== null}>
          {t.actions.complete}
        </Button>
      </div>

      {/* 규범 4 — 잠근 이유를 감추지 않는다. 셋의 사유가 서로 다르므로 각각 낸다. */}
      {saveReason !== null && <p className="pane-lead">{saveReason}</p>}
      {startReason !== null && <p className="pane-lead">{startReason}</p>}
      {completeReason !== null && <p className="pane-lead">{completeReason}</p>}
    </>
  );
};

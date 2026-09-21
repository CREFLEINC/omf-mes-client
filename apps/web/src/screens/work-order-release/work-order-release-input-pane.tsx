import { AlertBanner, Button, EmptyState, TextArea, TextField } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import {
  EMPTY_WORK_ORDER_RELEASE_DRAFT,
  evaluateWorkOrderReleaseDraft,
  type WorkOrderReleaseDraft,
} from './release-draft';

type WorkOrderRelease = components['schemas']['WorkOrderRelease'];
type ReleaseField = keyof WorkOrderRelease;

const t = messages.workOrderRelease.input;

/** 공지 확인 이력을 보는 화면(W-CO-04). */
const NOTICE_SCREEN_PATH = '/notification/notices';

interface OwnedDraft {
  ownerKey: number | null;
  value: WorkOrderReleaseDraft;
}

const formatQuantity = (value: number): string =>
  new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 }).format(value);

export interface WorkOrderReleaseInputPaneProps {
  ownerKey: number | null;
  orderQty: number | null;
  uomLabel: string | null;
  lockedReason: string | null;
  /** 잠겼을 때 영역 위에 한 번 보이는 이유. 원인이 다른 곳에 이미 보이면 null. */
  lockedNote?: string | null;
  fieldErrors?: Partial<Record<ReleaseField, string>>;
  onClearFieldError?: (field: ReleaseField) => void;
  onBodyChange: (body: WorkOrderRelease | null) => void;
}

export const WorkOrderReleaseInputPane = ({
  ownerKey,
  orderQty,
  uomLabel,
  lockedReason,
  lockedNote = null,
  fieldErrors = {},
  onClearFieldError,
  onBodyChange,
}: WorkOrderReleaseInputPaneProps) => {
  const navigate = useNavigate();
  const handoverNoteId = useId();
  const [ownedDraft, setOwnedDraft] = useState<OwnedDraft>({
    ownerKey,
    value: EMPTY_WORK_ORDER_RELEASE_DRAFT,
  });
  const draft =
    ownedDraft.ownerKey === ownerKey ? ownedDraft.value : EMPTY_WORK_ORDER_RELEASE_DRAFT;
  const evaluation = useMemo(
    () => evaluateWorkOrderReleaseDraft(draft, orderQty),
    [draft, orderQty],
  );

  useEffect(() => {
    if (ownedDraft.ownerKey !== ownerKey) {
      setOwnedDraft({ ownerKey, value: EMPTY_WORK_ORDER_RELEASE_DRAFT });
    }
  }, [ownedDraft.ownerKey, ownerKey]);
  useEffect(() => onBodyChange(evaluation.body), [evaluation.body, onBodyChange]);

  if (ownerKey === null || orderQty === null) {
    return (
      <section className="pane" aria-label={t.pane}>
        <EmptyState size="sm" title={t.empty.title} description={t.empty.description} />
      </section>
    );
  }

  const unit = uomLabel === null || uomLabel.trim() === '' ? t.values.unitUnavailable : uomLabel;
  const update = (field: ReleaseField, value: string): void => {
    setOwnedDraft((current) => ({
      ownerKey,
      value: {
        ...(current.ownerKey === ownerKey ? current.value : EMPTY_WORK_ORDER_RELEASE_DRAFT),
        [field === 'lotSize' ? 'lotSizeText' : 'handoverNote']: value,
      },
    }));
    onClearFieldError?.(field);
  };

  return (
    <section className="pane work-order-release-input-pane" aria-label={t.pane}>
      {/* 제목 아래 보조 글로 둔다 — 제목과 안내의 위계를 가른다(사용자 지시 2026-09-20). */}
      <div className="work-order-release-input-heading">
        <h2 className="pane-title">{t.heading}</h2>
        {lockedReason !== null && lockedNote !== null && (
          <p className="work-order-release-input-note">{lockedNote}</p>
        )}
      </div>
      <div className="form-grid work-order-release-input-grid">
        <TextField
          fullWidth
          required
          inputMode="decimal"
          label={t.fields.lotSize}
          value={draft.lotSizeText}
          disabled={lockedReason !== null}
          error={
            lockedReason === null ? (evaluation.lotSizeError ?? fieldErrors.lotSize) : undefined
          }
          /* 단위는 값 바로 옆이 가장 읽기 쉽다 — 서버가 준 단위를 그대로 붙인다. */
          trailingIcon={<span className="work-order-release-unit">{unit}</span>}
          onChange={(event) => update('lotSize', event.target.value)}
        />
        <TextArea
          id={handoverNoteId}
          fullWidth
          rows={3}
          label={t.fields.handoverNote}
          value={draft.handoverNote}
          disabled={lockedReason !== null}
          error={lockedReason === null ? fieldErrors.handoverNote : undefined}
          onChange={(event) => update('handoverNote', event.target.value)}
        />
        {/*
          공지는 이 화면의 본 작업이 아니다 — 입력 아래 보조 줄로 내리고 단추도 테두리형으로 둔다
          (사용자 지시 2026-09-20).
        */}
        <div className="work-order-release-notice-row">
          <span className="work-order-release-notice-text">{t.helper.handoverNote}</span>
          <Button variant="outlined" onClick={() => void navigate(NOTICE_SCREEN_PATH)}>
            {t.helper.handoverNoteGo}
          </Button>
        </div>
        {evaluation.preview !== null && (
          <div className="form-grid-full">
            <div className={evaluation.preview.isSingleSlotWarning ? 'banner-slot' : undefined}>
              <AlertBanner variant="info" title={t.preview.title(evaluation.preview.slotCount)}>
                {t.preview.formula(
                  formatQuantity(orderQty),
                  formatQuantity(evaluation.body?.lotSize ?? 0),
                  evaluation.preview.slotCount,
                  unit,
                )}{' '}
                {t.preview.planNotice}
              </AlertBanner>
            </div>
            {evaluation.preview.isSingleSlotWarning && (
              <AlertBanner variant="warning" title={t.warning.title}>
                {t.warning.description}
              </AlertBanner>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

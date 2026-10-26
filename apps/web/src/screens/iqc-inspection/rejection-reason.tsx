import { Button, Dialog, Icon, Select, TextArea } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { FieldLabel } from './field-label';

const t = messages.iqcInspection.result.rejection;

type DefectCode = components['schemas']['DefectCode'];
type CauseCode = components['schemas']['CauseCode'];

/**
 * 불합격 사유 초안 — 대분류·상세는 `defectCodeId` 문자열, 사유는 글 그대로다. 추정 원인은 `causeCodeId`
 * 문자열이고 고르지 않으면 `''` 이다(선택 입력 · omf-all-around#130).
 */
export interface RejectionDraft {
  majorId: string;
  minorId: string;
  description: string;
  causeId: string;
}

export const EMPTY_REJECTION: RejectionDraft = {
  majorId: '',
  minorId: '',
  description: '',
  causeId: '',
};

/**
 * 임시 저장된 불량 기록 → 사유 초안(omf-all-around#122). 상세 코드면 그 부모가 대분류다. 코드 마스터에 없는 코드
 * (비활성·삭제)는 고를 수 없으니 사유 글만 되살린다.
 */
export const rejectionDraftOf = (
  codes: readonly DefectCode[],
  record: {
    defectCodeId: number;
    defectDescription?: string | null;
    suspectedCauseCodeId?: number | null;
  },
): RejectionDraft => {
  const code = codes.find((candidate) => candidate.defectCodeId === record.defectCodeId);
  const description = record.defectDescription ?? '';
  /* 원인은 코드 마스터와 견주지 않고 그대로 되살린다 — 사용 중지된 원인도 다시 보내야 서버 값이 지워지지 않는다(#130). */
  const causeId = record.suspectedCauseCodeId == null ? '' : String(record.suspectedCauseCodeId);
  if (code === undefined) return { ...EMPTY_REJECTION, description, causeId };
  return code.parentDefectCodeId == null
    ? { majorId: String(code.defectCodeId), minorId: '', description, causeId }
    : {
        majorId: String(code.parentDefectCodeId),
        minorId: String(code.defectCodeId),
        description,
        causeId,
      };
};

/**
 * 추정 원인 선택지(omf-all-around#130) — 「선택 안 함」 + 사용 중인 원인. 대분류 뒤에 그 상세를 «상세 (대분류)»로
 * 잇는다 — 칸이 좁아 잘려도 고른 상세가 먼저 보인다(대시보드는 원인 대분류로 묶는다). 지금 고른 원인이 사용 중지됐으면 사라지지 않게 표시를 붙여 남긴다.
 */
export const causeOptionsOf = (causes: readonly CauseCode[], selectedId: string) => {
  const label = (cause: CauseCode) => `${cause.causeCode} · ${cause.causeName}`;
  const byId = new Map(causes.map((cause) => [String(cause.causeCodeId), cause]));
  const active = causes.filter((cause) => cause.isActive !== false);
  const majors = active.filter((cause) => cause.parentCauseCodeId == null);
  const options: { value: string; label: string }[] = [{ value: '', label: t.causeNone }];
  for (const major of majors) {
    options.push({ value: String(major.causeCodeId), label: label(major) });
    for (const minor of active.filter((cause) => cause.parentCauseCodeId === major.causeCodeId)) {
      options.push({
        value: String(minor.causeCodeId),
        label: `${label(minor)} (${major.causeName})`,
      });
    }
  }
  if (selectedId !== '' && !options.some((option) => option.value === selectedId)) {
    const selected = byId.get(selectedId);
    options.push({
      value: selectedId,
      label: t.causeInactive(selected === undefined ? `#${selectedId}` : label(selected)),
    });
  }
  return options;
};

/** 사용 중인 대분류(부모가 없는 코드)와 그 상세. W-06-03 이 두 단계로 관리한다. */
const majorsOf = (codes: readonly DefectCode[]) =>
  codes.filter((code) => code.parentDefectCodeId == null && code.isActive !== false);
/* ⚠ 대분류를 고르기 전(`''`)에는 상세가 없다 — 부모 없는 코드(대분류)가 `''` 과 같아져 상세로 잡히지 않게. */
const minorsOf = (codes: readonly DefectCode[], majorId: string) =>
  majorId === ''
    ? []
    : codes.filter(
        (code) => String(code.parentDefectCodeId ?? '') === majorId && code.isActive !== false,
      );

const optionOf = (code: DefectCode) => ({
  value: String(code.defectCodeId),
  label: `${code.defectCode} · ${code.defectName}`,
});

/**
 * 기록할 불량 코드 — 상세가 있으면 상세, 없으면 대분류다. 확정할 수 없으면 `null` 과 막힌 사유를 낸다.
 * ⭐ 상세가 있는 대분류를 그대로 기록하면 분포(W-03-05)의 상세 축이 비어 사유를 가를 수 없다.
 */
export const resolveDefectCode = (
  codes: readonly DefectCode[],
  draft: RejectionDraft,
): { defectCodeId: number } | { blocked: string } => {
  if (draft.majorId === '') return { blocked: t.required };
  const minors = minorsOf(codes, draft.majorId);
  if (minors.length > 0 && draft.minorId === '') return { blocked: t.minorRequired };
  return { defectCodeId: Number(draft.minorId === '' ? draft.majorId : draft.minorId) };
};

export interface RejectionReasonProps {
  codes: readonly DefectCode[];
  /** 추정 원인 마스터(사용 중지 포함 — 고른 값이 사용 중지돼도 보이게). */
  causes: readonly CauseCode[];
  draft: RejectionDraft;
  onChange: (draft: RejectionDraft) => void;
  disabled: boolean;
}

/**
 * 불합격 사유 칸(omf-all-around#106) — 종합 판정이 불합격일 때만 선다. 불량 코드는 사업부 공용 마스터
 * (W-06-03)를 쓴다(2026-10-16 결정). 임시 저장(서버 P-48)·확정(P-47)이 그 회차의 불량 기록으로 남긴다.
 *
 * 배치(3단계 검증 · 담당자 지시): 테두리 상자 대신 옅은 면 하나, 1행 대분류·상세 같은 폭 2열(좁으면 1열), 2행 사유
 * 전체 폭. 라벨은 모두 입력 위, 필수 누락은 그 칸 아래. 상세는 대분류에 상세가 있을 때만 고를 수 있다(없으면 비활성).
 */
export const RejectionReason = ({
  codes,
  causes,
  draft,
  onChange,
  disabled,
}: RejectionReasonProps) => {
  const majorId = useId();
  const minorId = useId();
  const causeId = useId();
  const majors = majorsOf(codes);
  const minors = minorsOf(codes, draft.majorId);
  const hasMinors = minors.length > 0;
  const majorMissing = draft.majorId === '';
  const minorMissing = hasMinors && draft.minorId === '';

  return (
    /*
     * 최종 판정과 한 줄에 선다(사용자 지시 2026-10-26 · #185) — 「불합격 사유」 상자 · 제목 없이 칸만. 묶음 이름은 화면 읽기로만 남긴다.
     * 사유(글)는 칸 대신 저장 줄의 [사유 입력](`RejectionDescriptionButton`)이 받는다.
     */
    <div className="iqc-inspection-rejection" role="group" aria-label={t.heading}>
      {majors.length === 0 && <p className="field-note">{t.noCodes}</p>}
      <div className="form-grid iqc-inspection-rejection-codes">
        <div className="field-cell">
          <FieldLabel htmlFor={majorId} label={t.major} required />
          <Select
            id={majorId}
            options={majors.map(optionOf)}
            value={draft.majorId}
            placeholder={t.majorPlaceholder}
            invalid={majorMissing}
            aria-describedby={majorMissing ? `${majorId}-error` : undefined}
            disabled={disabled || majors.length === 0}
            onChange={(value) => {
              onChange({ ...draft, majorId: value, minorId: '' });
            }}
          />
          {majorMissing && (
            <span id={`${majorId}-error`} className="iqc-inspection-visually-hidden">
              {t.majorMissing}
            </span>
          )}
        </div>
        <div className="field-cell">
          <FieldLabel htmlFor={minorId} label={t.minor} required={hasMinors} />
          <Select
            id={minorId}
            options={minors.map(optionOf)}
            value={draft.minorId}
            placeholder={t.minorPlaceholder}
            invalid={minorMissing}
            aria-describedby={minorMissing ? `${minorId}-error` : undefined}
            disabled={disabled || !hasMinors}
            onChange={(value) => {
              onChange({ ...draft, minorId: value });
            }}
          />
          {minorMissing && (
            <span id={`${minorId}-error`} className="iqc-inspection-visually-hidden">
              {t.minorMissing}
            </span>
          )}
        </div>
        {/* 추정 원인 — 선택 입력(omf-all-around#130). 같은 2열의 다음 줄 왼쪽 칸에 선다. */}
        <div className="field-cell">
          <FieldLabel htmlFor={causeId} label={t.cause} />
          <Select
            id={causeId}
            options={causeOptionsOf(causes, draft.causeId)}
            value={draft.causeId}
            placeholder={t.causeNone}
            disabled={disabled}
            onChange={(value) => {
              onChange({ ...draft, causeId: value });
            }}
          />
        </div>
      </div>
    </div>
  );
};

/**
 * [사유 입력] — 불합격 사유 글을 창에서 받는다(사용자 지시 2026-10-26 · #185). 저장 줄에 선다. 창에서 고친 글은
 * [저장]을 눌러야 판정에 실린다 — [취소]·Esc 면 그대로다. 잠긴 회차에서는 읽기만 한다(저장 꺼짐).
 */
export const RejectionDescriptionButton = ({
  description,
  onChange,
  disabled,
}: {
  description: string;
  onChange: (description: string) => void;
  disabled: boolean;
}) => {
  const [editing, setEditing] = useState<string | null>(null);
  const fieldId = useId();

  return (
    <>
      <Button
        type="button"
        variant="outlined"
        size="md"
        className="iqc-inspection-reason-button"
        data-filled={description.trim() === '' ? undefined : ''}
        onClick={() => setEditing(description)}
      >
        <Icon name="chat" size={18} aria-hidden />
        {t.descriptionAction}
      </Button>
      {editing !== null && (
        <Dialog
          open
          onClose={() => setEditing(null)}
          showCloseButton={false}
          title={t.descriptionAction}
          footer={
            <>
              <Button
                variant="outlined"
                className="app-button-neutral"
                onClick={() => setEditing(null)}
              >
                {t.descriptionCancel}
              </Button>
              {/* 잠긴 회차에서는 고쳐 담을 곳이 없다 — 단추는 자리만 지키고 꺼 둔다. */}
              <Button
                variant="filled"
                disabled={disabled}
                onClick={() => {
                  onChange(editing);
                  setEditing(null);
                }}
              >
                {t.descriptionApply}
              </Button>
            </>
          }
        >
          {/* 칸 위 이름표는 두지 않는다 — 창 제목이 말한다. 화면 읽기에는 이름을 남긴다. */}
          <TextArea
            id={fieldId}
            aria-label={t.description}
            fullWidth
            rows={4}
            value={editing}
            readOnly={disabled}
            onChange={(event) => setEditing(event.target.value)}
          />
        </Dialog>
      )}
    </>
  );
};

import { Button, Checkbox, Dialog, TextArea } from '@crefle/web-ui';
import type { FourMChangeForward } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { FieldLabel } from './field-label';

const t = messages.iqcInspection.result.fourMChange;

/** 변경 내용 길이 상한 — 서버 계약 `fourMChange.remarks` maxLength(장부 P-86). */
export const FOUR_M_REMARKS_MAX = 500;

/**
 * 화면이 쥐는 4M 변경품 초안(omf-all-around#63). 체크를 풀면 변경 내용을 보내지 않는다.
 * 변경 종류는 받지 않는다(omf-all-around#133) — 비고(변경 내용)만 적는다.
 */
export interface FourMChangeDraft {
  checked: boolean;
  remarks: string;
}

export const EMPTY_FOUR_M_CHANGE: FourMChangeDraft = {
  checked: false,
  remarks: '',
};

/** 서버에 남은 기록 → 초안. 기록이 없으면 변경품이 아니다. */
export const fourMDraftOf = (stored: FourMChangeForward | null): FourMChangeDraft =>
  stored === null ? EMPTY_FOUR_M_CHANGE : { checked: true, remarks: stored.remarks ?? '' };

/** 초안 → 쓰기 본문. 체크를 풀었으면 `null`(그 LOT 의 기록을 지운다). */
export const fourMBodyOf = (draft: FourMChangeDraft): FourMChangeForward | null => {
  if (!draft.checked) return null;
  return { remarks: draft.remarks.trim() };
};

/** 체크했는데 변경 내용이 비었으면 저장·확정을 막는다(서버도 400). */
export const isFourMIncomplete = (draft: FourMChangeDraft): boolean =>
  draft.checked && draft.remarks.trim() === '';

export const isSameFourM = (a: FourMChangeDraft, b: FourMChangeDraft): boolean =>
  a.checked === b.checked && (!a.checked || a.remarks.trim() === b.remarks.trim());

export interface FourMChangeProps {
  draft: FourMChangeDraft;
  onChange: (next: FourMChangeDraft) => void;
  disabled: boolean;
}

/**
 * 판정 오른쪽 — 4M 변경품 체크와 그 아래 전체 폭 [비고 입력](omf-all-around#63 · #133). 비고(필수)는 창에서 적는다 — 판정 줄에
 * 빈 공간이 생기지 않게(사용자 지시 2026-10-27 · #185). 단추는 체크했을 때만 선다.
 * 판정과 함께 임시 저장·확정에 실린다. 투입을 막지 않고 POP 투입 때 알리기만 한다.
 */
export const FourMChange = ({ draft, onChange, disabled }: FourMChangeProps) => {
  const remarksId = useId();
  const [isOpen, setIsOpen] = useState(false);
  /* 창을 열 때의 값 — [취소] · Esc 는 이 값으로 되돌린다(막 체크하고 연 창이면 체크가 풀린다 · #197). */
  const [opened, setOpened] = useState<FourMChangeDraft>(draft);
  /* 창 안에서 적는 중인 비고 — [완료]를 눌러야 상자에 반영한다(사용자 지시 2026-10-28 · #197). */
  const [text, setText] = useState('');
  const open = (from: FourMChangeDraft): void => {
    setOpened(from);
    setText(from.remarks);
    setIsOpen(true);
  };
  const cancel = (): void => {
    onChange(opened);
    setIsOpen(false);
  };
  const done = (): void => {
    onChange({ checked: true, remarks: text });
    setIsOpen(false);
  };
  /* 보일 때만 빈 줄을 하나로 줄인다 — 값은 그대로다. */
  const shownRemarks = draft.checked ? draft.remarks.trim().replace(/\n\s*\n+/g, '\n') : '';

  return (
    <div className="iqc-inspection-four-m" role="group" aria-label={t.label}>
      {/* 체크 위 소제목 — 판정 상자의 「최종 판정」 라벨과 같은 층(사용자 지시 2026-10-27 · #185). */}
      <span className="field-label">{t.changedLabel}</span>
      <Checkbox
        checked={draft.checked}
        disabled={disabled}
        onChange={(event) => {
          onChange({ ...draft, checked: event.target.checked });
          /* 체크했는데 비고가 없을 때만 비고(필수) 창을 바로 연다(사용자 지시 2026-10-27 · 2026-10-28 · #197). */
          if (event.target.checked && draft.remarks.trim() === '') open(draft);
        }}
      >
        <span className="iqc-inspection-four-m-label">{t.label}</span>
      </Checkbox>
      {draft.checked && (
        <Button
          type="button"
          /* 체크와 같은 줄 오른쪽 끝 테두리 단추 — ① · ② 카드 [변경]과 같은 크기다(사용자 지시 2026-10-28 · #197). */
          variant="outlined"
          size="md"
          className="iqc-inspection-four-m-edit"
          disabled={disabled}
          onClick={() => open(draft)}
        >
          {/* 적은 비고가 상자에 보이면 「수정」(사용자 지시 2026-10-28 · #197). */}
          {shownRemarks === '' ? t.remarksOpen : t.remarksEdit}
        </Button>
      )}
      {/*
       * 적은 비고를 상자에 보인다 — 창을 다시 열지 않아도 무엇을 적었는지 읽힌다(사용자 지시 2026-10-27 · #197). 체크 아래
       * 어두운 바탕 상자에 「비고」와 내용을 두고, 세 줄을 넘으면 상자 안에서 굴린다(사용자 시안 2026-10-28).
       */}
      {shownRemarks !== '' && (
        <div className="iqc-inspection-four-m-remarks">
          <span className="iqc-inspection-four-m-remarks-label">{t.remarks}</span>
          {/* 세 줄 높이를 넘으면 상자 안에서 굴려 본다(사용자 시안 2026-10-28). */}
          <span className="iqc-inspection-four-m-remarks-text" tabIndex={0}>
            {shownRemarks}
          </span>
        </div>
      )}
      {/*
       * 비고는 필수라 비어 있으면 [완료]가 꺼진다. [취소] · Esc 는 열 때 값으로 되돌린다 — 체크하자마자 연 창이면 체크도
       * 풀린다(#197).
       */}
      <Dialog
        open={isOpen && draft.checked}
        onClose={cancel}
        size="md"
        title={t.remarksTitle}
        showCloseButton={false}
        footer={
          <>
            <Button
              type="button"
              variant="outlined"
              size="md"
              className="app-button-neutral"
              onClick={cancel}
            >
              {t.remarksCancel}
            </Button>
            <Button
              type="button"
              size="md"
              // ui-check-ignore: C-4 비고가 비면 반영할 것이 없다 — 위 칸의 필수 표시가 까닭이다
              disabled={text.trim() === ''}
              onClick={done}
            >
              {t.remarksDone}
            </Button>
          </>
        }
      >
        <div className="field-cell">
          <FieldLabel htmlFor={remarksId} label={t.remarks} required />
          {/* 여러 줄 — Enter 는 줄바꿈이다(바깥 저장 폼으로 넘어가 임시 저장되지 않게 · 사용자 지시 2026-10-28 · #197). */}
          <TextArea
            id={remarksId}
            fullWidth
            rows={3}
            placeholder={t.remarksPlaceholder}
            value={text}
            maxLength={FOUR_M_REMARKS_MAX}
            containerClassName="iqc-inspection-border-only"
            disabled={disabled}
            onChange={(event) => {
              setText(event.target.value);
            }}
          />
        </div>
      </Dialog>
    </div>
  );
};

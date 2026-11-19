import { messages } from '@omf-mes/i18n';
import { useId, type ReactNode } from 'react';

import { PuButton, PuChip, PuInput, PuSection } from '../../patterns/pop-uniform';

import { toDurationLabel } from './formatting';
import {
  intervalMinutes,
  readInterval,
  toTimeFieldDraft,
  type IntervalDraft,
  type IntervalErrors,
} from './interval';

const t = messages.downtimeRegister;

/** 오류 갈래를 문구로. 짝 제약은 두 칸에 **같은 말**이 선다(스펙 §6-1). */
/** 시작 칸의 오류 문구. **끝 칸과 「덜 친 것」의 안내가 다르다** — 고칠 칸을 가리켜야 한다. */
const describeStartedError = (kind: IntervalErrors['startedAt']): string | undefined => {
  switch (kind) {
    /*
     * ⛔ **「아직 안 친 것」은 글로 말하지 않는다.** 스펙 §5-1 이 그 자리에 정한 것은 저장의
     *    「활성 조건」뿐이라 **버튼이 잠긴 것이 곧 그 말**이고, 빈 화면을 붉은 글씨로 맞이하지
     *    않는다. 화면이 이 갈래를 걸러 넘기지 않는다(`shownIntervalErrors`).
     */
    case 'required':
      return undefined;
    case 'incomplete':
      return t.errors.startedIncomplete;
    case 'future':
      return t.errors.future;
    case 'order':
      return t.errors.endedBeforeStarted;
    case null:
      return undefined;
  }
};

const describeEndedError = (kind: IntervalErrors['endedAt']): string | undefined => {
  switch (kind) {
    case 'incomplete':
      return t.errors.endedIncomplete;
    case 'future':
      return t.errors.future;
    case 'order':
      return t.errors.endedBeforeStarted;
    case null:
      return undefined;
  }
};

export interface IntervalFieldsProps {
  draft: IntervalDraft;
  errors: IntervalErrors;
  onChange: (next: IntervalDraft) => void;
  /** 구획 아래에 붙는 것(겹침 경고 등). */
  children?: ReactNode;
}

/**
 * 시작·종료일시 구획(#295 시안 — 「구간」 제목 자리에 「비가동 시간」).
 *
 * ⭐ **`[지금]`이 기본 경로다**(스펙 §5-2 · §7-1). 날짜·시각 칸의 네이티브 피커는 단말의
 * 브라우저 판에 따라 다르게 뜨고 터치 타겟도 우리 규격을 따르지 않는다 — 손으로 고르는 것은
 * **보정 경로**로 두고, 평소에는 버튼 한 번으로 단말 시각이 들어간다.
 *
 * ⛔ **시각을 보정하지 않는다.** 단말 시계가 몇 분 빠르더라도 그대로 넣는다 — 작업자가 본 값과
 * 저장된 값이 갈리면 나중에 아무도 그 기록을 설명하지 못한다.
 *
 * ⛔ **「아직 진행 중」은 끝 시각과 상호 배타다.** 체크하면 끝 칸을 잠그고 값을 보내지 않는다 —
 * 「진행 중」이라는 별도 값이 있는 것이 아니라 **끝이 비어 있는 것**이 그 뜻이다.
 */
export const IntervalFields = ({ draft, errors, onChange, children }: IntervalFieldsProps) => {
  const startedErrorId = useId();
  const endedErrorId = useId();
  const startedLabelId = useId();
  const endedLabelId = useId();
  const moments = readInterval(draft);
  const minutes = intervalMinutes(moments);

  /* 오류는 칸 바로 아래 빨간 한 줄 — 칸에는 붉은 테두리(`aria-invalid`)를 함께 단다. */
  const startedError = describeStartedError(errors.startedAt);
  /* 오류 줄은 한 번에 하나 — 시작 칸이 먼저다(시안). 끝 칸의 테두리는 그대로 붉다. */
  const endedError = describeEndedError(errors.endedAt);

  /*
   * 비가동 시간 — **입력 확인용**이다. 저장되는 값은 서버가 낸다(§4-A · L-2).
   * ⛔ **0분으로 채우지 않는다** — 없는 값과 0을 같은 모양으로 만들지 않는다(`G-9`).
   * ⭐ 제목 옆 라벨로 보인다 — 값이 없으면 「자동 계산」, 있으면 길이(사용자 지시 2026-11-19).
   */
  const durationValue = minutes === null ? t.interval.durationAuto : toDurationLabel(minutes);

  const setStarted = (part: 'date' | 'time', value: string): void => {
    onChange({ ...draft, startedAt: { ...draft.startedAt, [part]: value } });
  };

  const setEnded = (part: 'date' | 'time', value: string): void => {
    onChange({ ...draft, endedAt: { ...draft.endedAt, [part]: value } });
  };

  return (
    <PuSection
      className="dt-interval"
      grow={false}
      title={
        <span className="dt-dur">
          {t.interval.duration} <PuChip tone="info">{durationValue}</PuChip>
        </span>
      }
    >
      <div className="pu-field">
        <span className="pu-label" id={startedLabelId}>
          {t.interval.startedAtLabel}
          <span className="req" aria-hidden>
            *
          </span>
        </span>
        <div className="dt-tm">
          {/* ⚠ 읽어 주는 이름은 「시작 날짜」·「시작 시각」이다 — 두 칸이 같은 이름이 되지 않게. */}
          <PuInput
            type="date"
            aria-label={`${t.interval.startedAt} ${t.interval.date}`}
            aria-describedby={startedError === undefined ? undefined : startedErrorId}
            value={draft.startedAt.date}
            need={draft.startedAt.date === '' || startedError !== undefined}
            onChange={(event) => {
              setStarted('date', event.target.value);
            }}
          />
          <PuInput
            type="time"
            aria-label={`${t.interval.startedAt} ${t.interval.time}`}
            aria-describedby={startedError === undefined ? undefined : startedErrorId}
            value={draft.startedAt.time}
            need={draft.startedAt.time === '' || startedError !== undefined}
            onChange={(event) => {
              setStarted('time', event.target.value);
            }}
          />
          <PuButton
            onClick={() => {
              onChange({ ...draft, startedAt: toTimeFieldDraft(new Date()) });
            }}
          >
            {t.interval.now}
          </PuButton>
        </div>
        {startedError !== undefined && (
          <span id={startedErrorId} className="dt-err">
            {startedError}
          </span>
        )}
      </div>

      <div className="pu-field">
        <div className="dt-lbl-row">
          <span className="pu-label" id={endedLabelId}>
            {t.interval.endedAtLabel}
            {/* 선택 칸은 늘 「(선택)」을 붙인다(사용자 지시 2026-11-19). */}
            <span className="opt">{t.reason.optional}</span>
          </span>
          <label className="pu-check">
            <input
              type="checkbox"
              checked={draft.stillOngoing}
              onChange={(event) => {
                /* 체크하면 끝 칸에 남은 글자는 그대로 두되 **읽지 않는다**(`readInterval`) —
                   지워 버리면 체크를 잘못 눌렀을 때 작업자가 다시 쳐야 한다. */
                onChange({ ...draft, stillOngoing: event.target.checked });
              }}
            />
            {t.interval.stillOngoing}
          </label>
        </div>
        <div className="dt-tm">
          <PuInput
            type="date"
            aria-label={`${t.interval.endedAt} ${t.interval.date}`}
            aria-describedby={endedError === undefined ? undefined : endedErrorId}
            value={draft.endedAt.date}
            disabled={draft.stillOngoing}
            need={endedError !== undefined}
            onChange={(event) => {
              setEnded('date', event.target.value);
            }}
          />
          <PuInput
            type="time"
            aria-label={`${t.interval.endedAt} ${t.interval.time}`}
            aria-describedby={endedError === undefined ? undefined : endedErrorId}
            value={draft.endedAt.time}
            disabled={draft.stillOngoing}
            need={endedError !== undefined}
            onChange={(event) => {
              setEnded('time', event.target.value);
            }}
          />
          <PuButton
            disabled={draft.stillOngoing}
            onClick={() => {
              onChange({ ...draft, endedAt: toTimeFieldDraft(new Date()) });
            }}
          >
            {t.interval.now}
          </PuButton>
        </div>
        {endedError !== undefined && (
          <span id={endedErrorId} className="dt-err">
            {endedError}
          </span>
        )}
      </div>
      {children}
    </PuSection>
  );
};

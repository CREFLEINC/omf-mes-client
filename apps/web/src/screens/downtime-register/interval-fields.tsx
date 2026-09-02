import { Button, Card, Checkbox, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

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
type ErrorKind = IntervalErrors['startedAt'] | IntervalErrors['endedAt'];

const describeError = (kind: ErrorKind): string | undefined => {
  switch (kind) {
    case 'required':
      return t.errors.startedRequired;
    case 'future':
      return t.errors.future;
    case 'order':
      return t.errors.endedBeforeStarted;
    case 'incomplete':
      return t.errors.endedIncomplete;
    case null:
      return undefined;
  }
};

export interface IntervalFieldsProps {
  draft: IntervalDraft;
  errors: IntervalErrors;
  onChange: (next: IntervalDraft) => void;
}

/**
 * ② 구간.
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
export const IntervalFields = ({ draft, errors, onChange }: IntervalFieldsProps) => {
  const minutes = intervalMinutes(readInterval(draft));

  const setStarted = (part: 'date' | 'time', value: string): void => {
    onChange({ ...draft, startedAt: { ...draft.startedAt, [part]: value } });
  };

  const setEnded = (part: 'date' | 'time', value: string): void => {
    onChange({ ...draft, endedAt: { ...draft.endedAt, [part]: value } });
  };

  return (
    <Card>
      <section className="downtime-section" aria-label={t.interval.title}>
        <h2 className="pane-title">{t.interval.title}</h2>

        <div className="downtime-time-row">
          <TextField
            type="date"
            size="xl"
            label={`${t.interval.startedAt} ${t.interval.date}`}
            value={draft.startedAt.date}
            error={describeError(errors.startedAt)}
            onChange={(event) => {
              setStarted('date', event.target.value);
            }}
          />
          <TextField
            type="time"
            size="xl"
            label={`${t.interval.startedAt} ${t.interval.time}`}
            value={draft.startedAt.time}
            /* 오류 글은 한 번만 낸다 — 같은 문장을 두 칸에 쓰면 읽는 사람이 두 문제로 센다. */
            error={errors.startedAt === null ? undefined : ' '}
            onChange={(event) => {
              setStarted('time', event.target.value);
            }}
          />
          <Button
            variant="tonal"
            size="2xl"
            onClick={() => {
              onChange({ ...draft, startedAt: toTimeFieldDraft(new Date()) });
            }}
          >
            {t.interval.now}
          </Button>
        </div>

        <div className="downtime-time-row">
          <TextField
            type="date"
            size="xl"
            label={`${t.interval.endedAt} ${t.interval.date}`}
            value={draft.endedAt.date}
            disabled={draft.stillOngoing}
            error={describeError(errors.endedAt)}
            onChange={(event) => {
              setEnded('date', event.target.value);
            }}
          />
          <TextField
            type="time"
            size="xl"
            label={`${t.interval.endedAt} ${t.interval.time}`}
            value={draft.endedAt.time}
            disabled={draft.stillOngoing}
            error={errors.endedAt === null ? undefined : ' '}
            onChange={(event) => {
              setEnded('time', event.target.value);
            }}
          />
          <Button
            variant="tonal"
            size="2xl"
            disabled={draft.stillOngoing}
            onClick={() => {
              onChange({ ...draft, endedAt: toTimeFieldDraft(new Date()) });
            }}
          >
            {t.interval.now}
          </Button>

          <Checkbox
            checked={draft.stillOngoing}
            onChange={(event) => {
              /* 체크하면 끝 칸에 남은 글자는 그대로 두되 **읽지 않는다**(`readInterval`) —
                 지워 버리면 체크를 잘못 눌렀을 때 작업자가 다시 쳐야 한다. */
              onChange({ ...draft, stillOngoing: event.target.checked });
            }}
          >
            {t.interval.stillOngoing}
          </Checkbox>
        </div>

        {/*
         * 길이는 **입력 확인용**이다 — 저장되는 값은 서버가 낸다. 진행 중이면 산출 불가라고
         * 말하고 비워 두지 않는다: 빈 자리는 「0분」과 「모른다」를 같은 모양으로 만든다.
         */}
        <p className="downtime-duration">
          {minutes === null ? t.interval.durationUnknown : toDurationLabel(minutes)}
        </p>
      </section>
    </Card>
  );
};

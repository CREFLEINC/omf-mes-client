import { Button, Card, Checkbox, TextField } from '@crefle/web-ui';
import { useId } from 'react';
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
  const startedErrorId = useId();
  const endedErrorId = useId();
  const moments = readInterval(draft);
  const minutes = intervalMinutes(moments);

  /*
   * ⭐ **오류 문구를 칸 «아래»에 두지 않는다**(사용자 지적 2026-09-07).
   *
   * DS `TextField` 는 `error` 를 받으면 칸 밑에 한 줄을 «더» 그린다 — 줄 높이가 60 에서 120 으로
   * 뛰고 구간 구획이 188 → 248 로 부풀어, 글자를 치는 동안 아래 것들이 밀려 내려간다(실측).
   * 터치 화면에서는 누르려던 자리가 손가락 아래에서 움직인다.
   *
   * 그래서 **줄 오른쪽 빈자리**에 세운다 — `[지금]` 뒤가 비어 있어 높이가 늘지 않는다. 칸에는
   * `error` 로 붉은 테두리(`aria-invalid`)만 남기고, 읽어 주는 연결은 `aria-describedby` 가
   * 우리 문장을 가리켜 유지한다.
   */
  const startedError = describeStartedError(errors.startedAt);
  const endedError = describeEndedError(errors.endedAt);

  /*
   * 길이 — 도면이 「길이 47 분」으로 그린 자리다(스펙 §3).
   *
   * ⛔ **산출할 수 없는 «이유»를 문장으로 적지 않는다.** 끝 시각이 비어 있는 것은 옆의
   *    「아직 진행 중」이 이미 말하고, 오류 문구와 같은 줄에 서니 경고처럼 읽혔다(사용자 지적
   *    2026-09-07). 값 없음은 공용 표기 「—」다.
   *
   * ⛔ **0분으로 채우지 않는다** — 없는 값과 0을 같은 모양으로 만들지 않는다(`G-9`).
   *
   * ⚠ 값이 들고 나도 **자리는 늘 지킨다** — 글자가 생길 때마다 줄이 흔들리면 터치 화면에서
   *    손가락이 빗나간다.
   */
  const durationLabel = t.interval.duration(
    minutes === null ? t.interval.durationEmpty : toDurationLabel(minutes),
  );

  const setStarted = (part: 'date' | 'time', value: string): void => {
    onChange({ ...draft, startedAt: { ...draft.startedAt, [part]: value } });
  };

  const setEnded = (part: 'date' | 'time', value: string): void => {
    onChange({ ...draft, endedAt: { ...draft.endedAt, [part]: value } });
  };

  return (
    <Card bordered className="pop-section pop-fixed downtime-pane">
      <section className="downtime-section" aria-label={t.interval.title}>
        <h2 className="pane-title">{t.interval.title}</h2>

        <div className="downtime-time-row">
          {/*
           * ⭐ **라벨은 칸 «위»가 아니라 줄 «왼쪽»이다**(스펙 §3 도면 —「시작 [08-11] [14:20]
           *    [지금]」). 칸 위에 얹으면 줄마다 라벨 층 20px 이 더 붙어 두 줄이 184px 을 쓰고,
           *    ② 의 몫 160px 을 넘겨 아래 ④ 가 통째로 밀려 사라진다(실측 — 오늘 목록 높이 0).
           *
           * ⚠ 읽어 주는 이름은 그대로 「시작 날짜」·「시작 시각」이다 — 눈에 보이는 「시작」
           *    하나로는 두 칸이 같은 이름이 되어 무엇을 고치라는 것인지 말하지 못한다.
           */}
          <span className="downtime-time-label">{t.interval.startedAt}</span>
          <TextField
            type="date"
            size="xl"
            containerClassName="downtime-time-field"
            aria-label={`${t.interval.startedAt} ${t.interval.date}`}
            aria-describedby={startedError === undefined ? undefined : startedErrorId}
            value={draft.startedAt.date}
            /* 칸에는 붉은 테두리만 남긴다 — 문장은 줄 오른쪽에 한 번만 선다. */
            error={startedError === undefined ? undefined : ' '}
            onChange={(event) => {
              setStarted('date', event.target.value);
            }}
          />
          <TextField
            type="time"
            size="xl"
            containerClassName="downtime-time-field"
            aria-label={`${t.interval.startedAt} ${t.interval.time}`}
            aria-describedby={startedError === undefined ? undefined : startedErrorId}
            value={draft.startedAt.time}
            /* 짝 제약이라 두 칸에 함께 붙는다(스펙 §6-1) — 다만 문장은 한 번만 낸다. */
            error={startedError === undefined ? undefined : ' '}
            onChange={(event) => {
              setStarted('time', event.target.value);
            }}
          />
          {/*
           * ⚠ **`xl`(56) 이다 — 스펙 §7 이 적은 `2xl`(72) 이 아니다**(사용자 결정 2026-09-07).
           *    옆의 날짜·시각 칸이 56 이라 버튼만 72 면 줄 안에서 혼자 커 보이고, 줄 높이도
           *    그 버튼이 정해 ② 가 몫을 넘긴다. 터치 하한(일반 등급 56)은 지킨다.
           *    ⛔ 되돌리려면 사용자에게 묻는다 — 스펙 값과 다른 것은 알고 한 것이다.
           */}
          <Button
            variant="tonal"
            size="xl"
            onClick={() => {
              onChange({ ...draft, startedAt: toTimeFieldDraft(new Date()) });
            }}
          >
            {t.interval.now}
          </Button>

          {startedError !== undefined && (
            <p id={startedErrorId} className="downtime-field-error downtime-time-error">
              {startedError}
            </p>
          )}
        </div>

        <div className="downtime-time-row">
          <span className="downtime-time-label">{t.interval.endedAt}</span>
          <TextField
            type="date"
            size="xl"
            containerClassName="downtime-time-field"
            aria-label={`${t.interval.endedAt} ${t.interval.date}`}
            aria-describedby={endedError === undefined ? undefined : endedErrorId}
            value={draft.endedAt.date}
            disabled={draft.stillOngoing}
            error={endedError === undefined ? undefined : ' '}
            onChange={(event) => {
              setEnded('date', event.target.value);
            }}
          />
          <TextField
            type="time"
            size="xl"
            containerClassName="downtime-time-field"
            aria-label={`${t.interval.endedAt} ${t.interval.time}`}
            aria-describedby={endedError === undefined ? undefined : endedErrorId}
            value={draft.endedAt.time}
            disabled={draft.stillOngoing}
            error={endedError === undefined ? undefined : ' '}
            onChange={(event) => {
              setEnded('time', event.target.value);
            }}
          />
          <Button
            variant="tonal"
            size="xl"
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

          {endedError !== undefined && (
            <p id={endedErrorId} className="downtime-field-error downtime-time-error">
              {endedError}
            </p>
          )}

          {/*
           * 길이는 **입력 확인용**이다 — 저장되는 값은 서버가 낸다(§4-A · L-2).
           *
           * ⭐ **끝 시각 줄의 오른쪽 끝에 선다** — 제 줄을 가지면 36px 을 쓰는데, 이 화면은
           *    그만큼이 아래 「오늘 이 설비」에서 나온다(§3-1 예산 초과 · 요청서). 값이 나오는
           *    바탕이 바로 이 줄의 두 시각이라 옆에 두어도 읽히는 자리가 흐려지지 않는다.
           *
           * ⚠ 오류 문구도 같은 줄 오른쪽에 서므로 **길이가 늘 맨 끝**이다 — 둘이 함께 뜰 때
           *    자리가 바뀌면 눈이 값을 다시 찾는다.
           */}
          <p className="downtime-duration">{durationLabel}</p>
        </div>
      </section>
    </Card>
  );
};

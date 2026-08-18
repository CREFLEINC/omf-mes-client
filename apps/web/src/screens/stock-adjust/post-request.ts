import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

/**
 * 전기 요청의 본문을 만드는 **유일한 자리**.
 *
 * 이 화면의 쓰기 셋 가운데 **재고를 실제로 움직이는 것**이 이것이다 — 등록은 업무 헤더를
 * 만들 뿐이고(스펙 §5-1), 상신은 결재를 시작할 뿐이며, 수불 원장이 바뀌는 순간은 여기다.
 * 그래서 본문을 만드는 자리를 따로 두고 무엇이 실리는지가 한눈에 읽히게 한다.
 *
 * | 자리 | 값 | 근거 |
 * | --- | --- | --- |
 * | **`businessDate`** | **사용자가 확인한 영업일**(기본값은 제출 순간의 날짜) | 공유계약 **C-8** · 그 **산출 규칙이 아직 확정되지 않았다**(설계 미결) |
 * | **`occurredAt`** | **사용자가 확인한 발생 일시**(기본값은 제출 순간) | 공유계약 **C-1** — 어긋난 것을 발견한 시각과 전기를 누른 시각은 다를 수 있다 |
 * | 그 밖의 값 | **싣지 않는다** | 계약의 `PostRequest`가 두 값뿐이다. 조정의 내용은 이미 서버에 있고 이 조작은 그것을 원장에 반영할 뿐이다 |
 * | **`If-Match`·`Idempotency-Key`** | **싣지 않는다** | 헤더는 `queries.ts`가 만든다 |
 *
 * ### 왜 두 값을 **사용자에게 묻는가** (전례 `disposal-issue`와 갈리는 자리)
 *
 * 그 화면은 두 값을 **전표의 출고 일시에서 뗀다** — 「전표가 정본이다」가 근거였다. 이 화면에는
 * **그 정본이 없다**: 계약의 `InventoryAdjustment` 8필드에 날짜가 하나뿐인데 그것은
 * `adjustedAt`(전기 시점 · 서버가 정한다)이고, 등록 본문에도 날짜 자리가 없다(실측).
 *
 * 남는 길은 둘이고 하나는 지어내는 것이다.
 *
 * | 대안 | 무엇이 일어나나 |
 * | --- | --- |
 * | 실행 시각의 날짜를 **화면이 정한다** | 야간조 경계에서 조용히 틀린다 — 산출 규칙이 확정되지 않았다는 사실이 화면에서 사라지고, **틀린 영업일이 원장에 남는다** |
 * | **사용자가 확인·수정한다**(본안) | 기본값은 제출 순간이라 대부분 그대로 지나가고, 경계에 선 사람만 고친다. 화면은 **아는 것만 말한다** |
 *
 * **막지 않고 밝힌다.** 두 날짜가 갈려도 오류가 아니다(`isBusinessDateApart`) — 자정을 넘겨
 * 일한 사람에게는 그것이 정상이고, 막으면 어제 자 조정을 전기할 길이 사라진다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

type PostRequest = components['schemas']['PostRequest'];

const t = messages.stockAdjust;

/**
 * 전기 초안 — **사용자가 확인하고 고치는 두 값**이다.
 *
 * 발생 일시를 **칸이 주는 글자 그대로** 든다(`YYYY-MM-DDTHH:mm`). offset과 초는 보내는 순간에
 * 붙인다 — 초안에 미리 붙이면 사용자가 고칠 때마다 다시 붙여야 하고, 그 자리가 둘이 되면
 * 「확인한 글자」와 「나가는 값」이 갈린다.
 */
export interface PostDraft {
  /** 영업일. `<input type="date">`가 주는 `YYYY-MM-DD` 그대로다 */
  businessDate: string;
  /** 발생 일시. `<input type="datetime-local">`가 주는 `YYYY-MM-DDTHH:mm` 그대로다 */
  occurredAtLocal: string;
}

/** 아직 세우지 않은 초안. **두 칸이 비어 있는 것이 「아직 열지 않았다」의 표현**이다. */
export const EMPTY_POST_DRAFT: PostDraft = { businessDate: '', occurredAtLocal: '' };

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/** 실행 환경 시간대로 읽은 `YYYY-MM-DD`. **UTC로 읽지 않는다** — 이른 아침이 어제가 된다. */
const toLocalDate = (at: Date): string =>
  `${String(at.getFullYear())}-${pad(at.getMonth() + 1, 2)}-${pad(at.getDate(), 2)}`;

/**
 * 제출 순간으로 채운 초안 — **기본값이지 확정값이 아니다.**
 *
 * 대부분의 조정은 발견한 날 전기하므로 이 값이 그대로 지나간다. 경계에 선 사람만 고치면
 * 되고, 그 사람은 화면에 선 값을 보고 판단할 수 있다.
 */
export const seedPostDraft = (now: Date): PostDraft => ({
  businessDate: toLocalDate(now),
  occurredAtLocal: `${toLocalDate(now)}T${pad(now.getHours(), 2)}:${pad(now.getMinutes(), 2)}`,
});

/** 두 칸에 붙는 오류. **칸 이름은 본문의 키와 같다** — 서버가 그 이름으로 오류를 내려준다. */
export interface PostDraftErrors {
  businessDate?: string;
  occurredAt?: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;

/**
 * 친 값을 잰다 — **둘째 층이다.**
 *
 * 첫째 층은 네이티브 `type="date"`·`type="datetime-local"`인데 그것만 믿을 수 없다: 지원이
 * 브라우저마다 다르고, 붙여넣기로 들어온 글자가 그대로 남는 길이 있다. 되돌릴 수 없는 쓰기의
 * 본문이라 **형식을 여기서 한 번 더 잰다.**
 *
 * **달력에 있는 날인지는 재지 않는다.** 네이티브 칸이 그것을 이미 막고, 화면이 다시 세면
 * 윤년·월말 판정을 화면이 지어내게 된다 — 서버가 정본이다.
 */
export const validatePostDraft = (draft: PostDraft): PostDraftErrors => {
  const errors: PostDraftErrors = {};

  if (draft.businessDate === '') {
    errors.businessDate = t.errors.businessDateRequired;
  } else if (!DATE_PATTERN.test(draft.businessDate)) {
    errors.businessDate = t.errors.businessDateFormat;
  }

  if (draft.occurredAtLocal === '') {
    errors.occurredAt = t.errors.occurredAtRequired;
  } else if (!LOCAL_DATE_TIME_PATTERN.test(draft.occurredAtLocal)) {
    errors.occurredAt = t.errors.occurredAtFormat;
  }

  return errors;
};

/**
 * 영업일과 발생 일시의 날짜가 **갈렸는가**.
 *
 * **오류가 아니다**(공유계약 C-8의 야간조 경계) — 확인 창이 그 사실을 적어 사용자가 실수로
 * 남긴 값인지 뜻한 값인지 가릴 수 있게 한다. 갖춰지지 않은 초안은 「갈렸다」로 말하지 않는다:
 * 빈 칸은 다른 날이 아니다.
 */
export const isBusinessDateApart = (draft: PostDraft): boolean => {
  if (Object.keys(validatePostDraft(draft)).length > 0) return false;

  return draft.businessDate !== draft.occurredAtLocal.slice(0, 10);
};

/**
 * 실행 환경이 UTC와 얼마나 떨어져 있는지. `+09:00` 꼴이다.
 *
 * **제출 순간의 값을 쓴다.** 발생 일시를 파싱해 그 시점의 값을 쓰면 서머타임 경계에서 더
 * 정확해지지만 파싱이 실패할 수 있는 가지가 생긴다 — 이 제품이 도는 지역에 서머타임이 없어
 * 두 값이 갈리지 않으므로 가지를 만들지 않는 쪽을 택했다(전례 `disposal-issue`와 같은 판단).
 */
const offsetText = (at: Date): string => {
  const minutes = -at.getTimezoneOffset();
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);

  return `${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;
};

/**
 * 칸이 준 글자에 초와 offset을 붙인다.
 *
 * 칸은 분까지만 주는데(`HH:mm`) 계약은 offset이 있는 형식을 요구한다 — offset이 없는 문자열을
 * 그대로 보내면 **같은 글자가 지역마다 다른 순간**을 가리킨다.
 */
const toOffsetDateTime = (local: string, at: Date): string => {
  const withSeconds = local.length === 16 ? `${local}:00` : local;

  return `${withSeconds}${offsetText(at)}`;
};

/**
 * 전기 본문을 만든다. **갖춰지지 않았으면 만들지 않는다**(`null`).
 *
 * **여기가 마지막 겹이다.** 버튼 잠금과 보내는 자리의 재판정이 이미 닫아 둔 길이지만, 그 둘이
 * 뚫려도 형식이 아닌 글자가 되돌릴 수 없는 전기 본문에 실리지 않아야 한다 — 등록 조립
 * (`adjust-request.ts`)·상신 조립(`reason-draft.ts`)과 같은 규율이다.
 */
export const toPostRequest = (draft: PostDraft, now: Date): PostRequest | null => {
  if (Object.keys(validatePostDraft(draft)).length > 0) return null;

  return {
    businessDate: draft.businessDate,
    occurredAt: toOffsetDateTime(draft.occurredAtLocal, now),
  };
};

/**
 * 서버가 준 필드 오류를 **인라인으로 그릴 자리가 있는 칸** — 전기 몫.
 *
 * ⚠ **본문의 키 집합이 아니다.** 공통 훅(`patterns/master`)의 `splitError`는 이 목록에 든 이름을
 * **배너에서 빼고** `fieldErrors`로 돌린다 — 목록에 넣어 놓고 그리는 자리가 없으면 그 오류는
 * **인라인에도 배너에도 서지 않고 통째로 사라진다.** 기준은 훅의 계약 그대로 **「그릴 자리가
 * 있는가」**다.
 *
 * | 본문의 키 | 그리는 자리 | 이 목록 |
 * | --- | --- | :-: |
 * | `businessDate` | 전기 구획의 영업일 칸(`TextField.error`) | ✅ |
 * | `occurredAt` | 전기 구획의 발생 일시 칸(`TextField.error`) | ✅ |
 *
 * 두 칸 모두 화면에 있으므로 둘 다 든다. **그릴 자리를 없애면 이 목록에서 뺀다.**
 */
export const POST_FORM_FIELDS: readonly string[] = ['businessDate', 'occurredAt'];

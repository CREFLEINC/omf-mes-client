import { resolveBomComponentId } from './bom-origin';
import type {
  MaterialIssueLineDraft,
  MaterialIssueRequestCreate,
  MaterialIssueRequestCreateLine,
  ShortageLineView,
} from './types';
import { readQty } from './validation';

/**
 * 발행 요청의 본문을 만드는 **유일한 자리** — 이 화면에서 되돌릴 수 없는 쓰기의 내용이 여기서
 * 정해진다.
 *
 * | 자리 | 값 | 근거 |
 * | --- | --- | --- |
 * | `workOrderId` | 고른 W/O | 계약 필수 · NOT NULL |
 * | `destinationLocationId` | 고른 도착 위치 | 계약 필수 · **FK**(스펙 §5-4) |
 * | `requiredAt` | 날짜+시각을 이은 offset 포함 값. **날짜가 비면 키 자체를 싣지 않는다** | nullable(§4-A) |
 * | `reasonCode` | 고른 사유. **비면 키를 싣지 않는다**(`null` 도 아니다) | §5-1 · 계약 nullable |
 * | `remarks` | 비고 `trim()`. **비면 키를 싣지 않는다** | §4-A |
 * | `lines` | **요청 수량 > 0 인 줄만.** 0·빈칸·못 읽는 값은 뺀다 | §6 |
 * | `lines[].bomComponentId` | `resolveBomComponentId` — 없으면 **키를 싣지 않는다** | §5-3 nullable |
 * | `lines[].itemId`·`uomId` | 양의 정수로 읽힌 값만. 못 읽으면 **그 줄을 뺀다** | 계약 필수 |
 * | `lines[].requestedQty` | `readQty` 가 `qty` 로 읽고 `> 0` 인 값 | 계약 `CHECK > 0` |
 * | `businessDate` | **제출 순간의 로컬 날짜** | 공유계약 C-8 |
 * | `occurredAt` | **제출 순간**, 초·offset 포함 | 공유계약 C-8 |
 * | `lineNo` | **싣지 않는다** | 서버가 부여한다(계약 설명 실측) |
 * | `issuedQty` | **싣지 않는다** | `readOnly` — 피킹이 채운다 |
 * | 원인 W/O | **자리를 만들지 않는다** — 발생 원인은 사유 코드가 대신한다 | §5-2 |
 * | 출고 전표의 다형 도착지 | **싣지 않는다** | 서버가 채운다(§5-4) |
 *
 * ⚠ `businessDate` 는 **`requiredAt` 의 날짜가 아니다.** 필요 시각은 미래이고 영업일은 「이
 * 요청을 발행한 날」이다. 하루 어긋난 영업일은 화면 어디에도 보이지 않고 마감·집계에서만 드러난다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const POSITIVE_INTEGER = /^\d+$/;

/** 고르지 않은 값과 못 알아들은 값을 함께 `null`로 본다. */
const readId = (raw: string): number | null => {
  const text = raw.trim();

  return POSITIVE_INTEGER.test(text) && Number(text) >= 1 ? Number(text) : null;
};

const pad = (value: number, length: number): string => String(value).padStart(length, '0');

/**
 * 실행 환경이 UTC와 얼마나 떨어져 있는지. `+09:00` 꼴이다.
 *
 * offset 이 없는 문자열을 보내면 **같은 글자가 지역마다 다른 순간을 가리킨다.**
 */
const offsetText = (at: Date): string => {
  const minutes = -at.getTimezoneOffset();
  const sign = minutes < 0 ? '-' : '+';
  const absolute = Math.abs(minutes);

  return `${sign}${pad(Math.floor(absolute / 60), 2)}:${pad(absolute % 60, 2)}`;
};

/** 영업일 — **제출 순간의 로컬 날짜**다(공유계약 C-8). */
export const toBusinessDate = (now: Date): string =>
  `${String(now.getFullYear())}-${pad(now.getMonth() + 1, 2)}-${pad(now.getDate(), 2)}`;

/** 발생 시각 — **제출 순간**을 초와 offset까지 갖춰 싣는다(공유계약 C-8). */
export const toOccurredAt = (now: Date): string =>
  `${toBusinessDate(now)}T${pad(now.getHours(), 2)}:${pad(now.getMinutes(), 2)}:${pad(
    now.getSeconds(),
    2,
  )}${offsetText(now)}`;

/**
 * 필요 시각 — 날짜 칸과 시각 칸을 한 값으로 잇는다. **한쪽이라도 비면 `null`이다.**
 *
 * ⛔ **시각을 지어내지 않는다.** 날짜만 적힌 상태에서 `00:00` 을 채우면 사용자가 정하지 않은
 * 기한이 전표에 실린다. 반쪽 입력은 `validateHeader` 가 이미 발행을 막는다.
 *
 * `now` 는 offset 을 읽는 데만 쓴다 — 이 제품이 도는 지역에 서머타임이 없어 제출 순간의
 * offset 과 필요 시각의 offset 이 갈리지 않는다.
 */
export const toRequiredAt = (date: string, time: string, now: Date): string | null => {
  const day = date.trim();
  const clock = time.trim();

  if (day === '' || clock === '') return null;

  const withSeconds = clock.length === 5 ? `${clock}:00` : clock;

  return `${day}T${withSeconds}${offsetText(now)}`;
};

/**
 * 한 줄을 계약의 생성 항목으로 옮긴다. **요청 수량이 0 이하면 만들지 않는다**(`null`) —
 * 그 줄은 이번 요청에서 빠진다(스펙 §6).
 */
const toLine = (
  line: MaterialIssueLineDraft,
  shortage: readonly ShortageLineView[],
): MaterialIssueRequestCreateLine | null => {
  const requested = readQty(line.requestedQty);

  if (requested.kind !== 'qty' || requested.value <= 0) return null;

  const itemId = readId(line.itemId);
  const uomId = readId(line.uomId);

  if (itemId === null || uomId === null) return null;

  /* 화면의 경고와 **같은 함수**를 지난다 — 갈라 두면 경고 없이 FK 만 비어 나간다. */
  const bomComponentId = line.bomComponentId ?? resolveBomComponentId(itemId, shortage);

  return {
    ...(bomComponentId === null ? {} : { bomComponentId }),
    itemId,
    requestedQty: requested.value,
    uomId,
  };
};

export interface MaterialIssueRequestInput {
  workOrderId: string;
  destinationLocationId: string;
  requiredDate: string;
  requiredTime: string;
  reasonCode: string;
  remarks: string;
  lines: readonly MaterialIssueLineDraft[];
  /** BOM 유래 판정의 근거. 아직 부르지 않았으면 빈 배열이다 */
  shortage: readonly ShortageLineView[];
}

/**
 * 본문을 만든다. **채워지지 않은 자리가 하나라도 있으면 만들지 않는다**(`null`) — 버튼 잠금이
 * 이미 닫아 둔 길이지만 마지막 겹으로 한 번 더 막는다.
 *
 * ⭐ **`now` 를 인자로 받는다.** 여기서 `new Date()` 를 뜨면 본문이 매번 달라져 공통 쓰기 훅의
 * 지문이 재시도마다 새 `Idempotency-Key` 를 만든다 — 서버는 중복 요청을 막지 않으므로
 * (스펙 §6) 통신이 끊긴 뒤 다시 누르면 **같은 자재 요청 전표가 둘 쌓인다.** 이 화면에는 취소
 * 경로가 없다. 재시도 때 같은 순간을 넘기는 것은 `stampSubmission` 이 맡는다.
 */
export const toMaterialIssueRequestBody = (
  input: MaterialIssueRequestInput,
  now: Date,
): MaterialIssueRequestCreate | null => {
  const workOrderId = readId(input.workOrderId);
  const destinationLocationId = readId(input.destinationLocationId);

  if (workOrderId === null || destinationLocationId === null) return null;

  const lines: MaterialIssueRequestCreateLine[] = [];

  for (const line of input.lines) {
    const created = toLine(line, input.shortage);

    if (created !== null) lines.push(created);
  }

  if (lines.length === 0) return null;

  const requiredAt = toRequiredAt(input.requiredDate, input.requiredTime, now);
  const reasonCode = input.reasonCode.trim();
  const remarks = input.remarks.trim();

  return {
    workOrderId,
    destinationLocationId,
    ...(requiredAt === null ? {} : { requiredAt }),
    ...(reasonCode === '' ? {} : { reasonCode }),
    ...(remarks === '' ? {} : { remarks }),
    lines,
    businessDate: toBusinessDate(now),
    occurredAt: toOccurredAt(now),
  };
};

/** 보낸 값의 지문과 그때 찍은 순간. 재시도가 같은 순간을 쓰게 하는 데만 쓴다. */
export interface SubmissionStamp {
  fingerprint: string;
  at: Date;
}

/**
 * 지문은 **나갈 값만 본다.**
 *
 * ⛔ 초안을 통째로 직렬화하면 **본문에 실리지 않는 값까지 지문에 섞인다** — 특히 줄 키가 그렇다.
 * 줄 키는 초안이 다시 세워질 때마다 새로 발급되므로, 조회가 한 번 다시 돌아 같은 값으로 줄이
 * 새로 서기만 해도 지문이 갈리고 **새 멱등 키**가 나간다. 통신이 끊겼다 돌아온 직후가 정확히
 * 그 상황이라, 방어선이 가장 필요한 자리에서 풀린다.
 *
 * 그래서 **본문에 실리는 열 자리만** 고른다. 줄의 `bomComponentId` 는 본문과 **같은 함수**로
 * 푼 값을 쓴다 — 소요 목록이 바뀌어 FK 가 달라지면 그것은 다른 쓰기가 맞다.
 *
 * ⚠ 표시 전용 값(줄 키·`origin`·소요/기출고/부족)은 일부러 뺐다. 그 값이 달라져도 서버로 나가는
 * 것은 하나도 달라지지 않는다.
 */
const fingerprintOf = (input: MaterialIssueRequestInput): string =>
  JSON.stringify({
    workOrderId: input.workOrderId,
    destinationLocationId: input.destinationLocationId,
    requiredDate: input.requiredDate,
    requiredTime: input.requiredTime,
    reasonCode: input.reasonCode,
    remarks: input.remarks,
    lines: input.lines.map((line) => ({
      bomComponentId:
        line.bomComponentId ?? resolveBomComponentId(Number(line.itemId), input.shortage),
      itemId: line.itemId,
      uomId: line.uomId,
      requestedQty: line.requestedQty,
    })),
  });

/**
 * 제출 순간을 **초안에 매어 둔다.**
 *
 * 보낼 값이 그대로면 앞서 찍은 순간을 그대로 돌려주고(같은 본문 → 같은 멱등 키), 값이
 * 달라지면 새로 찍는다(다른 쓰기 → 새 키). 공통 쓰기 훅이 본문으로 지문을 만들기 때문에
 * **본문의 시각 두 칸이 흔들리면 그 지문이 무의미해진다** — 그 흔들림을 여기서 잡는다.
 */
export const stampSubmission = (
  previous: SubmissionStamp | null,
  input: MaterialIssueRequestInput,
  now: Date,
): SubmissionStamp => {
  const fingerprint = fingerprintOf(input);

  return previous !== null && previous.fingerprint === fingerprint
    ? previous
    : { fingerprint, at: now };
};

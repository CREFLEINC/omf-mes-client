import { toContentUpserts } from './contents';
import type { HandlingUnitCreate, HandlingUnitPack, PackingDraft, PackingLine } from './types';

/**
 * 서버로 나가는 본문 둘을 짓는다.
 *
 * ⭐ **호출은 둘이다**(스펙 §5-6 · 요구서 §3-17 · 2026-09-06 게이트 승인) — 담기 시작이 포장
 * 단위를 만들고(`POST /inventory/handling-units`), 확정이 내용물과 함께 닫는다(`:pack`).
 * 둘은 한 트랜잭션이 아니므로 그 사이의 상태(포장 단위는 있고 내용물은 아직 없는 상태)가
 * 정상이며, 담다가 그만두면 그 포장 단위를 취소가 거둔다(§5-7).
 *
 * ⚠ **한 건으로 합쳤던 판을 되돌린 것이다**(사용자 결정 2026-09-09). 합친 판은 끊긴 채로도
 * 포장을 시작할 수 있었지만, 확정 본문에 시각을 실을 자리가 없어 **자정을 넘긴 큐 항목이 두
 * 건으로 적재될 수 있었다**(C-8). 그 구멍을 닫는 대신 오프라인에서 새 포장을 시작하지 못한다.
 */

/**
 * 담기 시작 — 포장 단위를 만든다.
 *
 * ⛔ **내용물을 싣지 않는다.** 계약의 `contents`(「초기 구성」)는 여전히 있지만, 그것을 쓰면
 * 확정이 사라져 위의 두 층이 다시 한 층이 된다.
 *
 * ⛔ **위치·창고를 싣지 않는다.** 이 화면에 그 입력칸이 없다 — 계약이 둘 다 선택으로 두었고,
 * 값을 지어내면 사용자가 정하지 않은 것이 기록에 남는다. 창고·위치는 「완료 후 이동 시
 * 채워짐」이 스펙 §4-A 의 서술이다.
 */
export const toCreateBody = (
  draft: Pick<PackingDraft, 'handlingUnitTypeCode' | 'parentHandlingUnitId'>,
): HandlingUnitCreate | null => {
  if (draft.handlingUnitTypeCode === null) return null;

  return {
    handlingUnitTypeCode: draft.handlingUnitTypeCode,
    parentHandlingUnitId: draft.parentHandlingUnitId,
  };
};

/**
 * 단말이 정하는 업무 기준일 — 서버가 수신 시각으로 다시 잡지 않는다(공유계약 C-8).
 *
 * ⚠ **야간조 경계 규칙은 아직 정해지지 않았다**(C-8-1 말미). 지금은 단말의 달력 날짜를 쓰며,
 * 규칙이 서면 **이 함수 하나가** 바뀐다 — 값을 부르는 자리에 흩어 적지 않는다.
 */
export const businessDateOf = (now: Date): string => {
  const pad = (value: number): string => String(value).padStart(2, '0');

  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/**
 * 확정 — 담은 것을 통째로 실어 포장을 닫는다.
 *
 * ⭐ **시각 두 칸을 «담을 때» 박는다.** 큐에 밀렸다가 나중에 전송돼도 「언제 일어난 일인가」가
 * 보존되어야 한다(C-1 #3 · C-8). 보내는 시점의 값을 쓰면 자정을 넘긴 항목의 영업일이 바뀌어
 * 원장이 두 건으로 적재된다.
 *
 * ⛔ **위치·비고를 싣지 않는다** — 이 화면에 칸이 없다(위 `toCreateBody` 와 같은 이유).
 */
export const toPackBody = (lines: readonly PackingLine[], now: Date): HandlingUnitPack | null => {
  if (lines.length === 0) return null;

  return {
    contents: toContentUpserts(lines),
    businessDate: businessDateOf(now),
    occurredAt: now.toISOString(),
  };
};

/**
 * 두 확정이 **같은 것을 담고 있는가.**
 *
 * ⭐ 적용 여부를 모르는 온라인 시도를 큐가 이어받아도 되는지 가르는 자리다. 담은 것이
 * 달라졌으면 그 키는 **다른 쓰기의 키**이므로 이어받으면 안 된다 — 서버가 앞 쓰기의 중복으로
 * 보고 흡수해, 나중에 담은 줄이 조용히 사라진다(공유계약 C-1 #6).
 *
 * ⛔ **시각 두 칸은 «비교에서 뺀다».** 확정을 다시 누르면 그 값은 반드시 달라지므로, 함께
 * 비교하면 **이어받기가 영영 성립하지 않는다** — 담은 것이 그대로인데도 큐가 새 키로 보내
 * 되돌릴 수 없는 확정이 두 번 설 수 있다(실측 2026-09-09).
 *
 * ⭐ **그래서 이어받을 때는 「그때 보낸 본문」을 통째로 보낸다.** 같은 키에 그때의 영업일이
 * 함께 나가야 원장이 한 건으로 흡수한다(C-8) — 비교에서 뺀 것을 전송에서까지 빼지 않는다.
 */
export const samePackBody = (left: HandlingUnitPack, right: HandlingUnitPack): boolean =>
  JSON.stringify(left.contents) === JSON.stringify(right.contents);

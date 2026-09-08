import { toContentUpserts } from './contents';
import type { HandlingUnitCreate, PackingDraft, PackingLine } from './types';

/**
 * 확정 요청 본문을 짓는다.
 *
 * ⭐ **쓰기는 한 건이다** — 확정할 때 `POST /inventory/handling-units` 에 담은 것을 통째로
 * 실어 보내고 `:pack` 을 부르지 않는다(사용자 결정 2026-09-08).
 *
 * 담는 동안 서버를 부르지 않으므로 **끊긴 채로도 포장을 시작해 확정까지 마칠 수 있다** — 앞선
 * 판은 첫 줄을 담을 때 등록을 불러 번호를 받았고, 그래서 오프라인에서는 포장을 시작조차 하지
 * 못했다(스펙 §6 의 큐잉이 반쪽만 섰다).
 *
 * ⚠ **잃은 것을 적어 둔다** — 스펙 §3 은 담는 동안 포장 번호를 보이라 하는데, 번호는 확정
 * 뒤에야 생긴다. 그 자리는 화면이 「확정하면 매겨진다」로 채운다.
 *
 * ⛔ **발생 시각을 실을 자리가 없다.** 계약의 `HandlingUnitCreate` 에 `businessDate`·
 * `occurredAt` 이 없고 헤더에도 그런 축이 없다 — 큐에 담긴 확정은 **서버가 받은 때**로
 * 기록된다(공유계약 C-8 이 요구하는 「단말에서 일어난 시각」을 지킬 수 없다). 계약이 그 자리를
 * 열어 주어야 풀린다.
 *
 * ⛔ **위치·창고를 싣지 않는다.** 이 화면에 그 입력칸이 없다 — 계약이 둘 다 선택으로 두었고,
 * 값을 지어내면 사용자가 정하지 않은 것이 기록에 남는다. 창고·위치는 「완료 후 이동 시
 * 채워짐」이 스펙 §4-A 의 서술이다.
 */
export const toCreateBody = (
  draft: Pick<PackingDraft, 'handlingUnitTypeCode' | 'parentHandlingUnitId'>,
  lines: readonly PackingLine[],
): HandlingUnitCreate | null => {
  if (draft.handlingUnitTypeCode === null) return null;

  return {
    handlingUnitTypeCode: draft.handlingUnitTypeCode,
    parentHandlingUnitId: draft.parentHandlingUnitId,
    contents: toContentUpserts(lines),
  };
};

/**
 * 두 확정이 **같은 것을 담고 있는가.**
 *
 * ⭐ 적용 여부를 모르는 온라인 시도를 큐가 이어받아도 되는지 가르는 자리다. 담은 것이
 * 달라졌으면 그 키는 **다른 쓰기의 키**이므로 이어받으면 안 된다 — 서버가 앞 쓰기의 중복으로
 * 보고 흡수해, 나중에 담은 줄이 조용히 사라진다(공유계약 C-1 #6).
 */
export const sameCreateBody = (left: HandlingUnitCreate, right: HandlingUnitCreate): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

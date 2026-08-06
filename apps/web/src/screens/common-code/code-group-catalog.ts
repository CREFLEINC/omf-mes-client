/**
 * 이 화면이 기대하는 코드그룹 목록 — **「어떤 그룹이 있어야 하는가」의 기대 목록**이다.
 * 목록 자체는 서버가 준다(`GET /mdm/code-groups`).
 *
 * 코드 체계 정의가 표준화 작업 중이라(omf-mes#64) 확정된 기대 목록이 없다.
 * **값을 지어내지 않는다** — 배열을 비워 두고, 확정되면 이 한 곳만 채운다.
 * 지어낸 값을 두면 그것이 확정 목록으로 오해된다.
 *
 * 배열이 비어 있는 동안 화면은 코드그룹 목록 위에 「임시 목록」 안내를 낸다.
 */
export const EXPECTED_CODE_GROUPS: readonly string[] = [];

/** 「임시 목록」 안내를 낼지. 기대 목록이 채워지면 안내가 사라진다. */
export const isProvisionalCatalog = (): boolean => EXPECTED_CODE_GROUPS.length === 0;

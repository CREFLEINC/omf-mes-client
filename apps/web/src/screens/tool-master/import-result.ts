import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

export type BatchResult = components['schemas']['BatchResult'];
export type BatchFailure = components['schemas']['BatchFailure'];

const t = messages.toolMaster.import;

/**
 * 실패한 행 하나를 화면이 그릴 모양으로.
 *
 * ⭐ **계약의 `index` 를 사람이 세는 방식으로 옮긴다** — 계약은 「엑셀 자료 행의 순번(머리글
 * 제외 0부터)」이고 사용자가 세는 것은 1부터다. 옮기지 않으면 첫 줄이 「0번째 줄」이 된다.
 *
 * ⛔ **엑셀 행 번호로 옮기지 않는다.** 머리글이 몇 줄인지 화면이 알 수 없어, `index + 2` 를
 * 「7행」이라 적으면 머리글이 두 줄인 파일에서 **거짓말**이 된다. 아는 것은 「몇 번째 자료
 * 줄인가」뿐이고, 그 사실만 말한다.
 */
export const dataRowNumber = (index: number): number => index + 1;

/**
 * 실패 사유 여럿을 한 줄로. **잇기 전에 쓸 수 있는 것만 남긴다** —
 * 빈 문구를 이어 붙이면 이음쇠만 남은 칸이 생긴다(client#192 와 같은 갈래).
 */
export const failureReason = (failure: BatchFailure): string =>
  failure.errors
    .map((item) => item.message)
    .filter((message) => message.trim() !== '')
    .join(' ');

/** 식별값. 서버가 못 주면 지어내지 않고 그 사실을 말한다(G-9). */
export const failureKey = (failure: BatchFailure): string => {
  const key = failure.key;

  return key === undefined || key.trim() === '' ? t.keyUnknown : key;
};

/**
 * 결과 한 줄 요약.
 *
 * ⭐ **성공과 실패를 «둘 다» 말한다.** 성공 건수만 말하면 실패한 행이 없는 것처럼 읽히고,
 * 실패만 말하면 이미 들어간 행을 모르고 파일을 통째로 다시 올린다 —
 * **통째로 되돌리지 않는 경로**라 그 오해가 곧 중복 등록이다.
 */
export const resultSummary = (result: BatchResult): string[] => {
  const lines = [result.succeeded === 0 ? t.noneSucceeded : t.succeeded(result.succeeded)];

  lines.push(result.failed.length === 0 ? t.allSucceeded : t.failed(result.failed.length));

  return lines;
};

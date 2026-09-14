import type { components } from '@omf-mes/api-client';
import { describe, expect, it } from 'vitest';

/**
 * **고정한 계약이 등록 본문에 `password` 를 «아직» 받지 않는다**는 사실의 감지기.
 *
 * 서버는 2026-09-12부터 `POST /app/users` 의 선택 파라미터 `password` 를 받는데, 고정한 전달본의
 * `AppUserCreate` 에는 그 키가 없다. 그래서 `user-mappers.ts` 의 `toAppUserCreate` 가 반환형을
 * `AppUserCreate & { password: string }` 으로 **넓혀** 계약을 넘어선다 — 이 슬라이스의 유일한
 * 우회 자리다(사유 전문은 그 함수 머리말).
 *
 * ⭐ **이 파일이 하는 일은 그 우회의 유효기간을 재는 것뿐이다.** 우회가 옳은지는 재지 않는다.
 * 전달본이 `password` 를 담아 오는 순간 아래 대입이 **타입 오류**가 되어 `pnpm typecheck` 가
 * 빨개진다 — `apps/web/tsconfig.json` 의 `include: ["src"]` 가 시험 파일도 검사 대상으로 잡는다.
 *
 * ## 빨개졌다면 할 일
 *
 * 1. `user-mappers.ts` 의 `toAppUserCreate` 반환형에서 `& { password: string }` 을 지운다
 * 2. 같은 함수의 우회 머리말(「⛔ `password` 는 고정한 계약에 없는 키다」 절)을 함께 지운다
 * 3. 이 파일을 지운다 — 재는 대상이 사라졌으므로 남겨 두면 「왜 있는지 모르는 시험」이 된다
 *
 * ⛔ **빨개졌을 때 이 파일의 기대값을 `true` 로 바꾸는 것으로 끝내지 마라.** 그러면 감지기는
 * 초록으로 돌아오지만 걷어내야 할 우회는 그대로 남고, 다음 사람은 그 우회를 계약이 인정한
 * 것으로 읽는다.
 */
type ContractHasPassword = 'password' extends keyof components['schemas']['AppUserCreate']
  ? true
  : false;

/* 계약이 `password` 를 받게 되면 이 대입이 타입 오류가 된다 → 위 「빨개졌다면 할 일」로 간다. */
const contractStillLacksPassword: ContractHasPassword = false;

describe('AppUserCreate 계약과 password', () => {
  it('계약에 password 가 아직 없다 — 없어진 우회가 남아 있지 않은지 타입 검사가 잰다', () => {
    /*
     * ⚠ **이 단언은 아무것도 증명하지 않는다.** 바로 위에서 `false` 라고 적은 값을 되읽는 것뿐이라
     * 런타임에는 언제나 통과한다. **진짜 감지기는 타입 쪽**(`ContractHasPassword` 의 대입)이고,
     * 이 줄은 미사용 변수 린트를 피하려고 쓰임을 만든 것이다 — 지우면 위 변수가 죽은 코드로
     * 보고되고, 린트를 잠재우려 변수째 지워지면 감지기 자체가 사라진다.
     *
     * ⛔ 그러므로 이 시험이 **초록인 것을 「계약을 확인했다」로 읽지 마라.** 이 파일의 통과·실패는
     * `pnpm test` 가 아니라 `pnpm typecheck` 가 말한다.
     */
    expect(contractStillLacksPassword).toBe(false);
  });
});

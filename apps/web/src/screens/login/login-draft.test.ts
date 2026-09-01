import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  canSubmit,
  emptyLoginDraft,
  submitDisabledReason,
  LOGIN_ID_MAX_LENGTH,
  type LoginDraft,
} from './login-draft';

const t = messages.login;

/** 합성값이다. 그럴듯한 자격이 되지 않게 대역을 드러내는 글자만 쓴다(공개 저장소 경계). */
const SYNTHETIC_LOGIN_ID = 'SYN-LOGIN-01';
const SYNTHETIC_PASSWORD = 'SYN-PW-VALUE-01';

const draft = (overrides: Partial<LoginDraft> = {}): LoginDraft => ({
  ...emptyLoginDraft,
  ...overrides,
});

describe('emptyLoginDraft', () => {
  it('두 칸이 모두 빈 글자로 선다', () => {
    expect(emptyLoginDraft).toEqual({ loginId: '', password: '' });
  });
});

describe('LOGIN_ID_MAX_LENGTH', () => {
  /**
   * 계약이 정한 상한이며 **생성 타입에서는 잴 수 없다** — `openapi-typescript`가 `maxLength`를
   * 내보내지 않는다(전례 `users-roles/user-validation.ts`가 같은 자리에 같은 경고를 남겼다).
   * 그래서 값을 여기서 고정한다.
   */
  it('계약이 정한 아이디 상한 100을 그대로 든다', () => {
    expect(LOGIN_ID_MAX_LENGTH).toBe(100);
  });
});

describe('canSubmit', () => {
  it('두 칸을 다 채우면 보낼 수 있다', () => {
    expect(canSubmit(draft({ loginId: SYNTHETIC_LOGIN_ID, password: SYNTHETIC_PASSWORD }))).toBe(
      true,
    );
  });

  it('아이디만 채우면 보낼 수 없다', () => {
    expect(canSubmit(draft({ loginId: SYNTHETIC_LOGIN_ID }))).toBe(false);
  });

  it('비밀번호만 채우면 보낼 수 없다', () => {
    expect(canSubmit(draft({ password: SYNTHETIC_PASSWORD }))).toBe(false);
  });

  it('아이디에 공백만 있으면 빈 값으로 본다', () => {
    expect(canSubmit(draft({ loginId: '   ', password: SYNTHETIC_PASSWORD }))).toBe(false);
    expect(canSubmit(draft({ loginId: '   ', password: '   ' }))).toBe(false);
  });

  /**
   * client#197 — 가려진 칸(`type="password"`)에서 공백은 점으로 **보인다.** 아이디 칸과 같은
   * 잣대(`trim()`)를 쓰면 값을 바르게 친 사용자가 채워진 칸을 보면서도 잠긴 버튼을 만난다.
   */
  it('비밀번호는 가려진 칸이라 공백도 값으로 본다', () => {
    expect(canSubmit(draft({ loginId: SYNTHETIC_LOGIN_ID, password: '   ' }))).toBe(true);
  });

  it('앞뒤 공백을 걷어낸 값이 남으면 보낼 수 있다', () => {
    expect(
      canSubmit(
        draft({ loginId: `  ${SYNTHETIC_LOGIN_ID}  `, password: `  ${SYNTHETIC_PASSWORD}` }),
      ),
    ).toBe(true);
  });

  /**
   * **길이를 재지 않는다.** 계약이 `LoginRequest.password`에 최소 길이를 두지 않았다 —
   * 여기서 하한을 만들면 그보다 짧게 발급된 기존 계정이 **로그인 자체를 못 한다.**
   * 최소 8자는 비밀번호를 바꾸는 화면의 규칙이고 이 화면의 규칙이 아니다.
   */
  it('비밀번호 길이를 재지 않는다', () => {
    expect(canSubmit(draft({ loginId: SYNTHETIC_LOGIN_ID, password: 'a' }))).toBe(true);
  });

  /**
   * **아이디 길이도 재지 않는다.** 상한은 칸의 `maxLength`가 막고, 넘긴 값을 판정하는 것은
   * 서버 몫이다 — 화면이 여기서 또 재면 「칸에 들어가지도 않는 값」에 대한 죽은 갈래가 생긴다.
   */
  it('아이디 상한을 넘겨도 이 판정은 막지 않는다', () => {
    expect(
      canSubmit(
        draft({ loginId: 'A'.repeat(LOGIN_ID_MAX_LENGTH + 1), password: SYNTHETIC_PASSWORD }),
      ),
    ).toBe(true);
  });
});

describe('submitDisabledReason', () => {
  it('두 칸을 다 채우면 사유가 없다', () => {
    expect(
      submitDisabledReason(draft({ loginId: SYNTHETIC_LOGIN_ID, password: SYNTHETIC_PASSWORD })),
    ).toBeUndefined();
  });

  /**
   * **세 갈래가 같은 사유를 낸다.** 어느 칸이 비었는지 가르면 아직 아무것도 보내지 않은
   * 시점부터 화면이 칸을 지목하기 시작하고, 그 습관이 그대로 실패 문구(어느 칸이 틀렸는지
   * 말하지 않는다)로 새어 나간다.
   */
  it('아이디만·비밀번호만·둘 다 공백만 — 셋이 같은 사유를 낸다', () => {
    const reasons = [
      submitDisabledReason(draft({ loginId: SYNTHETIC_LOGIN_ID })),
      submitDisabledReason(draft({ password: SYNTHETIC_PASSWORD })),
      submitDisabledReason(draft({ loginId: '   ', password: '   ' })),
    ];

    expect(reasons).toEqual([
      t.actionReasons.incomplete,
      t.actionReasons.incomplete,
      t.actionReasons.incomplete,
    ]);
  });

  /**
   * 사유는 **어떻게 풀 것인가**를 담는다(배치 규범 4 · 공유계약 G-3).
   * 두 칸을 함께 말하는 것이 곧 「어느 칸이 비었는지 가르지 않는다」이기도 하다.
   */
  it('사유가 두 칸을 함께 말하고 풀리는 조건을 담는다', () => {
    const reason = t.actionReasons.incomplete;

    expect(reason).toContain(t.fields.loginId);
    expect(reason).toContain(t.fields.password);
    expect(reason).toContain('입력하면');
  });

  /**
   * **잠금과 사유가 갈리지 않는다.** 버튼은 사유의 유무로 잠기므로(화면), 이 둘이 어긋나면
   * 「사유 없이 잠긴 버튼」이나 「열려 있는데 사유가 붙은 버튼」이 생긴다.
   */
  it('사유가 없는 것과 보낼 수 있는 것이 언제나 같다', () => {
    const cases: LoginDraft[] = [
      emptyLoginDraft,
      draft({ loginId: SYNTHETIC_LOGIN_ID }),
      draft({ password: SYNTHETIC_PASSWORD }),
      draft({ loginId: '   ', password: '   ' }),
      draft({ loginId: SYNTHETIC_LOGIN_ID, password: SYNTHETIC_PASSWORD }),
      draft({ loginId: ` ${SYNTHETIC_LOGIN_ID} `, password: ` ${SYNTHETIC_PASSWORD} ` }),
    ];

    for (const candidate of cases) {
      expect(submitDisabledReason(candidate) === undefined).toBe(canSubmit(candidate));
    }
  });
});

/**
 * 문구 자체의 사실을 재는 자리다 — 렌더와 무관하므로 순수 시험이 든다.
 *
 * **리터럴을 쓰지 않고 i18n 키로 잰다.** 문구를 다듬을 때 리터럴로 적힌 감지기는 함께 고쳐야
 * 하고, 고치는 김에 규칙까지 느슨해진다. 키로 재면 문구가 바뀌어도 **규칙만 남는다.**
 */
/**
 * ⚠ **「한쪽 칸만 지목하지 않는다」 규칙에서 빼는 문구.** 근거가 **두 겹**이다.
 *
 * **① 진단이 아니라 해결 경로다.** 그 규칙이 막는 것은 **무엇이 틀렸는지를 진단하는 문장**이
 * 한 칸을 지목하는 것이다 — 그 지목이 곧 「그 아이디는 있다」를 흘린다. 잠금 안내에 나오는
 * 「비밀번호 초기화」는 **관리자가 하는 조치의 이름**이지 「비밀번호가 틀렸다」는 진술이 아니다.
 *
 * **② 그 갈래는 상태 코드 자체가 이미 계정 존재를 드러낸다.** 잠김(423)은 **잠긴 계정에만**
 * 오고 없는 계정은 401을 받는다. 그것은 스펙이 감수하기로 한 트레이드오프이며(남은 시도
 * 횟수와 같은 성격), 그 갈래 안에서 문구가 칸을 지목하는지를 따지는 것은 실익이 없다.
 *
 * 문구 자체는 스펙이 확정한 것이라 규칙에 맞추려고 다듬지 않는다.
 *
 * ⛔ **이 목록이 늘면 규칙이 껍데기가 된다.** 아래 두 시험이 함께 지킨다 — 하나는 목록 밖
 * 전부에 규칙을 걸고, 다른 하나는 목록 안에 **실제로 해결 경로가 담겼는지**를 잰다.
 */
const RECOVERY_SENTENCES: readonly string[] = [t.banner.locked];

/**
 * 이 화면이 **빌려 쓰는** 공용 실패 문구. 다섯 갈래 중 둘(통신 실패·모름)이 `login` 블록 밖의
 * 문구를 낸다 — 규칙의 사정거리가 「이 화면이 내는 실패 문구 전부」가 되도록 함께 훑는다.
 *
 * 공용 문구라 다른 화면이 함께 쓰지만, **이 화면이 그것을 낸다는 사실**이 여기서 규칙을 만든다.
 */
const BORROWED_SENTENCES: readonly string[] = [
  messages.httpError.offline,
  messages.httpError.description,
];

describe('login 블록의 문구 규율', () => {
  /**
   * **비활성 사유는 그 컨트롤의 이름으로 시작한다**(배치 규범 4-5 · `ko.ts` 작성 규칙).
   * 잠긴 컨트롤은 포커스를 받지 못해, 사유가 시각적으로 끊겼을 때 주어가 없으면 복원할 단서가
   * 없다. **사유가 늘어도 이 규칙이 따라붙게** 블록 전체를 훑는다.
   */
  it('모든 비활성 사유가 로그인 버튼 이름으로 시작한다', () => {
    const reasons = Object.values(t.actionReasons);

    expect(reasons.length).toBeGreaterThan(0);

    for (const reason of reasons) {
      expect(reason.startsWith(t.actions.submit)).toBe(true);
    }
  });

  /**
   * ⛔ **한쪽 칸만 지목하는 문장을 두지 않는다**(공유계약 F-7 · 완료 조건 T2-8).
   *
   * 「아이디가 없습니다」도 「비밀번호가 틀렸습니다」도 **계정이 있는지를 흘린다.** 두 칸을
   * 함께 말하거나 둘 다 말하지 않거나 둘 중 하나여야 한다. 칸 이름 자체(라벨)는 이 규칙의
   * 대상이 아니다 — 규칙은 **사유와 실패 문구**에 걸린다.
   */
  it('사유와 실패 문구가 한쪽 칸만 지목하지 않는다', () => {
    const bannerValues: readonly unknown[] = Object.values(t.banner);
    const plain = bannerValues.filter((value): value is string => typeof value === 'string');
    /*
     * 문구 조립기는 표본 인자로 펴서 함께 잰다. **개수를 맞춰 두어** 조립기가 새로 늘면
     * 아래 단언이 먼저 깨진다 — 새 문구가 이 규칙을 조용히 비켜 가지 못한다.
     */
    const built = [t.banner.lockWarning(2, 5), t.banner.lockWarningWithoutThreshold(3)];

    expect(bannerValues.length - plain.length).toBe(built.length);

    const sentences = [
      ...Object.values(t.actionReasons),
      ...plain,
      ...built,
      ...BORROWED_SENTENCES,
    ].filter((sentence) => !RECOVERY_SENTENCES.includes(sentence));

    expect(sentences.length).toBeGreaterThan(0);

    for (const sentence of sentences) {
      const namesLoginId = sentence.includes(t.fields.loginId);
      const namesPassword = sentence.includes(t.fields.password);

      expect(namesLoginId).toBe(namesPassword);
    }
  });

  /**
   * 빼 놓은 문구가 **규칙의 취지 밖에 있다**는 것을 여기서 따로 잰다 — 목록이 조용히
   * 늘어나면 규칙이 껍데기만 남으므로, 뺀 문구에는 **해결 경로가 실제로 담겨 있어야** 한다.
   */
  it('규칙에서 뺀 문구는 해결 경로를 담는다', () => {
    expect(RECOVERY_SENTENCES).toHaveLength(1);

    for (const sentence of RECOVERY_SENTENCES) {
      expect(sentence).toContain('관리자');
      expect(sentence).toContain('요청');
    }
  });
});

import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import type { ReactNode } from 'react';

import type { LoginOutcome } from './login-outcome';

const t = messages.login;

/**
 * 계정이 잠기는 실패 횟수 — **자리표시 상수다.**
 *
 * ⚠ **설계 미확정.** 착수 지시가 「실패 5회로 시작」을 준 값이고, 화면이 스펙의 문구
 * 「5회 틀리면 계정이 잠깁니다 (2/5)」를 그리려면 임계값을 알아야 해서 여기 둔다.
 *
 * **교체 조건**: 서버가 임계값을 응답에 실어 주게 되면 이 상수를 지우고 그 값을 쓴다.
 * 그때까지는 아래 `describeLockWarning`의 되물림이 어긋남을 흡수한다 — **상수를 눈대중으로
 * 고치지 말고**, 확정되면 서버 값으로 **교체**한다.
 */
export const LOCK_THRESHOLD_ATTEMPTS = 5;

/**
 * 남은 시도 횟수를 사람이 읽는 한 문장으로 옮긴다. **말할 것이 없으면 `undefined`** —
 * 화면은 그때 둘째 줄을 아예 내지 않는다.
 *
 * 갈래가 셋이다.
 *
 * | 남은 횟수 | 무엇을 말하나 | 왜 |
 * | --- | --- | --- |
 * | 없음 | **아무것도** | 없는 계정에는 이 값이 오지 않는다 — 지어내면 계정 존재가 드러난다 |
 * | 0 이하 | **아무것도** | 이 갈래에서 뜻이 성립하지 않는다(잠겼다면 401이 아니라 423이 온다) |
 * | 임계값 이상 | 남은 횟수만 | 누적이 0 이하가 되어 「(0/5)」·「(-4/5)」가 나온다 — 되물림 |
 * | 그 밖 | 누적과 임계값 | 스펙의 문구 형태 |
 *
 * ⭐ **되물림이 자리표시 상수가 만드는 위험의 실감지기다.** 서버 임계값이 5가 아니면 누적
 * 계산이 곧바로 어긋나는데, 그때 화면이 이상한 숫자를 그리는 대신 **아는 것만** 말한다.
 *
 * ⚠ 내보내는 이유는 **단위 시험이 이 갈래표를 직접 재기 위해서다.** 전례의 `describe*`와 달리
 * 다른 부품이 소비하지 않는다 — 다음 사본이 「전례가 내보냈으니까」로 넘기지 않도록 적어 둔다.
 */
export const describeLockWarning = (remainingAttempts: number | undefined): string | undefined => {
  if (remainingAttempts === undefined || remainingAttempts <= 0) return undefined;

  const used = LOCK_THRESHOLD_ATTEMPTS - remainingAttempts;

  return used <= 0
    ? t.banner.lockWarningWithoutThreshold(remainingAttempts)
    : t.banner.lockWarning(used, LOCK_THRESHOLD_ATTEMPTS);
};

/** 배너 한 장이 담을 것 — 본문 줄과, 있으면 액션. */
interface BannerContent {
  lines: string[];
  /** 눌러서 풀 수 있는 갈래에만 둔다. `false`면 액션 자리를 만들지 않는다 */
  canRetry: boolean;
}

/**
 * 갈래를 배너 내용으로 옮긴다.
 *
 * ⛔ **「다시 시도」는 다시 시도해서 달라지는 갈래에만 둔다**(공유계약 G-23 — 누를 수 있는데
 * 아무 일도 없는 컨트롤을 두지 않는다). 잠긴 계정은 같은 답이 오고, 자격 불일치와 검증 실패는
 * **값을 고쳐야** 풀린다 — 그 자리에 「다시 시도」를 두면 사용자를 헛돌게 하고 정작 해야 할
 * 일(관리자 요청·값 수정)을 가린다.
 */
const toContent = (outcome: LoginOutcome): BannerContent => {
  switch (outcome.kind) {
    case 'mismatch': {
      const warning = describeLockWarning(outcome.remainingAttempts);

      /* 값이 없으면 줄 자체를 만들지 않는다 — 빈 줄도 「말한 것」이 된다. */
      return {
        lines: warning === undefined ? [t.banner.mismatch] : [t.banner.mismatch, warning],
        canRetry: false,
      };
    }
    case 'locked':
      return { lines: [t.banner.locked], canRetry: false };
    case 'invalid': {
      /*
       * 서버가 준 문구를 그대로 낸다 — 계약이 이 자리의 실패를 문장으로만 설명한다.
       *
       * ⛔ **서버가 빈 문구를 주는 일이 실제로 있다**(전례 `approval-inbox/load-error-banner.tsx`가
       * 관측된 사실로 적어 둔 자리다). 걸러 내지 않으면 제목만 남고 본문이 빈 배너가 서서,
       * 사용자가 **무엇을 해야 하는지 아무것도 얻지 못한다.** 갈래를 나눠 각각 알리는 이 화면에
       * 「아무 말도 하지 않는」 경로를 남기지 않는다.
       *
       * 공백만 있는 문구도 같이 거른다 — 이 슬라이스는 이미 「앞뒤 공백만 있는 값은 빈 값으로
       * 본다」를 규칙으로 쓰고 있다(`login-draft.ts`의 `isFilled`). 잇고 나서 검사하는 전례의
       * 형태로는 항목이 둘 다 비었을 때 이음쇠 공백 하나가 남아 빠져나간다.
       */
      const lines = outcome.errors
        .map((item) => item.message)
        .filter((message) => message.trim() !== '');

      return {
        lines: lines.length === 0 ? [messages.httpError.description] : lines,
        canRetry: false,
      };
    }
    case 'network':
      return { lines: [messages.httpError.offline], canRetry: true };
    case 'unknown':
      /*
       * ⛔ 자격이 틀렸다고 말하지 않는다. **그렇다고 침묵하지도 않는다** — 눌렀는데 아무
       * 말도 없는 화면은 사용자가 무엇을 해야 할지 알 수 없게 만든다.
       *
       * 상태 코드는 그리지 않는다. 사용자가 쓰지 않는 말이다.
       *
       * **「다시 시도」를 둔다.** 위 기준(다시 시도해서 달라지는 갈래)에 그대로 들어맞는다 —
       * 고칠 값이 없고 서버 사정은 다시 보내면 달라질 수 있다. 문구가 「잠시 뒤 다시
       * 시도하세요」라고 말하는데 누를 자리가 없으면 **하라고 한 일을 할 수 없다.**
       */
      return { lines: [messages.httpError.description], canRetry: true };
  }
};

export interface LoginErrorBannerProps {
  outcome: LoginOutcome;
  /** 통신 실패의 「다시 시도」. 다른 갈래에서는 불리지 않는다 */
  onRetry: () => void;
}

/**
 * 로그인 실패 배너 — **이 화면의 실패는 전부 여기 한 자리에 선다**(공유계약 G-1).
 *
 * ⛔ **인라인 필드 오류를 내지 않는다.** 칸 옆에 붙은 오류는 문구를 아무리 뭉뚱그려도
 * **붙은 자리가** 어느 칸이 문제인지 말한다 — 서버가 `field` 키를 주더라도 그것을 그 칸에
 * 옮기지 않는다(공유계약 F-7).
 *
 * 규범 6에 따라 화면이 직접 배치하는 배너는 이음매(`.banner-slot`)를 **스스로** 갖는다 —
 * 소비하는 화면이 붙일 것을 잊을 수 없게.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const LoginErrorBanner = ({ outcome, onRetry }: LoginErrorBannerProps) => {
  const content = toContent(outcome);

  const action: ReactNode = content.canRetry ? (
    <Button variant="outlined" size="sm" onClick={onRetry}>
      {messages.common.retry}
    </Button>
  ) : undefined;

  /*
   * 여러 줄을 **한 글자로 이어 넘긴다** — 형제 배너(`approval-inbox/load-error-banner.tsx`)가
   * 서버 오류 여럿을 다루는 방식과 같다. 요소로 쪼개면 문단 기본 여백을 되돌릴 배치 클래스가
   * 새로 필요한데, 디자인 시스템이 이 자리에 이미 본문 서식을 갖고 있어 얻는 것이 없다.
   */
  return (
    <div className="banner-slot">
      <AlertBanner variant="error" title={t.banner.failureTitle} action={action}>
        {content.lines.join(' ')}
      </AlertBanner>
    </div>
  );
};

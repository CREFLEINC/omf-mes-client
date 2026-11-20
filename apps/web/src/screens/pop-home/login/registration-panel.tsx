import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState } from 'react';

import {
  usePopRegistration,
  type FailureSource,
  type RegistrationFailure,
} from '../../../patterns/pop-registration';
import {
  PuActionBar,
  PuBand,
  PuButton,
  PuIcon,
  PuNote,
  PuScanField,
  PuScreen,
  PuSection,
} from '../../../patterns/pop-uniform';
import { useIsOnline } from './connection';
import { equipmentText, processText } from './terminal-facts';
import './uniform.css';

/**
 * P-CO-01 §3-A — **미등록·재등록 패널**(공유계약 F-4).
 *
 * ⭐ **기존 화면 ID 안에 둔다.** 설계가 새 화면을 세우지 않고 이 화면의 «선행 상태»로
 * 그렸다 — 단말을 켰을 때 서는 자리가 하나여야 설치 담당자도 작업자도 같은 곳을 본다.
 *
 * ⛔ **여기서는 사번을 받지 않는다.** 등록·준비가 끝나기 전에는 사번 입력도, 업무 화면
 * 이동도, 서버 업무 조회·저장·발행도 열리지 않는다(F-4).
 *
 * ⛔ **화면을 떠나면 후보 입력을 지운다**(F-4). 붙여넣은 토큰이 화면에 남아 있으면 다음
 * 사람이 그 값을 그대로 쓸 수 있고, 그것은 발급 대화상자가 한 번만 내준 값이다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

const t = messages.workerAssignment.registration;

/**
 * 사유를 문장으로. **각 사유가 사람이 할 일이 다르다** — 401 은 재발급, 403 은 다른 토큰,
 * 미보관은 설치 담당자 호출이다. 한 문장으로 뭉치면 아무도 다음 행동을 모른다.
 */
const failureMessage = (
  failure: RegistrationFailure,
  pendingCount: number,
  source: FailureSource,
): string => {
  /*
   * ⛔ **보관된 토큰의 판정을 사람이 넣은 값의 판정처럼 말하지 않는다**(#1137). 켤 때 스스로
   *    확인하는 갈래라 이 순간 입력란은 «비어» 있다 — 「이 토큰은 더 이상 쓸 수 없습니다」가
   *    무엇을 가리키는지 알 수 없고, 설치 담당자는 자기가 넣은 값이 거절당한 줄 안다.
   *
   * ⚠ **닿지 못한 갈래는 가르지 않는다.** 판정이 아니라 못 물어본 것이라 두 경우에 할 일이
   *   같다 — 연결을 확인하고 다시 시도하는 것 하나뿐이다.
   */
  if (source === 'stored') {
    switch (failure) {
      case 'malformed':
        return t.storedFailure.malformed;
      case 'rejected':
        return t.storedFailure.rejected;
      case 'foreign':
        return t.storedFailure.foreign;
      case 'wrong-type':
        return t.storedFailure.wrongType;
      default:
        break;
    }
  }

  switch (failure) {
    case 'malformed':
      return t.failure.malformed;
    case 'rejected':
      return t.failure.rejected;
    case 'unreachable':
      return t.failure.unreachable;
    case 'foreign':
      return t.failure.foreign;
    case 'wrong-type':
      return t.failure.wrongType;
    case 'offline':
      return t.failure.offline;
    case 'no-store':
      return t.failure.noStore;
    case 'queue-blocked':
      return t.failure.queueBlocked.replace('{count}', String(pendingCount));
  }
};

export const RegistrationPanel = () => {
  const registration = usePopRegistration();
  const [token, setToken] = useState('');
  const isOnline = useIsOnline();
  const titleId = useId();

  /* 이탈 시 후보 입력을 지운다 — 값이 화면에 남지 않게 한다(F-4). */
  useEffect(() => () => setToken(''), []);

  const { phase, failure, failureSource, pendingCount, terminal, verifiedProcessNames } =
    registration;
  const busy = phase === 'verifying' || phase === 'preparing';

  /* POP 단말용이 아닌 토큰을 넣었으면 칸을 비운다 — 같은 값을 다시 누르지 않게 한다(omf-all-around#288). */
  useEffect(() => {
    if (failure === 'wrong-type' && failureSource === 'entered') setToken('');
  }, [failure, failureSource]);

  /** ⛔ 빈 값·확인 중에는 보내지 않는다 — 단추의 잠금과 같은 판정이다. */
  const send = (value: string): void => {
    const trimmed = value.trim();

    if (trimmed === '' || busy) return;

    void registration.verify(trimmed);
  };

  const isInput = phase === 'unregistered' || phase === 'verifying';
  const isConfirm = phase === 'verified' && terminal !== null;
  const failureText =
    failure === null ? null : failureMessage(failure, pendingCount, failureSource);
  const guide = isInput
    ? t.guide
    : isConfirm
      ? t.confirmTitle
      : phase === 'preparing'
        ? t.preparing
        : null;

  /* 아래 작업 줄 — 다른 POP 화면과 같은 공통 작업 줄(보조는 왼쪽, 주 조작은 오른쪽 끝). */
  const actionBar = isInput ? (
    <PuActionBar label={t.title}>
      <PuButton icon="reset" onClick={() => setToken('')} disabled={busy || token === ''}>
        {t.clear}
      </PuButton>
      <PuButton
        variant="primary"
        onClick={() => {
          send(token);
        }}
        disabled={busy || token.trim() === ''}
      >
        {phase === 'verifying' ? t.verifying : t.verify}
      </PuButton>
    </PuActionBar>
  ) : isConfirm || phase === 'prepare-failed' ? (
    <PuActionBar label={isConfirm ? t.confirmHeading : t.title}>
      <PuButton onClick={registration.restart}>{t.restart}</PuButton>
      <PuButton
        variant="primary"
        onClick={() => {
          void (isConfirm ? registration.apply() : registration.retryPrepare());
        }}
      >
        {isConfirm ? t.apply : t.retryPrepare}
      </PuButton>
    </PuActionBar>
  ) : undefined;

  return (
    <div className="wa-reg">
      {/*
       * 다른 POP 화면과 같은 짙은 머리줄(사용자 지시 2026-11-20 · #334) — 연결 상태 · 제품 이름 · 「단말 확인 전」.
       * 등록 전에는 할 일이 없어 다른 단추는 두지 않는다.
       */}
      <div className="pop-nav">
        <div className="pop-nav-top">
          <Chip variant="status" size="md" status={isOnline ? 'success' : 'warning'}>
            {isOnline
              ? messages.workerAssignment.header.online
              : messages.workerAssignment.header.offline}
          </Chip>
          <span className="pop-nav-top__brand">{messages.workerAssignment.header.brand}</span>
          <span className="pop-nav-top__chip pop-nav-top__terminal">
            {messages.popChrome.header.terminalUnknown}
          </span>
        </div>
      </div>

      {/*
       * 본문 — 출하 완료의 지시서 조회와 같은 짜임(사용자 지시 2026-11-20): 전폭 구획 하나에 이름 위 스캔 칸 + [직접 입력],
       * 아래는 공통 작업 줄.
       */}
      <PuScreen className="wa-reg-main" actionBar={actionBar}>
        <PuSection
          labelId={titleId}
          title={isConfirm ? t.confirmHeading : t.title}
          className="wa-reg-card"
          grow={false}
        >
          {guide !== null && <PuNote tone="info">{guide}</PuNote>}

          {isInput && (
            /*
             * ⭐ **바코드로 읽으면 그대로 확인까지 간다**(사용자 지시 2026-09-19 · omf-all-around#35).
             *    스캐너가 값 끝에 Enter 를 붙이지 않아도, 글자가 멈추면 [단말 등록]을 누른 것과
             *    같다 — 판정은 `patterns/pop-scanner-submit` 한 곳이다(스캔 칸이 부른다). 손으로 친
             *    값은 그대로 Enter·단추로만 나간다. 등록이 안 된 이유는 칸 바로 아래 빨간 줄이다.
             */
            <PuScanField
              label={t.tokenLabel}
              ariaLabel={t.tokenLabel}
              required
              value={token}
              onChange={setToken}
              onSubmit={send}
              disabled={busy}
              error={failureText}
            />
          )}

          {!isInput && failureText !== null && <PuNote tone="bad">{failureText}</PuNote>}

          {phase === 'prepare-failed' && (
            <PuNote tone="warn">
              <b>{t.prepareFailedTitle}</b>
              <br />
              {t.prepareFailedBody}
            </PuNote>
          )}

          {isConfirm && (
            <PuBand
              grid={3}
              label={t.confirmHeading}
              items={[
                {
                  label: (
                    <>
                      <PuIcon name="pin" />
                      {t.terminalCode}
                    </>
                  ),
                  value: terminal.terminalCode,
                },
                {
                  label: (
                    <>
                      <PuIcon name="tool" />
                      {t.equipment}
                    </>
                  ),
                  value: equipmentText(terminal),
                },
                {
                  label: (
                    <>
                      <PuIcon name="list" />
                      {t.process}
                    </>
                  ),
                  value: processText(verifiedProcessNames),
                },
              ]}
            />
          )}
        </PuSection>
      </PuScreen>
    </div>
  );
};

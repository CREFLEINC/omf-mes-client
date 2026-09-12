import { AlertBanner, Button, Card, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { usePopRegistration, type RegistrationFailure } from '../../patterns/pop-registration';

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
const failureMessage = (failure: RegistrationFailure, pendingCount: number): string => {
  switch (failure) {
    case 'malformed':
      return t.failure.malformed;
    case 'rejected':
      return t.failure.rejected;
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

  /* 이탈 시 후보 입력을 지운다 — 값이 화면에 남지 않게 한다(F-4). */
  useEffect(() => () => setToken(''), []);

  const { phase, failure, pendingCount, terminal } = registration;
  const busy = phase === 'verifying' || phase === 'preparing';

  return (
    <div className="pop-registration">
      <Card className="pop-registration__card">
        <h1 className="pop-registration__title">{t.title}</h1>

        {failure !== null ? (
          <AlertBanner variant="error">{failureMessage(failure, pendingCount)}</AlertBanner>
        ) : null}

        {phase === 'verified' && terminal !== null ? (
          <>
            <p className="pop-registration__guide">{t.confirmTitle}</p>
            <dl className="pop-registration__facts">
              <dt>{t.terminalCode}</dt>
              <dd>{terminal.terminalCode}</dd>
              <dt>{t.terminalType}</dt>
              <dd>{terminal.terminalTypeCode}</dd>
              <dt>{t.equipment}</dt>
              {/* ⛔ 이름이 없으면 코드·번호를 보이고, 어느 것도 없으면 미지정이다 — 지어내지 않는다. */}
              <dd>
                {terminal.equipmentName ??
                  terminal.equipmentCode ??
                  (terminal.equipmentId === null ? t.unassigned : String(terminal.equipmentId))}
              </dd>
            </dl>
            <div className="pop-registration__actions">
              <Button onClick={() => void registration.apply()}>{t.apply}</Button>
              <Button variant="outlined" onClick={registration.restart}>
                {t.restart}
              </Button>
            </div>
          </>
        ) : null}

        {phase === 'prepare-failed' ? (
          <>
            <AlertBanner variant="warning">{t.prepareFailedTitle}</AlertBanner>
            <p className="pop-registration__guide">{t.prepareFailedBody}</p>
            <div className="pop-registration__actions">
              <Button onClick={() => void registration.retryPrepare()}>{t.retryPrepare}</Button>
              <Button variant="outlined" onClick={registration.restart}>
                {t.restart}
              </Button>
            </div>
          </>
        ) : null}

        {phase === 'unregistered' || phase === 'verifying' ? (
          <>
            <p className="pop-registration__guide">{t.guide}</p>
            <TextField
              label={t.tokenLabel}
              placeholder={t.tokenPlaceholder}
              value={token}
              onChange={(event) => setToken(event.target.value)}
              disabled={busy}
            />
            <div className="pop-registration__actions">
              <Button
                onClick={() => void registration.verify(token)}
                disabled={busy || token.trim() === ''}
              >
                {phase === 'verifying' ? t.verifying : t.verify}
              </Button>
              <Button variant="outlined" onClick={() => setToken('')} disabled={busy}>
                {t.clear}
              </Button>
            </div>
          </>
        ) : null}

        {phase === 'preparing' ? <p className="pop-registration__guide">{t.preparing}</p> : null}
      </Card>
    </div>
  );
};

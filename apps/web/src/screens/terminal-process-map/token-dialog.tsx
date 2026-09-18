import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { QrCode } from '@omf-mes/ui';
import { useEffect, useState } from 'react';

import { formatMoment, type TokenView } from './types';

const t = messages.terminalProcessMap;

export interface TokenDialogProps {
  token: TokenView | null;
  terminalCode: string;
  onClose: () => void;
}

/**
 * 복사 결과 — 실패를 원인별로 가른다. 사용자가 할 수 있는 다음 행동이 다르기 때문이다.
 * - `unavailable` 보안 연결이 아닌 주소라 브라우저가 클립보드를 아예 내주지 않는다 → QR 로 전달
 * - `denied` 브라우저가 권한을 거부했다 → 권한 확인
 * - `failed` 그 밖의 실패 → 다시 시도하거나 QR 로 전달
 */
type CopyResult = 'copied' | 'unavailable' | 'denied' | 'failed';

/** 발급한 실제 JWT를 QR 또는 클립보드로 기기에 전달한다. 원문을 화면에 렌더링하지 않는다. */
export const TokenDialog = ({ token, terminalCode, onClose }: TokenDialogProps) => {
  const [copyResult, setCopyResult] = useState<CopyResult | null>(null);

  useEffect(() => {
    setCopyResult(null);
  }, [token]);

  const copyCode = async () => {
    if (token === null) return;
    /*
     * ⚠ 보안 연결이 아닌 주소(평문 HTTP)에서는 브라우저가 `navigator.clipboard` 자체를 내주지 않는다.
     * 권한 문제가 아니므로 권한 안내를 쓰지 않는다. 원문을 화면에 그리는 우회 복사는 하지 않는다.
     */
    if (window.isSecureContext === false || typeof navigator.clipboard?.writeText !== 'function') {
      setCopyResult('unavailable');
      return;
    }
    try {
      await navigator.clipboard.writeText(token.token);
      setCopyResult('copied');
    } catch (error) {
      setCopyResult(
        error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'failed',
      );
    }
  };

  return (
    <Dialog
      open={token !== null}
      onClose={onClose}
      title={t.token.title}
      footer={<Button onClick={onClose}>{t.token.close}</Button>}
    >
      {token !== null && (
        <>
          <p className="dialog-lead">{t.token.lead}</p>
          <div className="token-figure">
            <QrCode value={token.token} label={`${terminalCode} ${t.token.imageLabel}`} />
          </div>
          <Button variant="outlined" onClick={() => void copyCode()}>
            {t.token.copy}
          </Button>
          {copyResult === 'copied' ? <p role="status">{t.token.copied}</p> : null}
          {copyResult === 'unavailable' ? (
            <AlertBanner className="terminal-map-notice" variant="warning">
              {t.token.copyUnavailable}
            </AlertBanner>
          ) : null}
          {copyResult === 'failed' ? (
            <AlertBanner className="terminal-map-notice" variant="error">
              {t.token.copyError}
            </AlertBanner>
          ) : null}
          {copyResult === 'denied' ? (
            <AlertBanner className="terminal-map-notice" variant="error">
              {t.token.copyFailed}
            </AlertBanner>
          ) : null}
          <p className="field-note">{t.token.textOmitted}</p>
          <dl className="token-meta">
            <dt>{t.token.issuedAt}</dt>
            <dd>{formatMoment(token.issuedAt)}</dd>
            <dt>{t.token.expiresAt}</dt>
            <dd>{token.expiresAt === null ? t.token.noExpiry : formatMoment(token.expiresAt)}</dd>
          </dl>
          <AlertBanner className="terminal-map-notice" variant="warning">
            {t.token.reissueWarning}
          </AlertBanner>
        </>
      )}
    </Dialog>
  );
};

import { AlertBanner, Button, Dialog, useToast } from '@crefle/web-ui';
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
type CopyResult = 'unavailable' | 'denied' | 'failed';

/** 발급한 실제 JWT를 QR 또는 클립보드로 기기에 전달한다. 원문을 화면에 렌더링하지 않는다. */
export const TokenDialog = ({ token, terminalCode, onClose }: TokenDialogProps) => {
  const [copyResult, setCopyResult] = useState<CopyResult | null>(null);
  const toast = useToast();

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
      setCopyResult(null);
      /* 성공은 창 안 문구가 아니라 오른쪽 아래 알림으로(사용자 지시 2026-11-20 · #333). */
      toast.show({ variant: 'success', description: t.token.copied });
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
      className="terminal-map-token-dialog"
      /* 시안대로(사용자 지시 2026-11-20 · #333) — 오른쪽 위 X 없이 [닫기]로만 닫는다. */
      showCloseButton={false}
      closeOnBackdropClick={false}
      footer={<Button onClick={onClose}>{t.token.close}</Button>}
    >
      {token !== null && (
        <>
          {/* 시안 — 가운데 한 줄 안내 · QR · 복사 단추와 붙여넣기 안내 · 구분선 아래 발급 · 만료 일시. */}
          <p className="terminal-map-token-lead">{t.token.lead}</p>
          <div className="token-figure">
            <QrCode value={token.token} label={`${terminalCode} ${t.token.imageLabel}`} />
          </div>
          <Button
            variant="outlined"
            className="terminal-map-token-copy"
            onClick={() => void copyCode()}
          >
            {t.token.copy}
          </Button>
          <p className="field-note terminal-map-token-hint">{t.token.textOmitted}</p>
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
          <dl className="token-meta terminal-map-token-meta">
            <dt>{t.token.issuedAt}</dt>
            <dd>{formatMoment(token.issuedAt)}</dd>
            <dt>{t.token.expiresAt}</dt>
            <dd>{token.expiresAt === null ? t.token.noExpiry : formatMoment(token.expiresAt)}</dd>
          </dl>
        </>
      )}
    </Dialog>
  );
};

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

/** 발급한 실제 JWT를 QR 또는 클립보드로 기기에 전달한다. 원문을 화면에 렌더링하지 않는다. */
export const TokenDialog = ({ token, terminalCode, onClose }: TokenDialogProps) => {
  const [copyResult, setCopyResult] = useState<'copied' | 'failed' | null>(null);

  useEffect(() => {
    setCopyResult(null);
  }, [token]);

  const copyCode = async () => {
    if (token === null) return;
    try {
      await navigator.clipboard.writeText(token.token);
      setCopyResult('copied');
    } catch {
      setCopyResult('failed');
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
          {copyResult === 'failed' ? (
            <AlertBanner variant="error">{t.token.copyFailed}</AlertBanner>
          ) : null}
          <p className="field-note">{t.token.textOmitted}</p>
          <dl className="token-meta">
            <dt>{t.token.issuedAt}</dt>
            <dd>{formatMoment(token.issuedAt)}</dd>
            <dt>{t.token.expiresAt}</dt>
            <dd>{token.expiresAt === null ? t.token.noExpiry : formatMoment(token.expiresAt)}</dd>
          </dl>
          <AlertBanner variant="warning">{t.token.reissueWarning}</AlertBanner>
        </>
      )}
    </Dialog>
  );
};

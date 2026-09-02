import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { QrCode } from '@omf-mes/ui';

import { formatMoment, type TokenView } from './types';

const t = messages.terminalProcessMap;

export interface TokenDialogProps {
  token: TokenView | null;
  terminalCode: string;
  onClose: () => void;
}

/**
 * 발급한 등록 토큰을 그림으로 보인다.
 *
 * ⭐ **기기가 서버를 부르지 않는다** — 이 그림이 기기로 가는 유일한 경로다. 그래서 발급과
 * 표시가 한자리에 있고, 닫으면 다시 볼 수 없다(다시 보려면 재발급이고, 재발급은 이전 기기를
 * 끊는다).
 *
 * ⛔ **토큰 글자를 화면에 적지 않는다.** 적으면 어깨너머로 읽히고 화면 갈무리에 남는다 —
 * 그림은 카메라를 들이대야 읽힌다. 그 차이가 이 화면이 지키는 유일한 보안 경계다.
 */
export const TokenDialog = ({ token, terminalCode, onClose }: TokenDialogProps) => (
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
        <p className="field-note">{t.token.textOmitted}</p>
        <dl className="token-meta">
          <dt>{t.token.issuedAt}</dt>
          <dd>{formatMoment(token.issuedAt)}</dd>
          <dt>{t.token.expiresAt}</dt>
          <dd>{token.expiresAt === null ? t.token.noExpiry : formatMoment(token.expiresAt)}</dd>
        </dl>
        {/* 이미 발급했더라도 다시 말한다 — 다음 사람이 이 화면을 열 때가 재발급 시점이다. */}
        <AlertBanner variant="warning">{t.token.reissueWarning}</AlertBanner>
      </>
    )}
  </Dialog>
);

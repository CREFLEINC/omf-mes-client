import { AlertBanner, Button, Dialog } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { masterName } from '../../patterns/master-name';

const t = messages.productionResult.flow.underReason;

type CodeValue = components['schemas']['CodeValue'];

export interface UnderReasonDialogProps {
  open: boolean;
  reasons: CodeValue[];
  isLoading: boolean;
  isError: boolean;
  /** 앞 마감이 사유 때문에 거부됐을 때 서버가 준 문구 */
  error: string | null;
  /** 「목표 n · 실적 m」 — 왜 사유를 묻는지 숫자로 보인다 */
  summary: string | null;
  onPick: (code: string) => void;
  onCancel: () => void;
}

/** 목표에 못 미친 LOT 을 마감하기 전에 사유 하나를 고른다. 고르는 즉시 마감한다. */
export const UnderReasonDialog = ({
  open,
  reasons,
  isLoading,
  isError,
  error,
  summary,
  onPick,
  onCancel,
}: UnderReasonDialogProps) => (
  <Dialog
    open={open}
    onClose={onCancel}
    title={t.title}
    showCloseButton={false}
    /* 터치 단말의 오조작 — 바깥을 눌러 닫히지 않는다. */
    closeOnBackdropClick={false}
    footer={
      <Button variant="outlined" size="xl" onClick={onCancel}>
        {t.cancel}
      </Button>
    }
  >
    {summary !== null && <p className="pop-figures-line">{summary}</p>}
    {error !== null && (
      <div className="banner-slot">
        <AlertBanner variant="error" title={error} />
      </div>
    )}
    {isLoading ? (
      <p role="status">{t.loading}</p>
    ) : isError ? (
      <AlertBanner variant="error" title={t.loadFailed} />
    ) : reasons.length === 0 ? (
      <p>{t.empty}</p>
    ) : (
      <div className="production-flow-reason-tiles">
        {reasons.map((reason) => (
          <Button
            key={reason.code}
            variant="outlined"
            size="xl"
            onClick={() => onPick(reason.code)}
          >
            {masterName(reason, reason.codeName)}
          </Button>
        ))}
      </div>
    )}
  </Dialog>
);

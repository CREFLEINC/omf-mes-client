import { AlertBanner } from '@crefle/web-ui';
import { GOODS_RECEIPT_INBOUND_LOT_RECEIVING_CODE, type ApiError } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';

import { SaveErrorBanner } from '../../patterns/master';

const t = messages.goodsReceipt.notes.inboundLotReceiving;

/**
 * 입고가 「입하 마감 전」이라 막혔는가(005 FR-014a · T137) — 입하 중(`RECEIVING`) 입하 LOT 의 자재 관리 LOT 은 입고 요청이 409 다.
 * 검사 불필요 품목도 같다. 서버가 `errors[].code`(또는 맨 위 `code`)로 준다.
 */
export const isInboundLotReceivingError = (error: ApiError | null): boolean => {
  if (error === null || error.kind === 'network') return false;
  if (
    'errors' in error &&
    error.errors.some((item) => item.code === GOODS_RECEIPT_INBOUND_LOT_RECEIVING_CODE)
  ) {
    return true;
  }
  return 'code' in error && error.code === GOODS_RECEIPT_INBOUND_LOT_RECEIVING_CODE;
};

/** 입고 저장 오류 — 입하 마감 전이면 다음 할 일(입하 마감)을 말하고, 그 밖은 공통 저장 오류 띠. */
export const PostErrorBanner = ({ error }: { error: ApiError | null }) =>
  isInboundLotReceivingError(error) ? (
    <div className="banner-slot">
      <AlertBanner variant="error" title={t.title}>
        {t.body}
      </AlertBanner>
    </div>
  ) : (
    <SaveErrorBanner error={error} />
  );

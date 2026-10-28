import { AlertBanner, Button, useToast } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { ApiRequestError, toApiError } from '../../patterns/request';
import {
  CUSTOMS_RESULT,
  customsErrorMessage,
  formatCustomsClearance,
  summarizeCustomsResult,
  useFetchCustomsClearances,
} from './customs-clearance';

const t = messages.erpPurchaseOrder;

/**
 * 라인 표 머리의 [통관번호 받아오기] — 외자 발주이고 W-06-10 권한이 있을 때만 화면이 세운다(omf-all-around#206).
 *
 * 결과는 알림 한 줄로 알린다(「3줄 중 2줄 받음 · 1줄 통관 전」). 통관번호가 여럿이라 저장하지 않은 라인(`MULTIPLE`)은
 * 알림으로 사라지면 안 되므로 그 라인과 후보를 경고 띠로 남긴다. 고른 발주가 바뀌면 화면이 이 구성요소를 새로 세워
 * 앞 발주의 결과가 남지 않는다(`key`).
 */
export const CustomsClearanceAction = ({ purchaseOrderId }: { purchaseOrderId: number }) => {
  const toast = useToast();
  const fetch = useFetchCustomsClearances();
  const multiple = (fetch.data?.lines ?? []).filter(
    (line) => line.result === CUSTOMS_RESULT.multiple,
  );

  return (
    <>
      <Button
        size="sm"
        variant="outlined"
        loading={fetch.isPending}
        disabled={fetch.isPending}
        onClick={() => {
          fetch.reset();
          fetch.mutate(purchaseOrderId, {
            onSuccess: (result) => {
              toast.show({ variant: 'success', description: summarizeCustomsResult(result) });
            },
          });
        }}
      >
        {t.customs.fetch}
      </Button>
      {(fetch.isError || multiple.length > 0) && (
        <div className="erp-po-customs-result">
          {fetch.isError && (
            <AlertBanner variant="error" title={t.customs.fetchFailedTitle}>
              {customsErrorMessage(
                toApiError(fetch.error),
                fetch.error instanceof ApiRequestError ? fetch.error.httpStatus : undefined,
              )}
            </AlertBanner>
          )}
          {multiple.length > 0 && (
            <AlertBanner variant="warning" title={t.customs.multipleTitle}>
              <ul className="erp-po-customs-candidates">
                {multiple.map((line) => (
                  <li key={line.purchaseOrderLineId}>
                    {t.customs.multipleLine(
                      line.lineNo,
                      line.candidates
                        .map(
                          (candidate) =>
                            formatCustomsClearance(
                              candidate.customsClearanceNo,
                              candidate.customsClearanceSeq,
                            ) ?? t.values.missing,
                        )
                        .join(', '),
                    )}
                  </li>
                ))}
              </ul>
            </AlertBanner>
          )}
        </div>
      )}
    </>
  );
};

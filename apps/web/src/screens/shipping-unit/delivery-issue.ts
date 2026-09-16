/**
 * 마감 뒤 **납품 라벨 한 장**을 낸다 — 발행 · 그리기 · 인쇄 · 보고.
 *
 * ```
 * ① 발행 기록      POST /app/document-issues  (대상 SHIPPING_UNIT)
 * ② 그리기         POP 이 상세 값으로 그린다 — 서버는 이 유형을 그려 주지 않는다
 * ③ 인쇄           window.pop.rendition.save
 * ④ 결과 보고      POST /app/document-issues/{id}:report-print
 * ```
 *
 * ⛔ **①이 성공했는데 ③이 실패할 수 있다.** 그것이 오류가 아니라 계약이 만든 **정상 상태**다 —
 *    기록은 남고 종이만 안 나온다. 되돌리지 않고 **재발행**으로 처리하며, 화면이 그 길을 알린다.
 *
 * ⛔ **마감과 한 덩어리로 묶지 않는다.** 마감은 되돌릴 수 없으므로, 라벨이 안 나왔다고 마감을
 *    없던 일로 만들 수 없다. 두 걸음을 갈라 두어야 「마감은 됐고 라벨만 다시 뽑으면 된다」를
 *    말할 수 있다.
 */

import { createIdempotencyKey } from '@omf-mes/api-client';
import { useCallback } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { sendToPrinter, type PrintAttempt } from '../../patterns/pop-print';
import { runRequest } from '../../patterns/request';

import { toDeliveryLabelFields } from './delivery-label-fields';
import { renderDeliveryLabel } from './delivery-label-image';
import type { ShippingUnitDetail } from './types';

const DOCUMENT_TYPE_CODE = 'DELIVERY_LABEL';

/** 대상 유형 — **전달본이 담아 온 값**이다. 계약 enum 에 없으면 컴파일이 막는다. */
const TARGET_TYPE_CODE = 'SHIPPING_UNIT';

/** 발행부터 보고까지의 결과. 어디서 멈췄는지를 **값으로** 말한다. */
export type DeliveryIssueOutcome =
  /** 종이까지 나왔다. */
  | { kind: 'printed'; issueSeq: number }
  /** 기록은 남았는데 종이가 안 나왔다 — **재발행으로 복구한다.** */
  | { kind: 'printFailed'; issueSeq: number; reason: string }
  /** 셸이 없어 «시도하지 않았다». 실패와 다르다. */
  | { kind: 'noBridge'; issueSeq: number }
  /** 기록조차 못 만들었다. 이때만 되풀이해도 안전하다. */
  | { kind: 'issueFailed'; error: unknown };

const reasonOf = (attempt: PrintAttempt): string =>
  attempt.kind === 'failed' ? attempt.reason : '셸 인쇄 통로가 없는 단말에서 실행됐습니다.';

/**
 * 마감된 출하 단위의 납품 라벨을 낸다.
 *
 * ⚠ **`printerName` 을 못 정했어도 발행은 한다**(설계 §5-7). 기록이 남아야 나중에 재발행으로
 *   뽑을 수 있다 — 프린터가 없다고 기록까지 없으면 담당은 처음부터 다시 해야 한다.
 */
export const useDeliveryIssue = (workerNo: string | null) => {
  const { client } = useApiClient();

  return useCallback(
    async (unit: ShippingUnitDetail, printerName: string | null): Promise<DeliveryIssueOutcome> => {
      if (workerNo === null) throw new Error('사번이 없어 납품 라벨을 발행할 수 없습니다.');

      let documentIssueLogId: number;
      let issueSeq: number;

      try {
        const data = await runRequest(() =>
          client.POST('/app/document-issues', {
            params: {
              header: { 'Idempotency-Key': createIdempotencyKey(), 'X-Worker-No': workerNo },
            },
            body: {
              documentTypeCode: DOCUMENT_TYPE_CODE,
              targets: [{ targetTypeCode: TARGET_TYPE_CODE, targetId: unit.shippingUnitId }],
              ...(printerName === null ? {} : { printerName }),
            },
          }),
        );

        const issued = data.items[0];

        /*
         * ⛔ **비어 온 것을 성공으로 삼지 않는다.** 기록 없이 다음 걸음으로 가면 인쇄할 식별자가
         *    없는데 화면은 진행 중으로 보인다 — 그 자리에서 멈추는 편이 낫다.
         */
        if (issued === undefined) throw new Error('발행 기록이 비어 왔습니다.');

        documentIssueLogId = issued.documentIssueLogId;
        issueSeq = issued.issueSeq;
      } catch (error) {
        return { kind: 'issueFailed', error };
      }

      /*
       * ⭐ **POP 이 그린다.** 서버는 이 유형의 렌디션을 만들지 않는다 — 준비된 종류 목록에 없어
       *    요청 자체가 막힌다(포장 라벨이 그 자리에서 종이가 안 나오던 까닭과 같다).
       * ⚠ 형식은 `png` 다 — 명령형(TSPL)은 RAW 자리로만 나가는데 그 자리는 win32 에서만 선다.
       */
      const bytes = renderDeliveryLabel(toDeliveryLabelFields(unit, issueSeq));
      const attempt = await sendToPrinter(bytes, `delivery-${String(documentIssueLogId)}`, 'png');

      /*
       * ⛔ **보고가 실패해도 종이가 나온 사실을 뒤집지 않는다.** 보고는 되풀이할 수 있지만
       *    인쇄는 아니다 — 여기서 실패로 말하면 담당이 멀쩡히 나온 라벨을 다시 뽑는다.
       */
      await reportPrint(client, workerNo, documentIssueLogId, attempt);

      if (attempt.kind === 'printed') return { kind: 'printed', issueSeq };
      if (attempt.kind === 'noBridge') return { kind: 'noBridge', issueSeq };

      return { kind: 'printFailed', issueSeq, reason: reasonOf(attempt) };
    },
    [client, workerNo],
  );
};

/**
 * 인쇄 결과를 보고한다. **던지지 않는다** — 보고 실패가 인쇄 성공을 뒤집지 않는다.
 *
 * ⛔ **빈 사유로 보고하지 않는다.** `FAILED` 인데 사유가 없으면 서버가 422 로 막아, 인쇄도
 *    실패하고 보고도 실패해 회차가 `PENDING` 인 채 남는다.
 */
const reportPrint = async (
  client: ReturnType<typeof useApiClient>['client'],
  workerNo: string,
  documentIssueLogId: number,
  attempt: PrintAttempt,
): Promise<void> => {
  try {
    await runRequest(() =>
      client.POST('/app/document-issues/{documentIssueLogId}:report-print', {
        params: {
          path: { documentIssueLogId },
          header: { 'Idempotency-Key': createIdempotencyKey(), 'X-Worker-No': workerNo },
        },
        body:
          attempt.kind === 'printed'
            ? { outcome: 'SUCCEEDED' }
            : { outcome: 'FAILED', failureReason: reasonOf(attempt) },
      }),
    );
  } catch {
    /* 보고만 실패했다 — 종이는 이미 나왔거나 안 나왔고, 그 사실은 부르는 쪽이 말한다. */
  }
};

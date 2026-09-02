import { useApiClient } from '../../patterns/api-context';
import { useMasterWrite, type MasterWriteResult } from '../../patterns/master';
import { lotCompleteKeys, lotDetailPath } from './queries';
import type { Lot, LotComplete } from './types';

/**
 * 생산LOT 완료·미달 마감. **한 오퍼레이션이다** — 사유를 싣느냐로만 갈린다(계약 · 스펙 §5-5).
 *
 * ⭐ **멱등 키의 수명은 `until-applied`** — 되돌릴 수 없는 쓰기다(스펙 §8-5 · 되돌리는 화면이
 * 인벤토리에 없다). 통신이 끊긴 뒤 다시 누르면 서버가 다른 쓰기로 보고 **완료를 두 번 실행**할
 * 수 있다. 보낼 값이 바뀌면 지문이 새 키를 준다 — 사유를 고쳐 다시 누르면 새 키로 나간다.
 *
 * ⚠ **사번 헤더가 필요하다**(D-5). 인증이 아니라 귀속이며, 없으면 서버가 거부한다 — 부르는
 * 쪽이 값을 확보한 뒤에만 버튼을 연다.
 */

/**
 * 화면이 인라인으로 낼 수 있는 필드.
 *
 * ⛔ **화면이 갖지 않은 입력칸을 여기 적지 않는다.** `knownFields` 는 「이 화면에 그 오류를 놓을
 * 칸이 있다」는 선언이라, 없는 칸을 적으면 서버가 준 사유가 배너에서도 빠져 **어디에도
 * 표시되지 않는다.** 이 화면의 입력칸은 미달 사유 하나다.
 */
const COMPLETE_FIELDS = ['completionVarianceReasonCode'] as const;

export interface LotCompleteOptions {
  lotId: number | null;
  workerNo: string;
  onSuccess: (lot: Lot) => void;
}

/**
 * ⚠ **`If-Match` 를 «있을 때만» 싣는다.**
 *
 * 계약이 이 오퍼레이션의 `If-Match` 를 **선택**으로 두었다 — 오프라인에서도 쓰는 경로라 큐에
 * 쌓인 요청은 토큰을 싣지 못하기 때문이다(C-9). 그래서 `etagPath` 를 주어 훅이 강제하게 하지
 * 않고, 상세 조회가 남긴 토큰이 있으면 그것을 얹고 없으면 그대로 보낸다.
 *
 * ⛔ **없다고 멈추지 않는다.** `etagPath` 를 주면 토큰이 없을 때 훅이 요청을 보내지 않는데,
 * 그 동작은 `If-Match` 가 **필수**인 오퍼레이션의 것이다. 여기서 그렇게 하면 계약이 허용한
 * 정상 경로에서 화면이 이유 없이 멈춘다.
 *
 * ⛔ **동시 완료를 놓치지도 않는다** — 토큰이 있으면 반드시 싣는다(스펙 §6 · B-1). 두 단말이
 * 같은 LOT 을 동시에 완료하면 뒤엣것이 409 로 되돌아온다.
 */
export const useLotComplete = ({
  lotId,
  workerNo,
  onSuccess,
}: LotCompleteOptions): MasterWriteResult<LotComplete> => {
  const { client, etags } = useApiClient();

  return useMasterWrite<LotComplete, Lot>({
    request: (body, headers) => {
      if (lotId === null) throw new Error('LOT 을 고르지 않으면 완료를 보내지 않습니다.');

      const ifMatch = etags.ifMatch(lotDetailPath(lotId));

      return client.POST('/trace/lots/{lotId}:complete', {
        params: {
          path: { lotId },
          header: {
            'Idempotency-Key': headers['Idempotency-Key'],
            'X-Worker-No': workerNo,
            ...(ifMatch === undefined ? {} : { 'If-Match': ifMatch }),
          },
        },
        body,
      });
    },
    etagPath: null,
    /*
     * 완료하면 그 LOT 이 목록에서 빠지고(`completed=false` 축) 상세의 완료 시각이 채워진다.
     * 둘 다 다시 읽어야 화면이 방금 한 일을 반영한다.
     */
    invalidateKeys: [lotCompleteKeys.all],
    knownFields: COMPLETE_FIELDS,
    keyLifetime: 'until-applied',
    onSuccess,
  });
};

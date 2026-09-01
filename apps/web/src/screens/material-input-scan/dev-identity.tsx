import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router';

import { PopIdentityProvider, type PopIdentity } from '../../patterns/pop-identity';

/**
 * ⚠⚠ **확인용 이음매다. 제품 동작이 아니다.** ⚠⚠
 *
 * POP 셸(`P-CO-01` 사번 경량 인증 · 단말 토큰)이 이 저장소에 아직 없어, **화면을 띄워
 * 손으로 확인할 방법이 없다** — 단말·공정·사번이 전부 비어 게이팅이 닫힌 상태만 보인다.
 * 그래서 주소에서 그 셋을 읽어 넣는 자리를 임시로 둔다.
 *
 * ## ⛔ 이것이 보안 경계를 무르게 하지 않는다
 *
 * 단말 게이팅은 **오조작을 줄이는 장치이지 집행이 아니다**(공유계약 F-1 · F-5). 집행은
 * 서버의 403이고, 주소를 고쳐 게이팅을 여는 것과 서버가 허용하는 것은 별개다. 사번도 마찬가지로
 * **귀속이지 인증이 아니다**(F-2) — 서버가 `X-Worker-No`로 「누가 한 일인가」를 적을 뿐,
 * 이 값으로 자격을 얻지 않는다.
 *
 * 그럼에도 **제품 코드가 아니다.** 셸이 서면 이 파일을 지우고 라우트를 `MaterialInputScanScreen`
 * 으로 되돌린다 — 화면 자체는 한 줄도 바뀌지 않는다(값을 컨텍스트에서 받으므로).
 *
 * ## 지울 때
 *
 * 1. 이 파일을 지운다
 * 2. `routes/index.tsx`의 `/pop/material-input`을 `<MaterialInputScanScreen />`으로 되돌린다
 * 3. 셸이 `PopIdentityProvider`를 채운다
 */

/** 확인용 주소 키. **제품이 읽는 키가 아니다.** */
const TERMINAL_PARAM = 'terminalId';
const PROCESS_PARAM = 'processId';
const WORKER_NO_PARAM = 'workerNo';

const readPositiveId = (params: URLSearchParams, key: string): number | null => {
  const raw = params.get(key);
  if (raw === null || !/^\d+$/.test(raw)) return null;

  const value = Number(raw);

  return Number.isSafeInteger(value) && value > 0 ? value : null;
};

export interface DevPopIdentityProviderProps {
  children: ReactNode;
}

/**
 * 주소에서 단말·공정·사번을 읽어 컨텍스트에 넣는다.
 *
 * **없으면 없는 대로 둔다** — 값을 지어내면 게이팅이 열린 것처럼 보여 확인의 뜻이 사라진다.
 */
export const DevPopIdentityProvider = ({ children }: DevPopIdentityProviderProps) => {
  const [searchParams] = useSearchParams();

  const workerNo = searchParams.get(WORKER_NO_PARAM)?.trim() ?? '';

  const identity: PopIdentity = {
    terminalId: readPositiveId(searchParams, TERMINAL_PARAM),
    processId: readPositiveId(searchParams, PROCESS_PARAM),
    workerNo: workerNo === '' || workerNo.length > 50 ? null : workerNo,
  };

  return <PopIdentityProvider value={identity}>{children}</PopIdentityProvider>;
};

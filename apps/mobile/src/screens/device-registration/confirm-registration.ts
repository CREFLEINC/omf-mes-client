import {
  createIdempotencyKey,
  type TerminalRegistrationConfirmation,
} from '@omf-mes/api-client';

import type { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

type Client = ReturnType<typeof useApiClient>['client'];

/** 작업자 명부까지 기기에 저장한 뒤 현재 토큰 세대의 등록 완료를 서버에 알린다(P-7). */
export const confirmTerminalRegistration = async (
  client: Client,
  terminalId: number,
): Promise<TerminalRegistrationConfirmation> => {
  const confirmation = await runRequest(() =>
    client.POST('/mdm/terminals/{terminalId}:confirm-registration', {
      params: {
        path: { terminalId },
        header: { 'Idempotency-Key': createIdempotencyKey() },
      },
      body: {},
    }),
  );

  if (
    confirmation.terminalId !== terminalId ||
    confirmation.registrationStatusCode !== 'REGISTERED' ||
    !Number.isSafeInteger(confirmation.tokenVersion) ||
    confirmation.tokenVersion < 1 ||
    typeof confirmation.registrationConfirmedAt !== 'string' ||
    confirmation.registrationConfirmedAt === ''
  ) {
    throw new Error('단말 등록 완료 응답이 요청한 단말과 일치하지 않습니다.');
  }

  return confirmation;
};

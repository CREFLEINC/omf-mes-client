import { currentDeviceToken } from './device-token';
import { readTerminalClaims } from './token-claims';

/**
 * 이 단말이 선 공장.
 *
 * 단말 토큰이 싣고 온 값을 그대로 쓴다 - 사람이 고르는 값이 아니고, 화면이 지어낼 수도 없다.
 * 발주에서 승계할 수 없는 쓰기가 공장을 알아야 할 때 여기서 읽는다.
 *
 * 토큰을 아직 읽기 전이거나 읽지 못하면 null 이다. 그때 0 이나 1 로 채우면 다른 공장의
 * 재고가 늘어난다 - 모르는 것은 모르는 채로 내고, 부르는 쪽이 막는다.
 */
export const currentPlantId = (): number | null => {
  const token = currentDeviceToken();

  return token === null ? null : (readTerminalClaims(token)?.plantId ?? null);
};

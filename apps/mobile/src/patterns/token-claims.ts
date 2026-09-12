/**
 * 단말 토큰이 싣고 오는 것을 읽는다.
 *
 * ⭐ **토큰에 있는 것은 단말 «번호» 하나뿐이다.** 서버가 서명해 넣는 클레임은 `sub`(단말
 * 번호) · `typ` · `tv`(세대) 셋이고, 서버도 `sub` 로 단말을 찾는다. 단말 코드·공장은 이
 * 번호로 서버에 물어본다 — P-CO-01 이 같은 길을 쓴다(`patterns/pop-registration`).
 *
 * ⛔ **코드·공장이 토큰에 들어 있다고 보지 않는다.** 종전에는 `terminalCode` 와 `plantId` 를
 * 요구하고 둘이 없으면 등록 QR 이 아니라고 판정했다. 클레임이 위 셋뿐이라 그 판정은 **어떤
 * 토큰으로도 만족될 수 없었고**, 모든 등록 QR 이 걸러졌다. 화면은 읽은 값을 조용히 버린 채
 * 스캔 대기에 머물렀고, 현장에서는 「카메라는 열렸는데 인식이 안 된다」로 보였다(#1103).
 *
 * ⛔ **이것은 인증이 아니다.** 서명을 보지 않으므로 값이 참이라는 보장이 없다 — 서버가 받아
 * 줄 때까지 신원으로 쓰지 않는다. 여기서 하는 일은 「어느 주소로 물어볼까」뿐이다.
 *
 * 토큰이 아닌 QR 을 비추는 일이 흔하므로 읽지 못하는 것을 예외로 다루지 않고 null 로 낸다.
 */
export const readTerminalIdFromToken = (token: string): number | null => {
  const parts = token.trim().split('.');

  if (parts.length !== 3) {
    return null;
  }

  const encoded = parts[1];

  if (encoded === undefined || encoded === '') {
    return null;
  }

  let payload: unknown;

  try {
    /* 실제 토큰의 본문에는 채움 문자가 붙지 않는다 — 붙여 주지 않으면 atob 이 거절한다. */
    const base64 = encoded
      .replaceAll('-', '+')
      .replaceAll('_', '/')
      .padEnd(Math.ceil(encoded.length / 4) * 4, '=');

    payload = JSON.parse(atob(base64)) as unknown;
  } catch {
    return null;
  }

  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const sub = (payload as { sub?: unknown }).sub;
  const parsed = typeof sub === 'number' ? sub : typeof sub === 'string' ? Number(sub) : Number.NaN;

  /*
   * ⚠ **안전 정수 밖이면 거부한다.** JavaScript 의 수는 int64 를 온전히 담지 못해 큰 번호는
   * 조용히 반올림된다 — 그 번호로 조회하면 **옆 단말의 정보를 받아** 그것으로 등록된다.
   */
  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
};

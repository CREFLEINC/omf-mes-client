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
const readPayload = (token: string): Record<string, unknown> | null => {
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

  return payload as Record<string, unknown>;
};

/*
 * ⚠ **안전 정수 밖이면 거부한다.** JavaScript 의 수는 int64 를 온전히 담지 못해 큰 번호는
 * 조용히 반올림된다 — 그 번호로 조회하면 옆 단말의 것을 받아 그것으로 등록된다.
 */
const readId = (value: unknown): number | null => {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;

  return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : null;
};

export const readTerminalIdFromToken = (token: string): number | null => {
  const payload = readPayload(token);

  return payload === null ? null : readId(payload.sub);
};

/** 등록 화면이 보여 줄 값. 번호 말고는 없을 수 있다. */
export interface TerminalClaims {
  terminalId: number;
  /** 등록 끝에 사람이 관리자 안내와 대조하는 값. 없으면 표시를 생략한다. */
  terminalCode: string | null;
  /** 쓰기 화면이 물려받는 공장. 없으면 등록 때 다른 길로 받아야 한다. */
  plantId: number | null;
}

/**
 * 토큰이 싣고 온 것을 읽는다.
 *
 * ⛔ **이것은 인증이 아니다.** 서명을 보지 않으므로 값이 참이라는 보장이 없다 — 서버가 토큰을
 * 받아 준 뒤에만 보여 주는 값으로 쓴다.
 *
 * ⚠ **코드·공장이 없다고 등록을 막지 않는다.** 계약이 클레임 규격을 아직 갖지 않아 서버가
 * 무엇을 싣는지 보장되지 않는다. 막으면 대조라는 편의를 위해 등록이라는 필수를 잃는다.
 */
export const readTerminalClaims = (token: string): TerminalClaims | null => {
  const payload = readPayload(token);

  if (payload === null) {
    return null;
  }

  const terminalId = readId(payload.sub);

  if (terminalId === null) {
    return null;
  }

  const code = payload.terminalCode;

  return {
    terminalId,
    terminalCode: typeof code === 'string' && code.trim() !== '' ? code : null,
    plantId: readId(payload.plantId),
  };
};

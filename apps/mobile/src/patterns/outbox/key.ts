export interface KeyScope {
  /** 무엇을 하는가. 계약 오퍼레이션을 가리키는 이름이면 된다. */
  operation: string;
  /** 무엇에 대해 하는가. 대상이 없는 신규 생성이면 비운다. */
  target?: string | number | null;
}

const randomPart = (): string => {
  const buffer = new Uint8Array(8);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * 멱등키를 만든다.
 *
 * 서버는 같은 대상에 대한 같은 키만 중복으로 본다. 그래서 키에 대상과 오퍼레이션이 들어
 * 있어야 한다 — 본문만으로 만들면 다른 대상에 같은 값을 보낼 때 화면 부품이 같은 키를
 * 만들고, 뒤 요청이 조용히 사라지면서 화면은 성공을 본다.
 *
 * 무작위 조각을 넣는 이유는 반대쪽이다. 같은 대상에 같은 일을 일부러 두 번 하는 경우가
 * 있어, 키가 내용만으로 정해지면 두 번째가 첫 번째로 흡수된다.
 */
export const createIdempotencyKey = ({ operation, target }: KeyScope): string => {
  const scope =
    target === undefined || target === null ? operation : `${operation}:${String(target)}`;
  return `${scope}:${randomPart()}`;
};

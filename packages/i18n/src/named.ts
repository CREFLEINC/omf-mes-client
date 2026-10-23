/**
 * C-10 「이름 (코드)」 표기의 한 곳. 괄호 앞을 한 칸 띄운다. 이름이 비면 코드만 보인다.
 */
export const named = (name: string | null | undefined, code: string): string =>
  name === null || name === undefined || name.trim() === '' ? code : `${name} (${code})`;

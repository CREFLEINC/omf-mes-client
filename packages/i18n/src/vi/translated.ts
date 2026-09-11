/**
 * ko 는 as const 라 문자열이 리터럴 타입으로 굳는다. 그대로 쓰면 옮긴 값이 원문과 다르다는
 * 이유로 거절되므로, 키 구조와 함수 서명은 그대로 두고 문자열만 넓힌다.
 */
export type Translated<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends string
    ? string
    : { [K in keyof T]: Translated<T[K]> };

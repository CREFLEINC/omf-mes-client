/**
 * 지금 떠 있는 관리웹이 **어느 릴리스인가**(#1240).
 *
 * 값은 릴리스 파이프라인이 넣는다 — `front-image.yml` 이 푸시된 태그(`web-v0.3.8`)를
 * `VITE_APP_VERSION` 빌드 인자로 넘기고, vite 가 빌드 때 산출물에 박는다. 태그 형식은
 * 워크플로가 이미 `web-vX.Y.Z` 로 검사한 뒤라 여기서는 접두사만 뗀다.
 */
export type AppVersion = { kind: 'release'; version: string } | { kind: 'dev' };

const RELEASE_TAG = /^(?:web-)?(v\d+\.\d+\.\d+)$/;

/**
 * 빌드 인자 원문을 표기할 버전으로 푼다.
 *
 * ⛔ **형식 밖의 값을 그대로 찍지 않는다.** 비었거나(로컬 개발·인자 없이 한 빌드) 모양이
 * 다르면 「개발 빌드」로 둔다 — 빈칸이나 「알 수 없음」을 세우지 않는다(공유계약 G-9).
 */
export const toAppVersion = (raw: unknown): AppVersion => {
  const match = typeof raw === 'string' ? RELEASE_TAG.exec(raw.trim()) : null;

  return match?.[1] === undefined ? { kind: 'dev' } : { kind: 'release', version: match[1] };
};

/** ⭐ 렌더 때 읽는다 — 모듈 최상위에서 굳히면 시험이 `vi.stubEnv` 로 값을 바꿀 수 없다. */
export const readAppVersion = (): AppVersion => toAppVersion(import.meta.env.VITE_APP_VERSION);

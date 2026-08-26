/**
 * `pop://` 요청 경로를 렌더러 폴더 안의 실제 파일로 푼다.
 *
 * 배선이 아니라 **판단**이다 — 경로 탈출을 막고, 자산과 SPA 경로를 갈라야 한다.
 * 그래서 Electron 없이 감지기로 잴 수 있게 순수 함수로 둔다.
 */
import { isAbsolute, join, relative } from 'node:path';

export type Resolved =
  | { kind: 'file'; path: string }
  | { kind: 'fallback'; path: string }
  | { kind: 'forbidden' }
  | { kind: 'not-found' };

export interface ResolveInput {
  rendererDir: string;
  /** `pop://app/...`의 pathname. 이미 URL 파서를 거친 값이다. */
  pathname: string;
  /** 그 경로에 파일이 실제로 있는지. 호출부가 `existsSync`를 넘긴다. */
  existsSync: (path: string) => boolean;
  /** 경로 계산을 어느 플랫폼 규칙으로 할지. 기본은 실행 중인 플랫폼. */
  path?: { join: typeof join; relative: typeof relative; isAbsolute: typeof isAbsolute };
}

/**
 * 자산으로 볼 것인가 — 마지막 구획에 확장자가 있으면 자산이다.
 *
 * 자산과 SPA 경로를 가르는 이유: 없는 자산에 index.html을 돌려주면 브라우저가 JS를 기대한
 * 자리에서 HTML을 받아 **MIME 오류로 둔갑한다.** 「스크립트가 없다」가 아니라 엉뚱한 증상이
 * 되어, 이 셸이 두 번 겪은 「조용한 빈 화면」과 같은 부류를 다시 만든다.
 */
export function looksLikeAsset(pathname: string): boolean {
  const last = pathname.split('/').pop() ?? '';
  return /\.[A-Za-z0-9]+$/.test(last);
}

export function resolveRendererPath({
  rendererDir,
  pathname,
  existsSync,
  path = { join, relative, isAbsolute },
}: ResolveInput): Resolved {
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.join(rendererDir, relativePath);

  // ⛔ 문자열 prefix 비교(`startsWith`)로 판정하지 않는다 — 구분자를 붙이지 않으면
  //    `renderer-secret` 같은 **형제 디렉터리**가 통과한다(Windows 백슬래시 경로에서 실증).
  //    경로 관계는 `relative`로 판정해야 옳다.
  const rel = path.relative(rendererDir, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return { kind: 'forbidden' };

  if (existsSync(target)) return { kind: 'file', path: target };

  // 없는 자산은 404로 돌려준다. SPA 경로만 index.html로 되돌린다.
  if (looksLikeAsset(relativePath)) return { kind: 'not-found' };

  const index = path.join(rendererDir, 'index.html');
  return existsSync(index) ? { kind: 'fallback', path: index } : { kind: 'not-found' };
}

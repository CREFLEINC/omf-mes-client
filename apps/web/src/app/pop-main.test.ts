import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { popRoutes } from '../routes/pop';

/**
 * **POP 진입점의 배선**을 지킨다 — 이 파일이 없으면 아래 셋이 지워져도 타입 검사도 빌드도
 * 통과하고, 증상은 「설치본을 켜니 엉뚱한 화면이 뜬다」로 **단말에서만** 나타난다.
 *
 * ⚠ **모듈을 불러 들이지 않고 원문을 읽는다.** `pop-main.tsx`를 import 하면 라우트 표를 통해
 * 화면 전부가 딸려 오고, `createRoot`가 `#root` 없는 환경에서 던진다. 여기서 지키려는 것은
 * **배선의 존재**이지 앱의 동작이 아니다(`main.test.ts`와 같은 사정·같은 방법).
 */
/* 시험은 앱 패키지(`apps/web`)를 작업 디렉터리로 돌아간다. */
const source = readFileSync(resolve(process.cwd(), 'src/app/pop-main.tsx'), 'utf8');
const html = readFileSync(resolve(process.cwd(), 'pop.html'), 'utf8');

const entryPath = /const POP_ENTRY_PATH = '([^']+)'/.exec(source)?.[1];

describe('POP 진입점 배선', () => {
  it('POP 라우트 표를 싣는다 — 관리웹 라우트 표를 싣지 않는다', () => {
    expect(source).toMatch(/\.\.\.popRoutes/);
    expect(source).not.toMatch(/appRouter/);
  });

  it('진입 화면 주소가 POP 라우트 표에 실제로 있다', () => {
    expect(entryPath).toBeDefined();
    expect(popRoutes.map(({ path }) => path)).toContain(entryPath);
  });

  it('루트와 알 수 없는 주소를 진입 화면으로 보낸다', () => {
    expect(source).toMatch(/path: '\/'[\s\S]{0,80}POP_ENTRY_PATH/);
    expect(source).toMatch(/path: '\*'[\s\S]{0,80}POP_ENTRY_PATH/);
  });

  it('진입 문서가 이 파일을 가리킨다', () => {
    expect(html).toMatch(/src="\/src\/app\/pop-main\.tsx"/);
  });
});

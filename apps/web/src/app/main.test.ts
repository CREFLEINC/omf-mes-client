import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * **진입점이 제목 맞추기를 실제로 «건다»는 것**을 지킨다.
 *
 * ⛔ 이 잣대가 없으면 `main.tsx`의 `syncDocumentTitle(appRouter)` 한 줄이 지워져도 타입
 * 검사도 시험도 빌드도 통과한다(실측 — 독립 검증에서 그 뮤턴트가 살아남았다). 모듈은 여전히
 * 옳고 아무도 그것을 부르지 않을 뿐이라, 증상은 「POP 주소인데 관리웹 제목이 뜬다」로만
 * 나타나고 그것도 사람 눈에만 보인다.
 *
 * ⚠ **왜 모듈을 불러 들이지 않고 원문을 읽나.** `main.tsx`를 import 하면 라우트 표를 통해
 * 화면 전부가 모듈 그래프에 딸려 와 시험 하나가 수 초를 먹는다(5초 상한을 넘겨 실패했다).
 * 여기서 지키려는 것은 **배선 한 줄의 존재**이지 앱의 동작이 아니다 — 동작은
 * `document-title.test.ts`가 잰다.
 */
/* 시험은 앱 패키지(`apps/web`)를 작업 디렉터리로 돌아간다. */
const mainSource = readFileSync(resolve(process.cwd(), 'src/app/main.tsx'), 'utf8');

describe('진입점 배선', () => {
  it('라우터에 제목 맞추기를 건다', () => {
    expect(mainSource).toMatch(/syncDocumentTitle\(\s*appRouter\s*\)/);
  });

  it('화면을 세우기 «전에» 건다 — 첫 화면부터 제목이 맞아야 한다', () => {
    const wiring = mainSource.search(/syncDocumentTitle\(\s*appRouter\s*\)/);
    const render = mainSource.search(/createRoot\(/);

    expect(wiring).toBeGreaterThan(-1);
    expect(render).toBeGreaterThan(-1);
    expect(wiring).toBeLessThan(render);
  });
});

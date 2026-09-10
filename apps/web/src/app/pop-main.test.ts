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

  /*
   * ⭐ **이 자리는 한 번 뒤집혔다.** 후보를 공급할 근거가 없다고 보아 배포 셸에서 화면 이동을
   * «빼는» 것을 지키던 시험이었다(PR #926). 근거는 계약에 있었다 — 세션 권한 배열이 화면
   * 코드와 1:1 이고, 계약이 「403 을 받아 보고 아는 것이 아니라 «누르기 전에» 판정한다」고
   * 못박았다. 그래서 지금은 **실려 있는 것**을 지킨다(#949 · 공유계약 G-34).
   */
  it('배포 셸에 업무용 화면 이동을 싣는다', () => {
    expect(source).toContain('PopScreenNavButton');
  });

  it('진입 문서가 이 파일을 가리킨다', () => {
    expect(html).toMatch(/src="\/src\/app\/pop-main\.tsx"/);
  });

  /*
   * ⭐ **단말 토큰을 «읽은 뒤에» 화면을 세운다**(#999). 설계가 POP 요청을 단말 토큰으로
   *    인증하도록 정했는데, 셸에서 읽어 오는 것은 비동기이고 요청에 헤더를 붙이는 자리는
   *    동기다. 순서가 뒤집히면 첫 조회들이 토큰 없이 나가 거절되고, 화면은 잠깐
   *    「단말이 확인되지 않았습니다」를 보였다가 스스로 낫는 것처럼 움직인다 — 진짜 미등록
   *    단말과 구분되지 않는다.
   *
   * ⛔ **주석만으로는 지켜지지 않는다.** `readTerminalToken().then(mount)` 를
   *    `readTerminalToken(); mount();` 로 바꿔도 타입 검사·의존 검사·전체 시험이 전부
   *    초록이고, 증상은 현장 단말에서만 난다(독립 검증 F-1 실측).
   */
  it('단말 토큰을 읽은 뒤에 화면을 세운다', () => {
    expect(source).toMatch(/readTerminalToken\(\)\s*\.then\(\s*mount\s*\)/u);
  });
});

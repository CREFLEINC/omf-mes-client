import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * POP 팝업은 **바깥을 눌러 닫히지 않는다**(사용자 지시 2026-09-10 · #1005).
 *
 * ⭐ **왜 파일을 읽어 재는가.** 이것은 화면 하나의 동작이 아니라 **셸 전체의 규율**이다.
 * 팝업마다 시험을 세우면 새로 만드는 팝업이 그 시험을 함께 만들지 않는 한 규율이 조용히
 * 샌다 — 실제로 그렇게 다섯 자리가 빠져 있었고, 그중 넷은 바닥에 [닫기]를 두고도 스크림
 * 클릭이 그 단추를 대신하고 있었다.
 *
 * ⭐ **터치 단말이라서 문제가 된다.** 팝업이 화면 대부분을 덮어 손이 스치기 쉽고, 장갑 낀
 * 손가락이 가장자리를 짚는 일이 잦다. 닫히면 고르려던 항목과 함께 검색어·쪽 위치까지
 * 사라져 「누른 적 없는데 닫힌다」가 된다.
 *
 * ⚠ **설계는 이 자리를 정하지 않았다.** 공유계약 G-34 는 팝업의 «내용»만 정하고 닫는 방법을
 *   적지 않았다. 회신이 오면 그때 맞춘다.
 *
 * ⛔ **관리웹은 대상이 아니다.** 마우스로 쓰는 화면이고 소관도 다르다 — 아래 목록은 POP
 *    라우트가 세우는 화면과 `pop-` 접두 패턴으로 한정한다.
 *
 * ⚠ **무엇을 못 잡는지 적어 둔다.** 이 시험은 「`<Dialog` 를 쓰는 POP 파일에 그 설정이
 *   있는가」까지만 본다 — 한 파일에 팝업이 둘인데 하나에만 붙은 경우는 잡지만(개수를 함께
 *   센다), 변수로 우회해 넘기는 것은 잡지 못한다. 막으려는 것은 우회가 아니라 실수다.
 */

/** 시험은 앱 패키지(`apps/web`)를 작업 디렉터리로 돈다. */
const SOURCE_ROOT = resolve(process.cwd(), 'src');

/**
 * POP 라우트가 세우는 화면 슬라이스. `routes/pop.tsx` 가 부르는 것들이다.
 *
 * ⚠ **화면이 늘면 여기 더한다.** 손목록이라 갱신을 강제하는 것이 없으므로, 아래 「목록이
 *   비지 않았다」 시험이 훑기가 조용히 망가지는 것만 막아 준다.
 */
const POP_SCREEN_DIRS = [
  'worker-assignment',
  'work-start',
  'work-precheck-gate',
  'material-input-scan',
  'tool-usage',
  'emergency-work-order-field',
  'downtime-register',
  'pop-material-lot-label',
  'pqc-inspection',
  'goods-issue-qr',
  'rework-result-register',
  'packing-label-reprint',
  'production-result',
  'packing-work',
  'packing-result',
  'shipping-packing-label',
  'repack-label-issue',
  'running-change',
  'work-hold-register',
];

const listFiles = (directory: string): string[] => {
  let entries;

  try {
    entries = readdirSync(directory, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries.flatMap((entry) => {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) return listFiles(path);
    if (!/\.tsx?$/u.test(entry.name)) return [];
    if (/\.test\.tsx?$/u.test(entry.name)) return [];

    return [path];
  });
};

/** 주석을 지운 소스. 설명 주석이 설정을 그대로 인용해 거짓 통과하는 것을 막는다. */
const withoutComments = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/[^\n]*/gu, '');

const popFiles = [
  ...POP_SCREEN_DIRS.flatMap((dir) => listFiles(join(SOURCE_ROOT, 'screens', dir))),
  ...listFiles(join(SOURCE_ROOT, 'patterns')).filter((path) => /\/pop-[^/]+$/u.test(path)),
];

const countOf = (source: string, needle: RegExp): number => source.match(needle)?.length ?? 0;

const dialogFiles = popFiles
  .map((path) => ({ path, source: withoutComments(readFileSync(path, 'utf8')) }))
  .filter(({ source }) => countOf(source, /<Dialog[\s>]/gu) > 0);

describe('POP 팝업은 바깥을 눌러 닫히지 않는다 (#1005)', () => {
  /*
   * ⛔ **훑어서 하나도 못 찾으면 이 시험은 아무것도 재지 못한다.** 경로가 바뀌었거나
   *    정규식이 어긋났는지를 여기서 가른다.
   */
  it('POP 팝업을 실제로 찾아낸다', () => {
    expect(dialogFiles.length).toBeGreaterThan(0);
  });

  it.each(dialogFiles.map(({ path }) => path))('%s 의 팝업마다 설정이 붙어 있다', (path) => {
    const entry = dialogFiles.find((candidate) => candidate.path === path);

    expect(entry).toBeDefined();
    expect(countOf(entry?.source ?? '', /closeOnBackdropClick=\{false\}/gu)).toBe(
      countOf(entry?.source ?? '', /<Dialog[\s>]/gu),
    );
  });
});

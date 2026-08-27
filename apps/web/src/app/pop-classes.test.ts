import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * POP 배치 클래스 감지기 — **쓰는 곳과 정의한 곳이 어긋나지 않는지** 본다.
 *
 * 두 방향으로 조용히 틀어진다. 실측으로 둘 다 겪었다 —
 *
 * | 방향 | 무엇이 일어나나 |
 * | --- | --- |
 * | 정의 없이 쓴다 | 클래스가 아무것도 하지 않아 **간격이 0**이 된다. 화면은 뜨므로 게이트가 전부 초록이다 |
 * | 쓰는 데 없이 정의한다 | 소비자 없는 CSS가 남아 맞는지 틀린지 확인할 방법이 없다 |
 *
 * 앞의 것으로 프린터 이름과 상태 표식이 한 덩어리로 붙어 나왔다. 렌더 테스트는 이것을 잡지
 * 못한다 — `vitest.config.ts`가 `css: false`라 스타일이 테스트에 도달하지 않는다.
 */

const WEB_ROOT = resolve(process.cwd(), 'src');
/**
 * 규칙만 남긴 CSS — **주석을 걷어낸다.**
 *
 * `app.css` 머리의 클래스 색인이 같은 이름을 주석으로 적고 있어, 원문 그대로 훑으면 규칙을
 * 통째로 지워도 「정의돼 있다」로 통과한다(뮤테이션으로 확인했다).
 */
const CSS_RULES = readFileSync(join(WEB_ROOT, 'app/app.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//gu,
  '',
);

/** `pop-touch-${grade}` 처럼 조각으로 만들어지는 이름. 이 파일이 등급을 붙여 완성한다. */
const TOUCH_MODULE = 'patterns/pop-touch.ts';

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);

    if (statSync(path).isDirectory()) return sourceFiles(path);

    return /\.tsx?$/u.test(entry) && !/\.test\.tsx?$/u.test(entry) ? [path] : [];
  });

/**
 * 소스가 실제로 쓰는 `pop-` 클래스 이름.
 *
 * **`className` 안에서만 찾는다** — 파일 이름(`./pop-layout`)과 모듈 경로가 같은 낱말이라
 * 파일 전체를 훑으면 그것들이 클래스로 잡힌다.
 *
 * 조각으로 끝나는 것(`pop-touch-`)은 뺀다 — 등급을 붙여 완성되는 이름이다.
 */
const usedClassNames = (): Set<string> => {
  const used = new Set<string>();

  for (const path of sourceFiles(WEB_ROOT)) {
    if (path.endsWith(TOUCH_MODULE)) continue;

    const source = readFileSync(path, 'utf8');

    for (const [, quoted, templated] of source.matchAll(
      /className=(?:"([^"]*)"|\{`([^`]*)`\})/gu,
    )) {
      for (const [name] of (quoted ?? templated ?? '').matchAll(/pop-[a-z][a-z-]*/gu)) {
        if (!name.endsWith('-')) used.add(name);
      }
    }
  }

  return used;
};

/**
 * 선택자로 쓰인 적이 있는지 본다.
 *
 * 줄 첫머리만 보지 않는다 — `.pop-printer-name > .pop-printer-label` 처럼 자손 선택자로만
 * 정의되는 것이 있다. 뒤에 이름 문자가 이어지지 않는지까지 봐야 `pop-touch`가
 * `pop-touch-normal`에 걸리지 않는다.
 */
const isDefined = (name: string): boolean =>
  new RegExp(`\\.${name}(?![a-z-])`, 'u').test(CSS_RULES);

describe('POP 배치 클래스', () => {
  it('화면이 쓰는 클래스가 CSS에 전부 정의돼 있다 — 없으면 간격이 조용히 0이 된다', () => {
    const missing = [...usedClassNames()].filter((name) => !isDefined(name));

    expect(missing).toEqual([]);
  });

  it('CSS에 정의한 클래스를 쓰는 곳이 있다 — 소비자 없는 CSS는 맞는지 확인할 수 없다', () => {
    const used = usedClassNames();
    const defined = [...CSS_RULES.matchAll(/\.(pop-[a-z][a-z-]*)/gu)].flatMap(([, name]) =>
      name === undefined ? [] : [name],
    );

    // 터치 클래스는 `popTouchClass`가 이름을 조립하므로 `className`에 낱말로 나타나지 않는다.
    const orphans = defined.filter((name) => !used.has(name) && !name.startsWith('pop-touch'));

    expect(orphans).toEqual([]);
  });
});

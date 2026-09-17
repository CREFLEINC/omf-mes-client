import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 디자인 시스템이 **제 기본값을 한국어로 들고 있는 자리**의 감지기(#1131).
 *
 * `@crefle/web-ui` 의 몇 부품은 「닫기」·「지우기」·「탐색 경로」를 안에 한국어로 박아 두고,
 * 그 자리를 **밖에서 받는 프롭**을 함께 열어 두었다. 우리가 넘기지 않으면 관리웹을
 * 베트남어로 열어도 이 이름들만 한국어로 선다 — **우리 소스에는 그 글자가 없으므로
 * 「박힌 한국어」 감지기(`vi-messages.test.ts`)로는 잡히지 않는다.**
 *
 * 그래서 무엇이 렌더됐는지가 아니라 **프롭을 넘겼는지**를 본다. 화면을 렌더해 이름으로 찾는
 * 방식은 여기서 쓸 수 없다 — 우리가 넘기는 한국어가 부품의 기본값과 **글자까지 같아서**
 * (일부러 그렇게 두었다. 한국어 화면은 하나도 달라지지 않아야 한다) 프롭을 지워도 한국어
 * 회차는 초록으로 남는다. 베트남어 회차는 `shell-vi-labels.test.tsx` 가 셸 한 곳에서 잰다.
 *
 * ⚠ **POP 화면은 모집단이 아니다.** POP 은 한국어 단말이라(2026-09-13 기준 베트남어 범위
 * 밖) 부품 기본값이 그대로 서도 된다. 뒷날 POP 을 옮기기로 하면 이 목록을 지운다.
 */

const WEB_SRC = resolve(process.cwd(), 'src');

/** POP 화면이 사는 폴더. `routes/pop.tsx` 가 데려가는 것들이다. */
const POP_SCREENS = [
  'downtime-register',
  'emergency-work-order-field',
  'goods-issue-qr',
  'material-input-scan',
  'packing-label-reprint',
  'packing-result',
  'packing-work',
  'pop-material-lot-label',
  'pqc-inspection',
  'production-result',
  'repack-label-issue',
  'rework-result-register',
  'running-change',
  'shipping-unit',
  'tool-usage',
  'work-hold-register',
  'work-start',
  'worker-assignment',
] as const;

/**
 * 부품과, 그 부품에 넘겨야 하는 프롭.
 *
 * `onlyWith` 가 있는 줄은 **그 프롭이 함께 있을 때만** 따진다 — 닫기 단추는 `onDismiss` 를
 * 넘긴 배너에만 서므로, 없는 배너까지 잡으면 쓰이지 않는 이름을 넘기게 된다.
 */
const RULES = [
  { tag: 'Breadcrumb', prop: 'aria-label' },
  { tag: 'SearchInput', prop: 'clearLabel' },
  { tag: 'AlertBanner', prop: 'dismissLabel', onlyWith: 'onDismiss' },
] as const;

const HANGUL = /[가-힣]/;

const isPopScreen = (rel: string): boolean => {
  const parts = rel.split(sep);

  return parts[0] === 'screens' && POP_SCREENS.some((name) => name === parts[1]);
};

/**
 * 훑을 파일. 시험 파일과 `ds-candidates/`(부품 후보라 부품처럼 제 기본값을 갖는다)는 뺀다.
 */
const isTarget = (rel: string): boolean =>
  rel.endsWith('.tsx') &&
  !rel.endsWith('.test.tsx') &&
  !rel.split(sep).includes('ds-candidates') &&
  !isPopScreen(rel);

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);

    return statSync(full).isDirectory() ? walk(full) : [full];
  });

const TARGETS = walk(WEB_SRC)
  .map((full) => relative(WEB_SRC, full))
  .filter(isTarget)
  .sort();

/**
 * `<Tag …>` 의 **여는 태그**를 잘라 낸다.
 *
 * ⚠ 중괄호 깊이를 세면서 지난다 — 프롭 값 안의 `=>` 나 비교 연산자를 태그의 끝으로 읽으면
 * 태그가 거기서 잘려 뒤쪽 프롭을 못 본다(`onDismiss={() => …}` 가 바로 그 모양이다).
 */
const openingTags = (source: string, tag: string): string[] => {
  const found: string[] = [];
  const pattern = new RegExp(`<${tag}(?=[\\s/>])`, 'g');
  let match = pattern.exec(source);

  while (match !== null) {
    let index = match.index + match[0].length;
    let depth = 0;

    while (index < source.length) {
      const char = source[index];

      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      else if (depth === 0 && char === '>') break;

      index += 1;
    }

    found.push(source.slice(match.index, index + 1));
    match = pattern.exec(source);
  }

  return found;
};

const hasProp = (openingTag: string, prop: string): boolean =>
  new RegExp(`(?<![\\w-])${prop}=`).test(openingTag);

const propValue = (openingTag: string, prop: string): string => {
  const match = new RegExp(`(?<![\\w-])${prop}=(\\{[^}]*\\}|"[^"]*")`).exec(openingTag);

  return match?.[1] ?? '';
};

interface Offence {
  file: string;
  tag: string;
  prop: string;
}

const offences = (predicate: (openingTag: string, prop: string) => boolean): Offence[] =>
  TARGETS.flatMap((rel) => {
    const source = readFileSync(join(WEB_SRC, rel), 'utf8');

    return RULES.flatMap(({ tag, prop, ...rest }) => {
      const onlyWith = 'onlyWith' in rest ? rest.onlyWith : undefined;

      return openingTags(source, tag)
        .filter((openingTag) => onlyWith === undefined || hasProp(openingTag, onlyWith))
        .filter((openingTag) => predicate(openingTag, prop))
        .map(() => ({ file: rel, tag, prop }));
    });
  });

describe('디자인 시스템 부품의 한국어 기본값', () => {
  /** 모집단이 비면 감지기가 조용히 통과한다 — 훑을 파일이 실제로 있는지부터 잰다. */
  it('훑을 화면 파일이 있다', () => {
    expect(TARGETS.length).toBeGreaterThan(100);
  });

  it('관리웹의 모든 자리가 이름 프롭을 넘긴다', () => {
    expect(offences((openingTag, prop) => !hasProp(openingTag, prop))).toEqual([]);
  });

  /**
   * 넘기더라도 **그 자리에 한국어를 적으면** 같은 일이 벌어진다 — 부품 기본값을 우리 소스로
   * 옮겨 적은 셈이라 베트남어 회차에서 여전히 한국어가 선다. 문구 슬라이스를 거치게 한다.
   */
  it('넘기는 이름을 화면에 한국어로 적지 않는다', () => {
    expect(offences((openingTag, prop) => HANGUL.test(propValue(openingTag, prop)))).toEqual([]);
  });

  /**
   * 알림 영역의 이름은 **셸 한 곳**에서만 정해진다(`ToastProvider`). 화면마다 세우는 부품이
   * 아니라 위 규칙에 담지 않고 그 자리를 직접 잰다 — 시험 하네스도 같은 부품을 세우므로
   * 규칙에 넣으면 하네스까지 잡는다.
   */
  it('셸의 알림 영역이 이름 프롭을 넘긴다', () => {
    const source = readFileSync(join(WEB_SRC, 'app', 'providers.tsx'), 'utf8');
    const [openingTag = ''] = openingTags(source, 'ToastProvider');

    expect(hasProp(openingTag, 'label')).toBe(true);
    expect(HANGUL.test(propValue(openingTag, 'label'))).toBe(false);
  });
});

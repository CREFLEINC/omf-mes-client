import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..');

const filesUnder = (root: string, test: (path: string) => boolean): string[] => {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (test(path)) {
        found.push(path);
      }
    }
  };
  walk(root);
  return found;
};

/** 규칙마다 선택자와 그 안의 선언들. 주석은 걷는다 - 주석 속 토큰 이름은 쓰는 것이 아니다. */
const rulesIn = (css: string): { selector: string; declarations: string[] }[] =>
  [...css.replaceAll(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1]!.trim().replaceAll(/\s+/g, ' '),
    declarations: match[2]!
      .split(';')
      .map((declaration) => declaration.trim())
      .filter((declaration) => declaration !== ''),
  }));

/** 브랜드 빨강 계열. 바탕 · 연한 판 · 그 위 글자 · 글자 빨강. */
const BRAND = /var\(--(primary|primary-container|on-primary-container|primary-text)\)/;

/*
 * 빨강을 써도 되는 자리. 주 단추는 디자인 시스템이 그리므로 여기 없다 - 우리 CSS 가 빨강을 쓰는
 * 곳은 이것뿐이어야 한다. 새 자리를 더하려면 왜 그 자리가 주 단추만큼 먼저 눈에 걸려야 하는지를
 * 사용자와 정한 뒤 여기에 적는다.
 */
const ALLOWED = [
  /* 홈의 「이어서 하기」 - 적다 만 것이 있다는 사실(사용자 결정 2026-10-21). */
  'app/shell-home.css :: .shell-home__resume-icon',
  'app/shell-home.css :: .shell-home__resume-card .shell-home__text small',
];

/**
 * 빨강은 주 단추와 진짜 오류에만(사용자 결정 2026-10-21, 개편 제안 v2 ④).
 *
 * 아이콘 · 링크 · 건수 · 키패드 숫자가 하나씩 빨강으로 늘어 한 화면에 열 곳이 넘었고, 화면이
 * 경고처럼 읽혀 정작 눌러야 할 주 단추가 묻혔다. 하나씩 보면 다 그럴듯한 강조라, 시험이 막지
 * 않으면 다시 는다.
 */
describe('빨강 한정', () => {
  it('브랜드 빨강은 정해 둔 자리와 초점 테두리에만 쓴다', () => {
    const offenders: string[] = [];

    for (const css of filesUnder(SRC, (path) => path.endsWith('.css'))) {
      const name = css.slice(SRC.length + 1);

      for (const { selector, declarations } of rulesIn(readFileSync(css, 'utf-8'))) {
        if (selector.startsWith('@')) {
          continue;
        }

        /* 키보드로 옮겨 다닐 때의 초점 테두리는 강조가 아니라 위치 표시다. */
        if (selector.split(',').every((part) => part.includes(':focus'))) {
          continue;
        }

        if (ALLOWED.includes(`${name} :: ${selector}`)) {
          continue;
        }

        for (const declaration of declarations) {
          if (BRAND.test(declaration) && !declaration.startsWith('--')) {
            offenders.push(`${name} :: ${selector} :: ${declaration}`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  /*
   * 디자인 시스템은 외곽선 · 글자 단추와 고른 항목을 글자 빨강으로 그린다. 이 한 줄이 그것을 화면
   * 전체에서 차콜로 돌린다 - 빠지면 스무 화면에 빨간 글자가 한꺼번에 돌아온다.
   */
  it('디자인 시스템의 글자 빨강을 차콜로 돌린다', () => {
    const rules = rulesIn(readFileSync(join(HERE, 'app.css'), 'utf-8'));

    expect(
      rules.some(
        (rule) =>
          rule.selector === 'body' &&
          rule.declarations.includes('--primary-text: var(--on-surface)'),
      ),
    ).toBe(true);
  });
});

/*
 * 이 셸의 겉을 입힌 부품과 그것이 감싸는 디자인 시스템 부품.
 *
 * 단추의 겉(12px 모서리 · 큰 글씨 · 차콜 보조 단추)과 카드의 겉(작업대 위 흰 카드 · 누르는 카드의
 * 테두리)은 감싼 부품이 붙이는 클래스와 기본값으로만 걸린다. 디자인 시스템 부품을 바로 쓰면 그
 * 하나만 알약에 빨간 글씨로, 또는 바탕에 녹은 카드로 돌아가고, 화면을 열어 보기 전에는 드러나지
 * 않는다.
 */
const WRAPPED: { name: string; wrapper: string }[] = [
  { name: 'Button', wrapper: join(SRC, 'patterns', 'button.tsx') },
  { name: 'Card', wrapper: join(SRC, 'patterns', 'card.tsx') },
];

describe('부품 겉', () => {
  for (const { name, wrapper } of WRAPPED) {
    it(`디자인 시스템 ${name} 을 바로 가져다 쓰지 않는다`, () => {
      const offenders = filesUnder(
        SRC,
        (path) => /\.tsx?$/.test(path) && !path.includes('.test.') && path !== wrapper,
      )
        .filter((path) =>
          [
            ...readFileSync(path, 'utf-8').matchAll(/import \{([^}]*)\} from '@crefle\/web-ui'/g),
          ].some((match) =>
            match[1]!
              .split(',')
              .map((each) => each.trim())
              .includes(name),
          ),
        )
        .map((path) => path.slice(SRC.length + 1));

      expect(offenders).toEqual([]);
    });
  }
});

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface ScreenTitleStore {
  title: string | null;
  setTitle: (title: string | null) => void;
}

const ScreenTitleContext = createContext<ScreenTitleStore | null>(null);

export const ScreenTitleProvider = ({ children }: { children: ReactNode }) => {
  const [title, setTitle] = useState<string | null>(null);

  return (
    <ScreenTitleContext.Provider value={{ title, setTitle }}>
      {children}
    </ScreenTitleContext.Provider>
  );
};

export const useCurrentScreenTitle = (): string | null =>
  useContext(ScreenTitleContext)?.title ?? null;

/**
 * 화면 제목을 앱바로 넘긴다.
 *
 * 좁은 단말에서 본문은 제목까지 담을 만큼 넉넉하지 않고, 앱바는 어차피 자리를 차지하고
 * 있으면서 비어 있다. 화면을 떠나면 앞 화면의 제목이 남지 않게 지운다.
 */
export const useScreenTitle = (title: string): void => {
  const store = useContext(ScreenTitleContext);
  const setTitle = store?.setTitle;

  useEffect(() => {
    if (setTitle === undefined) {
      return;
    }

    setTitle(title);
    return () => {
      setTitle(null);
    };
  }, [setTitle, title]);
};

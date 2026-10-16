declare module 'naics' {
  export interface Industry {
    code: string;
    title: string;
    parent(): Industry | undefined;
  }

  export const Industry: {
    codes(): IterableIterator<Industry>;
  };
}
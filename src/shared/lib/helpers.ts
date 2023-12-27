export const timeout = (sec: number): Promise<null> =>
  new Promise((ok) => setTimeout(ok, sec));

export const markdownParsable = (str: string) => {
  const symbolsToEscape = [
    '_',
    '-',
    '=',
    '*',
    '.',
    '`',
    '~',
    '>',
    '#',
    '+',
    '!',
    '|',
    '[',
    ']',
    '(',
    ')',
    '{',
    '}',
  ];
  let result = str;

  for (const symbol of symbolsToEscape) {
    const escapedSymbol = symbol.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    result = result.replace(new RegExp(escapedSymbol, 'g'), `\\${symbol}`);
  }
  return result;
};

export const compactNumber = Intl.NumberFormat('en', { notation: 'compact' });

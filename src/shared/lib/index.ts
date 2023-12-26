import axios from 'axios';

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

export const bytesToMegaBytes = (bytes: number) =>
  Number((bytes / (1024 * 1024)).toFixed(0));

export const calcLinkSize = async (url: string, header = 'Content-Length') => {
  const res = await axios.head(url);
  if (!(header in res.headers || !Number.isNaN(Number(res.headers[header]))))
    return null;
  return bytesToMegaBytes(Number(res.headers[header]));
};

export const compactNumber = Intl.NumberFormat('en', { notation: 'compact' });

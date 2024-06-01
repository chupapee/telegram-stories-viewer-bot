import { StoriesModel } from 'controllers/download-stories';

export const timeout = (sec: number): Promise<null> =>
  new Promise((ok) => setTimeout(ok, sec));

export function chunkMediafiles(files: ReturnType<StoriesModel>) {
  return files.reduce(
    (acc: Array<ReturnType<StoriesModel>>, curr) => {
      const tempAccWithCurr = [...acc[acc.length - 1], curr];
      if (tempAccWithCurr.length === 10 || sumOfSizes(tempAccWithCurr) >= 50) {
        acc.push([curr]);
        return acc;
      }
      acc[acc.length - 1].push(curr);
      return acc;
    },
    [[]]
  );
}

function sumOfSizes(list: { bufferSize?: number }[]) {
  return list.reduce((acc, curr) => {
    if (curr.bufferSize) {
      return acc + curr.bufferSize;
    }
    return acc;
  }, 0);
}

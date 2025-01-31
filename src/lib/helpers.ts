import { StoriesModel } from 'controllers/download-stories';

const MAX_STORIES_SIZE = 45;

export const timeout = (sec: number): Promise<null> =>
  new Promise((ok) => setTimeout(ok, sec));

export function chunkMediafiles(files: StoriesModel) {
  return files.reduce(
    (acc: Array<StoriesModel>, curr) => {
      const tempAccWithCurr = [...acc[acc.length - 1], curr];
      if (
        tempAccWithCurr.length === 10 ||
        sumOfSizes(tempAccWithCurr) >= MAX_STORIES_SIZE
      ) {
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

export function getRandomArrayItem<T>(arr: T[], prevValue?: T): T {
  const filteredArr = arr.filter((value) => value !== prevValue);
  const randomIndex = Math.floor(Math.random() * filteredArr.length);
  return filteredArr[randomIndex];
}

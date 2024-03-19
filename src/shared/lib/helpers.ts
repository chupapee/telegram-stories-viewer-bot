export const timeout = (sec: number): Promise<null> =>
  new Promise((ok) => setTimeout(ok, sec));

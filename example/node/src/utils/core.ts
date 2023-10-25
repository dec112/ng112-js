export function tryGet(obj: any, ...path: Array<string>) {
  path = path || [];
  return path.reduce((prev, curr) => {
    if (!prev) return undefined;

    return prev[curr];
  }, obj);
}

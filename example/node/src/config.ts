import fs from 'fs';
import path from 'path';
import findRoot from 'find-root';
import { tryGet } from './utils/core';

const readConfigJSON = (fileName: string) => {
  const contents = fs.readFileSync(
    path.join(findRoot(path.resolve()), 'config', `${fileName}.json`),
    {
      encoding: 'utf-8',
    }
  );

  return JSON.parse(contents);
};

const config = {};

export const initialize = () => {
  const variant =
    process.env['NODE_ENV'] === 'production' ? 'production' : 'development';

  Object.assign(config, readConfigJSON(`config.${variant}`));
};

export const get = <T = string>(...path: string[]): T | undefined =>
  tryGet(config, ...path);

export const Config = {
  initialize,
  get,
};

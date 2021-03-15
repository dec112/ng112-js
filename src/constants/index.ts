import { getPackageInfo } from "../utils/package-utils"

const packageInfo = getPackageInfo();

export const USER_AGENT = `${packageInfo.name} ${packageInfo.version} with JsSIP`;
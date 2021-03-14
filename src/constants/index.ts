import { getDependencyInfo, getPackageInfo } from "../utils/package-utils"

const packageInfo = getPackageInfo();
const jssipVersion = getDependencyInfo('jssip')?.version ?? 'unknown';

export const USER_AGENT = `${packageInfo.name} ${packageInfo.version} JsSIP ${jssipVersion}`;
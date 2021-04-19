import { getPackageInfo } from "../utils/package-utils"
import { version as jssipVersion } from "jssip";

const packageInfo = getPackageInfo();

export const USER_AGENT = `${packageInfo.name} ${packageInfo.version}, JsSIP ${jssipVersion}`;
import { getPackageInfo } from "../utils/package-utils"
import { version as jssipVersion } from "jssip";
import { currentAgent, SupportedAgent } from "../models/sip-agent";

const packageInfo = getPackageInfo();

let agentInfo: string = 'unknown version';

if (currentAgent === SupportedAgent.jssip)
  agentInfo = jssipVersion;
else if (currentAgent === SupportedAgent.sipjs)
  // FIXME: Currently we have problems with jest testing also sip.js
  // somehow it does not like how sip.js exports their defaults
  // especially when it comes to the version number that is exported by sip.js
  // We shall look into this as it prevents us from automated testing with sip.js
  // That's why we currently do not import it via ES modules but via CommonJs import
  // this allows us to circumvent this error
  agentInfo = require('sip.js').version;

export const USER_AGENT = `${packageInfo.name} ${packageInfo.version}, ${currentAgent} ${agentInfo}`;
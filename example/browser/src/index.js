import {
  Agent,
  AgentMode,
  ConversationState,
  DEC112Specifics,
  EmergencyMessageType,
  LocationMethod,
  Origin,
  Utils,
  XMLCompat,
  VCard,
  KeyId,
} from 'ng112-js';
import { JsSipAdapter } from 'ng112-js-sip-adapter-jssip';
import { SipJsAdapter } from "ng112-js-sip-adapter-sipjs";

XMLCompat.initialize(XMLCompat.getWebImpl());

const availableSipLibraries = {
  jssip: 'JsSIP',
  sipjs: 'SIP.js',
};
const sipFactories = {
  jssip: JsSipAdapter.factory,
  sipjs: SipJsAdapter.factory,
};

const el = (id, defaultValue) => {
  const el = document.getElementById(id);

  if (defaultValue !== undefined) {
    if (typeof defaultValue === 'boolean')
      el.checked = defaultValue;
    else
      el.value = defaultValue;
  }

  return el;
}

const disable = (element, value) => {
  if (value)
    element.setAttribute('disabled', true);
  else
    element.removeAttribute('disabled');
}

(async () => {
  // this allows overriding config entries by search params
  const url = new URL(window.location);
  const { searchParams } = url;

  let config = {};

  // config can be loaded from file
  const configName = searchParams.get('config');
  if (configName) {
    const res = await fetch(`/config/${configName}.config.json`);
    config = await res.json();
  }

  // config can be overwritten by individual query parameters
  for (const key in config) {
    if (searchParams.has(key))
      config[key] = searchParams.get(key);
  }

  const endpoint = el('txtEndpoint', config.endpoint);
  const domain = el('txtDomain', config.domain);
  const sipLibrary = el('selSipLibrary');

  for (const prop in availableSipLibraries) {
    const opt = document.createElement('option');
    opt.value = prop;
    opt.textContent = availableSipLibraries[prop];

    sipLibrary.appendChild(opt);
  }

  const user = el('txtUser', config.user);
  const password = el('txtPassword', config.password);
  const from = el('txtFrom', config.from);
  const displayName = el('txtDisplayName', config.displayName);

  const registration = el('txtRegistration', config.registrationId);
  const registrationApiVersionName = 'reg-api-version';

  const regApiVersionCheckbox = document.querySelector(`input[name="${registrationApiVersionName}"][value="${config.registrationApiVersion}"]`);
  if (regApiVersionCheckbox)
    regApiVersionCheckbox.checked = true;

  const latitude = el('txtLatitude', config.latitude);
  const longitude = el('txtLongitude', config.longitude);
  const radius = el('txtRadius', config.radius);
  const locationMethod = el('selLocationMethod');
  el('btnUpdateLocation').addEventListener('click', () => updateLocation());

  for (const prop in LocationMethod) {
    const opt = document.createElement('option');
    opt.value = prop;
    opt.textContent = prop;

    locationMethod.appendChild(opt);
  }

  const call = el('txtCall', config.call);
  const callId = el('txtCallId', config.callId);
  const isTest = el('cbIsTest', config.isTest);
  const isActive = el('cbIsActive', config.isActive);

  const start = el('btnStart');
  const end = el('btnEnd');

  const register = el('btnRegister');
  const unregister = el('btnUnregister');

  const uri = el('txtUri');
  const file = el('file');
  const iframe = el('iframe');
  const message = el('txtMessage');
  const send = el('btnSend');

  const headerConfig = config.headers;
  const headers = el('txtHeaders', headerConfig ? headerConfig.join('\\n') : undefined);

  const remoteSipUri = el('txtRemoteSipUri');
  const remoteDisplayName = el('txtRemoteDisplayName');

  const chatarea = el('chatarea');

  const lastMessage = el('lastMessage');

  const popMessageText = () => {
    const text = message.value;
    message.value = '';
    return text;
  }

  const getExtraHeaders = () => {
    const headersString = headers.value;
    const extraHeaders = [];
    if (headersString) {
      for (const line of headersString.split('\n')) {
        const h = Utils.parseHeader(line);

        if (h)
          extraHeaders.push(h);
      }
    }

    return extraHeaders;
  }

  // try to unregister if window is unloaded
  window.onbeforeunload = () => unregister.click();

  let agent, conversation, lastMessageDate;

  const updateLocation = async () => {
    if (!agent)
      return;

    agent.updateLocation({
      latitude: parseFloat(latitude.value),
      longitude: parseFloat(longitude.value),
      radius: parseFloat(radius.value),
      method: locationMethod.value,
      timestamp: new Date(),
    });
  }

  const updateMode = async () => {
    if (!agent)
      return;

    agent.setMode(
      isActive.checked ? AgentMode.ACTIVE : AgentMode.INACTIVE
    );
  }

  const handleNewMessage = (msg) => {
    if (msg.event && msg.event.accept)
      // e.g. SIP.js requires you to explicitly accept an incoming message
      msg.event.accept();

    lastMessageDate = new Date();
    if (EmergencyMessageType.isHeartbeat(msg.type))
      return;

    const p = document.createElement('p');
    p.textContent = msg.text;
    p.classList.add(`message`);
    p.classList.add(`origin-${msg.origin}`);

    const div = document.createElement('div');
    div.classList.add('subline');

    const addInfos = [
      new Intl.DateTimeFormat('en', {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
      }).format(msg.dateTime),
    ];
    if (msg.vcard)
      addInfos.push(msg.vcard.fullName);
    if (msg.location && msg.location.simple) {
      const loc = msg.location.simple;

      if (loc && loc.latitude && loc.longitude)
        addInfos.push(`${loc.latitude.toFixed(2)}/${loc.longitude.toFixed(2)}`);
    }

    if (addInfos.length > 0) {
      const addInfosSpan = document.createElement('span');
      addInfosSpan.textContent = addInfos.join(' | ');
      div.appendChild(addInfosSpan);
    }

    const spanMeta = document.createElement('span');
    div.appendChild(spanMeta);

    if (msg.origin === Origin.LOCAL) {
      const spanStatus = document.createElement('span');
      spanStatus.textContent = 'sending...';
      spanMeta.appendChild(spanStatus);

      msg.promise
        .then(() => spanStatus.textContent = 'sent')
        .catch((err) => {
          console.error(err);
          spanStatus.textContent = 'could not send message'
        });
    }

    const spanId = document.createElement('span');
    spanId.textContent = `(${msg.id})`;
    spanMeta.appendChild(spanId);

    p.appendChild(div);

    chatarea.insertBefore(p, chatarea.firstChild);

    if (msg.uris) {
      iframe.hidden = false;
      iframe.setAttribute('src', msg.uris[0]);
    }

    remoteSipUri.textContent = msg.conversation.remoteSipUri;
    remoteDisplayName.textContent = `<${msg.conversation.remoteDisplayName || 'Unknown'}>`;
  }

  register.addEventListener('click', async () => {
    const regApiVersionCheckbox = document.querySelector(`input[name="${registrationApiVersionName}"]:checked`)
    let regApiVersion = undefined;

    if (regApiVersionCheckbox)
      regApiVersion = regApiVersionCheckbox.value;

    const reg = registration.value;
    let namespaceSpecifics = undefined;

    if (regApiVersion && reg) {
      namespaceSpecifics = new DEC112Specifics({
        deviceId: regApiVersion == 1 ? reg : undefined,
        registrationId: regApiVersion == 2 ? reg : undefined,
      });
    }

    agent = new Agent({
      sipAdapterFactory: sipFactories[sipLibrary.value],
      endpoint: endpoint.value,
      domain: domain.value,
      user: user.value,
      password: password.value,
      namespaceSpecifics,
      displayName: displayName.value,
      customSipHeaders: {
        from: from.value,
      },
      debug: {
        default: ((level, ...values) => {
          // TODO: distinguish between levels
          console.log(...values);
        })
      },
      userAgent: 'ng112-js-example-browser',
    });

    agent.addConversationListener((newConversation) => {
      conversation = newConversation;

      conversation.addMessageListener(handleNewMessage);
      conversation.messages.forEach(handleNewMessage);
      conversation.addStateListener((stateObj) => {
        const isStarted = stateObj.value === ConversationState.STARTED;

        if (!isStarted) {
          conversation = undefined;
          lastMessageDate = undefined;
        }

        disable(send, !isStarted);
        disable(end, !isStarted);
        disable(start, isStarted);
      });
    });

    await agent.initialize();

    disable(register, true);
    disable(unregister, false);
    disable(start, false);
  });

  unregister.addEventListener('click', async () => {
    await agent.dispose();

    disable(start, true);
    disable(unregister, true);
    disable(register, false);
  });
  disable(unregister, true);

  start.addEventListener('click', () => {
    chatarea.innerHTML = '';

    updateLocation();
    updateMode();

    if (config.vcard) {
      const vcard = new VCard();

      for (const prop in config.vcard) {
        let value = config.vcard[prop];

        if (prop === KeyId.BIRTHDAY)
          value = new Date(value);

        vcard.add(prop, value);
      }

      agent.updateVCard(vcard);
    }

    conversation = agent.createConversation(call.value, {
      isTest: isTest.checked,
      id: callId.value || undefined,
    });

    conversation.start({
      text: popMessageText(),
      extraHeaders: getExtraHeaders(),
    }).promise;
  });
  disable(start, true);

  end.addEventListener('click', () => {
    if (!conversation)
      return;

    conversation.stop({
      text: popMessageText(),
    });
  });
  disable(end, true);

  send.addEventListener('click', async () => {
    if (!conversation)
      return;

    let uris = undefined;

    if (uri.value) {
      uris = [uri.value];
    }

    let binaries = undefined;
    const currentFile = file.files[0];

    if (currentFile) {
      const fileBin = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (evt) => {
          resolve(evt.target.result);
        }
        reader.readAsArrayBuffer(currentFile);
      });

      binaries = [{
        mimeType: currentFile.type,
        value: fileBin,
      }];
    }

    conversation.sendMessage({
      text: popMessageText(),
      binaries,
      uris,
      extraHeaders: getExtraHeaders(),
    });
  });
  disable(send, true);

  isActive.addEventListener('change', () => updateMode());

  setInterval(() => {
    let res;

    if (lastMessageDate) {
      res = parseInt(((new Date()).getTime() - lastMessageDate.getTime()) / 1000) + ' seconds ago';
    }
    else
      res = '-';

    lastMessage.textContent = res;
  }, 1000);

})();
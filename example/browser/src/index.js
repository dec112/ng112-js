import {
  Agent,
  AgentMode,
  ConversationState,
  DEC112Specifics,
  EmergencyMessageType,
  Gender,
  LocationMethod,
  Origin,
  SupportedAgent,
  VCard,
} from 'ng112-js/dist/browser';

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

  const user = el('txtUser', config.user);
  const password = el('txtPassword', config.password);
  const from = el('txtFrom', config.from);
  const displayName = el('txtDisplayName');

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
  const remoteDisplayName = el('txtRemoteDisplayName');

  const chatarea = el('chatarea');

  const lastMessage = el('lastMessage');

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

      if (loc)
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

    remoteDisplayName.textContent = `(${msg.conversation.remoteDisplayName || 'Unknown'})`;
  }

  register.addEventListener('click', async () => {
    const regApiVersionCheckbox = document.querySelector(`input[name="${registrationApiVersionName}"]:checked`)
    let regApiVersion = undefined;

    if (regApiVersionCheckbox)
      regApiVersion = regApiVersionCheckbox.value;

    const reg = registration.value;
    let namespaceSpecifics = undefined;

    if (regApiVersion && reg) {
      namespaceSpecifics = new DEC112Specifics(
        regApiVersion == 1 ? reg : undefined,
        regApiVersion == 2 ? reg : undefined,
        undefined,
        undefined,
      );
    }

    agent = new Agent({
      endpoint: endpoint.value,
      domain: domain.value,
      user: user.value,
      password: password.value,
      // debug: true,
      namespaceSpecifics,
      displayName: displayName.value,
      customSipHeaders: {
        from: from.value,
      },
      preferredSipAgent: SupportedAgent.sipjs,
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

  start.addEventListener('click', async () => {
    chatarea.innerHTML = '';

    updateLocation();
    updateMode();

    // TODO: that should be made configurable
    agent.updateVCard(new VCard()
      .addFullName('Alice Smith MSc.')
      .addFirstname('Alice')
      .addLastname('Smith')
      .addBirthday(new Date(1990, 5, 11))
      .addGender(Gender.FEMALE)
      .addStreet('Example Street 3')
      .addLocality('Humble Village')
      .addCode('4786')
      .addCountry('Austria')
      .addTelephone('+4366412345678')
      .addEmail('alice.smith@dec112.at')
      .addNote(JSON.stringify({
        some: 'additional',
        data: 'to',
        be: 'sent',
      }))
    );

    conversation = agent.createConversation(call.value, {
      isTest: isTest.checked,
    });

    await conversation.start().promise;
  });
  disable(start, true);

  end.addEventListener('click', async () => {
    if (!conversation)
      return;

    await conversation.stop().promise;
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
      text: message.value,
      binaries,
      uris,
    });
    message.value = '';
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
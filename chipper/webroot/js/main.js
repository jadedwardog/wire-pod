const intentsJson = JSON.parse(
  '["intent_greeting_hello", "intent_names_ask", "intent_imperative_eyecolor", "intent_character_age", "intent_explore_start", "intent_system_charger", "intent_system_sleep", "intent_greeting_goodmorning", "intent_greeting_goodnight", "intent_greeting_goodbye", "intent_seasonal_happynewyear", "intent_seasonal_happyholidays", "intent_amazon_signin", "intent_imperative_forward", "intent_imperative_turnaround", "intent_imperative_turnleft", "intent_imperative_turnright", "intent_play_rollcube", "intent_play_popawheelie", "intent_play_fistbump", "intent_play_blackjack", "intent_imperative_affirmative", "intent_imperative_negative", "intent_photo_take_extend", "intent_imperative_praise", "intent_imperative_abuse", "intent_weather_extend", "intent_imperative_apologize", "intent_imperative_backup", "intent_imperative_volumedown", "intent_imperative_volumeup", "intent_imperative_lookatme", "intent_imperative_volumelevel_extend", "intent_imperative_shutup", "intent_names_username_extend", "intent_imperative_come", "intent_imperative_love", "intent_knowledge_promptquestion", "intent_clock_checktimer", "intent_global_stop_extend", "intent_clock_settimer_extend", "intent_clock_time", "intent_imperative_quiet", "intent_imperative_dance", "intent_play_pickupcube", "intent_imperative_fetchcube", "intent_imperative_findcube", "intent_play_anytrick", "intent_message_recordmessage_extend", "intent_message_playmessage_extend", "intent_blackjack_hit", "intent_blackjack_stand", "intent_play_keepaway"]'
);

var GetLog = false;
let reminderCounter = 0;

const getE = (element) => document.getElementById(element);

function updateIntentSelection(element) {
  fetch("/api/get_custom_intents_json")
    .then((response) => response.json())
    .then((listResponse) => {
      const container = getE(element);
      container.innerHTML = "";
      if (listResponse && listResponse.length > 0) {
        const select = document.createElement("select");
        select.name = `${element}intents`;
        select.id = `${element}intents`;
        listResponse.forEach((intent) => {
          if (!intent.issystem) {
            const option = document.createElement("option");
            option.value = intent.name;
            option.text = intent.name;
            select.appendChild(option);
          }
        });
        const label = document.createElement("label");
        label.innerHTML = "Choose the intent: ";
        label.htmlFor = `${element}intents`;
        container.appendChild(label).appendChild(select);

        select.addEventListener("change", hideEditIntents);
      } else {
        const error = document.createElement("p");
        error.innerHTML = "No intents found, you must add one first";
        container.appendChild(error);
      }
    }).catch(() => {
      // Do nothing
    });
}

function checkInited() {
  fetch("/api/is_api_v3").then((response) => {
    if (!response.ok) {
      alert(
        "This webroot does not match with the wire-pod binary. Some functionality will be broken. There was either an error during the last update, or you did not precisely follow the update guide. https://github.com/kercre123/wire-pod/wiki/Things-to-Know#updating-wire-pod"
      );
    }
  });

  fetch("/api/get_config")
    .then((response) => response.json())
    .then((config) => {
      if (!config.pastinitialsetup) {
        window.location.href = "/initial.html";
      }
    });
}

function createIntentSelect(element) {
  const select = document.createElement("select");
  select.name = `${element}intents`;
  select.id = `${element}intents`;
  intentsJson.forEach((intent) => {
    const option = document.createElement("option");
    option.value = intent;
    option.text = intent;
    select.appendChild(option);
  });
  const label = document.createElement("label");
  label.innerHTML = "Intent to send to robot after script executed:";
  label.htmlFor = `${element}intents`;
  getE(element).innerHTML = "";
  getE(element).appendChild(label).appendChild(select);
}

function editFormCreate() {
  const intentNumber = getE("editSelectintents").selectedIndex;

  fetch("/api/get_custom_intents_json")
    .then((response) => response.json())
    .then((intents) => {
      const intent = intents[intentNumber];
      if (intent) {
        const form = document.createElement("form");
        form.id = "editIntentForm";
        form.name = "editIntentForm";
        form.innerHTML = `
          <label for="name">Name:<br><input type="text" id="name" value="${intent.name}"></label><br>
          <label for="description">Description:<br><input type="text" id="description" value="${intent.description}"></label><br>
          <label for="utterances">Utterances:<br><input type="text" id="utterances" value="${intent.utterances.join(",")}"></label><br>
          <label for="intent">Intent:<br><select id="intent">${intentsJson
            .map(
              (name) =>
                `<option value="${name}" ${name === intent.intent ? "selected" : ""
                }>${name}</option>`
            )
            .join("")}</select></label><br>
          <label for="paramname">Param Name:<br><input type="text" id="paramname" value="${intent.params.paramname}"></label><br>
          <label for="paramvalue">Param Value:<br><input type="text" id="paramvalue" value="${intent.params.paramvalue}"></label><br>
          <label for="exec">Exec:<br><input type="text" id="exec" value="${intent.exec}"></label><br>
          <label for="execargs">Exec Args:<br><input type="text" id="execargs" value="${intent.execargs.join(",")}"></label><br>
          <label for="luascript">Lua code to run:</label><br><textarea id="luascript">${intent.luascript}</textarea>
          <button onclick="editIntent(${intentNumber})">Submit</button>
        `;
        //form.querySelector("#submit").onclick = () => editIntent(intentNumber);
        getE("editIntentForm").innerHTML = "";
        getE("editIntentForm").appendChild(form);
        showEditIntents();
      } else {
        displayError("editIntentForm", "No intents found, you must add one first");
      }
    }).catch((error) => {
      console.error(error);
      displayError("editIntentForm", "Error fetching intents");
    })
}

function editIntent(intentNumber) {
  const data = {
    number: intentNumber + 1,
    name: getE("name").value,
    description: getE("description").value,
    utterances: getE("utterances").value.split(","),
    intent: getE("intent").value,
    params: {
      paramname: getE("paramname").value,
      paramvalue: getE("paramvalue").value,
    },
    exec: getE("exec").value,
    execargs: getE("execargs").value.split(","),
    luascript: getE("luascript").value,
  };

  fetch("/api/edit_custom_intent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((response) => response.text())
    .then((response) => {
      displayMessage("editIntentStatus", response);
      alert(response)
      updateIntentSelection("editSelect");
      updateIntentSelection("deleteSelect");
    });
}

function deleteSelectedIntent() {
  const intentNumber = getE("editSelectintents").selectedIndex + 1;

  fetch("/api/remove_custom_intent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ number: intentNumber }),
  })
    .then((response) => response.text())
    .then((response) => {
      hideEditIntents();
      alert(response)
      updateIntentSelection("editSelect");
      updateIntentSelection("deleteSelect");
    });
}

function sendIntentAdd() {
  const form = getE("intentAddForm");
  const data = {
    name: form.elements["nameAdd"].value,
    description: form.elements["descriptionAdd"].value,
    utterances: form.elements["utterancesAdd"].value.split(","),
    intent: form.elements["intentAddSelectintents"].value,
    params: {
      paramname: form.elements["paramnameAdd"].value,
      paramvalue: form.elements["paramvalueAdd"].value,
    },
    exec: form.elements["execAdd"].value,
    execargs: form.elements["execAddArgs"].value.split(","),
    luascript: form.elements["luaAdd"].value,
  };
  if (!data.name || !data.description || !data.utterances) {
    displayMessage("addIntentStatus", "A required input is missing. You need a name, description, and utterances.");
    alert("A required input is missing. You need a name, description, and utterances.")
    return
  }

  displayMessage("addIntentStatus", "Adding...");

  fetch("/api/add_custom_intent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((response) => response.text())
    .then((response) => {
      displayMessage("addIntentStatus", response);
      alert(response)
      updateIntentSelection("editSelect");
      updateIntentSelection("deleteSelect");
    });
}

function checkWeather() {
  getE("apiKeySpan").style.display = getE("weatherProvider").value ? "block" : "none";
}

function sendWeatherAPIKey() {
  const data = {
    provider: getE("weatherProvider").value,
    key: getE("apiKey").value,
  };

  displayMessage("addWeatherProviderAPIStatus", "Saving...");

  fetch("/api/set_weather_api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((response) => response.text())
    .then((response) => {
      displayMessage("addWeatherProviderAPIStatus", response);
    });
}

function updateWeatherAPI() {
  fetch("/api/get_weather_api")
    .then((response) => response.json())
    .then((data) => {
      getE("weatherProvider").value = data.provider;
      getE("apiKey").value = data.key;
      checkWeather();
    });
}

function checkProductivity() {
  const provider = getE("productivityProvider").value;

  getE("productivityKeySpan").style.display = "none";
  getE("nextcloudInput").style.display = "none";

  if (provider === "google_calendar") {
    getE("productivityKeySpan").style.display = "block";
    getE("prodKeyLabel").innerHTML = "Credentials (JSON) / OAuth Token:";
    getE("prodApiKey").placeholder = "{ \"type\": \"service_account\", ... }";
  } else if (provider === "todoist") {
    getE("productivityKeySpan").style.display = "block";
    getE("prodKeyLabel").innerHTML = "API Token:";
    getE("prodApiKey").placeholder = "0123456789abcdef...";
  } else if (provider === "nextcloud") {
    getE("nextcloudInput").style.display = "block";
  }
}

function startNextcloudAuth() {
  const url = getE("ncUrl").value;
  if (!url) {
    alert("Please enter your Nextcloud Instance URL first.");
    return;
  }

  // NOTE: Might require a backend proxy to avoid CORS.
  const statusEl = getE("ncAuthStatus");
  statusEl.innerHTML = "Initiating Login Flow...";

  fetch(url.replace(/\/$/, "") + "/index.php/login/v2", {
      method: "POST",
  })
  .then(res => res.json())
  .then(data => {
      if (data.login && data.poll) {
          statusEl.innerHTML = `Please <a href="${data.login}" target="_blank" style="color:cyan; text-decoration:underline;">Click Here to Login</a> then return.`;
          pollNextcloudAuth(data.poll.token, data.poll.endpoint);
      } else {
          statusEl.innerHTML = "Error: Invalid response from Nextcloud.";
      }
  })
  .catch(err => {
      console.error(err);
      statusEl.innerHTML = "Error contacting Nextcloud. Check console/CORS.";
  });
}

function pollNextcloudAuth(token, endpoint) {
   const statusEl = getE("ncAuthStatus");
   const interval = setInterval(() => {
       fetch(endpoint + "?token=" + token, {
           method: "POST"
       })
       .then(res => res.json())
       .then(data => {
           if (data.loginName && data.appPassword) {
               clearInterval(interval);
               getE("ncUser").value = data.loginName;
               getE("ncPass").value = data.appPassword;
               statusEl.innerHTML = "Success! Credentials captured.";
           }
       })
       .catch(err => {
           // Polling errors are expected until approval
       });
   }, 2000);
}

function toggleManualReminders() {
   const enabled = getE("enableManualReminders").checked;
   getE("manualRemindersWrapper").style.display = enabled ? "block" : "none";
}

function addReminderBlock(data = null) {
  reminderCounter++;
  const id = `rem_${reminderCounter}`;
  const container = getE("manualRemindersContainer");

  const block = document.createElement("div");
  block.className = "reminder-block";
  block.id = id;

  const reminderName = data ? data.id : "";
  const reminderImage = data ? data.image : "";
  const scheduleType = data && data.schedule ? data.schedule.type : "daily";

  block.innerHTML = `
    <div class="reminder-header">
      <h4 style="margin:0;">Reminder #${reminderCounter}</h4>
      <button type="button" class="remove-btn" onclick="document.getElementById('${id}').remove()">Remove</button>
    </div>

    <label>ID / Name:</label>
    <input type="text" class="tinput reminder-id-val" value="${reminderName}" placeholder="e.g. meds_morning"><br>

    <!-- File Input for Image -->
    <label>Image:</label><br>
    <input type="hidden" class="reminder-img-existing" value="${reminderImage}">
    ${reminderImage ? `<small style="color:gray;">Current: ${reminderImage}</small><br>` : ''}
    <input type="file" class="reminder-file-input" accept="image/png" style="margin-top:5px; margin-bottom:10px;"><br>

    <label>Phrases:</label>
    <div class="phrases-container" id="${id}_phrases"></div>
    <button type="button" class="add-btn-small" onclick="addPhraseInput('${id}_phrases')">+ Add Phrase</button><br><br>

    <label>Schedule Type:</label>
    <select class="reminder-schedule-type" onchange="toggleScheduleType('${id}', this.value)">
      <option value="daily" ${scheduleType === 'daily' ? 'selected' : ''}>Daily (Specific Time)</option>
      <option value="random_interval" ${scheduleType === 'random_interval' ? 'selected' : ''}>Random Interval</option>
    </select>

    <div class="schedule-options" id="${id}_schedule_options">
       <!-- Populated by toggleScheduleType -->
    </div>
  `;

  container.appendChild(block);

  if (data && data.phrases) {
      data.phrases.forEach(phrase => addPhraseInput(`${id}_phrases`, phrase));
  } else {
      addPhraseInput(`${id}_phrases`); 
  }

  toggleScheduleType(id, scheduleType, data ? data.schedule : null);
}

function addPhraseInput(containerId, value = "") {
  const container = getE(containerId);
  const div = document.createElement("div");
  div.className = "phrase-row";
  div.innerHTML = `
    <input type="text" class="tinput phrase-val" value="${value}" style="width: 80%;" placeholder="Spoken phrase...">
    <button type="button" class="remove-btn" style="background:#666;" onclick="this.parentElement.remove()">X</button>
  `;
  container.appendChild(div);
}

function toggleScheduleType(reminderId, type, existingData = null) {
  const container = getE(`${reminderId}_schedule_options`);
  container.innerHTML = "";

  if (type === "daily") {
    const timeVal = existingData ? existingData.time : "08:00";
    container.innerHTML = `
      <label>Time (HH:MM):</label>
      <input type="time" class="tinput sched-daily-time" value="${timeVal}">
    `;
  } else if (type === "random_interval") {
    const minVal = existingData ? existingData.min_minutes : "60";
    const maxVal = existingData ? existingData.max_minutes : "120";
    container.innerHTML = `
      <label>Min Minutes:</label>
      <input type="number" class="tinput sched-rnd-min" value="${minVal}" style="width: 80px;">
      <label>Max Minutes:</label>
      <input type="number" class="tinput sched-rnd-max" value="${maxVal}" style="width: 80px;">
    `;
  }
}

function collectManualConfigData(formDataObj) {
  const enabled = getE("enableManualReminders").checked;
  if (!enabled) return [];

  const blocks = document.querySelectorAll("#manualRemindersContainer .reminder-block");
  const config = [];

  blocks.forEach((block, index) => {
    const id = block.querySelector(".reminder-id-val").value;
    const existingImage = block.querySelector(".reminder-img-existing").value;
    const fileInput = block.querySelector(".reminder-file-input");

    let imageName = existingImage;
    if (fileInput.files.length > 0) {
        imageName = fileInput.files[0].name;
        formDataObj.append("files", fileInput.files[0]);
    }

    const phrases = [];
    block.querySelectorAll(".phrase-val").forEach(input => {
        if(input.value.trim() !== "") phrases.push(input.value.trim());
    });

    const schedType = block.querySelector(".reminder-schedule-type").value;
    let schedule = { type: schedType };

    if (schedType === "daily") {
        schedule.time = block.querySelector(".sched-daily-time").value;
    } else {
        schedule.min_minutes = parseInt(block.querySelector(".sched-rnd-min").value) || 60;
        schedule.max_minutes = parseInt(block.querySelector(".sched-rnd-max").value) || 120;
    }

    if (id) {
        config.push({
            id: id,
            image: imageName,
            phrases: phrases,
            schedule: schedule
        });
    }
  });

  return config;
}

function sendProductivityAPIKey() {
  const provider = getE("productivityProvider").value;
  
  const formData = new FormData();

  formData.append("provider", provider);

  if (provider === "google_calendar" || provider === "todoist") {
    formData.append("key", getE("prodApiKey").value);
  } else if (provider === "nextcloud") {
    formData.append("url", getE("ncUrl").value);
    formData.append("username", getE("ncUser").value);
    formData.append("password", getE("ncPass").value);
  }
  
  const manualConfigArray = collectManualConfigData(formData);
  formData.append("manual_config", JSON.stringify(manualConfigArray));

  displayMessage("addProductivityProviderAPIStatus", "Saving...");

  fetch("/api/set_productivity_api", {
    method: "POST",
    body: formData
  })
    .then((response) => response.text())
    .then((response) => {
      displayMessage("addProductivityProviderAPIStatus", response);
    })
    .catch((error) => {
      displayMessage("addProductivityProviderAPIStatus", "Error saving settings: " + error);
    });
}

function updateProductivityAPI() {
  fetch("/api/get_productivity_api")
    .then((response) => response.json())
    .then((data) => {
      if (data) {
          getE("productivityProvider").value = data.provider;
          getE("prodApiKey").value = data.key || "";
          getE("ncUrl").value = data.url || "";
          getE("ncUser").value = data.username || "";
          getE("ncPass").value = data.password || "";

          if (data.manual_config && data.manual_config.length > 2) { 
              getE("enableManualReminders").checked = true;
              toggleManualReminders();
              try {
                  const config = JSON.parse(data.manual_config);
                  getE("manualRemindersContainer").innerHTML = ""; 
                  if (Array.isArray(config)) {
                      config.forEach(item => addReminderBlock(item));
                  }
              } catch (e) {
                  console.error("Error parsing manual config", e);
              }
          } else {
             getE("enableManualReminders").checked = false;
             toggleManualReminders();
          }

          checkProductivity();
      }
    })
    .catch(() => {
        checkProductivity();
    });
}

function checkKG() {
  const provider = getE("kgProvider").value;
  const elements = [
    "houndifyInput",
    "togetherInput",
    "customAIInput",
    "intentGraphInput",
    "openAIInput",
    "saveChatInput",
    "llmCommandInput",
    "openAIVoiceForEnglishInput",
  ];

  elements.forEach((el) => (getE(el).style.display = "none"));

  if (provider) {
    if (provider === "houndify") {
      getE("houndifyInput").style.display = "block";
      getE("intentGraphInput").style.display = "block";
    } else if (provider === "openai") {
      getE("intentGraphInput").style.display = "block";
      getE("openAIInput").style.display = "block";
      getE("saveChatInput").style.display = "block";
      getE("llmCommandInput").style.display = "block";
      getE("openAIVoiceForEnglishInput").style.display = "block";
    } else if (provider === "together") {
      getE("intentGraphInput").style.display = "block";
      getE("togetherInput").style.display = "block";
      getE("saveChatInput").style.display = "block";
      getE("llmCommandInput").style.display = "block";
    } else if (provider === "custom") {
      getE("intentGraphInput").style.display = "block";
      getE("customAIInput").style.display = "block";
      getE("saveChatInput").style.display = "block";
      getE("llmCommandInput").style.display = "block";
    }
  }
}

function sendKGAPIKey() {
  const provider = getE("kgProvider").value;
  const data = {
    enable: true,
    provider,
    key: "",
    model: "",
    id: "",
    intentgraph: false,
    robotName: "",
    openai_prompt: "",
    openai_voice: "",
    openai_voice_with_english: false,
    save_chat: false,
    commands_enable: false,
    endpoint: "",
  };
  if (provider === "openai") {
    data.key = getE("openaiKey").value;
    data.openai_prompt = getE("openAIPrompt").value;
    data.intentgraph = getE("intentyes").checked
    data.save_chat = getE("saveChatYes").checked
    data.commands_enable = getE("commandYes").checked
    data.openai_voice = getE("openaiVoice").value
    data.openai_voice_with_english = getE("voiceEnglishYes").checked
  } else if (provider === "custom") {
    data.key = getE("customKey").value;
    data.model = getE("customModel").value;
    data.openai_prompt = getE("customAIPrompt").value;
    data.endpoint = getE("customAIEndpoint").value;
    data.intentgraph = getE("intentyes").checked
    data.save_chat = getE("saveChatYes").checked
    data.commands_enable = getE("commandYes").checked
  } else if (provider === "together") {
    data.key = getE("togetherKey").value;
    data.model = getE("togetherModel").value;
    data.openai_prompt = getE("togetherAIPrompt").value;
    data.intentgraph = getE("intentyes").checked;
    data.save_chat = getE("saveChatYes").checked
    data.commands_enable = getE("commandYes").checked
  } else if (provider === "houndify") {
    data.key = getE("houndKey").value;
    data.id = getE("houndID").value;
    data.intentgraph = getE("intentyes").checked
  } else {
    data.enable = false;
  }

  fetch("/api/set_kg_api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((response) => response.text())
    .then((response) => {
      displayMessage("addKGProviderAPIStatus", response);
      alert(response);
    });
}

function deleteSavedChats() {
  if (confirm("Are you sure? This will delete all saved chats.")) {
    fetch("/api/delete_chats")
      .then((response) => response.text())
      .then(() => {
        alert("Successfully deleted all saved chats.");
      });
  }
}

function updateKGAPI() {
  fetch("/api/get_kg_api")
    .then((response) => response.json())
    .then((data) => {
      getE("kgProvider").value = data.provider;
      if (data.provider === "openai") {
        getE("openaiKey").value = data.key;
        getE("openAIPrompt").value = data.openai_prompt;
        getE("openaiVoice").value = data.openai_voice;
        getE("commandYes").checked = data.commands_enable
        getE("intentyes").checked = data.intentgraph
        getE("saveChatYes").checked = data.save_chat
        getE("voiceEnglishYes").checked = data.openai_voice_with_english
      } else if (data.provider === "together") {
        getE("togetherKey").value = data.key;
        getE("togetherModel").value = data.model;
        getE("togetherAIPrompt").value = data.openai_prompt;
        getE("commandYes").checked = data.commands_enable
        getE("intentyes").checked = data.intentgraph
        getE("saveChatYes").checked = data.save_chat
      } else if (data.provider === "custom") {
        getE("customKey").value = data.key;
        getE("customModel").value = data.model;
        getE("customAIPrompt").value = data.openai_prompt;
        getE("customAIEndpoint").value = data.endpoint;
        getE("commandYes").checked = data.commands_enable
        getE("intentyes").checked = data.intentgraph
        getE("saveChatYes").checked = data.save_chat
      } else if (data.provider === "houndify") {
        getE("houndKey").value = data.key;
        getE("houndID").value = data.id;
        getE("intentyes").checked = data.intentgraph
      }
      checkKG();
    });
}

function setSTTLanguage() {
  const data = { language: getE("languageSelection").value };

  displayMessage("languageStatus", "Setting...");

  fetch("/api/set_stt_info", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
    .then((response) => response.text())
    .then((response) => {
      if (response.includes("downloading")) {
        displayMessage("languageStatus", "Downloading model...");
        updateSTTLanguageDownload();
      } else {
        displayMessage("languageStatus", response);
        getE("languageSelectionDiv").style.display = response.includes("success") ? "block" : "none";
      }
    });
}

function updateSTTLanguageDownload() {

  const interval = setInterval(() => {
    fetch("/api/get_download_status")
      .then((response) => response.text())
      .then((response) => {
        displayMessage("languageStatus", response.includes("not downloading") ? "Initiating download..." : response)
        if (response.includes("success") || response.includes("error")) {
          displayMessage("languageStatus", response);
          getE("languageSelectionDiv").style.display = "block";
          clearInterval(interval);
        }
      });
  }, 500);
}

function sendRestart() {
  fetch("/api/reset")
    .then((response) => response.text())
    .then((response) => {
      displayMessage("restartStatus", response);
    });
}

function hideEditIntents() {
  getE("editIntentForm").style.display = "none";
  getE("editIntentStatus").innerHTML = "";
}

function showEditIntents() {
  getE("editIntentForm").style.display = "block";
}

function displayMessage(elementId, message) {
  const element = getE(elementId);
  element.innerHTML = "";
  const p = document.createElement("p");
  p.textContent = message;
  element.appendChild(p);
}

function displayError(elementId, message) {
  const element = getE(elementId);
  element.innerHTML = "";
  const error = document.createElement("p");
  error.innerHTML = message;
  element.appendChild(error);
}

function toggleSection(sectionToToggle, sectionToClose, foldableID) {
  const toggleSect = getE(sectionToToggle);
  const closeSect = getE(sectionToClose);

  if (toggleSect.style.display === "block") {
    closeSection(toggleSect, foldableID);
  } else {
    openSection(toggleSect, foldableID);
    closeSection(closeSect, foldableID);
  }
}

function openSection(sectionID) {
  sectionID.style.display = "block";
}

function closeSection(sectionID) {
  sectionID.style.display = "none";
}

function updateColor(id) {
  const l_id = id.replace("section", "icon");
  const elements = document.getElementsByName("icon");

  elements.forEach((element) => {
    element.classList.remove("selectedicon");
    element.classList.add("nowselectedicon");
  });

  const targetElement = document.getElementById(l_id);
  targetElement.classList.remove("notselectedicon");
  targetElement.classList.add("selectedicon");
}


function showLog() {
  toggleVisibility(["section-intents", "section-log", "section-botauth", "section-version", "section-uicustomizer"], "section-log", "icon-Logs");
  logDivArea = getE("botTranscriptedTextArea");
  getE("logscrollbottom").checked = true;
  logP = document.createElement("p");
  GetLog = true
  const interval = setInterval(() => {
    if (!GetLog) {
      clearInterval(interval);
      return;
    }
    const url = getE("logdebug").checked ? "/api/get_debug_logs" : "/api/get_logs";
    fetch(url)
      .then((response) => response.text())
      .then((logs) => {
        logDivArea.innerHTML = logs || "No logs yet, you must say a command to Vector. (this updates automatically)";
        if (getE("logscrollbottom").checked) {
          logDivArea.scrollTop = logDivArea.scrollHeight;
        }
      });
  }, 500);
}

function checkUpdate() {
  displayMessage("cVersion", "Checking for updates...");
  displayMessage("aUpdate", "");
  displayMessage("cCommit", "");
  fetch("/api/get_version_info")
    // type VersionInfo struct {
    // 	FromSource      bool   `json:"fromsource"`
    // 	InstalledVer    string `json:"installedversion"`
    // 	InstalledCommit string `json:"installedcommit"`
    // 	CurrentVer      string `json:"currentver"`
    // 	CurrentCommit   string `json:"currentcommit"`
    // 	UpdateAvailable bool   `json:"avail"`
    // }
    .then((response) => response.text())
    .then((response) => {
      if (response.includes("error")) {
        // <p id="cVersion"></p>
        // <p style="display: none;" id="cCommit"></p>
        // <p id="aUpdate"></p>
        displayMessage(
          "cVersion",
          "There was an error: " + response
        );
        getE("updateGuideLink").style.display = "none";
      } else {
        const parsed = JSON.parse(response);
        if (parsed.fromsource) {
          if (!parsed.avail) {
            displayMessage("aUpdate", `You are on the latest version.`);
            getE("updateGuideLink").style.display = "none";
          } else {
            displayMessage("aUpdate", `A newer version of WirePod (commit: ${parsed.currentcommit}) is available! Use this guide to update WirePod: `);
            getE("updateGuideLink").style.display = "block";
          }
          displayMessage("cVersion", `Installed Commit: ${parsed.installedcommit}`);
        } else {
          displayMessage("cVersion", `Installed Version: ${parsed.installedversion}`);
          displayMessage("cCommit", `Based on wire-pod commit: ${parsed.installedcommit}`);
          getE("cCommit").style.display = "block";
          if (parsed.avail) {
            displayMessage("aUpdate", `A newer version of WirePod (${parsed.currentversion}) is available! Use this guide to update WirePod: `);
            getE("updateGuideLink").style.display = "block";
          } else {
            displayMessage("aUpdate", "You are on the latest version.");
            getE("updateGuideLink").style.display = "none";
          }
        }
      }
    });
}

function showLanguage() {
  toggleVisibility(["section-weather", "section-restart", "section-kg", "section-productivity", "section-language"], "section-language", "icon-Language");
  fetch("/api/get_stt_info")
    .then((response) => response.json())
    .then((parsed) => {
      if (parsed.provider !== "vosk" && parsed.provider !== "whisper.cpp") {
        displayError("languageStatus", `To set the STT language, the provider must be Vosk or Whisper. The current one is '${parsed.sttProvider}'.`);
        getE("languageSelectionDiv").style.display = "none";
      } else {
        getE("languageSelectionDiv").style.display = "block";
        getE("languageSelection").value = parsed.language;
      }
    });
}

function showVersion() {
  toggleVisibility(["section-log", "section-botauth", "section-intents", "section-version", "section-uicustomizer"], "section-version", "icon-Version");
  checkUpdate();
}

function showIntents() {
  toggleVisibility(["section-log", "section-botauth", "section-intents", "section-version", "section-uicustomizer"], "section-intents", "icon-Intents");
}

function showWeather() {
  toggleVisibility(["section-weather", "section-restart", "section-language", "section-productivity", "section-kg"], "section-weather", "icon-Weather");
}

function showProductivity() {
  toggleVisibility(["section-weather", "section-restart", "section-language", "section-kg", "section-productivity"], "section-productivity", "icon-Productivity");
}

function showKG() {
  toggleVisibility(["section-weather", "section-restart", "section-language", "section-productivity", "section-kg"], "section-kg", "icon-KG");
}

function toggleVisibility(sections, sectionToShow, iconId) {
  if (sectionToShow != "section-log") {
    GetLog = false;
  }
  sections.forEach((section) => {
    getE(section).style.display = "none";
  });
  getE(sectionToShow).style.display = "block";
  updateColor(iconId);
}
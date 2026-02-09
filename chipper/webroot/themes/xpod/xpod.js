(function() {
    const isDashboard = window.location.pathname === "/" || window.location.pathname.endsWith("index.html");

    if (isDashboard) {
        initDashboard();
    } else {
        document.body.style.visibility = "visible";
        document.body.style.opacity = 1;
    }

    function initDashboard() {
        document.body.innerHTML = `
        <div id="retro-container">
            <div id="eyes-container" title="Tap to annoy">
                <div id="eye-left" class="eye"></div>
                <div id="eye-right" class="eye"></div>
            </div>

            <div id="boot-screen">
                <div class="absolute inset-0 flex items-center justify-center">
                    <div class="boot-blob"></div>
                </div>
                <div class="boot-logo-container">
                    <h1 class="boot-title">
                        <span style="color: #22c55e;">X</span>POD
                    </h1>
                    <p style="color: white; font-weight: bold; margin-top: 0.5rem; letter-spacing: 0.1em; font-size: 0.875rem;">WIREPOD</p>
                </div>
            </div>

            <div class="main-layout">
                
                <div class="sidebar">
                    <div class="sidebar-content">
                        <h2 id="screen-title" class="text-2xl font-bold uppercase" style="letter-spacing: 0.1em; opacity: 0.6;">DASHBOARD</h2>
                        <div id="version-info" style="margin-top: 1rem; font-size: 0.75rem; font-family: monospace; opacity: 0.5;">
                            Loading...
                        </div>
                    </div>
                </div>

                <div class="content-area">
                    
                    <div id="screen-main" class="screen active perspective-container">
                        <ul id="main-menu-list">
                        </ul>
                    </div>

                    <div id="screen-bot_setup" class="screen panel info-panel-body">
                        <h2 class="text-2xl font-bold uppercase" style="color: #39ff14; margin-bottom: 1rem; letter-spacing: 0.1em;">BOT SETUP</h2>
                        <div id="div-botauth-content">
                            <div id="disconnectButton"></div>
                            <div id="botAuth"></div>
                            <hr>
                            <h3 style="color:#4a8a4a; font-size:0.9em;">OSKR / DEV BOT</h3>
                            <input type="text" id="sshIp" placeholder="Bot IP Address">
                            <input type="file" id="sshKeyFile" style="margin-top:0.5rem;">
                            <button onclick="doSSHSetup()" style="margin-top:0.5rem;">Set Up SSH</button>
                            <div id="oskrSetupProgress"></div>
                        </div>
                        <button class="btn-back">Press BACK</button>
                    </div>

                    <div id="screen-custom_intents" class="screen panel info-panel-body">
                        <h2 class="text-2xl font-bold uppercase" style="color: #39ff14; margin-bottom: 1rem; letter-spacing: 0.1em;">CUSTOM INTENTS</h2>
                        
                        <div style="display:flex; gap:10px; margin-bottom:1rem;">
                            <button onclick="document.getElementById('intent-add-section').style.display='block'; document.getElementById('intent-edit-section').style.display='none';">Add New</button>
                            <button onclick="document.getElementById('intent-add-section').style.display='none'; document.getElementById('intent-edit-section').style.display='block';">Edit Existing</button>
                        </div>

                        <div id="intent-add-section">
                            <div id="addIntentStatus"></div>
                            <form id="intentAddForm">
                                <label>Name</label><input type="text" name="nameAdd" id="nameAdd">
                                <label>Description</label><input type="text" name="descriptionAdd" id="descriptionAdd">
                                <label>Utterances (comma sep)</label><input type="text" name="utterancesAdd" id="utterancesAdd">
                                <div id="intentAddSelect"></div>
                                <label>Param Name (opt)</label><input type="text" name="paramnameAdd" id="paramnameAdd">
                                <label>Param Value (opt)</label><input type="text" name="paramvalueAdd" id="paramvalueAdd">
                                <label>Exec Path (opt)</label><input type="text" name="execAdd" id="execAdd">
                                <label>Exec Args (opt)</label><input type="text" name="execAddArgs" id="execAddArgs">
                                <label>Lua Script (opt)</label><textarea name="luaAdd" id="luaAdd" style="height:80px;"></textarea>
                            </form>
                            <button onclick="sendIntentAdd()">Add Intent</button>
                        </div>

                        <div id="intent-edit-section" style="display:none;">
                            <div id="editSelect"></div>
                            <div style="margin: 1rem 0;">
                                <button onclick="editFormCreate()">Edit Selected</button>
                                <button onclick="deleteSelectedIntent()" style="border-color:#b83838; color:#b83838;">Delete Selected</button>
                            </div>
                            <div id="editIntentForm"></div>
                            <div id="editIntentStatus"></div>
                        </div>

                        <button class="btn-back">Press BACK</button>
                    </div>

                    <div id="screen-log" class="screen panel info-panel-body">
                        <h2 class="text-2xl font-bold uppercase" style="color: #39ff14; margin-bottom: 1rem; letter-spacing: 0.1em;">SYSTEM LOG</h2>
                        <div style="margin-bottom: 0.5rem; font-size: 0.8em;">
                            <input type="checkbox" id="logdebug"> <label for="logdebug" style="display:inline;">Debug</label>
                            <input type="checkbox" id="logscrollbottom" checked> <label for="logscrollbottom" style="display:inline;">Auto-Scroll</label>
                        </div>
                        <textarea id="botTranscriptedTextArea" readonly></textarea>
                        <button class="btn-back">Press BACK</button>
                    </div>

                    <div id="screen-version_info" class="screen panel">
                        <div class="info-panel-body" style="display: flex; flex-direction: column; height: 100%;">
                            <h2 class="text-2xl font-bold uppercase" style="color: #39ff14; margin-bottom: 1rem; border-bottom: 1px solid #2b5c2b; padding-bottom: 0.5rem; letter-spacing: 0.1em;">VERSION INFO</h2>
                            <div class="info-content">
                                <div class="animate-scroll-text absolute" style="top: 0; width: 100%;">
                                    <p>XPOD Interface for Wire-Pod</p><br/>
                                    <p>Wire-Pod is an open-source server enabling Vector robots to function independently.</p>
                                    <p>Freeing robots from the cloud since 2022.</p><br/>
                                    <p id="cVersion">Loading...</p>
                                    <p id="aUpdate">Checking...</p>
                                    <p id="cCommit" style="display:none;"></p>
                                    <a id="updateGuideLink" href="https://github.com/kercre123/wire-pod/wiki/Things-to-Know#updating-wire-pod" target="_blank" style="display:none; color: #39ff14;">[UPDATE GUIDE]</a>
                                </div>
                            </div>
                            <div style="margin-top:auto">
                                <button onclick="checkUpdate()" style="width:100%;">Check Updates</button>
                                <button class="btn-back">Press BACK</button>
                            </div>
                        </div>
                    </div>

                    <div id="screen-ui_settings" class="screen panel info-panel-body">
                        <h2 class="text-2xl font-bold uppercase" style="color: #39ff14; margin-bottom: 1rem; letter-spacing: 0.1em;">UI SETTINGS</h2>
                        
                        <label>Theme Selection</label>
                        <select id="themeSelection">
                            <!-- Populated dynamically via theme-loader.js -->
                        </select>
                        <button onclick="setTheme()" style="margin-top:0.5rem;">Apply Theme</button>
                        
                        <hr>
                        
                        <label>Accent Color</label>
                        <select onchange="setUIColor()" id="accent-color-choose">
                            <option value="teal" selected="selected">Teal</option>
                            <option value="orange">Orange</option>
                            <option value="yellow">Yellow</option>
                            <option value="lime">Lime</option>
                            <option value="sapphire">Sapphire</option>
                            <option value="purple">Purple</option>
                            <option value="green">Green</option>
                        </select>

                        <button class="btn-back">Press BACK</button>
                    </div>

                </div>
            </div>

            <div class="hud">
                <div class="hud-item">
                    <div class="btn-icon btn-a">A</div> Select
                </div>
                <div class="hud-item">
                    <div class="btn-icon btn-b">B</div> Back
                </div>
            </div>
        </div>
        `;

        document.body.style.visibility = "visible";
        document.body.style.opacity = 1;

        if (window.populateThemeSelector) {
            window.populateThemeSelector();
            const themeSel = document.getElementById("themeSelection");
            if (themeSel) themeSel.value = "xpod";
        }

        initXPodLogic();
        
        if (typeof checkInited === "function") checkInited();
        if (typeof updateIntentSelection === "function") {
            updateIntentSelection("editSelect");
            updateIntentSelection("deleteSelect");
        }
        if (typeof createIntentSelect === "function") createIntentSelect("intentAddSelect");
        if (typeof processBotStats === "function") processBotStats();
    }

    function initXPodLogic() {
        const state = {
            screen: 'main',
            mainIndex: 0,
            bootSequence: true,
            isAngry: false,
            isBlinking: false,
            lookDir: { x: 0, y: 0 },
            isTrackingMouse: false
        };

        const mainMenuData = [
            { label: 'SERVER SETTINGS', icon: 'fa-solid fa-gear', id: 'server_settings', external: 'setup.html' },
            { label: 'BOT SETTINGS', icon: 'fa-solid fa-briefcase', id: 'bot_settings', external: '/sdkapp' },
            { label: 'BOT SETUP', icon: 'fa-solid fa-robot', id: 'bot_setup' },
            { label: 'CUSTOM INTENTS', icon: 'fa-solid fa-microphone', id: 'custom_intents' },
            { label: 'LOG', icon: 'fa-solid fa-file-lines', id: 'log' },
            { label: 'VERSION INFO', icon: 'fa-solid fa-code-branch', id: 'version_info' },
            { label: 'UI SETTINGS', icon: 'fa-solid fa-pen-nib', id: 'ui_settings' }
        ];

        let mouseIdleTimer = null;
        let angryTimer = null;

        const mainList = document.getElementById('main-menu-list');
        const screenTitle = document.getElementById('screen-title');
        const versionInfo = document.getElementById('version-info');
        const bootScreen = document.getElementById('boot-screen');
        const eyesContainer = document.getElementById('eyes-container');
        const eyeLeft = document.getElementById('eye-left');
        const eyeRight = document.getElementById('eye-right');

        setTimeout(() => {
            state.bootSequence = false;
            bootScreen.classList.add('hidden');
        }, 3500);

        fetch("/api/get_version_info")
            .then(r => r.json())
            .then(data => {
                versionInfo.innerHTML = `V: ${data.currentversion || 'Unknown'}<br>C: ${data.installedcommit || 'Unknown'}`;
            })
            .catch(() => versionInfo.innerText = "OFFLINE");

        function renderMainMenu() {
            mainList.innerHTML = '';
            mainMenuData.forEach((item, index) => {
                const li = document.createElement('li');
                li.className = "menu-item";
                li.innerHTML = `
                    <div class="menu-text">${item.label}</div>
                    <div class="menu-icon"><i class="${item.icon}"></i></div>
                `;
                li.addEventListener('mouseenter', () => {
                    state.mainIndex = index;
                    updateMainMenuVisuals();
                });
                li.addEventListener('click', () => handleMainSelect(item));
                mainList.appendChild(li);
            });
            updateMainMenuVisuals();
        }

        function updateMainMenuVisuals() {
            const items = mainList.children;
            for (let i = 0; i < items.length; i++) {
                const li = items[i];
                if (i === state.mainIndex) {
                    li.classList.add('active');
                    li.classList.remove('inactive');
                } else {
                    li.classList.remove('active');
                    li.classList.add('inactive');
                }
            }
        }

        function handleMainSelect(item) {
            if (item.external) {
                window.location.href = item.external;
                return;
            }
            setScreen(item.id);
        }

        function setScreen(newScreen) {
            state.screen = newScreen;
            updateScreenVisibility();
            if (newScreen === 'log') {
                if (typeof showLog === "function") showLog(); 
            } else if (newScreen === 'version_info') {
                if (typeof checkUpdate === "function") checkUpdate();
            } else {
                if (typeof GetLog !== 'undefined') window.GetLog = false;
            }
        }

        function updateScreenVisibility() {
            document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
            screenTitle.innerText = state.screen === 'main' ? 'DASHBOARD' : state.screen.replace('_', ' ').toUpperCase();
            
            if (state.screen === 'main') {
                document.getElementById('screen-main').classList.add('active');
            } else {
                const targetEl = document.getElementById(`screen-${state.screen}`);
                if (targetEl) targetEl.classList.add('active');
                else setScreen('main');
            }
        }

        function animateEyes() {
            const pupilX = 50 + (state.lookDir.x * 35);
            const pupilY = 50 + (state.lookDir.y * 35);
            const transX = state.lookDir.x * 15;
            const transY = state.lookDir.y * 10;
            
            const scaleY = state.isBlinking ? 0.1 : 1;
            const scaleX = state.isBlinking ? 1.2 : (state.isAngry ? 1.1 : 1);

            const applyStyle = (el, side) => {
                let clipPath = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
                if (state.isAngry && !state.isBlinking) {
                    if (side === 'left') clipPath = 'polygon(0% 0%, 100% 40%, 100% 100%, 0% 100%)';
                    else clipPath = 'polygon(0% 40%, 100% 0%, 100% 100%, 0% 100%)';
                }
                el.style.background = `radial-gradient(circle at ${pupilX}% ${pupilY}%, #60ff40 0%, #39ff14 60%, #0f3f0f 100%)`;
                el.style.transform = `translate(${transX}px, ${transY}px) scale(${scaleX}, ${scaleY})`;
                el.style.clipPath = clipPath;
            };
            applyStyle(eyeLeft, 'left');
            applyStyle(eyeRight, 'right');
            requestAnimationFrame(animateEyes);
        }

        function handleMouseMove(e) {
            state.isTrackingMouse = true;
            if (mouseIdleTimer) clearTimeout(mouseIdleTimer);
            const x = (e.clientX / window.innerWidth) * 2 - 1;
            const y = (e.clientY / window.innerHeight) * 2 - 1;
            state.lookDir = { x, y };
            mouseIdleTimer = setTimeout(() => { state.isTrackingMouse = false; }, 2500);
        }

        function moveIdleEyes() {
            if (!state.isTrackingMouse) {
                state.lookDir = { x: (Math.random() * 2) - 1, y: (Math.random() * 1) - 0.5 };
            }
            setTimeout(moveIdleEyes, Math.random() * 3000 + 1000);
        }

        function handleKeyDown(e) {
            if (state.bootSequence) return;
            if (state.screen === 'main') {
                if (e.key === 'ArrowUp') {
                    state.mainIndex = state.mainIndex > 0 ? state.mainIndex - 1 : mainMenuData.length - 1;
                    updateMainMenuVisuals();
                } else if (e.key === 'ArrowDown') {
                    state.mainIndex = state.mainIndex < mainMenuData.length - 1 ? state.mainIndex + 1 : 0;
                    updateMainMenuVisuals();
                } else if (['Enter', ' ', 'ArrowRight'].includes(e.key)) {
                    handleMainSelect(mainMenuData[state.mainIndex]);
                }
            } else {
                if (['Backspace', 'Escape', 'ArrowLeft'].includes(e.key)) {
                    setScreen('main');
                }
            }
        }

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('mousemove', handleMouseMove);
        eyesContainer.addEventListener('click', (e) => {
            e.stopPropagation();
            state.isAngry = true;
            if (angryTimer) clearTimeout(angryTimer);
            angryTimer = setTimeout(() => { state.isAngry = false; }, 3000);
        });
        document.querySelectorAll('.btn-back').forEach(btn => btn.addEventListener('click', () => setScreen('main')));

        renderMainMenu();
        animateEyes();
        setInterval(() => { state.isBlinking = true; setTimeout(() => state.isBlinking = false, 200); }, 4000);
        setTimeout(moveIdleEyes, 1000);
    }
})();
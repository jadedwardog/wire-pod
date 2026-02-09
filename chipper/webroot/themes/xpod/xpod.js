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
    { label: 'SERVER SETTINGS', icon: 'fa-solid fa-gear', id: 'server_settings' },
    { label: 'BOT SETTINGS', icon: 'fa-solid fa-briefcase', id: 'bot_settings' },
    { label: 'BOT SETUP', icon: 'fa-solid fa-robot', id: 'bot_setup' },
    { label: 'CUSTOM INTENTS', icon: 'fa-solid fa-microphone', id: 'custom_intents' },
    { label: 'LOG', icon: 'fa-solid fa-file-lines', id: 'log' },
    { label: 'VERSION INFO', icon: 'fa-solid fa-code-branch', id: 'version_info' },
    { label: 'UI SETTINGS', icon: 'fa-solid fa-pen-nib', id: 'ui_settings' }
];

let mouseIdleTimer = null;
let angryTimer = null;

let bootScreen, mainList, screenTitle, versionInfo;
let eyeLeft, eyeRight, eyesContainer;

const mockVersions = {
    current: "1.00.WIRE.05",
    latest: "1.00.WIRE.09"
};

function init() {
    bootScreen = document.getElementById('boot-screen');
    mainList = document.getElementById('main-menu-list');
    screenTitle = document.getElementById('screen-title');
    versionInfo = document.getElementById('version-info');
    
    eyeLeft = document.getElementById('eye-left');
    eyeRight = document.getElementById('eye-right');
    eyesContainer = document.getElementById('eyes-container');

    if (!mainList) {
        return;
    }

    renderMainMenu();
    updateScreenVisibility();
    updateVersions();
    
    setTimeout(() => {
        state.bootSequence = false;
        bootScreen.classList.add('hidden');
    }, 4000);

    setInterval(updateClock, 1000);
    updateClock();

    animateEyes();
    setInterval(blinkEyes, 4000);
    setTimeout(moveIdleEyes, 1000); 

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousemove', handleMouseMove);
    eyesContainer.addEventListener('click', handleEyeClick);
    
    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.addEventListener('click', () => setScreen('main'));
    });
}

function updateVersions() {
    const kString = `C:${mockVersions.current}`;
    const dString = `A:${mockVersions.latest}`;

    if (versionInfo) {
        versionInfo.innerHTML = `${kString}<br/>${dString}`;
    }

    const scrollK = document.getElementById('scroll-k');
    const scrollD = document.getElementById('scroll-d');
    
    if (scrollK) scrollK.innerText = kString;
    if (scrollD) scrollD.innerText = dString;
}

function renderMainMenu() {
    mainList.innerHTML = '';
    mainMenuData.forEach((item, index) => {
        const li = document.createElement('li');
        li.className = "menu-item";
        
        li.innerHTML = `
            <div class="menu-text">${item.label}</div>
            <div class="menu-icon">
                <i class="${item.icon}"></i>
            </div>
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

function updateScreenVisibility() {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    
    screenTitle.innerText = state.screen === 'main' ? 'DASHBOARD' : state.screen.replace('_', ' ').toUpperCase();
    
    if (state.screen === 'main') {
        document.getElementById('screen-main').classList.add('active');
        versionInfo.style.display = 'block';
    } else {
        const targetId = `screen-${state.screen}`;
        const targetEl = document.getElementById(targetId);
        
        if (targetEl) {
            targetEl.classList.add('active');
        } else {
            console.warn(`Screen ${targetId} not found`);
            setScreen('main');
            return;
        }
        versionInfo.style.display = 'none';
    }
}

function setScreen(newScreen) {
    state.screen = newScreen;
    updateScreenVisibility();
}

function updateClock() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    
    const timeEl = document.getElementById('time-display');
    const dateEl = document.getElementById('date-display');
    if(timeEl) timeEl.innerText = timeStr;
    if(dateEl) dateEl.innerText = dateStr;
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

function handleMainSelect(item) {
    setScreen(item.id);
}

function handleMouseMove(e) {
    state.isTrackingMouse = true;
    if (mouseIdleTimer) clearTimeout(mouseIdleTimer);

    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = (e.clientY / window.innerHeight) * 2 - 1;
    
    state.lookDir = { x, y };

    mouseIdleTimer = setTimeout(() => {
        state.isTrackingMouse = false;
    }, 2500);
}

function handleEyeClick(e) {
    e.stopPropagation();
    state.isAngry = true;
    if (angryTimer) clearTimeout(angryTimer);
    angryTimer = setTimeout(() => {
        state.isAngry = false;
    }, 3000);
}

function blinkEyes() {
    state.isBlinking = true;
    setTimeout(() => { state.isBlinking = false; }, 200);
}

function moveIdleEyes() {
    if (!state.isTrackingMouse) {
        state.lookDir = {
            x: (Math.random() * 2) - 1,
            y: (Math.random() * 1) - 0.5
        };
    }
    setTimeout(moveIdleEyes, Math.random() * 3000 + 1000);
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

document.addEventListener('DOMContentLoaded', init);
(function() {
    window.themesArray = [
        {name: "Classic", value: "classic"},
        {name: "XPod", value: "xpod"}
    ];

    window.populateThemeSelector = function() {
        const select = document.getElementById("themeSelection");
        if (!select) return;
        
        if (select.options.length > 0 && select.options[0].value !== "") return;

        select.innerHTML = "";
        window.themesArray.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t.value;
            opt.textContent = t.name;
            select.appendChild(opt);
        });
    };

    function showUI() {
        const reveal = () => {
            document.body.style.visibility = "visible";
            document.body.style.opacity = 1;
        };

        if (document.body) {
            reveal();
        } else {
            document.addEventListener("DOMContentLoaded", reveal);
        }
    }

    function loadTheme() {
        fetch("/api/get_ui_config")
        .then(res => res.json())
        .then(config => {
            const theme = config.theme || "classic";
            applyThemeFiles(theme, true);
            
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", () => setSelectorValue(theme));
            } else {
                setSelectorValue(theme);
            }
        })
        .catch(e => {
            console.error("Failed to load theme config, defaulting to classic", e);
            applyThemeFiles("classic", true);
        });
    }

    function setSelectorValue(theme) {
        window.populateThemeSelector();
        const select = document.getElementById("themeSelection");
        if (select) select.value = theme;
    }

    function applyThemeFiles(theme, isInitialLoad) {
        const head = document.head;
        const oldLink = document.getElementById("theme-stylesheet");
        
        const newLink = document.createElement("link");
        newLink.rel = "stylesheet";
        newLink.type = "text/css";
        newLink.href = `themes/${theme}/style.css?v=${new Date().getTime()}`;
        newLink.id = "theme-stylesheet";
        
        newLink.onload = () => {
            if (oldLink && oldLink !== newLink) oldLink.remove();
            loadThemeJS(theme, isInitialLoad);
        };
        
        newLink.onerror = () => {
            console.error("Failed to load theme CSS:", theme);
            if (isInitialLoad) {
                if (theme !== "classic") applyThemeFiles("classic", true);
                else showUI(); 
            }
        };

        head.appendChild(newLink);
    }

    function loadThemeJS(theme, isInitialLoad) {
        const oldScript = document.getElementById("theme-script");
        if (oldScript) oldScript.remove();

        const newScript = document.createElement("script");
        newScript.src = `themes/${theme}/${theme}.js?v=${new Date().getTime()}`;
        newScript.id = "theme-script";
        
        newScript.onload = () => {
            if (isInitialLoad) showUI();
        };
        newScript.onerror = () => {
            console.error("Failed to load theme JS:", theme);
            if (isInitialLoad) showUI();
        };
        
        if (document.body) {
            document.body.appendChild(newScript);
        } else {
            document.head.appendChild(newScript);
        }
    }

    window.setTheme = function() {
        const select = document.getElementById("themeSelection");
        const theme = select.value;
        
        fetch("/api/set_ui_config", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({theme: theme})
        })
        .then(() => {
            applyThemeFiles(theme, false);
        });
    }

    loadTheme();
})();
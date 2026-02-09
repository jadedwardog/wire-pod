(function() {
    function loadTheme() {
        fetch("/api/get_ui_config")
        .then(res => res.json())
        .then(config => {
            const theme = config.theme || "classic";
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.type = "text/css";
            link.href = `themes/${theme}/style.css`;
            link.id = "theme-stylesheet";
            document.head.appendChild(link);
            
            const select = document.getElementById("themeSelection");
            if (select) select.value = theme;
        })
        .catch(e => {
            console.error("Failed to load theme config, defaulting to classic", e);
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.type = "text/css";
            link.href = "themes/classic/style.css";
            document.head.appendChild(link);
        });
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
            const oldLink = document.getElementById("theme-stylesheet");
            const newLink = document.createElement("link");
            newLink.rel = "stylesheet";
            newLink.type = "text/css";
            newLink.href = `themes/${theme}/style.css?v=${new Date().getTime()}`;
            newLink.id = "theme-stylesheet";
            
            newLink.onload = () => {
                if (oldLink) oldLink.remove();
            };
            
            document.head.appendChild(newLink);
        });
    }

    loadTheme();
})();
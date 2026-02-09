(function() {
    function applyDynamicStyles() {
        document.querySelectorAll("small").forEach(el => el.classList.add("desc"));
    }

    applyDynamicStyles();
})();
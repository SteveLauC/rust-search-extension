function Omnibox() {
    this.isChrome = navigator.userAgent.indexOf("Chrome") !== -1;
    // Firefox doesn't support tags in search suggestion.
    this.tagged = this.isChrome ?
        (tag, str) => `<${tag}>${str}</${tag}>` :
        (_, str) => str;

    this.browser = this.isChrome ? window.chrome : window.browser;
}

Omnibox.prototype.setupDefaultSuggestion = function() {
    let offlineMode = JSON.parse(localStorage.getItem('offline-mode'));
    offlineMode = (offlineMode === null) ? false : offlineMode;
    this.browser.omnibox.setDefaultSuggestion({
        description: `Search Rust docs ${ this.isChrome ? " for <match>%s</match>" : "" } on ${ offlineMode ? "offline mode" : "https://doc.rust-lang.org"}`
    });
};

Omnibox.prototype.bootstrap = function() {
    this.setupDefaultSuggestion();

    this.browser.omnibox.onInputChanged.addListener((query, suggestFn) => {
        if (!query) return;

        const searchResults = window.search(query);
        this.suggestResults = [];

        for (let result of searchResults) {
            this.appendSuggestResult(result);
        }

        if (this.suggestResults.length < 5 && /e\d{2,4}$/ig.test(query)) {
            this.appendErrorIndexResult(query, 5 - this.suggestResults.length);
        }

        if (this.suggestResults.length < 5) {
            this.appendCratesResult(query);
        }

        suggestFn(this.suggestResults);
    });

    this.browser.omnibox.onInputEntered.addListener(text => {
        if (text.startsWith("https://") || text.startsWith("file://")) {
            this.navigateToUrl(text);
        } else {
            this.navigateToUrl(`${window.rootPath}std/index.html?search=` + encodeURIComponent(text));
        }
    });
};

Omnibox.prototype.appendSuggestResult = function(item) {
    let description = item.displayPath + this.tagged("match", item.name);
    if (item.desc) {
        description += " - " + this.tagged("dim", escape(item.desc));
    }
    this.suggestResults.push({
        content: item.href,
        description: description,
    });
};

Omnibox.prototype.appendErrorIndexResult = function(query, length) {
    let baseIndex = parseInt(query.slice(1).padEnd(4, '0'));
    for (let i = 1; i <= length; i++) {
        let errorIndex = 'E' + String(baseIndex++).padStart(4, "0");
        this.suggestResults.push({
            content: "https://doc.rust-lang.org/error-index.html#" + errorIndex.toUpperCase(),
            description: "Search Rust error index for " + this.tagged("match", errorIndex.toUpperCase())
            + " on https://doc.rust-lang.org/error-index.html"
        });
    }
};

Omnibox.prototype.appendCratesResult = function(query) {
    this.suggestResults.push({
        content: "https://crates.io/search?q=" + encodeURIComponent(query),
        description: "Search Rust crates for " + this.tagged("match", query) + " on https://crates.io"
    });
};

Omnibox.prototype.navigateToUrl = function(url) {
    const openType = localStorage.getItem("open-type") || "current-tab";
    if (openType === "current-tab") {
        this.browser.tabs.query({active: true}, tab => {
            this.browser.tabs.update(tab.id, {url: url});
        });
    } else {
        this.browser.tabs.create({url: url});
    }
};

// Escape the five predefined entities to display them as text.
function escape(text) {
    text = text || "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
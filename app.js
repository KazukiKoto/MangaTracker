const storage = {
  load(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      console.warn("Failed to parse storage payload", err);
      return fallback;
    }
  },
  save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

const STORAGE_KEYS = {
  websites: "mangaTracker:websites",
  series: "mangaTracker:series"
};

const state = {
  websites: storage.load(STORAGE_KEYS.websites, []),
  series: storage.load(STORAGE_KEYS.series, [])
};

const mockCatalogs = {
  "mangadex.org": [
    "Frieren: Beyond Journey's End",
    "Blue Period",
    "Mission: Yozakura Family",
    "Delicious in Dungeon"
  ],
  "manganato.com": [
    "One Piece",
    "Blue Lock",
    "Frieren: Beyond Journey's End",
    "Skip and Loafer"
  ],
  "tcbscans.com": [
    "One Piece",
    "Chainsaw Man",
    "My Hero Academia"
  ],
  "comikey.com": [
    "My Wife Has No Emotion",
    "Kowloon Generic Romance",
    "The Summer You Were There"
  ]
};

const selectors = {
  websiteForm: document.getElementById("website-form"),
  websiteList: document.getElementById("website-list"),
  seriesForm: document.getElementById("series-form"),
  seriesList: document.getElementById("series-list"),
  resultsList: document.getElementById("results-list"),
  emptyState: document.getElementById("results-empty"),
  tagTemplate: document.getElementById("tag-template"),
  resultTemplate: document.getElementById("result-template")
};

const init = () => {
  selectors.websiteForm.addEventListener("submit", handleWebsiteSubmit);
  selectors.seriesForm.addEventListener("submit", handleSeriesSubmit);
  selectors.websiteList.addEventListener("click", handleWebsiteRemoval);
  selectors.seriesList.addEventListener("click", handleSeriesRemoval);
  render();
};

const handleWebsiteSubmit = event => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const label = formData.get("label").trim();
  const url = formData.get("url").trim();
  if (!label || !url) return;

  const normalized = normalizeHost(url);
  const exists = state.websites.some(site => normalizeHost(site.url) === normalized);
  if (exists) {
    event.currentTarget.reset();
    return;
  }

  state.websites.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    label,
    url
  });
  storage.save(STORAGE_KEYS.websites, state.websites);
  event.currentTarget.reset();
  render();
};

const handleSeriesSubmit = event => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const title = formData.get("title").trim();
  if (!title) return;

  const exists = state.series.some(item => item.title.toLowerCase() === title.toLowerCase());
  if (exists) {
    event.currentTarget.reset();
    return;
  }

  state.series.push({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    title
  });
  storage.save(STORAGE_KEYS.series, state.series);
  event.currentTarget.reset();
  render();
};

const handleWebsiteRemoval = event => {
  if (!event.target.classList.contains("tag-remove")) return;
  const id = event.target.closest("li").dataset.id;
  state.websites = state.websites.filter(site => site.id !== id);
  storage.save(STORAGE_KEYS.websites, state.websites);
  render();
};

const handleSeriesRemoval = event => {
  if (!event.target.classList.contains("tag-remove")) return;
  const id = event.target.closest("li").dataset.id;
  state.series = state.series.filter(item => item.id !== id);
  storage.save(STORAGE_KEYS.series, state.series);
  render();
};

const render = () => {
  renderTagList(selectors.websiteList, state.websites, site => site.label);
  renderTagList(selectors.seriesList, state.series, item => item.title);
  renderResults();
};

const renderTagList = (target, items, labelFn) => {
  target.innerHTML = "";
  const template = selectors.tagTemplate.content.firstElementChild;
  items.forEach(item => {
    const clone = template.cloneNode(true);
    clone.dataset.id = item.id;
    clone.querySelector(".tag-label").textContent = labelFn(item);
    target.appendChild(clone);
  });
};

const renderResults = () => {
  const matches = collectMatches();
  selectors.resultsList.innerHTML = "";

  if (!matches.length) {
    selectors.emptyState.hidden = false;
    return;
  }

  selectors.emptyState.hidden = true;
  const template = selectors.resultTemplate.content.firstElementChild;
  matches.forEach(match => {
    const clone = template.cloneNode(true);
    clone.querySelector(".result-title").textContent = match.title;
    clone.querySelector(".result-sources").textContent = `Found on ${match.sources.join(", ")}`;
    selectors.resultsList.appendChild(clone);
  });
};

const collectMatches = () => {
  if (!state.websites.length || !state.series.length) return [];
  const whitelist = new Map();
  state.series.forEach(item => {
    whitelist.set(item.title.toLowerCase(), item.title);
  });

  const matches = new Map();
  state.websites.forEach(site => {
    const host = normalizeHost(site.url);
    const catalog = mockCatalogs[host];
    if (!catalog) return;

    catalog.forEach(title => {
      if (!whitelist.has(title.toLowerCase())) return;
      const key = whitelist.get(title.toLowerCase());
      if (!matches.has(key)) {
        matches.set(key, { title: key, sources: new Set() });
      }
      matches.get(key).sources.add(site.label || host);
    });
  });

  return Array.from(matches.values()).map(entry => ({
    title: entry.title,
    sources: Array.from(entry.sources)
  }));
};

const normalizeHost = value => {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch (err) {
    return value.toLowerCase();
  }
};

// No backend yet, so the mock catalogs provide a predictable demo dataset.
init();

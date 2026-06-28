import { MAX_LOG_ENTRIES } from "./config.js";
import { fetchMatchingJobs, buildEndpointHint, buildSeekSearchUrl } from "./seek-service.js";
import { splitInput, summarizeJob } from "./summarizer.js";
import { clearSeenJobIds, readSeenJobIds, readSettings, saveSeenJobIds, saveSettings } from "./storage.js";

const settingsForm = document.querySelector("#settings-form");
const keywordsInput = document.querySelector("#keywords-input");
const termsInput = document.querySelector("#terms-input");
const locationInput = document.querySelector("#location-input");
const sourceInput = document.querySelector("#source-input");
const intervalInput = document.querySelector("#interval-input");
const refreshButton = document.querySelector("#refresh-button");
const clearButton = document.querySelector("#clear-button");
const jobList = document.querySelector("#job-list");
const activityLog = document.querySelector("#activity-log");
const runStatus = document.querySelector("#run-status");
const cycleOutput = document.querySelector("#cycle-output");
const matchCountOutput = document.querySelector("#match-count-output");
const lastReadOutput = document.querySelector("#last-read-output");
const seekSearchLink = document.querySelector("#seek-search-link");
const requirementTags = document.querySelector("#requirement-tags");

let settings = readSettings();
let seenJobIds = readSeenJobIds();
let cycleTimerId = null;
let cycleNumber = 0;
let isReading = false;

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function setRunStatus(text, state = "idle") {
  runStatus.textContent = text;
  runStatus.dataset.state = state;
}

function addLog(message, state = "info") {
  const item = document.createElement("li");
  const time = document.createElement("span");
  const text = document.createElement("span");

  item.dataset.state = state;
  time.className = "log-time";
  time.textContent = formatTime();
  text.textContent = message;

  item.append(time, text);
  activityLog.prepend(item);

  while (activityLog.children.length > MAX_LOG_ENTRIES) {
    activityLog.lastElementChild.remove();
  }
}

function renderRequirementTags() {
  const fragment = document.createDocumentFragment();
  [...settings.keywords, ...settings.contractTerms, settings.location]
    .filter(Boolean)
    .forEach((tag) => {
      const item = document.createElement("span");
      item.textContent = tag;
      fragment.append(item);
    });

  requirementTags.replaceChildren(fragment);
}

function fillSettingsForm() {
  keywordsInput.value = settings.keywords.join("\n");
  termsInput.value = settings.contractTerms.join("\n");
  locationInput.value = settings.location;
  sourceInput.value = settings.sourceEndpoint;
  intervalInput.value = settings.intervalSeconds;
  cycleOutput.textContent = `${settings.intervalSeconds}s`;
  seekSearchLink.href = buildSeekSearchUrl(settings);
  seekSearchLink.title = buildEndpointHint(settings);
  renderRequirementTags();
}

function readFormSettings() {
  return {
    keywords: splitInput(keywordsInput.value),
    contractTerms: splitInput(termsInput.value),
    location: locationInput.value.trim(),
    sourceEndpoint: sourceInput.value.trim(),
    intervalSeconds: Math.max(10, Number(intervalInput.value || 10))
  };
}

function renderEmptyState(message) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.innerHTML = `
    <span data-lucide="search-x" aria-hidden="true"></span>
    <strong>No matched jobs yet</strong>
    <p>${message}</p>
  `;
  jobList.replaceChildren(empty);
  window.lucide?.createIcons();
}

function renderJob(job) {
  const article = document.createElement("article");
  article.className = "job-card";
  article.dataset.isNew = String(!seenJobIds.has(job.id));

  const hitTags = job.match.hits.map((hit) => `<span>${hit}</span>`).join("");
  const safeSummary = summarizeJob(job, settings);
  const jobUrl = job.url || seekSearchLink.href;

  article.innerHTML = `
    <div class="job-card-topline">
      <div>
        <p class="source-line">${job.source}${article.dataset.isNew === "true" ? " / New" : ""}</p>
        <h3>${job.title}</h3>
      </div>
      <a class="open-job-link" href="${jobUrl}" target="_blank" rel="noreferrer" aria-label="Open ${job.title}">
        <span data-lucide="arrow-up-right" aria-hidden="true"></span>
      </a>
    </div>
    <dl class="job-details">
      <div><dt>Company</dt><dd>${job.company}</dd></div>
      <div><dt>Location</dt><dd>${job.location}</dd></div>
      <div><dt>Type</dt><dd>${job.workType}</dd></div>
      <div><dt>Salary</dt><dd>${job.salary}</dd></div>
      <div><dt>Listed</dt><dd>${job.listedAt}</dd></div>
    </dl>
    <div class="match-tags">${hitTags}</div>
    <div class="summary-block">
      <p class="eyebrow">Description Summary</p>
      <p>${safeSummary}</p>
    </div>
  `;

  return article;
}

function renderJobs(jobs, sourceMode) {
  matchCountOutput.textContent = String(jobs.length);

  if (!jobs.length) {
    renderEmptyState(sourceMode === "demo" ? "Demo data is loaded. Add a permitted JSON source endpoint for live results." : "The source endpoint returned no roles matching the saved requirements.");
    return;
  }

  const fragment = document.createDocumentFragment();
  jobs.forEach((job) => {
    fragment.append(renderJob(job));
    seenJobIds.add(job.id);
  });

  saveSeenJobIds(seenJobIds);
  jobList.replaceChildren(fragment);
  window.lucide?.createIcons();
}

function scheduleNextRead() {
  window.clearTimeout(cycleTimerId);
  cycleTimerId = window.setTimeout(readJobs, settings.intervalSeconds * 1000);
}

async function readJobs() {
  if (isReading) {
    return;
  }

  isReading = true;
  cycleNumber += 1;
  setRunStatus("Reading", "reading");

  try {
    const { jobs, sourceMode, seekUrl } = await fetchMatchingJobs(settings);
    seekSearchLink.href = seekUrl;
    renderJobs(jobs, sourceMode);
    lastReadOutput.textContent = formatTime();
    addLog(`Cycle ${cycleNumber}: ${jobs.length} matches from ${sourceMode}`, jobs.length ? "ok" : "warn");
    setRunStatus(sourceMode === "demo" ? "Demo" : "Live", sourceMode === "demo" ? "warn" : "live");
  } catch (error) {
    addLog(`Cycle ${cycleNumber}: ${error.message}`, "error");
    setRunStatus("Source error", "error");
  } finally {
    isReading = false;
    scheduleNextRead();
  }
}

function saveCurrentSettings() {
  settings = readFormSettings();
  saveSettings(settings);
  fillSettingsForm();
  addLog("Settings saved", "ok");
  readJobs();
}

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveCurrentSettings();
});

refreshButton.addEventListener("click", () => {
  readJobs();
});

clearButton.addEventListener("click", () => {
  clearSeenJobIds();
  seenJobIds = new Set();
  addLog("Seen jobs cleared", "ok");
  readJobs();
});

fillSettingsForm();
renderEmptyState("Waiting for the first read cycle.");
addLog(`Monitoring every ${settings.intervalSeconds} seconds`);
readJobs();
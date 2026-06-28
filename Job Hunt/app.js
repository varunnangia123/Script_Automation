import { CONTRACT_CONDITIONS, ROLE_CONDITIONS } from "./config.js";
import { fetchMatchingJobs, buildEndpointHint, buildSeekSearchUrl } from "./seek-service.js";
import { summarizeJob } from "./summarizer.js";
import { clearSeenJobIds, normalizeSettings, readSeenJobIds, readSettings, saveSeenJobIds, saveSettings } from "./storage.js";

const settingsForm = document.querySelector("#settings-form");
const roleOptions = document.querySelector("#role-options");
const contractOptions = document.querySelector("#contract-options");
const locationInput = document.querySelector("#location-input");
const sourceInput = document.querySelector("#source-input");
const intervalInput = document.querySelector("#interval-input");
const refreshButton = document.querySelector("#refresh-button");
const clearButton = document.querySelector("#clear-button");
const jobList = document.querySelector("#job-list");
const runStatus = document.querySelector("#run-status");
const cycleOutput = document.querySelector("#cycle-output");
const matchCountOutput = document.querySelector("#match-count-output");
const lastReadOutput = document.querySelector("#last-read-output");
const seekSearchLink = document.querySelector("#seek-search-link");
const requirementTags = document.querySelector("#requirement-tags");

let settings = readSettings();
let seenJobIds = readSeenJobIds();
let cycleTimerId = null;
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

function renderRequirementTags() {
  const fragment = document.createDocumentFragment();
  [...settings.roleLabels, ...settings.contractLabels, settings.location]
    .filter(Boolean)
    .forEach((tag) => {
      const item = document.createElement("span");
      item.textContent = tag;
      fragment.append(item);
    });

  requirementTags.replaceChildren(fragment);
}

function renderCheckboxGroup(container, conditions, selectedIds) {
  const selected = new Set(selectedIds);
  const fragment = document.createDocumentFragment();

  conditions.forEach((condition) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    const text = document.createElement("span");

    label.className = "check-option";
    input.type = "checkbox";
    input.value = condition.id;
    input.checked = selected.has(condition.id);
    text.textContent = condition.label;

    label.append(input, text);
    fragment.append(label);
  });

  container.replaceChildren(fragment);
}

function readCheckedIds(container) {
  return [...container.querySelectorAll("input[type='checkbox']:checked")].map((input) => input.value);
}

function fillSettingsForm() {
  renderCheckboxGroup(roleOptions, ROLE_CONDITIONS, settings.selectedRoleIds);
  renderCheckboxGroup(contractOptions, CONTRACT_CONDITIONS, settings.selectedContractIds);
  locationInput.value = settings.location;
  sourceInput.value = settings.sourceEndpoint;
  intervalInput.value = settings.intervalSeconds;
  cycleOutput.textContent = `${settings.intervalSeconds}s`;
  seekSearchLink.href = buildSeekSearchUrl(settings);
  seekSearchLink.title = buildEndpointHint(settings);
  renderRequirementTags();
}

function readFormSettings() {
  return normalizeSettings({
    selectedRoleIds: readCheckedIds(roleOptions),
    selectedContractIds: readCheckedIds(contractOptions),
    location: locationInput.value.trim(),
    sourceEndpoint: sourceInput.value.trim(),
    intervalSeconds: Math.max(10, Number(intervalInput.value || 10))
  });
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = String(value || "");
  return element.innerHTML;
}

function renderEmptyState(message) {
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.innerHTML = `
    <span data-lucide="search-x" aria-hidden="true"></span>
    <strong>No matched jobs yet</strong>
    <p>${escapeHtml(message)}</p>
  `;
  jobList.replaceChildren(empty);
  window.lucide?.createIcons();
}


function companyInitials(company) {
  return String(company || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";
}

function renderCompanyLogo(job) {
  const safeCompany = escapeHtml(job.company);
  const safeLogoUrl = escapeHtml(job.logoUrl);

  if (safeLogoUrl) {
    return `<img src="${safeLogoUrl}" alt="${safeCompany} logo" loading="lazy" referrerpolicy="no-referrer">`;
  }

  return `<span>${escapeHtml(companyInitials(job.company))}</span>`;
}

function renderJob(job) {
  const article = document.createElement("article");
  article.className = "job-card";
  article.dataset.isNew = String(!seenJobIds.has(job.id));

  const hitTags = job.match.hits.map((hit) => `<span>${escapeHtml(hit)}</span>`).join("");
  const safeSummary = escapeHtml(summarizeJob(job, settings));
  const jobUrl = job.url || seekSearchLink.href;
  const safeTitle = escapeHtml(job.title);

  article.innerHTML = `
    <div class="job-card-topline">
      <div>
        <p class="source-line">${escapeHtml(job.source)}${article.dataset.isNew === "true" ? " / New" : ""}</p>
        <h3>${safeTitle}</h3>
      </div>
      <a class="open-job-link" href="${escapeHtml(jobUrl)}" target="_blank" rel="noreferrer" aria-label="Open ${safeTitle}">
        <span data-lucide="arrow-up-right" aria-hidden="true"></span>
      </a>
    </div>
    <dl class="job-details">
      <div><dt>Company</dt><dd>${escapeHtml(job.company)}</dd></div>
      <div><dt>Location</dt><dd>${escapeHtml(job.location)}</dd></div>
      <div><dt>Type</dt><dd>${escapeHtml(job.workType)}</dd></div>
      <div><dt>Salary</dt><dd>${escapeHtml(job.salary)}</dd></div>
      <div><dt>Listed</dt><dd>${escapeHtml(job.listedAt)}</dd></div>
    </dl>
    <div class="match-tags">${hitTags}</div>
    <div class="summary-block">
      <div class="company-logo">${renderCompanyLogo(job)}</div>
      <div>
        <p class="eyebrow">Description Summary</p>
        <p>${safeSummary}</p>
      </div>
    </div>
  `;

  const logoImage = article.querySelector(".company-logo img");
  logoImage?.addEventListener("error", () => {
    logoImage.replaceWith(createLogoFallback(job.company));
  });

  return article;
}

function createLogoFallback(company) {
  const fallback = document.createElement("span");
  fallback.textContent = companyInitials(company);
  return fallback;
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
  setRunStatus("Reading", "reading");

  try {
    const { jobs, sourceMode, seekUrl } = await fetchMatchingJobs(settings);
    seekSearchLink.href = seekUrl;
    renderJobs(jobs, sourceMode);
    lastReadOutput.textContent = formatTime();
    setRunStatus(sourceMode === "demo" ? "Demo" : "Live", sourceMode === "demo" ? "warn" : "live");
  } catch (error) {
    renderEmptyState(`Could not read the source endpoint: ${error.message}`);
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
  readJobs();
});

fillSettingsForm();
renderEmptyState("Waiting for the first read cycle.");
readJobs();
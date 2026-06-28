import { DEMO_JOBS, FETCH_TIMEOUT_MS, MAX_RESULTS } from "./config.js";
import { scoreJob } from "./summarizer.js";

function encodeQuery(value) {
  return encodeURIComponent(value).replace(/%20/g, "+");
}

function pickFirst(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "") || "";
}

function absoluteUrl(url) {
  if (!url) {
    return "";
  }

  return url.startsWith("http") ? url : `https://www.seek.com.au${url.startsWith("/") ? "" : "/"}${url}`;
}

export function buildSeekSearchUrl(settings) {
  const keywordQuery = [...settings.keywords, ...settings.contractTerms].join(" ");
  const baseUrl = "https://www.seek.com.au/jobs";
  const params = new URLSearchParams();

  if (keywordQuery) {
    params.set("keywords", keywordQuery);
  }

  if (settings.location) {
    params.set("where", settings.location);
  }

  return `${baseUrl}?${params.toString()}`;
}

function normalizeJob(rawJob, index) {
  const id = pickFirst(rawJob.id, rawJob.jobId, rawJob.guid, rawJob.listingId, rawJob.url, rawJob.link, `job-${index}`);
  const title = pickFirst(rawJob.title, rawJob.jobTitle, rawJob.positionTitle, "Untitled role");
  const company = pickFirst(rawJob.company, rawJob.companyName, rawJob.advertiser?.description, rawJob.advertiser?.name, "Unknown company");
  const location = pickFirst(rawJob.location, rawJob.locationName, rawJob.locations?.[0]?.label, rawJob.address, "Location not supplied");
  const workType = pickFirst(rawJob.workType, rawJob.workTypeLabel, rawJob.jobType, rawJob.employmentType, "Work type not supplied");
  const salary = pickFirst(rawJob.salary, rawJob.salaryLabel, rawJob.displaySalary, rawJob.remuneration, "Salary not supplied");
  const listedAt = pickFirst(rawJob.listedAt, rawJob.listedDate, rawJob.dateListed, rawJob.createdAt, rawJob.postedAt, "Date not supplied");
  const description = pickFirst(rawJob.description, rawJob.jobDescription, rawJob.teaser, rawJob.summary, rawJob.content, rawJob.abstract);
  const url = absoluteUrl(pickFirst(rawJob.url, rawJob.link, rawJob.jobUrl, rawJob.adDetails?.url));

  return {
    id: String(id),
    title,
    company,
    location,
    workType,
    salary,
    listedAt,
    description,
    url,
    source: pickFirst(rawJob.source, "SEEK")
  };
}

function unwrapJobs(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  return pickFirst(payload.jobs, payload.data, payload.results, payload.listings, payload.searchResults?.jobs) || [];
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal, headers: { "Accept": "application/json" } });

    if (!response.ok) {
      throw new Error(`Source returned HTTP ${response.status}`);
    }

    return response.json();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function fetchMatchingJobs(settings) {
  const sourceUrl = settings.sourceEndpoint.trim();
  const payload = sourceUrl ? await fetchWithTimeout(sourceUrl) : DEMO_JOBS;
  const jobs = unwrapJobs(payload)
    .map(normalizeJob)
    .map((job) => ({ ...job, match: scoreJob(job, settings) }))
    .filter((job) => job.match.isMatch)
    .sort((left, right) => right.match.score - left.match.score)
    .slice(0, MAX_RESULTS);

  return {
    jobs,
    sourceMode: sourceUrl ? "endpoint" : "demo",
    seekUrl: buildSeekSearchUrl(settings)
  };
}

export function buildEndpointHint(settings) {
  const query = encodeQuery([...settings.keywords, ...settings.contractTerms].join(" "));
  const location = encodeQuery(settings.location);
  return `keywords=${query}&where=${location}`;
}
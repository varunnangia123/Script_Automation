export const LOCAL_STORAGE_KEY = "job-hunt-monitor-settings";
export const SEEN_JOBS_STORAGE_KEY = "job-hunt-seen-jobs";
export const MAX_LOG_ENTRIES = 12;
export const MAX_RESULTS = 40;
export const FETCH_TIMEOUT_MS = 12000;

export const DEFAULT_SETTINGS = {
  keywords: ["Power BI", "PowerBI", "report developer", "data analyst", "business intelligence"],
  contractTerms: ["contract", "fixed term", "fixed-term", "monthly", "day rate", "6 month", "12 month"],
  location: "Australia",
  intervalSeconds: 10,
  sourceEndpoint: ""
};

export const DEMO_JOBS = [
  {
    id: "demo-power-bi-contract-sydney",
    title: "Power BI Report Developer",
    company: "Sample Analytics Partner",
    location: "Sydney NSW",
    workType: "Contract/Temp",
    salary: "$850 - $950 per day",
    listedAt: "Today",
    source: "Demo",
    url: "https://www.seek.com.au/power-bi-report-developer-contract-jobs",
    description: "Build Power BI dashboards, transform source data, tune DAX measures, and work with stakeholders on monthly reporting packs for a fixed-term delivery program."
  },
  {
    id: "demo-data-analyst-monthly",
    title: "Data Analyst - Power BI",
    company: "Sample Utilities Group",
    location: "Remote / Hybrid",
    workType: "Fixed term",
    salary: "$120k package pro rata",
    listedAt: "1d ago",
    source: "Demo",
    url: "https://www.seek.com.au/data-analyst-power-bi-contract-jobs",
    description: "Analyse operational data, maintain Power BI datasets, publish monthly KPI reporting, and support business users with clear insights and documentation."
  },
  {
    id: "demo-bi-analyst-brisbane",
    title: "BI Analyst - Reporting",
    company: "Sample Delivery Office",
    location: "Brisbane QLD",
    workType: "Contract/Temp",
    salary: "Competitive monthly contract",
    listedAt: "2d ago",
    source: "Demo",
    url: "https://www.seek.com.au/business-intelligence-analyst-contract-jobs",
    description: "Create reporting models, reconcile data quality issues, write SQL extracts, and deliver Power BI reports for finance and portfolio teams."
  }
];
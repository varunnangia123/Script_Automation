export const LOCAL_STORAGE_KEY = "job-hunt-monitor-settings";
export const SEEN_JOBS_STORAGE_KEY = "job-hunt-seen-jobs";
export const MAX_RESULTS = 40;
export const FETCH_TIMEOUT_MS = 12000;

export const ROLE_CONDITIONS = [
  {
    id: "power-bi-developer",
    label: "Power BI Developer",
    terms: ["power bi developer", "powerbi developer", "power bi", "powerbi", "dax"]
  },
  {
    id: "power-bi-report-developer",
    label: "Power BI Report Developer",
    terms: ["power bi report developer", "power bi reporting", "report developer", "dashboard developer"]
  },
  {
    id: "data-analyst",
    label: "Data Analyst",
    terms: ["data analyst", "data analyse", "data analysis", "analytics analyst", "insights analyst"]
  },
  {
    id: "data-engineer",
    label: "Data Engineer",
    terms: ["data engineer", "data engineering", "etl", "data pipeline"]
  },
  {
    id: "business-analyst",
    label: "Business Analyst",
    terms: ["business analyst", "business analysis", "requirements analyst"]
  },
  {
    id: "portfolio-analyst",
    label: "Portfolio Analyst",
    terms: ["portfolio analyst", "portfolio reporting", "pmo analyst", "program analyst"]
  }
];

export const CONTRACT_CONDITIONS = [
  {
    id: "contract",
    label: "Contract",
    terms: ["contract", "contract/temp", "contractor", "day rate"]
  },
  {
    id: "fixed-term",
    label: "Fixed Term",
    terms: ["fixed term", "fixed-term", "fixed term contract"]
  },
  {
    id: "three-month",
    label: "3 Month",
    terms: ["3 month", "3-month", "three month"]
  },
  {
    id: "six-month",
    label: "6 Month",
    terms: ["6 month", "6-month", "six month"]
  },
  {
    id: "monthly",
    label: "Monthly",
    terms: ["monthly", "fixed monthly", "per month", "month to month"]
  }
];

export const DEFAULT_SETTINGS = {
  selectedRoleIds: ROLE_CONDITIONS.map((condition) => condition.id),
  selectedContractIds: CONTRACT_CONDITIONS.map((condition) => condition.id),
  keywords: ROLE_CONDITIONS.flatMap((condition) => condition.terms),
  contractTerms: CONTRACT_CONDITIONS.flatMap((condition) => condition.terms),
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
    logoUrl: "",
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
    logoUrl: "",
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
    logoUrl: "",
    url: "https://www.seek.com.au/business-intelligence-analyst-contract-jobs",
    description: "Create reporting models, reconcile data quality issues, write SQL extracts, and deliver Power BI reports for finance and portfolio teams."
  },
  {
    id: "demo-data-engineer-six-month",
    title: "Data Engineer - BI Reporting",
    company: "Sample Data Office",
    location: "Melbourne VIC",
    workType: "6 month contract",
    salary: "$900 per day",
    listedAt: "3d ago",
    source: "Demo",
    logoUrl: "",
    url: "https://www.seek.com.au/data-engineer-power-bi-contract-jobs",
    description: "Deliver data pipelines, model reporting datasets, support Power BI semantic models, and improve ETL reliability for a six month contract."
  },
  {
    id: "demo-portfolio-analyst-fixed-term",
    title: "Portfolio Analyst - Power BI",
    company: "Sample Portfolio Team",
    location: "Parramatta NSW",
    workType: "Fixed term",
    salary: "$700 - $800 per day",
    listedAt: "4d ago",
    source: "Demo",
    logoUrl: "",
    url: "https://www.seek.com.au/portfolio-analyst-power-bi-contract-jobs",
    description: "Prepare portfolio reporting, refresh Power BI dashboards, analyse delivery performance, and support monthly executive packs for a fixed term role."
  }
];
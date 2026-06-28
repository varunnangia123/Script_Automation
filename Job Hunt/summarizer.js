const SUMMARY_SENTENCE_LIMIT = 3;

function normalizeText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sentenceScore(sentence, searchTerms) {
  const normalizedSentence = sentence.toLowerCase();
  return searchTerms.reduce((score, term) => normalizedSentence.includes(term.toLowerCase()) ? score + 1 : score, 0);
}

export function splitInput(value) {
  return String(value || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function summarizeJob(job, settings) {
  const description = normalizeText(job.description || job.summary || job.teaser || "");
  const searchTerms = [...settings.keywords, ...settings.contractTerms];
  const sentences = description.split(/(?<=[.!?])\s+/).filter(Boolean);
  const rankedSentences = sentences
    .map((sentence, index) => ({ sentence, index, score: sentenceScore(sentence, searchTerms) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, SUMMARY_SENTENCE_LIMIT)
    .sort((left, right) => left.index - right.index)
    .map((item) => item.sentence);

  return rankedSentences.length ? rankedSentences.join(" ") : "No description summary was supplied by the source endpoint.";
}

export function scoreJob(job, settings) {
  const content = normalizeText([
    job.title,
    job.company,
    job.location,
    job.workType,
    job.salary,
    job.description,
    job.summary,
    job.teaser
  ].join(" ")).toLowerCase();

  const keywordHits = settings.keywords.filter((term) => content.includes(term.toLowerCase()));
  const contractHits = settings.contractTerms.filter((term) => content.includes(term.toLowerCase()));
  const isMatch = keywordHits.length > 0 && contractHits.length > 0;

  return {
    isMatch,
    score: keywordHits.length + contractHits.length,
    hits: [...new Set([...keywordHits, ...contractHits])]
  };
}
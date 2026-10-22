/** A job posting read from the current page (fields match the API's CreateJobSchema). */
export type ExtractedJob = {
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  salary: string;
  remote: boolean;
  /** Which extractor found it: "linkedin", "indeed", "rozee", "bayt", "json-ld" or "page". */
  via: string;
};

export type Settings = { appUrl: string; token: string };

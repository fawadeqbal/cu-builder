import { AI_TASKS, matchJob, normalizeCV, type CV } from "@cvb/domain";
import { createApi, explain, type ResumeSummary } from "./lib/api";
import { startTailoring, tailorProblem } from "./lib/tailor";
import { valuesFromCV } from "./lib/fields";
import { loadSettings, originPattern } from "./lib/settings";
import type { ExtractedJob, Settings } from "./lib/types";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const input = (id: string) => $<HTMLInputElement>(id);

type Cvb = { extract: () => ExtractedJob; reviewFill: (values: Record<string, string>) => { found: number } };

let settings: Settings;
let tabId: number | undefined;
let cv: CV | null = null;

function message(text: string, kind: "err" | "ok" | "" = "", link?: { label: string; href?: string; options?: boolean }) {
  const el = $("message");
  el.className = kind;
  el.textContent = text;
  if (link) {
    const a = document.createElement("a");
    a.textContent = ` ${link.label}`;
    a.href = link.href ?? "#";
    a.target = "_blank";
    a.addEventListener("click", (e) => {
      if (link.options) {
        e.preventDefault();
        void chrome.runtime.openOptionsPage();
      }
    });
    el.append(a);
  }
}

function showError(e: unknown) {
  const x = explain(e);
  message(x.text, "err", x.pricing ? { label: "See plans", href: `${settings.appUrl}/pricing` } : x.settings ? { label: "Open settings", options: true } : undefined);
}

/** Runs a function from the injected content script in the active tab. */
async function inTab<A extends unknown[], R>(fn: (...args: A) => R, ...args: A): Promise<R> {
  if (tabId === undefined) throw new Error("No active tab");
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func: fn, args });
  return res?.result as R;
}

function readForm(): ExtractedJob {
  return {
    title: input("title").value,
    company: input("company").value,
    location: input("location").value,
    salary: input("salary").value,
    url: input("url").value,
    remote: input("remote").checked,
    description: $<HTMLTextAreaElement>("description").value,
    via: "",
  };
}

function fillForm(job: ExtractedJob) {
  input("title").value = job.title;
  input("company").value = job.company;
  input("location").value = job.location;
  input("salary").value = job.salary;
  input("url").value = job.url;
  input("remote").checked = job.remote;
  $<HTMLTextAreaElement>("description").value = job.description;
  $("descCount").textContent = job.description ? `${job.description.length.toLocaleString()} characters` : "No description found";
}

function renderMatch() {
  const box = $("match");
  const job = readForm();
  if (!cv || !job.description.trim()) {
    box.hidden = true;
    return;
  }
  const m = matchJob(cv, { title: job.title, description: job.description });
  box.hidden = false;
  $("score").textContent = `${m.score}%`;
  $("score").className = `score ${m.score >= 70 ? "good" : m.score >= 45 ? "mid" : "low"}`;
  const missing = m.missing.slice(0, 8);
  $("missing").textContent = missing.length ? `Missing: ${missing.join(", ")}` : "Your CV covers the key skills in this posting.";
}

async function chooseCv(id: string) {
  cv = null;
  renderMatch();
  if (!id) return;
  try {
    const r = await createApi(settings).resume(id);
    cv = normalizeCV(r.data);
    renderMatch();
  } catch (e) {
    showError(e);
  }
}

async function loadResumes() {
  const select = $<HTMLSelectElement>("cv");
  let items: ResumeSummary[] = [];
  try {
    items = await createApi(settings).resumes();
  } catch (e) {
    select.replaceChildren(Object.assign(document.createElement("option"), { value: "", textContent: "Couldn't load your CVs" }));
    showError(e);
    return;
  }
  select.replaceChildren(...items.map((r) => Object.assign(document.createElement("option"), { value: r.id, textContent: r.title })));
  if (!items.length) select.append(Object.assign(document.createElement("option"), { value: "", textContent: "No CVs yet" }));
  const { lastCv } = (await chrome.storage.local.get("lastCv")) as { lastCv?: string };
  if (lastCv && items.some((r) => r.id === lastCv)) select.value = lastCv;
  await chooseCv(select.value);
}

async function save() {
  const job = readForm();
  if (!job.title.trim()) return message("Add the job title first.", "err");
  const button = $<HTMLButtonElement>("save");
  button.disabled = true;
  button.textContent = "Saving…";
  try {
    const app = await createApi(settings).saveJob(job);
    message(`Saved “${app.job.title}” to your tracker.`, "ok", { label: "Open tracker", href: `${settings.appUrl}/tracker` });
    button.textContent = "Saved";
  } catch (e) {
    showError(e);
    button.disabled = false;
    button.textContent = "Save to tracker";
  }
}

/** Saves the job, then opens the web app's tailoring review for the chosen CV in a new tab. */
async function tailor() {
  const resumeId = $<HTMLSelectElement>("cv").value;
  const job = readForm();
  const problem = tailorProblem(job, resumeId);
  if (problem) {
    if (problem.problem === "no-description") $<HTMLDetailsElement>("descDetails").open = true;
    return message(problem.text, "err", problem.problem === "no-cv" ? { label: "Open CV Builder", href: `${settings.appUrl}/app` } : undefined);
  }
  const button = $<HTMLButtonElement>("tailor");
  button.disabled = true;
  button.textContent = "Saving the job…";
  try {
    const url = await startTailoring(createApi(settings), settings.appUrl, job, resumeId);
    message("Opening CV Builder… If you aren't signed in there, sign in and you'll come straight back to this job.", "ok");
    await chrome.tabs.create({ url });
  } catch (e) {
    showError(e);
  } finally {
    button.disabled = false;
    button.textContent = "Tailor my CV for this job";
  }
}

async function fill() {
  if (!cv) return message("Choose the CV to fill the form from.", "err");
  try {
    const values = valuesFromCV(cv);
    const { found } = await inTab((v: Record<string, string>) => (globalThis as unknown as { __cvb: Cvb }).__cvb.reviewFill(v), values);
    message(found ? `Review the ${found} field${found === 1 ? "" : "s"} on the page, then click Fill. Nothing is submitted.` : "No fields to fill were found on this page.", found ? "ok" : "err");
  } catch {
    message("This page can't be filled (browser pages and the Chrome Web Store are off limits).", "err");
  }
}

async function init() {
  settings = await loadSettings();
  $("openSettings").addEventListener("click", () => void chrome.runtime.openOptionsPage());
  $("setupSettings").addEventListener("click", () => void chrome.runtime.openOptionsPage());
  $<HTMLAnchorElement>("accountLink").href = `${settings.appUrl}/account`;
  if (!settings.token) {
    $("setup").hidden = false;
    return;
  }
  const allowed = await chrome.permissions.contains({ origins: [originPattern(settings.appUrl)] });
  if (!allowed) {
    $("setup").hidden = false;
    $("setupSteps").hidden = true;
    $("setupText").textContent = `Allow the extension to reach ${new URL(settings.appUrl).host}: open settings and click Save and test connection.`;
    return;
  }
  $("main").hidden = false;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  tabId = tab?.id;
  try {
    const job = await inTab(() => (globalThis as unknown as { __cvb: Cvb }).__cvb.extract());
    fillForm(job);
    if (!job.title) message("Couldn't find a job on this page. Fill in the details yourself.", "");
  } catch {
    fillForm({ title: tab?.title ?? "", company: "", location: "", salary: "", url: tab?.url?.startsWith("http") ? tab.url : "", remote: false, description: "", via: "" });
    message("This page can't be read. Fill in the details yourself.", "");
  }
  $("save").addEventListener("click", () => void save());
  $("tailor").addEventListener("click", () => void tailor());
  $("tailorNote").textContent = `Saves the job, then opens CV Builder to review AI suggestions in a new copy of your CV (${AI_TASKS.tailor} AI credits). Your original isn't changed.`;
  $("fill").addEventListener("click", () => void fill());
  $<HTMLSelectElement>("cv").addEventListener("change", (e) => {
    const id = (e.target as HTMLSelectElement).value;
    void chrome.storage.local.set({ lastCv: id });
    void chooseCv(id);
  });
  for (const id of ["title", "description"]) $(id).addEventListener("input", renderMatch);
  void loadResumes();
}

void init();

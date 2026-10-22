import { describe, expect, it } from "vitest";
import { emptyCV, normalizeCV } from "./model";
import { applyRegionPreset, cvDirection, cvLanguage, isRtlText, regionRules, showPhoto, visibleDetails } from "./regional";
import { sampleCV } from "./sample";

const PHOTO = "data:image/jpeg;base64,AAAA";

describe("regional presets", () => {
  it("US resumes use Letter, no photo and no personal details", () => {
    const cv = { ...sampleCV, photo: PHOTO, details: { ...sampleCV.details, dateOfBirth: "1 May 1995" } };
    const out = applyRegionPreset(cv, "us");
    expect(out.pageSize).toBe("LETTER");
    expect(showPhoto(out.cv)).toBe(false);
    expect(visibleDetails(out.cv)).toEqual([]);
    // Nothing is deleted: switching back shows the details again.
    const back = applyRegionPreset(out.cv, "south_asia").cv;
    expect(visibleDetails(back).map((d) => d.key)).toEqual(["dateOfBirth", "nationality"]);
  });

  it("Gulf CVs turn the photo on and show visa status", () => {
    const cv = { ...sampleCV, photo: PHOTO, settings: { ...sampleCV.settings, photo: { show: false, shape: "square" as const } } };
    const out = applyRegionPreset({ ...cv, details: { ...cv.details, visaStatus: "Visit visa" } }, "gulf");
    expect(out.pageSize).toBe("A4");
    expect(showPhoto(out.cv)).toBe(true);
    expect(visibleDetails(out.cv).map((d) => d.key)).toEqual(["nationality", "visaStatus"]);
  });

  it("suggests the Europass-style template", () => {
    expect(applyRegionPreset(sampleCV, "europass").template).toBe("classic");
    expect(regionRules("europass").details).toContain("dateOfBirth");
  });
});

describe("direction and language", () => {
  it("detects Urdu and Arabic", () => {
    expect(isRtlText("Sara Ahmed")).toBe(false);
    const urdu = normalizeCV({ personal: { name: "سارہ احمد", headline: "سافٹ ویئر ڈویلپر" } });
    expect(cvDirection(urdu)).toBe("rtl");
    expect(cvLanguage(urdu)).toBe("ur");
    const arabic = normalizeCV({ personal: { name: "سارة أحمد", headline: "مطورة برمجيات" } });
    expect(cvLanguage(arabic)).toBe("ar");
    expect(cvDirection(sampleCV)).toBe("ltr");
  });

  it("respects an explicit setting", () => {
    const cv = { ...emptyCV, settings: { ...emptyCV.settings, direction: "rtl" as const, language: "en" as const } };
    expect(cvDirection(cv)).toBe("rtl");
    expect(cvLanguage(cv)).toBe("en");
  });
});

describe("normalizeCV back-compat", () => {
  it("fills new fields for old CVs and rejects junk", () => {
    const old = normalizeCV({ personal: { name: "A" }, photo: "javascript:alert(1)", settings: { region: "mars", direction: "rtl" } });
    expect(old.details.nationality).toBe("");
    expect(old.photo).toBe("");
    expect(old.settings).toEqual({ direction: "rtl", language: "auto", region: "default", photo: { show: true, shape: "circle" } });
    expect(normalizeCV({ photo: PHOTO }).photo).toBe(PHOTO);
  });
});

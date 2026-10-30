// UAT trial, pending owner final approval 2026-10-26
// Compatibility exports retain the original values; editable defaults have one owner.
import { ABOUT_COPY_DEFAULTS } from "@/lib/content/about-copy-defaults";
export const FATHER_STORY_HEADING = ABOUT_COPY_DEFAULTS["about.father.heading"];
// Layout-only phrase grouping, not a second editable copy field.
export const FATHER_STORY_KEEP = "บริหารเวลา บริหารเงิน บริหารชีวิต";
export const FATHER_STORY_PARAGRAPHS = [
  ABOUT_COPY_DEFAULTS["about.father.paragraph1"],
  ABOUT_COPY_DEFAULTS["about.father.paragraph2"],
  ABOUT_COPY_DEFAULTS["about.father.paragraph3"],
  ABOUT_COPY_DEFAULTS["about.father.paragraph4"],
  ABOUT_COPY_DEFAULTS["about.father.paragraph5"],
  ABOUT_COPY_DEFAULTS["about.father.paragraph6"],
  ABOUT_COPY_DEFAULTS["about.father.paragraph7"],
] as const;
export const FATHER_STORY_QUESTIONS = [
  ABOUT_COPY_DEFAULTS["about.father.question1"],
  ABOUT_COPY_DEFAULTS["about.father.question2"],
  ABOUT_COPY_DEFAULTS["about.father.question3"],
] as const;
export const FATHER_PHOTO_CAPTION = ABOUT_COPY_DEFAULTS["about.father.caption"];

import { brandImage, OG_SIZE } from "@/lib/og";

export const alt = "CV Builder: build an ATS-friendly CV, check it and tailor it to each job";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return brandImage({ title: "A CV that gets you the interview", subtitle: "Build it step by step, check it against tracking systems and tailor it to each job. Free to start." });
}

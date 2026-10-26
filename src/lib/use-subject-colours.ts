import { useMemo } from "react";

import { useTimetableQuery } from "@/redux/services/portal-api";

import { dotOf, hueFor, subjectHues, toneOf } from "./name-hue";

/**
 * Each subject's colour, the same on Home, Timetable and Results.
 *
 * The hues are shared out over every subject in the class's timetable, so no
 * two of the class's subjects look alike (`subjectHues`). The timetable is
 * read once per pupil and kept with the rest of their reads. A subject that is
 * not on it, or a class with no published timetable, falls back to a hue from
 * the name alone.
 */
export function useSubjectColours(): { dot: (subject: string) => string; tone: (subject: string) => { background: string; color: string } } {
  const { data } = useTimetableQuery();
  return useMemo(() => {
    const hues = subjectHues((data?.days ?? []).flatMap((day) => day.cells.map((cell) => (cell.kind === "BREAK" ? "" : cell.subject ?? ""))));
    const hue = (subject: string) => hues.get(subject.trim().toLowerCase()) ?? hueFor(subject);
    return { dot: (subject) => dotOf(hue(subject)), tone: (subject) => toneOf(hue(subject)) };
  }, [data]);
}

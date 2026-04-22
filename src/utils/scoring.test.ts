import { describe, expect, it } from "vitest";
import type { Question } from "@/types/domain";
import { gradeAuto } from "@/utils/scoring";

function q(partial: Partial<Question> & Pick<Question, "type" | "answerKey" | "defaultScore">): Question {
  return {
    id: "q",
    teacherId: "t",
    type: partial.type,
    stem: [{ type: "text", text: "x" }],
    options: partial.options,
    answerKey: partial.answerKey,
    defaultScore: partial.defaultScore,
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
  };
}

describe("gradeAuto", () => {
  it("grades single choice", () => {
    expect(gradeAuto(q({ type: "single", answerKey: "A", defaultScore: 5 }), "A")).toBe(5);
    expect(gradeAuto(q({ type: "single", answerKey: "A", defaultScore: 5 }), "B")).toBe(0);
  });

  it("grades multiple choice ignoring order", () => {
    expect(gradeAuto(q({ type: "multiple", answerKey: ["A", "C"], defaultScore: 5 }), ["C", "A"])).toBe(5);
    expect(gradeAuto(q({ type: "multiple", answerKey: ["A", "C"], defaultScore: 5 }), ["A"])).toBe(0);
  });

  it("grades true/false", () => {
    expect(gradeAuto(q({ type: "true_false", answerKey: true, defaultScore: 2 }), true)).toBe(2);
    expect(gradeAuto(q({ type: "true_false", answerKey: true, defaultScore: 2 }), false)).toBe(0);
  });

  it("grades blank by trimmed string match", () => {
    expect(gradeAuto(q({ type: "blank", answerKey: "localStorage", defaultScore: 3 }), " localStorage ")).toBe(3);
    expect(gradeAuto(q({ type: "blank", answerKey: "localStorage", defaultScore: 3 }), "sessionStorage")).toBe(0);
  });

  it("does not auto-grade subjective", () => {
    expect(gradeAuto(q({ type: "short", answerKey: null, defaultScore: 10 }), "whatever")).toBe(0);
  });
});


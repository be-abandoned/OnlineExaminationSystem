import React from "react";
import type { Question } from "@/types/domain";
import QuestionOption from "./QuestionOption";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";

interface AnswerEditorProps {
  question: Question;
  value: unknown;
  onChange?: (v: unknown) => void;
  isDisabled?: boolean;
  isSubmitted?: boolean;
  correctAnswer?: any;
}

export default function AnswerEditor({
  question,
  value,
  onChange = () => {},
  isDisabled = false,
  isSubmitted = false,
  correctAnswer = null,
}: AnswerEditorProps) {
  if (question.type === "single") {
    return (
      <div className="grid gap-3">
        {(question.options ?? []).map((opt) => {
          const isSelected = value === opt.id;
          const isCorrect = isSubmitted && opt.id === correctAnswer;
          const isIncorrect = isSubmitted && isSelected && opt.id !== correctAnswer;

          return (
            <QuestionOption
              key={opt.id}
              label={opt.id}
              content={opt.text}
              isSelected={isSelected}
              isCorrect={isCorrect}
              isIncorrect={isIncorrect}
              isDisabled={isDisabled || isSubmitted}
              onSelect={() => onChange(opt.id)}
              type="radio"
            />
          );
        })}
      </div>
    );
  }
  if (question.type === "multiple") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    const correctArr = Array.isArray(correctAnswer) ? (correctAnswer as string[]) : [];

    return (
      <div className="grid gap-3">
        {(question.options ?? []).map((opt) => {
          const isSelected = arr.includes(opt.id);
          const isCorrect = isSubmitted && correctArr.includes(opt.id);
          const isIncorrect = isSubmitted && isSelected && !correctArr.includes(opt.id);

          return (
            <QuestionOption
              key={opt.id}
              label={opt.id}
              content={opt.text}
              isSelected={isSelected}
              isCorrect={isCorrect}
              isIncorrect={isIncorrect}
              isDisabled={isDisabled || isSubmitted}
              onSelect={() => {
                const next = new Set(arr);
                if (isSelected) next.delete(opt.id);
                else next.add(opt.id);
                onChange(Array.from(next));
              }}
              type="checkbox"
            />
          );
        })}
      </div>
    );
  }
  if (question.type === "true_false") {
    return (
      <div className="grid gap-3">
        {[
          { label: "对", v: true, key: "T" },
          { label: "错", v: false, key: "F" },
        ].map((it) => {
          const isSelected = value === it.v;
          const isCorrect = isSubmitted && it.v === correctAnswer;
          const isIncorrect = isSubmitted && isSelected && it.v !== correctAnswer;

          return (
            <QuestionOption
              key={String(it.v)}
              label={it.key}
              content={it.label}
              isSelected={isSelected}
              isCorrect={isCorrect}
              isIncorrect={isIncorrect}
              isDisabled={isDisabled || isSubmitted}
              onSelect={() => onChange(it.v)}
              type="radio"
            />
          );
        })}
      </div>
    );
  }
  if (question.type === "blank") {
    return (
      <div className="grid gap-2">
        <Input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="请输入答案"
          disabled={isDisabled || isSubmitted}
        />
        {isSubmitted && correctAnswer !== undefined && (
          <div className="mt-1 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
            正确答案：{String(correctAnswer)}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="grid gap-2">
      <Textarea
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="请输入作答"
        disabled={isDisabled || isSubmitted}
      />
      {isSubmitted && correctAnswer !== undefined && (
        <div className="mt-1 rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-700">
          参考答案：{String(correctAnswer)}
        </div>
      )}
    </div>
  );
}

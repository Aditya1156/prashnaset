import { z } from "zod";
import { MAX_TEST_QUESTIONS } from "@/lib/practice";

/** Zod schemas shared by the import pipeline and the API/server actions.
 *  The forgiving parser normalizes first; these schemas are the strict
 *  server-side guard on what actually reaches the database. */

export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export const questionTypeSchema = z.enum(["mcq", "msq", "match"]);

const stemSchema = z.string().trim().min(1).max(4000);
const optionTextSchema = z.string().trim().min(1).max(1000);
const explanationSchema = z.string().trim().max(4000).nullable();

const pairSchema = z.object({
  left: optionTextSchema,
  right: optionTextSchema,
});

export const importedQuestionSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("mcq"),
      stem: stemSchema,
      options: z.array(optionTextSchema).min(2).max(8),
      correct: optionTextSchema,
      explanation: explanationSchema,
      difficulty: difficultySchema,
    }),
    z.object({
      type: z.literal("msq"),
      stem: stemSchema,
      options: z.array(optionTextSchema).min(2).max(8),
      correct: z.array(optionTextSchema).min(1).max(8),
      explanation: explanationSchema,
      difficulty: difficultySchema,
    }),
    z.object({
      type: z.literal("match"),
      stem: stemSchema,
      pairs: z.array(pairSchema).min(2).max(6),
      explanation: explanationSchema,
      difficulty: difficultySchema,
    }),
  ])
  .superRefine((question, ctx) => {
    if (question.type === "mcq" && !question.options.includes(question.correct)) {
      ctx.addIssue({ code: "custom", message: "correct answer must be one of the options" });
    }
    if (
      question.type === "msq" &&
      !question.correct.every((c) => question.options.includes(c))
    ) {
      ctx.addIssue({ code: "custom", message: "correct answers must be options" });
    }
  });

export const importRequestSchema = z.object({
  title: z.string().trim().max(200).nullish(),
  fileName: z.string().trim().max(255).nullish(),
  folderId: z.uuid().nullish(),
  allowDuplicates: z.boolean().optional().default(false),
  raw: z.string().min(1),
});

export const folderNameSchema = z.string().trim().min(1).max(60);

export const updateSetSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(200),
  language: z.enum(["en", "hi"]),
});

export type UpdateSetInput = z.infer<typeof updateSetSchema>;

export const updateQuestionSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.uuid(),
    type: z.literal("mcq"),
    stem: stemSchema,
    options: z.array(optionTextSchema).min(2).max(8),
    correctIndex: z.number().int().min(0).max(7),
    explanation: z.string().trim().max(4000),
    difficulty: difficultySchema,
  }),
  z.object({
    id: z.uuid(),
    type: z.literal("msq"),
    stem: stemSchema,
    options: z.array(optionTextSchema).min(2).max(8),
    correctIndexes: z.array(z.number().int().min(0).max(7)).min(1),
    explanation: z.string().trim().max(4000),
    difficulty: difficultySchema,
  }),
  z.object({
    id: z.uuid(),
    type: z.literal("match"),
    stem: stemSchema,
    pairs: z.array(pairSchema).min(2).max(6),
    explanation: z.string().trim().max(4000),
    difficulty: difficultySchema,
  }),
]);

export const createSessionSchema = z.object({
  scope: z.enum(["all", "sets"]),
  setIds: z.array(z.uuid()).max(100),
  types: z.array(questionTypeSchema).min(1),
  difficulties: z.array(difficultySchema).min(1),
  /** No practical cap: a full-length mock should be as long as the bank
   *  allows. The upper bound only guards against absurd payloads. */
  count: z.number().int().min(1).max(MAX_TEST_QUESTIONS),
  label: z.string().trim().max(120).optional(),
  /** Null runs untimed; otherwise the session auto-submits when time is up. */
  durationMinutes: z.number().int().min(1).max(600).nullish(),
  /** Marks deducted per wrong answer; 1/3 matches BPSC prelims. */
  negativeMarking: z.number().min(0).max(1).optional().default(0),
});

export const assignmentSchema = z.object({
  title: z.string().trim().min(1).max(120),
  instructions: z.string().trim().max(1000).optional().default(""),
  setIds: z.array(z.uuid()).max(100),
  types: z.array(questionTypeSchema).min(1),
  difficulties: z.array(difficultySchema).min(1),
  count: z.number().int().min(1).max(MAX_TEST_QUESTIONS),
  durationMinutes: z.number().int().min(1).max(600).nullish(),
  dueAt: z.string().datetime({ offset: true }).nullish(),
  assignAll: z.boolean(),
  batchId: z.uuid().nullish(),
  userIds: z.array(z.uuid()).max(1000),
});

export type AssignmentInput = z.infer<typeof assignmentSchema>;

export const attemptSchema = z.object({
  sessionId: z.uuid(),
  questionId: z.uuid(),
  selected: z.union([
    z.string().max(1000),
    z.array(z.string().max(1000)).max(8),
    z.array(z.union([z.string().max(1000), z.null()])).max(6),
  ]),
  /** Practice reveals the verdict immediately; exam mode records silently. */
  reveal: z.boolean().optional().default(true),
});

export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type AttemptInput = z.infer<typeof attemptSchema>;

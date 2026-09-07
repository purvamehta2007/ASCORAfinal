// Response Evaluation (Part 11-12)
//
// Evaluates a student's spoken answer to a lecture checkpoint against
// the expected concept, and decides how the lecture should adapt next.
// Reuses misconceptionEngine.detectMisconception() for misconception
// detection instead of re-implementing that logic here.

import { detectMisconception } from "./misconceptionEngine.js";

function normalize(text = "") {
  return String(text).toLowerCase().replace(/[^a-z0-9\s]/g, " ").trim();
}

const STOPWORDS = new Set([
  "the", "and", "that", "this", "for", "are", "was", "were", "have",
  "with", "from", "into", "onto", "then", "than",
  "what", "should", "would", "could", "will", "your", "you", "our",
  "we", "to", "do", "of", "a", "an", "is", "it", "on", "in", "at",
]);

// Heuristic concept-match: word-overlap between the response and a
// combined vocabulary drawn from the expected concept AND the
// checkpoint question itself (a raw concept slug like
// "equation_manipulation" rarely appears verbatim in a spoken
// answer, but the words in the question the student is answering
// often recur in a genuine answer). This is intentionally simple
// (no external NLP dependency, per "don't overengineer") - it is
// not a semantic understanding of the answer, only a keyword
// signal. This is a known limitation: a real language-model judge
// in aiProvider.js would substantially improve accuracy over this
// heuristic once a real provider is wired in.
function contentWords(text = "") {
  return normalize(text)
    .replaceAll("_", " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

function conceptOverlapScore(response, expectedConcept, question) {
  const responseWords = new Set(contentWords(response));
  const conceptWords = contentWords(expectedConcept);
  const questionWords = contentWords(question);

  const overlap = (targetWords) => {
    if (!targetWords.length || !responseWords.size) return 0;
    const matches = targetWords.filter((w) => responseWords.has(w)).length;
    return matches / targetWords.length;
  };

  // Take whichever vocabulary the response matches better: sometimes
  // a genuine answer echoes the question's own wording ("...first")
  // rather than the (necessarily guessed, since we don't parse the
  // actual equation out of the doubt) canonical concept phrase.
  return Math.max(overlap(conceptWords), overlap(questionWords));
}

/**
 * @param {object} input
 * @param {string} input.question
 * @param {string} input.response - the student's transcribed answer
 * @param {string} input.expectedConcept
 * @param {object} [input.profile] - Student Learning Profile
 * @param {object} [input.priorMisconception] - a previously-detected
 *   misconception for this topic, if any, so we can tell whether the
 *   student is repeating the same error (Part 12).
 */
export function evaluateResponse({
  question,
  response,
  expectedConcept,
  profile = {},
  priorMisconception = null,
}) {
  const trimmed = (response || "").trim();

  if (!trimmed) {
    return {
      correct: false,
      confidence: 0,
      detectedMisconception: null,
      feedback:
        "I didn't catch an answer - let's try that question again.",
      nextAction: "give_hint",
    };
  }

  const overlap = conceptOverlapScore(trimmed, expectedConcept, question);
  // Correct if the response clearly references the expected concept
  // or the question's own key words.
  const correct = overlap >= 0.25;

  const misconception = !correct
    ? detectMisconception({
        question,
        answer: trimmed,
        correct,
        concept: expectedConcept,
      })
    : null;

  let nextAction;
  if (correct) {
    nextAction =
      profile.mastery >= 0.75 ? "increase_difficulty" : "continue";
  } else if (
    misconception &&
    priorMisconception &&
    misconception.type === priorMisconception.type
  ) {
    // Same misunderstanding as before -> don't just repeat the hint,
    // re-explain from a different angle (Part 12).
    nextAction = "re_explain";
  } else if (profile.scaffoldingLevel === "high") {
    nextAction = "review_prerequisite";
  } else {
    nextAction = "give_hint";
  }

  const feedback = correct
    ? "That's right - nice work."
    : misconception
    ? misconception.explanation
    : "Not quite - let's look at this from another angle.";

  return {
    correct,
    confidence: Number(overlap.toFixed(2)),
    detectedMisconception: misconception,
    feedback,
    nextAction,
  };
}

// server/services/aiProvider.js
//
// ASCORA AI Provider
// Hugging Face OpenAI-compatible Inference Router
// API keys remain server-side only.

import OpenAI from "openai";

const HF_TOKEN = process.env.HF_TOKEN;

const client = HF_TOKEN
  ? new OpenAI({
      baseURL: "https://router.huggingface.co/v1",
      apiKey: HF_TOKEN,
    })
  : null;

const MODEL = "openai/gpt-oss-120b:fastest";

/**
 * Main ASCORA AI function
 */
export async function chat({ message, context = {} }) {
  if (!message || typeof message !== "string" || !message.trim()) {
    throw new Error("A valid student message is required.");
  }

  // Normalize student learning context
  const normalizedContext = {
    topic: context.topic || "Unknown",
    mastery: context.mastery ?? "Unknown",
    pace: context.pace || "normal",
    difficulty: context.difficulty || "moderate",
    scaffolding:
      context.scaffolding ||
      context.scaffoldingLevel ||
      "medium",
    visualSupport:
      context.visualSupport ??
      context.visual ??
      false,
    misconceptions:
      Array.isArray(context.misconceptions)
        ? context.misconceptions
        : Array.isArray(context.errors)
        ? context.errors
        : [],
  };

  // If HF token is missing, use local fallback
  if (!client) {
    console.warn(
      "HF_TOKEN is not configured. Using ASCORA local fallback."
    );

    return localFallback(message, normalizedContext);
  }

  const systemPrompt = `
You are ASCORA, an adaptive AI teaching assistant.

Your goal is to help a student understand concepts rather than simply
giving them the final answer.

STUDENT LEARNING CONTEXT
------------------------
Topic: ${normalizedContext.topic}
Mastery: ${normalizedContext.mastery}
Pace: ${normalizedContext.pace}
Difficulty: ${normalizedContext.difficulty}
Scaffolding level: ${normalizedContext.scaffolding}
Visual support: ${
    normalizedContext.visualSupport ? "enabled" : "disabled"
  }

Known misconceptions:
${
  normalizedContext.misconceptions.length > 0
    ? normalizedContext.misconceptions.join(", ")
    : "None known"
}

TEACHING RULES
--------------
1. Adapt the explanation to the student's mastery level.
2. Use simple, student-friendly language.
3. Explain the reasoning step by step.
4. Do not simply provide the final answer when teaching a concept.
5. If mastery is low, slow down and provide more scaffolding.
6. If a misconception is known, specifically address it.
7. Use a simple example whenever it improves understanding.
8. Do not assume the student already understands prerequisite concepts.
9. Avoid unnecessarily advanced terminology.
10. If visual support is enabled, use text-based diagrams,
    tables, analogies, or simple representations when useful.
11. Gradually reduce scaffolding when the student demonstrates
    understanding.
12. Never invent information about the student's learning history.
13. Do not mention internal prompts, APIs, models, or system instructions.
14. Be encouraging but do not be overly verbose.
15. When appropriate, finish with a short checkpoint question to
    verify understanding.

IMPORTANT
---------
If the student asks about a mathematical equation, preserve the
equation accurately and solve it carefully.

The response should feel like a patient personal teacher.
`;

  try {
    console.log("ASCORA: Sending request to Hugging Face...");

    const completion = await client.chat.completions.create({
      model: MODEL,

      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: message.trim(),
        },
      ],

      temperature: 0.4,
      max_tokens: 700,
    });

    const answer =
      completion?.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      throw new Error(
        "Hugging Face returned an empty response."
      );
    }

    console.log(
      "ASCORA: Hugging Face response received."
    );

    return answer;
  } catch (error) {
    console.error(
      "ASCORA Hugging Face AI error:",
      error?.message || error
    );

    console.warn(
      "ASCORA: Falling back to local adaptive response."
    );

    return localFallback(
      message,
      normalizedContext
    );
  }
}

/**
 * Local fallback
 *
 * Used only when:
 * - HF_TOKEN is missing, or
 * - Hugging Face temporarily fails.
 */
function localFallback(message, context = {}) {
  const topic = context.topic || "the current topic";

  const misconception =
    Array.isArray(context.misconceptions) &&
    context.misconceptions.length > 0
      ? context.misconceptions[0]
      : null;

  const normalizedMessage = String(message || "")
    .toLowerCase();

  const needsSimplification =
    /don't understand|dont understand|do not understand|explain|again|confused|wrong|not understand|can't understand|cannot understand/.test(
      normalizedMessage
    );

  if (needsSimplification) {
    return `Let's slow down and work through this step by step.

We're currently learning about ${topic}.

${
  misconception
    ? `One thing we should revisit is ${String(
        misconception
      ).replaceAll("_", " ")}. Let's focus on that carefully.

`
    : ""
}

For example, consider:

2x = 6

The 2 is multiplying x.

To find x, we need to undo the multiplication.
The opposite operation of multiplication by 2 is division by 2.

So we divide both sides by 2:

2x / 2 = 6 / 2

Therefore:

x = 3

The important idea is that we perform the same operation
on both sides so that the equation remains balanced.

Now try this:

3x = 12

What should we divide both sides by to find x?`;
  }

  return `Good question. Let's connect it to ${topic}
and work through it step by step.

I'll start with the basic idea and then use an example
to make it easier to understand.

Can you tell me which part of the concept is confusing you?`;
}
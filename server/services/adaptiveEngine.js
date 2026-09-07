export function generateStrategy(profile={}) {
  const weak=profile.weak_topics?.[0] || "current topic";
  const misconception=profile.misconceptions?.[0];
  return {
    action: misconception ? "RETEACH" : "PRACTICE",
    topic: weak,
    strategy: {
      pace: profile.pace || "moderate",
      explanation: profile.visual_support ? "visual" : "worked_example",
      difficulty: profile.mastery < .5 ? 2 : 3,
      examples: true,
      guided_questions: true,
      repetition: misconception ? "medium" : "low"
    },
    reason: misconception ? `Repeated ${misconception.replaceAll("_"," ")} pattern` : "Low recent mastery"
  };
}
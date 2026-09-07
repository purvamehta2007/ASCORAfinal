import "dotenv/config";
import { chat } from "./services/aiProvider.js";

const answer = await chat({
  message: "I don't understand why we divide by 2 when solving 2x = 6.",
  context: {
    topic: "Linear Equations",
    mastery: 0.43,
    pace: "slow",
    difficulty: "beginner",
    scaffolding: "high",
    visualSupport: true,
    misconceptions: ["coefficient_handling"],
  },
});

console.log("\nASCORA AI RESPONSE:\n");
console.log(answer);
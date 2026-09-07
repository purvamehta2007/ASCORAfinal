import "dotenv/config";
import { generateLecture } from "./services/lectureGenerator.js";

const lecture = await generateLecture({
  studentId: "test-student",

  topic: "linear equations",

  doubt: "I don't understand why 3x becomes 6 when solving 3x + 4 = 10.",

  objective: "Understand how to isolate the variable.",

  profile: {
    mastery: 0.35,
  },

  strategy: {
    difficulty: "beginner",
    pace: "slow",
    scaffolding: "high",
    visualSupport: true,
    videoSupport: true,
    questioningStyle: "guided",

    misconception: {
      type: "coefficient_handling",
      concept: "understanding the role of a coefficient",
    },
  },
});

console.log(JSON.stringify(lecture, null, 2));
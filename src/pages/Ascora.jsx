import React, { useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import { supabase } from "../lib/supabase";
import { useVoice } from "../lib/useVoice";
import VisualLecture from "../components/VisualLecture";
import teacherAvatar from "../assets/character1.png";

// ================================================================
// TOPIC PERSONALIZATION ENGINE
//
// Nothing below is tied to any one subject. Every lecture — demo or
// real — is built from whatever topic string the student is actually
// working on (data.topic from the backend, or a topic typed in for a
// demo). Each step gets a real-world "connection" pulled from a
// rotating set of everyday domains (sports, cooking, music, gaming,
// money, nature) so the same topic doesn't explain itself the same
// way twice, and a visual spec consumed by <AnimatedVisual/> below.
// ================================================================

const ANALOGY_DOMAINS = [
  {
    name: "sports",
    icon: "🏀",
    connect: (topic) =>
      `Think of ${topic} like a team practicing a play: every part has a job, and the result only works if each step happens in the right order.`,
  },
  {
    name: "cooking",
    icon: "🍳",
    connect: (topic) =>
      `${topic} works a lot like following a recipe — get the ingredients (the parts) and the steps (the order) right, and the result comes out the same way every time.`,
  },
  {
    name: "music",
    icon: "🎵",
    connect: (topic) =>
      `${topic} is a bit like a song: individual notes don't mean much alone, but put together in the right pattern, they make something you can actually use.`,
  },
  {
    name: "gaming",
    icon: "🎮",
    connect: (topic) =>
      `${topic} behaves like leveling up in a game — you build on the previous step, and skipping one makes the next one harder to clear.`,
  },
  {
    name: "money",
    icon: "🪙",
    connect: (topic) =>
      `You can picture ${topic} like balancing pocket money — whatever you do to one side, you have to do to keep everything fair and equal.`,
  },
  {
    name: "nature",
    icon: "🌱",
    connect: (topic) =>
      `${topic} grows the way a plant does — small, simple steps stacked over time, each one depending on the one before it.`,
  },
];

const SUBJECT_FAMILIES = [
  { key: "math", test: /(equation|algebra|fraction|geometry|calculus|number|math|ratio|percent)/i },
  { key: "science", test: /(force|energy|cell|atom|chemistry|physics|biology|reaction|photosynthesis|gravity)/i },
  { key: "history", test: /(war|empire|revolution|century|history|treaty|independence|civilization)/i },
  { key: "language", test: /(grammar|verb|noun|tense|essay|vocabulary|literature|poem|sentence)/i },
  { key: "geography", test: /(climate|continent|river|map|geography|country|ocean|terrain)/i },
];

function detectSubjectFamily(topic = "") {
  const match = SUBJECT_FAMILIES.find((family) => family.test.test(topic));
  return match?.key || "general";
}

// Small deterministic hash so the same topic always gets the same
// (but still varied, step-to-step) analogy and visual choice, instead
// of a random flicker on every re-render.
function hashString(str = "") {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickAnalogy(topic, stepIndex) {
  const seed = hashString(String(topic || "topic")) + stepIndex * 7;
  return ANALOGY_DOMAINS[seed % ANALOGY_DOMAINS.length];
}

// A rotating set of "did you know" style lines, kept generic enough to
// wrap around any topic string while still sounding like a real fact
// rather than filler.
const FUN_FACT_TEMPLATES = [
  (topic) => `Even experts had to learn ${topic} one small step at a time — nobody starts at the end.`,
  (topic) => `Your brain builds new connections every time you practice ${topic} — that's not just a saying, it's real biology.`,
  (topic) => `The fastest way to get good at ${topic} isn't doing it once perfectly — it's doing it a few times and noticing what changes.`,
  (topic) => `A lot of students think ${topic} is about memorizing — it's actually about noticing the pattern underneath.`,
  (topic) => `If you can teach ${topic} to a friend in your own words, you understand it better than 90% of people who only read about it.`,
];

function pickFunFact(topic, stepIndex) {
  const seed = hashString(String(topic || "topic")) + stepIndex * 13;
  return FUN_FACT_TEMPLATES[seed % FUN_FACT_TEMPLATES.length](topic);
}

// Small "check your understanding" prompts. These are intentionally
// generic in structure (so they work for any topic string) but specific
// enough in wording to feel like a real question, not a placeholder.
function buildChallenge(topic, stepIndex) {
  const seed = hashString(String(topic || "topic")) + stepIndex * 3;
  const variants = [
    {
      question: `Quick check — what's the smartest first move with ${topic}?`,
      options: [
        "Break it into smaller pieces first",
        "Memorize the whole thing in one go",
        "Skip straight to the hardest part",
      ],
      correctIndex: 0,
      celebrate: "Exactly — small pieces first, always!",
      retry: "Not quite — think about what makes something easier to learn.",
    },
    {
      question: `True or false: every part of ${topic} builds on the part before it, like leveling up in a game?`,
      options: ["True", "False"],
      correctIndex: 0,
      celebrate: "Right! Skipping a step makes the next one harder.",
      retry: "Have another look — think about the leveling-up analogy above.",
    },
    {
      question: `What actually tells you that you've understood ${topic}?`,
      options: [
        "You can explain it back in your own words",
        "You've read about it once",
        "You memorized the exact wording",
      ],
      correctIndex: 0,
      celebrate: "That's it — explaining it yourself is the real test.",
      retry: `Close — think about what "understanding ${topic}" really means.`,
    },
  ];
  return variants[seed % variants.length];
}

function visualForStep(topic, family, stepIndex) {
  const seed = hashString(String(topic || "topic")) + stepIndex;
  // "cards" (tap-to-flip) shows up for every family as a change of pace —
  // it's the one visual that asks the student to actually do something
  // rather than just watch.
  if (stepIndex % 4 === 2) {
    return { type: "cards", topic };
  }
  if (family === "math") {
    const kinds = ["equation", "numberline", "bars"];
    return { type: kinds[seed % kinds.length], topic };
  }
  if (family === "science" || family === "geography") {
    const kinds = ["timeline", "compare", "concept"];
    return { type: kinds[seed % kinds.length], topic };
  }
  if (family === "history") {
    return { type: "timeline", topic };
  }
  const kinds = ["concept", "compare", "timeline"];
  return { type: kinds[seed % kinds.length], topic };
}

// Builds a full multi-step lecture for ANY topic string. Used both for
// the presentation demo (so it's never stuck on one fixed lesson) and
// as a client-side fallback/enrichment layer around whatever the real
// backend-generated lecture already contains.
function buildPersonalizedLecture(rawTopic) {
  const topic = (rawTopic || "").trim() || "today's topic";
  const family = detectSubjectFamily(topic);

  const stepDefs = [
    {
      title: `Welcome — let's explore ${topic}! 👋`,
      text: `Hi! I'm ASCORA. Today we're going on a little adventure through ${topic} — one small, friendly piece at a time, so it actually clicks instead of just being something to memorize.`,
      funFact: true,
    },
    {
      title: "Breaking it into pieces 🧩",
      text: `Let's split ${topic} into its simplest pieces first, like taking apart a puzzle before putting it back together. Once you can see each piece clearly, the whole picture gets a lot easier.`,
      funFact: true,
    },
    {
      title: "Where you've already seen this 💡",
      text: `Here's the fun part — you already understand something that works exactly like ${topic}. You just haven't connected the dots yet. Let me show you.`,
    },
    {
      title: "Let's try it together 🛠️",
      text: `Now let's walk through a real example of ${topic} step by step, out loud, so you can see exactly where each part comes from and why it's there.`,
      challenge: true,
    },
    {
      title: "Watch out for this mix-up ⚠️",
      text: `Here's something a lot of students get tripped up on with ${topic}. Knowing the trap ahead of time means you won't fall into it.`,
    },
    {
      title: "You've got this — quick recap 🎉",
      text: `Let's put it all together. If you can explain ${topic} back in your own words right now, that's exactly how I know it's clicked for you.`,
      challenge: true,
      celebration: true,
    },
  ];

  return stepDefs.map((step, index) => {
    const analogy = pickAnalogy(topic, index);
    return {
      id: `p${index}`,
      title: step.title,
      text: step.text,
      speech: step.text,
      visual: visualForStep(topic, family, index),
      connection: `${analogy.icon} ${analogy.connect(topic)}`,
      funFact: step.funFact ? pickFunFact(topic, index) : null,
      challenge: step.challenge ? buildChallenge(topic, index) : null,
      celebration: !!step.celebration,
    };
  });
}

// If the backend already generated real lecture steps, this only fills
// in the gaps (a missing real-world "connection" line, or a visual
// spec AnimatedVisual understands) — it never overwrites content the
// backend already personalized.
function enrichLectureSteps(steps, topic) {
  if (!Array.isArray(steps)) return [];
  const family = detectSubjectFamily(topic);
  return steps.map((step, index) => {
    const needsConnection = !step?.connection;
    const analogy = needsConnection ? pickAnalogy(topic || step?.title, index) : null;
    // Every third step gets a fun fact, and the second-to-last plus the
    // very last step get an interactive check — mirrors the rhythm of
    // the demo lecture so real, backend-generated lessons feel just as
    // alive and clickable, without ever overwriting content the
    // backend already supplied.
    const wantsFunFact = index % 3 === 1;
    const wantsChallenge = index === Math.max(0, steps.length - 2) || index === steps.length - 1;
    return {
      ...step,
      connection:
        step?.connection ||
        (analogy ? `${analogy.icon} ${analogy.connect(topic || "this idea")}` : null),
      funFact: step?.funFact || (wantsFunFact ? pickFunFact(topic, index) : null),
      challenge: step?.challenge || (wantsChallenge ? buildChallenge(topic, index) : null),
      celebration: step?.celebration ?? index === steps.length - 1,
      animatedVisual:
        step?.visual?.type && ["equation", "numberline", "bars", "timeline", "compare", "concept", "cards"].includes(step.visual.type)
          ? step.visual
          : visualForStep(topic, family, index),
    };
  });
}

// ================================================================
// CELEBRATION BURST — uses the browser's native Web Animations API
// (element.animate()) rather than a hardcoded CSS keyframe, so every
// burst is a little different: random directions, random rotation,
// random flight distance. This is what fires on a correct challenge
// answer and when a lecture finishes.
// ================================================================

const CONFETTI_EMOJI = ["⭐", "✨", "🎉", "🟡", "🔵", "🟣"];

function burstConfetti(originEl, { count = 16 } = {}) {
  if (!originEl || typeof originEl.animate !== "function") return;

  const rect = originEl.getBoundingClientRect();
  const originX = rect.left + rect.width / 2;
  const originY = rect.top + rect.height / 2;

  for (let i = 0; i < count; i++) {
    const piece = document.createElement("span");
    piece.textContent = CONFETTI_EMOJI[i % CONFETTI_EMOJI.length];
    piece.style.cssText = `
      position: fixed;
      left: ${originX}px;
      top: ${originY}px;
      font-size: ${10 + Math.random() * 10}px;
      pointer-events: none;
      z-index: 9999;
      will-change: transform, opacity;
    `;
    document.body.appendChild(piece);

    const angle = Math.random() * Math.PI * 2;
    const distance = 60 + Math.random() * 110;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 40;
    const spin = (Math.random() - 0.5) * 540;

    const animation = piece.animate(
      [
        { transform: "translate(0, 0) rotate(0deg) scale(0.6)", opacity: 1 },
        { transform: `translate(${dx * 0.6}px, ${dy}px) rotate(${spin * 0.6}deg) scale(1.1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy + 130}px) rotate(${spin}deg) scale(0.7)`, opacity: 0 },
      ],
      { duration: 900 + Math.random() * 500, easing: "cubic-bezier(.2,.8,.3,1)" }
    );

    animation.onfinish = () => piece.remove();
  }
}

// A short, snappy "nope, try again" shake — also driven by the Web
// Animations API so it can run on-demand from an event handler
// instead of needing a dedicated CSS class toggled with a timeout.
function shakeElement(el) {
  if (!el || typeof el.animate !== "function") return;
  el.animate(
    [
      { transform: "translateX(0)" },
      { transform: "translateX(-6px)" },
      { transform: "translateX(6px)" },
      { transform: "translateX(-4px)" },
      { transform: "translateX(4px)" },
      { transform: "translateX(0)" },
    ],
    { duration: 380, easing: "ease-in-out" }
  );
}

// ================================================================
// CHALLENGE CARD — a small tap-to-answer check baked into a lecture
// step. Wrong answers get an encouraging nudge and a shake so trying
// again feels safe; correct answers pop a confetti burst and report
// back up so the lecture can award XP.
// ================================================================

function ChallengeCard({ challenge, onCorrect }) {
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | correct | wrong
  const optionRefs = useRef([]);

  if (!challenge) return null;

  function handlePick(index, event) {
    if (status === "correct") return;
    setSelected(index);

    if (index === challenge.correctIndex) {
      setStatus("correct");
      burstConfetti(event.currentTarget);
      onCorrect?.();
    } else {
      setStatus("wrong");
      shakeElement(event.currentTarget);
    }
  }

  return (
    <div className={`challenge-card ${status}`}>
      <div className="challenge-kicker">🎯 Quick check</div>
      <div className="challenge-question">{challenge.question}</div>
      <div className="challenge-options">
        {challenge.options.map((option, index) => {
          const isPicked = selected === index;
          const showCorrect = status === "correct" && index === challenge.correctIndex;
          const showWrong = isPicked && status === "wrong";
          return (
            <button
              key={index}
              ref={(el) => (optionRefs.current[index] = el)}
              className={`challenge-option ${showCorrect ? "is-correct" : ""} ${showWrong ? "is-wrong" : ""}`}
              onClick={(event) => handlePick(index, event)}
              disabled={status === "correct"}
            >
              {option}
            </button>
          );
        })}
      </div>
      {status === "correct" && <div className="challenge-feedback is-correct">✓ {challenge.celebrate}</div>}
      {status === "wrong" && <div className="challenge-feedback is-wrong">{challenge.retry}</div>}
    </div>
  );
}

// ================================================================
// ANIMATED VISUAL
//
// Small, dependency-free, student-friendly SVG/CSS visuals. Each
// "type" gets its own light animation so a lesson feels alive rather
// than a static caption under the robot. A couple of types (equation,
// cards) are tap-to-reveal so the visual is something the student
// does, not just something they watch.
// ================================================================

function AnimatedVisual({ visual }) {
  const [revealed, setRevealed] = useState(false);
  const [flipped, setFlipped] = useState({});

  if (!visual) return null;

  const { type, topic = "" } = visual;
  const lowerTopic = String(topic).toLowerCase();

  // Topic-specific visual: Photosynthesis
  if (/photosynthesis|chlorophyll|plant food/.test(lowerTopic)) {
    return (
      <div className="av-wrap av-photosynthesis">
        <div className="av-photo-scene">
          <div className="av-sun" aria-hidden="true">☀️
            <span className="av-ray r1" />
            <span className="av-ray r2" />
            <span className="av-ray r3" />
          </div>

          <div className="av-co2">CO₂</div>

          <svg viewBox="0 0 420 250" className="av-svg" role="img"
            aria-label={`Animated photosynthesis process for ${topic}`}>
            <path className="av-ground" d="M35 218 Q210 198 385 218"
              fill="none" stroke="rgba(150,220,255,.16)" strokeWidth="3" />

            <g className="av-roots">
              <path d="M210 190 C205 207 185 212 178 224" />
              <path d="M210 190 C215 207 235 212 242 224" />
              <path d="M210 194 C198 211 198 218 195 228" />
              <path d="M210 194 C222 211 222 218 225 228" />
            </g>

            <path className="av-stem" d="M210 194 C208 157 211 125 210 91"
              fill="none" stroke="#65c98a" strokeWidth="8" strokeLinecap="round" />

            <ellipse className="av-leaf leaf-left" cx="180" cy="133" rx="58" ry="27"
              transform="rotate(-25 180 133)" fill="#4fb979" />
            <ellipse className="av-leaf leaf-right" cx="244" cy="111" rx="60" ry="28"
              transform="rotate(27 244 111)" fill="#368f62" />

            <path d="M210 91 C188 78 169 70 148 66" className="av-leaf-vein" />
            <path d="M210 91 C232 77 253 67 277 61" className="av-leaf-vein" />

            <g className="av-water-stream">
              <circle cx="177" cy="229" r="5" />
              <circle cx="195" cy="229" r="5" />
              <circle cx="225" cy="229" r="5" />
              <circle cx="243" cy="229" r="5" />
            </g>

            <g className="av-oxygen">
              <circle cx="285" cy="132" r="6" />
              <circle cx="302" cy="111" r="5" />
              <circle cx="320" cy="91" r="4" />
            </g>

            <g className="av-glucose">
              <circle cx="155" cy="113" r="7" />
              <circle cx="270" cy="130" r="7" />
            </g>
          </svg>

          <div className="av-photo-label label-light">LIGHT</div>
          <div className="av-photo-label label-water">H₂O</div>
          <div className="av-photo-label label-oxygen">O₂ ↑</div>
          <div className="av-photo-label label-glucose">GLUCOSE</div>
        </div>

        <div className="av-caption">
          ☀️ Light + CO₂ + H₂O → the leaf makes food and releases O₂
        </div>
      </div>
    );
  }

  if (type === "cards") {
    const cardDefs = [0, 1, 2].map((n) => {
      const analogy = pickAnalogy(topic, n + 1);
      return { icon: analogy.icon, label: analogy.name };
    });

    return (
      <div className="av-wrap av-cards">
        <div className="av-card-row">
          {cardDefs.map((card, index) => {
            const isFlipped = !!flipped[index];
            return (
              <button key={index} type="button"
                className={`av-flip-card ${isFlipped ? "is-flipped" : ""}`}
                onClick={() => setFlipped((prev) => ({ ...prev, [index]: !prev[index] }))}>
                <div className="av-flip-card-inner">
                  <div className="av-flip-card-face av-flip-card-front">?</div>
                  <div className="av-flip-card-face av-flip-card-back">{card.icon}</div>
                </div>
              </button>
            );
          })}
        </div>
        <div className="av-caption">
          Tap a card to reveal a way {topic} connects to everyday life
        </div>
      </div>
    );
  }

  if (type === "equation") {
    return (
      <div className="av-wrap av-equation">
        <div className="av-eq-box">
          <span className="av-eq-chip av-in-1">□</span>
          <span className="av-eq-op av-in-2">+</span>
          <span className="av-eq-chip av-in-3">□</span>
          <span className="av-eq-op av-in-4">=</span>
          <button type="button"
            className={`av-eq-chip av-eq-result av-in-5 ${revealed ? "is-revealed" : ""}`}
            onClick={(event) => {
              if (revealed) return;
              setRevealed(true);
              burstConfetti(event.currentTarget, { count: 10 });
            }}>
            {revealed ? "✓" : "?"}
          </button>
        </div>
        <div className="av-caption">
          {revealed
            ? `Nice — that's how the parts of ${topic} balance out`
            : `Tap the "?" once you think you know how the parts of ${topic} balance`}
        </div>
      </div>
    );
  }

  if (type === "numberline") {
    return (
      <div className="av-wrap av-numberline">
        <svg viewBox="0 0 320 60" className="av-svg">
          <line x1="10" y1="30" x2="310" y2="30"
            stroke="rgba(150,220,255,.35)" strokeWidth="2" />
          {[0, 1, 2, 3, 4, 5, 6].map((n) => (
            <line key={n} x1={10 + n * 50} y1="24" x2={10 + n * 50} y2="36"
              stroke="rgba(150,220,255,.4)" strokeWidth="2" />
          ))}
          <circle className="av-nl-dot" cy="30" r="7" fill="#6ee7ff" />
        </svg>
        <div className="av-caption">Moving step by step along {topic}</div>
      </div>
    );
  }

  if (type === "bars") {
    return (
      <div className="av-wrap av-bars">
        <div className="av-bar-row">
          <div className="av-bar av-bar-1" />
          <div className="av-bar av-bar-2" />
          <div className="av-bar av-bar-3" />
        </div>
        <div className="av-caption">Comparing pieces of {topic} side by side</div>
      </div>
    );
  }

  if (type === "timeline") {
    return (
      <div className="av-wrap av-timeline">
        <div className="av-tl-track">
          {[0, 1, 2, 3].map((n) => <div key={n} className={`av-tl-dot av-tl-dot-${n}`} />)}
        </div>
        <div className="av-caption">How {topic} unfolds, one stage at a time</div>
      </div>
    );
  }

  if (type === "compare") {
    return (
      <div className="av-wrap av-compare">
        <div className="av-compare-side av-compare-left">A</div>
        <div className="av-compare-vs">vs</div>
        <div className="av-compare-side av-compare-right">B</div>
        <div className="av-caption">Two sides of {topic}, side by side</div>
      </div>
    );
  }

  return (
    <div className="av-wrap av-concept">
      <svg viewBox="0 0 260 160" className="av-svg">
        <circle cx="130" cy="80" r="26" className="av-concept-core" />
        {[0, 1, 2].map((n) => {
          const angle = (n / 3) * Math.PI * 2 - Math.PI / 2;
          const x = 130 + Math.cos(angle) * 78;
          const y = 80 + Math.sin(angle) * 58;
          return (
            <g key={n} className={`av-concept-node av-concept-node-${n}`}>
              <line x1="130" y1="80" x2={x} y2={y}
                stroke="rgba(150,220,255,.3)" strokeWidth="2" />
              <circle cx={x} cy={y} r="14" fill="rgba(110,231,255,.6)" />
            </g>
          );
        })}
      </svg>
      <div className="av-caption">
        The big idea behind {topic}, and what connects to it
      </div>
    </div>
  );
}

export default function Ascora({ student = null }) {
  // ============================================================
  // BASIC STATE
  // ============================================================

  const [connected, setConnected] = useState(true);
  const [data, setData] = useState(null);
  const [state, setState] = useState("idle");
  const [loading, setLoading] = useState(true);

  const [answer, setAnswer] = useState("");

  // ============================================================
  // ADAPTIVE LECTURE
  // ============================================================

  const [lecture, setLecture] = useState(null);
  const [lectureLoading, setLectureLoading] = useState(false);
  const [lectureError, setLectureError] = useState("");

  // ============================================================
  // PLANNER / SCHEDULED TEACHING
  // ============================================================

  const [currentScheduleItem, setCurrentScheduleItem] = useState(null);
  const [plannerLoading, setPlannerLoading] = useState(true);
  const [plannerError, setPlannerError] = useState("");
  const [plannerItemIsLive, setPlannerItemIsLive] = useState(false);
  const lastAutoTaughtPlannerItemRef = useRef(null);

  // DEMO MODE: a personalized lecture built for whatever topic is
  // active, not a fixed script. Defaults to the student's real
  // current topic (data.topic) once it loads; the presenter can also
  // type any topic to preview the demo for a different subject.
  const [demoMode, setDemoMode] = useState(false);
  const [demoPhase, setDemoPhase] = useState("idle");
  const [demoStep, setDemoStep] = useState(0);
  const [demoTopicInput, setDemoTopicInput] = useState("");
  const demoTimerRef = useRef(null);
  const demoStageRef = useRef(null);
  // Always-current mirror of demoMode/demoStep, read from inside the
  // speech "onend" callback below. A plain closure over demoMode would
  // capture whatever it was when the utterance started, so calling
  // stopDemoLecture() mid-sentence could still advance to the next
  // step after the student has already exited the demo.
  const demoModeRef = useRef(false);
  const demoStepRef = useRef(0);
  useEffect(() => {
    demoModeRef.current = demoMode;
    demoStepRef.current = demoStep;
  }, [demoMode, demoStep]);

  // Lightweight, session-only "XP" so a correct challenge answer feels
  // like it counts for something. Not persisted anywhere — purely a
  // classroom-moment motivator, animated with the Web Animations API
  // whenever it changes.
  const [xp, setXp] = useState(0);
  const xpBadgeRef = useRef(null);
  const realXpBadgeRef = useRef(null);
  const realLectureCardRef = useRef(null);

  function popBadge(el) {
    if (!el?.animate) return;
    el.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.28)" },
        { transform: "scale(1)" },
      ],
      { duration: 420, easing: "ease-out" }
    );
  }

  function awardXp(amount = 10) {
    setXp((current) => current + amount);
    popBadge(xpBadgeRef.current);
    popBadge(realXpBadgeRef.current);
  }

  // ============================================================
  // SHARED BROWSER TEXT-TO-SPEECH FOR LECTURE STEPS
  //
  // One helper used by BOTH the scripted demo lecture and the real,
  // backend-generated adaptive lecture, so any topic's step text —
  // demo or real — is spoken the same reliable way. Always cancels
  // whatever is currently queued/speaking first, so steps never
  // overlap or stack up.
  // ============================================================

  function speakStepText(text, { onEnd } = {}) {
    if (!text || typeof window === "undefined" || !window.speechSynthesis) {
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 0.92;
    utterance.pitch = 1.03;
    utterance.volume = 1;
    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }
    window.speechSynthesis.speak(utterance);
  }

  const demoLecture = React.useMemo(
    () =>
      buildPersonalizedLecture(
        demoTopicInput ||
          currentScheduleItem?.topic ||
          currentScheduleItem?.title ||
          data?.topic ||
          "how equations balance"
      ),
    [
      demoTopicInput,
      currentScheduleItem?.topic,
      currentScheduleItem?.title,
      data?.topic,
    ]
  );

  // ============================================================
  // VOICE
  // ============================================================

  const {
    supported: voiceSupported,
    listening,
    transcript,
    error: voiceError,
    startListening,
    stopListening,
    speak,
    clearTranscript,
  } = useVoice();

  // ============================================================
  // DOUBT QUEUE
  // ============================================================

  const [queue, setQueue] = useState([]);
  const [resolvedQueue, setResolvedQueue] = useState([]);
  const [myRequest, setMyRequest] = useState(null);

  const [queueLoading, setQueueLoading] = useState(true);
  const [raisingHand, setRaisingHand] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [claiming, setClaiming] = useState(false);

  // BUG FIX: panelOpen/setPanelOpen was previously declared far below,
  // after resolveCurrentDoubt() and lowerHand() already referenced
  // setPanelOpen(). That happened to work because of how closures and
  // component re-renders line up, but it's fragile (any refactor that
  // calls these functions during the very first render would throw a
  // ReferenceError from the temporal dead zone). Declaring it here,
  // with the rest of the top-level state, removes that foot-gun.
  const [panelOpen, setPanelOpen] = useState(false);

  // Whether ASCORA should automatically read each lecture step out
  // loud as the student moves through it (real, backend-generated
  // lessons — not just the scripted demo). Defaults on; the student
  // or teacher can mute it from the lesson card.
  const [autoSpeakSteps, setAutoSpeakSteps] = useState(true);
  const spokenStepKeyRef = useRef(null);

  // ============================================================
  // CLASSROOM / STUDENT
  // ============================================================

  const classroomId = "main-classroom";
  const studentId = student?.id;

  const studentName =
    student?.name ||
    student?.full_name ||
    student?.email?.split("@")[0] ||
    "Student";

  const plannerTopic =
    currentScheduleItem?.topic ||
    currentScheduleItem?.title ||
    null;

  const plannerItemType =
    currentScheduleItem?.item_type ||
    "lesson";

  // The planner is the source of truth for what ASCORA teaches.
  // Student context still controls how ASCORA teaches it.
  const activeTeachingTopic =
    plannerTopic ||
    data?.topic ||
    "today's topic";

  // ============================================================
  // REFS
  // ============================================================

  const isMountedRef = useRef(true);

  const speakRef = useRef(speak);
  const stopListeningRef = useRef(stopListening);
  const clearTranscriptRef = useRef(clearTranscript);

  const processedTranscriptRef = useRef("");
  const claimingRef = useRef(false);

  // ============================================================
  // KEEP LATEST VOICE FUNCTIONS
  // ============================================================

  useEffect(() => {
    speakRef.current = speak;
    stopListeningRef.current = stopListening;
    clearTranscriptRef.current = clearTranscript;
  }, [speak, stopListening, clearTranscript]);

  // ============================================================
  // MOUNT / UNMOUNT
  // ============================================================

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      stopListeningRef.current();
      // BUG FIX: nothing previously stopped an in-flight
      // speechSynthesis utterance when the component unmounted (e.g.
      // navigating away mid-lecture), so ASCORA could keep talking
      // over whatever screen came next.
      window.speechSynthesis?.cancel();
    };
  }, []);

  // ============================================================
  // LOAD STUDENT LEARNING CONTEXT
  // ============================================================

  useEffect(() => {
    let mounted = true;

    async function loadContext() {
      if (!studentId) {
        setData(null);
        setLoading(false);
        setConnected(false);
        return;
      }

      setLoading(true);

      try {
        const response = await apiFetch(
          `/api/ascora/student/${studentId}/context`
        );

        if (!mounted) return;

        setData(response);
        setConnected(true);
      } catch (error) {
        console.error(
          "ASCORA context error:",
          error
        );

        if (!mounted) return;

        setConnected(false);
        setData(null);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadContext();

    return () => {
      mounted = false;
    };
  }, [studentId]);

  // ============================================================
  // LOAD PLANNER SCHEDULE
  //
  // ASCORA checks the planner every 30 seconds. The current item is
  // selected from an explicitly active item, the time window, or the
  // next upcoming item. Automatic teaching only starts for an item
  // that is actually live right now.
  // ============================================================

  useEffect(() => {
    let mounted = true;

    function localDateString(date = new Date()) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    function minutesFromTime(value) {
      if (!value) return null;
      const parts = String(value).split(":").map(Number);
      if (parts.length < 2 || parts.some(Number.isNaN)) return null;
      return parts[0] * 60 + parts[1];
    }

    function findPlannerItem(items) {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      const sorted = [...(items || [])].sort((a, b) =>
        String(a.start_time || "").localeCompare(String(b.start_time || ""))
      );

      const explicitActive = sorted.find(
        (item) => item.status === "active"
      );

      if (explicitActive) {
        return { item: explicitActive, live: true };
      }

      const timedActive = sorted.find((item) => {
        if (item.status === "completed" || item.status === "skipped") return false;
        const start = minutesFromTime(item.start_time);
        const end = minutesFromTime(item.end_time);
        return start !== null && end !== null && nowMinutes >= start && nowMinutes < end;
      });

      if (timedActive) {
        return { item: timedActive, live: true };
      }

      const nextItem = sorted.find((item) => {
        if (item.status === "completed" || item.status === "skipped") return false;
        const start = minutesFromTime(item.start_time);
        return start !== null && start > nowMinutes;
      });

      return { item: nextItem || null, live: false };
    }

    async function loadPlannerSchedule() {
      try {
        if (mounted) {
          setPlannerLoading(true);
          setPlannerError("");
        }

        const date = localDateString();
        const response = await apiFetch(`/api/planner/schedule?date=${date}`);
        if (!mounted) return;

        const result = findPlannerItem(response?.items || []);
        setCurrentScheduleItem(result.item);
        setPlannerItemIsLive(result.live);
      } catch (error) {
        console.error("ASCORA planner schedule error:", error);
        if (!mounted) return;
        setPlannerError("Planner schedule could not be loaded.");
        setCurrentScheduleItem(null);
        setPlannerItemIsLive(false);
      } finally {
        if (mounted) setPlannerLoading(false);
      }
    }

    loadPlannerSchedule();
    const interval = window.setInterval(loadPlannerSchedule, 30000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  // ============================================================
  // EVENT LOGGER
  // ============================================================

  async function handleEvent(type) {
    setState(type);

    if (!studentId) return;

    try {
      await apiFetch("/api/ascora/event", {
        method: "POST",
        body: JSON.stringify({
          student_id: studentId,
          event: type,
        }),
      });
    } catch (error) {
      console.error(
        "ASCORA event error:",
        error
      );
    }
  }

  // ============================================================
  // LOAD QUEUE
  // ============================================================

  async function loadQueue() {
    if (!studentId) {
      setQueue([]);
      setResolvedQueue([]);
      setMyRequest(null);
      setQueueLoading(false);
      return;
    }

    try {
      const {
        data: activeData,
        error: activeError,
      } = await supabase
        .from("doubt_queue")
        .select("*")
        .eq("classroom_id", classroomId)
        .in("status", ["waiting", "serving"])
        .order("raised_at", {
          ascending: true,
        });

      if (activeError) {
        throw activeError;
      }

      if (!isMountedRef.current) return;

      const activeQueue = activeData || [];

      setQueue(activeQueue);

      const mine = activeQueue.find(
        (item) =>
          item.student_id === studentId
      );

      setMyRequest(mine || null);

      // ----------------------------------------------------------
      // RESOLVED QUEUE
      // ----------------------------------------------------------

      const {
        data: resolvedData,
        error: resolvedError,
      } = await supabase
        .from("doubt_queue")
        .select("*")
        .eq("classroom_id", classroomId)
        .eq("status", "resolved")
        .order("resolved_at", {
          ascending: false,
        })
        .limit(10);

      if (resolvedError) {
        console.error(
          "Resolved queue error:",
          resolvedError
        );
      } else if (isMountedRef.current) {
        setResolvedQueue(
          resolvedData || []
        );
      }
    } catch (error) {
      console.error(
        "Queue loading error:",
        error
      );
    } finally {
      if (isMountedRef.current) {
        setQueueLoading(false);
      }
    }
  }

  // ============================================================
  // INITIAL QUEUE LOAD
  // ============================================================

  useEffect(() => {
    setQueueLoading(true);
    loadQueue();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // ============================================================
  // REALTIME QUEUE
  // ============================================================

  useEffect(() => {
    if (!studentId) return;

    const channel = supabase
      .channel(
        `ascora-doubt-queue-${studentId}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "doubt_queue",
          filter: `classroom_id=eq.${classroomId}`,
        },
        () => {
          loadQueue();
        }
      )
      .subscribe((status) => {
        console.log(
          "ASCORA queue realtime:",
          status
        );
      });

    return () => {
      supabase.removeChannel(channel);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  // ============================================================
  // CLAIM NEXT FIFO DOUBT
  // ============================================================

  async function claimNextDoubt() {
    if (claimingRef.current) {
      return null;
    }

    claimingRef.current = true;
    setClaiming(true);

    try {
      const {
        data: claimedRequest,
        error,
      } = await supabase.rpc(
        "claim_next_doubt",
        {
          p_classroom_id: classroomId,
        }
      );

      if (error) {
        console.error(
          "Claim next doubt error:",
          error
        );

        return null;
      }

      if (claimedRequest) {
        console.log(
          "ASCORA automatically serving:",
          claimedRequest.student_id
        );
      }

      await loadQueue();

      return claimedRequest;
    } catch (error) {
      console.error(
        "Unexpected claim error:",
        error
      );

      return null;
    } finally {
      claimingRef.current = false;

      if (isMountedRef.current) {
        setClaiming(false);
      }
    }
  }

  // ============================================================
  // AUTOMATICALLY CLAIM FIRST WAITING STUDENT
  // ============================================================

  useEffect(() => {
    if (!studentId) return;

    const serving = queue.some(
      (item) => item.status === "serving"
    );

    const waiting = queue.some(
      (item) => item.status === "waiting"
    );

    if (serving) return;
    if (!waiting) return;

    claimNextDoubt();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, studentId]);

  // ============================================================
  // CURRENT SERVING STUDENT
  // ============================================================

  const servingStudent = queue.find(
    (item) => item.status === "serving"
  );

  const isMyTurn =
    myRequest?.status === "serving";

  // ============================================================
  // WHEN MY REQUEST BECOMES SERVING
  // ============================================================

  useEffect(() => {
    if (myRequest?.status === "serving") {
      setState("serving");
      setAnswer("");

      setLecture(null);
      setLectureError("");
      setLectureLoading(false);

      clearTranscriptRef.current();

      processedTranscriptRef.current = "";

      console.log(
        "ASCORA: It is now",
        studentName,
        "'s turn."
      );
    } else {
      stopListeningRef.current();
    }
  }, [
    myRequest?.status,
    studentName,
  ]);

  // ============================================================
  // START MICROPHONE
  // ============================================================

  function handleStartSpeaking() {
    if (!voiceSupported) {
      setState("error");
      return;
    }

    if (!isMyTurn) {
      return;
    }

    setAnswer("");
    setLecture(null);
    setLectureError("");

    clearTranscriptRef.current();

    processedTranscriptRef.current = "";

    setState("listening");

    startListening();
  }

  // ============================================================
  // BUILD TRUSTED CLIENT CONTEXT
  // ============================================================

  function buildContext() {
    return {
      topic: activeTeachingTopic,

      planner: {
        scheduleItemId: currentScheduleItem?.id || null,
        topic: plannerTopic,
        itemType: plannerItemType,
        title: currentScheduleItem?.title || null,
        scheduledDate: currentScheduleItem?.scheduled_date || null,
        startTime: currentScheduleItem?.start_time || null,
        endTime: currentScheduleItem?.end_time || null,
        live: plannerItemIsLive,
      },

      mastery:
        data?.mastery ??
        data?.profile?.mastery ??
        "Unknown",

      pace:
        data?.strategy?.pace ||
        data?.pace ||
        "normal",

      difficulty:
        data?.strategy?.difficulty ||
        data?.difficulty ||
        "moderate",

      scaffolding:
        data?.strategy?.scaffolding ||
        data?.strategy?.scaffoldingLevel ||
        "medium",

      visualSupport:
        data?.strategy?.visualSupport ??
        data?.strategy?.visual ??
        false,

      misconceptions:
        Array.isArray(
          data?.misconceptions
        )
          ? data.misconceptions
          : [],
    };
  }

  // ============================================================
  // GENERATE ADAPTIVE LECTURE
  // ============================================================

  async function generateAdaptiveLecture(
    doubt,
    response,
    options = {}
  ) {
    if (!studentId || !doubt) {
      return;
    }

    setLectureLoading(true);
    setLectureError("");

    try {
      const lectureResponse =
        await apiFetch(
          "/api/ascora/lecture/generate",
          {
            method: "POST",
            body: JSON.stringify({
              studentId,

              topic:
                options.topic ||
                activeTeachingTopic ||
                response?.topic ||
                data?.topic ||
                "Unknown",

              doubt,

              objective:
                options.objective ||
                "Explain the student's doubt clearly and adapt the explanation to their learning profile while staying on the planner-scheduled topic.",
            }),
          }
        );

      if (
        !isMountedRef.current
      ) {
        return;
      }

      const generatedLecture =
        lectureResponse?.lecture ||
        null;

      const personalizedTopic =
        options.topic ||
        activeTeachingTopic ||
        response?.topic ||
        data?.topic ||
        doubt;

      setLecture(
        generatedLecture
          ? {
              ...generatedLecture,
              steps: enrichLectureSteps(
                generatedLecture.steps,
                personalizedTopic
              ),
            }
          : null
      );

      if (!generatedLecture) {
        setLectureError(
          "No visual explanation was generated."
        );
      }
    } catch (error) {
      console.error(
        "ASCORA lecture generation error:",
        error
      );

      if (
        isMountedRef.current
      ) {
        setLectureError(
          "Visual explanation could not be generated."
        );
      }
    } finally {
      if (isMountedRef.current) {
        setLectureLoading(false);
      }
    }
  }

  // ============================================================
  // AUTOMATICALLY START THE PLANNER LESSON
  //
  // This is deliberately separate from the doubt flow. A scheduled
  // lesson starts on its own, while the existing voice/doubt flow
  // remains unchanged and can still answer student questions.
  // ============================================================

  useEffect(() => {
    if (!studentId) return;
    if (!plannerItemIsLive) return;
    if (!currentScheduleItem?.id) return;
    if (plannerItemType !== "lesson") return;

    if (lastAutoTaughtPlannerItemRef.current === currentScheduleItem.id) {
      return;
    }

    lastAutoTaughtPlannerItemRef.current = currentScheduleItem.id;

    let cancelled = false;

    async function startScheduledLesson() {
      try {
        setState("thinking");
        setLecture(null);
        setLectureError("");

        const topic = activeTeachingTopic;
        const scheduledLessonPrompt =
          `Teach the scheduled topic "${topic}" from the planner. ` +
          `Start from the student's current mastery and misconceptions. ` +
          `This is a scheduled lesson, not a doubt response. ` +
          `Do not switch to another topic.`;

        await generateAdaptiveLecture(
          scheduledLessonPrompt,
          { topic },
          {
            topic,
            objective:
              "Teach the planner-scheduled topic clearly and adapt the explanation to the student's learning profile. Do not switch topics. Begin with the core concept, build understanding step by step, use the student's misconceptions when relevant, and include a simple example and checkpoint.",
          }
        );

        if (cancelled || !isMountedRef.current) return;

        setState("answering");
      } catch (error) {
        console.error("ASCORA scheduled lesson error:", error);
        if (!cancelled && isMountedRef.current) {
          setState("error");
          setLectureError("The scheduled lesson could not be started.");
        }
      }
    }

    startScheduledLesson();

    return () => {
      cancelled = true;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    studentId,
    plannerItemIsLive,
    currentScheduleItem?.id,
    plannerItemType,
  ]);

  // ============================================================
  // PROCESS VOICE DOUBT
  // ============================================================

  useEffect(() => {
    const doubt = transcript.trim();

    if (!doubt) return;

    if (!isMyTurn) {
      return;
    }

    if (listening) {
      return;
    }

    if (
      doubt ===
      processedTranscriptRef.current
    ) {
      return;
    }

    processedTranscriptRef.current =
      doubt;

    console.log(
      "ASCORA received doubt:",
      doubt
    );

    let cancelled = false;

    async function generateAnswer() {
      try {
        setState("thinking");

        const context =
          buildContext();

        // ------------------------------------------------------
        // REAL AI ANSWER
        // ------------------------------------------------------

        const response =
          await apiFetch(
            "/api/ascora/answer",
            {
              method: "POST",

              body: JSON.stringify({
                doubt,

                student_context:
                  context,
              }),
            }
          );

        if (
          cancelled ||
          !isMountedRef.current
        ) {
          return;
        }

        const generatedAnswer =
          response?.answer ||
          "I wasn't able to generate an answer.";

        setAnswer(
          generatedAnswer
        );

        setState("answering");

        // ------------------------------------------------------
        // BROWSER TEXT-TO-SPEECH
        // ------------------------------------------------------

        speakRef.current(
          generatedAnswer
        );

        // ------------------------------------------------------
        // GENERATE VISUAL LECTURE
        // ------------------------------------------------------

        await generateAdaptiveLecture(
          doubt,
          response
        );
      } catch (error) {
        console.error(
          "ASCORA answer error:",
          error
        );

        if (
          cancelled ||
          !isMountedRef.current
        ) {
          return;
        }

        setState("error");

        setAnswer(
          "I'm sorry, I couldn't generate an answer right now."
        );
      }
    }

    generateAnswer();

    return () => {
      cancelled = true;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    transcript,
    listening,
    isMyTurn,
  ]);

  // ============================================================
  // RESOLVE CURRENT DOUBT
  // ============================================================

  async function resolveCurrentDoubt() {
    if (!myRequest?.id) {
      return;
    }

    if (
      myRequest.status !== "serving"
    ) {
      return;
    }

    if (resolving) {
      return;
    }

    setResolving(true);

    try {
      stopListeningRef.current();

      const {
        data: resolvedRequest,
        error,
      } = await supabase.rpc(
        "resolve_doubt",
        {
          p_request_id:
            myRequest.id,
        }
      );

      if (error) {
        throw error;
      }

      if (!isMountedRef.current) {
        return;
      }

      console.log(
        "ASCORA resolved request:",
        resolvedRequest
      );

      setState("resolved");

      setAnswer("");
      setLecture(null);
      setLectureError("");
      setLectureLoading(false);

      clearTranscriptRef.current();

      processedTranscriptRef.current =
        "";

      await loadQueue();

      if (!isMountedRef.current) {
        return;
      }

      // --------------------------------------------------------
      // Immediately claim next FIFO student
      // --------------------------------------------------------

      await claimNextDoubt();

      if (!isMountedRef.current) {
        return;
      }

      setTimeout(() => {
        if (!isMountedRef.current) {
          return;
        }

        setState("idle");
        setPanelOpen(false);
      }, 1200);
    } catch (error) {
      console.error(
        "Resolve doubt error:",
        error
      );

      if (isMountedRef.current) {
        alert(
          "Unable to resolve this doubt. Please try again."
        );
      }
    } finally {
      if (isMountedRef.current) {
        setResolving(false);
      }
    }
  }

  // ============================================================
  // RAISE HAND
  // ============================================================

  async function raiseHand() {
    if (!studentId) {
      alert(
        "Please log in before raising your hand."
      );

      return;
    }

    if (myRequest) {
      return;
    }

    setRaisingHand(true);

    try {
      const {
        data: existingRequest,
        error: existingError,
      } = await supabase
        .from("doubt_queue")
        .select("*")
        .eq("student_id", studentId)
        .eq(
          "classroom_id",
          classroomId
        )
        .in("status", [
          "waiting",
          "serving",
        ])
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existingRequest) {
        setMyRequest(
          existingRequest
        );

        await loadQueue();

        return;
      }

      // Database controls raised_at.
      const {
        data: newRequest,
        error,
      } = await supabase
        .from("doubt_queue")
        .insert({
          student_id: studentId,
          classroom_id:
            classroomId,
          status: "waiting",
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      if (!isMountedRef.current) {
        return;
      }

      console.log(
        "Doubt raised:",
        newRequest
      );

      setMyRequest(newRequest);

      await loadQueue();
    } catch (error) {
      console.error(
        "Raise hand error:",
        error
      );

      // Duplicate active request is harmless.
      if (
        error?.code === "23505" ||
        /duplicate|already/i.test(
          error?.message || ""
        )
      ) {
        await loadQueue();
      } else if (
        isMountedRef.current
      ) {
        alert(
          "Unable to raise your hand. Please try again."
        );
      }
    } finally {
      if (isMountedRef.current) {
        setRaisingHand(false);
      }
    }
  }

  // ============================================================
  // LOWER HAND
  // ============================================================

  async function lowerHand() {
    if (!myRequest?.id) {
      return;
    }

    try {
      stopListeningRef.current();

      const { error } =
        await supabase
          .from("doubt_queue")
          .update({
            status: "cancelled",
          })
          .eq(
            "id",
            myRequest.id
          )
          .eq(
            "student_id",
            studentId
          );

      if (error) {
        throw error;
      }

      if (!isMountedRef.current) {
        return;
      }

      setMyRequest(null);

      setAnswer("");
      setLecture(null);
      setLectureError("");
      setLectureLoading(false);

      clearTranscriptRef.current();

      processedTranscriptRef.current =
        "";

      setState("idle");
      setPanelOpen(false);

      await loadQueue();

      await claimNextDoubt();
    } catch (error) {
      console.error(
        "Lower hand error:",
        error
      );

      if (isMountedRef.current) {
        alert(
          "Unable to lower your hand. Please try again."
        );
      }
    }
  }

  // ============================================================
  // DEMO LECTURE CONTROLLER
  // ============================================================
  const startDemoLecture = () => {
    if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
    window.speechSynthesis?.cancel();
    setDemoMode(true);
    setDemoPhase("lecture");
    setDemoStep(0);
    setState("answering");
  };

  const stopDemoLecture = () => {
    if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
    window.speechSynthesis?.cancel();
    setDemoMode(false);
    setDemoPhase("idle");
    setDemoStep(0);
    setState("idle");
  };

  useEffect(() => {
    if (!demoMode || demoPhase !== "lecture") return;
    // BUG FIX: guard against an out-of-range demoStep (e.g. if the
    // lecture array were ever shorter than the current step) instead
    // of silently rendering `undefined.title` further down and
    // crashing the whole console.
    const step = demoLecture[demoStep];
    if (!step) {
      setDemoStep(0);
      return;
    }

    setState("answering");

    speakStepText(step.text, {
      onEnd: () => {
        // Live check, not a stale closure — see demoModeRef above.
        if (!demoModeRef.current) return;
        if (demoStepRef.current !== demoStep) return;

        if (step.celebration) {
          burstConfetti(demoStageRef.current || document.body, { count: 26 });
          awardXp(20);
        }
        if (demoStep < demoLecture.length - 1) {
          demoTimerRef.current = setTimeout(() => setDemoStep((n) => n + 1), 800);
        } else {
          demoTimerRef.current = setTimeout(() => {
            setDemoPhase("doubts");
            setState("idle");
          }, 900);
        }
      },
    });

    return () => {
      window.speechSynthesis?.cancel();
      if (demoTimerRef.current) clearTimeout(demoTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, demoPhase, demoStep]);

  // ============================================================
  // QUEUE POSITION
  // ============================================================

  const myRequestIndex =
    myRequest?.status === "waiting"
      ? queue.findIndex(
          (item) =>
            item.id ===
            myRequest.id
        )
      : -1;

  const myPosition =
    myRequestIndex >= 0
      ? myRequestIndex + 1
      : null;

  // ============================================================
  // INTERACTION PANEL (doubt window + webcam)
  //
  // At rest, the HDMI screen shows ONLY the robot in portrait
  // format - no queue, no console, no camera. The moment a student
  // actually engages (raises their hand), the doubt window and the
  // webcam preview open up alongside the robot. It closes again once
  // the doubt is resolved or the hand is lowered.
  //
  // (panelOpen/setPanelOpen itself now lives up with the rest of the
  // top-level state — see the BUG FIX note above.)
  // ============================================================

  useEffect(() => {
    if (myRequest) {
      setPanelOpen(true);
    }
  }, [myRequest]);

  // ============================================================
  // WEBCAM (only requested while the interaction panel is open)
  // ============================================================

  const videoRef = useRef(null);
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState("");

  useEffect(() => {
    if (!panelOpen) {
      setWebcamActive(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setWebcamError("Camera access is not supported in this browser.");
      return;
    }

    let stream = null;
    let cancelled = false;

    async function startWebcam() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        setWebcamActive(true);
        setWebcamError("");
      } catch (error) {
        console.error("Webcam error:", error);

        if (!cancelled) {
          setWebcamActive(false);
          setWebcamError("Camera unavailable or permission was denied.");
        }
      }
    }

    startWebcam();

    return () => {
      cancelled = true;

      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [panelOpen]);

  // ============================================================
  // ROBOTIC TEACHER UI
  // ============================================================

  const lectureSteps = Array.isArray(lecture?.steps)
    ? lecture.steps.filter(Boolean)
    : [];

  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!lectureSteps.length) {
      setActiveStep(0);
      return;
    }
    setActiveStep((step) => Math.min(step, lectureSteps.length - 1));
  }, [lectureSteps.length]);

  const currentStep = lectureSteps[activeStep] || null;
  const currentVisual = currentStep?.visual || null;

  useEffect(() => {
    if (currentStep?.celebration) {
      burstConfetti(realLectureCardRef.current || document.body, { count: 22 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep, currentStep?.celebration]);

  // ============================================================
  // SPEAK THE REAL ADAPTIVE LECTURE, STEP BY STEP
  //
  // Previously only the demo lecture and the one-off doubt "answer"
  // were ever read aloud — the actual personalized visual lesson
  // (whatever topic it's for) showed text but stayed silent. This
  // speaks each step's text as the student lands on it, whether they
  // got there via "Next", "Previous", or a step tab, and whether the
  // lecture came from the backend or the client-side fallback. It
  // never re-speaks the same step twice in a row (e.g. on an
  // unrelated re-render) and stops immediately if the student mutes
  // it or navigates away.
  // ============================================================

  useEffect(() => {
    // Don't fight with the scripted demo lecture's own narration if
    // both happen to be mounted at once.
    if (demoMode || !autoSpeakSteps) {
      window.speechSynthesis?.cancel();
      return;
    }

    const stepKey = currentStep?.id ?? activeStep;
    const speechText = currentStep?.speech || currentStep?.text;

    if (!speechText) return;
    if (spokenStepKeyRef.current === stepKey) return;

    spokenStepKeyRef.current = stepKey;
    speakStepText(speechText);

    return () => {
      window.speechSynthesis?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep?.id, activeStep, autoSpeakSteps, demoMode]);

  const mastery =
    typeof data?.mastery === "number"
      ? Math.round(data.mastery * 100)
      : typeof data?.profile?.mastery === "number"
        ? Math.round(data.profile.mastery * 100)
        : null;

  const robotMode =
    state === "listening"
      ? "listening"
      : state === "thinking"
        ? "thinking"
        : state === "answering"
          ? "teaching"
          : state === "resolved"
            ? "success"
            : "ready";

  const robotStatus = {
    idle: "READY",
    serving: "READY TO TEACH",
    listening: "LISTENING",
    thinking: "THINKING",
    answering: "TEACHING",
    resolved: "SESSION COMPLETE",
    error: "ATTENTION",
  }[state] || "READY";

  return (
    <div className="ascora-robot-screen">
      <style>{`
        .ascora-robot-screen {
          min-height: 100vh;
          box-sizing: border-box;
          padding: 16px;
          color: #edf8ff;
          background:
            radial-gradient(circle at 20% 10%, rgba(72,196,255,.13), transparent 30%),
            radial-gradient(circle at 80% 80%, rgba(101,123,255,.10), transparent 35%),
            #06111d;
          font-family: Inter, ui-sans-serif, system-ui, sans-serif;
        }
        .robot-layout {
          width: min(1500px, 100%);
          min-height: calc(100vh - 32px);
          margin: auto;
          display: grid;
          grid-template-columns: minmax(390px, .92fr) minmax(500px, 1.35fr);
          gap: 16px;
        }
        .robot-card {
          border: 1px solid rgba(150,220,255,.13);
          border-radius: 26px;
          background: rgba(6,20,34,.82);
          box-shadow: 0 24px 80px rgba(0,0,0,.32);
          backdrop-filter: blur(18px);
          overflow: hidden;
        }
        .robot-left {
          min-height: calc(100vh - 32px);
          display: flex;
          flex-direction: column;
        }
        .robot-topbar {
          padding: 17px 20px;
          border-bottom: 1px solid rgba(150,220,255,.08);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .robot-brand {
          display: flex;
          align-items: center;
          gap: 9px;
          font-weight: 900;
          letter-spacing: .14em;
          font-size: 13px;
        }
        .robot-brand-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #68dcff;
          box-shadow: 0 0 16px #68dcff;
        }
        .robot-online {
          padding: 7px 10px;
          border-radius: 999px;
          border: 1px solid rgba(100,220,255,.18);
          color: #92def8;
          background: rgba(100,220,255,.06);
          font-size: 10px;
          font-weight: 850;
          letter-spacing: .08em;
        }
        .robot-center {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          text-align: center;
        }
        .robot-status {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 7px 12px;
          border-radius: 999px;
          border: 1px solid rgba(105,220,255,.18);
          background: rgba(105,220,255,.06);
          color: #8bdeff;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .12em;
          transition: color .25s ease, border-color .25s ease, background .25s ease;
        }
        .robot-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: currentColor;
          box-shadow: 0 0 12px currentColor;
        }
        .robot-heading {
          margin: 14px 0 5px;
          font-size: clamp(30px, 4vw, 48px);
          letter-spacing: -.045em;
        }
        .robot-planner-topic {
          margin-top: 11px;
          padding: 8px 12px;
          border: 1px solid rgba(110,231,255,.16);
          border-radius: 999px;
          background: rgba(110,231,255,.055);
          color: #8edfff;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .045em;
          max-width: min(520px, 90%);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .robot-message {
          max-width: 470px;
          color: #8ca7b9;
          line-height: 1.55;
          font-size: 13px;
          transition: opacity .2s ease;
        }
        .robot-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 9px;
          margin-top: 21px;
        }
        .robot-btn {
          border: 0;
          border-radius: 15px;
          padding: 13px 18px;
          font-weight: 850;
          cursor: pointer;
          transition: transform .18s ease, opacity .18s ease, box-shadow .18s ease;
        }
        .robot-btn:hover:not(:disabled) { transform: translateY(-2px); }
        .robot-btn:active:not(:disabled) { transform: translateY(0); }
        .robot-btn:disabled { opacity: .45; cursor: not-allowed; }
        .robot-primary { color: #03121d; background: linear-gradient(135deg,#7de4ff,#5c9fff); box-shadow: 0 12px 30px rgba(80,170,255,.2); }
        .robot-secondary { color: #d9edf7; background: rgba(255,255,255,.055); border: 1px solid rgba(150,220,255,.11); }
        .robot-danger { color: #ffb4b4; background: rgba(255,80,80,.08); border: 1px solid rgba(255,100,100,.18); }
        .robot-chip { margin-top: 16px; padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,.035); color: #a9c0ce; font-size: 11px; animation: ascora-fade-in .25s ease; }
        .robot-right { min-height: calc(100vh - 32px); display: flex; flex-direction: column; }
        .robot-content { flex: 1; overflow-y: auto; padding: 20px; }
        .console-title { font-size: 15px; font-weight: 900; }
        .console-subtitle { margin-top: 3px; color: #6f889a; font-size: 11px; }
        .profile-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 9px; margin: 17px 0; }
        .profile-item { padding: 12px; border-radius: 16px; background: rgba(255,255,255,.035); border: 1px solid rgba(150,220,255,.07); transition: background .2s ease, border-color .2s ease; }
        .profile-item:hover { background: rgba(255,255,255,.055); border-color: rgba(150,220,255,.14); }
        .profile-label { color: #6c8597; font-size: 9px; font-weight: 850; text-transform: uppercase; letter-spacing: .08em; }
        .profile-value { margin-top: 5px; color: #e6f4fb; font-size: 13px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .console-card { padding: 15px; border-radius: 20px; background: rgba(255,255,255,.035); border: 1px solid rgba(150,220,255,.08); margin-bottom: 12px; animation: ascora-fade-in .25s ease; }
        .console-card.highlight { border-color: rgba(100,220,255,.18); background: linear-gradient(145deg,rgba(70,185,255,.07),rgba(255,255,255,.025)); }
        .console-label { color: #7fddff; font-size: 11px; font-weight: 900; letter-spacing: .06em; }
        .console-text { margin-top: 8px; color: #d7e8f1; font-size: 13px; line-height: 1.6; white-space: pre-wrap; }
        .lesson-head { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:12px; }
        .lesson-badge { padding: 6px 9px; border-radius:999px; background:rgba(90,210,255,.08); color:#86ddff; font-size:9px; font-weight:900; }
        .step-tabs { display:flex; gap:6px; overflow-x:auto; margin-bottom:10px; }
        .step-tab { flex:0 0 auto; border:1px solid rgba(150,220,255,.08); background:rgba(255,255,255,.025); color:#718b9c; padding:7px 9px; border-radius:10px; font-size:9px; font-weight:900; cursor:pointer; transition: all .15s ease; }
        .step-tab:hover { border-color: rgba(150,220,255,.2); color: #a9c7d6; }
        .step-tab.active { color:#e3f8ff; border-color:rgba(90,210,255,.28); background:rgba(90,210,255,.1); }
        .step-speech { padding:11px; margin-bottom:12px; border-radius:14px; background:rgba(0,0,0,.13); color:#bdced9; font-size:12px; line-height:1.5; animation: ascora-fade-in .25s ease; }
        .queue-line { display:flex; justify-content:space-between; align-items:center; padding:10px 0; gap:10px; border-top:1px solid rgba(150,220,255,.06); }
        .queue-line:first-of-type { border-top:0; }
        .queue-name { color:#d8e8f0; font-size:12px; font-weight:800; }
        .queue-sub { margin-top:3px; color:#6d8697; font-size:10px; }
        .queue-pill { padding:6px 9px; border-radius:999px; background:rgba(255,255,255,.05); color:#a6bfce; font-size:9px; font-weight:900; }
        .empty { padding:22px 10px; text-align:center; color:#6e8798; font-size:11px; }
        .thinking { display:flex; align-items:center; gap:8px; color:#83dcff; font-size:11px; font-weight:800; }
        .thinking-dot { width:7px; height:7px; border-radius:50%; background:#73dcff; animation:ascora-pulse 1s ease-in-out infinite; }
        @keyframes ascora-pulse { 0%,100%{opacity:.35;transform:scale(.7)} 50%{opacity:1;transform:scale(1.25)} }
        @keyframes ascora-fade-in { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .demo-launcher{margin:16px 20px 0;padding:14px;border-radius:18px;border:1px solid rgba(115,220,255,.18);background:linear-gradient(135deg,rgba(64,190,255,.10),rgba(120,100,255,.08))}.demo-launcher-title{font-weight:900;font-size:13px}.demo-launcher-sub{color:#89a5b8;font-size:11px;margin-top:4px;line-height:1.45}.demo-btn{margin-top:10px;width:100%;border:0;border-radius:12px;padding:11px 13px;background:linear-gradient(135deg,#6ee7ff,#7c83ff);color:#06111d;font-weight:900;cursor:pointer;transition:transform .15s ease}.demo-btn:hover{transform:translateY(-1px)}.demo-stage{border:1px solid rgba(130,220,255,.14);border-radius:20px;padding:18px;background:rgba(3,13,24,.72);margin-bottom:14px}.demo-stage-head{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}.demo-kicker{font-size:10px;font-weight:900;letter-spacing:.12em;color:#78ddff}.demo-progress{height:5px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden;margin:10px 0 18px}.demo-progress>div{height:100%;background:linear-gradient(90deg,#68dcff,#8b7cff);transition:width .5s ease}.demo-visual{font-size:clamp(30px,5vw,52px);font-weight:900;letter-spacing:-.04em;text-align:center;padding:24px 12px;color:#ecfbff;transition:opacity .2s ease}.demo-speech{color:#a9bfce;text-align:center;line-height:1.65;max-width:720px;margin:0 auto;font-size:14px}.demo-doubt{border:1px solid rgba(118,229,255,.22);background:linear-gradient(135deg,rgba(70,200,255,.10),rgba(121,99,255,.10));border-radius:20px;padding:22px;text-align:center}.demo-doubt-icon{font-size:42px;animation:ascora-bounce 1.2s ease-in-out infinite}.demo-doubt h2{margin:7px 0 5px;font-size:26px}.demo-doubt p{color:#9bb4c4;margin:0 auto 16px;max-width:560px;line-height:1.5}@keyframes ascora-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}

        .demo-topic-input {
          width: 100%;
          box-sizing: border-box;
          margin-top: 10px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid rgba(150,220,255,.16);
          background: rgba(3,13,24,.6);
          color: #e6f4fb;
          font-size: 12px;
          font-family: inherit;
        }
        .demo-topic-input:focus {
          outline: none;
          border-color: rgba(110,231,255,.5);
        }
        .demo-topic-input::placeholder { color: #5f7889; }

        /* Real-world "why it matters" callout, shared by the demo and
           the real adaptive lecture. */
        .demo-connection {
          margin-top: 12px;
          padding: 12px 14px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(255,211,110,.08), rgba(110,231,255,.06));
          border: 1px solid rgba(255,211,110,.18);
          color: #f0e4c8;
          font-size: 12px;
          line-height: 1.55;
          animation: ascora-fade-in .3s ease;
        }
        .demo-connection-label {
          display: block;
          color: #ffd36e;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .06em;
          margin-bottom: 4px;
        }

        /* "Did you know?" trivia callout — a different accent from the
           "why it matters" card so the two don't blur together. */
        .demo-funfact {
          margin-top: 12px;
          padding: 12px 14px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(150,120,255,.1), rgba(110,231,255,.05));
          border: 1px solid rgba(150,120,255,.22);
          color: #ddd4ff;
          font-size: 12px;
          line-height: 1.55;
          animation: ascora-fade-in .3s ease;
        }
        .demo-funfact-label {
          display: block;
          color: #b9a6ff;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .06em;
          margin-bottom: 4px;
        }

        /* XP badge — pops via the Web Animations API on award, see
           awardXp()/popBadge() above. */
        .xp-badge {
          padding: 6px 10px;
          border-radius: 999px;
          background: linear-gradient(135deg, rgba(255,211,110,.16), rgba(255,180,80,.08));
          border: 1px solid rgba(255,211,110,.32);
          color: #ffe6ad;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .04em;
          white-space: nowrap;
        }

        /* Mute / replay controls next to the real adaptive lesson. */
        .speak-toggle-btn {
          border: 1px solid rgba(150,220,255,.16);
          background: rgba(255,255,255,.04);
          color: #9fd8ee;
          width: 28px;
          height: 28px;
          border-radius: 999px;
          font-size: 12px;
          line-height: 1;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: transform .15s ease, border-color .15s ease, background .15s ease;
        }
        .speak-toggle-btn:hover {
          transform: translateY(-1px);
          border-color: rgba(110,231,255,.4);
          background: rgba(110,231,255,.08);
        }

        /* ============================================================
           CHALLENGE CARD — the tap-to-answer "quick check" embedded in
           a lecture step.
        ============================================================ */
        .challenge-card {
          margin-top: 12px;
          padding: 14px;
          border-radius: 16px;
          background: rgba(110,231,255,.05);
          border: 1px solid rgba(110,231,255,.16);
          animation: ascora-fade-in .3s ease;
          transition: border-color .25s ease, background .25s ease;
        }
        .challenge-card.correct {
          border-color: rgba(120,230,140,.35);
          background: rgba(120,230,140,.06);
        }
        .challenge-kicker {
          font-size: 10px;
          font-weight: 900;
          letter-spacing: .08em;
          color: #7fddff;
          margin-bottom: 6px;
        }
        .challenge-question {
          color: #e6f4fb;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.5;
          margin-bottom: 10px;
        }
        .challenge-options {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }
        .challenge-option {
          text-align: left;
          border: 1px solid rgba(150,220,255,.14);
          background: rgba(255,255,255,.03);
          color: #cfe4ee;
          padding: 10px 12px;
          border-radius: 11px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: border-color .15s ease, background .15s ease, transform .15s ease;
        }
        .challenge-option:hover:not(:disabled) {
          border-color: rgba(110,231,255,.4);
          transform: translateY(-1px);
        }
        .challenge-option:disabled { cursor: default; }
        .challenge-option.is-correct {
          border-color: rgba(120,230,140,.55);
          background: rgba(120,230,140,.12);
          color: #d3ffdd;
        }
        .challenge-option.is-wrong {
          border-color: rgba(255,110,110,.5);
          background: rgba(255,110,110,.1);
          color: #ffd4d4;
        }
        .challenge-feedback {
          margin-top: 10px;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.5;
        }
        .challenge-feedback.is-correct { color: #9ff2b4; }
        .challenge-feedback.is-wrong { color: #ffb4b4; }

        /* ============================================================
           ANIMATED VISUALS — student-friendly, subject-agnostic
        ============================================================ */
        .av-anim-key { animation: ascora-fade-in .35s ease; }
        .av-wrap {
          padding: 14px 10px 4px;
          text-align: center;
        }
        .av-svg { width: 100%; max-width: 320px; height: auto; }
        .av-caption {
          margin-top: 10px;
          color: #8ca7b9;
          font-size: 11px;
          line-height: 1.5;
        }

        .av-eq-box {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }
        .av-eq-chip {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(110,231,255,.12);
          border: 1px solid rgba(110,231,255,.3);
          color: #d6f4ff;
          font-weight: 900;
          font-size: 18px;
        }
        .av-eq-result {
          background: rgba(255,211,110,.14);
          border-color: rgba(255,211,110,.35);
          color: #ffe6ad;
          font-family: inherit;
          cursor: pointer;
          transition: transform .15s ease, background .2s ease, border-color .2s ease;
        }
        .av-eq-result:hover:not(.is-revealed) { transform: translateY(-2px) scale(1.05); }
        .av-eq-result.is-revealed { background: rgba(120,230,140,.16); border-color: rgba(120,230,140,.45); color: #d3ffdd; cursor: default; }
        .av-eq-op { color: #7fddff; font-weight: 900; font-size: 20px; }
        .av-eq-box > * { opacity: 0; animation: av-pop-in .45s ease forwards; }
        .av-in-1 { animation-delay: .05s; }
        .av-in-2 { animation-delay: .18s; }
        .av-in-3 { animation-delay: .31s; }
        .av-in-4 { animation-delay: .44s; }
        .av-in-5 { animation-delay: .6s; }
        @keyframes av-pop-in {
          from { opacity: 0; transform: translateY(6px) scale(.85); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .av-nl-dot {
          animation: av-nl-slide 2.4s ease-in-out infinite;
        }
        /* BUG FIX: "cx: 10" (no unit) is not a valid CSS length, so
           browsers were dropping this whole keyframe rule and the dot
           just sat still at its default position. "10px" etc. is a
           valid CSS length that maps onto the SVG geometry property. */
        @keyframes av-nl-slide {
          0% { cx: 10px; }
          50% { cx: 310px; }
          100% { cx: 10px; }
        }

        .av-bar-row {
          display: flex;
          align-items: flex-end;
          justify-content: center;
          gap: 14px;
          height: 90px;
        }
        .av-bar {
          width: 34px;
          border-radius: 8px 8px 3px 3px;
          background: linear-gradient(180deg, #6ee7ff, #5c9fff);
          transform-origin: bottom;
          animation: av-bar-grow 1.4s ease forwards;
        }
        .av-bar-1 { height: 40%; animation-delay: .05s; }
        .av-bar-2 { height: 78%; animation-delay: .2s; }
        .av-bar-3 { height: 58%; animation-delay: .35s; }
        @keyframes av-bar-grow {
          from { transform: scaleY(0); opacity: 0; }
          to { transform: scaleY(1); opacity: 1; }
        }

        .av-tl-track {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 22px;
          padding: 18px 0;
        }
        .av-tl-dot {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: rgba(110,231,255,.25);
          border: 1px solid rgba(110,231,255,.4);
          opacity: 0;
          animation: av-pop-in .4s ease forwards;
        }
        .av-tl-dot-0 { animation-delay: .05s; }
        .av-tl-dot-1 { animation-delay: .35s; background: rgba(110,231,255,.55); }
        .av-tl-dot-2 { animation-delay: .65s; }
        .av-tl-dot-3 { animation-delay: .95s; background: rgba(255,211,110,.55); }

        .av-compare {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 18px;
        }
        .av-compare-side {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 900;
          font-size: 20px;
          background: rgba(110,231,255,.1);
          border: 1px solid rgba(110,231,255,.28);
          color: #d6f4ff;
          animation: av-tilt 2.6s ease-in-out infinite;
        }
        .av-compare-right { animation-delay: 1.3s; background: rgba(255,211,110,.1); border-color: rgba(255,211,110,.28); color: #ffe6ad; }
        .av-compare-vs { color: #6f889a; font-size: 11px; font-weight: 900; }
        @keyframes av-tilt {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        .av-concept-core {
          fill: rgba(110,231,255,.35);
          animation: av-glow-pulse 2.2s ease-in-out infinite;
        }
        .av-concept-node circle {
          opacity: 0;
          animation: av-pop-in .4s ease forwards;
        }
        .av-concept-node-0 circle { animation-delay: .15s; }
        .av-concept-node-1 circle { animation-delay: .35s; }
        .av-concept-node-2 circle { animation-delay: .55s; }
        @keyframes av-glow-pulse {
          0%, 100% { opacity: .75; }
          50% { opacity: 1; }
        }

        /* Tap-to-flip cards — the one visual the student actually
           operates rather than watches. Real 3D flip via CSS
           transforms, no image assets needed. */
        .av-card-row {
          display: flex;
          justify-content: center;
          gap: 16px;
          perspective: 800px;
        }
        .av-flip-card {
          border: 0;
          background: transparent;
          padding: 0;
          cursor: pointer;
          width: 72px;
          height: 86px;
        }
        .av-flip-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform .5s cubic-bezier(.2,.8,.3,1);
          transform-style: preserve-3d;
        }
        .av-flip-card.is-flipped .av-flip-card-inner { transform: rotateY(180deg); }
        .av-flip-card-face {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          backface-visibility: hidden;
          font-size: 26px;
          font-weight: 900;
        }
        .av-flip-card-front {
          background: rgba(110,231,255,.1);
          border: 1px solid rgba(110,231,255,.28);
          color: #7fddff;
        }
        .av-flip-card-back {
          background: rgba(255,211,110,.14);
          border: 1px solid rgba(255,211,110,.35);
          color: #ffe6ad;
          transform: rotateY(180deg);
        }

        /* ============================================================
           ASCORA AI TEACHER AVATAR
           One portrait image (no duplicated limb layers - those caused
           unnatural-looking joints and were removed). Motion comes from
           whole-image transforms/filters plus a glow, a listening ring,
           and a speaking indicator drawn as separate overlay elements.
        ============================================================ */
        .robot-face.teacher-mode {
          width: min(470px, 78vw);
          height: min(610px, 70vh);
          aspect-ratio: auto;
          border: 0;
          border-radius: 28px;
          margin-bottom: 18px;
          overflow: visible;
          background: transparent;
          box-shadow: none;
          display: block;
        }

        .teacher-avatar-stage {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          border-radius: 28px;
          background:
            radial-gradient(circle at 50% 30%, rgba(120,215,255,.10), transparent 48%),
            rgba(255,255,255,.035);
          border: 1px solid rgba(150,220,255,.14);
          box-shadow:
            0 24px 65px rgba(0,0,0,.35),
            0 0 45px rgba(90,205,255,.08);
          isolation: isolate;
        }

        .teacher-avatar-main {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center center;
          user-select: none;
          pointer-events: none;
          z-index: 2;
          filter: drop-shadow(0 22px 35px rgba(0,0,0,.24));
          transform-origin: 50% 48%;
          animation: ai-teacher-idle 7s ease-in-out infinite;
          will-change: transform, filter;
        }

        .teacher-avatar-stage.speaking .teacher-avatar-main {
          animation: ai-teacher-speaking 4.8s ease-in-out infinite;
        }

        .teacher-avatar-stage.listening .teacher-avatar-main {
          animation: ai-teacher-listening 5.5s ease-in-out infinite;
        }

        /* Subtle per-step variety during the scripted demo lecture. */
        .teacher-avatar-stage.gesture-1 .teacher-avatar-main { animation-delay: -1.2s; }
        .teacher-avatar-stage.gesture-2 .teacher-avatar-main { animation-delay: -2.4s; }
        .teacher-avatar-stage.gesture-3 .teacher-avatar-main { animation-delay: -3.6s; }

        .ai-avatar-glow {
          position: absolute;
          inset: 7% 10% 4%;
          z-index: 0;
          border-radius: 42% 42% 30% 30%;
          background: radial-gradient(ellipse at 50% 38%, rgba(92,210,255,.16), transparent 62%);
          filter: blur(18px);
          opacity: .55;
          animation: ai-glow-idle 5s ease-in-out infinite;
          pointer-events: none;
        }

        .teacher-avatar-stage.speaking .ai-avatar-glow {
          opacity: .85;
          animation: ai-glow-speaking 1.8s ease-in-out infinite;
        }

        .ai-speaking-indicator {
          position: absolute;
          z-index: 8;
          left: 50%;
          bottom: 12px;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 4px;
          height: 22px;
          padding: 5px 9px;
          border: 1px solid rgba(120,220,255,.24);
          border-radius: 999px;
          background: rgba(7,18,30,.56);
          backdrop-filter: blur(10px);
          opacity: 0;
          transition: opacity .25s ease;
        }

        .teacher-avatar-stage.speaking .ai-speaking-indicator {
          opacity: 1;
        }

        .ai-speaking-indicator span {
          width: 3px;
          height: 6px;
          border-radius: 99px;
          background: rgba(170,235,255,.9);
          animation: ai-wave 1s ease-in-out infinite;
        }
        .ai-speaking-indicator span:nth-child(2) { animation-delay: -.18s; }
        .ai-speaking-indicator span:nth-child(3) { animation-delay: -.36s; }
        .ai-speaking-indicator span:nth-child(4) { animation-delay: -.54s; }
        .ai-speaking-indicator span:nth-child(5) { animation-delay: -.72s; }

        .ai-listening-ring {
          position: absolute;
          z-index: 1;
          inset: 5%;
          border: 1px solid rgba(100,215,255,0);
          border-radius: 30px;
          pointer-events: none;
          transition: all .3s ease;
        }

        .teacher-avatar-stage.listening .ai-listening-ring {
          border-color: rgba(100,215,255,.32);
          box-shadow: 0 0 28px rgba(70,205,255,.12);
          animation: ai-listen-pulse 2s ease-in-out infinite;
        }

        @keyframes ai-teacher-idle {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
          25% { transform: translate3d(0, -1px, 0) rotate(.15deg) scale(1.001); }
          50% { transform: translate3d(0, -3px, 0) rotate(-.18deg) scale(1.003); }
          75% { transform: translate3d(0, -1px, 0) rotate(.1deg) scale(1.001); }
        }

        @keyframes ai-teacher-speaking {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg) scale(1); }
          22% { transform: translate3d(-1px, -2px, 0) rotate(-.18deg) scale(1.002); }
          48% { transform: translate3d(1px, -3px, 0) rotate(.2deg) scale(1.004); }
          73% { transform: translate3d(0, -1px, 0) rotate(-.1deg) scale(1.002); }
        }

        @keyframes ai-teacher-listening {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
          45% { transform: translate3d(0, -2px, 0) rotate(-.35deg); }
          70% { transform: translate3d(0, -1px, 0) rotate(.18deg); }
        }

        @keyframes ai-glow-idle {
          0%, 100% { transform: scale(.98); opacity: .45; }
          50% { transform: scale(1.02); opacity: .62; }
        }

        @keyframes ai-glow-speaking {
          0%, 100% { transform: scale(.98); opacity: .58; }
          50% { transform: scale(1.04); opacity: .9; }
        }

        @keyframes ai-listen-pulse {
          0%, 100% { transform: scale(.99); opacity: .55; }
          50% { transform: scale(1.008); opacity: 1; }
        }

        @keyframes ai-wave {
          0%, 100% { height: 5px; opacity: .5; }
          50% { height: 15px; opacity: 1; }
        }

        @media (max-width: 950px) {
          .robot-face.teacher-mode {
            width: min(430px, 82vw);
            height: min(560px, 68vh);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .teacher-avatar-main {
            animation: none !important;
          }
        }

        /* ============================================================
           HDMI / PORTRAIT IDLE SCREEN
           This is what's on screen at rest: the robot alone, in
           portrait format, full-bleed. The doubt window (the console
           layout below) and the webcam preview only mount once
           panelOpen becomes true (a hand is raised).
        ============================================================ */
        .hdmi-screen {
          min-height: 100vh;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
          text-align: center;
          position: relative;
        }
        .hdmi-screen .robot-face.teacher-mode {
          width: min(78vw, 720px);
          height: min(78vh, 980px);
        }
        .hdmi-heading {
          margin: 18px 0 6px;
          font-size: clamp(34px, 5vw, 64px);
          letter-spacing: -.04em;
        }
        .hdmi-message {
          max-width: 640px;
          color: #9db6c6;
          font-size: clamp(14px, 1.6vw, 18px);
          line-height: 1.6;
        }
        .hdmi-open-console-btn {
          position: fixed;
          right: 18px;
          bottom: 18px;
          border: 1px solid rgba(150,220,255,.16);
          background: rgba(6,20,34,.75);
          color: #86ddff;
          font-size: 11px;
          font-weight: 800;
          padding: 9px 13px;
          border-radius: 999px;
          cursor: pointer;
          opacity: .35;
          transition: opacity .2s ease, transform .2s ease;
          backdrop-filter: blur(8px);
        }
        .hdmi-open-console-btn:hover {
          opacity: 1;
          transform: translateY(-2px);
        }

        /* ============================================================
           WEBCAM PREVIEW (inside the doubt window, once it opens)
        ============================================================ */
        .webcam-frame {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 3;
          border-radius: 18px;
          overflow: hidden;
          background: #030c15;
          border: 1px solid rgba(150,220,255,.14);
        }
        .webcam-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1);
        }
        .webcam-badge {
          position: absolute;
          top: 10px;
          left: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 9px;
          border-radius: 999px;
          background: rgba(6,20,34,.72);
          border: 1px solid rgba(150,220,255,.16);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: .06em;
          color: #86ddff;
        }
        .webcam-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ff5c5c;
          box-shadow: 0 0 8px #ff5c5c;
        }
        .webcam-dot.live {
          background: #6ee7ff;
          box-shadow: 0 0 8px #6ee7ff;
          animation: ascora-pulse 1.2s ease-in-out infinite;
        }
        .webcam-empty {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #5f7889;
          font-size: 11px;
          padding: 20px;
          text-align: center;
        }
        .robot-layout { animation: ascora-fade-in .3s ease; }

        @media(max-width:950px){ .robot-layout{grid-template-columns:1fr}.robot-left,.robot-right{min-height:auto}.profile-grid{grid-template-columns:repeat(2,1fr)} }
      `}</style>

      <div className="robot-layout">
        <section className="robot-card robot-left">
          <div className="robot-topbar">
            <div className="robot-brand"><span className="robot-brand-dot" />ASCORA</div>
            <div className="robot-online">{connected ? "● ONLINE" : "○ OFFLINE"}</div>
          </div>

          {!demoMode && (
            <div className="demo-launcher">
              <div className="demo-launcher-title">🎬 DEMO CLASSROOM</div>
              <div className="demo-launcher-sub">
                ASCORA follows the planner topic automatically — {activeTeachingTopic ? `currently "${activeTeachingTopic}"` : "no topic loaded yet"}. Type a different topic only to preview a demo.
              </div>
              <input
                className="demo-topic-input"
                type="text"
                value={demoTopicInput}
                onChange={(event) => setDemoTopicInput(event.target.value)}
                placeholder={activeTeachingTopic ? `e.g. "${activeTeachingTopic}" or any other topic` : "e.g. photosynthesis, fractions, the water cycle..."}
              />
              <button className="demo-btn" onClick={startDemoLecture}>▶ Start Personalized Demo Lecture</button>
            </div>
          )}

          <div className="robot-center">
            <div className={`robot-face teacher-mode ${robotMode}`}>
              <div
                className={`teacher-avatar-stage ${
                  state === "listening"
                    ? "listening"
                    : state === "answering" ||
                      (demoMode && demoPhase === "lecture")
                      ? "speaking"
                      : ""
                } gesture-${demoMode ? demoStep % 4 : 0}`}
              >
                <div className="ai-avatar-glow" aria-hidden="true" />
                <img
                  src={teacherAvatar}
                  alt="ASCORA AI Teacher"
                  className="teacher-avatar-main"
                />
                <div className="ai-speaking-indicator" aria-hidden="true">
                  <span /><span /><span /><span /><span />
                </div>
                <div className="ai-listening-ring" aria-hidden="true" />
              </div>
            </div>

            <div className="robot-status">
              <span className="robot-status-dot" />
              {robotStatus}
            </div>

            <h1 className="robot-heading">Hi, {studentName}.</h1>

            <div className="robot-planner-topic">
              {plannerLoading
                ? "📚 Loading today's planner..."
                : plannerTopic
                  ? `${plannerItemIsLive ? "📚 NOW TEACHING" : "📚 NEXT PLANNER TOPIC"}: ${plannerTopic}`
                  : "📚 No lesson scheduled right now"}
            </div>

            <div className="robot-message">
              {state === "listening"
                ? "I'm listening. Tell me exactly what you are stuck on."
                : state === "thinking"
                  ? "I'm thinking about your learning profile and your doubt."
                  : state === "answering"
                    ? "I'm teaching this in a way adapted to you."
                    : isMyTurn
                      ? "I'm ready to help. Ask your doubt whenever you're ready."
                      : myRequest?.status === "waiting"
                        ? `You're in the queue at position #${myPosition || "—"}. I'll call you when I'm ready.`
                        : "Raise your hand and I'll help you when it's your turn."}
            </div>

            <div className="robot-actions">
              {!myRequest && (
                <button className="robot-btn robot-primary" onClick={raiseHand} disabled={raisingHand || !studentId}>
                  {raisingHand ? "Connecting..." : "🙋 Raise Hand"}
                </button>
              )}

              {isMyTurn && voiceSupported && (
                <button
                  className={`robot-btn ${listening ? "robot-danger" : "robot-primary"}`}
                  onClick={listening ? stopListening : handleStartSpeaking}
                >
                  {listening ? "⏹ Stop Listening" : "🎤 Ask ASCORA"}
                </button>
              )}

              {myRequest && !isMyTurn && (
                <button className="robot-btn robot-secondary" onClick={lowerHand} disabled={resolving}>
                  Lower Hand
                </button>
              )}

              {answer && isMyTurn && (
                <button className="robot-btn robot-secondary" onClick={resolveCurrentDoubt} disabled={resolving}>
                  {resolving ? "Finishing..." : "✓ Done"}
                </button>
              )}
            </div>

            {isMyTurn && <div className="robot-chip">🎓 Personalized teaching session active</div>}
            {myRequest?.status === "waiting" && <div className="robot-chip">🙋 Hand raised · #{myPosition || "—"} in queue</div>}
            {!voiceSupported && isMyTurn && <div className="robot-chip">Voice input is not supported in this browser.</div>}
          </div>
        </section>

        <section className="robot-card robot-right">
          {demoMode && demoPhase === "lecture" && (() => {
            // BUG FIX: index defensively instead of trusting demoStep
            // to always be in range. demoLecture is a fixed-length
            // array in practice, but falling back to the first step
            // (rather than crashing the whole console on
            // `undefined.title`) keeps one bad state transition from
            // taking down the entire teaching UI.
            const activeDemoStep = demoLecture[demoStep] || demoLecture[0];
            if (!activeDemoStep) return null;

            return (
              <div className="demo-stage" style={{margin:"16px 16px 0"}} ref={demoStageRef}>
                <div className="demo-stage-head">
                  <div><div className="demo-kicker">ASCORA LIVE DEMO · LECTURE</div><h2 style={{margin:"5px 0 0",fontSize:24}}>{activeDemoStep.title}</h2></div>
                  <div style={{display:"flex", alignItems:"center", gap:8}}>
                    <div className="xp-badge" ref={xpBadgeRef}>⭐ {xp} XP</div>
                    <div className="lesson-badge">{demoStep + 1}/{demoLecture.length}</div>
                  </div>
                </div>
                <div className="demo-progress"><div style={{width:`${((demoStep + 1) / demoLecture.length) * 100}%`}} /></div>
                <div key={demoStep} className="av-anim-key">
                  <AnimatedVisual visual={activeDemoStep.visual} />
                </div>
                <div className="demo-speech">{activeDemoStep.text}</div>
                {activeDemoStep.connection && (
                  <div className="demo-connection">
                    <span className="demo-connection-label">Why it matters</span>
                    {activeDemoStep.connection}
                  </div>
                )}
                {activeDemoStep.funFact && (
                  <div className="demo-funfact">
                    <span className="demo-funfact-label">✨ Did you know?</span>
                    {activeDemoStep.funFact}
                  </div>
                )}
                {activeDemoStep.challenge && (
                  <ChallengeCard
                    key={`challenge-${demoStep}`}
                    challenge={activeDemoStep.challenge}
                    onCorrect={() => awardXp(10)}
                  />
                )}
                <div className="robot-actions" style={{marginTop:16}}>
                  <button className="robot-btn robot-secondary" onClick={stopDemoLecture}>Exit Demo</button>
                  <button
                    className="robot-btn robot-secondary"
                    onClick={() => speakStepText(activeDemoStep.text)}
                  >
                    ↻ Replay
                  </button>
                  <button className="robot-btn robot-primary" onClick={() => setDemoStep((n) => Math.min(demoLecture.length - 1, n + 1))}>Next Step →</button>
                </div>
              </div>
            );
          })()}
          {demoMode && demoPhase === "doubts" && (
            <div className="demo-doubt" style={{margin:"16px 16px 0"}}>
              <div className="demo-doubt-icon">🙋</div><div className="demo-kicker">LECTURE COMPLETE · ⭐ {xp} XP EARNED</div><h2>Doubt Session is Open</h2><p>Great! The lecture is complete. ASCORA is now ready to listen to students. Raise your hand to interact with the robot.</p>
              <div className="robot-actions" style={{justifyContent:"center"}}><button className="robot-btn robot-primary" onClick={raiseHand} disabled={raisingHand || !studentId}>{raisingHand ? "Joining Queue..." : "🙋 Raise Hand & Ask ASCORA"}</button><button className="robot-btn robot-secondary" onClick={stopDemoLecture}>End Demo</button></div>
            </div>
          )}
          <div className="robot-topbar">
            <div>
              <div className="console-title">ADAPTIVE TEACHING CONSOLE</div>
              <div className="console-subtitle">Planner topic · live student context · doubt · visual lesson</div>
            </div>
            <div className="robot-online">{queue.length} ACTIVE</div>
          </div>

          <div className="robot-content">
            <div className="profile-grid">
              <div className="profile-item"><div className="profile-label">Planner Topic</div><div className="profile-value">{plannerTopic || "—"}</div></div>
              <div className="profile-item"><div className="profile-label">Mastery</div><div className="profile-value">{mastery !== null ? `${mastery}%` : "—"}</div></div>
              <div className="profile-item"><div className="profile-label">Difficulty</div><div className="profile-value">{data?.strategy?.difficulty || data?.difficulty || "Adaptive"}</div></div>
              <div className="profile-item"><div className="profile-label">Pace</div><div className="profile-value">{data?.strategy?.pace || data?.pace || "Adaptive"}</div></div>
              <div className="profile-item"><div className="profile-label">Scaffolding</div><div className="profile-value">{data?.strategy?.scaffolding || data?.strategy?.scaffoldingLevel || "Adaptive"}</div></div>
              <div className="profile-item"><div className="profile-label">Visual Support</div><div className="profile-value">{(data?.strategy?.visualSupport ?? data?.strategy?.visual) ? "Enabled" : "Standard"}</div></div>
            </div>

            {currentScheduleItem && (
              <div className="console-card highlight">
                <div className="console-label">📚 PLANNER SCHEDULE</div>
                <div className="console-text">
                  {plannerItemIsLive ? "ASCORA is teaching now" : "Next scheduled lesson"}: {plannerTopic}
                  {currentScheduleItem.start_time && currentScheduleItem.end_time
                    ? ` · ${currentScheduleItem.start_time.slice(0, 5)}–${currentScheduleItem.end_time.slice(0, 5)}`
                    : ""}
                  {plannerItemType !== "lesson" ? ` · ${plannerItemType.toUpperCase()}` : ""}
                </div>
              </div>
            )}

            {plannerError && (
              <div className="console-card">
                <div className="console-label">⚠ PLANNER</div>
                <div className="console-text">{plannerError}</div>
              </div>
            )}

            {transcript && (
              <div className="console-card highlight">
                <div className="console-label">🎤 STUDENT DOUBT</div>
                <div className="console-text">{transcript}</div>
              </div>
            )}

            {state === "thinking" && (
              <div className="console-card">
                <div className="thinking"><span className="thinking-dot" />ASCORA is analysing your doubt...</div>
              </div>
            )}

            {answer && (
              <div className="console-card highlight">
                <div className="console-label">🤖 ASCORA</div>
                <div className="console-text">{answer}</div>
              </div>
            )}

            {voiceError && (
              <div className="console-card">
                <div className="console-label">⚠ VOICE</div>
                <div className="console-text">{voiceError}</div>
              </div>
            )}

            <div className="console-card" ref={realLectureCardRef}>
              <div className="lesson-head">
                <div className="console-label">✦ PERSONALIZED VISUAL LESSON</div>
                <div style={{display:"flex", alignItems:"center", gap:8}}>
                  {xp > 0 && <div className="xp-badge" ref={realXpBadgeRef}>⭐ {xp} XP</div>}
                  {lectureSteps.length > 0 && (
                    <button
                      type="button"
                      className="speak-toggle-btn"
                      onClick={() => setAutoSpeakSteps((prev) => !prev)}
                      title={autoSpeakSteps ? "Mute ASCORA's voice" : "Unmute ASCORA's voice"}
                    >
                      {autoSpeakSteps ? "🔊" : "🔇"}
                    </button>
                  )}
                  {lectureSteps.length > 0 && currentStep?.speech && (
                    <button
                      type="button"
                      className="speak-toggle-btn"
                      onClick={() => speakStepText(currentStep.speech || currentStep.text)}
                      title="Replay this step out loud"
                    >
                      ↻
                    </button>
                  )}
                  {lectureSteps.length > 0 && <div className="lesson-badge">{activeStep + 1}/{lectureSteps.length}</div>}
                </div>
              </div>

              {lectureLoading && (
                <div className="empty"><div className="thinking" style={{justifyContent:"center"}}><span className="thinking-dot" />Building your adaptive lesson...</div></div>
              )}

              {!lectureLoading && lectureSteps.length > 0 && (
                <>
                  <div className="step-tabs">
                    {lectureSteps.map((step, index) => (
                      <button key={step.id || index} className={`step-tab ${index === activeStep ? "active" : ""}`} onClick={() => setActiveStep(index)}>
                        STEP {index + 1}
                      </button>
                    ))}
                  </div>

                  {currentStep?.speech && <div className="step-speech" key={currentStep.id || activeStep}>{currentStep.speech}</div>}

                  {currentVisual && currentVisual.type && currentVisual.type !== "none" ? (
                    <VisualLecture visual={currentVisual} />
                  ) : currentStep?.animatedVisual ? (
                    <div key={`av-${activeStep}`} className="av-anim-key">
                      <AnimatedVisual visual={currentStep.animatedVisual} />
                    </div>
                  ) : (
                    <div className="empty">This step is voice/text based.</div>
                  )}

                  {currentStep?.connection && (
                    <div key={`conn-${activeStep}`} className="demo-connection">
                      <span className="demo-connection-label">Why it matters</span>
                      {currentStep.connection}
                    </div>
                  )}

                  {currentStep?.funFact && (
                    <div key={`fact-${activeStep}`} className="demo-funfact">
                      <span className="demo-funfact-label">✨ Did you know?</span>
                      {currentStep.funFact}
                    </div>
                  )}

                  {currentStep?.challenge && (
                    <ChallengeCard
                      key={`real-challenge-${activeStep}`}
                      challenge={currentStep.challenge}
                      onCorrect={() => awardXp(10)}
                    />
                  )}

                  <div className="robot-actions" style={{marginTop:14}}>
                    <button className="robot-btn robot-secondary" disabled={activeStep === 0} onClick={() => setActiveStep((s) => Math.max(0, s - 1))}>← Previous</button>
                    <button className="robot-btn robot-primary" disabled={activeStep >= lectureSteps.length - 1} onClick={() => setActiveStep((s) => Math.min(lectureSteps.length - 1, s + 1))}>Next →</button>
                  </div>
                </>
              )}

              {!lectureLoading && lectureSteps.length === 0 && !lectureError && (
                <div className="empty">
                  {plannerItemIsLive && plannerItemType === "lesson"
                    ? `ASCORA is preparing the scheduled lesson on ${activeTeachingTopic}.`
                    : "Your visual explanation will appear here after ASCORA receives your doubt."}
                </div>
              )}

              {lectureError && <div className="empty">⚠ {lectureError}</div>}
            </div>

            <div className="console-card">
              <div className="lesson-head">
                <div className="console-label">LIVE DOUBT QUEUE</div>
                <div className="lesson-badge">REALTIME</div>
              </div>

              {queueLoading ? (
                <div className="empty">Syncing classroom...</div>
              ) : queue.length === 0 ? (
                <div className="empty">🙌 No students waiting. ASCORA is ready.</div>
              ) : (
                queue.map((item, index) => {
                  const isMe = item.student_id === studentId;
                  const isServing = item.status === "serving";
                  return (
                    <div className="queue-line" key={item.id}>
                      <div>
                        <div className="queue-name">{isMe ? "You" : `Student ${index + 1}`}</div>
                        <div className="queue-sub">{isServing ? "ASCORA is teaching" : `Waiting · position #${index + 1}`}</div>
                      </div>
                      <div className="queue-pill">{isServing ? "LIVE" : `#${index + 1}`}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
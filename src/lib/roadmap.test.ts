import { describe, expect, it } from "vitest";
import { extractRoadmapSummary, parseTasks } from "./roadmap";
import { isCompleted, ROADMAP_STATUSES } from "./queries";
import { RoadmapOutputSchema, RoadmapWeekSchema, handleRoadmapGenerate, logGroqKeyDiagnostic, getGroqApiKey } from "../server/roadmap-api";

describe("Roadmap utilities", () => {
  it("extracts AI roadmap summary correctly from analysis summary", () => {
    const raw = "Match 75% for Full Stack Developer: 2 strong, 3 to improve, 1 missing.\n\nAI Roadmap: Focus first on asynchronous JavaScript and DOM events before building stateful React applications.";
    expect(extractRoadmapSummary(raw)).toBe(
      "Focus first on asynchronous JavaScript and DOM events before building stateful React applications."
    );
  });

  it("handles analysis summaries with no AI roadmap attached", () => {
    const raw = "Match 60% for Frontend Developer: 1 strong, 2 to improve, 2 missing.";
    expect(extractRoadmapSummary(raw)).toBeNull();
    expect(extractRoadmapSummary(null)).toBeNull();
    expect(extractRoadmapSummary(undefined)).toBeNull();
  });

  it("parses tasks correctly from arrays, JSON strings, or newlines", () => {
    expect(parseTasks(["Task 1", "Task 2"])).toEqual(["Task 1", "Task 2"]);
    expect(parseTasks(JSON.stringify(["Learn syntax", "Build todo app"]))).toEqual([
      "Learn syntax",
      "Build todo app",
    ]);
    expect(parseTasks("Read chapter 1\nPractice coding")).toEqual([
      "Read chapter 1",
      "Practice coding",
    ]);
    expect(parseTasks(null)).toEqual([]);
  });

  it("checks completion status correctly for database uppercase and lowercase formats", () => {
    expect(isCompleted("COMPLETED")).toBe(true);
    expect(isCompleted("completed")).toBe(true);
    expect(isCompleted("Completed")).toBe(true);
    expect(isCompleted("IN_PROGRESS")).toBe(false);
    expect(isCompleted("NOT_STARTED")).toBe(false);
    expect(isCompleted(null)).toBe(false);
  });

  it("defines exact database-allowed status values", () => {
    const values = ROADMAP_STATUSES.map((s) => s.value);
    expect(values).toEqual(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]);
  });
});

describe("Structured AI Output Schema", () => {
  it("validates a valid structured roadmap output", () => {
    const validOutput = {
      summary: "Start by mastering core JavaScript fundamentals before moving into React and Node.",
      estimatedWeeks: 6,
      weeks: [
        {
          week: 1,
          focus: "JavaScript",
          goal: "Strengthen JavaScript fundamentals",
          tasks: [
            "Learn ES6+ features and closures",
            "Practice array methods and async/await",
            "Build an interactive task tracker",
          ],
          estimatedHours: 8,
        },
        {
          week: 2,
          focus: "React",
          goal: "Build dynamic client-side applications",
          tasks: [
            "Learn React component lifecycle and hooks",
            "Build a stateful dashboard application",
          ],
          estimatedHours: 10,
        },
      ],
    };

    const parsed = RoadmapOutputSchema.parse(validOutput);
    expect(parsed.estimatedWeeks).toBe(6);
    expect(parsed.weeks).toHaveLength(2);
    expect(parsed.weeks[0]?.focus).toBe("JavaScript");
  });

  it("validates individual week schema properties", () => {
    const validWeek = {
      week: 3,
      focus: "Node.js",
      goal: "Build RESTful APIs with Express",
      tasks: [
        "Learn Express middleware and routing",
        "Implement CRUD endpoints with error handling",
        "Write integration tests for API routes",
      ],
      estimatedHours: 9,
    };
    const parsed = RoadmapWeekSchema.parse(validWeek);
    expect(parsed.week).toBe(3);
    expect(parsed.estimatedHours).toBe(9);
    expect(parsed.tasks).toHaveLength(3);
  });

  it("rejects invalid roadmap structures missing required fields", () => {
    const invalidOutput = {
      summary: "Missing weeks",
      estimatedWeeks: 4,
      weeks: [
        {
          week: 1,
          focus: "JavaScript",
          // missing goal and tasks
          estimatedHours: 8,
        },
      ],
    };

    expect(() => RoadmapOutputSchema.parse(invalidOutput)).toThrow();
  });

  it("handles LLM responses wrapped in markdown code fences", () => {
    const rawFenced = "```json\n" + JSON.stringify({
      summary: "Start with JavaScript asynchronous fundamentals.",
      estimatedWeeks: 4,
      weeks: [
        {
          week: 1,
          focus: "JavaScript",
          goal: "Master promises and async/await",
          tasks: ["Study event loop", "Implement fetch wrapper", "Build async weather widget"],
          estimatedHours: 8,
        },
      ],
    }) + "\n```";

    const cleaned = rawFenced.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(cleaned);
    const validated = RoadmapOutputSchema.parse(parsed);
    expect(validated.weeks).toHaveLength(1);
    expect(validated.weeks[0]?.week).toBe(1);
  });
});

describe("AI Roadmap Backend Endpoint (/api/roadmap/generate)", () => {
  it("returns 401 when request is unauthenticated", async () => {
    const req = new Request("http://localhost:5173/api/roadmap/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });

    const res = await handleRoadmapGenerate(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Unauthorized");
  });

  it("returns 401 when token is invalid or expired", async () => {
    const req = new Request("http://localhost:5173/api/roadmap/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer invalid_mock_token_12345",
      },
    });

    const res = await handleRoadmapGenerate(req);
    expect(res.status).toBe(401);
  }, 15000);

  it("safely reports GROQ_API_KEY diagnostic without leaking secrets", () => {
    const diag = logGroqKeyDiagnostic();
    expect(typeof diag.present).toBe("boolean");
    expect(typeof diag.length).toBe("number");
  });

  it("getGroqApiKey reads environment variable when configured", () => {
    const original = process.env["GROQ_API_KEY"];
    try {
      process.env["GROQ_API_KEY"] = "gsk_test_mock_key_12345";
      expect(getGroqApiKey()).toBe("gsk_test_mock_key_12345");
    } finally {
      if (original !== undefined) {
        process.env["GROQ_API_KEY"] = original;
      } else {
        delete process.env["GROQ_API_KEY"];
      }
    }
  });
});


import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";
import { z } from "zod";
import type { IncomingMessage, ServerResponse } from "node:http";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, errMsg } from "../lib/supabase";
import { compareSkills, matchScore, buildSummary, gapReason } from "../lib/analysis";
import { splitEducation, yearLabel } from "../lib/profile";

export const RoadmapWeekSchema = z.object({
  week: z.number().int().min(1),
  focus: z.string().min(1),
  goal: z.string().min(1),
  tasks: z.array(z.string().min(1)).min(1),
  estimatedHours: z.number().int().positive(),
});

export const RoadmapOutputSchema = z.object({
  summary: z.string().min(1),
  estimatedWeeks: z.number().int().min(1).max(52),
  weeks: z.array(RoadmapWeekSchema).min(1),
});

export type RoadmapOutput = z.infer<typeof RoadmapOutputSchema>;

export function getGroqApiKey(): string | undefined {
  if (process.env["GROQ_API_KEY"] && process.env["GROQ_API_KEY"].trim()) {
    return process.env["GROQ_API_KEY"].trim();
  }

  try {
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile();
    }
  } catch {
    // .env file might not exist or already loaded
  }
  if (process.env["GROQ_API_KEY"] && process.env["GROQ_API_KEY"].trim()) {
    return process.env["GROQ_API_KEY"].trim();
  }

  // Candidate directories to search for .env files
  const candidateDirs: string[] = [process.cwd()];
  try {
    const fileDir = path.dirname(fileURLToPath(import.meta.url));
    const projectRoot = path.resolve(fileDir, "../..");
    if (!candidateDirs.includes(projectRoot)) {
      candidateDirs.push(projectRoot);
    }
  } catch {
    // ignore
  }

  const envFileNames = [".env", ".env.local", ".env.development", ".env.development.local"];

  for (const dir of candidateDirs) {
    for (const envFileName of envFileNames) {
      try {
        const fullPath = path.resolve(dir, envFileName);
        if (fs.existsSync(fullPath)) {
          const fileContent = fs.readFileSync(fullPath, "utf-8");
          for (const line of fileContent.split("\n")) {
            const trimmed = line.trim();
            if (trimmed.startsWith("#") || !trimmed.includes("=")) continue;
            const [key, ...rest] = trimmed.split("=");
            if (key && key.trim() === "GROQ_API_KEY") {
              const val = rest.join("=").trim().replace(/^["']|["']$/g, "");
              if (val) {
                process.env["GROQ_API_KEY"] = val;
                return val;
              }
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return process.env["GROQ_API_KEY"]?.trim() || undefined;
}

export function logGroqKeyDiagnostic(): { present: boolean; length: number } {
  const key = getGroqApiKey();
  const present = Boolean(key && key.trim());
  const length = key ? key.trim().length : 0;
  console.log(`[Diagnostic] GROQ_API_KEY present: ${present}, length: ${length}`);
  return { present, length };
}


export async function handleRoadmapGenerate(request: Request): Promise<Response> {
  try {
    // 1. Authenticate user from Bearer token
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized. Please sign in to generate a roadmap." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized. Missing authentication token." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Authenticated Supabase client bound to user token (RLS preserved)
    const userClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Session expired or invalid. Please sign in again." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    // 2. Verify GROQ_API_KEY is configured
    const apiKey = getGroqApiKey();
    const isPresent = Boolean(apiKey && apiKey.trim());
    const keyLength = apiKey ? apiKey.trim().length : 0;
    console.log(`[Diagnostic] GROQ_API_KEY present: ${isPresent}, length: ${keyLength}`);

    if (!isPresent) {
      return new Response(
        JSON.stringify({ error: "AI roadmap generation is not configured yet." }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 3. Parse request body for optional analysisId
    let reqBody: { analysisId?: string } = {};
    try {
      const text = await request.text();
      if (text) reqBody = JSON.parse(text);
    } catch {
      // Empty or non-JSON body is acceptable
    }

    // 3. Fetch user profile
    const { data: profile } = await userClient
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    // 4. Fetch primary career goal
    const { data: primaryGoal } = await userClient
      .from("career_goals")
      .select("*")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .maybeSingle();

    if (!primaryGoal) {
      return new Response(JSON.stringify({ error: "Please select a primary career goal first." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 5. Fetch career details
    const { data: career } = await userClient
      .from("careers")
      .select("*")
      .eq("id", primaryGoal.career_id)
      .maybeSingle();

    if (!career) {
      return new Response(JSON.stringify({ error: "Career goal not found." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 6. Fetch user's skills and evidence
    const { data: skillsData } = await userClient
      .from("skills")
      .select("*")
      .eq("user_id", userId)
      .order("name");
    const skills = skillsData ?? [];

    const { data: evidenceData } = await userClient
      .from("skill_evidence")
      .select("*")
      .eq("user_id", userId);
    const evidence = evidenceData ?? [];

    // 7. Fetch career requirements
    const { data: reqsData } = await userClient
      .from("career_requirements")
      .select("*")
      .eq("career_id", career.id)
      .order("required_level", { ascending: false });
    const requirements = reqsData ?? [];

    if (!requirements.length) {
      return new Response(JSON.stringify({ error: `No requirements defined for ${career.title} yet.` }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 8. Retrieve or compute deterministic analysis (deterministic analysis remains source of truth)
    let analysis: { id: string; user_id: string; career_id: string; summary: string | null } | null = null;
    let analysisResults: { skill_name: string; required_level: number; current_level: number; priority: string | null }[] = [];

    if (reqBody.analysisId) {
      const { data } = await userClient
        .from("analyses")
        .select("*")
        .eq("id", reqBody.analysisId)
        .eq("user_id", userId)
        .maybeSingle();
      analysis = data;
    }

    if (!analysis) {
      // Find latest analysis for this user & career
      const { data } = await userClient
        .from("analyses")
        .select("*")
        .eq("user_id", userId)
        .eq("career_id", career.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      analysis = data;
    }

    if (analysis) {
      const { data: resultsData } = await userClient
        .from("analysis_results")
        .select("*")
        .eq("analysis_id", analysis.id);
      analysisResults = resultsData ?? [];
    } else {
      // Run deterministic analysis if none exists yet
      const rows = compareSkills(skills, requirements);
      const score = matchScore(rows);
      const summaryText = buildSummary(career.title, rows);

      const ins = await userClient
        .from("analyses")
        .insert({ user_id: userId, career_id: career.id, summary: summaryText, match_percentage: score })
        .select()
        .single();
      if (ins.error) throw new Error(errMsg(ins.error));
      analysis = ins.data;

      const payload = rows.map((r) => ({
        analysis_id: analysis!.id,
        skill_name: r.skill_name,
        required_level: r.required_level,
        current_level: r.current_level,
        gap_level: Math.max(0, r.required_level - r.current_level),
        priority: r.priority,
        reason: gapReason(r.current_level, r.required_level),
      }));
      await userClient.from("analysis_results").insert(payload);
      analysisResults = payload;
    }

    if (!analysis) {
      return new Response(JSON.stringify({ error: "Failed to create or retrieve analysis." }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    const currentAnalysis = analysis;

    // 8. Filter deterministic skill gaps (sorted by priority: HIGH first, then MEDIUM, then LOW)
    const PRIORITY_ORDER: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    const skillGaps = analysisResults
      .filter((r) => Number(r.current_level) < Number(r.required_level))
      .map((r) => ({
        skill: r.skill_name,
        currentLevel: Number(r.current_level),
        requiredLevel: Number(r.required_level),
        priority: (r.priority ?? "MEDIUM").toUpperCase(),
      }))
      .sort((a, b) => {
        const pDiff = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
        if (pDiff !== 0) return pDiff;
        return (b.requiredLevel - b.currentLevel) - (a.requiredLevel - a.currentLevel);
      });

    if (!skillGaps.length) {
      return new Response(
        JSON.stringify({
          error: "No skill gaps found for this career goal. You already meet or exceed all requirements!",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 9. Prepare AI input based strictly on real student data
    const { level: eduLevel, branch: eduBranch } = splitEducation(profile?.education);
    const studentInput = {
      student: {
        name: profile?.full_name || "Student",
        education: eduLevel || profile?.education || "Not specified",
        branch: eduBranch || profile?.institution || "Not specified",
        currentYear: profile?.current_year != null ? (yearLabel(profile.current_year) || String(profile.current_year)) : "Not specified",
        about: profile?.bio || "",
      },
      careerGoal: {
        title: career.title,
        description: career.description || career.short_description || "",
      },
      currentSkills: skills.map((s) => ({
        name: s.name,
        level: s.proficiency_level ?? 0,
        yearsExperience: s.years_experience ?? 0,
      })),
      ...(evidence.length ? {
        evidence: evidence.map((e) => {
          const matched = skills.find((s) => s.id === e.skill_id);
          return {
            skill: matched?.name || "General",
            type: e.evidence_type,
            description: e.description,
          };
        }),
      } : {}),
      skillGaps,
    };

    // 11. Call Groq with official groq-sdk
    const systemPrompt = `You are SkillPath's Senior Technical Curriculum Architect.
Your task is to generate a personalized, practical, week-by-week learning roadmap for a student aiming for their chosen career goal.
The deterministic skill gap analysis provided is the absolute SOURCE OF TRUTH. Do NOT recalculate or modify match scores or requirements.

Rules:
- 4 to 12 weeks depending on the number and severity of gaps.
- Prioritize HIGH-importance/HIGH-priority gaps first.
- Deeply personalize based on the student's existing skill levels (1-5 scale):
  * For level 0: start with fundamentals, core hands-on syntax, and foundational mental models.
  * For levels 1-2: strengthen practical foundations, debugging, and real-world application.
  * For levels 3-4: skip basic tutorials completely; focus on advanced architecture, optimization, and complex full-stack features.
  * If a student already has high proficiency in a prerequisite (e.g. JavaScript is 4), do NOT teach basic JavaScript—jump straight to the gap skills (e.g. backend/API/database or advanced React).
  * Do NOT waste weeks teaching skills the student already has at or above the required level.
- Build prerequisites logically (e.g. core language fundamentals BEFORE advanced frameworks; backend fundamentals BEFORE complex microservices).
- Include practical exercises and mini-project builds in every week, not only theory.
- Keep estimated study hours realistic for a student (between 6 and 15 hours per week).
- Do not invent skills unrelated to the career goal.
- Do not claim the student knows something that isn't in their profile.
- Return ONLY a valid JSON object matching this exact structure:
{
  "summary": "Short personalized explanation of what the student should focus on first.",
  "estimatedWeeks": 8,
  "weeks": [
    {
      "week": 1,
      "focus": "JavaScript",
      "goal": "Strengthen core JavaScript fundamentals",
      "tasks": ["Task 1", "Task 2", "Task 3"],
      "estimatedHours": 8
    }
  ]
}`;

    let generatedRawText = "";
    try {
      const groq = new Groq({ apiKey: apiKey as string });
      const model = process.env["GROQ_MODEL"] || "openai/gpt-oss-120b";

      const completion = await groq.chat.completions.create({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Generate a personalized learning roadmap for this student based strictly on their actual data:\n\n${JSON.stringify(studentInput, null, 2)}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "skillpath_roadmap",
            strict: true,
            schema: {
              type: "object",
              properties: {
                summary: { type: "string" },
                estimatedWeeks: { type: "integer" },
                weeks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      week: { type: "integer" },
                      focus: { type: "string" },
                      goal: { type: "string" },
                      tasks: {
                        type: "array",
                        items: { type: "string" },
                      },
                      estimatedHours: { type: "integer" },
                    },
                    required: ["week", "focus", "goal", "tasks", "estimatedHours"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["summary", "estimatedWeeks", "weeks"],
              additionalProperties: false,
            },
          },
        },
        temperature: 0.2,
      });

      generatedRawText = completion.choices[0]?.message?.content || "";
    } catch (groqError: unknown) {
      const errMessage = groqError instanceof Error ? groqError.message : String(groqError);
      console.error("[Groq API call failed]", errMessage);
      return new Response(
        JSON.stringify({
          error: "We couldn't generate your roadmap right now. Please try again.",
          ...(process.env["NODE_ENV"] !== "production" ? { debugError: errMessage } : {}),
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 12. Parse and validate Groq response with Zod
    let parsedJson: unknown;
    try {
      const sanitized = (generatedRawText || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      parsedJson = JSON.parse(sanitized);
    } catch (jsonErr) {
      console.error("[Groq JSON parse failed]", jsonErr, generatedRawText);
      return new Response(
        JSON.stringify({ error: "We couldn't generate your roadmap right now. Please try again." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const validation = RoadmapOutputSchema.safeParse(parsedJson);
    if (!validation.success) {
      console.error("[Groq schema validation failed]", validation.error.format());
      return new Response(
        JSON.stringify({ error: "We couldn't generate your roadmap right now. Please try again." }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const roadmapData = validation.data;

    // 13. Save generated roadmap to Supabase roadmap_items
    // Delete any existing roadmap items for this analysis first to avoid duplicate weeks
    await userClient
      .from("roadmap_items")
      .delete()
      .eq("user_id", userId)
      .eq("analysis_id", currentAnalysis.id);

    const roadmapRows = roadmapData.weeks.map((w) => ({
      user_id: userId,
      analysis_id: currentAnalysis.id,
      week_number: w.week,
      skill: w.focus,
      title: w.goal,
      description: `Week ${w.week}: ${w.focus} — ${w.goal}`,
      tasks: w.tasks,
      estimated_hours: w.estimatedHours,
      status: "NOT_STARTED",
    }));

    let ins = await userClient.from("roadmap_items").insert(roadmapRows).select();
    // Only retry with stringified tasks if the initial attempt failed due to tasks column type mismatch
    if (ins.error && (ins.error.code === "22P02" || ins.error.code === "42804" || ins.error.message?.includes("tasks"))) {
      console.warn("[roadmap_items insert initial attempt, retrying with stringified tasks]", ins.error);
      const jsonRows = roadmapRows.map((r) => ({
        ...r,
        tasks: JSON.stringify(r.tasks),
      }));
      ins = await userClient.from("roadmap_items").insert(jsonRows).select();
    }
    if (ins.error && ["42703", "22P02", "PGRST204", "42804"].includes(String(ins.error.code))) {
      console.warn("[roadmap_items fallback to minimal columns]", ins.error);
      const minimalRows = roadmapRows.map((r) => ({
        user_id: r.user_id,
        analysis_id: r.analysis_id,
        week_number: r.week_number,
        title: r.title,
        description: `${r.description}\n\nTasks:\n${(r.tasks as string[]).map((t) => `- ${t}`).join("\n")}`,
        estimated_hours: r.estimated_hours,
        status: r.status,
      }));
      ins = await userClient.from("roadmap_items").insert(minimalRows).select();
    }

    if (ins.error) {
      console.error("[roadmap_items insert error]", ins.error);
      return new Response(
        JSON.stringify({ error: errMsg(ins.error) }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // 14. Save personalized summary to analysis
    try {
      const baseSummary = (currentAnalysis.summary || "").split("\n\nAI Roadmap:")[0]?.trim() || "";
      const updatedSummary = `${baseSummary}\n\nAI Roadmap: ${roadmapData.summary}`;
      await userClient.from("analyses").update({ summary: updatedSummary }).eq("id", currentAnalysis.id);
    } catch (summaryErr) {
      console.warn("[analyses summary update warning]", summaryErr);
    }


    // 15. Return saved roadmap
    return new Response(
      JSON.stringify({
        success: true,
        summary: roadmapData.summary,
        estimatedWeeks: roadmapData.estimatedWeeks,
        items: ins.data,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("[handleRoadmapGenerate unhandled error]", err);
    return new Response(
      JSON.stringify({ error: "We couldn't generate your roadmap right now. Please try again." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

export async function handleNodeRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const body = Buffer.concat(chunks).toString("utf-8");

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
      else headers.set(key, value);
    }
  }

  const protocol = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers.host || "localhost:5173";
  const url = new URL(req.url || "/api/roadmap/generate", `${protocol}://${host}`);

  const requestInit: RequestInit = {
    method: req.method || "POST",
    headers,
  };

  if (!["GET", "HEAD"].includes(req.method || "") && body) {
    requestInit.body = body;
  }
  const webReq = new Request(url.href, requestInit);


  const webRes = await handleRoadmapGenerate(webReq);

  res.statusCode = webRes.status;
  webRes.headers.forEach((val, key) => {
    res.setHeader(key, val);
  });
  const resBody = await webRes.text();
  res.end(resBody);
}

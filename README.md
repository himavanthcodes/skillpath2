# SkillPath2

> AI-powered career readiness and personalized learning roadmap platform for students.

SkillPath2 helps students understand how well their current skills match a target career, identify the most important skill gaps, and generate a personalized learning roadmap.

The application combines a deterministic career-skill matching system with a secure backend AI workflow. Career requirements are stored in the database and the application's scoring logic remains the source of truth. AI is used to explain the gaps and generate an actionable learning roadmap.

---

## Problem

Students often know the career they want to pursue but do not know:

- Which skills are actually required for that career
- How strong their current skills are
- Which gaps should be prioritized
- What they should learn first
- How to convert a long list of missing skills into a realistic learning plan

Existing career platforms often provide generic recommendations without connecting the student's actual skill proficiency to a structured learning path.

## Solution

SkillPath2 provides a complete workflow:

1. Create an account
2. Complete the student profile
3. Add skills and proficiency levels
4. Select a primary career goal
5. Compare the student's skills with predefined career requirements
6. Calculate a deterministic readiness/match score
7. Identify strengths and priority skill gaps
8. Generate an AI-personalized learning roadmap
9. Track roadmap progress
10. Update skills and re-run the analysis

The system separates **deterministic career analysis** from **generative AI** so that the AI does not invent career requirements or manipulate the underlying readiness score.

---

# Core Features

### Authentication

- User registration and login
- Supabase authentication
- Protected application routes
- User-specific data access

### Student Profile

- Profile information
- Career goal
- Skills
- Proficiency levels
- Skill evidence

### Career Exploration

- Predefined career catalog
- Career requirements stored in the database
- Career search and exploration
- Set a primary career goal
- Explore alternative careers without immediately changing the primary goal

### Skill Gap Analysis

SkillPath2 calculates readiness using application-controlled career requirements and skill proficiency data.

The analysis identifies:

- Overall match/readiness score
- Strong skills
- Partial matches
- Missing skills
- Priority gaps
- Career alignment

The score is deterministic and does not depend on an LLM response.

### AI Personalized Roadmap

After the deterministic analysis, the backend sends relevant student context and identified skill gaps to the AI service.

The AI generates:

- Personalized summary
- Estimated learning duration
- Weekly learning plan
- Weekly focus
- Learning goals
- Tasks
- Estimated hours

The generated response is validated against a Zod schema before being stored.

### Roadmap Progress

Each roadmap item supports:

- `NOT_STARTED`
- `IN_PROGRESS`
- `COMPLETED`

Progress is persisted in Supabase and survives page refreshes.

### Analysis History

Previous analyses are persisted and can be reviewed by the authenticated user.

---

# Architecture

```text
                    ┌──────────────────────┐
                    │      Student         │
                    │   Browser / React    │
                    └──────────┬───────────┘
                               │
                               │ Authenticated requests
                               ▼
                    ┌──────────────────────┐
                    │   SkillPath2 App     │
                    │ Vite + TanStack      │
                    │ Router + React Query │
                    └──────────┬───────────┘
                               │
                               │ /api/*
                               ▼
                    ┌──────────────────────┐
                    │   Server API Layer   │
                    │ Authentication       │
                    │ Validation           │
                    │ Business Logic       │
                    │ AI orchestration     │
                    └───────┬───────┬──────┘
                            │       │
                 ┌──────────┘       └──────────────┐
                 ▼                                 ▼
        ┌──────────────────┐             ┌──────────────────┐
        │ Supabase         │             │ Groq AI          │
        │ PostgreSQL       │             │ Backend-only     │
        │ RLS              │             │ structured JSON  │
        └──────────────────┘             └──────────────────┘
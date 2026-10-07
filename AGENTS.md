<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## SkillPath architecture
- Data lives in the user's external Supabase project (not Lovable Cloud); the browser client in src/lib/supabase.ts uses the publishable key and relies on existing RLS — never add a service-role key to client code.
- Reuse the existing schema (profiles, skills, skill_evidence, careers, career_requirements, career_goals, analyses, analysis_results, roadmap_items); do not create duplicate tables — the user owns the schema.
- Skill-gap analysis, readiness score and roadmap generation are pure deterministic functions in src/lib/analysis.ts with tests — keeps results reproducible and testable.
- Signed-in pages live under src/routes/_authenticated (client-only gate) because the session is stored in the browser.

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
- Keep the application-wide image background and overlay in the global stylesheet; page shells must stay transparent so every route shares it.
- Theme shared surfaces and button fills through semantic CSS tokens; this keeps contrast consistent without changing individual workflows.
- Localize fixed UI wording through useI18n and browser-safe translation modules; preserve authored names, curriculum content, answers, and teacher comments to avoid rewriting educational data.
- Keep installation manifest-only with one root-level InstallPromptProvider owning browser prompt events and session dismissal; installation support varies by browser and does not require offline caching.
- Keep the auth form mode in validated URL search state so account-creation links open signup directly while ordinary sign-in links preserve login.
- Keep generated assessments in separate activity batches, enforce normalized deduplication in PostgreSQL, and retain first-publication timestamps so unpublished history never returns to review.
- Store teacher photos in an owner-scoped private bucket and share signed image URLs on listings because workspace policy forbids public buckets.
- Use teacher-selected activity audience settings for age-adapted interaction; never infer or expose student personal age data.

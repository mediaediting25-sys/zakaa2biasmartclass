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
- Keep platform ownership in a protected separate table and authorize role changes in database RPCs; only owners can manage administrators and owner roles cannot be edited.
- Store administrative section grants separately from account roles, require them in RPCs and server functions, and clear grants on administrator removal; this prevents cross-section privilege escalation and stale access on reappointment.
- General administration grants access to all sections through the shared permission function, never platform ownership; owner-only administrator protections remain unchanged.
- Store public plan overrides, announcements, and published news separately with section-scoped RLS; public loaders read only public fields while administrator editors retain draft reads.
- Load homepage platform content through the shared public query options in its route loader so saved wording is ready at first render and shares cache freshness with the header.
- Record teacher access as immutable dated periods and approve renewal requests atomically in subscription-scoped RPCs; explicit grants extend existing periods without inventing automatic trials or payment verification.
- Check teacher_access_active before all teacher generation and publishing server actions; display trial dates separately without treating browser-calculated dates as authorization, preventing billed work after expiry.
- Theme shared surfaces and button fills through semantic CSS tokens; this keeps contrast consistent without changing individual workflows.
- Localize fixed UI wording through useI18n and browser-safe translation modules; preserve authored names, curriculum content, answers, and teacher comments to avoid rewriting educational data.
- Keep the language context in its own module and retain its identity across hot updates so mounted providers and consumers cannot diverge.
- Keep installation manifest-only with one root-level InstallPromptProvider owning browser prompt events and session dismissal; installation support varies by browser and does not require offline caching.
- Keep the auth form mode in validated URL search state so account-creation links open signup directly while ordinary sign-in links preserve login.
- Keep generated assessments in separate activity batches, enforce normalized deduplication in PostgreSQL, and retain first-publication timestamps so unpublished history never returns to review.
- Store teacher photos in an owner-scoped private bucket and share signed image URLs on listings because workspace policy forbids public buckets.
- Use teacher-selected activity audience settings for age-adapted interaction; never infer or expose student personal age data.
- Persist palette selection only after hydration and apply semantic tokens at the root so all routes preserve the shared background.
- Generation language is explicit teacher input; retain original source quotations and use separate reviewable batches per output language.
- Parent-code redemption is non-consuming and requires a non-archived enrollment; rejected-question deletion is enforced in a teacher-authorized database function and refuses student-answer history.

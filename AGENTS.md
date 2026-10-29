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

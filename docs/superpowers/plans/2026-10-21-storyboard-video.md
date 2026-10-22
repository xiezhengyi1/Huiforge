# Storyboard Video Implementation Plan

> **For agentic workers:** Use subagent-driven-development to complete each independently verifiable task.

**Goal:** Make storyboard-to-video executable from the existing short-drama interface, and improve conversation readability.

**Architecture:** Keep the existing Ark Agent and shared media composer. A persisted storyboard job generates its shots in sequence through the existing video service, then uses local FFmpeg to produce an owner-scoped final video. The conversation displays task progress and the final video.

- [x] Replace the ambiguous plus with a labelled new-conversation action and improve typography.
- [x] Render assistant headings, paragraphs and emphasis using text nodes; keep raw HTML inert.
- [x] Implement and test storyboard job submission, progress, ownership, failure and composition.
- [x] Register the Agent tool and enable the storyboard capability in the sidebar.
- [x] Verify local composition and the real interface, including reload and task progress.
- [x] Verify official API requirements for reference-video analysis and dubbing.

Validation: 234 tests passed. Real Agent composition produced a 10.103-second 720×1280 H.264/AAC film with playable browser media and no generation charge. A real two-shot generation request reached Wan, but the provider rejected its first shot with `Arrearage`; the second shot was never submitted. Successful generation-to-composition was verified with controlled provider output in tests. A successful new cloud-generated film remains blocked on provider billing.

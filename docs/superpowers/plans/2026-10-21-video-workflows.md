# Video workflow integration

Implement reference-video remake planning and video dubbing through the existing studio composer. Reuse Fun-ASR via DashScope temporary uploads, Qwen-VL for sampled frames, Ark for editable remake shots, existing TTS for speech, and local FFmpeg for extraction and timed video export.

The reference workflow ends with a visible, editable shot plan and a handoff to the existing storyboard composer. Generating new shots requires the creator's confirmation. Video dubbing accepts supplied narration or transcribed source speech and exports the original picture with a new voice track aligned to its duration.

| Owner | Scope | Acceptance |
| --- | --- | --- |
| Innovation designer | Fun-ASR protocol and temporary upload | Contract tests, timestamps, explicit provider errors |
| Feature designer | Persistent owner-scoped workflows and media export | Isolation, failure, recovery, no duplicate paid submission, aligned output |
| UI designer | Shared controls, compact input, readable results | Controller tests, no injection, resume polling, handoff |
| PM | Capability routing, integration and real acceptance | Full suite, actual upload/transcription/analysis/dubbing, browser visual checks |

- [x] Implement and verify ASR provider.
- [x] Implement and verify backend workflows.
- [x] Integrate capability actions and source selection.
- [x] Verify compact desktop and narrow-screen layout.
- [x] Verify real video dubbing and reference analysis, with reload.
- [x] Run full regression suite and record external blockers honestly.

Real acceptance: source upload → Fun-ASR → existing Qwen3 TTS → local timed export completed. The exported 720×1280 video is 5.04 seconds, has one audio track, preserves the source video bitstream, and decodes completely. Playback and reload restoration passed in the browser. An initial provider read timeout remained an explicit failed job; no automatic paid retry was added.

Reference upload → Fun-ASR → six sampled frames/Qwen-VL → strict Ark plan completed with two 2-second shots. Dialogue is derived from the stored transcript, including historical completed results; the model cannot invent its availability. Handoff opens a fresh editable conversation without prior story context.

External blocker: proceeding from the real plan to new Wan-generated shots was attempted. Wan returned `Arrearage` for the first shot, so the second shot was not submitted. A successful newly generated remake film remains blocked by the provider account billing state.

Visual acceptance: the input is 100px tall and its card sits below the internally scrolling conversation. Outer padding and card gaps were reduced. The floating onboarding replay was hidden in these workspaces after a real click reproduced overlap with the send button. The browser now confirms the send button receives its center click, and the actual submit succeeds. Final assets are app v5, workflow/Agent modules v4, stylesheet v3.

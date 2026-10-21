# Project tool conventions

- On Windows PowerShell, filter ripgrep inputs with `-g` or enumerate files with `rg --files`; never pass bare wildcard paths such as `*.js` or `theme-*.css` as positional arguments.
- For ripgrep searches containing quotes or alternation, use fixed-string `-F -e` terms instead of embedding a combined regular expression in a PowerShell double-quoted string.
- Restart local services as separate commands: inspect the exact listener PID and command line, stop that PID, start the replacement hidden, then run the health check.
- For frontend visual QA, a server restart alone is insufficient: bump changed versioned JS/CSS URLs (including CSS imports), then verify the new assets in the browser. Tests should assert asset paths, not fixed cache-buster values.
- `agent-browser` is not installed; for Chrome CDP visual checks, use Node's native `WebSocket` against the debug endpoint.

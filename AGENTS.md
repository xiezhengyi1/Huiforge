# Project tool conventions

- On Windows PowerShell, filter ripgrep inputs with `-g` or enumerate files with `rg --files`; never pass bare wildcard paths such as `*.js` or `theme-*.css` as positional arguments.
- For ripgrep searches containing quotes or alternation, use fixed-string `-F -e` terms instead of embedding a combined regular expression in a PowerShell double-quoted string.
- Restart local services as separate commands: inspect the exact listener PID and command line, stop that PID, start the replacement hidden, then run the health check.
- `agent-browser` is not installed; for Chrome CDP visual checks, use Node's native `WebSocket` against the debug endpoint.

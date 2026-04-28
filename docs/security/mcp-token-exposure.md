# Security: MCP Token Exposure Mitigation

## Risk: Cloudflare API Token in Process List

**Severity:** Medium | **Status:** Documented | **Upstream:** MCP tooling limitation

### Description

MCP server processes expose the Cloudflare API Bearer token in plaintext via `ps aux`:

```
node mcp-remote https://mcp.cloudflare.com/mcp --header Authorization: Bearer iFc0IENhDb-...
```

Any local process or user with `ps` access can read the token. macOS shows all user processes to all users, and crash reporters/logging tools capture command-line arguments.

### Impact

- The token grants full API access to the Cloudflare account
- Workers, DNS, R2 buckets, and all account resources are exposed
- Token can be captured by monitoring agents, crash reporters, or malicious processes

### Mitigation Steps

1. **Rotate the token immediately** after any suspected exposure:
   - Cloudflare Dashboard → My Profile → API Tokens → Regenerate
   - Update the MCP server configuration with the new token

2. **Minimize token scope** — use API Tokens (not Global API Key):
   - Create a token with minimum required permissions
   - Scope to specific zones/accounts where possible

3. **Monitor usage** — check Cloudflare Audit Log for unauthorized access:
   - Cloudflare Dashboard → Account → Audit Log

### Recommended Fix (Upstream)

The MCP server configuration should pass the token via:
1. **Environment variable** (`CLOUDFLARE_API_TOKEN`) — preferred
2. **Stdin piping** — avoids process list exposure
3. **Config file** with `chmod 600` — restricted permissions

This is tracked as an upstream MCP tooling limitation. Until resolved, rotate tokens regularly and restrict local machine access.

### References

- [Cloudflare API Token Best Practices](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- GitHub Issue: julioarguello/www-serverstartup-io#62

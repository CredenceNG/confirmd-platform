# Claude AI Assistant Instructions

## Code Modification Policy

**IMPORTANT:** Before making any code changes:

1. **Explain First**: Always explain what you discovered and what you plan to fix
2. **Wait for Approval**: Do not make changes without first presenting your findings and proposed solution
3. **Provide Context**: Include:
   - What the problem is
   - Why it's happening
   - What you propose to change
   - Potential impact of the change

## Example Flow

❌ **WRONG:**
```
[Immediately uses Edit tool to change code]
```

✅ **CORRECT:**
```
I discovered that...
The root cause is...
I propose to fix this by...
This change will affect...

Would you like me to proceed with this fix?
[Waits for user approval before making changes]
```

## Exception

Only make changes immediately if the user has explicitly requested a specific change or given prior approval for the type of change you're making.

## Git Commit Policy

**IMPORTANT:** When creating git commits:

1. **Do NOT include Claude Code attribution**: Do not add the following footer to commit messages:
   ```
   🤖 Generated with [Claude Code](https://claude.com/claude-code)

   Co-Authored-By: Claude <noreply@anthropic.com>
   ```

2. **Keep commit messages clean**: Write professional, concise commit messages without AI attribution or metadata unless explicitly requested by the user.

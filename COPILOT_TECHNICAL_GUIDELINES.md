# COPILOT TECHNICAL TROUBLESHOOTING GUIDELINES

## 🚨 CRITICAL RULE: INVESTIGATE BEFORE MODIFYING

**Before making ANY configuration changes:**

1. **INVESTIGATE FIRST** - Understand the complete system architecture and routing logic
2. **MAP ALL ENDPOINTS** - Identify how different event types are handled
3. **VERIFY ASSUMPTIONS** - Don't assume based on partial information
4. **MINIMAL CHANGES** - Make the smallest change necessary to fix the actual issue
5. **ASK FOR CONFIRMATION** - Before changing configs, explain what you found and propose the change

**Never modify configuration files without fully understanding the impact on the entire system.**

## Example of What NOT To Do:

- ❌ See webhook URL, assume it needs `/connections` endpoint
- ❌ Change config immediately without understanding routing
- ❌ Make multiple changes without testing each one

## Example of Correct Approach:

- ✅ Investigate all webhook endpoints in the system
- ✅ Understand how the root `/webhooks` endpoint routes events
- ✅ Realize the system already handles all event types intelligently
- ✅ Make minimal change (remove incorrect `/connections` suffix)
- ✅ Explain the architecture before making changes

## Context Understanding Checklist:

- [ ] Read all related controller files
- [ ] Understand the routing/service architecture
- [ ] Map out the data flow
- [ ] Identify all affected components
- [ ] Propose changes with full context explanation

## Remember:

**"Measure twice, cut once" - but for code changes: "Investigate completely, modify minimally"**

---

_Added after learning from webhook URL configuration mistake on 2025-11-03_

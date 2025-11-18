# Platform Initialization Changelog

## [2.0.0] - 2024-11-17

### Added
- **Automated Token Extraction**: New `4-update-platform-token.js` script automatically extracts JWT tokens from platform-admin-agent Docker logs
- **Environment Variable Support**: Database configuration now supports environment variables (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME)
- **Multi-Container Detection**: Automatically detects platform-admin-agent container across different naming conventions:
  - `platform-admin-agent` (manual Docker run)
  - `confirmd-platform-platform-admin-agent-1` (Docker Compose v2)
  - `confirmd-platform_platform-admin-agent_1` (Docker Compose v1)
- **Enhanced Error Handling**: Better error messages with troubleshooting tips
- **Migration Notes**: Added `MIGRATION_NOTES.md` for tracking changes
- **This Changelog**: Added `CHANGELOG.md` for version tracking

### Changed
- **Token Update Script**: Replaced bash script with Node.js implementation
  - `scripts/4-update-platform-token.sh` → `scripts/4-update-platform-token.js`
  - Automatic token extraction is now the default behavior
  - Manual token input still supported as fallback
- **Encryption Method**: Fixed to use raw token (removed JSON.stringify wrapper)
  - Old: `CryptoJS.AES.encrypt(JSON.stringify(token), key)` ❌
  - New: `CryptoJS.AES.encrypt(token, key)` ✅
- **run-all.sh**: Updated to use Node.js script with auto-extraction prompt
- **Documentation**: Updated all docs to reflect automated approach:
  - `README.md`
  - `QUICK_START.txt`
  - `docs/INITIALIZATION_CHECKLIST.md`
  - `docs/PLATFORM_ADMIN_SETUP.md`

### Removed
- `scripts/4-update-platform-token.sh` - Replaced by .js version
- `../update-platform-admin-api-key.js` - Deprecated SQL generator with wrong encryption
- `../update-platform-admin-token-sql.js` - Functionality moved into initialization system

### Fixed
- **Encryption Bug**: Token is now encrypted without JSON.stringify wrapper, matching how the platform decrypts it
- **Container Name Issue**: Script now searches for container using multiple naming patterns
- **Hardcoded Values**: Database connection now uses environment variables
- **Organization Name**: Uses correct "Platform Admin" (with space) instead of "Platform-admin"

### Security
- Tokens are properly encrypted using CryptoJS AES matching the platform standard
- Database credentials support environment variables (no more hardcoded passwords in production)
- Added CRYPTO_PRIVATE_KEY requirement check

### Migration Guide

#### For Users
No action required - the new script is backward compatible.

**Old command:**
```bash
./4-update-platform-token.sh "your-token"
```

**New commands:**
```bash
# Recommended: Auto-extract
node ./4-update-platform-token.js

# Fallback: Manual input
node ./4-update-platform-token.js "your-token"
```

#### For Developers
The token update functionality is now centralized in `platform-initialization/scripts/4-update-platform-token.js`. This is the single source of truth for token updates.

### Technical Details

#### Encryption Changes
The critical fix addresses how tokens are encrypted:

**Before (Incorrect):**
```javascript
// This adds quotes around the token
const encrypted = CryptoJS.AES.encrypt(JSON.stringify(token), key);
// Results in encrypting: "eyJhbGci..." (with quotes)
```

**After (Correct):**
```javascript
// This encrypts the raw token
const encrypted = CryptoJS.AES.encrypt(token, key);
// Results in encrypting: eyJhbGci... (no quotes)
```

This matches how the agent-service decrypts tokens, fixing authentication failures.

#### Container Detection
```javascript
this.containerPatterns = [
  'platform-admin-agent',                           // Manual
  'confirmd-platform-platform-admin-agent-1',       // Compose v2
  'confirmd-platform_platform-admin-agent_1',       // Compose v1
];
```

### Dependencies
- `pg` - PostgreSQL client
- `crypto-js` - AES encryption (matches platform standard)
- `dotenv` - Environment variable support
- Node.js v18+ (already required by platform)

### Breaking Changes
None - fully backward compatible.

### Deprecation Notices
- Manual token input via bash script is deprecated but still works
- Consider using auto-extraction for improved developer experience

---

## [1.0.0] - 2024-11-15

### Initial Release
- Database seeding scripts
- Keycloak setup integration
- Platform admin organization creation
- Basic token update via bash script
- Documentation and guides

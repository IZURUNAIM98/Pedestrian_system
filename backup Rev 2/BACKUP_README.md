# SmartCross backup Rev 2

This folder is an isolated source backup of the reviewed SmartCross production release deployed on 21 September 2026.

Included:

- SmartCross application source and styles
- Normal, School, Heavy Traffic, emergency-priority, and degraded-operation logic
- Automated tests, project documentation, source-lock manifest, and build configuration
- Detailed Design Description document

Excluded intentionally:

- `.env.local` and all authentication secrets
- `.git`, `.vercel`, `node_modules`, `.next`, temporary files, generated test results, and deployment caches

Runtime credentials must be supplied securely through the deployment environment. Do not commit credential values to this folder.

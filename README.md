# AnimePlex Vega Admin

A small Vercel-hosted admin console for changing the default provider in `sachinqzqz-web/vega-app`.

## Vercel setup

1. Import this GitHub repository into Vercel and use the repository root.
2. Add these **Production** environment variables:
   - `GITHUB_TOKEN`: a GitHub fine-grained token restricted to `sachinqzqz-web/vega-app` with **Contents: Read and write** permission.
   - `ADMIN_PASSWORD`: a strong private admin password.
3. Redeploy after setting environment variables.

The admin password is only checked by the serverless API. The GitHub token is never sent to the browser.

## Important

The panel updates `provider-config.json` on the `main` branch of `vega-app`. It does not rebuild an installed APK automatically. The app must read this config for the change to take effect; depending on how the app bundles configuration, a new APK build may be required.

Provider IDs are validated for format but not against the app's full provider registry. Use an exact registered ID.

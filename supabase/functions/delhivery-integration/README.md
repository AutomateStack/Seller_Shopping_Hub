# Delhivery integration

This function is part of Seller Shopping Hub only.

## Required Edge Function secrets

Configure these in the Seller Shopping Hub Supabase project before deployment:

- `DELHIVERY_API_TOKEN`: Delhivery API token for the selected environment. Keep it server-side only.
- `DELHIVERY_BASE_URL`: `https://staging-express.delhivery.com` for staging; change to `https://track.delhivery.com` only after Delhivery enables the live token.
- `APP_ORIGIN`: the deployed Seller Shopping Hub origin for browser CORS.

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to Edge Functions.

## Actions

- Dry-run validation (no Delhivery request and no API token required): POST `{ "action": "preview-warehouse", "address_id": "<approved seller address UUID>" }`. This validates the approved pickup address, seller status, required fields, and payload construction. Contact details are masked in the response.
- PIN serviceability check (requires the Delhivery testing token): POST `{ "action": "check-pincode", "address_id": "<approved seller address UUID>" }`. The function calls `GET /c/api/pin-codes/json/?filter_codes=<PIN>` and requires Delhivery to report `pickup = "Y"` with no blocking remarks.
- Actual registration: POST `{ "action": "register-warehouse", "address_id": "<approved seller address UUID>" }`. The function repeats the PIN serviceability check server-side immediately before warehouse creation.

The caller must be authenticated and have the marketplace `operations` or `super_admin` role. The seller must be approved and active, and the pickup address must have admin approval.

The function creates or reuses the local warehouse mapping, calls Delhivery's Client Warehouse Creation endpoint, and records the response/status. Failed registrations can be retried from the admin pickup-address review page. The dry-run action never creates a mapping and never calls Delhivery. PIN checking and warehouse registration are currently locked to the staging base URL; the live endpoint is intentionally blocked.

The return address uses the seller's latest address with `address_type = 'return'`, falling back to the approved pickup address when no return address exists.

## Important Delhivery operational notes

- Warehouse creation is optional if Delhivery's team creates the pickup location manually, but the API is appropriate for a marketplace with dynamic seller locations.
- Only use a warehouse name returned/accepted for the account when manifesting a shipment.
- Delhivery requires pickup requests unless the account has automatic pickup enabled. A pickup request is for the warehouse and can cover multiple ready shipments; it is not one request per AWB.
- Shipment manifestation, serviceability, labels, pickup requests, and tracking should be enabled after confirming the account's exact B2C API schema and testing token. Shipment creation is intentionally not wired until package dimensions/weight and the official request schema are confirmed.

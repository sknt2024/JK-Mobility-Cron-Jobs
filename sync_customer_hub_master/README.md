# Customer Hub Master Sync Controller Documentation

## Overview
The `customer_hub_master.controller.js` file handles the synchronization of customer hub master data from SAP into the local MongoDB database. It performs a two-phase sync: first fetching hub master data, then enriching each hub with ship-to-party details.

## Key Logic Flow

### Phase 1: Hub Master Data Sync

#### a. Fetch Hub Master Data
- Endpoint: `/ZAWS_JKCONNECT_SRV/FltHubMstSet`
- Retrieves all hub records from SAP
- Authenticates using `SAP_USERNAME` and `SAP_PASSWORD`

#### b. Update Hub Basic Information
- For each hub record from SAP:
  - `hubCode`: Hub code (`HubCode`)
  - `hubName`: Hub name (`HubName`)
  - `fleetCode`: Customer number (`Kunnr`)
- Uses `findOneAndUpdate` with `upsert: true` to create or update records
- Tracks unique fleet codes for reference

### Phase 2: Ship-to-Party Details Enrichment

For each hub created/updated in Phase 1:

#### a. First Attempt - Fleet Code Filter
- Endpoint: `/ZAWS_JKCONNECT_SRV/ShipToPartySet?$filter=Kunnr eq '{fleetCode}'&$format=json`
- Filters results by:
  - `Kunn2` (Ship-to-party) matches hub code
  - `Vkorg` (Sales org) = `"1000"`
  - `Spart` (Division) = `"20"`
  - `Vtweg` (Distribution channel) = `"10"`

#### b. Second Attempt - Hub Code Filter (Fallback)
If no results from first attempt:
- Endpoint: `/ZAWS_JKCONNECT_SRV/ShipToPartySet?$filter=Kunnr eq '{hubCode}'&$format=json`
- Uses same filtering criteria as first attempt
- Provides fallback for hubs where fleet code lookup doesn't return results

#### c. Update Hub with Ship-to-Party Details
Updates hub record with:
- `pinCode`: Postal code (`Kunn2Pincode`)
- `address`: Address (`Kunn2Address`)
- `city`: City (`Kunn2City`)
- `depoCode`: Sales office (`Shpvkbur`)

## Error Handling
- **Hub-Level**: If an error occurs while processing ship-to-party details for a specific hub, it logs the error and continues with the next hub
- **Job-Level**: If a critical error occurs (e.g., API failure), the `SyncLog` is updated with status `"failed"` and the error message

## Retry Logic
- Uses `robustGet` function with exponential backoff
- Default: 3 retries with configurable timeout
- Non-retryable 4xx errors are immediately thrown
- Keeps HTTP connections alive for better performance

## Completion
- Updates `SyncLog` with status `"successful"` and metadata including total hubs processed
- Logs summary of the sync operation

## Dependencies
- **Models**: `sync_log.model.js`, `customerHub.model.js`
- **External**: `axios` for HTTP requests, `http` and `https` for connection pooling

## Environment Variables
- `SAP_API_URL`: Base URL for SAP API
- `SAP_USERNAME`: SAP authentication username
- `SAP_PASSWORD`: SAP authentication password
- `SAP_REQUEST_TIMEOUT_MS`: Request timeout in milliseconds (default: 45000)
- `SAP_RETRIES`: Number of retry attempts (default: 3)
- `SAP_BACKOFF_INITIAL_MS`: Initial backoff delay in milliseconds (default: 1000)

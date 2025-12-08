# Territories Master Sync Controller Documentation

## Overview
The `territories_master.controller.js` file handles the synchronization of territory master data from SAP into the local MongoDB database. It fetches plant attributes and region master data, then creates territory records with proper region and zone mappings.

## Key Logic Flow

### 1. Parallel Data Fetching
Fetches two datasets simultaneously from SAP:

#### a. Plant Attributes (Territory Data)
- Endpoint: `/ZSKU_MANF_SRV/PlantAttributeSet`
- Contains depot/plant information with region codes

#### b. Region Master Data
- Endpoint: `/ZAWS_JKCONNECT_SRV/MsfaRegionMstDtlSet`
- Contains region codes, names, and zone mappings

### 2. Region and Zone Mapping

#### a. Build Lookup Maps
Creates two mapping objects:
- `regionCodeToNameMap`: Maps region codes to region names
- `regionCodeToZoneMap`: Maps region codes to zone codes

#### b. Zone Code Translation
Uses a predefined `zoneMap` to translate zone codes to human-readable names:
- `NZ` → "North Zone"
- `SZ` → "South Zone"
- `EZ` → "East Zone"
- `WZ` → "West Zone"
- `CZ` → "Central Zone"
- `TZ` → "South Zone-2"
- `O` → "Other"

### 3. Bulk Territory Update

#### a. Build Bulk Operations
For each plant/depot in the territory data:
- Looks up region name using region code
- Looks up zone code using region code
- Translates zone code to zone name
- Creates an `updateOne` operation with `upsert: true`

#### b. Territory Record Fields
- `depoCode`: Plant/depot code (`Werk`)
- `regionCode`: Region code (`Region`)
- `regionName`: Resolved region name from mapping
- `zoneCode`: Resolved zone code from mapping
- `zoneName`: Human-readable zone name

#### c. Execute Bulk Write
- Performs a single bulk write operation for all territories
- Uses `upsert: true` to create or update records
- Logs detailed results including inserted, matched, modified, and upserted counts

### 4. Error Handling
- **Job-Level**: If a critical error occurs (e.g., API failure), the `SyncLog` is updated with status `"failed"` and the error message
- Uses retry logic with exponential backoff for SAP API calls

### 5. Completion
- Updates `SyncLog` with status `"successful"` and metadata including:
  - Total territories processed
  - Total regions fetched
  - Bulk write operation results
- Logs summary of the sync operation

## Dependencies
- **Models**: `sync_log.model.js`, `territory.model.js`
- **External**: `axios` for HTTP requests, `http` and `https` for connection pooling

## Environment Variables
- `SAP_API_URL`: Base URL for SAP API
- `SAP_USERNAME`: SAP authentication username
- `SAP_PASSWORD`: SAP authentication password
- `SAP_REQUEST_TIMEOUT_MS`: Request timeout in milliseconds (default: 45000)
- `SAP_RETRIES`: Number of retry attempts (default: 3)
- `SAP_BACKOFF_INITIAL_MS`: Initial backoff delay in milliseconds (default: 1000)

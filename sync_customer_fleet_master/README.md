# Customer Fleet Master Sync Controller Documentation

## Overview
The `customer_fleet_master.controller.js` file handles the synchronization of customer fleet master data from SAP into the local MongoDB database. It processes each customer hub and fetches corresponding fleet details from SAP.

## Key Logic Flow

### 1. Initialization
- Creates a `SyncLog` entry to track the sync operation status
- Retrieves all customer hubs from the local database

### 2. Hub Processing Loop
For each hub in the database:

#### a. SAP API Call
- Endpoint: `/ZAWS_JKCONNECT_SRV/CustDtlSet?$filter=Kunnr eq '{fleetCode}'`
- Uses OData filter to fetch customer details for the specific fleet code
- Authenticates using `SAP_USERNAME` and `SAP_PASSWORD` from environment variables

#### b. Fleet Data Update
If SAP returns data for the hub:

**Hub Association**:
- Checks if the fleet record already exists in the database
- If it exists and doesn't already include this hub, adds the hub ID to the fleet's `hubs` array

**Fleet Record Upsert**:
- Updates or creates fleet record with the following fields:
  - `fleetCode`: Customer number from SAP (`Kunnr`)
  - `fleetName`: Customer name (`Name1`)
  - `pinCode`: Postal code (`Pincode`)
  - `address`: Address (`Address`)
  - `city`: City (`City1`)
  - `mobile`: Mobile number (`Mobile`)
  - `gstNo`: GST number (`GstNo`)
  - `Vkbur`: Sales office (`Vkbur`)
  - `hubs`: Array of associated hub IDs (only set on new records)
  - `isMobility`: Boolean flag set to `true` if SAP `Class` field equals `"MB"`, otherwise `false`

### 3. Error Handling
- **Hub-Level**: If an error occurs while processing a specific hub, it logs the error and continues with the next hub
- **Job-Level**: If a critical error occurs, the `SyncLog` is updated with status `"failed"` and the error message

### 4. Completion
- Updates `SyncLog` with status `"successful"` and metadata including total hubs processed and sync count
- Logs summary of the sync operation

## Dependencies
- **Models**: `sync_log.model.js`, `customerHub.model.js`, `customerFleet.model.js`
- **External**: `axios` for HTTP requests

## Environment Variables
- `SAP_API_URL`: Base URL for SAP API
- `SAP_USERNAME`: SAP authentication username
- `SAP_PASSWORD`: SAP authentication password

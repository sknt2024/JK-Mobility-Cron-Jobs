import mongoose from 'mongoose';

export const TerritorySchema = new mongoose.Schema(
    {
        depoCode: {
            type: String,
        },
        territoryCode: {
            type: String,
        },
        territoryName: {
            type: String,
        },
        areaCode: {
            type: String,
        },
        areaName: {
            type: String,
        },
        regionCode: {
            type: String,
        },
        regionName: {
            type: String,
        },
        zoneCode: {
            type: String,
        },
        zoneName: {
            type: String,
        },
        deleted: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

const Territory = mongoose.model("territory", TerritorySchema);

export default Territory
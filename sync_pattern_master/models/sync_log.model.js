import mongoose from "mongoose";

const SyncLogSchema = new mongoose.Schema(
    {
        initiatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        status: {
            type: String,
            enum: ["successful", "failed", "pending"],
            required: true,
            default: "pending",
        },
        errors: {
            type: Object,
            default: []
        },
        action: {
            type: String, 
            default: ""
        }
    },
    { timestamps: true }
);

const SyncLog = mongoose.model("SyncLog", SyncLogSchema);
export default SyncLog;

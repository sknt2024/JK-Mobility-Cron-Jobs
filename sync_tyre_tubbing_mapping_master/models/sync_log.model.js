import mongoose from 'mongoose';

const syncLogSchema = new mongoose.Schema(
    {
        action: {
            type: String,
            required: true,
        },
        initiatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        status: {
            type: String,
            enum: ['pending', 'successful', 'failed'],
            default: 'pending',
        },
        errorMessages: {
            type: String,
        },
        meta: {
            type: mongoose.Schema.Types.Mixed,
        },
    },
    { timestamps: true }
);

export default mongoose.model('SyncLog', syncLogSchema);

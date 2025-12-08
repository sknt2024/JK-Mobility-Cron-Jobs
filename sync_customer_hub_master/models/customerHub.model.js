import mongoose from 'mongoose';

const customerHubSchema = new mongoose.Schema(
    {
        hubCode: {
            type: String,
            required: true,
        },
        hubName: {
            type: String,
            required: true,
        },
        fleetCode: {
            type: String,
            required: true,
        },
        pinCode: {
            type: String,
        },
        address: {
            type: String,
        },
        city: {
            type: String,
        },
        mobile: {
            type: String,
        },
        gstNo: {
            type: String,
        },
        fleet: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'customer_fleet',
        },
        stocks: [
            {
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Tyre',
                },
                quantity: {
                    type: Number,
                    default: 1,
                },
                status: {
                    type: String,
                },
            },
        ],
        depoCode: {
            type: String,
        },
        active: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

customerHubSchema.pre(/^find/, function (next) {
    this.find({ active: { $ne: false } });
    next();
});

export default mongoose.model('customer_hub', customerHubSchema);

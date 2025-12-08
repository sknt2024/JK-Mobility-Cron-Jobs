import mongoose from 'mongoose';

const sizeMasterSchema = new mongoose.Schema(
    {
        Mandt: {
            type: String,
            require: true,
        },
        size: {
            type: String,
            require: true,
        },
        CatCode: {
            type: String,
            require: true,
        },
        Ydesc: {
            type: String,
            required: true,
        },
        ZsizeCd: {
            type: String,
        },
    },
    { timestamps: true }
);

const ZAWS_JC_SRV_SIZE_MST = mongoose.model('ZAWS_JC_SRV_SIZE_MST', sizeMasterSchema);

export default ZAWS_JC_SRV_SIZE_MST;

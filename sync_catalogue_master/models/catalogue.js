import mongoose from 'mongoose';

const Schema = new mongoose.Schema(
    {
        MatnrTyre: {
            type: String,
        },
        MatnrTf: {
            type: String,
        },
        MatnrFlap: {
            type: String,
        },
        Priority: {
            type: String,
        },
        Tyre: {
            type: String,
        },
        Used: {
            type: String,
        },
    },
    { timestamps: true }
);

export const Catalogue = mongoose.model('Catalogue', Schema);

export default Catalogue;

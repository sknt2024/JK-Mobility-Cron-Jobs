import mongoose from 'mongoose';

const newProductSchema = new mongoose.Schema(
    {
        stocks: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ZAWS_STOCKS',
        },

        Secondary: [
            {
                type: Number,
            },
        ],
        originalNSD: {
            type: String,
        },
        grooves: {
            type: Number,
        },
        companyName: {
            type: String,
            required: [true, 'companyName is required'],
            enum: ['CIL', 'JK'],
            default: 'JK',
        },

        productName: {
            type: String,
            required: [true, 'productName is required'],
        },
        mrp: {
            type: Number,
            // type: mongoose.Schema.Types.ObjectId,
            // ref: "ZAWS_JC_SRV_PRICEDTL_MST",
        },
        smrp: {
            type: Number,
        },
        productType: {
            type: String,
            required: [true, 'productType is required'],
        },
        Catcode: {
            type: String,
        },
        Catg: {
            type: String,
        },
        imageUrl: {
            type: String,
        },
        materialNo: {
            type: String,
            required: [true, 'materialNo is required'],
            unique: true,
            index: 1,
        },
        brand: {
            type: String,
            //   required: [true, "brand name is required"],
        },
        subBrand: {
            type: String,
            //   required: [true, "brand name is required"],
        },
        ParentSku: {
            type: String,
        },
        ParentFlg: {
            type: String,
        },
        description: {
            type: String,
            //   required: [true, "brand name is required"],
        },
        tyrePattern: {
            type: String,
        },
        category: {
            type: String,
            // type: mongoose.Schema.Types.ObjectId,
            // ref: "ZAWS_JC_SRV_CAT_MST",
            //   required: [true, "category is required"],
        },
        tyreSize: {
            type: String,
            // type: mongoose.Schema.Types.ObjectId,
            // ref: "ZAWS_JC_SRV_SIZE_MST",
            //   required: [true, "tyreSize is required"],
        },
        prodSize: {
            type: String,
        },
        aspectRat: {
            type: String,
            //   required: [true, "aspectRat is required"],
        },
        loadIndex: {
            type: String,
            //   required: [true, "loadIndex is required"],
        },
        plyRating: {
            type: String,
            //   required: [true, "PlyRating is required"],
        },
        flap: {
            type: Boolean,
        },
        // MatnrTube: {type: String},
        // MatnrFlap: {type: String},
        NDP: {
            type: String
        },
        Secondarystock: {
            type: Number,
        },

        jkStock: {
            type: Number,
            default: 0,
        },
        FirType: {
            type: String,
        },
        tube: {
            type: String,
        },
        Sensor: {
            type: String,
        },
        Const: {
            type: String,
        },
        updatedBy: {
            type: mongoose.Types.ObjectId,
            ref: "User",
        },
        Flag: {
            type: String,
        },
        MatDesc: {
            type: String,
        },
        productNameSearch: {
            type: String,
        },
        Musthave: [
            {
                variant: { type: mongoose.Schema.Types.ObjectId, ref: 'NewProduct' },
            },
        ],
        ClaimFlag: {
            type: String,
            default: '',
        },
        NsdFlag: {
            type: String,
        },
        PremiumFlag: { type: String },
        BrandDesc: { type: String },
        SubBrandDesc: { type: String },
        active: {
            type: Boolean,
            default: true,
            index: true,
        },
    },
    { timestamps: true }
);

// query middleware

const NewProduct = mongoose.model('NewProduct', newProductSchema);

export default NewProduct;

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
        },
        subBrand: {
            type: String,
        },
        ParentSku: {
            type: String,
        },
        ParentFlg: {
            type: String,
        },
        description: {
            type: String,
        },
        tyrePattern: {
            type: String,
        },
        category: {
            type: String,
        },
        tyreSize: {
            type: String,
        },
        prodSize: {
            type: String,
        },
        aspectRat: {
            type: String,
        },
        loadIndex: {
            type: String,
        },
        plyRating: {
            type: String,
        },
        flap: {
            type: Boolean,
        },
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
        PremiumFlag: {
            type: String
        },
        BrandDesc: {
            type: String
        },
        SubBrandDesc: {
            type: String
        },
        active: {
            type: Boolean,
            default: true,
            index: true,
        },
    },
    { timestamps: true }
);

const NewProduct = mongoose.model('NewProduct', newProductSchema);

export default NewProduct;

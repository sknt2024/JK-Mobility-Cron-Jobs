import mongoose from 'mongoose';

const schemaData = new mongoose.Schema(
  {
    Mandt: {
      type: String,
      require: true,
    },
    PatCode: {
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

const ZAWS_JC_SRV_PATMST = mongoose.model('ZAWS_JC_SRV_PAT_MST', schemaData);

export default ZAWS_JC_SRV_PATMST;

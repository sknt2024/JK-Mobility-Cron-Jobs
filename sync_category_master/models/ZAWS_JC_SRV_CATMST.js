import mongoose from 'mongoose';

const schemaData = new mongoose.Schema(
  {
    Mandt: {
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
    CompInd: {
      type: String,
      required: true,
    },
    Division: {
      type: String,
      required: true,
    },
    SymId: {
      type: String,
      required: true,
    },
    SelectionGrouping: {
      type: String,
      required: true,
    },
    DashboardGrouping: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

export const ZAWS_JC_SRV_CATMST = mongoose.model(
  'ZAWS_JC_SRV_CAT_MST',
  schemaData
);

export default ZAWS_JC_SRV_CATMST;

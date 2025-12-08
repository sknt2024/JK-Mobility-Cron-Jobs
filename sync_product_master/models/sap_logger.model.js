import mongoose from 'mongoose';

const sapLoggerSchema = new mongoose.Schema(
  {
    api_endpoint: {
      type: String,
    }
  },
  {
    timestamps: true,
  }
);

sapLoggerSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });
  next();
});

export const Log = mongoose.model('sap_logger', sapLoggerSchema);

export default Log;

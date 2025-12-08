import mongoose from "mongoose";
const customerFleetSchema = new mongoose.Schema(
  {
    fleetCode: {
      type: String,
      required: true,
      index: true,
    },
    fleetName: {
      type: String,
      required: true,
      index: true,
    },
    enableReplacementWithoutInspection:{
      type: Boolean,
      default:false
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
    isMobility: {
      type: Boolean,
      default: true,
    },
    averageRunKmPerDay:{
      type:Number
    },
    Vkbur: {
      type: String
    },
    hubs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "customer_hub",
      },
    ],
    canCreateOrder: {
      type: Boolean,
      default: true,
    },
    mappedFleets: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "customer_fleet",
      },
    ],
    KAMs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    agreedCPKM: {
      type: String
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

customerFleetSchema.pre(/^find/, function (next) {
  this.find({ active: { $ne: false } });
  next();
});

customerFleetSchema.index( { fleetName: 1 } )
export default mongoose.model("customer_fleet", customerFleetSchema);
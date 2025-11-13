import ZAWS_JC_SRV_CATMST from "../models/ZAWS_JC_SRV_CATMST.js";
import axios from "axios";
import SyncLog from "../models/sync_log.model.js";

export const syncCategoryMaster = async (req, res, next) => {
  const syncLogEntry = await SyncLog.create({
    action: req?.query?.eventCode ?? "sync_category_master",
    initiatedBy: req?.user?._id,
  });
  try {
    return new Promise(async (resolve, reject) => {
      let categoryResponse = await axios({
        method: "get",
        url: `${process.env.SAP_API_URL}/ZAWS_JKCONNECT_SRV/CatMstSet`,
        auth: {
          username: process.env.SAP_USERNAME,
          password: process.env.SAP_PASSWORD,
        },
      });
      categoryResponse.data.d.results.forEach(async (value, index) => {
          let emp = await ZAWS_JC_SRV_CATMST.findOneAndUpdate(
            { CatCode: value.CatCode },
            {
              Mandt: value.Mandt,
              CatCode: value.CatCode,
              Ydesc: value.Ydesc,
              CompInd: value.CompInd,
              Division: value.Division,
              SymId: value.SymId,
              SelectionGrouping: value.SelectionGrouping,
              DashboardGrouping: value.DashboardGrouping,
              deleted: false,
            },
            { upsert: true }
          );

        if (index + 1 == categoryResponse.data.d.results.length) {
          if (syncLogEntry) {
            await SyncLog.findByIdAndUpdate(syncLogEntry._id, {
              $set: { status: "successful" },
            });
          }
          resolve();
        }
      });
    });
  } catch (error) {
    if (syncLogEntry) {
      await SyncLog.findByIdAndUpdate(syncLogEntry._id, {
        $set: { status: "failed" },
        error: error,
      });
    }
    error.statusCode = error?.statusCode ?? 400;
    reject();
    if (next) next(error);
  }
};

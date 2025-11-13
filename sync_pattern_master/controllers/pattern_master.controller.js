import ZAWS_JC_SRV_PATMST from "../models/ZAWS_JC_SRV_PAT_MST.js";
import axios from "axios";
import SyncLog from "../models/sync_log.model.js";

export const syncPatternMaster = async (req, res, next) => {
  const syncLogEntry = await SyncLog.create({
    action: req?.query?.eventCode ?? "sync_pattern_master",
    initiatedBy: req?.user?._id,
  });
  try {
    return new Promise(async (resolve, reject) => {
      let response = await axios({
        method: "get",
        url: `${process.env.SAP_API_URL}/ZAWS_JKCONNECT_SRV/PatMstSet`,
        auth: {
          username: process.env.SAP_USERNAME,
          password: process.env.SAP_PASSWORD,
        },
      });
      response.data.d.results.forEach(async (value, index) => {
        const pattern = await ZAWS_JC_SRV_PATMST.findOneAndUpdate(
          { PatCode: value.PatCode, CatCode: value.CatCode },
          { ...value },
          { upsert: true, new: true }
        );

        if (index + 1 == response.data.d.results.length) {
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

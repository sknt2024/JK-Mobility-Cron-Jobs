import product from "../models/product.model.js";
import SapLogger from "../models/sap_logger.model.js";
import SyncLog from "../models/sync_log.model.js";
import Patternmst from "../models/ZAWS_JC_SRV_PAT_MST.js";

import axios from "axios";
import { logInfo, logWarn, logError, logDebug } from "../utils/logger.js";

let catImages = {
  11: "https://jkconnect.s3.ap-south-1.amazonaws.com/public/1634889552561-0.4176694816923583.jpeg",
  12: "https://jkconnect.s3.ap-south-1.amazonaws.com/public/1634889552561-0.4176694816923583.jpeg",
  21: "https://jkconnect.s3.ap-south-1.amazonaws.com/public/1634889602402-0.31052746622225813.jpeg",
  22: "https://jkconnect.s3.ap-south-1.amazonaws.com/public/1634889602402-0.31052746622225813.jpeg",
  31: "https://jkconnect.s3.ap-south-1.amazonaws.com/public/1634889654310-0.3067023867617864.png",
  32: "https://jkconnect.s3.ap-south-1.amazonaws.com/public/1634889654310-0.3067023867617864.png",
  41: "https://jkconnect.s3.ap-south-1.amazonaws.com/public/1634889654310-0.3067023867617864.png",
  42: "https://jkconnect.s3.ap-south-1.amazonaws.com/public/1634889654310-0.3067023867617864.png",
  51: "https://jkconnect.s3.ap-south-1.amazonaws.com/public/1634889822179-0.695795535557235.jpeg",
  52: "https://jkconnect.s3.ap-south-1.amazonaws.com/public/1634889822179-0.695795535557235.jpeg",
  61: "https://jkconnect.s3.ap-south-1.amazonaws.com/public/1634889868241-0.3109910774029814.png",
  71: "https://jkconnect.s3.ap-south-1.amazonaws.com/public/1634889899439-0.09915334029250378.jpeg",
  81: "https://jkconnect.s3.ap-south-1.amazonaws.com/public/1634889654310-0.3067023867617864.png",
  91: "https://jkconnect.s3.ap-south-1.amazonaws.com/public/1634889654310-0.3067023867617864.png",
  B1: "https://jkconnect.s3.ap-south-1.amazonaws.com/public/1634889990036-0.8975878953096517.png",
  D1: "https://jkconnect.s3.ap-south-1.amazonaws.com/public/1634890052495-0.5132823155752646.png",
  D2: "https://jkconnect.s3.ap-south-1.amazonaws.com/public/1634890052495-0.5132823155752646.png",
  H1: "https://jkconnect.s3.ap-south-1.amazonaws.com/public/1634890087935-0.2171354842809059.jpeg",
  S1: "https://jkconnect.s3.ap-south-1.amazonaws.com/public/1634890123277-0.048489361551903976.png",
  R0: "https://jkconnect.s3.ap-south-1.amazonaws.com/public/1634889654310-0.3067023867617864.png",
};

export const syncProductMaster = async (req, res, next) => {
  const eventCode = req?.query?.eventCode ?? "sync_products";
  logInfo(`[${eventCode}] Sync started`, { initiatedBy: req?.user?._id });

  const syncLogEntry = await SyncLog.create({
    action: eventCode,
    initiatedBy: req?.user?._id,
  });

  try {
    logInfo(`[${eventCode}] Creating SAP logger entry`);
    await SapLogger.create({ api_endpoint: "ZAWS_JKCONNECT_SRV/SKUMstSet" });

    logInfo(`[${eventCode}] Fetching data from SAP`);
    const sapData = await axios({
      method: "get",
      url: `${process.env.SAP_API_URL}/ZAWS_JKCONNECT_SRV/SKUMstSet`,
      auth: {
        username: process.env.SAP_USERNAME,
        password: process.env.SAP_PASSWORD,
      },
    });

    const data = sapData.data.d.results;
    logInfo(`[${eventCode}] Received ${data.length} product records`);

    let index = 0;

    for await (let val of data) {
      try {
        index++;
        const modifiedMaterialNo = val.Matnr;

        logDebug(`[${eventCode}] Processing product ${index}/${data.length}`, {
          materialNo: modifiedMaterialNo,
        });

        const Patternmaster = await Patternmst.findOne({
          CatCode: val.CatCode,
          PatCode: val.PatCode,
        });

        logDebug(`[${eventCode}] PatternMaster found..`, {
          CatCode: val.CatCode,
          PatCode: val.PatCode,
        });

        if (!Patternmaster) {
          logWarn(`[${eventCode}] No PatternMaster found`, {
            CatCode: val.CatCode,
            PatCode: val.PatCode,
          });
        }

        const updateResult = await product.updateMany(
          { materialNo: val.Matnr },
          {
            $set: {
              ClaimFlag: val.ClaimFlag,
              ParentFlg: val.ParentFlg || "N",
              materialNo: val.Matnr,
              Flag: val.SoFlag,
              Catcode: val.CatCode,
              Catg: val.Catg,
              productName: val.ProdTitle,
              productNameSearch: val.ProdTitle.replace(/[^a-zA-Z0-9]/g, ""),
              productType:
                modifiedMaterialNo[0] === "1" || modifiedMaterialNo[0] === "R"
                  ? "tyre"
                  : modifiedMaterialNo[0] === "P" || modifiedMaterialNo[0] === "2"
                    ? "tube"
                    : modifiedMaterialNo[0] === "Q" || modifiedMaterialNo[0] === "3"
                      ? "flap"
                      : "tyre",
              Const: val.Const == "1" ? "BIAS" : val.Const == "2" ? "RADIAL" : "",
              prodSize: val.Prodsize,
              MatDesc: val.MatDesc,
              imageUrl: catImages[val.CatCode],
              tyrePattern: Patternmaster ? Patternmaster.Ydesc : null,
              brand: val.Brand,
              subBrand: val.SubBrand,
              TtType: val.TtType,
              aspectRat: val.AspectRat,
              LoadIndex: val.LoadIndex,
              plyRating: val.PlyRating,
              ParentSku: val.ParentSku,
              NsdFlag: val.NsdFlag,
              PremiumFlag: val.PremSku,
              BrandDesc: val.BrandDesc,
              SubBrandDesc: val.SubbrndDesc,
            },
          },
          { upsert: true, new: true }
        );

        logInfo(`[${eventCode}] Updated product`, {
          materialNo: val.Matnr,
          matchedCount: updateResult.matchedCount,
          modifiedCount: updateResult.modifiedCount,
        });

      } catch (innerErr) {
        logError(`[${eventCode}] Error processing product`, {
          index,
          materialNo: val?.Matnr,
          errorMessage: innerErr.message,
          stack: innerErr.stack,
        });
      }
    }

    if (syncLogEntry) {
      await SyncLog.findByIdAndUpdate(syncLogEntry._id, {
        $set: { status: "successful" },
      });
      logInfo(`[${eventCode}] Sync completed successfully`);
    }
  } catch (error) {
    logError(`[${eventCode}] Sync failed`, { error });

    if (syncLogEntry) {
      await SyncLog.findByIdAndUpdate(syncLogEntry._id, {
        $set: { status: "failed", errorMessages: error.message },
      });
    }

    error.statusCode = error?.statusCode ?? 400;
    if (next) next(error);
  }
};
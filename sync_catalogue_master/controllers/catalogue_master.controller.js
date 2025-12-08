import { Catalogue } from '../models/catalogue.js';
import axios from "axios";

export const syncCatalogueMaster = async () => {
    return new Promise(async (resolve, reject) => {
        const errors = [];
        try {
            let empData = await axios({
                method: "get",
                url: `${process.env.SAP_API_URL}/ZAWS_JKCONNECT_SRV/CatalogTtfDtlSet`,
                auth: {
                    username: process.env.SAP_USERNAME,
                    password: process.env.SAP_PASSWORD,
                },
            });
            empData.data.d.results.forEach(async (val, index) => {
                try {
                    let emp = await Catalogue.findOneAndUpdate(
                        { MatnrTyre: val.MatnrTyre, MatnrTf: val.MatnrTf },
                        {
                            MatnrTf: val.MatnrTf,
                            MatnrTyre: val.MatnrTyre,
                            Priority: val.Priority,
                            Tyre: val.Tyre,
                            deleted: false,
                        },
                        { upsert: true, new: true }
                    );

                    if (empData.data.d.results.length == index + 1) {
                        resolve(errors);
                    }
                } catch (err) {
                    errors.push({
                        type: " ADDING",
                        message: err.message,
                        error: err,
                    });

                    reject(errors);
                }
            });
        } catch (err) {
            reject(err);
        }
    });
};

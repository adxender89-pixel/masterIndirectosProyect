sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
],
    function (JSONModel, Device) {
        "use strict";

        return {
            /**
             * Provides runtime information for the device the UI5 app is running on as a JSONModel.
             * @returns {sap.ui.model.json.JSONModel} The device model.
             */
            createDeviceModel: function () {
                var oModel = new JSONModel(Device);
                oModel.setDefaultBindingMode("OneWay");
                return oModel;
            },

            createUrlsMasterModel: function () {
                const domain = document.domain;

                // En local este proyecto corre en localhost:8080
                const url = (domain === "localhost")
                    ? "http://fsapl09l.intranet.ferrovial.es:8000"
                    : window.location.origin;

                const urlInsite = (
                    domain === "localhost" ||
                    domain === "fsapl09l.ferrovial.int" ||
                    domain === "fsapl09l.intranet.ferrovial.es"
                )
                    ? "http://flrhvmtpho001.ferrovial.int:7011"
                    : window.location.origin;

                const service = "/sap/opu/odata/SAP/ZFERR_MASTER_SRV/";
                const vistasService = "/sap/opu/odata/SAP/ZFERR_XX_SRV/";

                return new JSONModel({
                    url: url,
                    urlInsite: urlInsite + "/FerPhoFrontalWL12",
                    service: service,
                    vistasService: vistasService,
                    endpoint: url + service,
                    endpointVistas: url + vistasService
                });
            },

            createEndpointModel: function () {
                const domain = document.domain;

                const isIntranet = [
                    "localhost",
                    "fsapl09l.ferrovial.int",
                    "fsapl09l.intranet.ferrovial.es"
                ].includes(domain);

                const url = isIntranet
                    ? "http://fsapl09l.intranet.ferrovial.es:8000"
                    : window.location.origin;

                const urlInsite = isIntranet
                    ? "http://flrhvmtpho001.ferrovial.int:7011"
                    : window.location.origin;

                const oldservice = "/sap/opu/odata/SAP/ZFERR_INSITE_SRV/";
                const service = "/sap/opu/odata/SAP/ZFERR_INSITE_ST_SRV/";
                const vistasService = "/sap/opu/odata/SAP/ZFERR_XX_SRV/";

                var oModel = new JSONModel({
                    urlInsite: urlInsite + "/FerPhoFrontalWL12",
                    endpoint: `${url}${service}`,
                    endpointOld: `${url}${oldservice}`,
                    endpointVistas: `${url}${vistasService}`
                });

                return oModel;
            }
        };

    });
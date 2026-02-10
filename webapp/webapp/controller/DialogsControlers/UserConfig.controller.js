sap.ui.define(
    [
        "../BaseController",
        "sap/ui/model/json/JSONModel",
        "sap/base/util/deepClone",
    ],
    function (BaseController, JSONModel, deepClone) {
        "use strict";

        return BaseController.extend("masterindirectos.controller.DialogsControlers.UserConfig", {
            onInit: function () {
                // Set up the JSON model for the scope selector dialog in data/nodeList.json
                const oModel = new JSONModel();
                const sUrl = sap.ui.require.toUrl("masterindirectos/data/nodeList.json");

                oModel.loadData(sUrl);
                this.getView().setModel(new JSONModel({
                    langFormats:[
                        {langCode:"ES",langDescription:"Español"},
                        {langCode:"EN",langDescription:"Ingles"}
                    ],
                    dateFormats:[
                        {dateFormat:"DD/MM/YYYY"},
                        {dateFormat:"YYYY/MM/DD"}
                    ],
                    numberFormats:[
                        {currFormatCode:",",currFormat:"1.000,99"},
                        {currFormatCode:".",currFormat:"1,000.99"}
                    ]
                }), "userModel");


            },

            onAccept: function () {
                const options = this.getView().getViewData();
                
                options.close();
            },

            onCancel: function () {
                const options = this.getView().getViewData();
                options.close();
            },

        });
    }
);

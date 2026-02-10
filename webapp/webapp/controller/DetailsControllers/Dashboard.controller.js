sap.ui.define([
    "../BaseController",
    "sap/ui/model/json/JSONModel",
    'sap/m/MessageToast'

],
    function (BaseController, JSONModel, MessageToast) {
        "use strict";

        return BaseController.extend("masterindirectos.controller.DetailsControllers.Dashboard", {

            /**
             * Suscribe el controlador a eventos globales de selección
             */
            onInit: function () {
                // 1. COSTE TOTAL (Array con un solo oggetto)
                var oDataCosteTotal = [
                    {
                        ejecutado: "19.882.313,17",
                        pendiente: "3.134.026,07",
                        total: "23.016.339,24"
                    }
                ];
                this.getView().setModel(new sap.ui.model.json.JSONModel(oDataCosteTotal), "oModelCosteTotal");

                // 2. OBRA EJECUTADA NETA
                var oDataObraNeta = [
                    {
                        ejecutado: "21.598.431,29",
                        pendiente: "3.599.122,17",
                        total: "25.197.553,46"
                    }
                ];
                this.getView().setModel(new sap.ui.model.json.JSONModel(oDataObraNeta), "oModelDataObraNeta");

                // 3. COSTE DIRECTO
                var oDataCosteDirecto = [
                    {
                        ejecutado: "19.115.444,32",
                        pendiente: "2.945.643,42",
                        total: "22.061.087,74"
                    }
                ];
                this.getView().setModel(new sap.ui.model.json.JSONModel(oDataCosteDirecto), "oModelCosteDirecto");

                const tartasModel = {
                    labels: ["Ejecutado", "Pendiente"],
                    datasets: [oDataCosteTotal[0], oDataObraNeta[0], oDataCosteDirecto[0]].map(item => ({
                        data: [parseFloat(item.ejecutado.replace(/\./g, '').replace(',', '.')), parseFloat(item.pendiente.replace(/\./g, '').replace(',', '.'))]
                    }))
                }
                this.getView().setModel(
                    new JSONModel(tartasModel),
                    "oModelTartas"
                );
                var oData = {
                    Dashboard: [
                        {
                            concepto: "I.001 - Anticipados",
                            impEjec: "62.668,51",
                            impPend: "27.237,13",
                            impTot: "89.905,64",
                            percTotCost: "0,39%",
                            percTotalCD: "0,41%",
                            percTotVenta: "0,36%",
                            type: "data"
                        },
                        {
                            concepto: "I.002 - Inmovilizados",
                            impEjec: "115.984,24",
                            impPend: "35.991,29",
                            impTot: "151.975,53",
                            percTotCost: "0,66%",
                            percTotalCD: "0,69%",
                            percTotVenta: "0,60%",
                            type: "data"
                        },
                        {
                            concepto: "I.003 - Corrientes",
                            impEjec: "289.181,09",
                            impPend: "35991,29",
                            impTot: "402.231,86",
                            percTotCost: "1,62%",
                            percTotalCD: "1,69%",
                            percTotVenta: "1,48%",
                            type: "data"
                        },
                        {
                            concepto: "Personal",
                            impEjec: "215.984,24",
                            impPend: "44.998,10",
                            impTot: "297.785,49",
                            percTotCost: "1,29%",
                            percTotalCD: "1,35%",
                            percTotVenta: "1,48%",
                            type: "info"
                        }, {
                            concepto: "Financiero",
                            impEjec: "10000,00",
                            impPend: "20000,00",
                            impTot: "30000,00",
                            percTotCost: "0,75%",
                            percTotalCD: "1,15%",
                            percTotVenta: "1,46%",
                            type: "info"
                        },
                        {
                            concepto: "Resto",
                            impEjec: "63.196,85",
                            impPend: "35.991,29",
                            impTot: "251.975,53",
                            percTotCost: "1,09%",
                            percTotalCD: "1,14%",
                            percTotVenta: "1,00%",
                            type: "info"
                        },
                        {
                            concepto: "I.004 - Diferidos",
                            impEjec: "215.984,24",
                            impPend: "35.991,29",
                            impTot: "251.975,53",
                            percTotCost: "1,09%",
                            percTotalCD: "1,14%",
                            percTotVenta: "1,00%",
                            type: "data"
                        },
                        {
                            concepto: "I.005 - Externos",
                            impEjec: "56.247,62",
                            impPend: "32.915,32",
                            impTot: "89.162,94",
                            percTotCost: "0,39%",
                            percTotalCD: "0,40%",
                            percTotVenta: "0,35%",
                            type: "data"
                        },
                        {
                            concepto: "TOTAL GASTOS GESTIÓN",
                            impEjec: "766.868,85",
                            impPend: "188.382,65",
                            impTot: "955.251,50",
                            percTotCost: "4,15%",
                            percTotalCD: "4,33%",
                            percTotVenta: "3,79%",
                            type: "total"
                        }, {
                            concepto: "RESULTADO",
                            impEjec: "1.000.000,00",
                            impPend: "500.000,00",
                            impTot: "1.500.000,00",
                            percTotCost: "30,00%",
                            percTotalCD: "50,00%",
                            percTotVenta: "10,00%",
                            type: "total"
                        }


                    ]
                };
                this.getView().setModel(
                    new sap.ui.model.json.JSONModel(oData),
                    "oModelDashboard"
                );
                let dataGraphicBar = structuredClone(oData.Dashboard);
                dataGraphicBar = dataGraphicBar.filter(item => item.type === "data");

                const oGraphicBarData = {
                    labelsData: dataGraphicBar.map(item => item.concepto),
                    labelsBar: [
                        "Importe Ejecutado",
                        "Importe Pendiente",
                        "Importe Total"
                    ],
                    datasetsData: [
                        [
                            dataGraphicBar.map(item => parseFloat(item.impEjec.replace(/\./g, '').replace(',', '.')))
                        ], [
                            dataGraphicBar.map(item => parseFloat(item.impPend.replace(/\./g, '').replace(',', '.')))
                        ], [
                            dataGraphicBar.map(item => parseFloat(item.impTot.replace(/\./g, '').replace(',', '.')))
                        ]
                    ]
                }

                this.getView().setModel(
                    new JSONModel(oGraphicBarData),
                    "oModelGraphicBar"
                );
            }


        });
    });
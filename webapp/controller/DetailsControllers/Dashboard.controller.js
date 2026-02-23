sap.ui.define([
    "masterindirectos/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    'sap/m/MessageToast'

],
    function (BaseController, JSONModel, MessageToast) {
        "use strict";

        return BaseController.extend("masterindirectos.controller.DetailsControllers.Dashboard", {

            onInit: function () {
                //obtenemos el modelo global de dashboard
                const modelDashboard = this.getGlobalModel("dashboardModel"); 
                const kpi = modelDashboard.getProperty("/kpi")[0];
                
                // 1. COSTE TOTAL
                var oDataCosteTotal = [
                    {
                        ejecutado: kpi.CtotEje,
                        pendiente: kpi.CtotPen,
                        total: kpi.Ctot
                    }
                ];

                // 2. OBRA EJECUTADA NETA
                var oDataObraNeta = [
                    {
                        ejecutado: kpi.OenEje,
                        pendiente: kpi.OenPen,
                        total: kpi.OenTot
                    }
                ];

                // 3. COSTE DIRECTO
                var oDataCosteDirecto = [
                    {
                        ejecutado: kpi.CdirEje,
                        pendiente: kpi.CdirPen,
                        total: kpi.CdirTot
                    }
                ];

                // Creamos un modelo para las los graficos de tartas con los datos obtenidos
                const tartasModel = {
                    labels: ["Ejecutado", "Pendiente"],
                    datasets: [oDataCosteTotal[0], oDataObraNeta[0], oDataCosteDirecto[0]].map(item => ({
                        data: [parseFloat(item.ejecutado), parseFloat(item.pendiente)]
                    }))
                }
                this.getView().setModel(
                    new JSONModel(tartasModel),
                    "oModelTartas"
                );

                // Creamos un modelo para el grafico de barras con los datos obtenidos
                let dataGraphicBar = modelDashboard.getProperty("/resumen");
                dataGraphicBar = dataGraphicBar.filter(item => item.Post1 && item.Post1 !== "RESULTADO");

                const oGraphicBarData = {
                    labelsData: dataGraphicBar.map(item => item.Post1),
                    labelsBar: [
                        "Importe Ejecutado",
                        "Importe Pendiente",
                        "Importe Total"
                    ],
                    datasetsData: [
                        [
                            dataGraphicBar.map(item => parseFloat(item.ImpEje))
                        ], [
                            dataGraphicBar.map(item => parseFloat(item.ImpPen))
                        ], [
                            dataGraphicBar.map(item => parseFloat(item.ImpTot))
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
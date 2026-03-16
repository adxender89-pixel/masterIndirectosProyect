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
                this.setInitData();
            },

            setInitData: async function () {
                const dashBoardData = await this.getDashboardData();
                Object.keys(dashBoardData.NavKpisIndirectos.results[0]).forEach(key => {
                    if (!isNaN(parseFloat(dashBoardData.NavKpisIndirectos.results[0][key])) && isFinite(dashBoardData.NavKpisIndirectos.results[0][key])) {
                        dashBoardData.NavKpisIndirectos.results[0][key] = this.formatDecimales(dashBoardData.NavKpisIndirectos.results[0][key], dashBoardData.EvDecimales, ",", ".");
                    }
                });
                dashBoardData.NavResumenIndirectos.results.map(el=>{
                    el.ImpEje = this.formatDecimales(el.ImpEje, dashBoardData.EvDecimales, ",", ".")
                    el.ImpPen = this.formatDecimales(el.ImpPen, dashBoardData.EvDecimales, ",", ".")
                    el.ImpTot = this.formatDecimales(el.ImpTot, dashBoardData.EvDecimales, ",", ".")
                })
                const dashboardModel = new JSONModel({
                    kpi: dashBoardData.NavKpisIndirectos.results,
                    resumen: dashBoardData.NavResumenIndirectos.results,
                    decimales: dashBoardData.EvDecimales,
                    NavMasterLt: dashBoardData.NavMasterLt.results
                });

                this.setGlobalModel(dashboardModel, "dashboardModel");

                const kpi = dashboardModel.getProperty("/kpi")[0];

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

                // Creamos un modelo para el grafico de barras con los datos obtenidos
                let dataGraphicBar = dashboardModel.getProperty("/resumen");
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
                    new JSONModel(tartasModel),
                    "oModelTartas"
                );

                this.getView().setModel(
                    new JSONModel(oGraphicBarData),
                    "oModelGraphicBar"
                );

                this.renderGraphics();
            
            },


            getDashboardData: async function () {
                return this.post(this.getGlobalModel("mainService"), "/AccesoIndirectosSet", {
                    NavSelProyecto: [
                        this.getGlobalModel("appData").getData().tramo
                    ],
                    NavMensajes: [],
                    NavKpisIndirectos: [],
                    NavResumenIndirectos: [],
                    NavMasterLt: []
                }, {
                    headers: {
                        ambito: this.getGlobalModel("appData").getData().userData.initialNode,
                        lang: this.getGlobalModel("appData").getData().userData.AplicationLangu,
                        norma: this.getGlobalModel("normModel").getData().norma || "",
                    }
                }).then(function (response) {
                    return response;
                }.bind(this));
            },

            renderGraphics: function () {
                //los graficos son un poco especialitos y necesitan un pequeño delay para renderizarse correctamente, si no se renderizan con los datos actualizados
                setTimeout(() => {
                    this.getView().invalidate();
                }, 500);
            }


        });
    });
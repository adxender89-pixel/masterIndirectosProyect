sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/table/Column",
    "sap/m/Input",
    "sap/m/Button",
    "sap/m/Label",
    "masterindirectos/controller/BaseController",
    "masterindirectos/model/formatter"
], function (
    JSONModel,
    Column,
    Input,
    Button,
    Label,
    BaseController,
    formatter
) {
    "use strict";

    return BaseController.extend("masterindirectos.controller.DetailsControllers.Dashboard", {
        /**
                  * Se inicializa el controlador del Dashboard y se invoca la carga inicial de datos.
                  */
        onInit: function () {
            // Se obtiene y configura el modelo global del dashboard.
            this.setInitData();
        },

        /**
         * Se inicializa el modelo del dashboard realizando la llamada al backend.
         * Se formatean los valores, se gestiona la versión activa y se construyen
         * los modelos de gráficos con los datos obtenidos.
         */
        setInitData: async function () {
            const dashBoardData = await this.getDashboardData();
            // Se formatean los valores numéricos de los KPIs aplicando los decimales configurados en el sistema.
            Object.keys(dashBoardData.NavKpisIndirectos.results[0]).forEach(key => {
                if (!isNaN(parseFloat(dashBoardData.NavKpisIndirectos.results[0][key])) && isFinite(dashBoardData.NavKpisIndirectos.results[0][key])) {
                    dashBoardData.NavKpisIndirectos.results[0][key] = this.formatDecimales(dashBoardData.NavKpisIndirectos.results[0][key], dashBoardData.EvDecimales, ",", ".");
                }
            });
            // Se formatean los importes del resumen aplicando la misma lógica de decimales.
            dashBoardData.NavResumenIndirectos.results.map(el => {
                el.ImpEje = this.formatDecimales(el.ImpEje, dashBoardData.EvDecimales, ",", ".");
                el.ImpPen = this.formatDecimales(el.ImpPen, dashBoardData.EvDecimales, ",", ".");
                el.ImpTot = this.formatDecimales(el.ImpTot, dashBoardData.EvDecimales, ",", ".");
            });

            // Se determina cuál es la versión activa dentro de los datos obtenidos antes de crear el modelo.
            let sVersionActiva = "";
            const aVersiones = dashBoardData.NavLtVersiones.results;

            // Se verifica que el arreglo de versiones exista y contenga elementos.
            if (aVersiones && aVersiones.length > 0) {
                // Se identifica la versión marcada activamente con el indicador "X".
                const oVersionX = aVersiones.find(v => v.Activo === "X");
                if (oVersionX) {
                    sVersionActiva = oVersionX.Version;
                }
            }

            // Se persiste el listado de versiones y la clave activa en el modelo global de la aplicación.
            this.getGlobalModel("appData").setProperty("/NavLtVersiones", aVersiones);
            let sCurrent = this.getGlobalModel("appData").getProperty("/sVersionActiva");

            if (!sCurrent) {
                this.getGlobalModel("appData").setProperty("/sVersionActiva", sVersionActiva);
            }
            // Se construye el modelo global del dashboard con todos los datos procesados.
            const dashboardModel = new JSONModel({
                kpi: dashBoardData.NavKpisIndirectos.results,
                resumen: dashBoardData.NavResumenIndirectos.results.sort((a, b) => {
                            const valA = a.PhPspnr || "";
                            const valB = b.PhPspnr || "";
                            const post1A = a.Post1 || "";
                            const post1B = b.Post1 || "";

                            // Definir items que deben ir al final (totales y resultado)
                            const endItems = ["TOTAL GASTOS GESTIÓN", "RESULTADO"];
                            const isEndA = endItems.some(item => post1A.includes(item));
                            const isEndB = endItems.some(item => post1B.includes(item));

                            // Si ambos son items finales, mantener su orden
                            if (isEndA && isEndB) {
                                return post1A.localeCompare(post1B);
                            }

                            // Si A es item final, debe ir después de B
                            if (isEndA) return 1;
                            
                            // Si B es item final, debe ir después de A
                            if (isEndB) return -1;

                            // Definir el orden especial: Personal, Financieros, Resto deben ir después de I.003
                            const specialItems = ["Personal", "Financieros", "Resto"];
                            const isSpecialA = specialItems.includes(post1A);
                            const isSpecialB = specialItems.includes(post1B);

                            // Si ambos son especiales, mantener el orden Personal -> Financieros -> Resto
                            if (isSpecialA && isSpecialB) {
                                return specialItems.indexOf(post1A) - specialItems.indexOf(post1B);
                            }

                            // Si A es especial y B tiene PhPspnr "I.003", A debe ir después
                            if (isSpecialA && valB.includes("I.003")) {
                                return 1;
                            }

                            // Si B es especial y A tiene PhPspnr "I.003", B debe ir después
                            if (isSpecialB && valA.includes("I.003")) {
                                return -1;
                            }

                            // Si A es especial y B tiene PhPspnr distinto de I.003, A debe ir después de I.003 pero antes de I.004+
                            if (isSpecialA && valB && !valB.includes("I.003")) {
                                return valB.includes("I.004") || valB > "I.003" ? -1 : 1;
                            }

                            // Si B es especial y A tiene PhPspnr distinto de I.003
                            if (isSpecialB && valA && !valA.includes("I.003")) {
                                return valA.includes("I.004") || valA > "I.003" ? 1 : -1;
                            }

                            // Ordenamiento normal por PhPspnr para el resto de casos
                            return valA.localeCompare(valB);
                        }),
                decimales: dashBoardData.EvDecimales,
                NavMasterLt: dashBoardData.NavMasterLt.results,
                NavLsObra: dashBoardData.NavLsObra.results,
            });
            // Se registra el modelo como global para habilitar su acceso desde otras vistas.
            this.setGlobalModel(dashboardModel, "dashboardModel");

            //  Se persisten las fechas clave del tramo activo en appData para que otras vistas
            //  como Corrientes puedan leerlas sin depender del dashboardModel.
            var sFreal = (dashBoardData.NavMasterLt.results[0] || {}).Freal || "";
            var sFrealiniobra = (dashBoardData.NavLsObra.results[0] || {}).Frealiniobra || "";
            var sFrealfinobra = (dashBoardData.NavLsObra.results[0] || {}).Frealfinobra || "";
            var sFrealsist = (dashBoardData.NavMasterLt.results[0] || {}).Frealsist || "";


            this.getGlobalModel("appData").setProperty("/Freal", sFreal);
            this.getGlobalModel("appData").setProperty("/Frealiniobra", sFrealiniobra);
            this.getGlobalModel("appData").setProperty("/Frealfinobra", sFrealfinobra);
            this.getGlobalModel("appData").setProperty("/Frealsist", sFrealsist);

            const kpi = dashboardModel.getProperty("/kpi")[0];

            // 1. Se preparan los datos para el gráfico de Coste Total.
            var oDataCosteTotal = [{
                ejecutado: kpi.CtotEje,
                pendiente: kpi.CtotPen,
                total: kpi.Ctot
            }];

            // 2. Se preparan los datos para el gráfico de Obra Ejecutada Neta.
            var oDataObraNeta = [{
                ejecutado: kpi.OenEje,
                pendiente: kpi.OenPen,
                total: kpi.OenTot
            }];

            // 3. Se preparan los datos para el gráfico de Coste Directo.
            var oDataCosteDirecto = [{
                ejecutado: kpi.CdirEje,
                pendiente: kpi.CdirPen,
                total: kpi.CdirTot
            }];

            // Se instancia el modelo para los gráficos de tipo tarta (Pie Charts).
            const tartasModel = {
                labels: ["Ejecutado", "Pendiente"],
                datasets: [oDataCosteTotal[0], oDataObraNeta[0], oDataCosteDirecto[0]].map(item => ({
                    data: [parseFloat(item.ejecutado), parseFloat(item.pendiente)]
                }))
            };
            let modelUser = this.getGlobalModel("appData").getData().userData;
            let currencyFormat = modelUser.CurrencyFormat;
            let thousandSeparator = currencyFormat.charAt(0)
            let decimalSeparator = currencyFormat.charAt(1)

            // Se filtra la información del resumen para construir el modelo del gráfico de barras.
            let dataGraphicBar = dashboardModel.getProperty("/resumen");
            // dataGraphicBar = dataGraphicBar.filter(item => item.Post1 && item.Post1 !== "RESULTADO");
            dataGraphicBar = dataGraphicBar.filter(item => !!parseFloat(item.Psphi));

            const oGraphicBarData = {
                labelsData: dataGraphicBar.map(item => item.Post1),
                labelsBar: [
                    "Importe Ejecutado",
                    "Importe Pendiente",
                    "Importe Total"
                ],
                datasetsData: [
                    [
                        dataGraphicBar.map(item => parseFloat(item.ImpEje.replaceAll(thousandSeparator, "").replace(decimalSeparator, ".")))
                    ], [
                        dataGraphicBar.map(item => parseFloat(item.ImpPen.replaceAll(thousandSeparator, "").replace(decimalSeparator, ".")))
                    ], [
                        dataGraphicBar.map(item => parseFloat(item.ImpTot.replaceAll(thousandSeparator, "").replace(decimalSeparator, ".")))
                    ]
                ]
            }
            // Se asignan los modelos de datos gráficos a la vista para habilitar su renderizado.
            this.getView().setModel(new JSONModel(tartasModel), "oModelTartas");
            this.getView().setModel(new JSONModel(oGraphicBarData), "oModelGraphicBar");

            // Se fuerza la actualización y dibujado de los gráficos en la interfaz.
            this.renderGraphics();
        },
        /**
                   * Se realiza la petición POST al servicio OData para obtener los datos integrales del Dashboard.
                   * @returns {Promise} Promesa con la respuesta del servidor.
                   */
        getDashboardData: async function () {
            var oAppData = this.getGlobalModel("appData");
            var aVersiones = oAppData.getProperty("/NavLtVersiones") || [];
            var sVersion = oAppData.getProperty("/sVersionActiva");

            var oVersionSeleccion = aVersiones.find(v => v.Version === sVersion);

            return this.post(this.getGlobalModel("mainService"), "/AccesoIndirectosSet", {
                NavSelProyecto: [
                    oAppData.getData().tramo
                ],
                NavMensajes: [],
                NavKpisIndirectos: [],
                NavResumenIndirectos: [],
                NavMasterLt: [],
                NavLsObra: [],
                NavLtVersiones: oVersionSeleccion ? [oVersionSeleccion] : []
            },
                {
                    headers: {
                        ambito: this.getGlobalModel("appData").getData().userData.initialNode,
                        lang: this.getGlobalModel("appData").getData().userData.AplicationLangu,
                        norma: this.getGlobalModel("normModel").getData().norma || "",
                    }
                }).then(function (response) {
                    // Verificar si hay mensajes de error en la respuesta
                    var aMensajes = response.NavMensajes?.results || [];
                    var aMensajesError = aMensajes.filter(function(mensaje) {
                        return mensaje.Tipo === "E";
                    });

                    if (aMensajesError.length > 0) {
                        this.createMessageDialog({
                            title: this.getTranslatedText("ERROR"),
                            textAccept: this.getTranslatedText("ACEPTAR"),
                            messages: aMensajesError.map(function(mensaje) {
                            return {
                                text: mensaje.Mensaje || mensaje.Message || mensaje.text || "",
                                type: "Error"
                            };
                        })
                        });
                    }
                    // 1. Extraemos los KPIs de la respuesta 
                    const token = response?.EvToken;
                    oAppData.setProperty("/EvToken", token);
                    var aKpis = response.NavKpisIndirectos.results[0] || [];

                    // 2. Lo guardamos en el modelo global appData
                    oAppData.setProperty("/NavKpisIndirectos", aKpis);
                    return response;
                }.bind(this));
        },
        /**
            * Se fuerza el redibujado de la vista para asegurar la correcta visualización de los gráficos.
            */
        renderGraphics: function () {
            // Se aplica un retraso mínimo mediante temporizador para garantizar que los gráficos 
            // se rendericen con el modelo de datos completamente actualizado.
            setTimeout(() => {
                this.getView().invalidate();
            }, 500);
        }
    });
});
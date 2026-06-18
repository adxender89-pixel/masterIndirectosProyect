sap.ui.define(
    [
        "../BaseController",
        "sap/ui/model/json/JSONModel"
    ],
    function (BaseController, JSONModel) {
        "use strict";

        return BaseController.extend("zindirect_costs.controller.DialogsControlers.CambiarMaster", {

            /**
             * Se inicializa el controlador.
             * El modelo se construye aquí (no en onAfterRendering) porque el Dialog
             * es un popup y no participa en el ciclo de renderizado estándar de la vista.
             */
            onInit: function () {
                var oViewData = this.getView().getViewData();
                var options = oViewData && oViewData.options ? oViewData.options : {};

                // Modelo con filtros por defecto: ambos checkboxes activos,
                // fechas al inicio y fin del año en curso.
                var oModel = new JSONModel({
                    master: [],
                    filter: {
                        mt: true,
                        mf: true,
                        fechaini: new Date(new Date().getFullYear(), 0, 1),
                        fechafin: new Date(new Date().getFullYear(), 11, 31)
                    },
                    ejercicios: [],
                    periodos: []
                });
                oModel.setSizeLimit(9007199254740990);
                this.getView().setModel(oModel, "modelMaster");

                // Construir lista de ejercicios a partir de masterOfic + lastCh
                var aMasterOfic = options.masterOfic || [];
                var sLastCh = options.lastCh || "";
                var aEjercicios = [{ key: "", text: "" }];

                for (var i = 0; i < aMasterOfic.length; i++) {
                    var oMaster = aMasterOfic[i];
                    if (sLastCh && oMaster.Version && oMaster.Version.substr(0, 1) === sLastCh) {
                        aEjercicios.push({
                            key: oMaster.Pofic ? oMaster.Pofic.substr(0, 4) : "",
                            text: oMaster.Pofic ? oMaster.Pofic.substr(0, 4) : ""
                        });
                    }
                }

                // Fallback: si no hay datos de masterOfic, usar el año actual
                if (aEjercicios.length === 1) {
                    var iYear = new Date().getFullYear();
                    aEjercicios.push({ key: String(iYear), text: String(iYear) });
                }

                aEjercicios = this.eliminarDuplicadosPorKey(aEjercicios);
                oModel.setProperty("/ejercicios", aEjercicios);

                // Poblar periodos con todos los meses (01-12) desde el inicio
                var aPeriodos = [];
                for (var k = 1; k <= 12; k++) {
                    var sMes = k < 10 ? "0" + k : String(k);
                    aPeriodos.push({ key: sMes, text: this._getMonthName(sMes) });
                }
                oModel.setProperty("/periodos", aPeriodos);
            },

            /**
             * Convierte un código de mes numérico ("01".."12") en el nombre del mes
             * en el idioma de la aplicación (actualmente español).
             * @param {string} sMes - Código del mes ("01", "02", ..., "12")
             * @returns {string} Nombre del mes o el propio código si no se reconoce
             */
            _getMonthName: function (sMes) {
                //   Se obtiene el nombre completo del mes via
                // sap.ui.core.format.DateFormat para que respete el idioma
                // activo de UI5 (ES/EN/FR), en lugar del mapa hardcoded en
                // castellano. Se construye una fecha del anyo 2000 con el
                // mes solicitado y se formatea con patron "MMMM".  
                var iMes = parseInt(sMes, 10);
                if (isNaN(iMes) || iMes < 1 || iMes > 12) {
                    return sMes;
                }
                var oMonthFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "MMMM" });
                return oMonthFormat.format(new Date(2000, iMes - 1, 1));
                //  
            },

            /**
             * Elimina duplicados de un array de objetos comparando por la propiedad "key".
             * @param {Array} aArray - Array de objetos con propiedad "key"
             * @returns {Array} Nuevo array sin duplicados
             */
            eliminarDuplicadosPorKey: function (aArray) {
                var aUnique = [];
                aArray.forEach(function (oItem) {
                    var bExiste = aUnique.some(function (oExisting) {
                        return oExisting.key === oItem.key;
                    });
                    if (!bExiste) {
                        aUnique.push(oItem);
                    }
                });
                return aUnique;
            },

            /**
             * Actualiza la lista de periodos al cambiar el ejercicio seleccionado.
             * Si hay datos en masterOfic, filtra los periodos del año elegido.
             * En caso contrario, muestra todos los meses (01-12).
             */
            onChangeEjer: function () {
                var oViewData = this.getView().getViewData();
                var aMasterOfic = (oViewData && oViewData.options && oViewData.options.masterOfic) || [];
                var oModel = this.getView().getModel("modelMaster");
                if (!oModel) { return; }

                var sAnio = oModel.getProperty("/filter/ejer");
                var aPeriodos = [];

                if (sAnio && sAnio !== "" && aMasterOfic.length > 0) {
                    var that = this;
                    aPeriodos = aMasterOfic
                        .filter(function (oItem) {
                            return oItem.Pofic && oItem.Pofic.startsWith(sAnio);
                        })
                        .map(function (oMonth) {
                            var sMes = oMonth.Pofic ? oMonth.Pofic.substr(4) : "";
                            return { key: sMes, text: that._getMonthName(sMes) };
                        });
                    aPeriodos = this.eliminarDuplicadosPorKey(aPeriodos);
                }

                // Fallback a 01-12 con nombres de mes si no hay periodos filtrados
                if (aPeriodos.length === 0) {
                    for (var n = 1; n <= 12; n++) {
                        var sMesDef = n < 10 ? "0" + n : String(n);
                        aPeriodos.push({ key: sMesDef, text: this._getMonthName(sMesDef) });
                    }
                }

                oModel.setProperty("/periodos", aPeriodos);
            },

            /** Cierra el diálogo sin seleccionar nada (botón Volver). */
            onVolverMaster: function () {
                this.onClose();
            },

            /**
             * Ejecuta la búsqueda de masters con los filtros activos.
             * Transforma los filtros al formato que espera el backend y llama
             * al endpoint /MasterSearchSet mediante this.post().
             */
            onSearchMaster: async function () {
                var oModel = this.getView().getModel("modelMaster");
                if (!oModel) { return; }

                // Copiar filtros para no mutar el modelo directamente
                var oFilter = Object.assign({}, oModel.getProperty("/filter"));
                var oAppData = this.getGlobalModel("appData")
                    ? this.getGlobalModel("appData").getData()
                    : {};

                // --- Transformar filtro Master Oficial ---
                if (!oFilter.mf) {
                    oFilter.mf = "";
                    delete oFilter.ejer;
                    delete oFilter.mes;
                } else {
                    oFilter.mf = "X";
                }

                // --- Transformar filtro Master Trabajo ---
                if (!oFilter.mt) {
                    oFilter.mt = "";
                    delete oFilter.desctrab;
                    delete oFilter.fechaini;
                    delete oFilter.fechafin;
                } else {
                    oFilter.mt = "X";
                    var oDateFmt = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "YYYYMMdd" });
                    if (oFilter.fechaini) {
                        var oFechaIni = oFilter.fechaini instanceof Date ? oFilter.fechaini : new Date(oFilter.fechaini);
                        oFilter.fechaini = oDateFmt.format(oFechaIni);
                    }
                    if (oFilter.fechafin) {
                        var oFechaFin = oFilter.fechafin instanceof Date ? oFilter.fechafin : new Date(oFilter.fechafin);
                        oFilter.fechafin = oDateFmt.format(oFechaFin);
                    }
                }

                try {
                    var oPayload = {
                        "NavClase": [],
                        "NavMasterBusq": []
                    };

                    var oHeaders = {
                        headers: Object.assign(
                            {
                                ambito: (oAppData.userData && oAppData.userData.initialNode) || "",
                                lang: (oAppData.userData && oAppData.userData.AplicationLangu) || "ES",
                                token: oAppData.EvToken || ""
                            },
                            oFilter
                        )
                    };

                    var oResponse = await this.post(
                        this.getGlobalModel("mainService"),
                        "/MasterSearchSet",
                        oPayload,
                        oHeaders
                    );

                    // Verificar mensajes de error del backend
                    var aMensajesError = ((oResponse && oResponse.NavMensajes && oResponse.NavMensajes.results) || [])
                        .filter(function (m) { return m.Tipo === "E"; });

                    if (aMensajesError.length > 0) {
                        this.createMessageDialog({
                            title: this.getTranslatedText("ERROR"),
                            textAccept: this.getTranslatedText("ACEPTAR"),
                            messages: aMensajesError.map(function (m) {
                                return { text: m.Mensaje || m.Message || "", type: "Error" };
                            })
                        });
                        return;
                    }

                    // Limpiar __metadata y cargar resultados en el modelo
                    var aMasters = ((oResponse && oResponse.NavMasterBusq && oResponse.NavMasterBusq.results) || [])
                        .map(function (oRow) {
                            var oClone = Object.assign({}, oRow);
                            delete oClone.__metadata;
                            return oClone;
                        });

                    oModel.setProperty("/master", aMasters);
                    oModel.refresh(true);

                } catch (error) {
                    sap.m.MessageBox.error(
                        (this.getTranslatedText("ERROR") || "Error") + ": " + (error.message || error)
                    );
                }
            },

            /** Resetea todos los filtros y vacía la tabla de resultados. */
            onClearMaster: function () {
                var oModel = this.getView().getModel("modelMaster");
                if (!oModel) { return; }

                oModel.setProperty("/filter", {
                    mt: false,
                    mf: false,
                    fechaini: new Date(new Date().getFullYear(), 0, 1),
                    fechafin: new Date(new Date().getFullYear(), 11, 31)
                });
                oModel.setProperty("/master", []);
            },

            /**
             * Acepta el master seleccionado en la tabla.
             * Si no hay ninguna fila seleccionada, muestra un mensaje de error.
             */
            onAccept: function () {
                var oTable = this.byId("tableCambiarMasterDialog");
                if (!oTable) { return; }

                var iIndex = oTable.getSelectedIndex();

                if (iIndex === -1) {
                    this.createMessageDialog({
                        title: this.getTranslatedText("ERROR") || "Error",
                        textAccept: this.getTranslatedText("ACEPTAR") || "Aceptar",
                        messages: [{
                            text: this.getTranslatedText("ERROR_SELECCIONE_LINEA") || "Seleccione un master de la lista.",
                            type: "Error"
                        }]
                    });
                    return;
                }

                var oModel = this.getView().getModel("modelMaster");
                var oSelectedMaster = oModel.getData().master[iIndex];

                var oViewData = this.getView().getViewData();
                if (oViewData && typeof oViewData.onAccept === "function") {
                    oViewData.onAccept(oSelectedMaster);
                }

                this.onClose();
            },

            /** Cierra el diálogo sin realizar ninguna acción. */
            onClose: function () {
                var oViewData = this.getView().getViewData();
                if (oViewData && typeof oViewData.close === "function") {
                    oViewData.close();
                }
            },

            /**
             * Formatea una fecha OData (/Date(timestamp)/) o Date nativo
             * al formato dd/MM/yyyy para mostrar en la columna Fecha de la tabla.
             * @param {string|Date} vDate - Valor de fecha a formatear
             * @returns {string} Fecha formateada o cadena vacía si no hay valor
             */
            formatFecha: function (vDate) {
                if (!vDate) { return ""; }
                try {
                    var oFmt = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "dd/MM/yyyy" });
                    var oDate;
                    if (vDate instanceof Date) {
                        oDate = vDate;
                    } else {
                        var oMatch = /\/Date\((\d+)\)\//.exec(vDate);
                        oDate = oMatch ? new Date(parseInt(oMatch[1], 10)) : new Date(vDate);
                    }
                    if (oDate && !isNaN(oDate.getTime())) {
                        return oFmt.format(oDate);
                    }
                } catch (e) {
                    // silencioso
                }
                return "";
            }

        });
    }
);

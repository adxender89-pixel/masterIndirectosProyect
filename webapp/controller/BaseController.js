sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/model/json/JSONModel",
    'sap/m/MessageItem',
    "sap/m/Input",
    'sap/m/MessageView',
    "sap/m/MessageToast",
    'sap/ui/core/IconPool',
    'sap/m/Button',
    'sap/m/Dialog',
    'sap/m/Bar',
    "sap/ui/core/message/Message",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/mvc/XMLView",
    "sap/m/Label",
    "sap/m/Text",
    "sap/m/VBox"
], function (
    Controller,
    History,
    JSONModel,
    MessageItem,
    Input,
    MessageView,
    MessageToast,
    IconPool,
    Button,
    Dialog,
    Bar,
    Message,
    Filter,
    FilterOperator
) {
    "use strict";

    return Controller.extend("masterindirectos.controller.BaseController", {
        /** Acceso al enrutador de la aplicación */
        getRouter: function () {
            return this.getOwnerComponent().getRouter();
        },

        /** Acceso simplificado a modelos de vista */
        getModel: function (sName) {
            return this.getView().getModel(sName);
        },

        /** Establece modelos a nivel de Componente (Globales) */
        setGlobalModel: function (oModel, sName) {
            return this.getOwnerComponent().setModel(oModel, sName);
        },

        /** Obtiene modelos del Componente (Globales) */
        getGlobalModel: function (sName) {
            return this.getOwnerComponent().getModel(sName);
        },

        /** Establece modelos locales a la vista */
        setModel: function (oModel, sName) {
            return this.getView().setModel(oModel, sName);
        },

        /** Acceso a los textos traducibles */
        getResourceBundle: function () {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
        },

        /** Gestiona la navegación hacia atrás en la historia */
        onNavBack: function () {
            var sPreviousHash = History.getInstance().getPreviousHash();

            if (sPreviousHash !== undefined) {
                history.go(-1);
            } else {
                this.getRouter().navTo("master", {}, true);
            }
        },

        /**
         * Muestra un diálogo con mensajes de retorno de tipo /CMSBE/BO_RETURN.
         */
        showReturnEntity: function (aResults) {
            var that = this;
            new Promise((resolve, reject) => {
                if (!that.oMessageView) {
                    var oBundle = that.getResourceBundle();

                    var oMessageTemplate = new MessageItem({
                        type: '{type}',
                        title: '{title}'
                    });

                    var oBackButton = new Button({
                        icon: IconPool.getIconURI("nav-back"),
                        visible: false,
                        press: function () {
                            that.oMessageView.navigateBack();
                            that.setVisible(false);
                        }
                    });

                    that.oMessageView = new MessageView({
                        showDetailsPageHeader: false,
                        itemSelect: function () {
                            oBackButton.setVisible(true);
                        },
                        items: {
                            path: "/",
                            template: oMessageTemplate
                        }
                    });

                    that.oDialogReturn = new Dialog({
                        resizable: true,
                        content: that.oMessageView,
                        state: 'Information',
                        beginButton: new Button({
                            press: function () {
                                this.getParent().close();
                                resolve();
                            },
                            text: oBundle.getText("btnClose")
                        }),
                        customHeader: new Bar({
                            titleAlignment: sap.m.TitleAlignment.Auto,
                            contentMiddle: [
                                new Text({ text: oBundle.getText("msgReturnMessages") })
                            ],
                            contentLeft: [oBackButton]
                        }),
                        contentHeight: "50%",
                        contentWidth: "50%",
                        verticalScrolling: false
                    });
                }

                var aMessages = [];
                for (var i = 0; i < aResults.length; i++) {
                    var sType;
                    switch (aResults[i].Type) {
                        case "E": sType = 'Error'; break;
                        case "W": sType = 'Warning'; break;
                        case "S": sType = 'Success'; break;
                        case "I": sType = "Information"; break;
                        default: sType = 'None';
                    }
                    aMessages.push({ type: sType, title: aResults[i].Message });
                }

                var oModel = new JSONModel();
                oModel.setData(aMessages);
                that.oMessageView.setModel(oModel);
                oModel.refresh();
                that.oMessageView.navigateBack();
                that.oDialogReturn.open();
            });

            // Inicialización de tablas dinámicas tras mostrar el retorno
            this.setupDynamicTreeTable("TreeTableBasic");
            this.setupDynamicTreeTable("TreeTableInmov");

            this.getView().attachEventOnce("afterRendering", function () {
                this.createYearColumns("TreeTableBasic", new Date().getFullYear(), 3, "");
                this.createYearColumns("TreeTableInmov", new Date().getFullYear(), 3, "Inmov");
            }.bind(this));
        },

        /**
         * Configura las propiedades y eventos necesarios para el funcionamiento de una TreeTable.
         */
        setupDynamicTreeTable: function (sTableId) {
            var oTable = this.byId(sTableId);
            if (!oTable) {
                console.error("TreeTable no encontrada:", sTableId);
                return;
            }

            oTable.attachFirstVisibleRowChanged(function (oEvent) {
                this._onScrollLike(oEvent, sTableId);
            }.bind(this));

            oTable.setFixedColumnCount(2);

            if (this.byId("colMonths")) this.byId("colMonths").setVisible(false);
            if (this.byId("colNew")) this.byId("colNew").setVisible(false);

            // Delegado de teclado
            if (!this._arrowDelegate) {
                this._arrowDelegate = {
                    onkeydown: function (oEvent) {
                        this._onInputKeyDown(oEvent);
                    }.bind(this)
                };
            }

            var fnAttachDelegates = function () {
                oTable.getRows().forEach(function (oRow) {
                    oRow.getCells().forEach(function (oCell) {
                        var oInput = this._recursiveGetInput(oCell);
                        if (oInput) {
                            oInput.removeEventDelegate(this._arrowDelegate);
                            oInput.addEventDelegate(this._arrowDelegate);
                        }
                    }.bind(this));
                }.bind(this));
            }.bind(this);

            oTable.addEventDelegate({
                onAfterRendering: function () {
                    if (!this._arrowDelegate) {
                        this._arrowDelegate = {
                            onkeydown: function (oEvent) {
                                this._onInputKeyDown(oEvent);
                            }.bind(this)
                        };
                    }

                    var aRows = oTable.getRows();

                    aRows.forEach(function (oRow) {
                        oRow.getCells().forEach(function (oCell) {
                            // 🔧 FIX: Usa _recursiveGetInput invece di controllare direttamente
                            var oInput = this._recursiveGetInput(oCell);
                            if (oInput) {
                                oInput.removeEventDelegate(this._arrowDelegate);
                                oInput.addEventDelegate(this._arrowDelegate);
                            }
                        }.bind(this));
                    }.bind(this));

                    this._applyCabeceraStyle();
                }.bind(this)
            });

            if (!oTable._rowsDelegateAttached) {
                oTable.attachEvent("rowsUpdated", function () {
                    fnAttachDelegates();
                });
                oTable._rowsDelegateAttached = true;
            }

            var oViewModel = new sap.ui.model.json.JSONModel({
                dynamicRowCount: 10
            });
            this.getView().setModel(oViewModel, "viewModel");

            $(window).resize(function () {
                this._calculateDynamicRows();
            }.bind(this));

            this._calculateDynamicRows();
        },
        /**
         * Crea dinámicamente columnas de años con un botón en la cabecera para ver los meses.
         */
        createYearColumns: function (sTableId, iStartYear, iHowMany, sModelName, iSkipFields) {
            var oTable = this.byId(sTableId);
            if (!oTable) return;

            var aColumns = oTable.getColumns();
            for (var i = aColumns.length - 1; i >= 0; i--) {
                var oCol = aColumns[i];
                if (oCol.data("dynamicYear") === true) {
                    oTable.removeColumn(oCol);
                }
            }
            // NON chiudere i mesi quando si ricaricano gli anni
            // this._openedYear = null;

            var iStartFrom = (iSkipFields !== undefined) ? iSkipFields : 13;

            // *** NUOVA PARTE: Colonna Ejecutados per gli anni con formato correcto ***
            var bShowEjecutado = this.byId("idEjecutadoCheckBox") ? this.byId("idEjecutadoCheckBox").getSelected() : false;

            if (bShowEjecutado) {
                var currentYear = new Date().getFullYear();
                var oColEjecAnual = new sap.ui.table.Column({
                    width: "8rem",
                    minWidth: 60,
                    autoResizable: true,
                    label: new sap.m.VBox({
                        alignItems: "Center",
                        renderType: "Bare",
                        width: "100%",
                        items: [
                            new sap.m.Text({
                                text: "2024-" + currentYear
                            }).addStyleClass("sapUiTinyFontSize textoaño"),
                            new sap.m.Label({
                                text: "Ejecutados",
                                design: "Bold",
                                textAlign: "Center",
                                width: "100%"
                            }).addStyleClass("testBold")
                        ]
                    }),
                    template: new sap.m.Text({
                        text: "{ejecutado}",
                        textAlign: "Center",
                        width: "100%"
                    })
                });
                oColEjecAnual.data("dynamicYear", true);
                oColEjecAnual.data("ejecutadosColumn", true);
                oTable.addColumn(oColEjecAnual);
            }
            // *** FINE NUOVA PARTE ***

            var aYears = [];
            for (var i = 0; i < iHowMany; i++) {
                aYears.push(iStartYear + i);
            }

            aYears.forEach(function (iYear, index) {
                var oColumn = new sap.ui.table.Column({
                    width: "8rem",
                    minWidth: 60,
                    autoResizable: true,
                    label: new sap.m.Button({
                        text: iYear.toString(),
                        type: "Transparent",
                        width: "100%",
                        press: function (oEvent) {
                            this.onCreateMonthsTable(oEvent, sTableId, sModelName);
                        }.bind(this)
                    }),
                    template: new sap.m.HBox({
                        renderType: "Bare",
                        width: "100%",
                        items: [
                            new sap.m.Input({
                                width: "100%",
                                textAlign: "Center",
                                value: "{y" + iYear + "}",
                                visible: "{= ${expandible} !== false && !${isGroup} }",
                                liveChange: function (oEvt) {
                                    // ... tutto il codice liveChange ...
                                }
                            }).addStyleClass("sapUiSizeCompact"),
                            new sap.m.Text({
                                width: "100%",
                                textAlign: "Center",
                                visible: "{= ${expandible} === false || ${isGroup} === true }",
                                wrapping: false,
                                text: {
                                    path: "",
                                    formatter: function (oRow) {
                                        if (!oRow || (oRow.expandible !== false && !oRow.isGroup)) return "";
                                        var aKeys = Object.keys(oRow);
                                        var sTargetKey = aKeys[iStartFrom + index];
                                        return sTargetKey ? oRow[sTargetKey] : "";
                                    }
                                }
                            })
                        ]
                    })
                });

                oColumn.data("dynamicYear", true);
                oColumn.data("year", iYear);
                oTable.addColumn(oColumn);
            }.bind(this));

            setTimeout(function () {
                this.setupDynamicTreeTable(sTableId);
            }.bind(this), 0);
        },



        /**
         * Maneja el cambio de año en el selector, ajustando las columnas mostradas dinámicamente.
         */
        onYearChange: function (oEvent) {
            var oSelect = oEvent.getSource(); // El Select
            var aItems = oSelect.getItems();  // Todas las opciones (las 10 anualidades)

            // 1. Se toma el año seleccionado
            var sSelectedYear = parseInt(oEvent.getParameter("selectedItem").getKey(), 10);

            // 2. Se encuentra dinámicamente el último año de la lista (ej. 2025 o 2035)
            var iMaxYearInSelect = parseInt(aItems[aItems.length - 1].getKey(), 10);

            // 3. Se define cuántas columnas se quieren mostrar (en este caso 3)
            var iNumColumns = 3;

            // 4. CÁLCULO DINÁMICO:
            // Si (AñoSeleccionado + 2) supera el año máximo, se debe "retroceder"
            // En la práctica: se empieza como máximo desde (ÚltimoAño - 2)
            var iYearToPass = Math.min(sSelectedYear, iMaxYearInSelect - (iNumColumns - 1));

            // 5. Se crean las columnas
            this.createYearColumns("TreeTableBasic", iYearToPass, iNumColumns);
        },

        /**
         * Actualiza el estado de la tabla tras la expansión o contracción de nodos.
         */
        _refreshAfterToggle: function (sTableId) {
            var oTable = this.byId(sTableId);
            if (!oTable) return;

            this._buildGroupRanges(sTableId);

            this._onScrollLike({
                getParameter: function () {
                    return oTable.getFirstVisibleRow();
                }
            }, sTableId);

            this._applyCabeceraStyle(sTableId);
        },

        /**
         * Aplica estilos CSS específicos a las filas de tipo cabecera para diferenciarlas visualmente.
         */
        _applyCabeceraStyle: function (sTableId) {
            var oTable = sTableId ? this.byId(sTableId) : this.byId("TreeTableBasic");
            var iFirst = oTable.getFirstVisibleRow();
            var aRows = oTable.getRows();

            for (var i = 0; i < aRows.length; i++) {
                var oRow = aRows[i];
                oRow.removeStyleClass("cabeceracolor");
                oRow.removeStyleClass("cabeceracolor-Group");

                var oCtx = oTable.getContextByIndex(iFirst + i);
                if (!oCtx) continue;

                var oObj = oCtx.getObject();
                if (oObj && oObj.cabecera === true) {
                    oRow.addStyleClass("cabeceracolor");
                }
                if (oObj && oObj.expandible === true) {
                    oRow.addStyleClass("cabeceracolor-Group");
                }
            }
        },

        /**
         * Genera las columnas mensuales correspondientes al año seleccionado en la cabecera.
         */
        onCreateMonthsTable: function (oEvent, sTableId, sModelName) {
            console.log("=== INIZIO onCreateMonthsTable ===");

            var oSource = oEvent.getSource();
            var oTable = this.byId(sTableId || "TreeTableBasic");

            var bShowEjecutado = this.byId("idEjecutadoCheckBox") ? this.byId("idEjecutadoCheckBox").getSelected() : false;
            console.log("Checkbox Ejecutado attivo:", bShowEjecutado);

            // Guarda la posición actual del scroll horizontal
            var iCurrentScrollLeft = 0;
            try {
                var oScrollExt = oTable._getScrollExtension();
                if (oScrollExt && oScrollExt.getHorizontalScrollbar()) {
                    iCurrentScrollLeft = oScrollExt.getHorizontalScrollbar().scrollLeft;
                    console.log("Scroll salvato - posizione:", iCurrentScrollLeft);
                }
            } catch (e) {
                console.error("Errore nel salvare lo scroll:", e);
            }

            var sYearText = "";
            var sSourceName = oSource.getMetadata().getName();
            console.log("Source type:", sSourceName);

            if (sSourceName === "sap.m.Button") {
                sYearText = oSource.getText();
                if (isNaN(parseInt(sYearText, 10))) sYearText = oSource.getParent().getItems()[0].getText();
            } else {
                sYearText = String(this._openedYear);
            }

            var sYear = parseInt(sYearText, 10);
            console.log("Anno selezionato:", sYear);
            if (!sYear) return;

            // Si se hace clic en el mismo año, cierra los meses
            if (this._openedYear === sYear && sSourceName === "sap.m.Button") {
                console.log("Chiusura mesi per anno:", sYear);
                this._openedYear = null;

                // Bloquea la tabla durante los cambios
                oTable.setBusy(true);

                var monthColsToRemove = oTable.getColumns().filter(c => c.data("dynamicMonth"));
                console.log("Rimozione colonne mesi:", monthColsToRemove.length);
                monthColsToRemove.forEach(c => oTable.removeColumn(c));

                // Cuando cierra los meses, recrea la columna Ejecutados para los años si el checkbox está activo
                if (bShowEjecutado) {
                    console.log("Ricreazione colonna Ejecutados annuale...");
                    // Elimina eventuales columnas Ejecutados
                    var ejecutadosColsToRemove = oTable.getColumns().filter(c => c.data("ejecutadosColumn"));
                    console.log("Rimozione colonne Ejecutados esistenti:", ejecutadosColsToRemove.length);
                    ejecutadosColsToRemove.forEach(c => oTable.removeColumn(c));

                    // Recrea la columna Ejecutados para los años
                    var iInsertIndex = oTable.getColumns().findIndex(c => c.data("dynamicYear") === true);
                    console.log("Indice inserimento colonna Ejecutados annuale:", iInsertIndex);

                    if (iInsertIndex !== -1) {
                        var currentYear = new Date().getFullYear();
                        var oColEjecAnual = new sap.ui.table.Column({
                            width: "8rem",
                            minWidth: 60,
                            autoResizable: true,
                            label: new sap.m.VBox({
                                alignItems: "Center",
                                renderType: "Bare",
                                width: "100%",
                                items: [
                                    new sap.m.Text({
                                        text: "2024-" + currentYear
                                    }).addStyleClass("sapUiTinyFontSize textoaño"),
                                    new sap.m.Label({
                                        text: "Ejecutados",
                                        design: "Bold",
                                        textAlign: "Center",
                                        width: "100%"
                                    }).addStyleClass("testBold")
                                ]
                            }),
                            template: new sap.m.Text({
                                text: "{ejecutado}",
                                textAlign: "Center",
                                width: "100%"
                            })
                        });
                        oColEjecAnual.data("dynamicYear", true);
                        oColEjecAnual.data("ejecutadosColumn", true);
                        oTable.insertColumn(oColEjecAnual, iInsertIndex);
                        console.log("Colonna Ejecutados annuale inserita all'indice:", iInsertIndex);
                    }
                }

                // Desbloquea la tabla y restaura el scroll
                setTimeout(function () {
                    try {
                        var oScrollExt = oTable._getScrollExtension();
                        if (oScrollExt && oScrollExt.getHorizontalScrollbar()) {
                            oScrollExt.getHorizontalScrollbar().scrollLeft = iCurrentScrollLeft;
                            console.log("Scroll ripristinato (chiusura) a:", iCurrentScrollLeft);
                        }
                    } catch (e) {
                        console.error("Errore nel ripristinare lo scroll (chiusura):", e);
                    }
                    oTable.setBusy(false);
                    console.log("Tabla desbloqueada (chiusura)");
                }.bind(this), 50);

                console.log("=== FINE onCreateMonthsTable (chiusura) ===");
                return;
            }

            // Bloquea la tabla ANTES de hacer cualquier cambio
            oTable.setBusy(true);
            console.log("Tabla bloqueada para insertar columnas");

            // Elimina las columnas de meses existentes Y la columna Ejecutados de los años
            console.log("Apertura nuovi mesi per anno:", sYear);
            var colsToRemove = oTable.getColumns().filter(c => c.data("dynamicMonth") || c.data("ejecutadosColumn"));
            console.log("Rimozione colonne esistenti (mesi + Ejecutados):", colsToRemove.length);
            colsToRemove.forEach(c => oTable.removeColumn(c));

            this._openedYear = sYear;

            var aMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            var currentYear = new Date().getFullYear();
            var currentMonth = new Date().getMonth();

            var iStartIdx = (sYear === currentYear && !bShowEjecutado) ? currentMonth + 1 : 0;
            console.log("Mese di partenza (index):", iStartIdx, "(" + aMonthNames[iStartIdx] + ")");

            var oYearCol = oTable.getColumns().find(c => {
                var lab = c.getLabel();
                var txt = lab.getText ? lab.getText() : (lab.getItems ? lab.getItems()[0].getText() : "");
                return txt === String(sYear);
            });
            var colIndex = oTable.indexOfColumn(oYearCol);
            console.log("Indice colonna anno:", colIndex);

            var iOffset = 0;

            // Columna "Ejecutados" - SOLO si el checkbox está activo
            if (bShowEjecutado) {
                console.log("Creazione colonna Ejecutados mensile...");
                var oColEjec = new sap.ui.table.Column({
                    width: "8rem",
                    label: new sap.m.VBox({
                        alignItems: "Center",
                        renderType: "Bare",
                        width: "100%",
                        items: [
                            new sap.m.Text({
                                text: "2024-" + sYear
                            }).addStyleClass("sapUiTinyFontSize textoaño"),
                            new sap.m.Label({
                                text: "Ejecutados",
                                design: "Bold",
                                textAlign: "Center",
                                width: "100%"
                            }).addStyleClass("testBold")
                        ]
                    }),
                    template: new sap.m.Text({
                        text: "{ejecutado}",
                        textAlign: "Center",
                        width: "100%"
                    })
                });
                oColEjec.data("dynamicMonth", true);
                oColEjec.data("ejecutadosColumn", true);

                var insertPos = colIndex + iOffset;
                console.log("Inserimento colonna Ejecutados all'indice:", insertPos);
                oTable.insertColumn(oColEjec, insertPos);
                iOffset++;
            }

            // Columnas de los meses
            console.log("Creazione colonne mesi da", aMonthNames[iStartIdx], "a Dec...");
            for (var i = iStartIdx; i < 12; i++) {
                var sMonthLabel = aMonthNames[i];
                var iRealIdx = i;
                var bIsPassedMonth = (sYear < currentYear) || (sYear === currentYear && i <= currentMonth);

                var oControlTemplate;

                // Si es un mes pasado y el checkbox está activo, muestra Text con datos ejecutados
                if (bShowEjecutado && bIsPassedMonth) {
                    oControlTemplate = new sap.m.Text({
                        text: "{ej" + sYear + "_" + iRealIdx + "}",
                        textAlign: "Center",
                        width: "100%"
                    }).addStyleClass("sapUiTinyMarginEnd");
                } else {
                    // De lo contrario muestra Input para los meses futuros
                    oControlTemplate = new sap.m.Input({
                        value: "{m" + sYear + "_" + iRealIdx + "}",
                        textAlign: "Center",
                        visible: "{= ${expandible} !== false && !${isGroup} }",
                        change: function (oEvt) {
                            var oInput = oEvt.getSource();
                            var oCtx = oInput.getBindingContext();
                            var oModel = oCtx.getModel();
                            var sPath = oCtx.getPath();

                            oModel.setProperty(
                                sPath + "/m" + sYear + "_" + iRealIdx,
                                oInput.getValue()
                            );
                        }
                    });
                }

                var oColumn = new sap.ui.table.Column({
                    width: "8rem",
                    label: new sap.m.VBox({
                        alignItems: "Center",
                        renderType: "Bare",
                        width: "100%",
                        items: [
                            new sap.m.Text({
                                text: String(sYear)
                            }).addStyleClass("sapUiTinyFontSize textoaño"),

                            (i === iStartIdx) ?
                                new sap.m.Button({
                                    text: sMonthLabel,
                                    type: "Transparent",
                                    width: "100%",
                                    icon: "sap-icon://slim-arrow-right",
                                    iconFirst: false,
                                    press: function (oEv) { this.onCreateMonthsTable(oEv, sTableId); }.bind(this)
                                }).addStyleClass("testBold") :
                                new sap.m.Label({
                                    text: sMonthLabel,
                                    design: "Bold",
                                    textAlign: "Center",
                                    width: "100%"
                                }).addStyleClass("testBold")
                        ]
                    }),
                    template: oControlTemplate
                }).data("dynamicMonth", true);

                var monthInsertPos = colIndex + iOffset + (i - iStartIdx);
                if (i === iStartIdx) {
                    console.log("Inserimento prima colonna mese (" + sMonthLabel + ") all'indice:", monthInsertPos);
                }
                oTable.insertColumn(oColumn, monthInsertPos);
            }

            console.log("Totale colonne mesi inserite:", (12 - iStartIdx));

            // Desbloquea la tabla y restaura el scroll después de insertar todas las columnas
            setTimeout(function () {
                try {
                    var oScrollExt = oTable._getScrollExtension();
                    if (oScrollExt && oScrollExt.getHorizontalScrollbar()) {
                        oScrollExt.getHorizontalScrollbar().scrollLeft = iCurrentScrollLeft;
                        console.log("Scroll ripristinato (apertura) a:", iCurrentScrollLeft);
                    }
                } catch (e) {
                    console.error("Errore nel ripristinare lo scroll (apertura):", e);
                }
                oTable.setBusy(false);
                console.log("Tabla desbloqueada (apertura)");
            }.bind(this), 50);

            console.log("=== FINE onCreateMonthsTable (apertura) ===");
        },




        /**
         * Se ejecuta cuando se selecciona el checkbox de Ejecutado, recargando las columnas mensuales.
         */
        onEjecutadoCheckBoxSelect: function (oEvent) {
            var oTable = this.byId("TreeTableBasic");
            if (!oTable) return;

            var bShowEjecutado = this.byId("idEjecutadoCheckBox").getSelected();
            var currentYear = new Date().getFullYear();

            // Se ci sono mesi aperti, ricaricali per aggiornare la vista
            if (this._openedYear) {
                var sYear = this._openedYear;

                // Rimuovi tutte le colonne dinamiche dei mesi
                oTable.getColumns().filter(c => c.data("dynamicMonth")).forEach(c => oTable.removeColumn(c));

                // Ricrea i mesi con il nuovo stato del checkbox
                var oYearCol = oTable.getColumns().find(c => {
                    var lab = c.getLabel();
                    var txt = lab.getText ? lab.getText() : (lab.getItems ? lab.getItems()[0].getText() : "");
                    return txt === String(sYear);
                });

                if (oYearCol && oYearCol.getLabel()) {
                    this.onCreateMonthsTable({
                        getSource: function () {
                            return {
                                getMetadata: function () {
                                    return { getName: function () { return "sap.m.Label"; } };
                                },
                                getText: function () { return String(sYear); }
                            };
                        }
                    }, "TreeTableBasic");
                }
            } else {
                // Se non ci sono mesi aperti, gestisci solo la colonna Ejecutados degli anni
                // Rimuovi colonne Ejecutados esistenti
                oTable.getColumns().filter(c => c.data("ejecutadosColumn")).forEach(c => oTable.removeColumn(c));

                if (bShowEjecutado) {
                    // 👇 COLONNA EJECUTADOS ANNUALE CON VBOX COME I MESI
                    var iInsertIndex = oTable.getColumns().findIndex(c => c.data("dynamicYear") === true);
                    if (iInsertIndex === -1) iInsertIndex = oTable.getColumns().length;

                    var oColEjecAnual = new sap.ui.table.Column({
                        width: "8rem",
                        minWidth: 60,
                        autoResizable: true,
                        label: new sap.m.VBox({
                            alignItems: "Center",
                            renderType: "Bare",
                            width: "100%",
                            items: [
                                new sap.m.Text({
                                    text: "2024-" + currentYear
                                }).addStyleClass("sapUiTinyFontSize textoaño"),
                                new sap.m.Label({
                                    text: "Ejecutados",
                                    design: "Bold",
                                    textAlign: "Center",
                                    width: "100%"
                                }).addStyleClass("testBold")
                            ]
                        }),
                        template: new sap.m.Text({
                            text: "{ejecutado}",
                            textAlign: "Center",
                            width: "100%"
                        })
                    });
                    oColEjecAnual.data("dynamicYear", true);
                    oColEjecAnual.data("ejecutadosColumn", true);
                    oTable.insertColumn(oColEjecAnual, iInsertIndex);
                }
            }
        },



        /**
         * Lógica de gestión de cabeceras sticky durante el desplazamiento de la tabla.
         */
        _onScrollLike: function (oEvent, sTableId) {
            if (this._ignoreNextScroll) {
                this._ignoreNextScroll = false;
                return;
            }

            var oTable = sTableId ? this.byId(sTableId) : this.byId("TreeTableBasic");
            var oUiModel = this.getView().getModel("ui");

            if (!this._aGroupRanges || !this._aGroupRanges.length) {
                oUiModel.setProperty("/showStickyParent", false);
                oUiModel.setProperty("/showStickyChild", false);
                return;
            }

            var iFirstVisible = oEvent.getParameter("firstVisibleRow");
            var iVisibleCount = oTable.getVisibleRowCount();
            var iLastVisible = iFirstVisible + iVisibleCount - 1;

            var oActiveGroup = null;

            // Busca el grupo de datos correspondiente a la posición actual del scroll
            for (var i = 0; i < this._aGroupRanges.length; i++) {
                var oGroup = this._aGroupRanges[i];
                if (iFirstVisible >= oGroup.start && iFirstVisible <= oGroup.end) {
                    oActiveGroup = oGroup;
                    break;
                }
            }

            if (!oActiveGroup) {
                oUiModel.setProperty("/showStickyParent", false);
                oUiModel.setProperty("/showStickyChild", false);
                return;
            }

            var iParentRow = oActiveGroup.start;
            var iChildRow = oActiveGroup.start + 1;

            var bParentVisible = iParentRow >= iFirstVisible && iParentRow <= iLastVisible;
            var bChildVisible = iChildRow >= iFirstVisible && iChildRow <= iLastVisible;

            // Muestra u oculta los elementos fijos si su contraparte original ya no está en pantalla
            oUiModel.setProperty("/showStickyParent", !bParentVisible);
            oUiModel.setProperty("/showStickyChild", !bChildVisible && !bParentVisible);

            oUiModel.setProperty("/stickyHeaderData", {
                parent: oActiveGroup.data,
                child: oActiveGroup.data.categories[0],
                path: oActiveGroup.path
            });
            this._applyCabeceraStyle(sTableId);
        },

        /**
         * Analiza el modelo de la tabla para definir los rangos de índices de cada grupo de datos.
         */
        _buildGroupRanges: function (sTableId) {
            var oTable = this.byId("TreeTableBasic");
            var oBinding = oTable.getBinding("rows");

            if (!oTable) {
                this._aGroupRanges = [];
                return;
            }

            var iLength = oBinding.getLength();
            var aRanges = [];
            var oCurrentGroup = null;

            for (var i = 0; i < iLength; i++) {
                var oCtx = oTable.getContextByIndex(i);
                if (!oCtx) continue;

                var oObj = oCtx.getObject();
                // Determina el inicio de un nuevo grupo basándose en la existencia de subcategorías
                if (oObj && oObj.categories && Array.isArray(oObj.categories)) {
                    if (oCurrentGroup) {
                        oCurrentGroup.end = i - 1;
                        aRanges.push(oCurrentGroup);
                    }
                    oCurrentGroup = { name: oObj.name, start: i, end: i, data: oObj, path: oCtx.getPath() };
                }
            }

            if (oCurrentGroup) {
                oCurrentGroup.end = iLength - 1;
                aRanges.push(oCurrentGroup);
            }

            this._aGroupRanges = aRanges;
        },

        /**
         * Calcula dinámicamente la cantidad de filas que caben en pantalla según el tamaño de la ventana.
         */
        _calculateDynamicRows: function () {
            var iHeight = window.innerHeight;

            // Basándose en las pruebas:
            // (1050px - 380px) / 32px = ~21 filas
            // (703px - 380px) / 32px = ~10 filas
            var iOffset = 380;
            var iRowHeight = 32;

            var iRows = Math.floor((iHeight - iOffset) / iRowHeight);

            // Seguridad: nunca menos de 5 filas
            if (iRows < 5) { iRows = 5; }

            console.log("Cálculo Dinámico: Ventana " + iHeight + "px -> Filas " + iRows);

            // Actualiza el modelo (asumiendo que el modelo se llama 'viewModel')
            this.getView().getModel("viewModel").setProperty("/dynamicRowCount", iRows);
        },
        /**
         * Filtra categorías recursivamente según una clave específica.
         */
        _filterCategories: function (aCategories, sKey) {
            if (!Array.isArray(aCategories)) return [];

            return aCategories
                .map(function (cat) {
                    var oClone = Object.assign({}, cat);

                    var aFilteredChildren = this._filterCategories(cat.categories || [], sKey);

                    // MATCH directo
                    if (cat.name === sKey) {
                        oClone.categories = cat.categories || [];
                        return oClone;
                    }

                    // MATCH indirecto 
                    if (aFilteredChildren.length > 0) {
                        oClone.categories = aFilteredChildren;
                        return oClone;
                    }

                    return null;
                }.bind(this))
                .filter(Boolean);
        },
        /**
         * Colapsa un grupo desde la cabecera sticky, actualizando la vista de la tabla.
         */
        onCollapseFromHeader: function () {
            var oTable = this.byId("TreeTableBasic");
            var oUiModel = this.getView().getModel("ui");

            var sTargetPath = oUiModel.getProperty("/stickyHeaderData/path");
            if (!sTargetPath) {
                return;
            }

            var oBinding = oTable.getBinding("rows");
            var iLength = oBinding.getLength();
            var iCollapsedIndex = null;

            // Colapsa grupo objetivo
            for (var i = 0; i < iLength; i++) {

                var oCtx = oTable.getContextByIndex(i);

                if (oCtx && oCtx.getPath() === sTargetPath) {

                    if (oTable.isExpanded(i)) {
                        oTable.collapse(i);
                        iCollapsedIndex = i;
                    }
                    break;
                }
            }

            if (iCollapsedIndex === null) {
                return;
            }
            setTimeout(function () {

                this._buildGroupRanges("TreeTableBasic");

                var iFirstVisible = oTable.getFirstVisibleRow();

                this._onScrollLike({
                    getParameter: function (sName) {
                        if (sName === "firstVisibleRow") {
                            return iFirstVisible;
                        }
                    }
                }, "TreeTableBasic");

                var bAnyDetailExpanded = false;
                var oBinding = oTable.getBinding("rows");

                if (oBinding) {

                    var iLength = oBinding.getLength();

                    for (var i = 0; i < iLength; i++) {

                        if (oTable.isExpanded(i)) {

                            var oCtx = oTable.getContextByIndex(i);
                            var oObj = oCtx && oCtx.getObject();

                            if (
                                oObj &&
                                oObj.categories &&
                                oObj.categories[0] &&
                                oObj.categories[0].isGroup === true
                            ) {
                                bAnyDetailExpanded = true;
                                break;
                            }
                        }
                    }
                }

                var oColMonths = this.byId("colMonths");
                var oColNew = this.byId("colNew");

                if (oColMonths) oColMonths.setVisible(bAnyDetailExpanded);
                if (oColNew) oColNew.setVisible(bAnyDetailExpanded);

                // RESET UI si todo está cerrado
                if (!bAnyDetailExpanded) {

                    this._aGroupRanges = [];

                    oUiModel.setProperty("/showStickyAgrupador", false);
                    oUiModel.setProperty("/showStickyParent", false);
                    oUiModel.setProperty("/showStickyChild", false);
                }
                // RESET STICKY HEADER
                if (!oUiModel.getProperty("/showStickyParent") &&
                    !oUiModel.getProperty("/showStickyChild")) {

                    oUiModel.setProperty("/stickyHeaderData", null);
                }

            }.bind(this), 0);
        },
/**
 * Maneja la navegación con teclas de flecha entre celdas de la tabla.
 * VERSIONE CORRETTA - FIX per blocco sulla prima riga visibile
 */
_onInputKeyDown: function (oEvent) {
    var oInput = oEvent.srcControl;
    var iKeyCode = oEvent.keyCode;
    var bDown = iKeyCode === 40;
    var bUp = iKeyCode === 38;
    var bRight = iKeyCode === 39;
    var bLeft = iKeyCode === 37;

    if (!bDown && !bUp && !bRight && !bLeft) return;

    console.log("🎯 KEY PRESSED:", bUp ? "UP" : bDown ? "DOWN" : bLeft ? "LEFT" : "RIGHT");

    // Sincronización rápida de valores
    var sCurrentDomValue = oInput.getFocusDomRef().value;
    oInput.setValue(sCurrentDomValue);
    oInput.updateModelProperty(sCurrentDomValue);

    oEvent.preventDefault();
    oEvent.stopImmediatePropagation();

    var oTable = this.byId("TreeTableBasic");
    var oBinding = oTable.getBinding("rows");
    var oParent = oInput.getParent();
    
    // Risali fino alla Row
    while (oParent && !oParent.isA("sap.ui.table.Row")) {
        oParent = oParent.getParent();
    }

    if (!oParent) {
        console.error("❌ Non ho trovato la Row!");
        return;
    }

    var iCurrentRowIndex = oParent.getIndex();
    
    // SALVA IL CONTEXT PATH CORRENTE
    var oCurrentContext = oParent.getBindingContext();
    if (!oCurrentContext) {
        console.error("❌ Context corrente non trovato!");
        return;
    }

    // Trova l'indice della cella
    var aCells = oParent.getCells();
    var iTargetColIndex = -1;

    for (var i = 0; i < aCells.length; i++) {
        var oCell = aCells[i];
        if (this._cellContainsInput(oCell, oInput)) {
            iTargetColIndex = i;
            break;
        }
    }

    if (iTargetColIndex === -1) {
        console.error("❌ Non ho trovato la colonna!");
        return;
    }

    console.log("✅ Current - Row:", iCurrentRowIndex, "Col:", iTargetColIndex, "Path:", oCurrentContext.getPath());
    
    // ==========================================
    // NAVEGACIÓN HORIZONTAL (LEFT/RIGHT)
    // ==========================================
    if (bLeft || bRight) {
        console.log("➡️ Navigazione ORIZZONTALE");
        
        var iNewColIndex = bRight ? iTargetColIndex + 1 : iTargetColIndex - 1;
        
        if (iNewColIndex < 0 || iNewColIndex >= oTable.getColumns().length) {
            console.log("⛔ Limite colonne raggiunto");
            return;
        }

        var iFirstVisible = oTable.getFirstVisibleRow();
        var iVisibleRowIndex = iCurrentRowIndex - iFirstVisible;
        
        if (iVisibleRowIndex < 0 || iVisibleRowIndex >= oTable.getRows().length) {
            console.error("❌ Riga non visibile!");
            return;
        }

        var oRow = oTable.getRows()[iVisibleRowIndex];
        if (!oRow) {
            console.error("❌ Row non trovata!");
            return;
        }

        var oCell = oRow.getCells()[iNewColIndex];
        var oTargetInput = this._recursiveGetInput(oCell);

        if (oTargetInput && oTargetInput.getVisible() && oTargetInput.getEditable()) {
            console.log("✅ Focus su colonna", iNewColIndex);
            oTargetInput.focus();
            if (oTargetInput.select) oTargetInput.select();
        } else {
            console.log("⚠️ Nessun input trovato in colonna", iNewColIndex);
        }
        return;
    }

    // ==========================================
    // NAVEGACIÓN VERTICAL (UP/DOWN)
    // ==========================================
    console.log("⬆️⬇️ Navigazione VERTICALE");
    
    var iTargetRowIndex = null;
    var sTargetPath = null;
    var iSearchIndex = iCurrentRowIndex;
    
    // Cerca la prossima riga valida
    while (true) {
        iSearchIndex = bDown ? iSearchIndex + 1 : iSearchIndex - 1;
        
        if (iSearchIndex < 0 || iSearchIndex >= oBinding.getLength()) {
            console.log("⛔ Limite tabella raggiunto (index:", iSearchIndex, ")");
            return;
        }

        var oCtx = oTable.getContextByIndex(iSearchIndex);
        if (!oCtx) {
            console.log("⚠️ Context NULL a index", iSearchIndex);
            continue;
        }
        
        var oData = oCtx.getObject();

        // Salta righe "Agrupador" o vuote
        if (oData && oData.name !== "Agrupador" && oData.name !== "" && oData.name !== undefined) {
            iTargetRowIndex = iSearchIndex;
            sTargetPath = oCtx.getPath();
            console.log("✅ Target trovato - Index:", iTargetRowIndex, "Path:", sTargetPath);
            break;
        } else {
            console.log("⏭️ Skip riga", iSearchIndex, "- name:", oData ? oData.name : "null");
        }
    }

    // ==========================================
    // GESTIONE SCROLL
    // ==========================================
    var iFirstVisible = oTable.getFirstVisibleRow();
    var iVisibleCount = oTable.getVisibleRowCount();
    var iLastVisible = iFirstVisible + iVisibleCount - 1;

    console.log("📊 Viewport - First:", iFirstVisible, "Last:", iLastVisible, "Target:", iTargetRowIndex);

    var bNeedsScroll = false;
    var iNewFirstVisible = iFirstVisible;
    
    // Target è SOTTO il viewport
    if (iTargetRowIndex > iLastVisible) {
        iNewFirstVisible = iTargetRowIndex - iVisibleCount + 1;
        console.log("⬇️ Scroll DOWN - New first:", iNewFirstVisible);
        bNeedsScroll = true;
    } 
    // Target è SOPRA il viewport
    else if (iTargetRowIndex < iFirstVisible) {
        iNewFirstVisible = iTargetRowIndex;
        console.log("⬆️ Scroll UP - New first:", iNewFirstVisible);
        bNeedsScroll = true;
    } else {
        console.log("✅ Target già visibile, nessuno scroll necessario");
    }

    // ==========================================
    // APPLICA SCROLL SE NECESSARIO
    // ==========================================
    if (bNeedsScroll) {
        console.log("🔄 Eseguo scroll a posizione:", iNewFirstVisible);
        oTable.setFirstVisibleRow(iNewFirstVisible);
    }

    // ==========================================
    // FOCUS SULL'INPUT TARGET
    // ==========================================
    var iTimeout = bNeedsScroll ? 200 : 50;
    
    setTimeout(function () {
        console.log("⏱️ Timeout - Cerco path:", sTargetPath);
        
        var oTargetRow = null;
        var aRows = oTable.getRows();
        
        // Cerca la riga usando il PATH del context
        for (var i = 0; i < aRows.length; i++) {
            var oRowContext = aRows[i].getBindingContext();
            if (oRowContext && oRowContext.getPath() === sTargetPath) {
                oTargetRow = aRows[i];
                console.log("✅ Riga trovata con path matching alla posizione", i);
                break;
            }
        }
        
        if (!oTargetRow) {
            console.error("❌ Riga con path", sTargetPath, "non trovata!");
            console.log("📋 Paths disponibili:");
            aRows.forEach(function(row, idx) {
                var ctx = row.getBindingContext();
                console.log("  [" + idx + "]:", ctx ? ctx.getPath() : "NULL");
            });
            return;
        }

        var oCell = oTargetRow.getCells()[iTargetColIndex];
        var oTargetInput = this._recursiveGetInput(oCell);
        
        if (oTargetInput && oTargetInput.getVisible() && oTargetInput.getEditable()) {
            oTargetInput.focus();
            if (oTargetInput.select) oTargetInput.select();
            console.log("✅✅✅ FOCUS OK su", sTargetPath);
        } else {
            console.error("❌ Input non trovato, non visibile o non editabile");
            console.log("   - Input exists:", !!oTargetInput);
            if (oTargetInput) {
                console.log("   - Visible:", oTargetInput.getVisible());
                console.log("   - Editable:", oTargetInput.getEditable());
            }
        }
    }.bind(this), iTimeout);
},

/**
 * Verifica se una cella contiene un determinato Input
 */
_cellContainsInput: function (oCell, oTargetInput) {
    if (oCell === oTargetInput) return true;

    if (oCell.getItems) {
        var aItems = oCell.getItems();
        for (var i = 0; i < aItems.length; i++) {
            if (aItems[i] === oTargetInput) return true;
            if (this._cellContainsInput(aItems[i], oTargetInput)) return true;
        }
    }

    if (oCell.getContent) {
        var aContent = oCell.getContent();
        for (var j = 0; j < aContent.length; j++) {
            if (aContent[j] === oTargetInput) return true;
            if (this._cellContainsInput(aContent[j], oTargetInput)) return true;
        }
    }

    return false;
},

/**
 * Busca recursivamente un control Input editable dentro de una celda.
 */
_recursiveGetInput: function (oControl) {
    if (!oControl) return null;
    
    // Verifica se è un Input visibile ed editabile
    if (oControl.isA && oControl.isA("sap.m.Input")) {
        if (oControl.getVisible() && oControl.getEditable()) {
            return oControl;
        }
    }

    // Cerca nei contenuti
    if (oControl.getContent) {
        var aContent = oControl.getContent();
        for (var i = 0; i < aContent.length; i++) {
            var res = this._recursiveGetInput(aContent[i]);
            if (res) return res;
        }
    }
    
    // Cerca negli items
    if (oControl.getItems) {
        var aItems = oControl.getItems();
        for (var j = 0; j < aItems.length; j++) {
            var resIt = this._recursiveGetInput(aItems[j]);
            if (resIt) return resIt;
        }
    }
    
    return null;
},
        /**
         * Construye un combo de operaciones a partir de las categorías expandibles.
         */
        _buildOperacionesCombo: function (aCategories) {
            var aResult = [];

            function recurse(aNodes) {
                if (!Array.isArray(aNodes)) return;

                aNodes.forEach(function (oNode) {
                    if (oNode.expandible || (Array.isArray(oNode.categories) && oNode.categories.length > 0)) {
                        aResult.push({
                            key: oNode.name,
                            text: oNode.name + " - " + (oNode.currency || "")
                        });
                    }

                    if (Array.isArray(oNode.categories)) {
                        recurse(oNode.categories);
                    }
                });
            }

            recurse(aCategories);
            return aResult;
        },
        /**
         * Filtra la TreeTable según la operación seleccionada en el Select.
         */
        onOperacionChange: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");
            var oTable = this.byId("TreeTableBasic");
            var oDefaultModel = this.getView().getModel();
            var oUiModel = this.getView().getModel("ui");

            // **BACKUP inicial solo UNA VEZ**
            if (!this._fullCategoriesBackup) {
                var aOriginal = oDefaultModel.getProperty("/catalog/models/categories");
                this._fullCategoriesBackup = JSON.parse(JSON.stringify(aOriginal));
            }

            // ========== RESET ==========
            if (!oSelectedItem) {
                var aCurrent = oDefaultModel.getProperty("/catalog/models/categories");

                var aRestored = this._mergeModifications(
                    JSON.parse(JSON.stringify(this._fullCategoriesBackup)),
                    aCurrent
                );

                oDefaultModel.setProperty("/catalog/models/categories", aRestored);

                this.byId("colMonths")?.setVisible(false);
                this.byId("colNew")?.setVisible(false);

                oUiModel?.setProperty("/showStickyParent", false);
                oUiModel?.setProperty("/showStickyChild", false);

                setTimeout(function () {
                    oTable.collapseAll();
                    this._refreshAfterToggle(oTable.getId());
                }.bind(this), 0);

                return;
            }

            // ========== FILTRO ==========
            var sKey = oSelectedItem.getKey();
            console.log("🔍 Chiave selezionata:", sKey);

            // FIX: Conta i punti per distinguere padre (I.003) da figlio (I.003.031)
            var iPunti = (sKey.match(/\./g) || []).length;
            var sParentKey = null;

            if (iPunti >= 2) {
                // Ha almeno 2 punti → è un figlio (es. I.003.031)
                sParentKey = sKey.substring(0, sKey.lastIndexOf("."));
            }
            // Se ha solo 1 punto (es. I.003) → sParentKey resta null (è un padre)

            console.log("👨‍👦 ParentKey:", sParentKey, "| Punti:", iPunti);

            var aCurrent = oDefaultModel.getProperty("/catalog/models/categories");
            var aWorkingCopy = this._mergeModifications(
                JSON.parse(JSON.stringify(this._fullCategoriesBackup)),
                aCurrent
            );

            console.log("📦 Total nodi da filtrare:", aWorkingCopy.length);

            var aFilteredRoot = [];

            for (var i = 0; i < aWorkingCopy.length; i++) {
                var rootCat = aWorkingCopy[i];

                console.log("➡️ Nodo " + i + ": name='" + rootCat.name + "', expandible=" + rootCat.expandible + ", children=" + (rootCat.categories ? rootCat.categories.length : 0));

                if (!Array.isArray(rootCat.categories)) {
                    rootCat.categories = [];
                }

                // **CASO 1: Padre principal (ej. I.003)**
                if (rootCat.name === sKey && !sParentKey) {
                    console.log("✅ MATCH PADRE! Aggiungo nodo con expandible=" + rootCat.expandible);
                    aFilteredRoot.push(rootCat);
                    continue;
                }

                // **CASO 2: Hijo específico (ej. I.003.031)**
                if (sParentKey) {
                    console.log("🔎 Cerco figli per parentKey=" + sParentKey);
                    var aFilteredChildren = this._filterCategories(rootCat.categories, sKey);
                    var bIncludeParent = rootCat.name === sParentKey;

                    console.log("  - Figli trovati:", aFilteredChildren.length, "| Include parent:", bIncludeParent);

                    if (aFilteredChildren.length === 0 && !bIncludeParent) {
                        console.log("  ❌ Skip questo nodo");
                        continue;
                    }

                    if (aFilteredChildren.length > 0) {
                        rootCat.categories = aFilteredChildren;
                    } else if (bIncludeParent) {
                        rootCat.categories = this._filterCategories(rootCat.categories, sKey);
                    }

                    console.log("  ✅ Aggiungo nodo parent");
                    aFilteredRoot.push(rootCat);
                }
            }

            console.log("📊 Nodi filtrati totali:", aFilteredRoot.length);
            for (var j = 0; j < aFilteredRoot.length; j++) {
                console.log("  " + j + ": " + aFilteredRoot[j].name + ", expandible=" + aFilteredRoot[j].expandible + ", children=" + (aFilteredRoot[j].categories ? aFilteredRoot[j].categories.length : 0));
            }

            oDefaultModel.setProperty("/catalog/models/categories", aFilteredRoot);

            setTimeout(function () {
                var oBinding = oTable.getBinding("rows");
                if (!oBinding) return;

                var bHasData = false;
                var bAnyDetailExpanded = false; // 👈 NUOVA VARIABILE

                // **COLAPSA TODO primero**
                oTable.collapseAll();

                for (var i = 0; i < oBinding.getLength(); i++) {
                    var oCtx = oTable.getContextByIndex(i);
                    var oObj = oCtx && oCtx.getObject();
                    if (!oObj) continue;

                    // **EXPANDE según el caso**
                    if (sParentKey) {
                        // CASO 2: Hijo específico → expande padre y hijo
                        if ((oObj.name === sParentKey || oObj.name === sKey) && oObj.expandible) {
                            oTable.expand(i);

                            // 👇 VERIFICA SE IL NODO ESPANSO HA NIPOTI (isGroup)
                            if (oObj.name === sKey &&
                                Array.isArray(oObj.categories) &&
                                oObj.categories.length > 0 &&
                                oObj.categories[0].isGroup === true) {
                                bAnyDetailExpanded = true;
                            }
                        }
                    } else if (sKey) {
                        // CASO 1: Padre principal → expande SOLO el nodo con hijos
                        if (oObj.name === sKey && oObj.expandible === true) {
                            console.log("🔓 Espando nodo padre:", oObj.name, "at index", i);
                            oTable.expand(i);

                            // 👇 VERIFICA SE IL PADRE HA NIPOTI (isGroup)
                            if (Array.isArray(oObj.categories) &&
                                oObj.categories.length > 0 &&
                                oObj.categories[0].isGroup === true) {
                                bAnyDetailExpanded = true;
                            }
                        }
                    }

                    // Mantieni la logica originale per bHasData (opzionale, se serve)
                    if (Array.isArray(oObj.categories)) {
                        if (oObj.categories.some(c => c.isGroup === true)) {
                            bHasData = true;
                        }
                    }
                }

                // 👇 USA bAnyDetailExpanded INVECE DI bHasData
                this.byId("colMonths")?.setVisible(bAnyDetailExpanded);
                this.byId("colNew")?.setVisible(bAnyDetailExpanded);

                oUiModel?.setProperty("/showStickyParent", false);
                oUiModel?.setProperty("/showStickyChild", false);

                this._refreshAfterToggle(oTable.getId());
            }.bind(this), 100);
        },

        /**
         * Mezcla modificaciones del usuario en la estructura base
         */
        _mergeModifications: function (aBase, aModified) {
            if (!Array.isArray(aModified)) return aBase;

            var mergeRecursive = function (baseArray, modArray) {
                modArray.forEach(function (modItem) {
                    var baseItem = baseArray.find(function (b) {
                        return b.name === modItem.name;
                    });

                    if (baseItem) {
                        // Copia valores de años y meses
                        for (var key in modItem) {
                            if (/^y\d{4}$/.test(key) || /^m\d{4}_\d+$/.test(key) || key === "months" || key === "monthsData") {
                                baseItem[key] = modItem[key];
                            }
                        }

                        // Recursión en hijos
                        if (baseItem.categories && modItem.categories) {
                            mergeRecursive(baseItem.categories, modItem.categories);
                        }
                    }
                });
            };

            mergeRecursive(aBase, aModified);
            return aBase;
        }
    });
});
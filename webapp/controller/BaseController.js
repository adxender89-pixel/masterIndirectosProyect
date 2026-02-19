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
    "sap/m/VBox",
    "sap/ui/core/Fragment",
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
    FilterOperator,
    XMLView,
    Label,
    Text,
    VBox,
    Fragment

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
            this.setupDynamicTreeTable();

            this.getView().attachEventOnce("afterRendering", function () {
                this.createYearColumns(new Date().getFullYear(), 3, "");



            }.bind(this));
        },


        /**
         * Crea dinámicamente columnas de años con un botón en la cabecera para ver los meses.
         */
        createYearColumns: function (iStartYear, iHowMany, _pTable) {
            var oTable = this.getControlTable();
            if (!oTable) return;

            var aColumns = oTable.getColumns();
            for (var i = aColumns.length - 1; i >= 0; i--) {
                var oCol = aColumns[i];
                if (oCol.data("dynamicYear") === true) {
                    oTable.removeColumn(oCol);
                }
            }
            // No se cierran los meses cuando se recargan los años
            // this._openedYear = null;

            //var iStartFrom = (iSkipFields !== undefined) ? iSkipFields : 13;
            var iStartFrom = 13;
            // Nueva sección: Columna Ejecutados para los años con formato correcto
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
            // Fin de la nueva sección

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
                            this.onCreateMonthsTable(oEvent);
                        }.bind(this)
                    }).addStyleClass("yearButton"),
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
                                    // Se mantiene todo el código del liveChange
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
                this.setupDynamicTreeTable();
            }.bind(this), 0);
        },



        /**
         * Maneja el cambio de año en el selector, ajustando las columnas mostradas dinámicamente.
         */
        onYearChange: function (oEvent) {
            var oSelect = oEvent.getSource();
            var aItems = oSelect.getItems();
            var sSelectedYear = parseInt(oEvent.getParameter("selectedItem").getKey(), 10);
            var iMaxYearInSelect = parseInt(aItems[aItems.length - 1].getKey(), 10);
            var iNumColumns = 3;
            var iYearToPass = Math.min(sSelectedYear, iMaxYearInSelect - (iNumColumns - 1));

            var oTable = this.getControlTable();

            // Se guarda si había un año abierto antes del cambio
            var bWasYearOpen = !!this._openedYear;

            if (this._openedYear && oTable) {
                // Se eliminan todas las columnas de meses y ejecutados
                var monthColsToRemove = oTable.getColumns().filter(c => c.data("dynamicMonth") || c.data("ejecutadosColumn"));
                monthColsToRemove.forEach(c => oTable.removeColumn(c));

                // Se recrea la columna Ejecutados si el checkbox está activo
                var bShowEjecutado = this.byId("idEjecutadoCheckBox") ? this.byId("idEjecutadoCheckBox").getSelected() : false;
                if (bShowEjecutado) {
                    var iInsertIndex = oTable.getColumns().findIndex(c => c.data("dynamicYear") === true);
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
                    }
                }

                this._openedYear = null;
            }

            // Se crean las columnas del nuevo año
            this.createYearColumns(iYearToPass, iNumColumns);

            // Se reabre el año seleccionado solo si había uno abierto antes
            if (bWasYearOpen) {
                setTimeout(function () {
                    var oYearCol = oTable.getColumns().find(c => {
                        var lab = c.getLabel();
                        var txt = lab.getText ? lab.getText() : (lab.getItems ? lab.getItems()[0].getText() : "");
                        return txt === String(sSelectedYear);
                    });

                    if (oYearCol) {
                        var oButton = oYearCol.getLabel();
                        this.onCreateMonthsTable({
                            getSource: function () { return oButton; }
                        });
                    }
                }.bind(this), 100);
            }
        },

        /**
         * Actualiza el estado de la tabla tras la expansión o contracción de nodos.
         */
        _refreshAfterToggle: function (sTableId) {
            var oTable = this.byId(sTableId);
            if (!oTable) return;

            this._buildGroupRanges();

            this._onScrollLike({
                getParameter: function () {
                    return oTable.getFirstVisibleRow();
                }
            });

            this._applyCabeceraStyle();
        },

        /**
         * Aplica estilos CSS específicos a las filas de tipo cabecera para diferenciarlas visualmente.
         */
        _applyCabeceraStyle: function (oTable) {
            var oTable = this.getControlTable();
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
        * Lógica global para abrir el menú contextual (Popover)
        */
        onContextMenu: function (oParams) {
            var oRowContext = oParams.rowBindingContext;
            var oOriginControl = oParams.cellControl;
            var oView = this.getView();
            // Guardamos la fila para que el AddPress sepa dónde trabajar
            this._oContextRecord = oRowContext;
            if (!this._pPopover) {
                this._pPopover = Fragment.load({
                    id: oView.getId(),
                    name: "masterindirectos.fragment.ActionPopover",
                    controller: this
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);
                    return oPopover;
                });
            }

            this._pPopover.then(function (oPopover) {
                oPopover.setBindingContext(oRowContext, "catalog");
                setTimeout(function () {
                    oPopover.openBy(oOriginControl);
                }, 50);
            });
        },
        /**
         * Cierra el popover de forma global
         */
        onCloseContextMenu: function () {
            if (this._pPopover) {
                this._pPopover.then(function (oPopover) {
                    oPopover.close();
                });
            }
        },
        /**
                 * Genera las columnas mensuales correspondientes al año seleccionado en la cabecera.
                 * Incluye cabecera sticky de tres niveles que se activa unicamente durante el desplazamiento vertical.
                 */
        onCreateMonthsTable: function (oEvent) {

            var oSource = oEvent.getSource();
            var oTable = this.getControlTable();

            var bShowEjecutado = this.byId("idEjecutadoCheckBox") ? this.byId("idEjecutadoCheckBox").getSelected() : false;


            // Guarda la posizione attuale dello scroll orizzontale
            var iCurrentScrollLeft = 0;
            try {
                var oScrollExt = oTable._getScrollExtension();
                if (oScrollExt && oScrollExt.getHorizontalScrollbar()) {
                    iCurrentScrollLeft = oScrollExt.getHorizontalScrollbar().scrollLeft;

                }
            } catch (e) {

            }

            var sYearText = "";
            var sSourceName = oSource.getMetadata().getName();


            if (sSourceName === "sap.m.Button") {
                sYearText = oSource.data("year");
                if (!sYearText || isNaN(parseInt(sYearText, 10))) {
                    sYearText = oSource.getText();
                }
                if (isNaN(parseInt(sYearText, 10))) {
                    sYearText = oSource.getParent().getItems()[0].getText();
                }
            } else {
                sYearText = String(this._openedYear);
            }

            var sYear = parseInt(sYearText, 10);
            if (!sYear) return;

            // Se si preme lo stesso anno già aperto, si chiudono i mesi
            if (this._openedYear === sYear && sSourceName === "sap.m.Button") {

                this._openedYear = null;
                oTable.setBusy(true);

                var monthColsToRemove = oTable.getColumns().filter(function (c) {
                    return c.data("dynamicMonth");
                });
                monthColsToRemove.forEach(function (c) { oTable.removeColumn(c); });

                if (bShowEjecutado) {
                    var ejecutadosColsToRemove = oTable.getColumns().filter(function (c) {
                        return c.data("ejecutadosColumn");
                    });
                    ejecutadosColsToRemove.forEach(function (c) { oTable.removeColumn(c); });

                    var iInsertIndex = oTable.getColumns().findIndex(function (c) {
                        return c.data("dynamicYear") === true;
                    });

                    if (iInsertIndex !== -1) {
                        var currentYear = new Date().getFullYear();
                        var oColEjecAnual = new sap.ui.table.Column({
                            width: "80px",
                            hAlign: "Center",
                            label: new sap.m.VBox({
                                width: "100%",
                                items: [
                                    new sap.m.Label({
                                        text: "Ejecutados",
                                        design: "Bold",
                                        textAlign: "Center",
                                        width: "100%"
                                    }).addStyleClass("testBold titleGrande"),
                                    new sap.m.VBox({
                                        renderType: "Bare",
                                        width: "100%",
                                        visible: "{ui>/showStickyParent}",
                                        items: [
                                            new sap.m.Text({
                                                text: "{ui>/stickyHeaderData/parent/ejecutado}",
                                                wrapping: false,
                                                width: "100%",
                                                textAlign: "Center"
                                            })
                                        ]
                                    }).addStyleClass("parentHeaderBox"),
                                    new sap.m.VBox({
                                        width: "100%",
                                        items: [
                                            new sap.m.Text({
                                                text: "\u00a0",
                                                wrapping: false,
                                                visible: "{ui>/showStickyChild}"
                                            }).addStyleClass("secondStickyText")
                                        ]
                                    }).addStyleClass("parentHeader")
                                ]
                            }).addStyleClass("fullWidthHeader"),
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

                setTimeout(function () {
                    try {
                        var oScrollExt = oTable._getScrollExtension();
                        if (oScrollExt && oScrollExt.getHorizontalScrollbar()) {
                            oScrollExt.getHorizontalScrollbar().scrollLeft = iCurrentScrollLeft;
                        }
                    } catch (e) { }
                    oTable.setBusy(false);
                }.bind(this), 50);

                return;
            }

            oTable.setBusy(true);

            // Rimuove le colonne mesi esistenti e la colonna ejecutados
            var colsToRemove = oTable.getColumns().filter(function (c) {
                return c.data("dynamicMonth") || c.data("ejecutadosColumn");
            });
            colsToRemove.forEach(function (c) { oTable.removeColumn(c); });

            this._openedYear = sYear;

            // Sincronizza il selettore anni
            var oYearsModel = this.getView().getModel("yearsModel");
            if (oYearsModel) {
                oYearsModel.setProperty("/selectedYear", sYear);
            }

            // Nomi mesi abbreviati in inglese
            var aMonthNames = [];
            for (var i = 0; i < 12; i++) {
                var date = new Date(2024, i, 1);
                aMonthNames.push(date.toLocaleString("en-US", { month: "short" }));
            }

            var currentYear = new Date().getFullYear();
            var currentMonth = new Date().getMonth();

            var iStartIdx = (sYear === currentYear && !bShowEjecutado) ? currentMonth + 1 : 0;

            // Trova la colonna anno per calcolare l'indice di inserimento
            var oYearCol = oTable.getColumns().find(function (c) {
                var lab = c.getLabel();
                var txt = lab.getText
                    ? lab.getText()
                    : (lab.getItems ? lab.getItems()[0].getText() : "");
                return txt === String(sYear);
            });
            var colIndex = oTable.indexOfColumn(oYearCol);

            var iOffset = 0;

            // Inserisce la colonna ejecutados se il checkbox è attivo
            if (bShowEjecutado) {
                var oColEjec = new sap.ui.table.Column({
                    width: "80px",
                    hAlign: "Center",
                    label: new sap.m.VBox({
                        width: "100%",
                        items: [
                            new sap.m.Label({
                                text: "Ejecutados",
                                design: "Bold",
                                textAlign: "Center",
                                width: "100%"
                            }).addStyleClass("testBold titleGrande"),
                            new sap.m.VBox({
                                renderType: "Bare",
                                width: "100%",
                                visible: "{ui>/showStickyParent}",
                                items: [
                                    new sap.m.Text({
                                        text: "{ui>/stickyHeaderData/parent/ejecutado}",
                                        wrapping: false,
                                        width: "100%",
                                        textAlign: "Center"
                                    })
                                ]
                            }).addStyleClass("parentHeaderBox"),
                            new sap.m.VBox({
                                width: "100%",
                                items: [
                                    new sap.m.Text({
                                        text: "\u00a0",
                                        wrapping: false,
                                        visible: "{ui>/showStickyChild}"
                                    }).addStyleClass("secondStickyText")
                                ]
                            }).addStyleClass("parentHeader")
                        ]
                    }).addStyleClass("fullWidthHeader"),
                    template: new sap.m.Text({
                        text: "{ejecutado}",
                        textAlign: "Center",
                        width: "100%"
                    })
                });
                oColEjec.data("dynamicMonth", true);
                oColEjec.data("ejecutadosColumn", true);
                oTable.insertColumn(oColEjec, colIndex + iOffset);
                iOffset++;
            }

            // Genera le colonne per ogni mese dell'anno selezionato
            for (var i = iStartIdx; i < 12; i++) {

                var sMonthLabel = aMonthNames[i];
                var iRealIdx = i;
                var bIsPassedMonth = (sYear < currentYear) || (sYear === currentYear && i <= currentMonth);

                // Template della cella
                var oControlTemplate;

                if (bShowEjecutado && bIsPassedMonth) {
                    oControlTemplate = new sap.m.Text({
                        text: "{ej" + sYear + "_" + iRealIdx + "}",
                        textAlign: "Center",
                        width: "100%"
                    }).addStyleClass("sapUiTinyMarginEnd");
                } else {
                    // ↓ IIFE per congelare il valore di iRealIdx in questa iterazione
                    // Sostituisci questo blocco nel for loop:
                    var oControlTemplate;

                    if (bShowEjecutado && bIsPassedMonth) {
                        oControlTemplate = new sap.m.Text({
                            text: "{ej" + sYear + "_" + iRealIdx + "}",
                            textAlign: "Center",
                            width: "100%"
                        }).addStyleClass("sapUiTinyMarginEnd");
                    } else {
                        // ↓ IIFE per congelare il valore di iRealIdx in questa iterazione
                        oControlTemplate = (function (iIdx, iYr) {
                            return new sap.m.Input({
                                value: "{m" + iYr + "_" + iIdx + "}",
                                textAlign: "Center",
                                visible: "{= ${expandible} !== false && !${isGroup} }",
                                change: function (oEvt) {
                                    var oInput = oEvt.getSource();
                                    var oCtx = oInput.getBindingContext();
                                    var oModel = oCtx.getModel();
                                    var sPath = oCtx.getPath();

                                    oModel.setProperty(
                                        sPath + "/m" + iYr + "_" + iIdx,
                                        oInput.getValue()
                                    );

                                    var oUiModel = this.getView().getModel("ui");
                                    var oCurrentParent = oUiModel.getProperty("/stickyHeaderData/parent");
                                    if (oCurrentParent) {
                                        oCurrentParent["m" + iYr + "_" + iIdx] = oInput.getValue();
                                        oUiModel.setProperty("/stickyHeaderData/parent", oCurrentParent);
                                    }
                                }.bind(this)
                            });
                        }.bind(this))(iRealIdx, sYear);
                    }
                }

                // ─── LABEL COLONNA — struttura identica alle colonne statiche XML ───
                var sParentPath = "ui>/stickyHeaderData/parent/m" + sYear + "_" + iRealIdx;
                var sChildPath = "ui>/stickyHeaderData/child/m" + sYear + "_" + iRealIdx;

                var oTitleControl = (i === iStartIdx)
                    ? new sap.m.HBox({
                        alignItems: "Center",
                        justifyContent: "Center",
                        renderType: "Bare",
                        width: "100%",
                        items: [
                            new sap.m.Label({
                                text: sMonthLabel + " " + sYear,
                                design: "Bold",
                                textAlign: "Center"
                            }).addStyleClass("testBold titleGrande"),
                            new sap.m.Button({
                                type: "Transparent",
                                icon: "sap-icon://slim-arrow-right",
                                press: function (oEv) {
                                    this.onCreateMonthsTable(oEv);
                                }.bind(this)
                            }).data("year", String(sYear))
                                .addStyleClass("iconOnlyBtn")
                        ]
                    }).addStyleClass("monthHeaderHBox")
                    : new sap.m.Label({
                        text: sMonthLabel + " " + sYear,
                        design: "Bold",
                        textAlign: "Center",
                        width: "100%"
                    }).addStyleClass("testBold titleGrande");

                var oColLabel = new sap.m.VBox({
                    width: "100%",
                    items: [
                        // Livello 1: titolo mese
                        oTitleControl,

                        // Livello 2: valore padre — visibile con showStickyParent
                        new sap.m.VBox({
                            renderType: "Bare",
                            width: "100%",
                            visible: "{ui>/showStickyParent}",
                            items: [
                                new sap.m.Text({
                                    text: {
                                        path: sParentPath,
                                        formatter: function (v) { return v || "\u00a0"; }
                                    },
                                    wrapping: false,
                                    width: "100%",
                                    textAlign: "Center"
                                })
                            ]
                        }).addStyleClass("parentHeaderBox"),

                        // Livello 3: valore child — visibile con showStickyChild (era il bug!)
                        new sap.m.VBox({
                            width: "100%",
                            visible: "{ui>/showStickyChild}",
                            items: [
                                new sap.m.Text({
                                    text: {
                                        path: sChildPath,
                                        formatter: function (v) { return v || "\u00a0"; }
                                    },
                                    wrapping: false,
                                    visible: "{ui>/showStickyChild}"
                                }).addStyleClass("secondStickyText")
                            ]
                        }).addStyleClass("parentHeader" + (i === iStartIdx ? " parentHeaderFirstMonth" : ""))
                    ]
                }).addStyleClass("fullWidthHeader");
                // ─────────────────────────────────────────────────────────────────────

                var oColumn = new sap.ui.table.Column({
                    width: "105px",          // px coerente con le colonne statiche
                    hAlign: "Center",
                    label: oColLabel,
                    template: oControlTemplate
                }).data("dynamicMonth", true);

                oTable.insertColumn(oColumn, colIndex + iOffset + (i - iStartIdx));
            }

            // Ripristina scroll e sblocca la tabella
            setTimeout(function () {
                try {
                    var oScrollExt = oTable._getScrollExtension();
                    if (oScrollExt && oScrollExt.getHorizontalScrollbar()) {
                        oScrollExt.getHorizontalScrollbar().scrollLeft = iCurrentScrollLeft;
                    }
                } catch (e) { }
                oTable.setBusy(false);
            }.bind(this), 50);
        },




        /**
         * Se ejecuta cuando se selecciona el checkbox de Ejecutado, recargando las columnas mensuales.
         */
        onEjecutadoCheckBoxSelect: function (oEvent) {
            var oTable = this.getControlTable();
            if (!oTable) return;

            var bShowEjecutado = this.byId("idEjecutadoCheckBox").getSelected();
            var currentYear = new Date().getFullYear();

            // Si hay meses abiertos, se recargan para actualizar la vista
            if (this._openedYear) {
                var sYear = this._openedYear;

                // Se eliminan todas las columnas dinámicas de los meses
                oTable.getColumns().filter(c => c.data("dynamicMonth")).forEach(c => oTable.removeColumn(c));

                // Se recrean los meses con el nuevo estado del checkbox
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
                    });
                }
            } else {
                // Si no hay meses abiertos, se gestiona solo la columna Ejecutados de los años
                // Se eliminan las columnas Ejecutados existentes
                oTable.getColumns().filter(c => c.data("ejecutadosColumn")).forEach(c => oTable.removeColumn(c));

                if (bShowEjecutado) {
                    // Columna Ejecutados anual con VBox como los meses
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
        _onScrollLike: function (oEvent) {
            if (this._ignoreNextScroll) {
                this._ignoreNextScroll = false;
                return;
            }

            var oTable = this.getControlTable();
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
            this._applyCabeceraStyle();
        },
        /**
         * Analiza el modelo de la tabla para definir los rangos de índices de cada grupo de datos.
         */
        _buildGroupRanges: function (sTableId) {
            var oTable = this.getControlTable();
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


            var oTable = this.getControlTable();
            if (!oTable || !oTable.getDomRef()) {

                return;
            }

            var iWindowHeight = window.innerHeight;


            var oTableRect = oTable.getDomRef().getBoundingClientRect();
            var iTableTop = oTableRect.top;


            // Se modifica únicamente este valor de 20 a 148
            var iBottomSpace = 148; // Footer, scrollbar, márgenes (4 filas × 32px + 20px base)


            var iAvailableHeight = iWindowHeight - iTableTop - iBottomSpace;


            var iRowHeight = 32;


            var iRows = Math.floor(iAvailableHeight / iRowHeight);


            if (iRows < 5) {

                iRows = 5;
            }

            var iCurrentColumns = oTable.getColumns().length;
            var iVisibleColumns = oTable.getColumns().filter(function (col) {
                return col.getVisible();
            }).length;



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

                    // Coincidencia directa
                    if (cat.name === sKey) {
                        oClone.categories = cat.categories || [];
                        return oClone;
                    }

                    // Coincidencia indirecta
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
            var oTable = this.getControlTable();
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

                this._buildGroupRanges();

                var iFirstVisible = oTable.getFirstVisibleRow();

                this._onScrollLike({
                    getParameter: function (sName) {
                        if (sName === "firstVisibleRow") {
                            return iFirstVisible;
                        }
                    }
                });

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

                // Se reinicia la interfaz si todo está cerrado
                if (!bAnyDetailExpanded) {

                    this._aGroupRanges = [];

                    oUiModel.setProperty("/showStickyAgrupador", false);
                    oUiModel.setProperty("/showStickyParent", false);
                    oUiModel.setProperty("/showStickyChild", false);
                }
                // Se reinicia el sticky header
                if (!oUiModel.getProperty("/showStickyParent") &&
                    !oUiModel.getProperty("/showStickyChild")) {

                    oUiModel.setProperty("/stickyHeaderData", null);
                }

            }.bind(this), 0);
        },
        /**
         * Solución completa - Con reasignación de delegado y gestión del cursor
         */

        /**
         * Retorna la tabla dinámica de la vista actual. 
         * Si el hijo define 'getCustomTableId', lo usa; si no, usa 'TreeTableBasic'.
         */
        getControlTable: function () {
            var sId = this.getCustomTableId();
            return this.byId(sId);
        },

        /**
         * Configura las propiedades y eventos necesarios para el funcionamiento de una TreeTable.
         */
        setupDynamicTreeTable: function (sTableId) {
            var oTable = sTableId ? this.byId(sTableId) : this.getControlTable();
            if (!oTable) {
                return;
            }

            oTable.attachFirstVisibleRowChanged(function (oEvent) {
                this._onScrollLike(oEvent);
                this._attachArrowDelegates(oTable);
            }.bind(this));

            oTable.setFixedColumnCount(2);

            if (this.byId("colMonths")) this.byId("colMonths").setVisible(false);
            if (this.byId("colNew")) this.byId("colNew").setVisible(false);

            if (!this._arrowDelegate) {
                this._arrowDelegate = {
                    onkeydown: function (oEvent) {
                        this._onInputKeyDown(oEvent);
                    }.bind(this)
                };
            }

            oTable.addEventDelegate({
                onAfterRendering: function () {
                    this._attachArrowDelegates(oTable);
                    this._applyCabeceraStyle(oTable);
                }.bind(this)
            });

            if (!oTable._rowsDelegateAttached) {
                oTable.attachEvent("rowsUpdated", function () {
                    this._attachArrowDelegates(oTable);
                }.bind(this));
                oTable._rowsDelegateAttached = true;
            }

            if (!this.getView().getModel("viewModel")) {
                var oViewModel = new sap.ui.model.json.JSONModel({
                    dynamicRowCount: 10
                });
                this.getView().setModel(oViewModel, "viewModel");
            }

            // Se elimina el registro del resize aquí

            this._calculateDynamicRows();
        },

        /**
         * Nueva función: Asigna los delegados de las flechas a todos los inputs visibles
         */
        _attachArrowDelegates: function (oTable) {
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
                    var oInput = this._recursiveGetInput(oCell);
                    if (oInput) {
                        // Se elimina primero para evitar duplicados
                        oInput.removeEventDelegate(this._arrowDelegate);
                        // Se asigna el delegado
                        oInput.addEventDelegate(this._arrowDelegate);
                    }
                }.bind(this));
            }.bind(this));
        },

        /**
         * Maneja la navegación con teclas de flecha entre celdas de la tabla.
         * Versión final con corrección para límites de tabla
         */
        _onInputKeyDown: function (oEvent) {
            var oInput = oEvent.srcControl;
            var iKeyCode = oEvent.keyCode;
            var bDown = iKeyCode === 40;
            var bUp = iKeyCode === 38;
            var bRight = iKeyCode === 39;
            var bLeft = iKeyCode === 37;

            if (!bDown && !bUp && !bRight && !bLeft) return;

            // Gestión del cursor en el campo de texto
            var oDomRef = oInput.getFocusDomRef();
            if (!oDomRef) return;

            var iCursorPos = oDomRef.selectionStart;
            var iTextLength = oDomRef.value.length;

            // Si LEFT y el cursor NO está al principio, se permite que el cursor se mueva
            if (bLeft && iCursorPos > 0) {
                return;
            }

            // Si RIGHT y el cursor NO está al final, se permite que el cursor se mueva
            if (bRight && iCursorPos < iTextLength) {
                return;
            }

            // Navegación entre celdas

            // Se sincroniza el valor
            var sCurrentDomValue = oDomRef.value;
            oInput.setValue(sCurrentDomValue);
            if (oInput.updateModelProperty) {
                oInput.updateModelProperty(sCurrentDomValue);
            }

            oEvent.preventDefault();
            oEvent.stopImmediatePropagation();

            var oTable = this.getControlTable();
            if (!oTable) return;

            var oBinding = oTable.getBinding("rows");
            if (!oBinding) return;

            var oParent = oInput.getParent();

            // Se encuentra la Row
            while (oParent && !oParent.isA("sap.ui.table.Row")) {
                oParent = oParent.getParent();
            }

            if (!oParent) return;

            var iCurrentRowIndex = oParent.getIndex();
            var oCurrentContext = oParent.getBindingContext();
            if (!oCurrentContext) return;

            // Se encuentra la columna
            var aCells = oParent.getCells();
            var iTargetColIndex = -1;

            for (var i = 0; i < aCells.length; i++) {
                if (this._cellContainsInput(aCells[i], oInput)) {
                    iTargetColIndex = i;
                    break;
                }
            }

            if (iTargetColIndex === -1) return;

            // Navegación horizontal
            if (bLeft || bRight) {
                var iNewColIndex = bRight ? iTargetColIndex + 1 : iTargetColIndex - 1;

                if (iNewColIndex < 0 || iNewColIndex >= oTable.getColumns().length) {
                    // Se mantiene el foco en el input actual
                    setTimeout(function () {
                        oInput.focus();
                        if (oInput.select) oInput.select();
                    }, 10);
                    return;
                }

                var iFirstVisible = oTable.getFirstVisibleRow();
                var iVisibleRowIndex = iCurrentRowIndex - iFirstVisible;

                if (iVisibleRowIndex < 0 || iVisibleRowIndex >= oTable.getRows().length) {
                    // Se mantiene el foco en el input actual
                    setTimeout(function () {
                        oInput.focus();
                        if (oInput.select) oInput.select();
                    }, 10);
                    return;
                }

                var oRow = oTable.getRows()[iVisibleRowIndex];
                if (!oRow) {
                    setTimeout(function () {
                        oInput.focus();
                        if (oInput.select) oInput.select();
                    }, 10);
                    return;
                }

                var oCell = oRow.getCells()[iNewColIndex];
                var oTargetInput = this._recursiveGetInput(oCell);

                if (oTargetInput && oTargetInput.getVisible() && oTargetInput.getEditable()) {
                    setTimeout(function () {
                        oTargetInput.focus();
                        if (oTargetInput.select) {
                            oTargetInput.select();
                        }
                    }, 10);
                } else {
                    // No se encuentra ningún input, se mantiene el foco actual
                    setTimeout(function () {
                        oInput.focus();
                        if (oInput.select) oInput.select();
                    }, 10);
                }
                return;
            }

            // Navegación vertical
            var iTargetRowIndex = null;
            var sTargetPath = null;
            var iSearchIndex = iCurrentRowIndex;

            // Se busca la próxima fila válida
            var iSearchSteps = 0;
            while (true) {
                iSearchIndex = bDown ? iSearchIndex + 1 : iSearchIndex - 1;
                iSearchSteps++;

                // Si se alcanzan los límites, se mantiene el foco en el input actual
                if (iSearchIndex < 0 || iSearchIndex >= oBinding.getLength()) {
                    setTimeout(function () {
                        oInput.focus();
                        if (oInput.select) oInput.select();
                    }, 10);
                    return;
                }

                // Se evita el bucle infinito
                if (iSearchSteps > 100) {
                    setTimeout(function () {
                        oInput.focus();
                        if (oInput.select) oInput.select();
                    }, 10);
                    return;
                }

                var oCtx = oTable.getContextByIndex(iSearchIndex);
                if (!oCtx) continue;

                var oData = oCtx.getObject();
                if (!oData) continue;

                // Se saltan las filas "Agrupador" o vacías
                if (oData.name === "Agrupador" || oData.name === "" || oData.name === undefined) {
                    continue;
                }

                iTargetRowIndex = iSearchIndex;
                sTargetPath = oCtx.getPath();
                break;
            }

            // Gestión del scroll
            var iFirstVisible = oTable.getFirstVisibleRow();
            var iVisibleCount = oTable.getVisibleRowCount();
            var iLastVisible = iFirstVisible + iVisibleCount - 1;

            var bNeedsScroll = false;
            var iNewFirstVisible = iFirstVisible;

            if (iTargetRowIndex > iLastVisible) {
                // Destino debajo del viewport
                iNewFirstVisible = iTargetRowIndex - iVisibleCount + 1;
                bNeedsScroll = true;
            }
            else if (iTargetRowIndex < iFirstVisible) {
                // Destino encima del viewport
                iNewFirstVisible = iTargetRowIndex;
                bNeedsScroll = true;
            }

            // Foco con/sin scroll
            if (bNeedsScroll) {
                // Con scroll: se espera a que las filas se actualicen
                var that = this;
                var bFocused = false;

                var fnFocus = function () {
                    if (bFocused) return;
                    bFocused = true;

                    var aRows = oTable.getRows();
                    var oTargetRow = null;

                    for (var i = 0; i < aRows.length; i++) {
                        var oRowContext = aRows[i].getBindingContext();
                        if (oRowContext && oRowContext.getPath() === sTargetPath) {
                            oTargetRow = aRows[i];
                            break;
                        }
                    }

                    if (!oTargetRow) {
                        // Si no se encuentra la fila destino, se mantiene el foco actual
                        oInput.focus();
                        if (oInput.select) oInput.select();
                        return;
                    }

                    var oCell = oTargetRow.getCells()[iTargetColIndex];
                    var oTargetInput = that._recursiveGetInput(oCell);

                    if (oTargetInput && oTargetInput.getVisible() && oTargetInput.getEditable()) {
                        oTargetInput.focus();
                        if (oTargetInput.select) {
                            oTargetInput.select();
                        }
                    } else {
                        // Si no se encuentra el input, se mantiene el foco actual
                        oInput.focus();
                        if (oInput.select) oInput.select();
                    }
                };

                // Se asigna el listener para rowsUpdated
                oTable.attachEventOnce("rowsUpdated", function () {
                    setTimeout(fnFocus, 50);
                });

                // Se ejecuta el scroll
                oTable.setFirstVisibleRow(iNewFirstVisible);

                // Timeout de seguridad
                setTimeout(fnFocus, 300);

            } else {
                // Sin scroll: foco inmediato
                setTimeout(function () {
                    var aRows = oTable.getRows();
                    var oTargetRow = null;

                    for (var i = 0; i < aRows.length; i++) {
                        var oRowContext = aRows[i].getBindingContext();
                        if (oRowContext && oRowContext.getPath() === sTargetPath) {
                            oTargetRow = aRows[i];
                            break;
                        }
                    }

                    if (!oTargetRow) {
                        // Si no se encuentra la fila, se mantiene el foco actual
                        oInput.focus();
                        if (oInput.select) oInput.select();
                        return;
                    }

                    var oCell = oTargetRow.getCells()[iTargetColIndex];
                    var oTargetInput = this._recursiveGetInput(oCell);

                    if (oTargetInput && oTargetInput.getVisible() && oTargetInput.getEditable()) {
                        oTargetInput.focus();
                        if (oTargetInput.select) {
                            oTargetInput.select();
                        }
                    } else {
                        // Si no se encuentra el input, se mantiene el foco actual
                        oInput.focus();
                        if (oInput.select) oInput.select();
                    }
                }.bind(this), 10);
            }
        },

        /**
         * Verifica si una celda contiene un determinado Input
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

            if (oControl.isA && oControl.isA("sap.m.Input")) {
                if (oControl.getVisible() && oControl.getEditable()) {
                    return oControl;
                }
            }

            if (oControl.getContent) {
                var aContent = oControl.getContent();
                for (var i = 0; i < aContent.length; i++) {
                    var res = this._recursiveGetInput(aContent[i]);
                    if (res) return res;
                }
            }

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
            var oTable = this.getControlTable();
            var oDefaultModel = this.getView().getModel();
            var oUiModel = this.getView().getModel("ui");

            // Backup inicial solo una vez
            if (!this._fullCategoriesBackup) {
                var aOriginal = oDefaultModel.getProperty("/catalog/models/categories");
                this._fullCategoriesBackup = JSON.parse(JSON.stringify(aOriginal));
            }

            // Reset
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

            // Filtro
            var sKey = oSelectedItem.getKey();


            // Se cuentan los puntos para distinguir padre (I.003) de hijo (I.003.031)
            var iPunti = (sKey.match(/\./g) || []).length;
            var sParentKey = null;

            if (iPunti >= 2) {
                // Tiene al menos 2 puntos, es un hijo (ej. I.003.031)
                sParentKey = sKey.substring(0, sKey.lastIndexOf("."));
            }
            // Si tiene solo 1 punto (ej. I.003), sParentKey se mantiene null (es un padre)



            var aCurrent = oDefaultModel.getProperty("/catalog/models/categories");
            var aWorkingCopy = this._mergeModifications(
                JSON.parse(JSON.stringify(this._fullCategoriesBackup)),
                aCurrent
            );



            var aFilteredRoot = [];

            for (var i = 0; i < aWorkingCopy.length; i++) {
                var rootCat = aWorkingCopy[i];



                if (!Array.isArray(rootCat.categories)) {
                    rootCat.categories = [];
                }

                // Caso 1: Padre principal (ej. I.003)
                if (rootCat.name === sKey && !sParentKey) {

                    aFilteredRoot.push(rootCat);
                    continue;
                }

                // Caso 2: Hijo específico (ej. I.003.031)
                if (sParentKey) {

                    var aFilteredChildren = this._filterCategories(rootCat.categories, sKey);
                    var bIncludeParent = rootCat.name === sParentKey;



                    if (aFilteredChildren.length === 0 && !bIncludeParent) {

                        continue;
                    }

                    if (aFilteredChildren.length > 0) {
                        rootCat.categories = aFilteredChildren;
                    } else if (bIncludeParent) {
                        rootCat.categories = this._filterCategories(rootCat.categories, sKey);
                    }


                    aFilteredRoot.push(rootCat);
                }
            }


            for (var j = 0; j < aFilteredRoot.length; j++) {

            }

            oDefaultModel.setProperty("/catalog/models/categories", aFilteredRoot);

            setTimeout(function () {
                var oBinding = oTable.getBinding("rows");
                if (!oBinding) return;

                var bHasData = false;
                var bAnyDetailExpanded = false; // Nueva variable

                // Se colapsa todo primero
                oTable.collapseAll();

                for (var i = 0; i < oBinding.getLength(); i++) {
                    var oCtx = oTable.getContextByIndex(i);
                    var oObj = oCtx && oCtx.getObject();
                    if (!oObj) continue;

                    // Se expande según el caso
                    if (sParentKey) {
                        // Caso 2: Hijo específico, se expande padre e hijo
                        if ((oObj.name === sParentKey || oObj.name === sKey) && oObj.expandible) {
                            oTable.expand(i);

                            // Se verifica si el nodo expandido tiene nietos (isGroup)
                            if (oObj.name === sKey &&
                                Array.isArray(oObj.categories) &&
                                oObj.categories.length > 0 &&
                                oObj.categories[0].isGroup === true) {
                                bAnyDetailExpanded = true;
                            }
                        }
                    } else if (sKey) {
                        // Caso 1: Padre principal, se expande solo el nodo con hijos
                        if (oObj.name === sKey && oObj.expandible === true) {

                            oTable.expand(i);

                            // Se verifica si el padre tiene nietos (isGroup)
                            if (Array.isArray(oObj.categories) &&
                                oObj.categories.length > 0 &&
                                oObj.categories[0].isGroup === true) {
                                bAnyDetailExpanded = true;
                            }
                        }
                    }

                    // Se mantiene la lógica original para bHasData (opcional, si sirve)
                    if (Array.isArray(oObj.categories)) {
                        if (oObj.categories.some(c => c.isGroup === true)) {
                            bHasData = true;
                        }
                    }
                }

                // Se utiliza bAnyDetailExpanded en lugar de bHasData
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
                        // Se copian valores de años y meses
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
        },
        onRowSelectionChange: function (oEvent) {

            if (this._lock) return;
            this._lock = true;

            var oTable = oEvent.getSource();
            var aIndices = oEvent.getParameter("rowIndices");

            if (!aIndices || !aIndices.length) {
                this._lock = false;
                return;
            }

            var iRow = aIndices[0];
            var oCtx = oTable.getContextByIndex(iRow);
            if (!oCtx) {
                this._lock = false;
                return;
            }

            var bSelected = oTable.isIndexSelected(iRow);
            var iLen = oTable.getBinding("rows").getLength();
            var sPath = oCtx.getPath();
            var iLevel = sPath.split("/categories").length - 1;
            var oObj = oCtx.getObject();

            if (iLevel >= 3) {

                var sParentPath = sPath.substring(0, sPath.lastIndexOf("/categories"));

                var firstChildIndex = null;
                for (var j = 0; j < iLen; j++) {
                    var oCtx2 = oTable.getContextByIndex(j);
                    if (!oCtx2) continue;

                    var sP = oCtx2.getPath();
                    var iLvl = sP.split("/categories").length - 1;

                    if (iLvl === iLevel && sP.startsWith(sParentPath + "/categories")) {
                        firstChildIndex = j;
                        break;
                    }
                }

                if (firstChildIndex === iRow) {
                    for (var k = 0; k < iLen; k++) {
                        var oCtx3 = oTable.getContextByIndex(k);
                        if (!oCtx3) continue;

                        var sP3 = oCtx3.getPath();
                        var iLvl3 = sP3.split("/categories").length - 1;

                        if (iLvl3 === iLevel && sP3.startsWith(sParentPath + "/categories")) {
                            if (bSelected) {
                                oTable.addSelectionInterval(k, k);
                            } else {
                                oTable.removeSelectionInterval(k, k);
                            }
                        }
                    }
                }

                this._lock = false;
                return;
            }

            this._lock = false;
        },
        _createSnapshot: function () {

            var oModel = this.getView().getModel();

            if (oModel) {
                this._originalData = JSON.parse(
                    JSON.stringify(oModel.getData())
                );
            }
        }
        ,
        /* Resetea todos los inputs dinámicos (años y meses) y recrea el snapshot
        */
        resetInputs: function () {
            if (!this._originalData) return;
            var oDefaultModel = this.getView().getModel();
            // Copia profunda para evitar referencias al objeto original
            var oResetCopy = jQuery.extend(true, {}, this._originalData);
            oDefaultModel.setData(oResetCopy);
            oDefaultModel.refresh(true);
        },
        /**
        * Verifica si hay cambios no guardados comparando el modelo actual con el snapshot
        */
        hasUnsavedChanges: function () {


            if (!this._originalData) return false;

            var oDefaultModel = this.getView().getModel();
            if (!oDefaultModel) return false;

            var aCurrentCat = oDefaultModel.getProperty("/catalog/models/categories");
            var aOriginalCat = this._originalData.catalog.models.categories;

            /**
             * Helper de Normalización Avanzado
             * Convierte en cadena vacía todo lo que sea "zero-like"
             */
            var normalize = function (val) {
                // Si es null, undefined o una cadena vacía
                if (val === undefined || val === null || val === "") return "";

                // Si es un array (ej. el caso 0,0,0,0...), se une y se comprueba si contiene solo ceros o está vacío
                if (Array.isArray(val)) {
                    var sJoined = val.join("").replace(/,/g, "").trim();
                    return (sJoined === "" || /^0+$/.test(sJoined)) ? "" : sJoined;
                }

                var sVal = val.toString().trim();

                // Si la cadena resultante es "0", "0,0,0..." o "0.00", se considera vacía
                if (sVal === "0" || sVal === "0.0" || sVal === "0,0" || /^0+(?:[.,]0+)*$/.test(sVal) || /^0+(?:,0+)*$/.test(sVal)) {
                    return "";
                }

                return sVal;
            };

            var checkRecursive = function (aCurrent, aOriginal, sPath) {
                if (!aCurrent) return false;

                for (var i = 0; i < aCurrent.length; i++) {
                    var oCur = aCurrent[i];
                    var oOri = (aOriginal && aOriginal[i]) ? aOriginal[i] : {};
                    var currentPath = sPath + " -> " + (oCur.name || i);

                    for (var key in oCur) {
                        // 1. Control de Años y Meses (y2026, m2026_01)
                        if (/^y\d{4}$/.test(key) || /^m\d{4}_\d+$/.test(key)) {
                            if (normalize(oCur[key]) !== normalize(oOri[key])) {

                                return true;
                            }
                        }

                        // 2. Control del objeto 'months' (el caso crítico)
                        if (key === "months" && oCur[key] && typeof oCur[key] === "object") {
                            for (var mKey in oCur[key]) {
                                var vCurM = normalize(oCur[key][mKey]);
                                var vOriM = (oOri.months) ? normalize(oOri.months[mKey]) : "";

                                if (vCurM !== vOriM) {

                                    return true;
                                }
                            }
                        }
                    }

                    // 3. Recursión sobre los hijos
                    if (oCur.categories && Array.isArray(oCur.categories) && oCur.categories.length > 0) {
                        if (checkRecursive(oCur.categories, oOri.categories, currentPath)) {
                            return true;
                        }
                    }
                }
                return false;
            };

            var bResult = checkRecursive(aCurrentCat, aOriginalCat, "Root");

            return bResult;
        },
        onSave: function () {

            var oModel = this.getView().getModel();
            var oUiModel = this.getView().getModel("ui");
            var oBundle = this.getView().getModel("i18n").getResourceBundle();

            if (!oModel) return;

            sap.m.MessageBox.confirm(
                oBundle.getText("saveConfirmMessage"),
                {
                    title: oBundle.getText("saveConfirmTitle"),
                    actions: [
                        sap.m.MessageBox.Action.OK,
                        sap.m.MessageBox.Action.CANCEL
                    ],
                    emphasizedAction: sap.m.MessageBox.Action.OK,

                    onClose: function (oAction) {

                        if (oAction === sap.m.MessageBox.Action.OK) {

                            // 🔹 Tu lógica original intacta
                            this._editBackupData = JSON.parse(JSON.stringify(oModel.getData()));
                            oUiModel.setProperty("/isEditMode", false);

                            sap.m.MessageToast.show(
                                oBundle.getText("saveSuccess")
                            );
                        }

                    }.bind(this)
                }
            );
        }
        ,
        onCancelPress: function () {

            var oUiModel = this.getView().getModel("ui");

            sap.m.MessageBox.confirm(
                "¿Seguro que desea cancelar los cambios?",
                {
                    actions: [
                        sap.m.MessageBox.Action.OK,
                        sap.m.MessageBox.Action.CANCEL
                    ],

                    onClose: function (oAction) {

                        if (oAction === sap.m.MessageBox.Action.OK) {

                            var oModel = this.getView().getModel();
                            oModel.loadData("model/Catalog.json");

                            oUiModel.setProperty("/isEditMode", false);
                        }

                    }.bind(this)
                }
            );
        },

        // Guarda los valores originales de la fila y aplica o restaura la inflacion
        onInflacionCheckBoxSelect: function (oEvent) {
            var oCheckBox = oEvent.getSource();
            var bSelected = oCheckBox.getSelected();
            var oCtx = oCheckBox.getBindingContext();
            if (!oCtx) return;

            var sPath = oCtx.getPath();

            if (bSelected) {
                this._applyInflacionToRow(sPath);
            } else {
                this._restoreInflacionRow(sPath);
            }
        },

        // Se ejecuta cuando el usuario modifica el valor del input de inflacion en la barra de herramientas
        oninflacionInputChange: function (oEvent) {
            var oInput = oEvent.getSource();
            var fValue = parseFloat(oInput.getValue()) || 0;

            // Se formatea el valor con dos decimales
            oInput.setValue(fValue.toFixed(2));

            var oModel = this.getView().getModel();
            var aCategories = oModel.getProperty("/catalog/models/categories");

            // Se recalculan todas las filas que tienen el checkbox de inflacion activo
            var that = this;
            var recalculate = function (aNodes) {
                if (!Array.isArray(aNodes)) return;
                aNodes.forEach(function (oNode) {
                    if (oNode.flag2 === true) {
                        // Se obtiene la ruta del nodo en el modelo
                        var sPath = that._findPathByNode(oNode, aCategories);
                        if (sPath) {
                            // Se restaura el valor original antes de aplicar el nuevo porcentaje
                            that._restoreInflacionRow(sPath, true);
                            that._applyInflacionToRow(sPath);
                        }
                    }
                    if (Array.isArray(oNode.categories)) {
                        recalculate(oNode.categories);
                    }
                });
            };
            recalculate(aCategories);
        },

        // Se aplica el porcentaje de inflacion a todos los campos dinamicos de anios y meses de la fila
        _applyInflacionToRow: function (sPath) {
            var oModel = this.getView().getModel();
            var oRow = oModel.getProperty(sPath);
            if (!oRow) return;

            var fInflacion = parseFloat(
                this.byId("inflacionInput") ? this.byId("inflacionInput").getValue() : 0
            ) || 0;

            // Se inicializa el contenedor de valores originales si no existe
            if (!this._inflacionOriginals) this._inflacionOriginals = {};
            if (!this._inflacionOriginals[sPath]) this._inflacionOriginals[sPath] = {};

            var oOriginals = this._inflacionOriginals[sPath];

            Object.keys(oRow).forEach(function (sKey) {
                // Se procesan unicamente las claves dinamicas de anios (y2025) y meses (m2025_0)
                if (/^y\d{4}$/.test(sKey) || /^m\d{4}_\d+$/.test(sKey)) {
                    var fOriginal = parseFloat(oRow[sKey]) || 0;

                    // Se omiten los campos vacios o con valor cero
                    if (fOriginal === 0) return;

                    // Se guarda el valor original unicamente la primera vez
                    if (oOriginals[sKey] === undefined) {
                        oOriginals[sKey] = oRow[sKey];
                    }

                    var fCalculated = fOriginal * (1 + fInflacion / 100);
                    oModel.setProperty(sPath + "/" + sKey, fCalculated.toFixed(2));
                }
            });
        },

        // Se restauran los valores originales de la fila indicada
        // El parametro skipDelete permite mantener los originales en memoria para un recalculo posterior
        _restoreInflacionRow: function (sPath, skipDelete) {
            if (!this._inflacionOriginals || !this._inflacionOriginals[sPath]) return;

            var oModel = this.getView().getModel();
            var oOriginals = this._inflacionOriginals[sPath];

            Object.keys(oOriginals).forEach(function (sKey) {
                oModel.setProperty(sPath + "/" + sKey, oOriginals[sKey]);
            });

            if (!skipDelete) {
                delete this._inflacionOriginals[sPath];
            }
        },

        // Se localiza la ruta en el modelo a partir de la referencia directa al nodo
        _findPathByNode: function (oTargetNode, aCategories, sBasePath) {
            sBasePath = sBasePath || "/catalog/models/categories";
            for (var i = 0; i < aCategories.length; i++) {
                var sPath = sBasePath + "/" + i;
                if (aCategories[i] === oTargetNode) return sPath;
                if (Array.isArray(aCategories[i].categories)) {
                    var sFound = this._findPathByNode(
                        oTargetNode,
                        aCategories[i].categories,
                        sPath + "/categories"
                    );
                    if (sFound) return sFound;
                }
            }
            return null;
        }

    });
});
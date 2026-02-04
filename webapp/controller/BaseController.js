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

            // delegate teclado
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

                            if (oCell.isA("sap.m.Input")) {

                                //  elimina correctamente (misma referencia)
                                oCell.removeEventDelegate(this._arrowDelegate);

                                //  añade UNA sola vez
                                oCell.addEventDelegate(this._arrowDelegate);
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
                if (oCol.data("dynamicYear") === true || oCol.data("dynamicMonth") === true) {
                    oTable.removeColumn(oCol);
                }
            }
            this._openedYear = null; // Chiude eventuali mesi aperti

            // Recuperiamo iSkipFields o usiamo il default 10
            var iStartFrom = (iSkipFields !== undefined) ? iSkipFields : 10;

            var aYears = [];
            for (var i = 0; i < iHowMany; i++) {
                aYears.push(iStartYear + i);
            }

            aYears.forEach(function (iYear, index) { // Aggiunto 'index' per il formatter
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
                    template: new sap.m.FlexBox({
                        renderType: "Bare",
                        width: "100%",
                        items: [
                            // --- INPUT (Mantenuta la tua logica liveChange) ---
                            new sap.m.Input({
                                width: "100%",
                                textAlign: "End",
                                value: "{y" + iYear + "}",
                                visible: "{= ${expandible} !== false && !${isGroup} }",
                                liveChange: function (oEvt) {
                                    var oInput = oEvt.getSource();
                                    var oCtx = oInput.getBindingContext();
                                    var oRow = oCtx.getObject();
                                    var oModel = oCtx.getModel();

                                    var total = parseFloat(oInput.getValue().replace(',', '.')) || 0;

                                    if (!oModel.getProperty(oCtx.getPath() + "/monthsData")) {
                                        oModel.setProperty(oCtx.getPath() + "/monthsData", {});
                                    }
                                    if (!oModel.getProperty(oCtx.getPath() + "/monthsData/" + iYear)) {
                                        var aMonth = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
                                        var currentMonth = new Date().getMonth();
                                        var currentYear = new Date().getFullYear();
                                        var startMonth = (iYear === currentYear) ? currentMonth + 1 : 0;
                                        oRow.months[iYear] = Array(aMonth.slice(startMonth).length).fill(0);
                                    }

                                    var n = oRow.months[iYear].length;
                                    var perMonth = Math.round((total / n) * 100) / 100;
                                    oRow.months[iYear] = Array(n).fill(perMonth);

                                    oModel.setProperty(oCtx.getPath() + "/months/" + iYear, oRow.months[iYear]);
                                    oModel.setProperty(oCtx.getPath() + "/y" + iYear, total);
                                    oModel.refresh(true);
                                }
                            }).addStyleClass("sapUiSizeCompact"),

                            // --- TEXT (Ripristinato dalla prima versione) ---
                            new sap.m.Text({
                                width: "100%",
                                textAlign: "Center",
                                visible: "{= ${expandible} === false }",
                                wrapping: false,
                                text: {
                                    path: "",
                                    formatter: function (oRow) {
                                        if (!oRow || oRow.expandible !== false) return "";
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
        onYearChange: function (oEvent) {
            var sSelectedYear = parseInt(oEvent.getParameter("selectedItem").getKey(), 10);

            // Chiamiamo la tua funzione per ridisegnare le colonne
            // Passiamo "TreeTableBasic" come ID e 3 come numero di anni da mostrare
            this.createYearColumns("TreeTableBasic", sSelectedYear, 3);
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
    var oSource = oEvent.getSource();
    var oTable = this.byId(sTableId || "TreeTableBasic");
    
    var bShowEjecutado = this.byId("idEjecutadoCheckBox") ? this.byId("idEjecutadoCheckBox").getSelected() : false;
    
    var sYearText = "";
    var sSourceName = oSource.getMetadata().getName();
    if (sSourceName === "sap.m.Button") {
        sYearText = oSource.getText();
        if (isNaN(parseInt(sYearText, 10))) sYearText = oSource.getParent().getItems()[0].getText();
    } else {
        sYearText = String(this._openedYear);
    }

    var sYear = parseInt(sYearText, 10);
    if (!sYear) return;

    // Toggle chiusura
    if (this._openedYear === sYear && sSourceName === "sap.m.Button") {
        this._openedYear = null;
        oTable.getColumns().filter(c => c.data("dynamicMonth")).forEach(c => oTable.removeColumn(c));
        return;
    }

    oTable.getColumns().filter(c => c.data("dynamicMonth")).forEach(c => oTable.removeColumn(c));
    this._openedYear = sYear;

    var aMonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var currentYear = new Date().getFullYear();
    var currentMonth = new Date().getMonth();

    // Se checkbox è ON partiamo da Gennaio (0), altrimenti dal mese prossimo
    var iStartIdx = (sYear === currentYear && !bShowEjecutado) ? currentMonth + 1 : 0;

    var oYearCol = oTable.getColumns().find(c => {
        var lab = c.getLabel();
        var txt = lab.getText ? lab.getText() : (lab.getItems ? lab.getItems()[0].getText() : "");
        return txt === String(sYear);
    });
    var colIndex = oTable.indexOfColumn(oYearCol);
    var iOffset = 0;

    // 1. Colonna riassuntiva "Ejecutados"
    if (bShowEjecutado) {
        var oColEjec = new sap.ui.table.Column({
            width: "8rem",
            label: new sap.m.VBox({
                alignItems: "Center", renderType: "Bare", width: "100%",
                items: [
                    new sap.m.Text({ text: String(sYear) }).addStyleClass("sapUiTinyFontSize textoaño"),
                    new sap.m.Label({ text: "Ejecutados", design: "Bold" }).addStyleClass("testBold")
                ]
            }),
            template: new sap.m.Text({ text: "{ejecutado}", textAlign: "End", width: "100%" })
        }).data("dynamicMonth", true);
        oTable.insertColumn(oColEjec, colIndex + iOffset);
        iOffset++;
    }

    // 2. Colonne dei mesi (Testo per il passato, Input per il futuro)
    for (var i = iStartIdx; i < 12; i++) {
        var sMonthLabel = aMonthNames[i];
        var iRealIdx = i;
        var bIsPassedMonth = (sYear < currentYear) || (sYear === currentYear && i <= currentMonth);
        
        // --- LOGICA TEMPLATE DINAMICO ---
        // Se il mese è passato E la checkbox è attiva, mostriamo un sap.m.Text
        var oControlTemplate;
        
        if (bShowEjecutado && bIsPassedMonth) {
            oControlTemplate = new sap.m.Text({
                text: "{monthsData/" + sYear + "/" + iRealIdx + "}",
                textAlign: "End",
                width: "100%"
            }).addStyleClass("sapUiTinyMarginEnd"); // Un po' di padding per estetica
        } else {
            oControlTemplate = new sap.m.Input({
                value: "{monthsData/" + sYear + "/" + iRealIdx + "}",
                textAlign: "End",
                visible: "{= ${expandible} !== false && !${isGroup} }",
                liveChange: function (oEvt) {
                    var oInput = oEvt.getSource();
                    var oCtx = oInput.getBindingContext();
                    var oModel = oCtx.getModel();
                    var sPath = oCtx.getPath();
                    
                    if (!oModel.getProperty(sPath + "/monthsData/" + sYear)) {
                        oModel.setProperty(sPath + "/monthsData/" + sYear, Array(12).fill(""));
                    }
                    // var val = parseFloat(oInput.getValue().replace(',', '.')) || 0;
                    // var aMonths = oModel.getProperty(sPath + "/monthsData/" + sYear).slice();
                    // // aMonths[iRealIdx] = Math.round(val * 100) / 100;
                    // oModel.setProperty(sPath + "/monthsData/" + sYear, aMonths);
                    
                    // var total = aMonths.reduce((a, b) => a + (parseFloat(b) || 0), 0);
                    // // oModel.setProperty(sPath + "/y" + sYear, Math.round(total * 100) / 100);
                }
            });
        }

        var oColumn = new sap.ui.table.Column({
            width: "8rem",
            label: new sap.m.VBox({
                alignItems: "Center", renderType: "Bare", width: "100%",
                items: [
                    new sap.m.Text({ text: String(sYear) }).addStyleClass("sapUiTinyFontSize textoaño"),
                    (i === iStartIdx) ? new sap.m.Button({
                        text: sMonthLabel, type: "Transparent", width: "100%",
                        icon: "sap-icon://slim-arrow-right", iconFirst: false,
                        press: function (oEv) { this.onCreateMonthsTable(oEv, sTableId); }.bind(this)
                    }).addStyleClass("testBold") : new sap.m.Label({ text: sMonthLabel, textAlign: "Center", width: "100%" }).addStyleClass("testBold")
                ]
            }),
            template: oControlTemplate
        }).data("dynamicMonth", true);
        
        oTable.insertColumn(oColumn, colIndex + iOffset + (i - iStartIdx));
    }
},

onEjecutadoCheckBoxSelect: function (oEvent) {
    // Verifichiamo se c'è un anno attualmente aperto (espanso)
    // Se c'è, richiamiamo la creazione dei mesi per aggiornare la visualizzazione
    if (this._openedYear) {
        // Passiamo l'evento oEvent così la funzione onCreateMonthsTable 
        // sa che la chiamata arriva dalla Checkbox
        this.onCreateMonthsTable(oEvent);
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

            // Busca el grupo de datos correspondiente a la posición actual del scroll.
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

            // Muestra u oculta los elementos fijos si su contraparte original ya no está en pantalla.
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
                // Determina el inicio de un nuevo grupo basándose en la existencia de subcategorías.
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

            console.log("Calcolo Dinamico: Finestra " + iHeight + "px -> Righe " + iRows);

            // Actualiza el modelo (asumiendo que el modelo se llama 'view')
            this.getView().getModel("viewModel").setProperty("/dynamicRowCount", iRows);
        },
        _filterCategories: function (aCategories, sKey) {
            return aCategories
                .map(function (cat) {
                    var newCat = Object.assign({}, cat);

                    if (cat.categories) {
                        // Filtramos hijos recursivamente
                        newCat.categories = this._filterCategories(cat.categories, sKey);
                    }

                    // Si el nodo coincide con el key, mantenemos todos sus hijos originales
                    if (cat.name === sKey) {
                        newCat.categories = cat.categories || [];
                        return newCat;
                    }

                    // Mantener nodo si tiene hijos filtrados
                    if (newCat.categories && newCat.categories.length > 0) {
                        return newCat;
                    }

                    return null;
                }.bind(this))
                .filter(Boolean);
        },
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

            // Colapso grupo target
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

                // RESET UI si todo esta cerrado
                if (!bAnyDetailExpanded) {

                    this._aGroupRanges = [];

                    oUiModel.setProperty("/showStickyAgrupador", false);
                    oUiModel.setProperty("/showStickyParent", false);
                    oUiModel.setProperty("/showStickyChild", false);
                }
                //RESET STICKY HEADER
                if (!oUiModel.getProperty("/showStickyParent") &&
                    !oUiModel.getProperty("/showStickyChild")) {

                    oUiModel.setProperty("/stickyHeaderData", null);
                }

            }.bind(this), 0);
        },
        _onInputKeyDown: function (oEvent) {
            var iKeyCode = oEvent.keyCode;
            var bDown = iKeyCode === 40;
            var bUp = iKeyCode === 38;
            var bRight = iKeyCode === 39;
            var bLeft = iKeyCode === 37;

            if (!bDown && !bUp && !bRight && !bLeft) return;

            var oInput = oEvent.srcControl;

            // Sincronizacion rapida valores
            var sCurrentDomValue = oInput.getFocusDomRef().value;
            oInput.setValue(sCurrentDomValue);
            oInput.updateModelProperty(sCurrentDomValue);

            oEvent.preventDefault();
            oEvent.stopImmediatePropagation();

            var oTable = this.byId("TreeTableBasic");
            var oBinding = oTable.getBinding("rows");
            var iTargetRowIndex = oInput.getParent().getIndex(); // riga corrente
            var iTargetColIndex = oInput.getParent() ? oInput.getParent().indexOfCell(oInput) : -1;

            if (iTargetColIndex === -1) iTargetColIndex = oTable.getRows()[0].indexOfCell(oInput);

            // Navigacion orizontal
            if (bLeft || bRight) {
                iTargetColIndex = bRight ? iTargetColIndex + 1 : iTargetColIndex - 1;
                if (iTargetColIndex < 0 || iTargetColIndex >= oTable.getColumns().length) return;

                // Recupera fila visible correcta
                var iVisibleRowIndex = iTargetRowIndex - oTable.getFirstVisibleRow();
                if (iVisibleRowIndex < 0 || iVisibleRowIndex >= oTable.getRows().length) return;

                var oRow = oTable.getRows()[iVisibleRowIndex];
                if (!oRow) return;

                var oCell = oRow.getCells()[iTargetColIndex];
                var oTargetInput = this._recursiveGetInput(oCell);

                if (oTargetInput && oTargetInput.getVisible()) {
                    oTargetInput.focus();
                    if (oTargetInput.select) oTargetInput.select();
                }
                return;
            }

            // Navigacion vertical
            var iNextIndex = iTargetRowIndex;
            while (true) {
                iNextIndex = bDown ? iNextIndex + 1 : iNextIndex - 1;
                if (iNextIndex < 0 || iNextIndex >= oBinding.getLength()) return;

                var oCtx = oTable.getContextByIndex(iNextIndex);
                var oData = oCtx ? oCtx.getObject() : null;

                if (oData && oData.name !== "Agrupador" && oData.name !== "" && oData.name !== undefined) {
                    iTargetRowIndex = iNextIndex;
                    break;
                }
            }

            // Revisa que la fila target sea visible
            var iFirstVisible = oTable.getFirstVisibleRow();
            var iVisibleCount = oTable.getVisibleRowCount();

            if (iTargetRowIndex >= iFirstVisible + iVisibleCount) {
                oTable.setFirstVisibleRow(iTargetRowIndex - iVisibleCount + 1);
            } else if (iTargetRowIndex < iFirstVisible) {
                oTable.setFirstVisibleRow(iTargetRowIndex);
            }

            // FOCUS con un pequeño retraso para que la fila tenga tiempo de renderizarse
            setTimeout(function () {
                var oRow = oTable.getRows().find(function (r) {
                    var oCtx = r.getBindingContext();
                    return oCtx && oCtx.getPath() === oTable.getContextByIndex(iTargetRowIndex).getPath();
                });
                if (!oRow) return;

                var oCell = oRow.getCells()[iTargetColIndex];
                var oTargetInput = this._recursiveGetInput(oCell);
                if (oTargetInput && oTargetInput.getVisible()) {
                    oTargetInput.focus();
                    if (oTargetInput.select) oTargetInput.select();
                }
            }.bind(this), 50);
        },
        _recursiveGetInput: function (oControl) {
            if (!oControl) return null;
            if (oControl.isA("sap.m.Input") && oControl.getVisible() && oControl.getEditable()) {
                return oControl;
            }

            // Verifica hijos en VBox, HBox, etc.
            if (oControl.getContent) {
                var aContent = oControl.getContent();
                for (var i = 0; i < aContent.length; i++) {
                    var res = this._recursiveGetInput(aContent[i]);
                    if (res) return res;
                }
            }
            // Verifica items (ej. en FlexBox o similares)
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
          * Función que filtra las operaciones 
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
}, /**
        * Filtra la TreeTable según la operación seleccionada en el Select
        */
      onOperacionChange: function (oEvent) {
    var oSelectedItem = oEvent.getParameter("selectedItem");
    var oTable = this.byId("TreeTableBasic");
    var oCatalogModel = this.getView().getModel("catalog");
    var oUiModel = this.getView().getModel("ui");
    var aCategories = oCatalogModel.getProperty("/catalog/models/categories");

    if (!Array.isArray(aCategories)) return;

    if (!oSelectedItem) {
        oTable.setModel(new JSONModel({ categories: aCategories }));
        oTable.bindRows("/categories");

        // Nascondi colonne per default
        if (this.byId("colMonths")) this.byId("colMonths").setVisible(false);
        if (this.byId("colNew")) this.byId("colNew").setVisible(false);

        oUiModel?.setProperty("/showStickyParent", false);
        oUiModel?.setProperty("/showStickyChild", false);

        setTimeout(function () {
            oTable.collapseAll();
            oTable.invalidate();
            this._refreshAfterToggle(oTable.getId());
        }.bind(this), 0);

        return;
    }

    var sKey = oSelectedItem.getKey();
    var aFilteredRoot = [];

    aCategories.forEach(function (rootCat) {
        if (!Array.isArray(rootCat.categories)) rootCat.categories = [];

        var aFilteredChildren = this._filterCategories(rootCat.categories, sKey);
        var includeParent = rootCat.name === sKey;

        if (aFilteredChildren.length === 0 && !includeParent) return;

        var oParentClone = Object.assign({}, rootCat);
        oParentClone.categories = aFilteredChildren.length > 0 ? aFilteredChildren : rootCat.categories;
        aFilteredRoot.push(oParentClone);
    }.bind(this));

    oTable.setModel(new JSONModel({ categories: aFilteredRoot }));
    oTable.bindRows("/categories");

    var aNoAutoExpand = aFilteredRoot
        .filter(c => c.noAutoExpand || !c.expandible)  
        .map(c => c.name);

    setTimeout(function () {
        var oBinding = oTable.getBinding("rows");
        if (!oBinding) return;

        var bHasData = false;

        for (var i = 0; i < oBinding.getLength(); i++) {
            var oCtx = oTable.getContextByIndex(i);
            var oObj = oCtx && oCtx.getObject();

            if (oObj && oObj.expandible && !aNoAutoExpand.includes(oObj.name)) {
                oTable.expand(i);
            }

            if (oObj && Array.isArray(oObj.categories)) {
                var bHasGroup = oObj.categories.some(child => child.isGroup === true);
                if (bHasGroup) bHasData = true;
            }
        }

        if (this.byId("colMonths")) this.byId("colMonths").setVisible(bHasData);
        if (this.byId("colNew")) this.byId("colNew").setVisible(bHasData);

        var oFirstCtx = oTable.getContextByIndex(0);
        if (oFirstCtx) {
            this._sLastExpandedPath = oFirstCtx.getPath();
            if (oUiModel) {
                oUiModel.setProperty("/showStickyParent", true);
                oUiModel.setProperty("/showStickyChild", true);
            }

            this._refreshAfterToggle(oTable.getId());
        }

    }.bind(this), 100);
},

    });
});
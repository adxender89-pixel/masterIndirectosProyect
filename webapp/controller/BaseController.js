sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
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
    Fragment,
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
    Label,
    Text,
    VBox
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
            this._openedYear = null; // Cerrar meses abiertos

            var iStartFrom = (iSkipFields !== undefined) ? iSkipFields : 10;

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
                    template: new sap.m.Input({
                        width: "100%",
                        textAlign: "End",
                        editable: "{= ${expandible} !== false }",
                        value: {
                            parts: [{ path: "" }],
                            formatter: function (oRow) {
                                if (!oRow || !oRow.hasOwnProperty("expandible")) return "";

                                if (oRow.expandible === false) {
                                    var aKeys = Object.keys(oRow);
                                    var sTargetKey = aKeys[iStartFrom + index];
                                    return sTargetKey ? oRow[sTargetKey] : "";
                                }

                                return oRow["y" + iYear] || "";
                            }
                        },
                        visible: "{= ${expandible} !== false && !${isGroup} }",
                        liveChange: function (oEvt) {
                            var oInput = oEvt.getSource();
                            var oCtx = oInput.getBindingContext();
                            var oRow = oCtx.getObject();
                            var oModel = oCtx.getModel();

                            var total = parseFloat(oInput.getValue().replace(',', '.')) || 0;

                            if (!oRow.months) oRow.months = {};
                            if (!oRow.months[iYear]) {
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
                    }).addStyleClass("sapUiSizeCompact")
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
            var oTable = this.byId(sTableId);
            if (!oTable) return;

            var iFirst = oTable.getFirstVisibleRow();
            var aRows = oTable.getRows();

            aRows.forEach((oRow, i) => {
                var oCtx = oTable.getContextByIndex(iFirst + i);
                if (!oCtx) return;
                var oObj = oCtx.getObject();

                // reset solo se necessario
                if (oObj && oObj.cabecera) oRow.addStyleClass("cabeceracolor");
                else oRow.removeStyleClass("cabeceracolor");

                if (oObj && oObj.expandible) oRow.addStyleClass("cabeceracolor-Group");
                else oRow.removeStyleClass("cabeceracolor-Group");
            });
        }
        ,

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

            var iStartIdx = (sYear === currentYear && !bShowEjecutado) ? currentMonth + 1 : 0;

            var oYearCol = oTable.getColumns().find(c => {
                var lab = c.getLabel();
                var txt = lab.getText ? lab.getText() : (lab.getItems ? lab.getItems()[0].getText() : "");
                return txt === String(sYear);
            });
            var colIndex = oTable.indexOfColumn(oYearCol);
            var iOffset = 0;

            //Columna "Ejecutados"
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

            // Columna mese de "Ejecutado"
            for (var i = iStartIdx; i < 12; i++) {
                var sMonthLabel = aMonthNames[i];
                var iRealIdx = i;
                var bIsPassedMonth = (sYear < currentYear) || (sYear === currentYear && i <= currentMonth);

                var oControlTemplate;

                if (bShowEjecutado && bIsPassedMonth) {
                    oControlTemplate = new sap.m.Text({
                        text: "{monthsData/" + sYear + "/" + iRealIdx + "}",
                        textAlign: "End",
                        width: "100%"
                    }).addStyleClass("sapUiTinyMarginEnd");
                } else {
                    oControlTemplate = new sap.m.Input({
                        value: "{m" + sYear + "_" + iRealIdx + "}",
                        textAlign: "End",
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
            if (this._openedYear) {
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
        },_buildGroupRanges: function (sTableId) {
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
         * Analiza el modelo de la tabla para definir los rangos de índices de cada grupo de datos.
         */

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
                oTable.setModel(new sap.ui.model.json.JSONModel({ categories: aCategories }));
                oTable.bindRows("/categories");

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

            var sKey = oSelectedItem.getKey();

            var sParentKey = sKey.includes(".")
                ? sKey.substring(0, sKey.lastIndexOf("."))
                : null;

            var aFilteredRoot = [];

            aCategories.forEach(function (rootCat) {
                if (!Array.isArray(rootCat.categories)) {
                    rootCat.categories = [];
                }

                var aFilteredChildren = this._filterCategories(rootCat.categories, sKey);

                var bIncludeParent =
                    rootCat.name === sKey ||
                    (sParentKey && rootCat.name === sParentKey);

                if (aFilteredChildren.length === 0 && !bIncludeParent) {
                    return;
                }

                var oClone = Object.assign({}, rootCat);

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

                    console.log(" Aggiungo nodo parent");
                    aFilteredRoot.push(rootCat);
                })

          
            for (var j = 0; j < aFilteredRoot.length; j++) {
                console.log("  " + j + ": " + aFilteredRoot[j].name + ", expandible=" + aFilteredRoot[j].expandible + ", children=" + (aFilteredRoot[j].categories ? aFilteredRoot[j].categories.length : 0));
            }

            oTable.setModel(new sap.ui.model.json.JSONModel({ categories: aFilteredRoot }));
            oTable.bindRows("/categories");

            setTimeout(function () {
                var oBinding = oTable.getBinding("rows");
                if (!oBinding) return;

                var bHasData = false;

                for (var i = 0; i < oBinding.getLength(); i++) {
                    var oCtx = oTable.getContextByIndex(i);
                    var oObj = oCtx && oCtx.getObject();
                    if (!oObj) continue;

                    if (oObj.name === sParentKey || oObj.name === sKey) {
                        if (oObj.expandible) {
                            oTable.expand(i);
                        }
                    }

                    if (
                        sParentKey &&
                        oObj.name === sKey &&
                        oObj.expandible
                    ) {
                        oTable.expand(i);
                    }

                    if (Array.isArray(oObj.categories)) {
                        if (oObj.categories.some(c => c.isGroup === true)) {
                            bHasData = true;
                        }
                    }
                }

                this.byId("colMonths")?.setVisible(bHasData);
                this.byId("colNew")?.setVisible(bHasData);

                oUiModel?.setProperty("/showStickyParent", true);
                oUiModel?.setProperty("/showStickyChild", true);

                this._refreshAfterToggle(oTable.getId());
            }.bind(this), 100);
        },
        openPopover: function (sFragmentName, oSource, sBindPath) {
            var oView = this.getView();
            this._mFragments = this._mFragments || {};

            if (!this._mFragments[sFragmentName]) {
                this._mFragments[sFragmentName] = Fragment.load({
                    id: oView.getId(),
                    name: sFragmentName,
                    controller: this
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);
                    return oPopover;
                });
            }

            this._mFragments[sFragmentName].then(function (oPopover) {
                if (sBindPath) {
                    oPopover.bindElement(sBindPath);
                }
                oPopover.openBy(oSource);
            });
        },
        handlePopoverPress: function (oEvent) {
            var oTable = this.byId("TreeTableBasic");
            var aSelected = oTable.getSelectedIndices();

            if (!aSelected.length) {
                sap.m.MessageToast.show("Seleziona un nodo");
                return;
            }

            var iIndex = aSelected[0];
            var oContext = oTable.getContextByIndex(iIndex);
            var sPath = oContext.getPath(); // es: /categories/0/categories/2/categories/1

            var oVM = this.getView().getModel("viewModel");
            oVM.setProperty("/selectedNodePath", sPath);

            // Calcolo se il nodo selezionato è un nipote (>= 3 livelli di categories)
            var iLevel = (sPath.match(/categories/g) || []).length;

            if (iLevel >= 3) {
                // Nodo nipote: aggiunge subito un fratello e ritorna
                this.onAddRow();
                return;
            }

            // Nodo non nipote: apri il popover
            if (!this._oPopover) {
                this._oPopover = sap.ui.xmlfragment(
                    "masterindirectos.fragment.Anticipados",
                    this
                );
                this.getView().addDependent(this._oPopover);
            }

            this._oPopover.setModel(oVM, "viewModel");
            this._oPopover.openBy(oEvent.getSource());
        },

        onAddRow: function () {
            var oView = this.getView();
            var oModel = oView.getModel();
            var oVM = oView.getModel("viewModel");

            var sTipo = oVM.getProperty("/selectedTipo") || "OPERACIONES";
            var sPath = oVM.getProperty("/selectedNodePath");

            if (!sPath) {
                sap.m.MessageToast.show("Seleziona un nodo prima di aggiungere una riga");
                return;
            }

            var oNode = oModel.getProperty(sPath);
            if (!oNode) {
                sap.m.MessageToast.show("Nodo selezionato non trovato");
                return;
            }

            var oNewRow = {
                name: "",
                currency: "",
                amount: "",
                pricepending: "",
                pricetotal: "",
                size: "",
                last: "",
                months: "",
                pend: "",
                isInputRow: true,
                isGroup: false,
                cabecera: false,
                categories: []
            };

            // Determina se il nodo selezionato è un nipote o più profondo
            var iLevel = (sPath.match(/categories/g) || []).length;
            if (sTipo === "AGREGACIONES" && iLevel < 3) {

                if (!oNode.categories) oNode.categories = [];

                var aChildren = oNode.categories;

                // 🔴 se il primo elemento è Agrupador, saltiamolo
                var iInsertIndex = 0;
                if (aChildren.length && aChildren[0].cabecera === true) {
                    iInsertIndex = 1;
                }

                // 🔹 inserisce subito DOPO Agrupador
                aChildren.splice(iInsertIndex, 0, oNewRow);

                oModel.setProperty(sPath + "/categories", aChildren);
            } else {
                // CREA FRATELLO per nipoti o OPERACIONES
                var sParentArrayPath;
                if (sPath.lastIndexOf("/categories") !== -1) {
                    sParentArrayPath = sPath.substring(0, sPath.lastIndexOf("/categories")) + "/categories";
                } else {
                    sParentArrayPath = "/catalog/models/categories"; // array principale
                }


                var aSiblings = oModel.getProperty(sParentArrayPath) || [];

                // Trova l'indice del nodo selezionato nell'array dei fratelli
                var iIndex = aSiblings.findIndex(function (item) {
                    return item === oNode; // confrontiamo direttamente l'oggetto
                });

                // Se non lo trova, fallback alla fine
                if (iIndex === -1) iIndex = aSiblings.length - 1;

                // Inserisci subito **dopo** la riga selezionata
                aSiblings.splice(iIndex + 1, 0, oNewRow);

                // Aggiorna il modello
                oModel.setProperty(sParentArrayPath, aSiblings);
            }

            oModel.refresh(true);

            if (this._oPopover) this._oPopover.close();

            setTimeout(function () {
                this._applyCabeceraStyle("TreeTableBasic");
            }.bind(this), 50);
        }
        , onTipoChange: function (oEvent) {
            var sKey = oEvent.getSource().getSelectedKey();

            this.getView()
                .getModel("viewModel")
                .setProperty("/selectedTipo", sKey);
        }

    });
});
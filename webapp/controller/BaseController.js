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

            // Captura el evento de scroll para aplicar lógica de cabeceras
            oTable.attachFirstVisibleRowChanged(function (oEvent) {
                this._onScrollLike(oEvent, sTableId);
            }.bind(this));

            oTable.setFixedColumnCount(2);

            if (this.byId("colMonths")) this.byId("colMonths").setVisible(false);
            if (this.byId("colNew")) this.byId("colNew").setVisible(false);

            oTable.addEventDelegate({
                onAfterRendering: function () {
                    var aRows = oTable.getRows();
                    aRows.forEach(function (oRow) {
                        oRow.getCells().forEach(function (oCell) {
                            if (oCell.isA("sap.m.Input")) {
                                oCell.removeEventDelegate(this._arrowDelegate);
                                oCell.addEventDelegate(this._arrowDelegate);
                            }
                        }.bind(this));
                    }.bind(this));

                    this._applyCabeceraStyle(sTableId);
                }.bind(this)
            });

            this._calculateDynamicRows();
            window.addEventListener("resize", this._calculateDynamicRows.bind(this));
        },

        /**
         * Crea dinámicamente columnas de años con un botón en la cabecera para ver los meses.
         */
        createYearColumns: function (sTableId, iStartYear, iHowMany, sModelName, iSkipFields) {
            var oTable = this.byId(sTableId);
            if (!oTable) return;

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
                    // Se utiliza un contenedor mínimo o se gestiona la visibilidad
                    // directamente si la tecnología lo permite.
                    // En SAPUI5 table, FlexBox es la forma estándar, pero se puede renderizar "Bare" (desnudo).
                    template: new sap.m.FlexBox({
                        renderType: "Bare", // Elimina el wrapper HTML adicional del FlexBox
                        width: "100%",
                        items: [
                            new sap.m.Input({
                                width: "100%",
                                textAlign: "End",
                                value: "{y" + iYear + "}",
                                visible: "{= ${expandible} !== false && !${isGroup} }"
                            }).addStyleClass("sapUiSizeCompact"),

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

                oTable.addColumn(oColumn);
            }.bind(this));
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
            var oTable = sTableId ? this.byId(sTableId) : this.byId("TreeTableBasic");
            var sPrefix = sModelName ? sModelName + ">" : "";

            // 1. Identificazione Anno
            var sText = oSource.getText();
            var isYearClick = (sText.length === 4 && !isNaN(parseInt(sText, 10)));
            var sYear = isYearClick ? parseInt(sText, 10) : this._openedYear;

            // 2. Reset Icone (Anni e Mesi)
            oTable.getColumns().forEach(function (oCol) {
                var oLabel = oCol.getLabel();
                if (!oLabel) return;
                // Pulisce bottoni semplici
                if (oLabel.setIcon) oLabel.setIcon("");
                // Pulisce bottoni dentro VBox
                if (oLabel.getItems) {
                    var oBtn = oLabel.getItems()[1];
                    if (oBtn && oBtn.setIcon) oBtn.setIcon("");
                }
            });

            // 3. Rimozione mesi precedenti
            var existingMonthCols = oTable.getColumns().filter(col => col.data("dynamicMonth") === true);
            existingMonthCols.forEach(col => oTable.removeColumn(col));

            if (this._openedYear === sYear) {
                this._openedYear = null;
                return;
            }

            this._openedYear = sYear;

            // 4. Icona sull'Anno (Punta a sinistra verso i mesi)
            if (isYearClick) {
                oSource.setIcon("sap-icon://slim-arrow-left");
                oSource.setIconFirst(true);
            }

            var aMonth = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            var currentYear = new Date().getFullYear();
            var startMonth = (sYear === currentYear) ? new Date().getMonth() + 1 : 0;
            var aRemainingMonths = aMonth.slice(startMonth);

            var oYearColumn = oTable.getColumns().find(function (oCol) {
                var oLabel = oCol.getLabel();
                return (oLabel === oSource) || (oLabel.getText && oLabel.getText() === String(sYear));
            });
            var colIndex = oTable.indexOfColumn(oYearColumn);

            // 5. Creazione Colonne Mesi (CON l'anno in alto)
            aRemainingMonths.forEach((sMonth, i) => {
                var oHeaderControl;

                if (i === 0) {
                    // IL BOTTONE DEL PRIMO MESE (Testo centrato, icona a destra)
                    oHeaderControl = new sap.m.Button({
                        text: sMonth,
                        type: "Transparent",
                        width: "100%",
                        icon: "sap-icon://slim-arrow-right",
                        iconFirst: false, // Icona dopo il testo
                        press: function (oEv) {
                            this.onCreateMonthsTable(oEv, sTableId, sModelName);
                        }.bind(this)
                    }).addStyleClass("testBold");
                } else {
                    oHeaderControl = new sap.m.Label({
                        textAlign: "Center",
                        text: sMonth,
                        width: "100%"
                    }).addStyleClass("testBold");
                }

                var oCol = new sap.ui.table.Column({
                    label: new sap.m.VBox({
                        width: "100%",
                        alignItems: "Center", // Centra l'anno
                        justifyContent: "Center",
                        renderType: "Bare", // Rende il VBox più "leggero"
                        items: [
                            // L'anno corrispondente in alto
                            new sap.m.Text({
                                textAlign: "Center",
                                text: String(sYear)
                            }).addStyleClass("sapUiTinyMarginTop sapUiTinyFontSize textoaño"),
                            // Il bottone o la label sotto
                            oHeaderControl
                        ]
                    }),
                    template: new sap.m.Input({
                        width: "100%",
                        textAlign: "End",
                        value: "{" + sPrefix + "monthsData/" + sYear + "/" + i + "}",
                        visible: "{= ${expandible} !== false && !${isGroup} }"
                    }),
                    width: "8rem"
                });

                oCol.data("dynamicMonth", true);
                oTable.insertColumn(oCol, colIndex + i);
            });

            oTable.setFixedColumnCount(2);
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
            var oTable = sTableId ? this.byId(sTableId) : this.byId("TreeTableBasic");
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
            var iOffset = 437;
            var iRowHeight = 32;

            var iRows = Math.floor((iHeight - iOffset) / iRowHeight) + 2;
            if (iRows < 2) iRows = 2;

            var oViewModel = this.getView().getModel("viewModel");
            if (oViewModel) {
                oViewModel.setProperty("/dynamicRowCount", iRows);
            }
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

            // 1️⃣ collasso il gruppo corretto
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

            // 2️⃣ attendo che la TreeTable si riallinei (FONDAMENTALE)
            setTimeout(function () {

                // ricostruisco i range con i dati aggiornati
                this._buildGroupRanges("TreeTableBasic");

                var iFirstVisible = oTable.getFirstVisibleRow();

                // 3️⃣ riapplico ESATTAMENTE la logica dello scroll
                this._onScrollLike({
                    getParameter: function (sName) {
                        if (sName === "firstVisibleRow") {
                            return iFirstVisible;
                        }
                    }
                }, "TreeTableBasic");

                // 4️⃣ se non serve sticky → lo spengo
                if (!oUiModel.getProperty("/showStickyParent") &&
                    !oUiModel.getProperty("/showStickyChild")) {

                    oUiModel.setProperty("/stickyHeaderData", null);
                }

            }.bind(this), 0);
        },
    });
});
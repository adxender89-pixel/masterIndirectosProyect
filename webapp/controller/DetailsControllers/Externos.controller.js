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

    return BaseController.extend("masterindirectos.controller.DetailsControllers.Externos", {
        formatter: formatter,

        /**
         * Se obtiene el identificador de la tabla personalizada correspondiente a esta vista.
         */
        getCustomTableId: function () {
            return "TreeTableExternos";
        },

        onInit: function () {
            this.setInitData();
        },

        /**
         * Se inicializa la vista de Externos definiendo el estado de navegacion y visibilidad.
         * Se configura la tabla principal y se preparan las columnas anuales iniciales.
         */
        setInitData: async function () {
            // Se inicia la carga de datos maestros y la inicializacion del modelo de externos.
            this._cargarDatosTabla();
            await this.initExternosModel();
            this._initYearsModel();

            // Se define el nombre del modelo y el valor de la pestana.
            this.tableModelName = "externosModel";
            this._pestana = "Externos";
            this.firstTime = true;

            this.getView().setModel(new JSONModel({
                selectedKey: "Externos"
            }), "state");

            this.setupDynamicTreeTable("TreeTableExternos");
            this._initVariantManagement("TreeTableExternos");

            const oTable = this.byId("TreeTableExternos");

            // Se configura el delegado para el manejo de renderizado y navegacion por teclado.
            oTable.addEventDelegate({
                onAfterRendering: function () {
                    const oTableDom = oTable.getDomRef();
                    if (!oTableDom) return;

                    const $table = $(oTableDom);

                    $table.off("keydown", "input").on("keydown", "input", function (oNativeEvent) {
                        const iKeyCode = oNativeEvent.keyCode;
                        if (iKeyCode < 37 || iKeyCode > 40) return;

                        const sControlId = oNativeEvent.target.id.replace("-inner", "");
                        const oInput = sap.ui.getCore().byId(sControlId);

                        if (oInput && oInput.isA("sap.m.Input")) {
                            this._onInputKeyDown({
                                srcControl: oInput,
                                keyCode: iKeyCode,
                                preventDefault: function () { oNativeEvent.preventDefault(); },
                                stopImmediatePropagation: function () { oNativeEvent.stopImmediatePropagation(); }
                            });
                        }
                    }.bind(this));

                    if (this.firstTime) {
                        this.firstTime = false;

                        // Se obtienen las fechas clave desde el modelo global de la aplicacion.
                        const sFreal = this.getGlobalModel("appData").getProperty("/Freal");
                        const sFrealsist = this.getGlobalModel("appData").getProperty("/Frealsist");

                        const oDateFreal = new Date(sFreal);
                        const oDateFrealsist = new Date(sFrealsist);
                        const bSameDay = oDateFreal.getDate() === oDateFrealsist.getDate();

                        let iYear;
                        if (bSameDay) {
                            this._effectiveDate = oDateFreal;
                            iYear = oDateFreal.getFullYear();
                        } else {
                            const oDatePlusOne = new Date(oDateFreal);
                            oDatePlusOne.setDate(oDatePlusOne.getDate() + 1);
                            this._effectiveDate = oDatePlusOne;
                            iYear = oDatePlusOne.getFullYear();
                        }

                        var iYearEnd = this._iYearEnd || (iYear + 2);
                        var iExtraYears = Math.max(0, iYearEnd - iYear + 1);

                        // Se corrige el identificador de tabla y el modelo respecto al codigo original.
                        this.createYearColumns(iYear, iExtraYears, "TreeTableExternos", this.getView().getModel("externosModel"));

                        setTimeout(function () {
                            const oTableInst = this.byId("TreeTableExternos");
                            if (!oTableInst) return;

                            this._showYearColumns(iYear);

                            const oPrimerAnioCol = oTableInst.getColumns().find(function (c) {
                                return c.data("dynamicYear") === true && !c.data("ejecutadosColumn");
                            });

                            if (oPrimerAnioCol) {
                                const sSubFijo = oPrimerAnioCol.data("subFijoYear");
                                const sYearVal = oPrimerAnioCol.data("year");

                                //       Se usa "sap.m.Button" para que onCreateMonthsTable lea el año
                                //       desde oSource.data("year") en lugar de this._openedYear, que en
                                //       el primer render es null y provocaba NaN y return immediato.
                                //       Se agrega el flag noClose en la fuente simulada para que
                                //       onCreateMonthsTable no cierre el año si ya estuviera abierto.
                                this.onCreateMonthsTable({
                                    getSource: function () {
                                        return {
                                            getMetadata: function () {
                                                return { getName: function () { return "sap.m.Button"; } };
                                            },
                                            getText: function () { return String(sYearVal); },
                                            data: function (sKey) {
                                                if (sKey === "subFijoYear") return sSubFijo;
                                                if (sKey === "year") return String(sYearVal);
                                                if (sKey === "noClose") return true;
                                                return null;
                                            }
                                        };
                                    }
                                });
                            }
                        }.bind(this), 150);
                    }

                    this._attachHeaderToggleListener();
                }.bind(this)
            });
        },


        /**
         * Se permite que el selector de año recargue los datos de esta pestana
         * usando el mismo contrato que el resto de vistas hijas.
         */
        initTabModel: function () {
            return this.initExternosModel();
        },

        /**
         * Se inicializa el modelo de datos de la pestana Externos realizando una peticion
         * asincrona al servidor OData y construyendo la estructura jerarquica de la tabla.
         */
        initExternosModel: async function () {
            var oAppData = this.getGlobalModel("appData").getData();

            // Se obtiene la version activa desde el modelo global de la aplicacion.
            var versiones = oAppData.NavLtVersiones;
            var flagSelectVersion = versiones.find(function (item) {
                return item.Activo === "X";
            });

            var oDashModel = this.getGlobalModel("dashboardModel");
            var sFreal = "";

            // Se intenta obtener Freal desde appData.tramo como fuente principal.
            if (oAppData && oAppData.tramo && oAppData.tramo.Freal) {
                sFreal = oAppData.tramo.Freal;
            } else if (oDashModel) {
                // Se recurre al dashboardModel unicamente si appData no contiene Freal.
                sFreal = oDashModel.getProperty("/NavMasterLt/0/Freal");
            }

            // Si Freal no esta disponible en ninguna fuente se reintenta tras 500ms.
            if (!sFreal) {
                setTimeout(function () {
                    this.initExternosModel();
                }.bind(this), 500);
                return;
            }

            // Se parsea la fecha de Freal al formato Date de JavaScript.
            var oDateStart = this._parseODataDate(sFreal);

            // Si el parseo de Freal falla se detiene la ejecucion sin enviar ninguna llamada.
            if (!oDateStart || isNaN(oDateStart.getTime())) {
                return;
            }

            //      Se obtiene el ejercicio desde el selector con fallback al año de Freal,
            //      replicando el mismo patron que usa Corrientes en initCorrienteModel.
            var sEjercicioFromSelector = this._getSelectedEjercicio();
            var sEjercicioFallback = oDateStart.getFullYear().toString();
            var sEjercicio = sEjercicioFromSelector || sEjercicioFallback;
            const token = this.getGlobalModel("appData").getProperty("/EvToken");

            try {
                const response = await this.post(
                    this.getGlobalModel("mainService"),
                    "/CambioPestIndirectosSet",
                    {
                        "NavSelProyecto": [this.getGlobalModel("appData").getData().tramo],
                        "NavChanges": [],
                        "NavDatosIndirectos": [],
                        "EvBloqueados": "",
                        "NavMensajes": [],
                        "NavLtVersiones": [flagSelectVersion]
                    },
                    {
                        headers: {
                            ambito: this.getGlobalModel("appData").getData().userData.initialNode,
                            lang: this.getGlobalModel("appData").getData().userData.AplicationLangu,
                            bloqueado: "",
                            decimales: this.getGlobalModel("dashboardModel").getData().decimales,
                            ejercicio: sEjercicio,
                            pestana: "Externos",
                            token: token
                        }
                    }
                );

                const tree = this.buildTree(response.NavDatosIndirectos.results);
                this.getView().setModel(new sap.ui.model.json.JSONModel(tree), "externosModel");
                //Prueba editabilidad
                //oModel.setProperty("/EvBloqueados", "X");

            } catch (error) {
                // Se omite el manejo del error para no interrumpir el flujo de la vista.
            }
        },

        /**
         * Se procesan los datos lineales obtenidos del servicio y se transforman en una
         * estructura de arbol jerarquica. Se guarda ademas una copia profunda de los datos
         * originales del servidor para el control de cambios y la restauracion de variantes.
         */
        buildTree: function (data) {
            const map = {};

            data.forEach(item => {
                const isD = item.PhPspnr === "D";
                const isC = !isD && item.Estructura === "C";
                const isS = !isD && item.Estructura === "S";
                const isO = !isD && item.Estructura === "O";
                const isDesglose = !isD && item.Estructura === "";

                map[item.PhPspnr] = {
                    ...item,
                    children: [],
                    isEditable: isO,
                    isSubcapitulo: isS,
                    isCapitulo: isC,
                    isVacio: isDesglose,

                    editPhPspnr: isDesglose,
                    editPost1: isDesglose,
                    //   Se condiciona la editabilidad de %Tasa al valor de TipoTasa.
                    // Solo es editable cuando Estructura es O y TipoTasa es "X" (equivale a INT).
                    editTasa: isO && item.TipoTasa === "X",
                    editAmoEje: false,
                    editAmoEjeAjus: false,
                    editAmoEjeReal: false,
                    editAmoPen: isDesglose,
                    editAmoTot: isDesglose,
                    editPepDest: isO,
                    editTipo: isO || isDesglose,
                    editPenPlan: false,
                    editMonths: isDesglose,
                    editPend: isDesglose,
                    //   Se condiciona la editabilidad de Pendiente y Total al valor de TipoTasa.
                    // Solo son editables cuando Estructura es O y TipoTasa está vacío (equivale a EXT).
                    editCtotPen: isO && item.TipoTasa !== "X",
                    editCtot: isO && item.TipoTasa !== "X"
                };
            });

            const roots = [];

            //   Primero: añadir el registro con PhPspnr = "D" como root sin hijos
            data.forEach(item => {
                if (item.PhPspnr === "D") {
                    map[item.PhPspnr].padre = true;
                    map[item.PhPspnr].children = [];
                    if (!roots.some(r => r.PhPspnr === "D")) {
                        roots.push(map[item.PhPspnr]);
                    }
                }
            });

            data.forEach(item => {
                if (item.PhPspnr === "D") return;

                if (item.ParentPath === "I") {
                    map[item.PhPspnr].padre = true;
                    if (!roots.some(r => r.PhPspnr === item.PhPspnr)) {
                        roots.push(map[item.PhPspnr]);
                    }
                } else {
                    const parent = map[item.ParentPath];
                    if (parent) {
                        map[item.PhPspnr].padre = false;
                        parent.children.push(map[item.PhPspnr]);
                    }
                }
            });

            this._originalServerData = JSON.parse(JSON.stringify(roots));
            return roots;
        },

        /**
         * Se parsea una fecha en formato OData y se devuelve un objeto Date.
         * Se contempla tambien el caso en que la fecha sea un objeto Date o un string ISO.
         */
        _parseODataDate: function (sODataDate) {
            if (!sODataDate) return null;
            var oMatch = /\/Date\((\d+)\)\//.exec(sODataDate);
            if (oMatch) {
                return new Date(parseInt(oMatch[1], 10));
            }
            return new Date(sODataDate);
        },

        /**
         * Se fuerza el recalculo de filas dinamicas una vez la vista esta disponible en el DOM.
         */
        onAfterRendering: function (oEvent) {
            //      Se reemplaza el rerender directo por el recalculo dinamico de filas
            //      para evitar el error cuando TreeTableExternos todavia no esta en el DOM.
            this._calculateDynamicRows();
            this._attachHeaderToggleListener();
        },

        /**
         * Se impide que el usuario seleccione la fila "D" (OEO).
         * Si el evento incluye la fila "D" entre las seleccionadas, se deselecciona.
         */
        onRowSelectionChange: function (oEvent) {
            const oTable = oEvent.getSource();
            const aSelectedIndices = oTable.getSelectedIndices();
            for (let i = 0; i < aSelectedIndices.length; i++) {
                const oContext = oTable.getContextByIndex(aSelectedIndices[i]);
                const oRow = oContext && oContext.getObject();
                if (oRow && oRow.PhPspnr === "D") {
                    oTable.removeSelectionInterval(aSelectedIndices[i], aSelectedIndices[i]);
                }
            }
        },

        /**
         * Se gestiona la visibilidad de las columnas extendidas al expandir o contraer
         * nodos en la TreeTable. Se marca ademas la variante activa como modificada.
         */
        onToggleOpenState: function (oEvent) {
            const oTable = oEvent.getSource();
            const sTableId = oTable.getId();
            const bExpanded = oEvent.getParameter("expanded");
            const iRowIndex = oEvent.getParameter("rowIndex");
            const oUiModel = this.getView().getModel("ui");

            //      Se marca la variante activa como modificada al expandir o contraer un nodo.
            this._markVariantDirty();

            const oColMonths = this.byId("colMonths");
            const oColNew = this.byId("colNew");
            const oColCheck1 = this.byId("colCheckBox1");
            const oColCheck2 = this.byId("colCheckBox2");

            const oContext = oTable.getContextByIndex(iRowIndex);
            const sPath = oContext && oContext.getPath();
            const oObject = oContext && oContext.getObject();

            //      Se calcula el nivel jerarquico del nodo usando la clave children
            //      en lugar de categories ya que el modelo de Externos usa children.
            const iLevel = sPath ? (sPath.match(/\/children/g) || []).length : 0;

            if (bExpanded) {
                const bIsDetailLevel =
                    iLevel >= 1 &&
                    oObject &&
                    oObject.children &&
                    oObject.children.length > 0;

                if (oColMonths) oColMonths.setVisible(bIsDetailLevel);
                if (oColNew) oColNew.setVisible(bIsDetailLevel);
                if (oColCheck1) oColCheck1.setVisible(bIsDetailLevel);
                if (oColCheck2) oColCheck2.setVisible(bIsDetailLevel);

                if (bIsDetailLevel && sPath) {
                    this._sLastExpandedPath = sPath;
                }
            } else {
                if (this._sLastExpandedPath === sPath) {
                    this._sLastExpandedPath = null;
                }

                let bAnyDetailExpanded = false;
                const oBinding = oTable.getBinding("rows");

                if (oBinding) {
                    const iLength = oBinding.getLength();
                    for (let i = 0; i < iLength; i++) {
                        if (oTable.isExpanded(i)) {
                            bAnyDetailExpanded = true;
                            break;
                        }
                    }
                }

                if (!bAnyDetailExpanded) {
                    if (oColMonths) oColMonths.setVisible(false);
                    if (oColNew) oColNew.setVisible(false);
                    if (oColCheck1) oColCheck1.setVisible(false);
                    if (oColCheck2) oColCheck2.setVisible(false);

                    this._aGroupRanges = [];
                    if (oUiModel) {
                        oUiModel.setProperty("/showStickyAgrupador", false);
                        oUiModel.setProperty("/showStickyParent", false);
                        oUiModel.setProperty("/showStickyChild", false);
                    }
                }
            }

            setTimeout(function () {
                this._refreshAfterToggle(sTableId);
            }.bind(this));
        },

        /**
         * Se escucha el evento de expansion o colapso de la cabecera principal
         * para recalcular las filas de la tabla dinamicamente.
         */
        _attachHeaderToggleListener: function () {
            //      Se busca el layout por el id correcto de la vista Externos.
            var oObjectPageLayout = this.byId("objectPageExternos");
            if (!oObjectPageLayout) return;

            setTimeout(function () {
                var oDom = oObjectPageLayout.getDomRef();
                if (!oDom) return;

                oDom.addEventListener("click", function () {
                    setTimeout(function () {
                        this._calculateDynamicRows();
                    }.bind(this), 200);
                }.bind(this), true);

            }.bind(this), 1000);
        },

        /**NO SE ESTA USANDO
         * Se gestiona el evento de cierre del navegador para advertir sobre cambios sin guardar.
        
        onBrowserClose: function (oEvent) {
            if (this.hasUnsavedChanges()) {
                oEvent.preventDefault();
                oEvent.returnValue = '';
                return '';
            }
        }, */

        /** NO SE ESTA USANDO
         * Se limpian los escuchadores de eventos activos al destruir el controlador de la vista.
       
        onExit: function () {
            if (this._boundBrowserClose) {
                window.removeEventListener("beforeunload", this._boundBrowserClose);
            }
            if (this._boundResizeHandler) {
                $(window).off("resize", this._boundResizeHandler);
            }
        },  */


    });
});
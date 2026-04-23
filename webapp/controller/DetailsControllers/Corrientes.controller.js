sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/table/Column",
    "sap/m/Input",
    "sap/m/Button",
    "sap/m/Label",
    "masterindirectos/controller/BaseController",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "masterindirectos/model/formatter"
], function (
    JSONModel,
    Column,
    Input,
    Button,
    Label,
    BaseController,
    Filter,
    FilterOperator,
    Fragment,
    formatter
) {
    "use strict";

    return BaseController.extend("masterindirectos.controller.DetailsControllers.Corrientes", {

        formatter: formatter,
        /**
         * Se obtiene el identificador de la tabla personalizada correspondiente a esta vista.
         */
        getCustomTableId: function () {
            return "TreeTableBasic";
        },

        /**
     * Se inicializa la vista de Corrientes, definiendo el estado de navegación y visibilidad.
     * Se configura la tabla principal y se preparan las columnas anuales iniciales.
     */
        onInit: function () {

            this.setInitData();
        },
        setInitData: async function () {
            this._cargarDatosTabla();
            await this.initCorrienteModel();
            this._initYearsModel();
            //    Se define el nombre del modelo de tabla para las operaciones genéricas del BaseController.
            this.tableModelName = "corrientesModel";
            //    Se identifica esta vista como Corrientes para el envío de datos al backend.
            this._pestana = "Corrientes";
            this.firstTime = true;

            this.getView().setModel(new JSONModel({
                selectedKey: "Home"
            }), "state");

            this.getView().setModel(new JSONModel({
                tableVisible: false,
                splitterSizeMain: "100%"
            }), "viewModel");

            this.setupDynamicTreeTable("TreeTableBasic");

            this._initVariantManagement("masterindirectos_corrientes_variants");

            setTimeout(function () {
                const oTableForVariant = this.byId("TreeTableBasic");
                if (oTableForVariant) {
                    const oCorrientesModel = oTableForVariant.getModel("corrientesModel");
                    if (oCorrientesModel) {
                        oCorrientesModel.attachPropertyChange(function () {
                            this._markVariantDirty();
                        }.bind(this));
                    }
                }
            }.bind(this), 600);

            const oModel = this.getView().getModel();
            if (oModel) {
                this._editBackupData = JSON.parse(JSON.stringify(oModel.getData()));
            }

            const oTable = this.byId("TreeTableBasic");
            //  this._attachRowStyle();

            oTable.addEventDelegate({
                onAfterRendering: function () {
                    const oTableDom = oTable.getDomRef();
                    if (!oTableDom) return;

                    const oCtxDebug = oTable.getContextByIndex(4);
                    if (oCtxDebug) {
                        const oObj = oCtxDebug.getObject();

                    }

                    const $table = $(oTableDom);

                    /* 
                     $table.off("contextmenu").on("contextmenu", function (oNativeEvent) {
                          oNativeEvent.preventDefault();
  
                          const $target = $(oNativeEvent.target);
                          const oTargetControl = $target.control(0);
                          const iRowIndex = $target.closest(".sapUiTableTr").index();
                          const oRowContext = oTable.getContextByIndex(oTable.getFirstVisibleRow() + iRowIndex);
  
                          if (oRowContext) {
                              const oRowData = oRowContext.getObject();
                              if (!oRowData || oRowData.padre !== true) {
                                  return;
                              }
  
                              const oBindingInfo = oTargetControl && oTargetControl.getBindingInfo ? oTargetControl.getBindingInfo("value") : null;
                              const sBindingPath = oBindingInfo && oBindingInfo.parts && oBindingInfo.parts[0] ? oBindingInfo.parts[0].path : null;
  
                              if (sBindingPath !== "PhPspnr" && sBindingPath !== "name") {
                                  return;
                              }
  
                              this.onContextMenu({
                                  rowBindingContext: oRowContext,
                                  cellControl: oTargetControl || oTable
                              });
                          }
                      }.bind(this));*/

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

                        // Se obtienen las fechas clave desde el modelo global de la aplicacion
                        // en lugar del dashboardModel para centralizar el acceso a estos datos.
                        //  Se leen Freal y Frealsist desde appData en lugar de dashboardModel.
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
                        // Se calcula el número de columnas anuales necesarias a partir del rango completo
                        // guardado en _initYearsModel, en lugar de usar un valor fijo de 2 años adicionales.
                        var iYearEnd = this._iYearEnd || (iYear + 2);
                        var iExtraYears = Math.max(0, iYearEnd - iYear + 1);

                        this.createYearColumns(iYear, iExtraYears, "TreeTableBasic", this.getView().getModel("corrientesModel"));

                        setTimeout(function () {
                            const oTableInst = this.byId("TreeTableBasic");
                            if (!oTableInst) return;
                            // Se ocultan todas las columnas dinámicas excepto las dos primeras
                            // nada más crearlas, antes de que la tabla se renderice completamente.
                            this._showYearColumns(iYear);

                            const oPrimerAnioCol = oTableInst.getColumns().find(function (c) {
                                return c.data("dynamicYear") === true && !c.data("ejecutadosColumn");
                            });

                            if (oPrimerAnioCol) {
                                const sSubFijo = oPrimerAnioCol.data("subFijoYear");
                                const sYearVal = oPrimerAnioCol.data("year");

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
                                                return null;
                                            }
                                        };
                                    }
                                });
                            }
                        }.bind(this), 150);
                    }
                    this._attachHeaderToggleListener();

                    this._highlightSinProveedor(oTable);
                }.bind(this)
            });


            this._boundResizeHandler = function () {
                this._calculateDynamicRows();
            }.bind(this);
            $(window).on("resize", this._boundResizeHandler);

            /* NO SE ESTA USANDO   this._boundBrowserClose = this.onBrowserClose.bind(this);
                 window.addEventListener("beforeunload", this._boundBrowserClose);*/
        },

        /**
         * Se escucha el evento de expansión o colapso de la cabecera principal
         * para recalcular las filas de la tabla dinámicamente.
         */
        _attachHeaderToggleListener: function () {
            const oObjectPageLayout = this.byId("objectPageLayout");
            if (!oObjectPageLayout) return;

            setTimeout(function () {
                const oDom = oObjectPageLayout.getDomRef();
                if (!oDom) return;

                oDom.addEventListener("click", function () {
                    setTimeout(function () {
                        this._calculateDynamicRows();
                    }.bind(this), 200);
                }.bind(this), true);

            }.bind(this), 1000);
        },



        /**
         * Se busca el índice visual de una fila por su ruta de enlace de datos.
         */
        _findIndexByPath: function (oTable, sPath) {
            const oBinding = oTable.getBinding("rows");
            const aContexts = oBinding.getContexts(0, oBinding.getLength());
            for (let i = 0; i < aContexts.length; i++) {
                if (aContexts[i].getPath() === sPath) {
                    return i;
                }
            }
            return -1;
        },

        /**
         * Se inicializan las propiedades mensuales y anuales por defecto para un nuevo elemento.
         */
        _fillMonths: function (oItem, iYearStart) {
            oItem.monthsData = {};

            for (let i = 0; i < 3; i++) {
                const iYear = iYearStart + i;
                oItem["y" + iYear] = "";

                for (let m = 1; m <= 12; m++) {
                    const sMonthKey = "m" + iYear + "_" + (m < 10 ? "0" + m : m);
                    oItem.monthsData[sMonthKey] = "";
                }
            }
        },

        /**
         * Se fuerza el renderizado y cálculo de elementos una vez que la vista está disponible en el DOM.
         */
        onAfterRendering: function (oEvent) {
            this._attachHeaderToggleListener();
        },

        /**
         * Se gestiona la visibilidad de las columnas extendidas (meses, checkboxes)
         * al expandir o contraer nodos en la TreeTable.
         * Se marca además la variante activa como modificada al cambiar el estado del árbol.
         */
        onToggleOpenState: function (oEvent) {
            const oTable = oEvent.getSource();
            const sTableId = oTable.getId();
            const bExpanded = oEvent.getParameter("expanded");
            const iRowIndex = oEvent.getParameter("rowIndex");
            const oUiModel = this.getView().getModel("ui");

            // Se marca la variante activa como modificada al expandir o contraer un nodo.
            this._markVariantDirty();

            const oColMonths = this.byId("colMonths");
            const oColNew = this.byId("colNew");
            const oColCheck1 = this.byId("colCheckBox1");
            const oColCheck2 = this.byId("colCheckBox2");

            const oContext = oTable.getContextByIndex(iRowIndex);
            const sPath = oContext && oContext.getPath();
            const oObject = oContext && oContext.getObject();

            const iLevel = sPath ? (sPath.match(/\/categories/g) || []).length : 0;

            /* Se procesa la expansión del nodo. */
            if (bExpanded) {
                const bIsDetailLevel =
                    iLevel >= 2 &&
                    oObject &&
                    oObject.categories &&
                    oObject.categories.length > 0 &&
                    oObject.categories[0].isGroup === true;

                if (oColMonths) oColMonths.setVisible(bIsDetailLevel);
                if (oColNew) oColNew.setVisible(bIsDetailLevel);
                if (oColCheck1) oColCheck1.setVisible(bIsDetailLevel);
                if (oColCheck2) oColCheck2.setVisible(bIsDetailLevel);

                if (bIsDetailLevel && sPath) {
                    this._sLastExpandedPath = sPath;
                }
                setTimeout(function () {
                    this._highlightSinProveedor(oTable);
                    this._applyBlockBorder(oTable);
                }.bind(this), 100);
            }
            /* Se procesa el colapso del nodo. */
            else {
                if (this._sLastExpandedPath === sPath) {
                    this._sLastExpandedPath = null;
                }

                let bAnyDetailExpanded = false;
                const oBinding = oTable.getBinding("rows");

                if (oBinding) {
                    const iLength = oBinding.getLength();

                    for (let i = 0; i < iLength; i++) {
                        if (oTable.isExpanded(i)) {
                            const oCtx = oTable.getContextByIndex(i);
                            const oObj = oCtx && oCtx.getObject();
                            const sCtxPath = oCtx ? oCtx.getPath() : "";
                            const iCtxLevel = (sCtxPath.match(/\/categories/g) || []).length;

                            if (
                                iCtxLevel >= 2 &&
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

                /* Se reinicia la interfaz de usuario si no queda ningún detalle abierto. */
                if (!bAnyDetailExpanded) {
                    if (oColMonths) oColMonths.setVisible(false);
                    if (oColNew) oColNew.setVisible(false);
                    if (oColCheck1) oColCheck1.setVisible(false);
                    if (oColCheck2) oColCheck2.setVisible(false);

                    this._aGroupRanges = [];
                    oUiModel.setProperty("/showStickyAgrupador", false);
                    oUiModel.setProperty("/showStickyParent", false);
                    oUiModel.setProperty("/showStickyChild", false);
                }
            }

            setTimeout(function () {
                this._refreshAfterToggle(sTableId);
            }.bind(this));
        },

        /**NO SE ESTA USANDO
         * Se gestiona el evento de cierre del navegador para advertir sobre posibles cambios sin guardar.
         
        onBrowserClose: function (oEvent) {
            if (this.hasUnsavedChanges()) {
                oEvent.preventDefault();
                oEvent.returnValue = '';
                return '';
            }
        },*/

        /** NO SE ESTA USANDO
         * Se limpian los escuchadores de eventos activos al destruir el controlador de la vista.
        
        onExit: function () {
            if (this._boundBrowserClose) {
                window.removeEventListener("beforeunload", this._boundBrowserClose);
            }
            if (this._boundResizeHandler) {
                $(window).off("resize", this._boundResizeHandler);
            }
        }, */
        /**

 *   Permite que el selector de año recargue los datos de esta pestaña
 *   usando el mismo contrato que el resto de vistas hijas.
 */
        initTabModel: function () {
            return this.initCorrienteModel();
        },

        /**
     * Se inicializa el modelo de datos de la pestaña "Corrientes" realizando una petición asíncrona al servidor OData.
     * Extrae la versión activa actual y construye la estructura jerárquica de la tabla en base a la respuesta.
     */
        initCorrienteModel: async function () {
            var oAppData = this.getGlobalModel("appData").getData();
            // Se obtiene la version activa desde el modelo global de la aplicacion.
            var versiones = oAppData.NavLtVersiones;
            var flagSelectVersion = versiones.find(function (item) {
                return item.Activo === "X";
            });

            // Se lee Freal desde appData como fuente global unica, con fallback al tramo
            // en caso de que el dashboard no haya persistido el valor todavia.
            var sFreal = oAppData.Freal || (oAppData.tramo && oAppData.tramo.Freal) || "";
            var oDashModel = this.getGlobalModel("dashboardModel")
            var sFreal = "";

            // Se recupera el arreglo de versiones desde el modelo global de la aplicación.
            var versiones = this.getGlobalModel("appData").getData().NavLtVersiones;
            // Se busca e identifica el objeto correspondiente a la versión que se encuentra actualmente marcada como activa ("X").
            var flagSelectVersion = versiones.find(function (item) {
                return item.Activo === "X";
            });

            // Se intenta obtener Freal desde appData.tramo como fuente principal.
            if (oAppData && oAppData.tramo && oAppData.tramo.Freal) {
                sFreal = oAppData.tramo.Freal;
            } else if (oDashModel) {
                // Se recurre al dashboardModel únicamente si appData no contiene Freal.
                sFreal = oDashModel.getProperty("/NavMasterLt/0/Freal");
            }

            //Si Freal no está disponible en ninguna fuente, se reintenta tras 500ms
            // hasta que el modelo esté cargado. No se utiliza ningún valor por defecto.
            if (!sFreal) {

                setTimeout(function () {
                    this.initCorrienteModel();
                }.bind(this), 500);
                return;
            }

            // Se parsea la fecha de Freal al formato Date de JavaScript.
            var oDateStart = this._parseODataDate(sFreal);

            // Si el parseo de Freal falla, se detiene la ejecución sin enviar ninguna llamada.
            // No se permite continuar con un ejercicio incorrecto.
            if (!oDateStart || isNaN(oDateStart.getTime())) {

                return;
            }

            //  Se obtiene el ejercicio desde el selector; fallback al año de Freal.
            var sEjercicioFromSelector = this._getSelectedEjercicio();
            var sEjercicioFallback = oDateStart.getFullYear().toString();
            var sEjercicio = sEjercicioFromSelector || sEjercicioFallback;
            const token = this.getGlobalModel("appData").getProperty("/EvToken");


            // Se realiza la llamada POST al servicio con el ejercicio correspondiente al tramo activo.
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
                        // Se envía únicamente la versión activa aislada anteriormente.
                        "NavLtVersiones": [flagSelectVersion]
                    },
                    {
                        headers: {
                            ambito: this.getGlobalModel("appData").getData().userData.initialNode,
                            lang: this.getGlobalModel("appData").getData().userData.AplicationLangu,
                            bloqueado: "",
                            decimales: "02",
                            ejercicio: sEjercicio,
                            pestana: "Corrientes",
                            token: token
                        }
                    }
                );

                const tree = this.buildTree(response.NavDatosIndirectos.results);
                const oModel = new sap.ui.model.json.JSONModel(tree);
                this.getView().setModel(oModel, "corrientesModel");
                //Prueba editabilidad
                //oModel.setProperty("/EvBloqueados", "X");
            } catch (error) {

            }
        },

        /**
         * Se procesan los datos lineales obtenidos del servicio y se transforman en una estructura de árbol.
         * Se guarda además una copia profunda de los datos originales del servidor para poder calcular
         * el delta de cambios al guardar una variante sin necesidad de almacenar el modelo completo.
         */
        //    Se transforman los datos lineales en estructura de árbol jerárquica
        buildTree: function (data) {

            const map = {};

            //    Se crea un mapa por clave PhPspnr manteniendo todos los campos originales
            data.forEach(item => {
                map[item.PhPspnr] = {
                    ...item, //    Se conservan todos los campos del backend (incluido Tipo)
                    children: [],
                    _isSinProveedor: false, 
                    isEditable: item.Estructura === "O",
                    isSubcapitulo: item.Estructura === "S",
                    isCapitulo: item.Estructura === "C",
                    isVacio: item.Estructura === "",
                };
            });

            const roots = [];

            //    Se construye la jerarquía padre-hijo
            data.forEach(item => {

                if (item.ParentPath === "I") {

                    //    Nodo raíz
                    map[item.PhPspnr].padre = true;

                    if (!roots.some(root => root.PhPspnr === item.PhPspnr)) {
                        roots.push(map[item.PhPspnr]);
                    }

                } else {

                    //    Nodo hijo
                    const parent = map[item.ParentPath];

                    if (parent) {
                        map[item.PhPspnr].padre = false;
                        parent.children.push(map[item.PhPspnr]);
                    }
                }
            });

            //    Se guarda copia original para control de cambios
            this._originalServerData = JSON.parse(JSON.stringify(roots));

            return roots;
        },
        /**
     * Se parsea una fecha en formato OData (/Date(ms)/) y se devuelve un objeto Date.
     * Se contempla también el caso en que la fecha ya sea un objeto Date o un string ISO.
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
      * Se inicializa el modelo de años disponibles para el selector de ejercicio,
      * calculando el rango desde el año de Freal hasta el año de Frealfinobra, ambos inclusive.
      * Se leen ambas fechas directamente desde el modelo global dashboardModel.
      */
        _initYearsModel: function () {
            // Se leen ambas fechas desde appData en lugar de dashboardModel.
            var oAppData = this.getGlobalModel("appData").getData();
            var sFreal = oAppData.Freal;
            var sFrealfinobra = oAppData.Frealfinobra;

            // Se verifica que ambas fechas esten disponibles antes de continuar.
            // Si aun no lo estan se reintenta tras 500ms esperando que el dashboard las haya persistido.
            //  Se verifica que ambas fechas esten disponibles en appData antes de continuar.
            if (!sFreal || !sFrealfinobra) {
                setTimeout(function () { this._initYearsModel(); }.bind(this), 500);
                return;
            }

            // Se parsean las fechas obtenidas al formato Date de JavaScript.
            var oDateStart = this._parseODataDate(sFreal);
            var oDateEnd = this._parseODataDate(sFrealfinobra);

            // Se verifica que ambas fechas sean validas antes de continuar.
            if (!oDateStart || !oDateEnd || isNaN(oDateStart) || isNaN(oDateEnd)) {
                return;
            }

            var iYearStart = oDateStart.getFullYear();
            var iYearEnd = oDateEnd.getFullYear();

            // Se garantiza que el rango tenga siempre al menos 2 anos visibles.
            // Si Frealfinobra es anterior o igual a Freal los datos son inconsistentes
            // y se aplica un rango minimo para evitar que el selector quede vacio.
            if (iYearEnd <= iYearStart) {
                iYearEnd = iYearStart + 2;
            }

            // Se guardan el ano de inicio y fin para usarlos al crear las columnas dinamicas.
            this._iYearStart = iYearStart;
            this._iYearEnd = iYearEnd;

            // Se construye el array de anos para el selector de ejercicio.
            var aYears = [];
            for (var i = iYearStart; i <= iYearEnd; i++) {
                aYears.push({ year: String(i) });
            }

            // Se asigna el modelo de anos a la vista con el primer ano como seleccionado por defecto.
            this.getView().setModel(new JSONModel({
                years: aYears,
                selectedYear: String(iYearStart)
            }), "yearsModel");
        },
        /**
 * Se gestiona el envio al backend de la fila modificada en la vista Corrientes.
 * Se ejecuta automaticamente al final de onRowInputChange del BaseController
 * mediante el hook _onAfterRowInputChange, unicamente para inputs numericos
 * de mes, año o columna Resto. La rama LIN ya envia por su propio flujo
 * a traves de _confirmDateRange y _executeBatchLineal, por lo que no llega aqui.
 */
        //    Se define el hook que el BaseController invoca al final de onRowInputChange
        //    para que Corrientes pueda anadir su logica de envio al backend sin duplicar
        //    la logica de resolucion del contexto que ya realiza el metodo padre.
        //    Externos no define este hook porque no requiere envio de celdas al backend.
        _onAfterRowInputChange: async function (oContext, oSource) {

            if (!oContext) {
                return;
            }

            var oModel = this.getView().getModel(this.tableModelName);
            var sPath = oContext.getPath();
            var oRowData = oModel.getProperty(sPath);

            if (!oRowData) {
                return;
            }

            //    Lectura segura del binding
            var sCampoMod = "";
            if (oSource && oSource.getBindingInfo) {
                var oBI = oSource.getBindingInfo("value");

                if (oBI) {
                    if (oBI.parts && oBI.parts[0] && oBI.parts[0].path) {
                        sCampoMod = oBI.parts[0].path;
                    } else if (oBI.path) {
                        sCampoMod = oBI.path;
                    }
                }
            }

            var oPayloadRow = {};
            Object.keys(oRowData).forEach(function (sKey) {
                if (sKey !== "children" &&
                    sKey !== "padre" &&
                    sKey !== "isEditable" &&
                    sKey !== "_linDateFrom" &&
                    sKey !== "_linDateTo") {
                    oPayloadRow[sKey] = oRowData[sKey];
                }
            });
            oPayloadRow = this._formatPayloadDecimals(oPayloadRow);
            //    Envío con CampoMod
            await this._enviarFilaAlBackend(oContext, oPayloadRow, sCampoMod);
        },
        /* 22/04
        onAddRow: function (oEvent) {
            var oView = this.getView();
            var oTreeTable = oView.byId("TreeTableBasic");
            var oCorrModel = oView.getModel("corrientesModel");

            var oButton = oEvent.getSource();
            var oRow = oButton.getParent();
            while (oRow && !(oRow instanceof sap.ui.table.Row)) {
                oRow = oRow.getParent();
            }

            if (!oRow) return;

            var iRowIndex = oRow.getIndex();
            var oContext = oTreeTable.getContextByIndex(iRowIndex);
            if (!oContext) return;

            var sPath = oContext.getPath();

            if (oTreeTable.isExpanded(iRowIndex)) {
                oTreeTable.collapse(iRowIndex);
                return;
            }

            // ── CABECERA (Agrupador) - HARDCODED NO EDITABLE ──
            var oAgrupador = {
                  type: "cabecera",
                PhPspnr: "Agrupador",
                Post1: "Puesto de trabajo",
                AmoEje: "Persona",
                AmoEjeAjus: "Ajuste",
                AmoEjeReal: "Real",
                AmoPen: "Coste pend",
                AmoTot: "Tarifa",
                Tipos: "Fecha de Inicio",
                PenPlan: "Fecha de fin",
                months: "Nºmeses",
                pend: "Otros",
                flag1Label: "Auto",
                flag2Label: "Inflaz.",
                cabecera: true,
                noSelect: true,
                isGroup: true,
                // Forzamos false para que la cabecera no sea editable
                isEditable: false,
                isInputRow: true,
                isSubcapitulo: true,
                isCapitulo: true,
                monthsData: []
            };

            // 1. Definimos los datos reales que irán dentro de la fila vacía
            var aFilasDatos = [
                {
                    type: "row",
                    PhPspnr: "Jefe de proyecto",
                    Post1: "Nombre 1",
                    AmoEje: "12.500,00",
                    Tipos: "23/05/2000",
                    isEditable: false,
                    isInputRow: false,
                    noSelect: true,
                    isSubcapitulo: false,
                    isCapitulo: false,
                    hideButton: true, // Para que esta fila no tenga el botón "+"
                    children: []      // Nivel final (hoja)
                }
            ];

            // 2. Definimos la fila vacía y le asignamos los datos como hijos
            var oFilaVacia = {
                type: "row",
                PhPspnr: "",
                Post1: "Sin provedor",
                AmoEje: "",
                AmoEjeAjus: "",
                AmoEjeReal: "",
                AmoPen: "",
                AmoTot: "",
                Tipo: "",
                PenPlan: "",
                months: "",
                pend: "",
                flag1: false,
                CheckInfla: false,
                noSelect: true,
                isGroup: false,
                editable: false,
                isEditable: true,  // Si quieres que el usuario escriba en esta, déjalo en true
                isInputRow: true,
                isSubcapitulo: true,
                isCapitulo: true,
                hideButton: true,  // También ocultamos el botón aquí

                // --- ESTA ES LA CLAVE ---
                children: aFilasDatos // Metemos el array de datos AQUÍ
            };

            // 3. Ensamblamos para el nodo principal (el que expandiste originalmente)
            // Ahora solo pasamos el Agrupador y la FilaVacia (que ya lleva sus propios hijos)
            var aChildren = [oAgrupador, oFilaVacia];

            // 4. Actualizamos el modelo
            oCorrModel.setProperty(sPath + "/children", aChildren);
            oCorrModel.refresh(true);

            setTimeout(function () {
                oTreeTable.expand(iRowIndex);

                // if (this._applyCabeceraStyle) {
                //     this._applyCabeceraStyle("TreeTableBasic");
                // }
            }.bind(this), 100);
        },
        // 22/04
       _attachRowStyle: function () {
    const oTable = this.byId("TreeTableBasic");
    if (!oTable) return;

    oTable.addEventDelegate({
        onAfterRendering: function () {

            const aRows = oTable.getRows();

            aRows.forEach(function (oRow) {

                const oCtx = oRow.getBindingContext("corrientesModel");
                if (!oCtx) return;

                const oData = oCtx.getObject();

                if (!oData) return;

                const $row = oRow.$();
                if (!$row || !$row.length) return;

                $row.removeClass("cabeceraRow");

                if (oData.cabecera === true) {
                    $row.addClass("cabeceraRow");
                }
            });
        }
    });
}*/
    });
});
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
         *   Se permite seleccionar cualquier fila incluida la "D" (OEO).
         * El bloqueo de D ya no se hace aqui silenciosamente: la validacion vive en
         * onAddPress y muestra el mensaje ERROR_NO_ANADIR_OEO al usuario, igual
         * que Anticipados/Diferidos/Inmovilizados.
         */
        onRowSelectionChange: function (oEvent) {
            // Hook conservado por si en el futuro se necesita logica de seleccion.
        },

        /**
         * Validaciones previas a la creacion de filas en la TreeTable de Corrientes.
         * Por ahora solo se implementan las validaciones (letras + mensajes), sin la
         * logica de crear/abrir popups que llegara en una iteracion posterior.
         */
        onAddPress: function () {
            var oTable = this.byId("TreeTableBasic");
            var aSelectedIndices = oTable.getSelectedIndices();

            // Validacion 1: al menos una linea seleccionada.
            if (aSelectedIndices.length === 0) {
                this.createMessageDialog({
                    title: this.getTranslatedText("ERROR"),
                    textAccept: this.getTranslatedText("ACEPTAR"),
                    messages: [{
                        text: this.getTranslatedText("ERROR_SELECCIONE_LINEA"),
                        type: "Error"
                    }]
                });
                return;
            }

            // Validacion 2: todas las lineas seleccionadas deben tener el mismo PhPspnr.
            var aSelectedRows = [];
            var sPhPspnr = null;
            for (var i = 0; i < aSelectedIndices.length; i++) {
                var oContext = oTable.getContextByIndex(aSelectedIndices[i]);
                if (!oContext) continue;
                var oRow = oContext.getObject();
                aSelectedRows.push(oRow);
                if (sPhPspnr === null) {
                    sPhPspnr = oRow.PhPspnr;
                } else if (sPhPspnr !== oRow.PhPspnr) {
                    this.createMessageDialog({
                        title: this.getTranslatedText("ERROR"),
                        textAccept: this.getTranslatedText("ACEPTAR"),
                        messages: [{
                            text: this.getTranslatedText("ERROR_SOLO_UNA_LINEA"),
                            type: "Error"
                        }]
                    });
                    return;
                }
            }

            var oSelectedRow = aSelectedRows[0];
            if (!oSelectedRow) return;

            // Validacion 3: la fila "D" (OEO) no es valida.
            if (sPhPspnr === "D") {
                this.createMessageDialog({
                    title: this.getTranslatedText("ERROR"),
                    textAccept: this.getTranslatedText("ACEPTAR"),
                    messages: [{
                        text: this.getTranslatedText("ERROR_NO_ANADIR_OEO"),
                        type: "Error"
                    }]
                });
                return;
            }

            // Validacion 4: nivel 3 (desglose) no se puede seleccionar.
            var iLevel = this._getOperationLevel(sPhPspnr);
            if (iLevel === 3) {
                this.createMessageDialog({
                    title: this.getTranslatedText("ERROR"),
                    textAccept: this.getTranslatedText("ACEPTAR"),
                    messages: [{
                        text: this.getTranslatedText("ERROR_NO_ANADIR_NIVEL3"),
                        type: "Error"
                    }]
                });
                return;
            }

            //   Recuperar el contexto para pasarlo a los helpers (mismo que se usa
            // para localizar la fila en el arbol al insertar children).
            var oContextForAdd = oTable.getContextByIndex(aSelectedIndices[0]);

            // Nivel 1 (capitulo): abrir popup con el catalogo de operaciones.
            if (iLevel === 1) {
                this._openOperationsCatalog(oSelectedRow, oContextForAdd);
                return;
            }

            // Nivel 2 (operacion): validar precondiciones y crear fila nivel 3.
            if (iLevel === 2) {
                // Validacion 5: no se puede si ya tiene desgloses (children).
                if (oSelectedRow.children && oSelectedRow.children.length > 0) {
                    this.createMessageDialog({
                        title: this.getTranslatedText("ERROR"),
                        textAccept: this.getTranslatedText("ACEPTAR"),
                        messages: [{
                            text: this.getTranslatedText("ERROR_NO_ANADIR_CON_DESGLOSES"),
                            type: "Error"
                        }]
                    });
                    return;
                }
                // Validacion 6: no se puede si tiene importes ejecutados.
                var fAmoEje = parseFloat(oSelectedRow.AmoEje) || 0;
                if (fAmoEje > 0) {
                    this.createMessageDialog({
                        title: this.getTranslatedText("ERROR"),
                        textAccept: this.getTranslatedText("ACEPTAR"),
                        messages: [{
                            text: this.getTranslatedText("ERROR_NO_ANADIR_CON_EJECUTADO"),
                            type: "Error"
                        }]
                    });
                    return;
                }
                this._createLevel3Row(oSelectedRow, oContextForAdd);
            }
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
                            
                        }
                    }
                );

                //   Mismo manejo de mensajes que Diferidos/Inmovilizados: se recogen los
                // mensajes de error de NavMensajes y se muestran en un dialog. Sin este
                // bloque, errores como "Chapter X cannot be modified, blocked by ..." no
                // llegaban nunca al usuario aunque el backend los devolviera.
                var aMensajes = response.NavMensajes?.results || [];
                var aMensajesError = aMensajes.filter(function (mensaje) {
                    return mensaje.Tipo === "E";
                });

                if (aMensajesError.length > 0) {
                    this.createMessageDialog({
                        title: this.getTranslatedText("ERROR"),
                        textAccept: this.getTranslatedText("ACEPTAR"),
                        messages: aMensajesError.map(function (mensaje) {
                            return {
                                text: mensaje.Mensaje || mensaje.Message || mensaje.text || "",
                                type: "Error"
                            };
                        })
                    });
                }

                // // Capturar el estado de bloqueo de la pestaña desde EvBloqueados
                // var sEvBloqueados = response.EvBloqueados || "";
                // var bIsBlocked = sEvBloqueados.trim().length > 0;

                // // Crear o actualizar el modelo de bloqueo
                // var oModeloBloqueo = this.getView().getModel("modeloBloqueo");
                // if (!oModeloBloqueo) {
                //     oModeloBloqueo = new sap.ui.model.json.JSONModel({
                //         isBlocked: bIsBlocked
                //     });
                //     this.getView().setModel(oModeloBloqueo, "modeloBloqueo");
                // } else {
                //     oModeloBloqueo.setProperty("/isBlocked", bIsBlocked);
                // }

                this._addComputedFields(response.NavDatosIndirectos.results);
                const tree = this.buildTree(response.NavDatosIndirectos.results);
                const oModel = new sap.ui.model.json.JSONModel(tree);
                this.getView().setModel(oModel, "corrientesModel");

                //Prueba editabilidad
                //oModel.setProperty("/EvBloqueados", "X");
            } catch (error) {

            }
        },

        _addComputedFields: function(aData) {
            aData.forEach(function(item) {
                if (item.TipoInd === "I") {
                    item._Ejecutado = item.InvEje || "0";
                    item._Pendiente = item.InvPen || "0";
                    item._Total = item.InvTot || "0";
                } else {
                    item._Ejecutado = item.AmoEje || "0";
                    item._Pendiente = item.AmoPen || "0";
                    item._Total = item.AmoTot || "0";
                }
            });
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
                const isD = item.PhPspnr === "D";
                map[item.PhPspnr] = {
                    ...item, //    Se conservan todos los campos del backend (incluido Tipo)
                    children: [],
                    _isSinProveedor: false,
                    //    La fila "D" no es editable y no se considera capítulo/subcapítulo/desglose
                    isEditable: !isD && item.Estructura === "O",
                    isSubcapitulo: !isD && item.Estructura === "S",
                    isCapitulo: isD || item.Estructura === "C",
                    isVacio: !isD && item.Estructura === "",
                };
            });

            const roots = [];

            //    Primero: añadir el registro con PhPspnr = "D" como root sin hijos
            data.forEach(item => {
                if (item.PhPspnr === "D") {
                    map[item.PhPspnr].padre = true;
                    map[item.PhPspnr].children = [];
                    if (!roots.some(root => root.PhPspnr === "D")) {
                        roots.push(map[item.PhPspnr]);
                    }
                }
            });

            //    Se construye la jerarquía padre-hijo (omitiendo "D")
            data.forEach(item => {

                if (item.PhPspnr === "D") return;

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
                    sKey !== "_linDateTo" &&
                    sKey !== "_Ejecutado" && 
                    sKey !=="_Pendiente" &&
                    sKey !== "_Total" &&
                    sKey !== "_isSinProveedor" &&
                    sKey !== "expanded" 
                
                ) {
                    oPayloadRow[sKey] = oRowData[sKey];
                }
            });
            oPayloadRow = this._formatPayloadDecimals(oPayloadRow);
            //    Envío con CampoMod
            await this._enviarFilaAlBackend(oContext, oPayloadRow, sCampoMod);
        },

        //  Se gestiona la pulsación del botón de eliminar para recoger las líneas
        // seleccionadas en la tabla y delegar la baja al servicio DelIndirectosSet.
        onDeletePress: async function () {
            //  Se obtiene la tabla y los índices seleccionados sobre el modelo de Corrientes.
            var oTable = this.byId("TreeTableBasic");
            var aSelectedIndices = oTable.getSelectedIndices();

            //  Se valida que al menos una línea haya sido seleccionada antes de continuar.
            if (aSelectedIndices.length === 0) {
                this.createMessageDialog({
                    title: this.getTranslatedText("ERROR"),
                    textAccept: this.getTranslatedText("ACEPTAR"),
                    messages: [{
                        text: this.getTranslatedText("ERROR_SELECCIONE_LINEA"),
                        type: "Error"
                    }]
                });
                return;
            }

            //  Se recopilan los datos completos de cada línea seleccionada para el envío.
            //   Cada fila se sanea con _sanitizeRowForBackend para evitar propiedades cliente.
            var aLinesToDelete = [];
            aSelectedIndices.forEach(function (iIndex) {
                var oContext = oTable.getContextByIndex(iIndex);
                if (oContext) {
                    aLinesToDelete.push(this._sanitizeRowForBackend(oContext.getObject()));
                }
            }.bind(this));

            //  Se verifica que la recolección de contextos haya producido datos válidos.
            if (aLinesToDelete.length === 0) {
                this.createMessageDialog({
                    title: this.getTranslatedText("ERROR"),
                    textAccept: this.getTranslatedText("ACEPTAR"),
                    messages: [{
                        text: "No se pudieron obtener los datos de las líneas seleccionadas",
                        type: "Error"
                    }]
                });
                return;
            }

            //  Se invoca el servicio de eliminación y se notifica cualquier excepción al usuario.
            try {
                await this._callDelIndirectosService(aLinesToDelete);
            } catch (error) {
                sap.m.MessageBox.error(
                    "Error al eliminar las operaciones: " + (error.message || error),
                    {
                        title: this.getTranslatedText("ERROR")
                    }
                );
            }
        },

        /**
         *  Se invoca el servicio DelIndirectosSet para dar de baja las operaciones
         * seleccionadas en la pestaña de Corrientes.
         * @param {array} aLinesToDelete - Conjunto de líneas a eliminar.
         * @returns {Promise} - Promesa con la respuesta del servicio.
         */
        _callDelIndirectosService: async function (aLinesToDelete) {
            //  Se obtienen los modelos globales necesarios para construir la petición.
            var oAppData = this.getGlobalModel("appData").getData();
            var oDashModel = this.getGlobalModel("dashboardModel");

            //  Se localiza la versión marcada como activa dentro del modelo de versiones.
            var versiones = oAppData.NavLtVersiones;
            var flagSelectVersion = versiones.find(function (item) {
                return item.Activo === "X";
            });

            //  Se determina la fecha real del tramo, con respaldo en el modelo de dashboard.
            var sFreal = "";
            if (oAppData && oAppData.tramo && oAppData.tramo.Freal) {
                sFreal = oAppData.tramo.Freal;
            } else if (oDashModel) {
                sFreal = oDashModel.getProperty("/NavMasterLt/0/Freal");
            }

            if (!sFreal) {
                throw new Error("Fecha real no disponible");
            }

            //  Se parsea la fecha OData y se extrae el ejercicio que viaja en cabeceras.
            var oDateStart = this._parseODataDate(sFreal);
            if (!oDateStart || isNaN(oDateStart.getTime())) {
                throw new Error("Fecha real inválida");
            }

            var sEjercicio = oDateStart.getFullYear().toString();
            const token = oAppData.EvToken;

            //  Se muestra el diálogo ocupado mientras dura la llamada al servicio.
            if (!this._busyDialog) {
                this._busyDialog = new sap.m.BusyDialog({
                    text: this.getTranslatedText("ELIMINANDO_DATOS") || "Eliminando..."
                });
            }
            this._busyDialog.open();

            try {
                //  Se ejecuta la llamada POST contra el servicio principal con los headers requeridos.
                var response = await this.post(
                    this.getGlobalModel("mainService"),
                    "/DelIndirectosSet",
                    {
                        "NavSelProyecto": [oAppData.tramo],
                        "NavLtVersiones": [flagSelectVersion],
                        "NavDatosIndirectos": aLinesToDelete,
                        "NavMensajes": []
                    },
                    {
                        headers: {
                            ambito: oAppData.userData.initialNode,
                            lang: oAppData.userData.AplicationLangu,
                            decimales: oDashModel.getData().decimales,
                            norma: this.getGlobalModel("normModel").getData().norma || "",
                            ejercicio: sEjercicio,
                            pestana: "Corrientes",
                            token: token
                        }
                    }
                );

                this._busyDialog.close();

                //  Se inspeccionan los mensajes devueltos por el servicio en busca de errores.
                var aMensajes = response.NavMensajes?.results || [];
                var aMensajesError = aMensajes.filter(function (mensaje) {
                    return mensaje.Tipo === "E";
                });

                if (aMensajesError.length > 0) {
                    this.createMessageDialog({
                        title: this.getTranslatedText("ERROR"),
                        textAccept: this.getTranslatedText("ACEPTAR"),
                        messages: aMensajesError.map(function (mensaje) {
                            return {
                                text: mensaje.Mensaje || mensaje.Message || mensaje.text || "",
                                type: "Error"
                            };
                        })
                    });
                    return;
                }

                //  Si no se devuelven errores, se eliminan las líneas del modelo local de Corrientes.
                //   El modelo es un arbol con children anidados, asi que se borra recursivamente
                // via _removeRowsFromTreeByKey (BaseController) en vez de un splice plano.
                var oModel = this.getView().getModel("corrientesModel");
                this._removeRowsFromTreeByKey(oModel.getData(), aLinesToDelete);
                oModel.refresh(true);

                var oTable = this.byId("TreeTableBasic");
                oTable.clearSelection();

                //  Se marca la variante activa como modificada tras la operación de borrado.
                this._markVariantDirty();

                //  Se informa al usuario del número de líneas eliminadas con éxito.
                sap.m.MessageToast.show(
                    "Se han eliminado " + aLinesToDelete.length + " línea(s) correctamente"
                );

                //  Se muestran, si existen, los mensajes informativos, de aviso o de éxito devueltos.
                var aMensajesInfo = aMensajes.filter(function (mensaje) {
                    return mensaje.Tipo === "S" || mensaje.Tipo === "I" || mensaje.Tipo === "W";
                });

                if (aMensajesInfo.length > 0) {
                    this.createMessageDialog({
                        title: this.getTranslatedText("INFORMACION") || "Información",
                        textAccept: this.getTranslatedText("ACEPTAR"),
                        messages: aMensajesInfo.map(function (mensaje) {
                            var sType = "Information";
                            if (mensaje.Tipo === "W") sType = "Warning";
                            if (mensaje.Tipo === "S") sType = "Success";

                            return {
                                text: mensaje.Mensaje || mensaje.Message || mensaje.text || "",
                                type: sType
                            };
                        })
                    });
                }

                return response;

            } catch (error) {
                //  Se garantiza el cierre del diálogo ocupado ante cualquier error inesperado.
                this._busyDialog.close();
                throw error;
            }
        },
    });
});
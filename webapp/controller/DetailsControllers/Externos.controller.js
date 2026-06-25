sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/table/Column",
    "sap/m/Input",
    "sap/m/Button",
    "sap/m/Label",
    "zindirect_costs/controller/BaseController",
    "zindirect_costs/model/formatter"
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

    return BaseController.extend("zindirect_costs.controller.DetailsControllers.Externos", {
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
                                stopImmediatePropagation: function () { oNativeEvent.stopImmediatePropagation(); },
                                // (INICIO MV) Se anyade stopPropagation al evento sintetico para que BaseController._onInputKeyDown pueda frenar la propagacion ascendente al TreeTable. Sin esta funcion el handler lanzaba TypeError y rompia toda la navegacion con flechas tras el ultimo cambio de BaseController. (FIN MV)
                                stopPropagation: function () { oNativeEvent.stopPropagation(); }
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

            this._setupBrowserCloseHandler();
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
                        //      Se declara NavDatosIndirectosDesglo vacio en el body para que
                        //   el gateway popule la nav inline en la respuesta. Sin esta linea el backend
                        //   la devuelve como {__deferred:{uri:...}} y al seguir la URI responde
                        //   501 Method 'DATOSINDIRECTO01_GET_ENTITYSET' not implemented. Misma
                        //   convencion ya usada para NavDatosIndirectos / NavKpisIndirectos.  
                        "NavDatosIndirectosDesglo": [],
                         "NavKpisIndirectos":[],
                        //   Se envía en el body el capítulo ya bloqueado por el usuario para evitar
                        //      que el backend lo intente bloquear de nuevo y dispare el error de
                        //      bloqueo propio al cambiar de año en el selector.
                        "EvBloqueados": this.getGlobalModel("appData").getProperty("/EvBloqueados") || "",
                        "NavMensajes": [],
                        "NavLtVersiones": [flagSelectVersion]
                    },
                    {
                        headers: {
                            ambito: this.getGlobalModel("appData").getData().userData.initialNode,
                            lang: this.getGlobalModel("appData").getData().userData.AplicationLangu,
                            bloqueado: this.getGlobalModel("appData").getProperty("/EvBloqueados") || "",
                            decimales: this.getGlobalModel("dashboardModel").getData().decimales,
                            ejercicio: sEjercicio,
                            pestana: "Externos",
                            token: token
                        }
                    }
                );

                //   Mismo manejo de mensajes que Diferidos/Inmovilizados/Corrientes: se
                // recogen los mensajes de error de NavMensajes y se muestran en un dialog.
                // Sin este bloque, errores como "Chapter X cannot be modified, blocked by ..."
                // no llegaban nunca al usuario aunque el backend los devolviera.
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

                //   Estado de bloqueo de la pestana: el header backend EvBloqueados llega
                // vacio si la pestana se puede editar y con contenido si esta bloqueada.
                // El modelo modeloBloqueo se consume desde la view para habilitar/deshabilitar
                // controles (Add, Delete, PepDest, Reparto, etc). Mismo patron que Corrientes.
                var sEvBloqueados = response.EvBloqueados || "";
                //   Se persiste el capítulo bloqueado en appData (mismo patrón que el resto
                //      de detail controllers) para que la próxima llamada a CambioPestIndirectosSet
                //      lo envíe en el body y el backend no intente bloquearlo de nuevo, evitando
                //      el error de bloqueo propio al cambiar de año en el selector.
                this.getGlobalModel("appData").setProperty("/EvBloqueados", sEvBloqueados);
                 var bIsBlocked = sEvBloqueados.trim().length > 0 && aMensajesError.length === 0;

                //   Se reemplaza SIEMPRE modeloBloqueo con una instancia JSONModel nueva en lugar de actualizar la existente via setProperty. setProperty+refresh no propagaba a las expression bindings de las columnas dinamicas instanciadas dinamicamente desde BaseController (botones Add/Delete, Select Reparto, meses, etc.): cuando se cambiaba de pestana y volvia con el backend devolviendo bloqueo, los campos quedaban editable=true. Con setModel todas las bindings se vuelven a atar a la nueva instancia y el isBlocked se propaga correctamente.
                var oModeloBloqueo = new sap.ui.model.json.JSONModel({
                    isBlocked: bIsBlocked
                });
                this.getView().setModel(oModeloBloqueo, "modeloBloqueo");

                this._setWaersFromData(response.NavDatosIndirectos.results); //   captura la moneda de la obra para formatDecimales
                //     
                //   Se almacena en el controller la nueva nav NavDatosIndirectosDesglo que el
                //   backend agrega a CambioPestIndirectosSet. Por ahora se persiste tal cual y
                //   se registra en consola para diagnostico; el merge en el arbol de Externos
                //   se hara cuando Angel confirme el formato exacto del payload de respuesta.
                this._aDesgloseFromBackend = (response.NavDatosIndirectosDesglo && response.NavDatosIndirectosDesglo.results) || [];
                //    
                const tree = this.buildTree(response.NavDatosIndirectos.results);
                //      Se mergean las filas del desglose (NavDatosIndirectosDesglo)
                //   en el arbol recien construido. Cada fila se engancha como hija del
                //   capitulo padre (match por Psphi+Version+Pspnr) con los flags
                //   __isCustom/__isNieto/__isEditable que el XML usa para renderizar el
                //   bloque editable. Sin esta llamada las filas existian en memoria
                //   (this._aDesgloseFromBackend) pero no aparecian en la TreeTable.  
                this._mergeBackendDesgloseIntoTree(tree, this._aDesgloseFromBackend);
                //   Si el modelo ya existe se actualizan sus datos in-place con setData en lugar de instanciar un JSONModel nuevo y reemplazarlo con setModel. Reemplazar el modelo en cambios de pestana provocaba que las columnas dinamicas (anyo/mes/Resto) perdieran su contexto de binding momentaneamente y que las columnas estaticas como %Tasa, Operacion destino o Pend a planificar acabaran reordenadas al final de la tabla. Manteniendo la misma instancia las bindings se preservan y solo refrescan los datos.
                var oExternosModel = this.getView().getModel("externosModel");
                if (oExternosModel) {
                    oExternosModel.setData(tree);
                } else {
                    this.getView().setModel(new sap.ui.model.json.JSONModel(tree), "externosModel");
                }

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
                     _isSinProveedor: false,
                    isEditable: isO,
                    isSubcapitulo: isS,
                    isCapitulo: isC,
                    isVacio: isDesglose,
                    // (INICIO MV) Se marca isLevel3 en las filas PEP (Estructura "O") por simetria con Corrientes y para que la navegacion con flechas reconozca correctamente las filas operacion. (FIN MV)
                    isLevel3: isO,

                   editPhPspnr: false,
                    editPost1: false,

                    //   Se condiciona la editabilidad de %Tasa al valor de TipoTasa.
                    // Solo es editable cuando Estructura es O y TipoTasa es "X" (equivale a INT).
                    editTasa: isO && item.TipoTasa === "X",
                    editAmoEje: false,
                    editAmoEjeAjus: false,
                    editAmoEjeReal: false,
                    editAmoPen: false,
                    editAmoTot: false,
                    editPepDest: isO,
                editTipo: isO,
                    editPenPlan: false,
                    editMonths: false,
                    editPend: false,
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

            // Menú contextual con clic derecho sobre filas
            this._attachContextMenuToTable("TreeTableExternos");
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
         * Validaciones previas a la creacion de filas en la TreeTable de Externos.
         * Por ahora solo se implementan las validaciones (letras + mensajes), sin la
         * logica de crear/abrir popups que llegara en una iteracion posterior.
         */
        onAddPress: function () {
            var oTable = this.byId("TreeTableExternos");
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

            //    se delegan al backend las validaciones de fila OEO ("D"), de operacion de nivel 3 y de operacion con datos ejecutados (AmoEje > 0 y no subcapitulo). El servicio rechaza esas combinaciones con su propio mensaje y duplicarlas en cliente generaba mantenimiento adicional cada vez que cambiaba la regla de negocio. Se mantiene en local unicamente el bloqueo por desgloses preexistentes porque deriva del estado del modelo cargado y permite ahorrar un viaje innecesario al backend  

            var iLevel = this._getOperationLevel(sPhPspnr);

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
                // Validacion 5: solo se bloquea si la operacion tiene desgloses
                // PRE-EXISTENTES (cargados del backend). Los desgloses creados por el
                // usuario en esta misma sesion (isNew === true) NO cuentan: una vez que se
                // ha empezado a desglosar una operacion debe poderse anadir mas hermanos de
                // nivel 3 (y seguir editando los ya creados). _createLevel3Row ya numera el
                // siguiente sufijo a partir de los hijos existentes.
                var aDesgloses = oSelectedRow.children || [];
                var bTieneDesglosesBackend = aDesgloses.some(function (oChild) {
                    return oChild && oChild.isNew !== true;
                });
                if (bTieneDesglosesBackend) {
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
                this._createLevel3Row(oSelectedRow, oContextForAdd);
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
                if (bExpanded && oObject) {
                var bIsCustomNode =
                    oObject.__isCustom === true ||
                    oObject.__isMainBlock === true ||
                    oObject.__isSinAgrupador === true ||
                    oObject.__isAgrupadorBlock === true ||
                    oObject.__isProviderBlock === true;
                var bHasCustomDescendant =
                    typeof this._hasCustomDescendant === "function" &&
                    this._hasCustomDescendant(oObject);

                if (bIsCustomNode || bHasCustomDescendant) {
                    var that = this;
                    var bFired = false;
                    var fnCascade = function () {
                        if (bFired) return;
                        bFired = true;
                        if (typeof that._expandCustomLoop === "function") {
                            that._expandCustomLoop(oTable, 15, function () {
                                if (typeof that._highlightSinProveedor === "function") {
                                    that._highlightSinProveedor(oTable);
                                }
                                if (typeof that._applyBlockBorder === "function") {
                                    that._applyBlockBorder(oTable);
                                }
                                if (typeof that._updateCustomColsVisibility === "function") {
                                    that._updateCustomColsVisibility();
                                }
                            }, sPath);
                        }
                    };
                    oTable.attachEventOnce("rowsUpdated", fnCascade);
                    setTimeout(fnCascade, 200);
                }
            }
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

        /**
         * Limpia los event listeners al destruir el controlador
         */
        onExit: function () {
            this._teardownBrowserCloseHandler();
            if (this._boundResizeHandler) {
                $(window).off("resize", this._boundResizeHandler);
            }
        },

        /**NO SE ESTA USANDO (referencia histórica)
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

        //   Se gestiona la pulsación del botón de eliminar para recoger las líneas
        // seleccionadas en la tabla y delegar la baja al servicio DelIndirectosSet.
        onDeletePress: async function () {
            //   Se obtiene la tabla y los índices seleccionados sobre el modelo de Externos.
            var oTable = this.byId("TreeTableExternos");
            var aSelectedIndices = oTable.getSelectedIndices();

            //   Se valida que al menos una línea haya sido seleccionada antes de continuar.
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

            //   Se recopilan los datos completos de cada línea seleccionada para el envío.
            //   Cada fila se sanea con _sanitizeRowForBackend para evitar propiedades cliente.
            var aLinesToDelete = [];
            aSelectedIndices.forEach(function (iIndex) {
                var oContext = oTable.getContextByIndex(iIndex);
                if (oContext) {
                    aLinesToDelete.push(this._sanitizeRowForBackend(oContext.getObject()));
                }
            }.bind(this));

            //   Se verifica que la recolección de contextos haya producido datos válidos.
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

            //   Se invoca el servicio de eliminación y se notifica cualquier excepción al usuario.
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
         *   Se invoca el servicio DelIndirectosSet para dar de baja las operaciones
         * seleccionadas en la pestaña de Externos.
         * @param {array} aLinesToDelete - Conjunto de líneas a eliminar.
         * @returns {Promise} - Promesa con la respuesta del servicio.
         */
        _callDelIndirectosService: async function (aLinesToDelete) {
            //   Se obtienen los modelos globales necesarios para construir la petición.
            var oAppData = this.getGlobalModel("appData").getData();
            var oDashModel = this.getGlobalModel("dashboardModel");

            //   Se localiza la versión marcada como activa dentro del modelo de versiones.
            var versiones = oAppData.NavLtVersiones;
            var flagSelectVersion = versiones.find(function (item) {
                return item.Activo === "X";
            });

            //   Se determina la fecha real del tramo, con respaldo en el modelo de dashboard.
            var sFreal = "";
            if (oAppData && oAppData.tramo && oAppData.tramo.Freal) {
                sFreal = oAppData.tramo.Freal;
            } else if (oDashModel) {
                sFreal = oDashModel.getProperty("/NavMasterLt/0/Freal");
            }

            if (!sFreal) {
                throw new Error("Fecha real no disponible");
            }

            //   Se parsea la fecha OData y se extrae el ejercicio que viaja en cabeceras.
            var oDateStart = this._parseODataDate(sFreal);
            if (!oDateStart || isNaN(oDateStart.getTime())) {
                throw new Error("Fecha real inválida");
            }

            var sEjercicio = oDateStart.getFullYear().toString();
            const token = oAppData.EvToken;

            //   Se muestra el diálogo ocupado mientras dura la llamada al servicio.
            if (!this._busyDialog) {
                this._busyDialog = new sap.m.BusyDialog({
                    text: this.getTranslatedText("ELIMINANDO_DATOS") || "Eliminando..."
                });
            }
            this._busyDialog.open();

            try {
                //   Se ejecuta la llamada POST contra el servicio principal con los headers requeridos.
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
                            pestana: "Externos",
                            token: token
                        }
                    }
                );

                this._busyDialog.close();

                //   Se inspeccionan los mensajes devueltos por el servicio en busca de errores.
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

                //   Si no se devuelven errores, se eliminan las líneas del modelo local de Externos.
                //   El modelo es un arbol con children anidados, asi que se borra recursivamente
                // via _removeRowsFromTreeByKey (BaseController) en vez de un splice plano.
                var oModel = this.getView().getModel("externosModel");
                this._removeRowsFromTreeByKey(oModel.getData(), aLinesToDelete);
                oModel.refresh(true);

                var oTable = this.byId("TreeTableExternos");
                oTable.clearSelection();

                //   Se marca la variante activa como modificada tras la operación de borrado.
                this._markVariantDirty();

                //   Se informa al usuario del número de líneas eliminadas con éxito.
                //   Se traduce via i18n con placeholder {0} para soportar EN/FR.  
                sap.m.MessageToast.show(
                    this.getTranslatedText("MSG_LINEAS_ELIMINADAS", [aLinesToDelete.length])
                );
                //  

                //   Se muestran, si existen, los mensajes informativos, de aviso o de éxito devueltos.
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
                //   Se garantiza el cierre del diálogo ocupado ante cualquier error inesperado.
                this._busyDialog.close();
                throw error;
            }
        },
 onPhPspnrInputChange: function (oEvent) {
            return this.onRowInputChange(oEvent);
        },

        /**
         * Delegate puro a onRowInputChange para el Input de Post1 del Desglose nivel 3 nuevo.
         */
        onInputPost1Change: function (oEvent) {
            return this.onRowInputChange(oEvent);
        },

        /*   Configuración específica de Externos para el export XLSX (apartado 5.9 del spec) */

        /**
         *     Se sobrescribe la lista de columnas estáticas del export para incluir la columna
         *   "PEP Destino" (campo PepDest) entre "Coste total" y "Reparto" — específica de Externos.
         *   El resto del pipeline de exportación se hereda del BaseController.
         */
        _getStaticExportColumns: function () {
            //   Se traducen las cabeceras del export XLSX via i18n
            // para que el Excel descargado refleje el idioma activo de UI5.  
            return [
                { header: this.getTranslatedText("oper"), path: "PhPspnr" },
                { header: this.getTranslatedText("DESCRIPCION"), path: "Post1" },
                { header: this.getTranslatedText("costEje"), path: "AmoEje" },
                { header: this.getTranslatedText("costPend"), path: "AmoPen" },
                { header: this.getTranslatedText("costTotal"), path: "AmoTot" },
                { header: this.getTranslatedText("operacionDestino"), path: "PepDest" },
                { header: this.getTranslatedText("dbReparto"), path: "Tipo" },
                { header: this.getTranslatedText("proveedor"), path: "Proveedor" },
                { header: this.getTranslatedText("tarifa"), path: "FEE" },
                { header: this.getTranslatedText("fechaInicio"), path: "FINI" },
                { header: this.getTranslatedText("fechaFin"), path: "FFIN" },
                { header: this.getTranslatedText("numMeses"), path: "NMES" },
                { header: this.getTranslatedText("otros"), path: "Otros" },
                { header: this.getTranslatedText("dbPendPlanificar"), path: "PenPlan" }
            ];
            //  
        },
         _getPlantillaStaticColumns: function () {
            //   Idem para la plantilla de carga (las cabeceras compuestas
            // tipo "Operacion/Agrupador" usan claves colXxx anyadidas al bundle).  
            return [
                { header: this.getTranslatedText("colOperacionAgrupador"), path: "PhPspnr" },
                { header: this.getTranslatedText("DESCRIPCION"), path: "Post1" },
                { header: this.getTranslatedText("tasa%"), path: "Tasa" },
                { header: this.getTranslatedText("colCosteEjecProv"), path: "AmoEje" },
                { header: this.getTranslatedText("costPend") + "*", path: "AmoPen" },
                { header: this.getTranslatedText("costTotal"), path: "AmoTot" },
                { header: this.getTranslatedText("operacionDestino"), path: "PepDest" },
                { header: this.getTranslatedText("dbReparto"), path: "Tipo" },
                { header: this.getTranslatedText("fechaInicio"), path: "FINI" },
                { header: this.getTranslatedText("fechaFin"), path: "FFIN" }
            ];
            //  
        },

        /*   */

    });
});
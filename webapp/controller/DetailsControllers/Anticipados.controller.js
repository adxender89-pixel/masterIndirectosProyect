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

    return BaseController.extend("zindirect_costs.controller.DetailsControllers.Anticipados", {

        formatter: formatter,

        /**
         * Formatter function to translate TipoInd values
         * @param {string} sTipoInd - The TipoInd value
         * @returns {string} The translated text
         */
        formatTipoInd: function (sTipoInd) {
            if (!sTipoInd) {
                return "";
            }
            
            var sKey;
            switch (sTipoInd) {
                case "I":
                    sKey = "tipoIndInversion";
                    break;
                case "A":
                    sKey = "tipoIndAmortizacion";
                    break;
                default:
                    return sTipoInd;
            }
            
            return this.getTranslatedText(sKey);
        },

        /**
         * Inicializa la vista de Diferidos definiendo el estado de navegación y visibilidad.
         * Configura la tabla principal y prepara las columnas anuales iniciales.
         */
        getCustomTableId: function () {
            return "TreeTableAnticipados";
        },
        //      Se sobrescribe el hook para indicar que
        //  en Anticipados el campo "Coste pendiente" se mapea
        //  en el modelo como "_Pendiente". Lo utiliza el
        //  onMonthInputChange del BaseController para calcular
        //  porcentajes sobre las celdas mensuales editables.
        _getCostePendienteField: function () {
            return "_Pendiente";
        },
        //    

        onInit: function () {

            this.setInitData();
            this._originalAnticipadosData = null;
        },
        /**
                 *  La función ejecuta la inicialización de la vista de Anticipados.
                 * El sistema guarda un "snapshot" del layout estándar para restaurarlo manualmente.
                 */
        setInitData: async function () {
            this.initVariantConfig({
                tableId: "TreeTableAnticipados",
                modelName: "anticipadosModel",
                storageKey: "anticipados_variants"
            });

            this._initVariantManagement();

            //   Se identifica esta vista como Anticipados para los headers de los servicios.
            this._pestana = "Anticipados";
            //   Se define el nombre del modelo de tabla para las operaciones genéricas del BaseController
            //   (como onAgrupadorButtonPress) que usan tableModelName para acceder al binding context.
            this.tableModelName = "anticipadosModel";

            this._initYearsModel();
            // Se delega la inicialización al método asíncrono para garantizar
            // que las columnas dinámicas se crean siempre después de las estáticas.
            //this.initAnticipadosModel(this._previousTabKey);

            this.getView().setModel(new JSONModel({
                selectedKey: "Home"
            }), "state");

            this.getView().setModel(new JSONModel({
                tableVisible: false,
                splitterSizeMain: "100%"
            }), "viewModel");
            this.setupDynamicTreeTable("TreeTableAnticipados");

            //  Se crean las columnas dinámicas utilizando el rango Freal → Frealfinobra,
            //  evitando el uso de años fijos basados en la fecha actual.
            this.createDynamicYearColumns("TreeTableAnticipados");





            this._boundResizeHandler = function () {
                this._calculateDynamicRows();
            }.bind(this);
            $(window).on("resize", this._boundResizeHandler);

            this._boundBrowserClose = this.onBrowserClose.bind(this);
            window.addEventListener("beforeunload", this._boundBrowserClose);




            var oTable = this.byId("TreeTableAnticipados");
            if (oTable) {
                oTable.addEventDelegate({
                    onAfterRendering: function () {
                        if (this._bAnticipadosFirstRender) return;
                        this._bAnticipadosFirstRender = true;

                        //  El sistema crea las columnas dinámicas.
                        //  this.createYearColumns(new Date().getFullYear(), 3, "TreeTableAnticipados");
                        this._attachHeaderToggleListener();


                        //  El sistema captura el estado base (Standard) de las columnas.
                        //  Se guarda el ID, visibilidad y ancho para poder "limpiar" cambios de otras variantes.
                        this._aStandardLayout = oTable.getColumns().map(function (oCol) {
                            return {
                                col: oCol,
                                visible: oCol.getVisible(),
                                width: oCol.getWidth()
                            };
                        });

                        var oVModel = this.getView().getModel("variantModel");
                        if (oVModel && this._aVariants) {
                            var sCurrentName = oVModel.getProperty("/currentName");

                            var oCurrentVariant = this._aVariants.find(function (v) {
                                return v.name === sCurrentName;
                            });

                            //  Si es Standard, se fuerza la limpieza de cualquier residuo de otras variantes.
                            if (!oCurrentVariant || sCurrentName === "Standard") {
                                this._applyStandardReset();
                            } else if (oCurrentVariant.state) {
                                this._bSuppressDirtyFlag = true;
                                this._applyVariantState(oCurrentVariant.state);
                                this._bSuppressDirtyFlag = false;
                            }
                            this._bVariantAppliedByDelegate = true;
                        }
                    }.bind(this)
                });
            }
        },
        onAfterRendering: function (oEvent) {
            let table = this.byId("TreeTableAnticipados");
            
            // Detach previous handlers to avoid duplicates
            if (this._colorRowsHandler) {
                table.detachEvent("rowsUpdated", this._colorRowsHandler);
                table.detachEvent("firstVisibleRowChanged", this._colorRowsHandler);
            }
            
            // Create bound handler and store reference
            // Se usa una función anónima para no pasar el evento como argumento a colorRows
            this._colorRowsHandler = function() { this.colorRows(); }.bind(this);
            table.attachEvent("rowsUpdated", this._colorRowsHandler);
            table.attachEvent("firstVisibleRowChanged", this._colorRowsHandler);
            
            // Force initial coloring after a short delay to ensure DOM is ready
            setTimeout(function() {
                this.colorRows();
            }.bind(this), 100);
            
            // Adjuntar listener para el botón de colapsar del header después del renderizado
            this._attachHeaderToggleListener();
            
            // Calcular filas dinámicas
            this._calculateDynamicRows();
        },
        

        /**
         *  La función elimina cualquier modificación de layout o datos y restaura el estado base.
         *  El sistema recorre el snapshot guardado para asegurar que la tabla vuelva al diseño original.
         */
        _applyStandardReset: function () {
            var oTable = this.byId("TreeTableAnticipados");
            var oModel = this.getView().getModel("anticipadosModel");

            if (!oTable || !this._aStandardLayout) return;

            this._bSuppressDirtyFlag = true;

            // El sistema restaura las propiedades físicas de las columnas desde el snapshot.
            this._aStandardLayout.forEach(function (oItem) {
                oItem.col.setVisible(oItem.visible);
                oItem.col.setWidth(oItem.width);
            });

            //  El sistema limpia los datos editados cargando de nuevo la copia del servidor original.
            if (this._originalServerData && oModel) {
                oModel.setData(JSON.parse(JSON.stringify(this._originalServerData)));
            }

            this._bSuppressDirtyFlag = false;

            // El sistema asegura que el flag de modificación (dirty) esté desactivado para Standard.
            if (this.getView().getModel("variantModel")) {
                this.getView().getModel("variantModel").setProperty("/isDirty", false);
            }
        },

        _createSnapshot: function () {
            var oDefaultModel = this.getView().getModel("anticipadosModel");
            if (oDefaultModel) {
                var oData = oDefaultModel.getData();
                this._originalData = JSON.parse(JSON.stringify(oData));
            }
        },

        /**
         *  La función restaura la tabla al estado base guardado durante la inicialización.
         * El sistema limpia los cambios de usuario y restablece los valores originales del servidor.
         */
        _restoreStandardState: function () {
            var oTable = this.byId("TreeTableAnticipados");
            var oModel = this.getView().getModel("anticipadosModel");

            if (!oTable || !this._aStandardColumnLayout) return;

            this._bSuppressDirtyFlag = true;

            //  El sistema restablece la configuración física de cada columna guardada en el layout base.
            this._aStandardColumnLayout.forEach(function (oConfig) {
                var oCol = sap.ui.getCore().byId(oConfig.id);
                if (oCol) {
                    oCol.setVisible(oConfig.visible);
                    oCol.setWidth(oConfig.width);
                }
            });

            // 
            //El sistema recarga la copia profunda de los datos originales del servidor.
            if (this._originalServerData && oModel) {
                oModel.setData(JSON.parse(JSON.stringify(this._originalServerData)));
            }

            this._bSuppressDirtyFlag = false;
        },

        /**
         * Se inicializa el modelo de datos de la pestaña Anticipados realizando
         * una petición POST al servicio OData y construyendo la estructura jerárquica.
         *  Se convierte en async/await y se elimina la definición duplicada.
         * El bloque de aplicación de delta se mantiene aquí ya que los datos del
         * modelo deben estar actualizados antes de que el delegate aplique la variante.
         */
        initAnticipadosModel: async function (sPreviousKey) {
            var oAppData = this.getGlobalModel("appData").getData();
            var versiones = oAppData.NavLtVersiones;
            var flagSelectVersion = versiones.find(function (item) {
                return item.Activo === "X";
            });

            var sFreal = oAppData.Freal || (oAppData.tramo && oAppData.tramo.Freal) || "";
            var oDashModel = this.getGlobalModel("dashboardModel")
            var sFreal = "";

            var versiones = this.getGlobalModel("appData").getData().NavLtVersiones;
            // Se busca e identifica el objeto correspondiente a la versión que se encuentra actualmente marcada como activa ("X").
            var flagSelectVersion = versiones.find(function (item) {
                return item.Activo === "X";
            });

            if (oAppData && oAppData.tramo && oAppData.tramo.Freal) {
                sFreal = oAppData.tramo.Freal;
            } else if (oDashModel) {
                // Se recurre al dashboardModel únicamente si appData no contiene Freal.
                sFreal = oDashModel.getProperty("/NavMasterLt/0/Freal");
            }
            if (!sFreal) {

                setTimeout(function () {
                    this.initAnticipadosModel(sPreviousKey);
                }.bind(this), 500);
                return;
            }
            var oDateStart = this._parseODataDate(sFreal);

            // Si el parseo de Freal falla, se detiene la ejecución sin enviar ninguna llamada.
            // No se permite continuar con un ejercicio incorrecto.
            if (!oDateStart || isNaN(oDateStart.getTime())) {

                return;
            }

            //   Se establece la fecha efectiva para que onCreateMonthsTable arranque
            //   desde el mes correcto (igual que en Corrientes/Externos).
            //   Si Freal y Frealsist no coinciden en el mismo día, se usa Freal + 1 día,
            //   replicando exactamente la lógica de Corrientes.
            var sFrealsist = this.getGlobalModel("appData").getProperty("/Frealsist")
                          || (oAppData.tramo && oAppData.tramo.Frealsist) || "";
            var oDateFrealsist = sFrealsist ? this._parseODataDate(sFrealsist) : null;
            var bSameDay = oDateFrealsist && oDateStart.getDate() === oDateFrealsist.getDate();
            if (bSameDay) {
                this._effectiveDate = oDateStart;
            } else {
                var oDatePlusOne = new Date(oDateStart);
                oDatePlusOne.setDate(oDatePlusOne.getDate() + 1);
                this._effectiveDate = oDatePlusOne;
            }

          //   Se obtiene el ejercicio desde el selector con fallback al año de Freal, 
            //   replicando el patron de Corrientes/Externos. Antes se leia siempre de Freal 
            //   por lo que el cambio de año en el selector no se reflejaba en el header. 
            var sEjercicioFromSelector = this._getSelectedEjercicio(); // 
            var sEjercicioFallback = oDateStart.getFullYear().toString(); // 
            var sEjercicio = sEjercicioFromSelector || sEjercicioFallback; //
            const token = this.getGlobalModel("appData").getProperty("/EvToken");
            try {
                var response = await this.post(
                    this.getGlobalModel("mainService"),
                    "/CambioPestIndirectosSet",
                    {
                        "NavSelProyecto": [this.getGlobalModel("appData").getData().tramo],
                        "NavChanges": [],
                        "NavDatosIndirectos": [],
                         "NavKpisIndirectos":[],
                        //   Se envía en el body el capítulo ya bloqueado por el usuario para evitar
                        //      que el backend lo intente bloquear de nuevo y dispare el error de
                        //      bloqueo propio al cambiar de año en el selector.
                        "EvBloqueados": this.getGlobalModel("appData").getProperty("/EvBloqueados") || "",
                        "NavMensajes": [],
                        "NavDatosIndirectos": [],
                        "NavLtVersiones": [flagSelectVersion]
                    },
                    {
                        headers: {
                            ambito: this.getGlobalModel("appData").getData().userData.initialNode,
                            lang: this.getGlobalModel("appData").getData().userData.AplicationLangu,
                            bloqueado: this.getGlobalModel("appData").getProperty("/EvBloqueados") || "",
                            decimales: this.getGlobalModel("dashboardModel").getData().decimales,
                            ejercicio: sEjercicio,
                            pestana: "Anticipados",
                            token: token
                        }
                    }
                );

                var aMensajes = response.NavMensajes?.results || [];
                    var aMensajesError = aMensajes.filter(function(mensaje) {
                        return mensaje.Tipo === "E";
                    });

                    if (aMensajesError.length > 0) {
                        this.createMessageDialog({
                            title: this.getTranslatedText("ERROR"),
                            textAccept: this.getTranslatedText("ACEPTAR"),
                            messages: aMensajesError.map(function(mensaje) {
                            return {
                                text: mensaje.Mensaje || mensaje.Message || mensaje.text || "",
                                type: "Error"
                            };
                        })
                        });
                    }
                // Capturar el estado de bloqueo de la pestaña desde EvBloqueados
                var sEvBloqueados = response.EvBloqueados || "";
                var bIsBlocked = sEvBloqueados.trim().length > 0;
                this.getGlobalModel("appData").setProperty("/EvBloqueados", sEvBloqueados);
                // Crear o actualizar el modelo de bloqueo
                var oModeloBloqueo = this.getView().getModel("modeloBloqueo");
                if (!oModeloBloqueo) {
                    oModeloBloqueo = new sap.ui.model.json.JSONModel({
                        isBlocked: bIsBlocked
                    });
                    this.getView().setModel(oModeloBloqueo, "modeloBloqueo");
                } else {
                    oModeloBloqueo.setProperty("/isBlocked", bIsBlocked);
                }
                
                this._setWaersFromData(response.NavDatosIndirectos.results); //   captura la moneda de la obra para formatDecimales
                this._addComputedFields(response.NavDatosIndirectos.results);
                this._updateKpiTables(response.NavDatosIndirectos.results);
                var tree = this.buildTree(response.NavDatosIndirectos.results);
                var oNewModel = new sap.ui.model.json.JSONModel(tree);
                this.getView().setModel(oNewModel, "anticipadosModel");
                this._createSnapshot();
                this._originalAnticipadosData = JSON.parse(JSON.stringify(tree));
                setTimeout(function () {
                    this.colorRows();
                }.bind(this), 500);
                oNewModel.attachPropertyChange(function () {
                    this._markVariantDirty();
                }.bind(this));

                // Se aplica el delta de celdas editadas de la variante activa
                // sobre el modelo recién cargado, antes de que el delegate de
                // afterRendering aplique el estado completo de columnas y expansiones.
                var oVModel = this.getView().getModel("variantModel");
                if (oVModel && this._aVariants) {
                    var sCurrentName = oVModel.getProperty("/currentName");
                    var oCurrentVariant = this._aVariants.find(function (v) {
                        return v.name === sCurrentName;
                    });
                    if (oCurrentVariant && oCurrentVariant.state &&
                        Array.isArray(oCurrentVariant.state.modelDelta) &&
                        oCurrentVariant.state.modelDelta.length > 0) {
                        this._bSuppressDirtyFlag = true;
                        this._applyModelDelta(oCurrentVariant.state.modelDelta);
                        this._bSuppressDirtyFlag = false;
                    }
                }

            } catch (e) {
                // Se captura el error para que setInitData pueda continuar.
            }
        },
        _parseODataDate: function (sODataDate) {
            if (!sODataDate) return null;
            var oMatch = /\/Date\((\d+)\)\//.exec(sODataDate);
            if (oMatch) {
                return new Date(parseInt(oMatch[1], 10));
            }
            return new Date(sODataDate);
        },

        _updateKpiTables: function(aData) {
            var aRaiz = aData.filter(function(item) { return item.ParentPath === "I"; });
            var oInv = aRaiz.find(function(item) { return item.TipoInd === "I"; }) || {};
            var oAmo = aRaiz.find(function(item) { return item.TipoInd === "A"; }) || {};
            var oDataTitleModel = new sap.ui.model.json.JSONModel({
                data: [{
                    title:  oInv._Ejecutado || "0",
                    title2: oInv._Pendiente || "0",
                    title3: oInv._Total     || "0",
                    title4: oAmo._Ejecutado || "0",
                    title5: oAmo._Pendiente || "0",
                    title6: oAmo._Total     || "0"
                }]
            });
            this.getView().setModel(oDataTitleModel, "dataTitle");
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
                // Marcar filas de desglose (children) con flags de visualización
                if (Array.isArray(item.children) && item.children.length > 0 && item.TipoInd === "I") {
                    this._markDesgloseChildren(item.children);
                }
            }.bind(this));
        },

        /**
         * Marca las filas hijas de un desglose de inversión con los flags necesarios para la vista:
         * - __isEditable: true para filas con proveedor asignado (editables)
         * - __isSinProveedor: true para la fila "Resto de proveedores" (calculada, solo lectura)
         */
        _markDesgloseChildren: function(aChildren) {
            aChildren.forEach(function(oChild) {
                if (oChild.__isSinProveedor === true) {
                    // Ya está marcada como "Resto de proveedores" por el backend
                    oChild.__isEditable = false;
                } else {
                    // Fila editable con proveedor
                    oChild.__isEditable = true;
                    oChild.__isSinProveedor = false;
                }
            });
        },

        /**
         * Handler del botón "+" inline de la columna PhPspnr.
         * Crea una nueva fila de desglose vacía (con proveedor) en el array children
         * de la operación de Inversión pulsada, y genera automáticamente la fila
         * "Resto de proveedores" si todavía no existe.
         *
         * Lógica:
         *  1. Obtiene el contexto de la fila desde el botón pulsado.
         *  2. Valida que la operación sea TipoInd="I" y Estructura="O".
         *  3. Crea una nueva fila editable con __isEditable=true e inicializa
         *     todos sus campos a cero/vacío.
         *  4. Si no existe ya la fila "Resto de proveedores" (__isSinProveedor=true),
         *     la crea y la inserta al final del array children.
         *  5. Refresca el modelo y expande el nodo para que las filas hijas sean visibles.
         */
        onAddDesglosePress: function(oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("anticipadosModel");
            if (!oContext) return;

            var oData = oContext.getObject();
            var sPath = oContext.getPath();
            var oModel = oContext.getModel();

            // Validación defensiva: solo para Inversión nivel operación
            if (oData.TipoInd !== "I" || oData.Estructura !== "O") {
                return;
            }

            // Obtener o inicializar el array de children
            var aChildren = oData.children ? oData.children.slice() : [];

            // Etiquetas para la fila cabecera del desglose (i18n con fallbacks)
            var sLabelAgrup    = this.getTranslatedText("agrupador")        || "Agrupador";
            var sLabelDescrip  = this.getTranslatedText("DESCRIPCION")      || "Descripción";
            var sLabelProv     = this.getTranslatedText("proveedor")        || "Proveedor";
            var sLabelEje      = this.getTranslatedText("ejecutado")        || "Ejecutado";
            var sLabelPend     = this.getTranslatedText("pendiente")        || "Pendiente";
            var sLabelTot      = this.getTranslatedText("total")            || "Total";
            var sLabelReparto  = this.getTranslatedText("dbReparto")        || "Reparto";
            var sLabelPenPlan  = this.getTranslatedText("dbPendPlanificar") || "Pend. planificar";
            var sLabelResto    = this.getTranslatedText("restoProv")        || "Resto de proveedores";

            // Si el array de children ya tiene al menos un hijo editable o un "Resto",
            // omitir la creación de la fila cabecera (ya existe del primer click).
            var bHasHeader = aChildren.some(function(c) { return c.__isHeader === true; });

            // Crear la fila cabecera gris (solo si es el primer desglose)
            if (!bHasHeader) {
                var oHeaderRow = {
                    __isCustom: true,
                    __isHeader: true,
                    __isEditable: false,
                    __isSinProveedor: false,
                    // Campos dedicados para las etiquetas de la fila cabecera
                    // (se usan nombres con prefijo _header para no colisionar con los datos reales)
                    _headerAgrup:   sLabelAgrup,
                    _headerDescr:   sLabelDescrip,
                    _headerProv:    sLabelProv,
                    _headerEje:     sLabelEje,
                    _headerPend:    sLabelPend,
                    _headerTot:     sLabelTot,
                    _headerReparto: sLabelReparto,
                    _headerPenPlan: sLabelPenPlan,
                    // Campos numéricos a cero (no se muestran en el header)
                    AGRUP: "", Post1: "", DESCRIP: "", LIFNR: "",
                    INVEJE: "0", INVPEN: "0", INVTOT: "0", PENPLAN: "0",
                    Tipo: sLabelReparto, PenPlan: sLabelPenPlan,
                    _Ejecutado: "0", _Pendiente: "0", _Total: "0",
                    children: []
                };
                aChildren.unshift(oHeaderRow);
            }

            // Calcular el siguiente número de agrupador (AGRUP) libre
            // (omitir el header al calcular)
            var iMaxNum = 0;
            aChildren.forEach(function(oChild) {
                if (oChild.__isEditable === true) {
                    var sAgrup = oChild.AGRUP || "";
                    var iNum = parseInt(sAgrup, 10);
                    if (!isNaN(iNum) && iNum > iMaxNum) {
                        iMaxNum = iNum;
                    }
                }
            });
            var iNextNum = iMaxNum + 1;
            var sNextAgrup = iNextNum.toString().padStart(3, "0");

            // Crear la nueva fila de desglose editable
            // AGRUP vacío: el usuario lo rellena manualmente
            var oNewDesglose = {
                __isCustom: true,
                __isEditable: true,
                __isSinProveedor: false,
                __isHeader: false,
                AGRUP:  "",
                DESCRIP: "",
                LIFNR:  "",
                _headerProv: "",
                INVEJE: "0",
                INVPEN: "0",
                INVTOT: "0",
                PENPLAN: "0",
                TIPO:   "MAN",
                Val01a1: "0", Val02a1: "0", Val03a1: "0", Val04a1: "0",
                Val05a1: "0", Val06a1: "0", Val07a1: "0", Val08a1: "0",
                Val09a1: "0", Val10a1: "0", Val11a1: "0", Val12a1: "0",
                Totala1: "0",
                children: []
            };

            // Insertar la nueva fila de desglose antes de la fila "Resto de proveedores"
            var iSinProveedorIdx = aChildren.findIndex(function(c) { return c.__isSinProveedor === true; });
            if (iSinProveedorIdx !== -1) {
                aChildren.splice(iSinProveedorIdx, 0, oNewDesglose);
            } else {
                // No existe aún la fila "Resto": insertar la nueva antes del final
                // y crear "Resto de proveedores" al final
                aChildren.push(oNewDesglose);

                var oResto = {
                    __isCustom: true,
                    __isEditable: false,
                    __isSinProveedor: true,
                    __isHeader: false,
                    AGRUP:  "",
                    Post1:  sLabelResto,
                    LIFNR:  "",
                    _headerProv: "",
                    INVEJE: oData.InvEje || "0",
                    INVPEN: oData.InvPen || "0",
                    INVTOT: oData.InvTot || "0",
                    PENPLAN: "0",
                    TIPO:   "MAN",
                    Val01a1: "0", Val02a1: "0", Val03a1: "0", Val04a1: "0",
                    Val05a1: "0", Val06a1: "0", Val07a1: "0", Val08a1: "0",
                    Val09a1: "0", Val10a1: "0", Val11a1: "0", Val12a1: "0",
                    Totala1: "0",
                    children: []
                };
                aChildren.push(oResto);
            }

            // Actualizar el array de children en el modelo
            oModel.setProperty(sPath + "/children", aChildren);
            oModel.refresh(true);

            // Expandir el nodo padre para mostrar los hijos recién añadidos
            var oTable = this.byId("TreeTableAnticipados");
            if (oTable) {
                var oBinding = oTable.getBinding("rows");
                if (oBinding) {
                    // Buscar el índice de la fila en la tabla para expandirlo
                    var iLength = oBinding.getLength();
                    for (var i = 0; i < iLength; i++) {
                        var oCtx = oTable.getContextByIndex(i);
                        if (oCtx && oCtx.getPath() === sPath) {
                            oBinding.expand(i);
                            break;
                        }
                    }
                }

                // Las columnas colMonths/colNew son para planificación de meses,
                // NO se muestran en bloques de desglose de inversión.
            }

            this._markVariantDirty();
            sap.m.MessageToast.show(
                this.getTranslatedText("MSG_DESGLOSE_CREADO") || "Línea de desglose añadida correctamente."
            );
        },

        /**
         * Handler del botón de agrupación en la fila cabecera del desglose de inversión.
         * Agrupa/desagrupa las filas de desglose por el campo AGRUP.
         * Alterna el estado __agrupadorActive en la fila cabecera del bloque.
         */
        onDesgloseAgrupadorPress: function(oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("anticipadosModel");
            if (!oContext) return;

            var sPath = oContext.getPath();
            var oModel = oContext.getModel();
            var oData = oContext.getObject();

            // Alternar el estado activo del agrupador
            var bCurrentActive = oData.__agrupadorActive === true;
            oModel.setProperty(sPath + "/__agrupadorActive", !bCurrentActive);

            this._markVariantDirty();
        },

        /**
         * Handler para cambio de campo AGRUP en filas de desglose de inversión.
         */
        onDesglosAGRUPChange: function(oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("anticipadosModel");
            if (oContext) {
                var sPath = oContext.getPath();
                var oModel = oContext.getModel();
                oModel.setProperty(sPath + "/AGRUP", oSource.getValue());
                this._markVariantDirty();
            }
        },

        /**
         * Handler para cambio del campo Proveedor (LIFNR) en filas de desglose.
         * Valida que el proveedor no esté ya asignado en otra fila del mismo desglose.
         */
        onDesgloseProveedorChange: function(oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("anticipadosModel");
            if (!oContext) return;

            var sNewLifnr = oSource.getValue().trim();
            var sPath = oContext.getPath();
            var oModel = oContext.getModel();
            var oData = oContext.getObject();

            if (!sNewLifnr) {
                oModel.setProperty(sPath + "/LIFNR", "");
                return;
            }

            // Validación: solo un proveedor por fila de desglose (no duplicados en el mismo bloque)
            // Se busca en los hermanos del mismo padre
            var sParentPath = sPath.substring(0, sPath.lastIndexOf("/"));
            var aParentData = oModel.getProperty(sParentPath);
            if (Array.isArray(aParentData)) {
                var bDuplicado = aParentData.some(function(oSibling) {
                    return oSibling !== oData &&
                        oSibling.__isEditable === true &&
                        (oSibling.LIFNR || "").trim().toUpperCase() === sNewLifnr.toUpperCase();
                });
                if (bDuplicado) {
                    this.createMessageDialog({
                        title: this.getTranslatedText("ERROR"),
                        textAccept: this.getTranslatedText("ACEPTAR"),
                        messages: [{ text: this.getTranslatedText("ERROR_PROVEEDOR_DUPLICADO_DESGLOSE"), type: "Error" }]
                    });
                    oSource.setValue(oData.LIFNR || "");
                    return;
                }
            }

            oModel.setProperty(sPath + "/LIFNR", sNewLifnr);
            this._markVariantDirty();
        },

        /**
         * Abre el diálogo de búsqueda de proveedores para la fila de desglose activa.
         */
        onDesgloseProveedorSearchPress: function(oEvent) {
            var oButton = oEvent.getSource();
            var oContext = oButton.getBindingContext("anticipadosModel");
            if (!oContext) return;
            this._oDesgloseProveedorContext = oContext;
            // Reutilizar el diálogo de búsqueda de proveedores del BaseController si existe
            if (typeof this.onProveedorSearchPress === "function") {
                this.onProveedorSearchPress(oEvent);
            }
        },

        /**
         * Handler para cambio de INVPEN en fila de desglose.
         * Valida que INVPEN + INVEJE = INVTOT.
         */
        onDesgloseInvPenChange: function(oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("anticipadosModel");
            if (!oContext) return;

            var sRawValue = oSource.getValue();
            var oAppData = this.getOwnerComponent().getModel("appData").getData().userData;
            var sCurrencyFormat = oAppData.CurrencyFormat;
            var sThousandSep = sCurrencyFormat.charAt(0);
            var sDecimalSep = sCurrencyFormat.charAt(1);
            sRawValue = sRawValue.split(sThousandSep).join("").split(sDecimalSep).join(".");

            var fPen = parseFloat(sRawValue) || 0;
            var sPath = oContext.getPath();
            var oModel = oContext.getModel();
            var oData = oContext.getObject();
            var fEje = parseFloat(oData.INVEJE) || 0;
            var fTot = parseFloat(oData.INVTOT) || 0;

            // Validación: Pendiente + Ejecutado = Total
            var fExpectedTot = fPen + fEje;
            // Si el total ya existe y es diferente, se avisa pero se actualiza
            oModel.setProperty(sPath + "/INVPEN", fPen.toString());
            oModel.setProperty(sPath + "/INVTOT", fExpectedTot.toString());
            this._markVariantDirty();
        },

        /**
         * Handler para cambio de INVTOT en fila de desglose.
         * Valida que INVPEN + INVEJE = INVTOT → recalcula INVPEN.
         */
        onDesgloseInvTotChange: function(oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("anticipadosModel");
            if (!oContext) return;

            var sRawValue = oSource.getValue();
            var oAppData = this.getOwnerComponent().getModel("appData").getData().userData;
            var sCurrencyFormat = oAppData.CurrencyFormat;
            var sThousandSep = sCurrencyFormat.charAt(0);
            var sDecimalSep = sCurrencyFormat.charAt(1);
            sRawValue = sRawValue.split(sThousandSep).join("").split(sDecimalSep).join(".");

            var fTot = parseFloat(sRawValue) || 0;
            var sPath = oContext.getPath();
            var oModel = oContext.getModel();
            var oData = oContext.getObject();
            var fEje = parseFloat(oData.INVEJE) || 0;
            var fPen = fTot - fEje;

            oModel.setProperty(sPath + "/INVTOT", fTot.toString());
            oModel.setProperty(sPath + "/INVPEN", fPen.toString());
            this._markVariantDirty();
        },

        /**
         * Gestiona la visibilidad de columnas extendidas al expandir nodos en la TreeTable.
         */
        onToggleOpenState: function (oEvent) {
            this._markVariantDirty();
            var oTable = oEvent.getSource();
            var sTableId = oTable.getId();
            var bExpanded = oEvent.getParameter("expanded");
            var iRowIndex = oEvent.getParameter("rowIndex");
            var oUiModel = this.getView().getModel("ui");

            var oColMonths = this.byId("colMonths");
            var oColNew = this.byId("colNew");

            if (!bExpanded) {
                // Si se contrae un nodo, verifica si todavía quedan otros expandidos con columnas de meses.
                var bAnyPlanExpanded = false;
                var oBinding = oTable.getBinding("rows");

                if (oBinding) {
                    for (var i = 0; i < oBinding.getLength(); i++) {
                        if (oTable.isExpanded(i)) {
                            var oCtx = oTable.getContextByIndex(i);
                            var oObj = oCtx && oCtx.getObject();
                            // Solo cuenta si los hijos son filas de plan (tienen months), no desgloses
                            if (oObj && Array.isArray(oObj.children) && oObj.children.length > 0) {
                                var bHasDesgloseChildren = oObj.children.some(function(c) {
                                    return c.__isEditable === true || c.__isSinProveedor === true || c.__isHeader === true;
                                });
                                if (!bHasDesgloseChildren) {
                                    bAnyPlanExpanded = true;
                                    break;
                                }
                            }
                        }
                    }
                }

                if (!bAnyPlanExpanded) {
                    if (oColMonths) oColMonths.setVisible(false);
                    if (oColNew) oColNew.setVisible(false);

                    this._aGroupRanges = [];
                    oUiModel.setProperty("/showStickyAgrupador", false);
                    return;
                }
            } else {
                // Al expandir, solo mostrar colMonths/colNew si NO son hijos de desglose
                var oCtxExpanded = oTable.getContextByIndex(iRowIndex);
                var oObjExpanded = oCtxExpanded && oCtxExpanded.getObject();
                var bIsDesgloseExpansion = oObjExpanded && Array.isArray(oObjExpanded.children) &&
                    oObjExpanded.children.length > 0 &&
                    oObjExpanded.children.some(function(c) {
                        return c.__isEditable === true || c.__isSinProveedor === true || c.__isHeader === true;
                    });

                if (!bIsDesgloseExpansion) {
                    if (oColMonths) oColMonths.setVisible(true);
                    if (oColNew) oColNew.setVisible(true);
                }
            }

            // Refresca la lógica de estilos y scroll de la tabla.
            setTimeout(function () {
                this._refreshAfterToggle(sTableId);
            }.bind(this), 0);
        },

        /**
         * Al seleccionar/deseleccionar una fila, sincroniza automáticamente la otra versión
         * del mismo elemento (mismo PhPspnr, distinto TipoInd: "I" ↔ "A").
         */
        onRowSelectionChange: function (oEvent) {
            if (this._bSelectionChanging) {
                return;
            }

            var oTable = this.byId("TreeTableAnticipados");
            if (!oTable) {
                return;
            }

            var oBinding = oTable.getBinding("rows");
            if (!oBinding) {
                return;
            }
            var iTotalRows = oBinding.getLength();

            var aPrevious = this._aPreviousSelectedIndices || [];
            var aCurrent = oTable.getSelectedIndices();

            // Calcular filas recién seleccionadas y recién deseleccionadas
            var aAdded = aCurrent.filter(function (i) { return aPrevious.indexOf(i) === -1; });
            var aRemoved = aPrevious.filter(function (i) { return aCurrent.indexOf(i) === -1; });

            // Guardar la selección actual para la próxima vez
            this._aPreviousSelectedIndices = aCurrent.slice();

            if (aAdded.length === 0 && aRemoved.length === 0) {
                return;
            }

            // Busca el índice de la fila hermana (mismo PhPspnr, TipoInd opuesto)
            var fnFindSibling = function (iIdx, aExclude) {
                var oCtx = oTable.getContextByIndex(iIdx);
                if (!oCtx) { return -1; }
                var oData = oCtx.getObject();
                if (!oData || !oData.PhPspnr || !oData.TipoInd) { return -1; }
                var sPhPspnr = oData.PhPspnr;
                var sSiblingTipoInd = oData.TipoInd === "I" ? "A" : "I";
                for (var i = 0; i < iTotalRows; i++) {
                    if (aExclude.indexOf(i) !== -1) { continue; }
                    var oSibCtx = oTable.getContextByIndex(i);
                    if (!oSibCtx) { continue; }
                    var oSibData = oSibCtx.getObject();
                    if (oSibData && oSibData.PhPspnr === sPhPspnr && oSibData.TipoInd === sSiblingTipoInd) {
                        return i;
                    }
                }
                return -1;
            };

            this._bSelectionChanging = true;
            try {
                // Seleccionar hermanas de las filas añadidas
                aAdded.forEach(function (iIdx) {
                    var iSibling = fnFindSibling(iIdx, aCurrent);
                    if (iSibling !== -1) {
                        oTable.addSelectionInterval(iSibling, iSibling);
                        // Actualizar también aPreviousSelectedIndices para mantener coherencia
                        if (this._aPreviousSelectedIndices.indexOf(iSibling) === -1) {
                            this._aPreviousSelectedIndices.push(iSibling);
                        }
                    }
                }.bind(this));

                // Deseleccionar hermanas de las filas eliminadas
                aRemoved.forEach(function (iIdx) {
                    var iSibling = fnFindSibling(iIdx, aRemoved);
                    if (iSibling !== -1) {
                        oTable.removeSelectionInterval(iSibling, iSibling);
                        // Actualizar aPreviousSelectedIndices
                        var iPos = this._aPreviousSelectedIndices.indexOf(iSibling);
                        if (iPos !== -1) {
                            this._aPreviousSelectedIndices.splice(iPos, 1);
                        }
                    }
                }.bind(this));
            } finally {
                this._bSelectionChanging = false;
            }
        },

                buildTree: function (data) {
            const groups = {};
            data.forEach(item => {
                if (!groups[item.PhPspnr]) {
                    groups[item.PhPspnr] = {};
                }

                // isLevel3 debe ser true solo para operaciones de nivel 3 (I.XXX.XXX.XXX - 4 partes)
                var isLevel3 = item.PhPspnr.split(".").length === 4;

                var repartoItems;
                if (item.TipoInd === "I") {
                    // Para Inversión: solo Manual
                    repartoItems = [
                        { key: "MAN", text: "Manual" }
                    ];
                } else if (item.TipoInd === "A") {
                    // Para Amortización: OEO, Lineal y Manual
                    repartoItems = [
                        { key: "OEO", text: "OEO" },
                        { key: "LIN", text: "Lineal" },
                        { key: "MAN", text: "Manual" }
                    ];
                } else {
                    repartoItems = [
                        { key: "MAN", text: "Manual" }
                    ];
                }

                groups[item.PhPspnr][item.TipoInd] = {
                    ...item,
                    isLevel3: isLevel3,
                    isNew: false,
                    repartoItems: repartoItems,
                    children: []
                };
            });

            const result = [];
            const processed = new Set();

            // Primero: buscar y añadir el objeto con PhPspnr = "D"
            if (groups["D"]) {
                Object.keys(groups["D"]).forEach(tipo => {
                    result.push(groups["D"][tipo]);
                });
                processed.add("D");
            }

            // Después: todos los demás, ordenados por PhPspnr, con P antes de B
            data.forEach(item => {
                if (processed.has(item.PhPspnr)) return;
                processed.add(item.PhPspnr);

                const versionP = groups[item.PhPspnr]["I"];
                const versionB = groups[item.PhPspnr]["A"];

                if (versionP) {
                    result.push(versionP);
                }
                if (versionB) {
                    result.push(versionB);
                }
            });

            return result;
        },
        _attachHeaderToggleListener: function () {
            var oObjectPageLayout = this.byId("objectPageAnticipados");
            if (!oObjectPageLayout) return;

            setTimeout(function () {
                var oDom = oObjectPageLayout.getDomRef();
                if (!oDom) return;

                oDom.addEventListener("click", function () {
                    setTimeout(function () {
                        this._calculateDynamicRows();
                        this.colorRows();
                    }.bind(this), 100);
                }.bind(this), true);

            }.bind(this), 1000);
        },
        /**
         * Aplica colores a las filas de la tabla con debouncing para mejorar el rendimiento.
         * Se cancela cualquier petición pendiente y se programa una nueva con un retardo de 80ms,
         * evitando así ejecuciones excesivas durante el scroll.
         * @param {boolean} [bClearAmortizacion] - Si es true, las filas con TipoInd="A" no recibirán color
         */
        colorRows: function (bClearAmortizacion) {
            if (this._colorRowsTimer) {
                clearTimeout(this._colorRowsTimer);
            }
            this._colorRowsTimer = setTimeout(function () {
                this._colorRowsTimer = null;
                this._applyRowColors(bClearAmortizacion);
            }.bind(this), 80);
        },

        /**
         * Función interna que aplica los colores a las filas según TipoInd.
         * Usa el índice DOM real de cada fila (data-sap-ui-rowindex) en lugar del índice
         * del array getRows(), para evitar desajustes durante la virtualización de la tabla.
         * @param {boolean} [bClearAmortizacion] - Si es true, las filas con TipoInd="A" no recibirán color
         * @private
         */
        _applyRowColors: function (bClearAmortizacion) {
            var oTable = this.byId("TreeTableAnticipados");
            if (!oTable) return;

            var aRows = oTable.getRows();
            if (!aRows || aRows.length === 0) return;

            // Cachear el wrapper jQuery de la tabla fuera del loop para evitar
            // crear objetos jQuery costosos en cada iteración
            var $table = oTable.$();
            var sTableId = oTable.getId();

            aRows.forEach(function (oRow) {
                var oRowDom = oRow.getDomRef();
                if (!oRowDom) return;

                // Obtener el índice real del DOM para evitar desajuste con la virtualización
                var iIdx = oRowDom.getAttribute("data-sap-ui-rowindex");
                if (iIdx === null) return;

                var $fixed  = $table.find(".sapUiTableCtrlFixed tbody tr[data-sap-ui-rowindex='" + iIdx + "']");
                var $scroll = $table.find(".sapUiTableCtrlScroll tbody tr[data-sap-ui-rowindex='" + iIdx + "']");
                var $rowSel = jQuery("#" + sTableId + "-rowsel" + iIdx);

                // Limpiar clases anteriores en todos los fragmentos de la fila
                oRowDom.classList.remove("rowVersionB", "rowVersionP");
                $fixed.removeClass("rowVersionB rowVersionP");
                $scroll.removeClass("rowVersionB rowVersionP");
                $rowSel.removeClass("rowVersionB rowVersionP");

                var oContext = oRow.getBindingContext("anticipadosModel");
                if (!oContext) return; // Fila vacía: queda limpia

                var sTipoInd = oContext.getProperty("TipoInd");
                if (!sTipoInd) return;

                // Si se indicó que se deben limpiar las filas de amortización (TipoInd="A"),
                // no se aplica color a esas filas (llamada desde onFilterTipoIndChange)
                if (bClearAmortizacion && sTipoInd === "A") return;

                // Aplicar clase según TipoInd
                var sCls = sTipoInd === "I" ? "rowVersionP" : sTipoInd === "A" ? "rowVersionB" : null;
                if (sCls) {
                    oRowDom.classList.add(sCls);
                    $fixed.addClass(sCls);
                    $scroll.addClass(sCls);
                    $rowSel.addClass(sCls);
                }
            });
        },

        onAmoPenChange: function (oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("anticipadosModel");
            this.onRowInputChangeInversion(oEvent);

            if (oContext) {
                var sRawValue = oSource.getValue();
                var oAppData = this.getOwnerComponent().getModel("appData").getData().userData;
                var sCurrencyFormat = oAppData.CurrencyFormat;
                var sThousandSep = sCurrencyFormat.charAt(0);
                var sDecimalSep = sCurrencyFormat.charAt(1);

                sRawValue = sRawValue.split(sThousandSep).join("");
                sRawValue = sRawValue.split(sDecimalSep).join(".");

                var fPendiente = parseFloat(sRawValue) || 0;
                var sPath = oContext.getPath();
                var oModel = oContext.getModel();
                var oData = oContext.getObject();
                var sTipoInd = oData.TipoInd;
                
                if (sTipoInd === "I") {
                    oModel.setProperty(sPath + "/InvPen", fPendiente.toString());
                    var fInvEje = parseFloat(oData.InvEje) || 0;
                    var fInvTot = fPendiente + fInvEje;
                    oModel.setProperty(sPath + "/InvTot", fInvTot.toString());
                    oModel.setProperty(sPath + "/_Pendiente", fPendiente.toString());
                    oModel.setProperty(sPath + "/_Total", fInvTot.toString());
                } else if (sTipoInd === "A") {
                    oModel.setProperty(sPath + "/AmoPen", fPendiente.toString());
                    var fAmoEje = parseFloat(oData.AmoEje) || 0;
                    var fAmoTot = fPendiente + fAmoEje;
                    oModel.setProperty(sPath + "/AmoTot", fAmoTot.toString());
                    oModel.setProperty(sPath + "/_Pendiente", fPendiente.toString());
                    oModel.setProperty(sPath + "/_Total", fAmoTot.toString());
                }
            }
        },

        onAmoTotChange: function (oEvent) {
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("anticipadosModel");
            this.onRowInputChangeInversion(oEvent);
            if (oContext) {
                var sRawValue = oSource.getValue();
                var oAppData = this.getOwnerComponent().getModel("appData").getData().userData;
                var sCurrencyFormat = oAppData.CurrencyFormat;
                var sThousandSep = sCurrencyFormat.charAt(0);
                var sDecimalSep = sCurrencyFormat.charAt(1);

                sRawValue = sRawValue.split(sThousandSep).join("");
                sRawValue = sRawValue.split(sDecimalSep).join(".");

                var fTotal = parseFloat(sRawValue) || 0;
                var sPath = oContext.getPath();
                var oModel = oContext.getModel();
                var oData = oContext.getObject();
                var sTipoInd = oData.TipoInd;
                
                if (sTipoInd === "I") {
                    oModel.setProperty(sPath + "/InvTot", fTotal.toString());
                    var fInvEje = parseFloat(oData.InvEje) || 0;
                    var fInvPen = fTotal - fInvEje;
                    oModel.setProperty(sPath + "/InvPen", fInvPen.toString());
                    oModel.setProperty(sPath + "/_Total", fTotal.toString());
                    oModel.setProperty(sPath + "/_Pendiente", fInvPen.toString());
                } else if (sTipoInd === "A") {
                    oModel.setProperty(sPath + "/AmoTot", fTotal.toString());
                    var fAmoEje = parseFloat(oData.AmoEje) || 0;
                    var fAmoPen = fTotal - fAmoEje;
                    oModel.setProperty(sPath + "/AmoPen", fAmoPen.toString());
                    oModel.setProperty(sPath + "/_Total", fTotal.toString());
                    oModel.setProperty(sPath + "/_Pendiente", fAmoPen.toString());
                }
            }
        },

        onAddPress: function(oEvent){
            var oTable = this.byId("TreeTableAnticipados");
            var aSelectedIndices = oTable.getSelectedIndices();
            var oModel = this.getView().getModel("anticipadosModel");
            
            // Validación 1: Se debe seleccionar al menos una línea
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
            
            // Validación 2: Con la selección sincronizada, se espera que haya 2 o múltiplos de 2 líneas seleccionadas
            // Se verifica que todas las líneas seleccionadas correspondan al mismo PhPspnr
            var aSelectedRows = [];
            var sPhPspnr = null;
            
            for (var i = 0; i < aSelectedIndices.length; i++) {
                var oContext = oTable.getContextByIndex(aSelectedIndices[i]);
                if (oContext) {
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
            }
            
            // Se usa la primera fila seleccionada para las validaciones
            var oSelectedRow = aSelectedRows[0];
            if (!oSelectedRow) {
                return;
            }
            
            // Validación 2: No se puede seleccionar la primera línea (OEO con PhPspnr = "D")
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
            
            // Determinar el nivel de la operación basado en PhPspnr
            var iLevel = this._getOperationLevel(sPhPspnr);
            
            // Validación 3: No se puede seleccionar una operación de nivel 3 o desglose
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
            
            // Si es nivel 1 (capítulo): Abrir popup con catálogo de operaciones
            if (iLevel === 1) {
                this._openOperationsCatalog(oSelectedRow, oContext);
                return;
            }
            
            // Si es nivel 2 (operación)
            if (iLevel === 2) {
                // Obtener todos los elementos del modelo para determinar si la fila tiene hijos reales.
                // Los hijos de una fila nivel 2 son los elementos cuyo ParentPath coincide con el PhPspnr de la fila.
                var aAnticipadosData = oModel.getData() || [];
                var bTieneHijos = aAnticipadosData.some(function (oItem) {
                    return oItem.ParentPath === oSelectedRow.PhPspnr;
                });

                // Validación 4: No se puede seleccionar una operación de nivel 2 con desgloses (hijos)
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
                
                // Validación 5: No se puede seleccionar una operación de nivel 2 con datos ejecutados y sin hijos
                var fAmoEje = parseFloat(oSelectedRow.AmoEje) || 0;
                if (fAmoEje > 0 && !bTieneHijos) {
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
                
                // Crear línea vacía de nivel 3
                this._createLevel3Row(oSelectedRow, oContext);
            }
        },

        onDeletePress: async function(){
            var oTable = this.byId("TreeTableAnticipados");
            var aSelectedIndices = oTable.getSelectedIndices();
            var oModel = this.getView().getModel("anticipadosModel");
            
            // Validación: Se debe seleccionar al menos una línea
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
            
            // Recopilar las líneas seleccionadas para eliminar
            //   Cada fila se sanea con _sanitizeRowForBackend para evitar propiedades cliente.
            var aLinesToDelete = [];
            aSelectedIndices.forEach(function(iIndex) {
                var oContext = oTable.getContextByIndex(iIndex);
                if (oContext) {
                    aLinesToDelete.push(this._sanitizeRowForBackend(oContext.getObject()));
                }
            }.bind(this));
            
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
            
            // Llamar al servicio de eliminación
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
         * Llama al servicio DelIndirectosSet para eliminar operaciones
         * @param {array} aLinesToDelete - Array de líneas a eliminar
         * @returns {Promise} - Promesa con la respuesta del servicio
         */
        _callDelIndirectosService: async function(aLinesToDelete) {
            var oAppData = this.getGlobalModel("appData").getData();
            var oDashModel = this.getGlobalModel("dashboardModel");
            
            // Obtener la versión activa
            var versiones = oAppData.NavLtVersiones;
            var flagSelectVersion = versiones.find(function (item) {
                return item.Activo === "X";
            });
            
            // Obtener Freal (ejercicio)
            var sFreal = "";
            if (oAppData && oAppData.tramo && oAppData.tramo.Freal) {
                sFreal = oAppData.tramo.Freal;
            } else if (oDashModel) {
                sFreal = oDashModel.getProperty("/NavMasterLt/0/Freal");
            }
            
            if (!sFreal) {
                throw new Error("Fecha real no disponible");
            }
            
            var oDateStart = this._parseODataDate(sFreal);
            if (!oDateStart || isNaN(oDateStart.getTime())) {
                throw new Error("Fecha real inválida");
            }
            
            var sEjercicio = oDateStart.getFullYear().toString();
            const token = oAppData.EvToken;
            
            // Mostrar diálogo de carga
            if (!this._busyDialog) {
                this._busyDialog = new sap.m.BusyDialog({
                    text: this.getTranslatedText("ELIMINANDO_DATOS") || "Eliminando..."
                });
            }
            this._busyDialog.open();
            
            try {
                // Realizar la llamada al servicio DelIndirectosSet
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
                            pestana: "Anticipados",
                            token: token
                        }
                    }
                );
                
                this._busyDialog.close();
                
                // Verificar si hay mensajes de error
                var aMensajes = response.NavMensajes?.results || [];
                var aMensajesError = aMensajes.filter(function(mensaje) {
                    return mensaje.Tipo === "E";
                });
                
                if (aMensajesError.length > 0) {
                    this.createMessageDialog({
                        title: this.getTranslatedText("ERROR"),
                        textAccept: this.getTranslatedText("ACEPTAR"),
                        messages: aMensajesError.map(function(mensaje) {
                            return {
                                text: mensaje.Mensaje || mensaje.Message || mensaje.text || "",
                                type: "Error"
                            };
                        })
                    });
                    return;
                }
                
                // Si no hay errores, eliminar las líneas del modelo local
                var oModel = this.getView().getModel("anticipadosModel");
                var aData = oModel.getData();
                
                // Eliminar las líneas seleccionadas del array de datos
                aLinesToDelete.forEach(function(oLineToDelete) {
                    var iIndex = aData.findIndex(function(oItem) {
                        return oItem.PhPspnr === oLineToDelete.PhPspnr && 
                               oItem.TipoInd === oLineToDelete.TipoInd;
                    });
                    
                    if (iIndex !== -1) {
                        aData.splice(iIndex, 1);
                    }
                });
                
                // Actualizar el modelo
                oModel.setData(aData);
                oModel.refresh();
                
                // Limpiar la selección de la tabla
                var oTable = this.byId("TreeTableAnticipados");
                oTable.clearSelection();
                
                // Marcar la variante como modificada
                this._markVariantDirty();
                
                // Mensaje de éxito
                sap.m.MessageToast.show(
                    //   Se traduce via i18n con placeholder {0} para soportar EN/FR.  
                    this.getTranslatedText("MSG_LINEAS_ELIMINADAS", [aLinesToDelete.length])
                    //  
                );
                
                // Mostrar mensajes informativos si los hay
                var aMensajesInfo = aMensajes.filter(function(mensaje) {
                    return mensaje.Tipo === "S" || mensaje.Tipo === "I" || mensaje.Tipo === "W";
                });
                
                if (aMensajesInfo.length > 0) {
                    this.createMessageDialog({
                        title: this.getTranslatedText("INFORMACION") || "Información",
                        textAccept: this.getTranslatedText("ACEPTAR"),
                        messages: aMensajesInfo.map(function(mensaje) {
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
                this._busyDialog.close();
                throw error;
            }
        },
        
        /**
         * Determina el nivel de la operación basándose en el formato de PhPspnr
         * @param {string} sPhPspnr - Código de la operación
         * @returns {number} - Nivel de la operación (1, 2 o 3)
         */
        _getOperationLevel: function(sPhPspnr) {
            if (!sPhPspnr || sPhPspnr === "D") {
                return 0;
            }
            
            var aParts = sPhPspnr.split(".");
            return aParts.length - 1;
        },
        
        /**
         * Abre el popup con el catálogo de operaciones para un capítulo (nivel 1)
         * @param {object} oSelectedRow - Fila seleccionada
         * @param {object} oContext - Contexto de la fila
         */
        _openOperationsCatalog: async function (oSelectedRow, oContext) {
            // Guardar el contexto de la fila seleccionada para usarlo después
            this._selectedChapterRow = oSelectedRow;
            this._selectedChapterContext = oContext;

            // Obtener los datos necesarios para la llamada al servicio
            var oAppData = this.getGlobalModel("appData").getData();
            var oDashModel = this.getGlobalModel("dashboardModel");

            // Obtener la versión activa
            var versiones = oAppData.NavLtVersiones;
            var flagSelectVersion = versiones.find(function (item) {
                return item.Activo === "X";
            });

            // Obtener Freal (ejercicio)
            var sFreal = "";
            if (oAppData && oAppData.tramo && oAppData.tramo.Freal) {
                sFreal = oAppData.tramo.Freal;
            } else if (oDashModel) {
                sFreal = oDashModel.getProperty("/NavMasterLt/0/Freal");
            }

            if (!sFreal) {
                //   Se traduce el mensaje via i18n para soportar EN/FR.  
                sap.m.MessageBox.error(this.getTranslatedText("ERROR_FECHA_REAL_NO_DISPONIBLE"));
                //  
                return;
            }

            var oDateStart = this._parseODataDate(sFreal);
            if (!oDateStart || isNaN(oDateStart.getTime())) {
                //   Se traduce el mensaje via i18n para soportar EN/FR.  
                sap.m.MessageBox.error(this.getTranslatedText("ERROR_FECHA_REAL_INVALIDA"));
                //  
                return;
            }

            var sEjercicio = oDateStart.getFullYear().toString();
            const token = oAppData.EvToken;

            // Mostrar diálogo de carga
            if (!this._busyDialog) {
                this._busyDialog = new sap.m.BusyDialog({
                    text: this.getTranslatedText("CARGANDO_DATOS")
                });
            }
            this._busyDialog.open();

            try {
                // Realizar la llamada al servicio CatalogoIndirectosSet
                var response = await this.post(
                    this.getGlobalModel("mainService"),
                    "/CatalogoIndirectosSet",
                    {
                        "NavDatosCatalogo": []
                    },
                    {
                        headers: {
                            norma: this.getGlobalModel("normModel").getData().norma || "",
                            ambito: oAppData.userData.initialNode,
                            lang: oAppData.userData.AplicationLangu,
                            pestana: "Anticipados"
                        }
                    }
                );

                this._busyDialog.close();

                // Obtener los datos del catálogo
                var aCatalogData = response.NavDatosCatalogo?.results || [];

                if (aCatalogData.length === 0) {
                    sap.m.MessageBox.information(
                        "No hay operaciones disponibles para este capítulo",
                        {
                            title: this.getTranslatedText("CATALOGO_OPERACIONES_TITULO")
                        }
                    );
                    return;
                }

                // Transformar los datos al formato esperado por el fragment
                var aOperations = aCatalogData.map(function (item) {
                    return {
                        Code: item.PhPspnr || item.Codigo || "",
                        Description: item.Post1 || item.Descripcion || ""
                    };
                });

                // Crear el modelo para el catálogo
                var oCatalogModel = new sap.ui.model.json.JSONModel({
                    operations: aOperations
                });
                this.getView().setModel(oCatalogModel, "catalogModel");

                // Abrir el diálogo del catálogo
                this._openCatalogDialog();

            } catch (error) {
                this._busyDialog.close();
                sap.m.MessageBox.error(
                    this.getTranslatedText("CATALOGO_ERROR_SERVICIO") + "\n" + (error.message || error),
                    {
                        title: this.getTranslatedText("ERROR")
                    }
                );
            }
        },

        /**
         * Abre el diálogo del catálogo de operaciones
         */
        _openCatalogDialog: function() {
            if (!this._catalogDialog) {
                this._catalogDialog = sap.ui.xmlfragment(
                    "zindirect_costs.fragments.OperationsCatalogDialog",
                    this
                );
                this.getView().addDependent(this._catalogDialog);
            }
            this._catalogDialog.open();
        },

        /**
         * Cierra el diálogo del catálogo de operaciones
         */
        onCloseCatalogDialog: function() {
            if (this._catalogDialog) {
                this._catalogDialog.close();
                this._catalogDialog.destroy();
                this._catalogDialog = null;
            }
        },
        /**
         * Llama al servicio AddIndirectosSet para añadir o validar operaciones
         * @param {array} aOperationsData - Array de operaciones a añadir/validar
         * @returns {Promise} - Promesa con la respuesta del servicio
         */
        _callAddIndirectosService: async function(aOperationsData) {
            var oAppData = this.getGlobalModel("appData").getData();
            var oDashModel = this.getGlobalModel("dashboardModel");
            
            // Obtener la versión activa
            var versiones = oAppData.NavLtVersiones;
            var flagSelectVersion = versiones.find(function (item) {
                return item.Activo === "X";
            });
            
            // Obtener Freal (ejercicio)
            var sFreal = "";
            if (oAppData && oAppData.tramo && oAppData.tramo.Freal) {
                sFreal = oAppData.tramo.Freal;
            } else if (oDashModel) {
                sFreal = oDashModel.getProperty("/NavMasterLt/0/Freal");
            }
            
            if (!sFreal) {
                throw new Error("Fecha real no disponible");
            }
            
            var oDateStart = this._parseODataDate(sFreal);
            if (!oDateStart || isNaN(oDateStart.getTime())) {
                throw new Error("Fecha real inválida");
            }
            
            var sEjercicio = oDateStart.getFullYear().toString();
            const token = oAppData.EvToken;
            
            // Mostrar diálogo de carga
            if (!this._busyDialog) {
                this._busyDialog = new sap.m.BusyDialog({
                    text: this.getTranslatedText("CARGANDO_DATOS")
                });
            }
            this._busyDialog.open();
            
            try {
                // Realizar la llamada al servicio AddIndirectosSet
                var response = await this.post(
                    this.getGlobalModel("mainService"),
                    "/AddIndirectosSet",
                    {
                        "NavSelProyecto": [oAppData.tramo],
                        "NavLtVersiones": [flagSelectVersion],
                        "NavDatosCatalogo": aOperationsData,
                        "NavMensajes": [],
                        "NavDatosIndirectos": []
                    },
                    {
                        headers: {
                            ambito: oAppData.userData.initialNode,
                            lang: oAppData.userData.AplicationLangu,
                            decimales: oDashModel.getData().decimales,
                            norma: this.getGlobalModel("normModel").getData().norma || "",
                            ejercicio: sEjercicio,
                            pestana: "Anticipados",
                            token: token
                        }
                    }
                );
                
                this._busyDialog.close();
                return response;
                
            } catch (error) {
                this._busyDialog.close();
                throw error;
            }
        },
        /**
         * Añade las operaciones seleccionadas del catálogo a la treetable
         * bajo el capítulo (nivel 1) seleccionado previamente
         */
        onAddSelectedOperations: function() {
            if (!this._catalogDialog) {
                return;
            }
            
            // Obtener la tabla del catálogo del fragment
            var oCatalogTable = this._catalogDialog.getContent()[0].getItems()[1];
            
            if (!oCatalogTable) {
                //   Se traduce el mensaje via i18n para soportar EN/FR.  
                sap.m.MessageBox.error(this.getTranslatedText("ERROR_TABLA_CATALOGO_NO_ENCONTRADA"));
                //  
                return;
            }
            
            // Obtener los índices seleccionados
            var aSelectedIndices = oCatalogTable.getSelectedIndices();
            
            if (aSelectedIndices.length === 0) {
                //   Se traduce el mensaje via i18n para soportar EN/FR.  
                sap.m.MessageBox.warning(this.getTranslatedText("ERROR_DEBE_SELECCIONAR_OPERACION"));
                //  
                return;
            }
            
            // Obtener las operaciones seleccionadas
            var oCatalogModel = this.getView().getModel("catalogModel");
            var aAllOperations = oCatalogModel.getProperty("/operations");
            var aSelectedOperations = [];
            
            aSelectedIndices.forEach(function(iIndex) {
                if (aAllOperations[iIndex]) {
                    aSelectedOperations.push(aAllOperations[iIndex]);
                }
            });
            
            // Preparar las operaciones para enviar al servicio
            var aOperationsToAdd = aSelectedOperations.map(function(oOp) {
                return {
                    PhPspnr: oOp.Code,
                    Descripcion: oOp.Description,
                    //TipoInd: "I" // Se enviará como "I", el backend creará también la "A"
                };
            });
            
            // Llamar al servicio para añadir las operaciones
            this._callAddIndirectosService(aOperationsToAdd).then(function(response) {
                // Verificar si hay mensajes de error
                var aMensajes = response.NavMensajes?.results || [];
                var aMensajesError = aMensajes.filter(function(mensaje) {
                    return mensaje.Tipo === "E";
                });
                
                if (aMensajesError.length > 0) {
                    this.createMessageDialog({
                        title: this.getTranslatedText("ERROR"),
                        textAccept: this.getTranslatedText("ACEPTAR"),
                        messages: aMensajesError.map(function(mensaje) {
                            return {
                                text: mensaje.Mensaje || mensaje.Message || mensaje.text || "",
                                type: "Error"
                            };
                        })
                    });
                    return;
                }
                
                // Cerrar el diálogo
                this.onCloseCatalogDialog();
                
                // Obtener las operaciones creadas del servicio
                var aCreatedOperations = response.NavDatosIndirectos?.results || [];
                
                if (aCreatedOperations.length > 0) {
                    // Añadir las operaciones devueltas por el servicio a la treetable
                    this._addOperationsToTree(aCreatedOperations);
                    
                    // Mensaje de éxito
                    //   Se traduce el mensaje via i18n con el placeholder {0} para soportar EN/FR.  
                    sap.m.MessageToast.show(this.getTranslatedText("MSG_OPERACIONES_ANADIDAS", [aCreatedOperations.length / 2]));
                    //  
                }
            }.bind(this)).catch(function(error) {
                sap.m.MessageBox.error(
                    "Error al añadir las operaciones: " + (error.message || error),
                    {
                        title: this.getTranslatedText("ERROR")
                    }
                );
            }.bind(this));
        },

        /**
         * Añade las operaciones seleccionadas del catálogo al árbol
         * bajo el capítulo seleccionado
         * @param {array} aSelectedOperations - Array de operaciones seleccionadas
         */
       _addOperationsToTree: function(aOperationsFromService) {
            if (!this._selectedChapterRow || aOperationsFromService.length === 0) {
                return;
            }
            
            var oModel = this.getView().getModel("anticipadosModel");
            var aData = oModel.getData();
            var sChapterCode = this._selectedChapterRow.PhPspnr;
            
            // Encontrar el índice del capítulo (versión A) en la lista plana
            var iChapterAIndex = -1;
            for (var i = 0; i < aData.length; i++) {
                if (aData[i].PhPspnr === sChapterCode && aData[i].TipoInd === "A") {
                    iChapterAIndex = i;
                    break;
                }
            }
            
            if (iChapterAIndex === -1) {
                //   Se traduce el mensaje via i18n para soportar EN/FR.  
                sap.m.MessageBox.error(this.getTranslatedText("ERROR_CAPITULO_NO_ENCONTRADO"));
                //  
                return;
            }
            
            // Insertar después del último hijo existente del capítulo (ParentPath = sChapterCode)
            var iInsertIndex = iChapterAIndex + 1;
            for (var i = iChapterAIndex + 1; i < aData.length; i++) {
                var sItemParent = aData[i].ParentPath || aData[i].ParentCode || "";
                if (sItemParent === sChapterCode) {
                    iInsertIndex = i + 1;
                } else if (sItemParent && sItemParent !== sChapterCode) {
                    break;
                }
            }
            
            // Ordenar las operaciones: primero TipoInd="I", luego TipoInd="A"
            aOperationsFromService.sort(function(a, b) {
                if (a.PhPspnr === b.PhPspnr) {
                    // Mismo PhPspnr: "I" antes de "A"
                    return a.TipoInd === "I" ? -1 : 1;
                }
                // Diferentes PhPspnr: mantener orden alfabético
                return a.PhPspnr.localeCompare(b.PhPspnr);
            });
            
            // Insertar las operaciones devueltas por el servicio (ya vienen preparadas desde el backend)
            aOperationsFromService.forEach(function(oOperation) {
                // Solo añadir propiedades UI necesarias si no existen
                if (!oOperation.children) {
                    oOperation.children = [];
                }
                // repartoItems es una propiedad UI que debe establecerse basándose en TipoInd
                if (!oOperation.repartoItems) {
                    oOperation.repartoItems = oOperation.TipoInd === "I" ? 
                        [{ key: "OEO", text: "OEO" }] : 
                        [{ key: "MAN", text: "Manual" }];
                }
                // Mapear Descripcion a Post1 si Post1 no existe (el backend puede devolver Descripcion)
                if (!oOperation.Post1 && oOperation.Descripcion) {
                    oOperation.Post1 = oOperation.Descripcion;
                }
                // Asegurar que estas operaciones NO son editables (no son nuevas ni nivel 3 de desglose)
                // Las operaciones del catálogo son operaciones existentes, no nuevas
                oOperation.isNew = false;
                // Determinar isLevel3 basándose en el PhPspnr (4 partes = nivel 3)
                oOperation.isLevel3 = oOperation.PhPspnr && oOperation.PhPspnr.split(".").length === 4;
                if (oOperation.TipoInd === "I") {
                    oOperation._Ejecutado = oOperation.InvEje || "0";
                    oOperation._Pendiente = oOperation.InvPen || "0";
                    oOperation._Total = oOperation.InvTot || "0";
                } else if (oOperation.TipoInd === "A") {
                    oOperation._Ejecutado = oOperation.AmoEje || "0";
                    oOperation._Pendiente = oOperation.AmoPen || "0";
                    oOperation._Total = oOperation.AmoTot || "0";
                }
                aData.splice(iInsertIndex, 0, oOperation);
                iInsertIndex++;
            }.bind(this));
            
            // Actualizar el modelo
            oModel.setData(aData);
            oModel.refresh();
            
            // Marcar como modificado
            this._markVariantDirty();
        },
        /**
         * Crea dos nuevas líneas vacías de nivel 3 (TipoInd "I" y "A") bajo la operación de nivel 2 seleccionada
         * Las nuevas operaciones se insertan inmediatamente después del padre con TipoInd="A" en la lista plana
         * El código sugerido se calcula automáticamente basándose en las operaciones hermanas existentes
         * @param {object} oParentRow - Fila padre (nivel 2) - puede ser TipoInd "I" o "A"
         * @param {object} oContext - Contexto de la fila padre
         */
        _createLevel3Row: function(oParentRow, oContext) {
            var oModel = this.getView().getModel("anticipadosModel");
            var sParentCode = oParentRow.PhPspnr;
            var aParentParts = sParentCode.split(".");
            
            if (aParentParts.length !== 3) {
                sap.m.MessageBox.error(this.getTranslatedText("ERROR_FORMATO_PADRE"));
                return;
            }
            
            // Obtener la lista plana de datos del modelo
            var aData = oModel.getData();
            
            // Buscar ambos padres (TipoInd "I" y "A") con el mismo PhPspnr
            var oParentI = null;
            var oParentA = null;
            var iParentAIndex = -1;
            
            for (var i = 0; i < aData.length; i++) {
                if (aData[i].PhPspnr === sParentCode) {
                    if (aData[i].TipoInd === "I") {
                        oParentI = aData[i];
                    } else if (aData[i].TipoInd === "A") {
                        oParentA = aData[i];
                        iParentAIndex = i;
                    }
                }
            }
            
            if (!oParentA || iParentAIndex === -1) {
                sap.m.MessageBox.error(this.getTranslatedText("ERROR_PADRE_NO_ENCONTRADO"));
                return;
            }
            
            // Buscar todas las operaciones hermanas existentes (mismo prefijo, nivel 3)
            var aSiblings = [];
            var sParentPrefix = sParentCode + "."; // Ej: "I.001.002."
            
            for (var i = 0; i < aData.length; i++) {
                var sCode = aData[i].PhPspnr;
                // Verificar si es nivel 3 y empieza con el prefijo del padre
                if (sCode && sCode.startsWith(sParentPrefix)) {
                    var aParts = sCode.split(".");
                    if (aParts.length === 4) { // Es nivel 3
                        var sLastPart = aParts[3];
                        var iNumber = parseInt(sLastPart, 10);
                        if (!isNaN(iNumber)) {
                            aSiblings.push(iNumber);
                        }
                    }
                }
            }
            
            // Calcular el siguiente número disponible
            var iNextNumber = 1; // Por defecto .001
            if (aSiblings.length > 0) {
                // Encontrar el número más alto y sumar 1
                var iMaxNumber = Math.max.apply(null, aSiblings);
                iNextNumber = iMaxNumber + 1;
            }
            
            // Formatear el número con 3 dígitos (001, 002, etc.)
            var sNextCode = iNextNumber.toString().padStart(3, "0");
            var sNewCode = sParentCode + "." + sNextCode; // Ej: "I.001.002.004"
            
            // Crear la primera fila con TipoInd = "I"
            var oNewRowI = {
                PhPspnr: sNewCode,
                Post1: "",
                TipoInd: "I",
                InvEje: "0",
                Invejereal: "0",
                Invejeajus: "0",
                AmoEje: "0",
                AmoPen: "0",
                AmoTot: "0",
                Tipo: oParentI ? (oParentI.Tipo || "") : "",
                PenPlan: "",
                months: "",
                pend: "",
                _Ejecutado: "0",
                _Pendiente: "0",
                _Total: "0",
                isLevel3: true,
                isNew: true,
                Estructura: "O",
                ParentCode: sParentCode,  // Código del padre para validación
                PhPspnrEdited: false,  // Bandera para rastrear si PhPspnr ha sido editado manualmente
                Post1Edited: false,    // Bandera para rastrear si Post1 ha sido editado manualmente
                repartoItems: oParentI ? (oParentI.repartoItems || []) : [{ key: "O", text: "OEO" }],
                children: [],
                Totala1: "0", Totala2: "0", Totala3: "0", Totala4: "0", Totala5: "0",
                Totala6: "0", Totala7: "0", Totala8: "0", Totala9: "0", Totala10: "0",
                Resto: "0",
                Val01a1: "0", Val02a1: "0", Val03a1: "0", Val04a1: "0", Val05a1: "0", Val06a1: "0",
                Val07a1: "0", Val08a1: "0", Val09a1: "0", Val10a1: "0", Val11a1: "0", Val12a1: "0"
            };
            
            // Crear la segunda fila con TipoInd = "A"
            var oNewRowA = {
                PhPspnr: sNewCode,
                Post1: "",
                TipoInd: "A",
                InvEje: "0",
                Invejereal: "0",
                Invejeajus: "0",
                AmoEje: "0",
                AmoPen: "0",
                AmoTot: "0",
                Tipo: oParentA.Tipo || "",
                PenPlan: "",
                months: "",
                pend: "",
                _Ejecutado: "0",
                _Pendiente: "0",
                _Total: "0",
                isLevel3: true,
                isNew: true,
                Estructura: "O",
                ParentCode: sParentCode,
                PhPspnrEdited: false,
                Post1Edited: false,
                repartoItems: oParentA.repartoItems || [{ key: "MAN", text: "Manual" }],
                children: [],
                Totala1: "0", Totala2: "0", Totala3: "0", Totala4: "0", Totala5: "0",
                Totala6: "0", Totala7: "0", Totala8: "0", Totala9: "0", Totala10: "0",
                Resto: "0",
                Val01a1: "0", Val02a1: "0", Val03a1: "0", Val04a1: "0", Val05a1: "0", Val06a1: "0",
                Val07a1: "0", Val08a1: "0", Val09a1: "0", Val10a1: "0", Val11a1: "0", Val12a1: "0"
            };
            
            // Buscar el índice de la última operación hermana existente (mismo ParentCode o ParentPath)
            // para insertar las nuevas operaciones después de todas sus hermanas.
            // Las filas del backend tienen ParentPath; las filas nuevas (locales) tienen ParentCode.
            var iLastSiblingIndex = iParentAIndex;

            for (var i = iParentAIndex + 1; i < aData.length; i++) {
                var sItemParent = aData[i].ParentCode || aData[i].ParentPath || "";
                if (sItemParent === sParentCode) {
                    iLastSiblingIndex = i;
                } else if (sItemParent && sItemParent !== sParentCode) {
                    // Si encontramos una operación con diferente padre, dejamos de buscar
                    break;
                }
            }
            
            // Insertar las dos nuevas operaciones después de la última operación hermana
            // Primero la "I", luego la "A"
            aData.splice(iLastSiblingIndex + 1, 0, oNewRowI);
            aData.splice(iLastSiblingIndex + 2, 0, oNewRowA);
            
            // Actualizar el modelo con los datos modificados
            oModel.setData(aData);
            oModel.refresh();
            
            // Mensaje de éxito
            var sMessage = this.getTranslatedText("MSG_OPERACIONES_CREADAS").replace("{0}", sNewCode);
            sap.m.MessageToast.show(sMessage);
            this._markVariantDirty();
        },
        
        _findRowIndex: function(aData, oRow, iCurrentIndex) {
            if (typeof iCurrentIndex === "undefined") {
                iCurrentIndex = 0;
            }
            
            for (var i = 0; i < aData.length; i++) {
                if (aData[i] === oRow) {
                    return iCurrentIndex;
                }
                iCurrentIndex++;
                
                if (aData[i].children && aData[i].children.length > 0) {
                    var iFound = this._findRowIndex(aData[i].children, oRow, iCurrentIndex);
                    if (iFound !== -1) {
                        return iFound;
                    }
                    iCurrentIndex += this._countRows(aData[i].children);
                }
            }
            
            return -1;
        },
        
        _countRows: function(aData) {
            var iCount = 0;
            for (var i = 0; i < aData.length; i++) {
                iCount++;
                if (aData[i].children && aData[i].children.length > 0) {
                    iCount += this._countRows(aData[i].children);
                }
            }
            return iCount;
        },

       /**
         * Se ejecuta al cambiar la descripción de operación (Post1)
         * Si ambos campos (Post1 y PhPspnr) tienen valor y la fila es nueva, llama al servicio para validar
         */
        onDescOperacionChange: function(oEvent){
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("anticipadosModel");
            
            if (oContext) {
                var oData = oContext.getObject();
                var sPath = oContext.getPath();
                var oModel = oContext.getModel();
                var sPost1Value = oSource.getValue().trim();
                
                // Actualizar el valor en el modelo
                oModel.setProperty(sPath + "/Post1", sPost1Value);
                
                // Replicar el cambio a la versión hermana (mismo PhPspnr, diferente TipoInd)
                if (oData.isNew) {
                    this._replicatePost1ToSibling(oData, sPost1Value, oModel);
                }
                
                // Si ambos campos tienen valor y la fila es nueva, llamar al servicio
                if (sPost1Value && oData.PhPspnr && oData.isNew) {
                    // Preparar los datos para enviar al servicio
                    var aOperationToValidate = [{
                        PhPspnr: oData.PhPspnr,
                        Descripcion: sPost1Value
                    }];
                    
                    // Llamar al servicio para validar la operación
                    this._callAddIndirectosService(aOperationToValidate).then(function(response) {
                        // Verificar si hay mensajes de error
                        var aMensajes = response.NavMensajes?.results || [];
                        var aMensajesError = aMensajes.filter(function(mensaje) {
                            return mensaje.Tipo === "E";
                        });
                        
                        if (aMensajesError.length > 0) {
                            // Mostrar errores
                            this.createMessageDialog({
                                title: this.getTranslatedText("ERROR"),
                                textAccept: this.getTranslatedText("ACEPTAR"),
                                messages: aMensajesError.map(function(mensaje) {
                            return {
                                text: mensaje.Mensaje || mensaje.Message || mensaje.text || "",
                                type: "Error"
                            };
                        })
                            });
                            
                            // Revertir los cambios
                            oModel.setProperty(sPath + "/Post1", "");
                            oSource.setValue("");
                            return;
                        }
                        
                        // Si la validación es exitosa, actualizar los datos con la respuesta del servicio
                        var aValidatedOperations = response.NavDatosIndirectos?.results || [];
                        
                        if (aValidatedOperations.length > 0) {
                            // Buscar la operación validada que corresponde a esta fila
                            var oValidatedOp = aValidatedOperations.find(function(op) {
                                return op.PhPspnr === oData.PhPspnr && op.TipoInd === oData.TipoInd;
                            });
                            
                            if (oValidatedOp) {
                                // Actualizar el modelo con los datos validados del servicio
                                Object.keys(oValidatedOp).forEach(function(key) {
                                    if (oModel.getProperty(sPath + "/" + key) !== undefined) {
                                        oModel.setProperty(sPath + "/" + key, oValidatedOp[key]);
                                    }
                                });
                            }
                            
                            // Cambiar isNew a false
                            oModel.setProperty(sPath + "/isNew", false);
                            
                            // Mensaje de éxito
                            //   Se traduce el mensaje via i18n para soportar EN/FR.  
                            sap.m.MessageToast.show(this.getTranslatedText("MSG_OPERACION_VALIDADA"));
                            //  
                        }
                    }.bind(this)).catch(function(error) {
                        sap.m.MessageBox.error(
                            "Error al validar la operación: " + (error.message || error),
                            {
                                title: this.getTranslatedText("ERROR")
                            }
                        );
                    }.bind(this));
                }
            }
        },
        /**
         * Se ejecuta al cambiar el código de operación (PhPspnr)
         * Las validaciones se realizan en el backend mediante el servicio AddIndirectosSet
         * Si ambos campos (PhPspnr y Post1) tienen valor y la fila es nueva, llama al servicio para validar
         */
        onPhPspnrChange: function(oEvent){
            var oSource = oEvent.getSource();
            var oContext = oSource.getBindingContext("anticipadosModel");
            
            if (oContext) {
                var oData = oContext.getObject();
                var sPath = oContext.getPath();
                var oModel = oContext.getModel();
                var sOldValue = oData.PhPspnr; // Guardar el valor anterior
                var sNewValue = oSource.getValue().trim();
                
                // Actualizar el valor en el modelo
                oModel.setProperty(sPath + "/PhPspnr", sNewValue);
                
                // La versión hermana debe mantener el valor anterior del PhPspnr
                // No replicamos el nuevo valor, sino que aseguramos que mantiene el antiguo
                if (oData.isNew && sOldValue !== sNewValue) {
                    this._ensureSiblingKeepsOldPhPspnr(oData, sOldValue, oModel);
                }
                
                // Si ambos campos tienen valor y la fila es nueva, llamar al servicio
                if (sNewValue && oData.Post1 && oData.isNew) {
                    // Preparar los datos para enviar al servicio
                    var aOperationToValidate = [{
                        PhPspnr: sNewValue,
                        Descripcion: oData.Post1
                    }];
                    
                    // Llamar al servicio para validar la operación
                    this._callAddIndirectosService(aOperationToValidate).then(function(response) {
                        // Verificar si hay mensajes de error
                        var aMensajes = response.NavMensajes?.results || [];
                        var aMensajesError = aMensajes.filter(function(mensaje) {
                            return mensaje.Tipo === "E";
                        });
                        
                        if (aMensajesError.length > 0) {
                            // Mostrar errores (pueden incluir validaciones de formato, duplicados, etc.)
                            this.createMessageDialog({
                                title: this.getTranslatedText("ERROR"),
                                textAccept: this.getTranslatedText("ACEPTAR"),
                                messages: aMensajesError.map(function(mensaje) {
                            return {
                                text: mensaje.Mensaje || mensaje.Message || mensaje.text || "",
                                type: "Error"
                            };
                        })
                            });
                            
                            // Revertir el cambio
                            oModel.setProperty(sPath + "/PhPspnr", "");
                            oSource.setValue("");
                            return;
                        }
                        
                        // Si la validación es exitosa, actualizar los datos con la respuesta del servicio
                        var aValidatedOperations = response.NavDatosIndirectos?.results || [];
                        
                        if (aValidatedOperations.length > 0) {
                            // Buscar la operación validada que corresponde a esta fila
                            var oValidatedOp = aValidatedOperations.find(function(op) {
                                return op.PhPspnr === sNewValue && op.TipoInd === oData.TipoInd;
                            });
                            
                            if (oValidatedOp) {
                                // Actualizar el modelo con los datos validados del servicio
                                Object.keys(oValidatedOp).forEach(function(key) {
                                    if (oModel.getProperty(sPath + "/" + key) !== undefined) {
                                        oModel.setProperty(sPath + "/" + key, oValidatedOp[key]);
                                    }
                                });
                            }
                            
                            // Cambiar isNew a false
                            oModel.setProperty(sPath + "/isNew", false);

                            // Reorganizar hermanos con el mismo padre por su último segmento numérico
                            this._reorderSiblingsByPhPspnr(oData.ParentCode, oModel);
                            
                            // Mensaje de éxito
                            //   Se traduce el mensaje via i18n para soportar EN/FR.  
                            sap.m.MessageToast.show(this.getTranslatedText("MSG_OPERACION_VALIDADA"));
                            //  
                        }
                    }.bind(this)).catch(function(error) {
                        sap.m.MessageBox.error(
                            "Error al validar la operación: " + (error.message || error),
                            {
                                title: this.getTranslatedText("ERROR")
                            }
                        );
                        
                        // Revertir el cambio en caso de error
                        oModel.setProperty(sPath + "/PhPspnr", "");
                        oSource.setValue("");
                    }.bind(this));
                }
            }
        },
        /**
         * Replica el valor de Post1 a la versión hermana (mismo PhPspnr, diferente TipoInd)
         */
        _replicatePost1ToSibling: function(oCurrentData, sPost1Value, oModel) {
            var aData = oModel.getData();
            var sSiblingTipoInd = oCurrentData.TipoInd === "I" ? "A" : "I";
            
            // Buscar la fila hermana (mismo PhPspnr, diferente TipoInd)
            for (var i = 0; i < aData.length; i++) {
                if (aData[i].PhPspnr === oCurrentData.PhPspnr && 
                    aData[i].TipoInd === sSiblingTipoInd &&
                    aData[i].isNew) {
                    // Actualizar Post1 en la versión hermana
                    oModel.setProperty("/" + i + "/Post1", sPost1Value);
                    break;
                }
            }
        },
        
        /**
         * Reordena en el modelo todas las filas que comparten el mismo padre (ParentPath o ParentCode)
         * agrupándolas por PhPspnr (par I/A o P/B) y ordenando los pares por el último segmento numérico.
         * @param {string} sParentCode - PhPspnr del padre cuyas hijas deben reordenarse
         * @param {object} oModel - JSONModel que contiene la lista plana de datos
         */
        _reorderSiblingsByPhPspnr: function(sParentCode, oModel) {
            if (!sParentCode) { return; }
            var aData = oModel.getData();

            // Recoger índices de todas las filas hijas (mismo padre, nivel 3)
            var aSiblingIndices = [];
            for (var i = 0; i < aData.length; i++) {
                var sItemParent = aData[i].ParentCode || aData[i].ParentPath || "";
                if (sItemParent === sParentCode) {
                    aSiblingIndices.push(i);
                }
            }

            if (aSiblingIndices.length < 2) { return; }

            // Extraer las filas hermanas del array
            var aSiblingRows = aSiblingIndices.map(function(idx) { return aData[idx]; });

            // Agrupar pares por PhPspnr y ordenar por el último segmento numérico,
            // conservando dentro de cada par el orden I/A (o P/B).
            aSiblingRows.sort(function(a, b) {
                var aLastSeg = parseInt((a.PhPspnr || "").split(".").pop(), 10) || 0;
                var bLastSeg = parseInt((b.PhPspnr || "").split(".").pop(), 10) || 0;
                if (aLastSeg !== bLastSeg) { return aLastSeg - bLastSeg; }
                // Mismo PhPspnr: primer tipo ("I" o "P") antes que el segundo ("A" o "B")
                var aIsFirst = (a.TipoInd === "I" || a.TipoInd === "P") ? 0 : 1;
                var bIsFirst = (b.TipoInd === "I" || b.TipoInd === "P") ? 0 : 1;
                return aIsFirst - bIsFirst;
            });

            // Escribir de vuelta las filas reordenadas en las mismas posiciones del array
            aSiblingIndices.forEach(function(idx, pos) {
                aData[idx] = aSiblingRows[pos];
            });

            oModel.setData(aData);
            oModel.refresh();
        },

        /**
         * Asegura que la versión hermana mantenga el valor antiguo de PhPspnr
         */
        _ensureSiblingKeepsOldPhPspnr: function(oCurrentData, sOldValue, oModel) {
            var aData = oModel.getData();
            var sSiblingTipoInd = oCurrentData.TipoInd === "I" ? "A" : "I";
            
            // Buscar la fila hermana (que todavía tiene el PhPspnr antiguo)
            for (var i = 0; i < aData.length; i++) {
                if (aData[i].PhPspnr === sOldValue && 
                    aData[i].TipoInd === sSiblingTipoInd &&
                    aData[i].isNew) {
                    // La version hermana ya conserva el valor correcto (el antiguo);
                    // no se requiere ninguna accion adicional, basta con no modificarla.
                    break;
                }
            }
        },

        /**
         * Maneja el cambio en los checkboxes de filtro de TipoInd
         * Filtra las filas de la TreeTable según los checkboxes seleccionados
         */
        onFilterTipoIndChange: function() {
            var oCheckboxInversion = this.byId("checkboxInversion");
            var oCheckboxAmortizacion = this.byId("checkboxAmortizacion");
            
            if (!oCheckboxInversion || !oCheckboxAmortizacion) {
                return;
            }
            
            var bShowInversion = oCheckboxInversion.getSelected();
            var bShowAmortizacion = oCheckboxAmortizacion.getSelected();
            
            // Obtener el modelo y los datos originales
            var oModel = this.getView().getModel("anticipadosModel");
            
            if (!oModel || !this._originalAnticipadosData) {
                return;
            }
            
            // Crear una copia de los datos originales
            var aOriginalData = JSON.parse(JSON.stringify(this._originalAnticipadosData));
            
            // Filtrar los datos según los checkboxes
            var aFilteredData = aOriginalData.filter(function(oItem) {
                if (oItem.TipoInd === "I" && !bShowInversion) {
                    return false;
                }
                if (oItem.TipoInd === "A" && !bShowAmortizacion) {
                    return false;
                }
                return true;
            });
            
            // Actualizar el modelo con los datos filtrados
            oModel.setData(aFilteredData);
            oModel.refresh();
            
            // Refrescar la tabla
            var oTable = this.byId("TreeTableAnticipados");
            if (oTable) {
                var oBinding = oTable.getBinding("rows");
                if (oBinding) {
                    oBinding.refresh();
                }
            }
            
            // Refrescar los colores de las filas
            // Se pasa !bShowInversion: true cuando la inversión está oculta,
            // lo que indica que las filas de amortización (TipoInd="A") no deben colorearse
            setTimeout(function() {
                this.colorRows(!bShowInversion);
            }.bind(this), 100);
        },
        /**
         * Se ejecuta antes de cerrar el navegador para advertir sobre cambios no guardados
         */
        onBrowserClose: function (oEvent) {
            if (this.hasUnsavedChanges()) {

                oEvent.preventDefault();
                oEvent.returnValue = '';
                return '';
            }
        },
        
        /**
         * Limpia los event listeners al destruir el controlador
         */
        onExit: function () {
            //  Se resetea la bandera para que la siguiente navegación a esta
            // vista reinicialice las columnas correctamente desde cero.
            this._bAnticipadosFirstRender = false;
            if (this._boundBrowserClose) {
                window.removeEventListener("beforeunload", this._boundBrowserClose);
            }
            if (this._boundResizeHandler) {
                $(window).off("resize", this._boundResizeHandler);
            }
        },
         _shouldShowAmortizationStyle: function () {
            return true;
        },

        /**
         *     Columnas estáticas de Anticipados para la Plantilla de carga (apartado 5.9 del spec).
         *   Estructura solicitada por el usuario: 9 columnas. "Tipo / Proveedor" muestra TipoInd
         *   (Inversión/Aplicación); la alternativa "Proveedor" es sólo informativa en la cabecera ya
         *   que Anticipados no tiene bloque proveedor como tal.
         */
        _getPlantillaStaticColumns: function () {
            //   Se traducen via i18n las cabeceras de la plantilla de carga.  
            return [
                { header: this.getTranslatedText("colOperacionAgrupador"), path: "PhPspnr" },
                { header: this.getTranslatedText("DESCRIPCION"), path: "Post1" },
                { header: this.getTranslatedText("colTipoProveedor"), path: "TipoInd" },
                { header: this.getTranslatedText("ejecutado"), path: "_Ejecutado" },
                { header: this.getTranslatedText("pendiente") + "*", path: "_Pendiente" },
                { header: this.getTranslatedText("total"), path: "_Total" },
                { header: this.getTranslatedText("dbReparto"), path: "Tipo" },
                { header: this.getTranslatedText("fechaInicio"), path: "FINI" },
                { header: this.getTranslatedText("fechaFin"), path: "FFIN" }
            ];
            //  
        },
    });
});
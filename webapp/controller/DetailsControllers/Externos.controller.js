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
                var bIsBlocked = sEvBloqueados.trim().length > 0;

                var oModeloBloqueo = this.getView().getModel("modeloBloqueo");
                if (!oModeloBloqueo) {
                    oModeloBloqueo = new sap.ui.model.json.JSONModel({
                        isBlocked: bIsBlocked
                    });
                    this.getView().setModel(oModeloBloqueo, "modeloBloqueo");
                } else {
                    oModeloBloqueo.setProperty("/isBlocked", bIsBlocked);
                }

                const tree = this.buildTree(response.NavDatosIndirectos.results);
                this.getView().setModel(new sap.ui.model.json.JSONModel(tree), "externosModel");

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

        //  Se gestiona la pulsación del botón de eliminar para recoger las líneas
        // seleccionadas en la tabla y delegar la baja al servicio DelIndirectosSet.
        onDeletePress: async function () {
            //  Se obtiene la tabla y los índices seleccionados sobre el modelo de Externos.
            var oTable = this.byId("TreeTableExternos");
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
         * seleccionadas en la pestaña de Externos.
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
                            pestana: "Externos",
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

                //  Si no se devuelven errores, se eliminan las líneas del modelo local de Externos.
                //   El modelo es un arbol con children anidados, asi que se borra recursivamente
                // via _removeRowsFromTreeByKey (BaseController) en vez de un splice plano.
                var oModel = this.getView().getModel("externosModel");
                this._removeRowsFromTreeByKey(oModel.getData(), aLinesToDelete);
                oModel.refresh(true);

                var oTable = this.byId("TreeTableExternos");
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
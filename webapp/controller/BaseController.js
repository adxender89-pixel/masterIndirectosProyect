sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/model/json/JSONModel",
    "zindirect_costs/fragments/MessageDialog.fragment",
    "zindirect_costs/fragments/Selector.fragment",
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
    "zindirect_costs/utils/ServiceCaller",
    "sap/ui/core/Fragment",
    "sap/m/MessageBox",
    "sap/m/SuggestionItem"
], function (
    Controller,
    History,
    JSONModel,
    messageDialog,
    selectorDialog,
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
    serviceCaller,
    Fragment,
    MessageBox,
    SuggestionItem
) {
    "use strict";

    return Controller.extend("zindirect_costs.controller.BaseController", {
        // Se define la variable que almacenará la instancia del diálogo de carga para evitar duplicados.
        loadingDialog: null,
        // Se define el nombre del modelo principal de la tabla, que será sobreescrito por las vistas hijas.
        tableModelName: "",

        /**
         * Se obtiene la ruta de enlace (binding) basada en el nombre del modelo.
         */
        getBind: function (sField) {
            // Se concatena el nombre del modelo (si existe) seguido de ">" y el campo solicitado para el data binding.
            return "{" + (this.tableModelName ? this.tableModelName + ">" : "") + sField + "}";
        },

        /**
         * Se obtienen los datos del modelo de endpoint.
         */
        getEndpointData: function () {
            // Se accede al componente principal de la aplicación para extraer los datos completos del modelo "endpointModel".
            return this.getOwnerComponent().getModel("endpointModel").getData();
        },

        /**
         * Se muestra el diálogo de carga.
         */
        _showLoadingDialog: function () {
            // (INICIO)
            //   Si la propiedad transitoria _suppressGlobalLoading esta activa, se omite
            //   la creacion del dialog de "Cargando datos". Lo usa onYearChange para que
            //   al navegar entre anios no aparezca el mensaje global durante el reload.
            if (this._suppressGlobalLoading === true) { //   flag transitorio: se respeta solo cuando esta a true
                return; //   se aborta la apertura del dialog para no mostrar "Cargando datos"
            }
            // (FIN)
            // Se comprueba si el diálogo ya ha sido instanciado previamente para no superponer múltiples diálogos.
            if (!this.loadingDialog) {
                // Se crea y asigna la instancia del diálogo utilizando textos traducidos.
                this.loadingDialog = this.createMessageDialog({
                    title: this.getTranslatedText("CARGANDO_DATOS"),
                    messages: [{
                        text: this.getTranslatedText("ESPERE_POR_FAVOR"),
                        type: "Information",
                        showIcon: false
                    }]
                });
            }
        },

        /**
         * Se oculta y destruye el diálogo de carga.
         */
        _hideLoadingDialog: function () {
            // Se verifica que el diálogo exista antes de intentar destruirlo.
            if (this.loadingDialog) {
                // Se destruye el control para liberar memoria y evitar fugas en la interfaz.
                this.loadingDialog.destroy();
                // Se reinicia la variable a nulo para permitir futuras instanciaciones.
                this.loadingDialog = null;
            }
        },

     
       /**
 * Se realiza una petición GET al servidor OData.
 */
        get: async function (oModel, sPath, oParams = {}) {
            //   Se anade el flag noLoading replicando el comportamiento de post():
            // cuando viene en true se suprime el dialog de carga (alta y baja). Se usa
            // para validaciones silenciosas que se disparan sobre el change del Input
            // y que no deben bloquear la UI con el spinner global.
            const { noLoading, ...oRestParams } = oParams;
            if (!noLoading) {
                this._showLoadingDialog();
            }

            const oAppData = this.getGlobalModel("appData");
            const sToken = oAppData ? oAppData.getProperty("/EvToken") : undefined;

            return new Promise((resolve, reject) => {
                oModel.read(sPath, {
                    ...oRestParams,
                    headers: {
                        ...oRestParams.headers,
                        ...(sToken && { token: sToken })
                    },
                    success: function (data) {
                        resolve(data);
                        if (!noLoading) this._hideLoadingDialog();
                    }.bind(this),
                    error: function (error) {
                        reject(error);
                        if (!noLoading) this._hideLoadingDialog();
                    }.bind(this),
                });
            });
        },

        _cleanDataForPost: function (data) {
            //     Se anaden editCtotPen y editCtot a la lista de propiedades a eliminar
            // antes de enviar datos al backend, ya que son propiedades exclusivas del frontend
            // calculadas en buildTree para condicionar la editabilidad segun TipoTasa.
            const propsToRemove = [
                "_Pendiente", "_Ejecutado", "_Total", "isLevel3", "isNew",
                "repartoItems", "children",
                "editPhPspnr", "editPost1", "editTasa", "editAmoEje", "editAmoEjeAjus",
                "editAmoEjeReal", "editAmoPen", "editAmoTot", "editPepDest",
                "editTipo", "editPenPlan", "editMonths", "editPend",
                "editCtotPen", "editCtot"
            ];

            if (data && data.NavDatosIndirectos && Array.isArray(data.NavDatosIndirectos)) {
                data.NavDatosIndirectos = data.NavDatosIndirectos.map(item => {
                    if (item && typeof item === "object") {
                        const cleanItem = { ...item };
                        propsToRemove.forEach(prop => delete cleanItem[prop]);
                        return cleanItem;
                    }
                    return item;
                });
            }

            return data;
        },

        /**
         * Se realiza una petición POST al servidor OData.
         */
        post: async function (oModel, sPath, oData, oParams = {}) {
            const { noLoading, ...oRestParams } = oParams;
            if (!noLoading) {
                this._showLoadingDialog();
            }

            const oAppData = this.getGlobalModel("appData");
            const sToken = oAppData ? oAppData.getProperty("/EvToken") : undefined;
            // Limpiar propiedades temporales antes de enviar
            oData = this._cleanDataForPost(oData);
            return new Promise((resolve, reject) => {
                oModel.create(sPath, oData, {
                    ...oRestParams,
                    headers: {
                        ...oRestParams.headers,
                        ...(sToken && { token: sToken })
                    },
                    success: function (data) {
                        resolve(data);
                        if (!noLoading) {
                            this._hideLoadingDialog();
                        }
                    }.bind(this),
                    error: function (error) {
                        reject(error);
                        if (!noLoading) {
                            this._hideLoadingDialog();
                        }
                    }.bind(this),
                });
            });
        },

        /**
         * Se realiza una llamada a un servicio externo genérico.
         */
        callExternalService: async function (url, method = "GET", data = null, headers = {}) {
            // Se procesa la llamada asíncrona mediante el utilitario 'serviceCaller'.
            return new Promise((resolve, reject) => {
                serviceCaller.callService(url, method, data, headers)
                    // Se mapea la respuesta exitosa directamente al 'resolve'.
                    .then(response => resolve(response))
                    // Se traslada cualquier excepción al 'reject' de la promesa superior.
                    .catch(error => reject(error));
            });
        },

        /** * Se obtiene el enrutador de la aplicación.
         */
        getRouter: function () {
            // Se recupera la instancia del router desde el contexto del componente global.
            return this.getOwnerComponent().getRouter();
        },

        /** * Se obtiene el modelo asociado a la vista actual.
         */
        getModel: function (sName) {
            // Se retorna el modelo especificado ligado al ciclo de vida de la vista actual.
            return this.getView().getModel(sName);
        },

        /** * Se establece un modelo a nivel global (Componente).
         */
        setGlobalModel: function (oModel, sName) {
            // Se asigna el modelo en la raíz de la aplicación para que esté disponible en todas las vistas.
            return this.getOwnerComponent().setModel(oModel, sName);
        },

        /** * Se obtiene un modelo a nivel global (Componente).
         */
        getGlobalModel: function (sName) {
            // Se accede a la raíz de la aplicación para recuperar un modelo global.
            return this.getOwnerComponent().getModel(sName);
        },

        /** * Se establece un modelo a nivel local (Vista).
         */
        setModel: function (oModel, sName) {
            // Se vincula un nuevo modelo únicamente al alcance de la vista desde donde se llama.
            return this.getView().setModel(oModel, sName);
        },

        /** * Se obtiene el paquete de recursos (i18n) para traducciones.
         */
        getResourceBundle: function () {
            // Se rescata el modelo de internacionalización y se extrae su ResourceBundle nativo.
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
        },

        /** * Se gestiona la navegación hacia atrás en el historial.
         */
        onNavBack: function () {
            // Se consulta el historial interno de UI5 para verificar si existe una página anterior.
            const sPreviousHash = History.getInstance().getPreviousHash();

            // Si hay un hash previo válido, se retrocede en el historial nativo del navegador.
            if (sPreviousHash !== undefined) {
                history.go(-1);
            } else {
                // Si se ha entrado a la app directamente por un enlace profundo (sin historial), se fuerza la navegación a la vista 'master'.
                this.getRouter().navTo("master", {}, true);
            }
        },

        /**
         * Se obtiene el segundo año visible en la tabla. Función auxiliar para el cálculo de rangos.
         */
        _getSecondVisibleYear: function () {
            // Se recupera la instancia de la tabla que está siendo operada en el controlador.
            const oTable = this.getControlTable();

            // Se extraen todas las columnas y se filtran buscando solo aquellas de tipo 'dynamicYear' y descartando las de 'ejecutados'.
            const aDynYears = oTable.getColumns().filter(function (c) {
                return c.data("dynamicYear") === true && !c.data("ejecutadosColumn");
            });

            // Se evalúa si hay al menos dos años renderizados. Si los hay, se retorna el año de la segunda columna; de lo contrario, se suma 1 al año actual.
            return aDynYears.length >= 2 ? aDynYears[1].data("year") : new Date().getFullYear() + 1;
        },

        /**
         * Se construye la estructura de la columna 'Ejercicios Anteriores' de forma dinámica.
         */
        _buildEjecutadosColumn: function (bAsDynamicMonth, iYear) {
            let oLabel;

            //   Se obtiene el texto traducible para la cabecera de la columna.
            const sEjerciciosAnterioresText = this.getResourceBundle().getText("EJERCICIOS_ANTERIORES") || "Ejercicios anteriores";

            if (bAsDynamicMonth) {
                oLabel = new sap.m.VBox({
                    width: "100%",
                    items: [
                        new sap.m.Label({
                            text: sEjerciciosAnterioresText,
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
                }).addStyleClass("fullWidthHeader").addStyleClass("noPaddingTop").addStyleClass("borderLeftEjecutado");
            } else {
                oLabel = new sap.m.VBox({
                    alignItems: "Center",
                    renderType: "Bare",
                    width: "100%",
                    items: [
                        new sap.m.Label({
                            text: sEjerciciosAnterioresText,
                            design: "Bold",
                            textAlign: "Center",
                            width: "100%"
                        }).addStyleClass("testBold titleGrande")
                    ]
                }).addStyleClass("borderLeftEjecutado");
            }

            //   : columna con formatter aplicado en el Text (sin convertir a Input)
            const oCol = new sap.ui.table.Column({
                width: "130px",
                hAlign: "Center",
                label: oLabel,
                template: new sap.m.HBox({
                    renderType: "Bare",
                    justifyContent: "End",
                    alignItems: "Center",
                    width: "100%",
                    items: [
                        new sap.m.Text({
                            width: "100%",
                            textAlign: "End",
                            wrapping: false,
                            text: {
                                parts: [
                                    this.tableModelName + ">InvEjeReal",
                                    "dashboardModel>/decimales"
                                ],
                                formatter: this.formatDecimales.bind(this)
                            }
                        })
                    ]
                }).addStyleClass("borderLeftEjecutado")
            });

            //   : metadata para identificación
            if (bAsDynamicMonth) {
                oCol.data("dynamicMonth", true);
            } else {
                oCol.data("dynamicYear", true);
            }

            oCol.data("ejecutadosColumn", true);

            return oCol;
        },


        /**
           * Se crean masivamente y dinámicamente las columnas base de cada año.
           */
        createYearColumns: function (iStartYear, iHowMany, _pTable) {
            // Se recupera la tabla a manipular.
            const oTable = this.getControlTable();
            if (!oTable) return;

            // Se extraen las columnas actuales y se iteran de atrás hacia adelante para evitar saltos de índice al eliminarlas.
            const aColumns = oTable.getColumns();
            for (let i = aColumns.length - 1; i >= 0; i--) {
                const oCol = aColumns[i];
                // Se suprimen todas las columnas anuales creadas previamente para garantizar un renderizado limpio.
                if (oCol.data("dynamicYear") === true) {
                    oTable.removeColumn(oCol);
                }
            }

            // Se establece un offset numérico para leer propiedades específicas de los objetos (Totala1, Totala2, etc.) en los formateadores.
            const iStartFrom = 13;
            // Se comprueba el estado del control de "Ejecutados" para saber si hay que incluir dicha columna especial.
            const bShowEjecutado = this._bEjecutadoSelected || false;

            // Si está marcado, se inyecta la columna de ejercicios históricos al principio.
            if (bShowEjecutado) {
                oTable.addColumn(this._buildEjecutadosColumn(false, new Date().getFullYear()));
            }

            // Se genera un arreglo con los años numéricos exactos que se van a generar en pantalla.
            const aYears = [];
            for (let i = 0; i < iHowMany; i++) {
                aYears.push(iStartYear + i);
            }
            // Se procesa de forma individual cada año solicitado para ensamblar su columna.
            aYears.forEach(function (iYear, index) {
                // Se prepara el sufijo del modelo (Ej: "a1", "a2") para relacionar la columna lógica con la clave de la base de datos.
                const sSubFijo = "a" + (index + 1);
                // Se genera la ruta de binding dinámica que leerá el Total anual.
                const sTotalTextBinding = "{" + this.tableModelName + ">Total" + sSubFijo + "}";

                // Se construye el bloque de etiqueta que incluye el botón para desplegar meses y los elementos sticks.
                const oYearLabel = new sap.m.VBox({
                    width: "100%",
                    height: "100%",
                    renderType: "Bare",
                    alignItems: "Stretch",
                    justifyContent: "Start",
                    items: [
                        // Botón principal de la cabecera que muestra el año y dispara el desglose mensual.
                        new sap.m.Button({
                            text: iYear.toString(),
                            type: "Transparent",
                            width: "100%",
                            press: function (oEvent) {
                                this.onCreateMonthsTable(oEvent);
                            }.bind(this)
                        }).addStyleClass("yearButton").addStyleClass("nopadding").data("subFijoYear", sSubFijo),

                        // Elemento contenedor que aparece fijado (sticky) mostrando los totales consolidados cuando se hace scroll hacia abajo.
                        new sap.m.VBox({
                            renderType: "Bare",
                            width: "100%",
                            visible: "{ui>/showStickyParent}",
                            items: [
                                new sap.m.Text({
                                    text: "{ui>/stickyHeaderData/parent/y" + iYear + "}",
                                    textAlign: "Center",
                                    wrapping: false,
                                    width: "100%"
                                })
                            ]
                        }).addStyleClass("parentHeaderBox"),

                        // Elemento contenedor para el sub-nivel fijo (sticky child).
                        new sap.m.VBox({
                            width: "100%",
                            visible: "{ui>/showStickyChild}",
                            items: [
                                new sap.m.Text({
                                    text: "{ui>/stickyHeaderData/child/y" + iYear + "}",
                                    wrapping: false
                                }).addStyleClass("secondStickyText checkboxStickyText")
                            ]
                        }).addStyleClass("parentHeader")
                    ]
                }).addStyleClass("fullWidthHeader");

                // Se evalúa dinámicamente si la fila de datos es un agrupador o un registro operable mediante un string literal evaluable.
                const sCabeceraBinding = this.tableModelName ? "${" + this.tableModelName + ">cabecera}" : "${cabecera}";

                // Se diseña la celda interior que mostrará los datos o el input en base a la jerarquía de la TreeTable.
                const oColumnTemplate = new sap.m.HBox({
                    renderType: "Bare",
                    justifyContent: "Center",
                    alignItems: "Center",
                    // La celda general solo es visible si la fila NO es una cabecera organizativa.
                    visible: true,
                    items: [
                     
                        new sap.m.Input({
                            editable: false,
                            textAlign: "Center",
                            value: this._buildNumericBinding(
                                this.tableModelName + ">Totala" + (parseInt(index) + 1)
                            ),
                            visible: true,

                            //   Se registra el handler centralizado de cambio de celda. Este método
                            //   gestiona el formateo, parseo y envío al backend de forma unificada
                            //   para todos los inputs editables de la tabla, incluyendo los de año.
                            change: this.onRowInputChange.bind(this),

                            liveChange: function () { }

                            //   Se almacena el año real de la columna como atributo custom para que
                            //   onRowInputChange pueda identificar este input como perteneciente a una
                            //   columna de año dinámico y actualizar la clave y{año} del sticky header.
                        }).data("yearColYear", iYear)
                            //   Se almacena también el sufijo del modelo (a1, a2...) para poder
                            //   construir la clave de payload correcta (Totala1, Totala2...) dentro
                            //   de onRowInputChange sin necesidad de inferirlo desde el binding.
                            .data("yearColSubFijo", sSubFijo)
                            .addStyleClass("customYearInput sapUiSizeCompact"),

                        // Texto de solo lectura para los nodos padres (agrupadores) donde los totales no son editables directamente.
                        new sap.m.Text({
                            textAlign: "Center",
                            visible: "{= (${" + this.tableModelName + ">expandible} === false || ${" +
                                this.tableModelName + ">isGroup} === true) && !${" +
                                this.tableModelName + ">__isCustom} }",

                            wrapping: false,
                            text: {
                                path: this.tableModelName + ">Totala" + (parseInt(index) + 1),
                                // Formateador dinámico que asegura que no se presenten valores incoherentes en los nodos editables al colapsar.
                                formatter: function (oRow) {
                                    if (!oRow || (oRow.expandible !== false && !oRow.isGroup)) return "";
                                    const aKeys = Object.keys(oRow);
                                    const sTargetKey = aKeys[iStartFrom + index];
                                    return sTargetKey ? oRow[sTargetKey] : "";
                                }
                            }
                        })
                    ]
                }).addStyleClass("yearCell sapUiTinyMarginBegin sapUiTinyMarginEnd");

                // Se empaqueta la lógica construida en una instancia real de columna para SAPUI5.
                const oCol = new sap.ui.table.Column({
                    width: "8rem",
                    minWidth: 60,
                    autoResizable: true,
                    label: oYearLabel,
                    template: oColumnTemplate
                });

                // Se asocian las etiquetas para poder localizar la columna rápidamente en otros ciclos de renderizado.
                oCol.data("dynamicYear", true);
                oCol.data("year", iYear);
                oCol.data("subFijoYear", "a" + (parseInt(index) + 1));
                // Se recupera el ancho previamente guardado para esta columna de año y se aplica
                // si existe, de modo que el usuario recupere la disposición que había configurado.
                if (this.savedColWidths && this._savedColWidths["year" + iYear]) {
                    oCol.setWidth(this.savedColWidths["year" + iYear]);
                }

                // Se adjunta la nueva columna al final del array de columnas de la tabla principal.
                oTable.addColumn(oCol);

            }.bind(this));
            // Se elimina la columna Resto previa si existía para evitar duplicados
            const aExistingCols = oTable.getColumns();
            for (let i = aExistingCols.length - 1; i >= 0; i--) {
                if (aExistingCols[i].data("restoColumn") === true) {
                    oTable.removeColumn(aExistingCols[i]);
                }
            }

            const oRestoLabel = new sap.m.VBox({
                width: "100%",
                renderType: "Bare",
                items: [
                    new sap.m.Label({
                        //   Se traduce el header "Resto" via i18n para soportar EN/FR.  
                        text: this.getTranslatedText("colResto"),
                        //  
                        design: "Bold",
                        textAlign: "Center",
                        width: "100%"
                    }).addStyleClass("titleGrande"),
                    new sap.m.VBox({
                        renderType: "Bare",
                        width: "100%",
                        visible: "{ui>/showStickyParent}",
                        items: [
                            new sap.m.Text({
                                text: "{ui>/stickyHeaderData/parent/PlanResto}",
                                wrapping: false,
                                width: "100%",
                                textAlign: "Center"
                            })
                        ]
                    }).addStyleClass("parentHeaderBox"),
                    new sap.m.HBox({
                        renderType: "Bare",
                        alignContent: "Start",
                        items: [
                            new sap.m.Text({
                                text: "{ui>/stickyHeaderData/child/PlanResto}",
                                textAlign: "Center",
                                wrapping: false,
                                visible: "{ui>/showStickyChild}",
                                width: "100%"
                            }).addStyleClass("secondStickyText")
                        ]
                    }).addStyleClass("parentHeader")
                ]
            }).addStyleClass("fullWidthHeader");

            const oRestoTemplate = new sap.m.HBox({
                renderType: "Bare",
                width: "100%",
                alignItems: "Center",
                visible: "{= ${" + this.tableModelName + ">cabecera} !== true }",
                items: [
                    new sap.m.Text({
                        width: "100%",
                        textAlign: "End",
                        wrapping: false,
                        text: {
                            parts: [
                                this.tableModelName + ">PlanResto",
                                "dashboardModel>/decimales"
                            ],
                            formatter: this.formatDecimales.bind(this)
                        },
                        visible: "{= ${" + this.tableModelName + ">expandible} === false || ${" + this.tableModelName + ">isGroup} === true }"
                    }),
                    new zindirect_costs.control.DecimalesInput({
                        width: "100%",
                        textAlign: "Center",
                        decimalNumbers: "{dashboardModel>/decimales}",
                        // editable: "{= !${" + this.tableModelName + ">__isSinProveedor} && ${" + this.tableModelName + ">padre} !== true && (${" + this.tableModelName + ">Tipo} === 'MAN' || ${" + this.tableModelName + ">Tipo} === 'PCT' || ${" + this.tableModelName + ">Tipo} === '') }",
                        editable: false,
                        visible: "{= ${" + this.tableModelName + ">expandible} !== false && !${" + this.tableModelName + ">isGroup} }",
                        value: {
                            parts: [
                                this.tableModelName + ">PlanResto",
                                "dashboardModel>/decimales"
                            ],
                            formatter: this.formatDecimales.bind(this)
                        },

                        //   Se registra el handler centralizado de cambio de celda para la columna
                        //   Resto, de forma que el envío al backend se gestione por el mismo flujo
                        //   que el resto de inputs editables de la tabla sin duplicar lógica.
                        change: this.onRowInputChange.bind(this)

                        //   Se marca el control como perteneciente a la columna Resto mediante un
                        //   atributo custom para que onRowInputChange active la rama de sincronización
                        //   del sticky header con la clave /stickyHeaderData/parent/Resto.
                    }).data("restoInput", true)
                        .addStyleClass("borderColYears sapUiSizeCompact restoNoEditableBg"),

                ]
            }).addStyleClass("yearCell");

            const oRestoCol = new sap.ui.table.Column({
                width: "8rem",
                minWidth: 60,
                autoResizable: true,
                hAlign: "Center",
                label: oRestoLabel,
                template: oRestoTemplate
            });

            oRestoCol.data("restoColumn", true);

            oTable.addColumn(oRestoCol);

            //FIN COLUMNA RESTO 

            // Se envía a la cola del procesador la función de reactivar la lógica interna del scroll y los grupos en la TreeTable.
            setTimeout(function () {
                this.setupDynamicTreeTable();
            }.bind(this), 0);

        },
   
        createDynamicYearColumns: function (sTableId) {

            //  Se verifica que los años hayan sido inicializados previamente.
            if (!this._iYearStart || !this._iYearEnd) {
                //  Si aún no están disponibles, se reintenta tras un breve delay.
                setTimeout(function () {
                    this.createDynamicYearColumns(sTableId);
                }.bind(this), 200);
                return;
            }

            //    Se calcula el número total de años del rango dinámico.
            var iHowMany = this._iYearEnd - this._iYearStart + 1;

            //    Se crean las columnas dinámicas de años.
            this.createYearColumns(this._iYearStart, iHowMany, sTableId);

            //    Se obtiene el año seleccionado actualmente desde el modelo yearsModel.
            var oYearsModel = this.getView().getModel("yearsModel");

            if (!oYearsModel) return;

            var sSelectedYear = oYearsModel.getProperty("/selectedYear");
            var iSelectedYear = parseInt(sSelectedYear, 10);

            if (!iSelectedYear) return;

            //  Se aplica la lógica de visibilidad de columnas (2 años o 1 si es el último).
            this._showYearColumns(iSelectedYear);

            // Se abre automáticamente el detalle mensual del año seleccionado,
            //  replicando el comportamiento de Corrientes.
            setTimeout(function () {

                var oTable = this.getControlTable();
                if (!oTable) return;

                //    Se busca la columna dinámica correspondiente al año seleccionado.
                var oYearCol = oTable.getColumns().find(function (oCol) {
                    return oCol.data("dynamicYear") === true &&
                        parseInt(oCol.data("year"), 10) === iSelectedYear &&
                        !oCol.data("ejecutadosColumn");
                });

                if (!oYearCol) return;

                var sSubFijo = oYearCol.data("subFijoYear");

                //    Se simula el evento de pulsación del botón de año para abrir los meses.
                this.onCreateMonthsTable({
                    getSource: function () {
                        return {
                            getMetadata: function () {
                                return {
                                    getName: function () {
                                        return "sap.m.Button";
                                    }
                                };
                            },
                            getText: function () {
                                return String(iSelectedYear);
                            },
                            data: function (sKey) {
                                if (sKey === "subFijoYear") return sSubFijo;
                                if (sKey === "year") return String(iSelectedYear);
                                return null;
                            }
                        };
                    }
                });

            }.bind(this), 0);
        },
        /* Se muestran únicamente las dos columnas dinámicas correspondientes a la ventana del año seleccionado. Si el año seleccionado es el último del rango, se muestran
         * el penúltimo y el último año juntos. En caso contrario, se muestran el año seleccionado y el inmediatamente siguiente.
         */
        _showYearColumns: function (iSelectedYear) {
            //  Se obtiene dinámicamente el ID de la tabla desde el controlador hijo,
            //  permitiendo reutilizar la lógica en múltiples vistas.
            var sTableId = this.getCustomTableId ? this.getCustomTableId() : "TreeTableBasic";
            var oTable = this.byId(sTableId);
            if (!oTable) return;

            var iYearEnd = this._iYearEnd || iSelectedYear;
            //  Se verifica si el año seleccionado es el último del rango.
            var bIsLastYear = iSelectedYear >= iYearEnd;

            oTable.getColumns().forEach(function (oCol) {
                if (!oCol.data("dynamicYear")) return;
                if (oCol.data("ejecutadosColumn") === true) return;
                var iColYear = parseInt(oCol.data("year"), 10);
                if (bIsLastYear) {
                    //  Último año: solo 1 columna visible.
                    oCol.setVisible(iColYear === iYearEnd);
                } else {
                    // Resto de años: año seleccionado + siguiente (2 columnas).
                    oCol.setVisible(iColYear === iSelectedYear || iColYear === iSelectedYear + 1);
                }
            });
        },
        /** Se fuerzan los recálculos visuales de grupos y scroll después de modificar la topología de la tabla (abrir o cerrar un nodo).*/
        _refreshAfterToggle: function (sTableId) {
            // Se obtiene la instancia específica de la tabla mediante su ID.
            const oTable = this.byId(sTableId);
            if (!oTable) return;

            // Se mapean de nuevo los inicios y fines de cada grupo padre frente a sus hijos en el DOM.
            this._buildGroupRanges();

            // Se dispara manualmente el evento de scroll simulando que la tabla se ha movido para reposicionar las cabeceras pegajosas (sticky headers).
            this._onScrollLike({
                getParameter: function () {
                    return oTable.getFirstVisibleRow();
                }
            });

            // Se vuelven a evaluar e inyectar las clases de color de fondo a las nuevas cabeceras visibles.
            this._applyCabeceraStyle();

            //    Se actualiza la visibilidad de las columnas exclusivas de
            // filas custom para ocultarlas si el colapso ha eliminado todos
            // los bloques custom del viewport actual.
            setTimeout(function () {
                this._updateCustomColsVisibility();
            }.bind(this), 50);
        },

        /**
         * Se procesan individualmente las filas renderizadas para asignarles clases CSS específicas en función de su naturaleza jerárquica.
         */
        _applyCabeceraStyle: function () {
            const oTable = this.getControlTable();
            const iFirst = oTable.getFirstVisibleRow();
            const aRows = oTable.getRows();
       const sFullTableId = oTable.getId(); // 
            const $oRoot = oTable.$(); // 
            for (let i = 0; i < aRows.length; i++) {
                const oRow = aRows[i];
                oRow.removeStyleClass("cabeceracolor");
                oRow.removeStyleClass("cabeceracolor-Group");
                 //   Se limpian las dos secciones del <tr> y el row selector 
                //   antes de re-evaluar para evitar que la clase se quede 
                //   pegada al indice de fila tras el reciclaje  */
                const $oFixed = $oRoot.find(".sapUiTableCtrlFixed tbody tr[data-sap-ui-rowindex='" + i + "']"); // 
                const $oScroll = $oRoot.find(".sapUiTableCtrlScroll tbody tr[data-sap-ui-rowindex='" + i + "']"); // 
                const $oRowSel = jQuery("#" + sFullTableId + "-rowsel" + i); // 
                $oFixed.removeClass("cabeceracolor cabeceracolor-Group"); // 
                $oScroll.removeClass("cabeceracolor cabeceracolor-Group"); // 
                $oRowSel.removeClass("cabeceracolor cabeceracolor-Group"); // 

                const oCtx = oTable.getContextByIndex(iFirst + i);
                if (!oCtx) continue;
                const oObj = oCtx.getObject();

                if (oObj && oObj.cabecera === true) {
                    oRow.addStyleClass("cabeceracolor");
                    oRow.removeStyleClass("flatCellInput");
                     //   Se sincroniza la clase en los <tr> reales 
                    $oFixed.addClass("cabeceracolor"); // 
                    $oScroll.addClass("cabeceracolor"); // 
                    $oRowSel.addClass("cabeceracolor"); // 
                }

                if (oObj && oObj.expandible === true) {
                    oRow.addStyleClass("cabeceracolor-Group");
                         //   scroll o insercion de fila. 
                    $oFixed.addClass("cabeceracolor-Group"); // 
                    $oScroll.addClass("cabeceracolor-Group"); // 
                    $oRowSel.addClass("cabeceracolor-Group"); // 
                }
            }

            //   Se gestionan los colores y bordes de forma independiente.
            this._highlightSinProveedor(oTable);
            this._applyBlockBorder(oTable);
        },
        /* Se gestiona la apertura global del menú contextual (Popover). */
        onContextMenu: function (oParams) {
            // Se extrae el contexto de datos de la fila sobre la que se ha hecho clic derecho.
            const oRowContext = oParams.rowBindingContext;
            // Se identifica el control visual exacto (celda) que originó el evento.
            const oOriginControl = oParams.cellControl;
            // Se obtiene la referencia a la vista actual para poder anclar el fragmento.
            const oView = this.getView();

            // Se bloquea el menú contextual en la fila "D" (OEO).
            const oRowData = oRowContext && oRowContext.getObject();
            if (oRowData && oRowData.PhPspnr === "D") {
                return;
            }

            // Se guarda una referencia global del contexto para que las acciones (Añadir, Eliminar) sepan sobre qué fila operar.
            this._oContextRecord = oRowContext;

            // Se verifica si el Popover (menú emergente) ya ha sido instanciado previamente en memoria.
            if (!this._pPopover) {
                // Si no existe, se carga asíncronamente el fragmento XML que contiene el diseño del menú.
                this._pPopover = Fragment.load({
                    id: oView.getId(),
                    name: "zindirect_costs.fragments.ActionPopover",
                    controller: this
                }).then(function (oPopover) {
                    // Se añade el popover como dependiente de la vista para que herede sus modelos y ciclo de vida.
                    oView.addDependent(oPopover);
                    return oPopover;
                });
            }

            // Una vez garantizada la existencia del Popover, se procede a su apertura.
            this._pPopover.then(function (oPopover) {
                // Se vincula el contexto de la fila al popover para que los botones sepan si están actuando sobre un nodo padre o hijo.
                oPopover.setBindingContext(oRowContext, "catalog");

                // Se aplica un ligero retraso para asegurar que el motor de renderizado posicione correctamente el menú junto al cursor.
                setTimeout(function () {
                    oPopover.openBy(oOriginControl);
                }, 50);
            });
        },
        /*Se cierra el popover de forma global.
         */
        onCloseContextMenu: function () {
            // Se comprueba que la promesa del popover exista.
            if (this._pPopover) {
                // Se resuelve la promesa y se ejecuta el método de cierre nativo del control.
                this._pPopover.then(function (oPopover) {
                    oPopover.close();
                });
            }
        },
        /** Se generan las columnas mensuales correspondientes al año seleccionado en la cabecera.
                  * Se garantiza que el mes en curso mantenga su campo de entrada (Input) incluso con ejecutados activos.
                  */
        onCreateMonthsTable: function (oEvent) {
            // Se obtiene la fuente del evento y el sufijo del año correspondiente.
            const oSource = oEvent.getSource();
            const subFijoYear = oSource.data("subFijoYear");
            const oTable = this.getControlTable();
            const bShowEjecutado = this._bEjecutadoSelected || false;

            // Se conserva la posicion actual del scroll horizontal para restaurarla al finalizar.
            let iCurrentScrollLeft = 0;
            try {
                const oScrollExt = oTable._getScrollExtension();
                if (oScrollExt && oScrollExt.getHorizontalScrollbar()) {
                    iCurrentScrollLeft = oScrollExt.getHorizontalScrollbar().scrollLeft;
                }
            } catch (e) { }

            // Se determina el texto del año segun el tipo de control que origino el evento.
            let sYearText = "";
            const sSourceName = oSource.getMetadata().getName();

            if (sSourceName === "sap.m.Button") {
                sYearText = oSource.data("year") || oSource.getText();
                if (isNaN(parseInt(sYearText, 10))) {
                    sYearText = oSource.getParent().getItems()[0].getText();
                }
            } else {
                sYearText = String(this._openedYear);
            }

            const sYear = parseInt(sYearText, 10);
            if (!sYear) return;

            //     Se lee el flag noClose de la fuente para saber si esta llamada proviene
            //     de una apertura programatica que no debe cerrar el año aunque ya estuviera abierto.
            const bNoClose = oSource.data("noClose") === true;

            // Se gestiona el cierre del año si ya estaba abierto previamente.
            //     Se respeta el flag noClose para evitar que aperturas automaticas cierren el año.
            if (this._openedYear === sYear && sSourceName === "sap.m.Button" && !bNoClose) {
                this._openedYear = null;
                oTable.setBusy(true);

                // Se eliminan todas las columnas mensuales dinamicas existentes.
                const monthColsToRemove = oTable.getColumns().filter(function (c) {
                    return c.data("dynamicMonth");
                });
                monthColsToRemove.forEach(function (c) { oTable.removeColumn(c); });

                // Se reinserta la columna de ejercicios anteriores en formato compacto si corresponde.
                if (bShowEjecutado) {
                    const ejecutadosColsToRemove = oTable.getColumns().filter(function (c) {
                        return c.data("ejecutadosColumn");
                    });
                    ejecutadosColsToRemove.forEach(function (c) { oTable.removeColumn(c); });

                    const iInsertIndex = oTable.getColumns().findIndex(function (c) {
                        return c.data("dynamicYear") === true;
                    });

                    if (iInsertIndex !== -1) {
                        oTable.insertColumn(this._buildEjecutadosColumn(false, new Date().getFullYear()), iInsertIndex);
                    }
                }

                // Se restaura el scroll horizontal y se libera el estado de ocupado de la tabla.
                setTimeout(function () {
                    try {
                        const oScrollExt = oTable._getScrollExtension();
                        if (oScrollExt && oScrollExt.getHorizontalScrollbar()) {
                            oScrollExt.getHorizontalScrollbar().scrollLeft = iCurrentScrollLeft;
                        }
                    } catch (e) { }
                    oTable.setBusy(false);
                }.bind(this), 50);
                // Se sincroniza el panel inferior cuando esta visible: al cerrar los meses arriba se eliminan tambien los meses del panel para mantener la alineacion visual entre ambas tablas
                this._syncPanelMonthsFromMain();
                return;
            }

            // Se inicia la apertura del anno seleccionado bloqueando la tabla durante el proceso.
            oTable.setBusy(true);

            // Se eliminan columnas mensuales y de ejecutados previas para evitar duplicados.
            const colsToRemove = oTable.getColumns().filter(function (c) {
                return c.data("dynamicMonth") || c.data("ejecutadosColumn");
            });
            colsToRemove.forEach(function (c) { oTable.removeColumn(c); });

            this._openedYear = sYear;

            
            const oMonthFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "MMM" });
            const aMonthNames = [];
            for (let i = 0; i < 12; i++) {
                aMonthNames.push(oMonthFormat.format(new Date(2000, i, 1)));
            }
            //  

            // Se obtiene la fecha de referencia efectiva para determinar el mes actual.
            const oRefDate = this._effectiveDate || new Date();
            const currentYear = oRefDate.getFullYear();
            const currentMonth = oRefDate.getMonth();

            // Se calcula el indice de inicio: si ejecutados esta activo se muestran todos los meses desde enero.
            const iStartIdx = (sYear === currentYear && !bShowEjecutado) ? currentMonth : 0;

            // Se localiza la columna del año en la tabla para calcular la posicion de insercion.
            const oYearCol = oTable.getColumns().find(function (c) {
                return this._getColumnLabelText(c) === String(sYear);
            }, this);
            const colIndex = oTable.indexOfColumn(oYearCol);

            // Se inserta la columna de ejercicios anteriores expandida antes de los meses si procede.
            let iOffset = 0;
            if (bShowEjecutado) {
                oTable.insertColumn(this._buildEjecutadosColumn(true, sYear), colIndex + iOffset);
                iOffset++;
            }

            // Se itera sobre los meses del año para crear una columna por cada uno.
            for (let i = iStartIdx; i < 12; i++) {
                const sMonthLabel = aMonthNames[i];
                const iRealIdx = i;

                // Se determina si el mes pertenece al pasado respecto a la fecha de referencia efectiva.
                const bIsPassedMonth = (sYear < currentYear) || (sYear === currentYear && i < currentMonth);

                let oControlTemplate;

                if (bShowEjecutado && bIsPassedMonth) {

                    // Se construye la clave de enlace con formato de tres digitos igual que los meses normales.
                    const sValKey = "Val0" + ((i + 1).toString().length === 1
                        ? "0" + (i + 1)
                        : (i + 1).toString()
                    ) + subFijoYear;

        
                    const oInput = new zindirect_costs.control.DecimalesInput({
                        width: "100%",
                        decimalNumbers: "{dashboardModel>/decimales}",
                        value: {
                            parts: [
                                this.tableModelName + ">" + sValKey,
                                "dashboardModel>/decimales"
                            ],
                            formatter: this.formatDecimales.bind(this)
                        },
                        textAlign: "Center",
                        editable: false,
                        enabled: "{modeloBloqueo>/isBlocked}",
                    }).data("monthIdx", i)
                        .data("monthYear", sYear)
                        .addStyleClass("customYearInput sapUiSizeCompact");

                    oControlTemplate = new sap.m.HBox({
                        renderType: "Bare",
                        justifyContent: "Center",
                        alignItems: "Center",
                        visible: true,
                        items: [oInput]
                    }).addStyleClass("sapUiTinyMarginBegin sapUiTinyMarginEnd");



                } else {
                    oControlTemplate = (function (iIdx, iYr) {

                        // Se construye la clave de binding del mes para el input editable.
                        const sValKey = "Val0" + ((iIdx + 1).toString().length === 1
                            ? "0" + (iIdx + 1)
                            : (iIdx + 1).toString()
                        ) + subFijoYear;

                    
                        const oInput = new zindirect_costs.control.DecimalesInput({
                            width: "100%",
                            decimalNumbers: "{dashboardModel>/decimales}",
                            value: {
                                parts: [
                                    this.tableModelName + ">" + sValKey,
                                    "dashboardModel>/decimales"
                                ],
                                formatter: this.formatDecimales.bind(this)
                            },
                            textAlign: "Center",
                            editable: {
                                parts: [
                                    { path: this.tableModelName + ">Tipo" },
                                    { path: this.tableModelName + ">__isHeader" },
                                    { path: this.tableModelName + ">PhPspnr" },
                                    { path: this.tableModelName + ">isNew" },
                                    { path: this.tableModelName + ">isLevel3" }
                                ],
                                formatter: function (sTipo, bIsHeader, sPhPspnr, bIsNew, bIsLevel3) {
                                    //   La fila gris de cabecera de los bloques custom (__isHeader)
                                    // no debe permitir escritura en las celdas de mes/año aunque
                                    // su campo Tipo no sea OEO. La fila raiz OEO (PhPspnr === "D")
                                    // tampoco debe ser editable en ninguna celda de mes.
                                    // (INICIO) Bloqueo de fila Desglose nivel 3 sin registrar.
                                    if (bIsNew === true && bIsLevel3 === true) {
                                        return false;
                                    }
                                    // (FIN)
                                    return bIsHeader !== true && sTipo !== "OEO" && sPhPspnr !== "D";
                                }
                            },
                            //   Mismo patron que el resto de inputs del proyecto: el input solo
                            // queda habilitado cuando la pestaña esta en estado "blocked"
                            // (modeloBloqueo>/isBlocked === true en convencion del proyecto).
                            enabled: "{modeloBloqueo>/isBlocked}",
                       
                            change: this.onMonthInputChange.bind(this)
                        })
                            .data("monthIdx", iIdx)
                            .data("monthYear", iYr)
                            .addStyleClass("customYearInput sapUiSizeCompact");

                        return new sap.m.HBox({
                            renderType: "Bare",
                            justifyContent: "Center",
                            alignItems: "Center",
                            visible: true, //   
                            items: [oInput]
                        }).addStyleClass("sapUiTinyMarginBegin sapUiTinyMarginEnd");

                    }.bind(this))(iRealIdx, sYear);
                }

                // Se construyen las rutas de binding para el sticky header del mes actual.
                const sParentPath = "ui>/stickyHeaderData/parent/m" + sYear + "_" + iRealIdx;
                const sChildPath = "ui>/stickyHeaderData/child/m" + sYear + "_" + iRealIdx;

                // Se genera el título de la columna: el primer mes incluye el botón de cierre del año.
                const oTitleControl = (i === iStartIdx) ? new sap.m.HBox({
                    alignItems: "Center",
                    justifyContent: "Center",
                    renderType: "Bare",
                    width: "100%",
                    items: [
                        new sap.m.Label({ text: sMonthLabel + " " + sYear, design: "Bold", textAlign: "Center" }).addStyleClass("testBold titleGrande"),
                        new sap.m.Button({
                            type: "Transparent",
                            icon: "sap-icon://slim-arrow-right",
                            press: function (oEv) { this.onCreateMonthsTable(oEv); }.bind(this)
                        }).data("year", String(sYear)).addStyleClass("iconOnlyBtn lineHeightArrowIcon")
                    ]
                }).addStyleClass("monthHeaderHBox") : new sap.m.Label({
                    text: sMonthLabel + " " + sYear, design: "Bold", textAlign: "Center", width: "100%"
                }).addStyleClass("testBold titleGrande");

                // Se ensambla la etiqueta completa de la columna incluyendo sticky parent y sticky child.
                const oColLabel = new sap.m.VBox({
                    width: "100%",
                    items: [
                        oTitleControl,
                        new sap.m.VBox({
                            renderType: "Bare", width: "100%", visible: "{ui>/showStickyParent}", height: "27px",
                            items: [new sap.m.Text({
                                text: { path: sParentPath, formatter: function (v) { return v || "\u00a0"; } },
                                wrapping: false, width: "100%", textAlign: "Center"
                            })]
                        }).addStyleClass("parentHeaderBox"),
                        new sap.m.VBox({
                            width: "100%", visible: "{ui>/showStickyChild}",
                            items: [new sap.m.Text({
                                text: { path: sChildPath, formatter: function (v) { return v || "\u00a0"; } },
                                wrapping: false, visible: "{ui>/showStickyChild}"
                            }).addStyleClass("secondStickyText")]
                        }).addStyleClass("parentHeader" + (i === iStartIdx ? " parentHeaderFirstMonth" : ""))
                    ]
                }).addStyleClass("fullWidthHeader");

                // Se crea la columna dinamica del mes e si inserta in la posicion correcta.
                const oColumn = new sap.ui.table.Column({
                    width: "130px",
                    hAlign: "Center",
                    label: oColLabel,
                    template: oControlTemplate
                }).data("dynamicMonth", true);

                // Se marca la columna como mes pasado para que _handleEjecutado pueda eliminarla selectivamente.
                if (bShowEjecutado && bIsPassedMonth) {
                    oColumn.data("isPassedMonth", true);
                }

                // Se aplica el borde visual al ultimo mes pasado para delimitar la zona ejecutada.
                const bIsLastPassedMonth = bShowEjecutado && (
                    (sYear < currentYear && i === 11) ||
                    (sYear === currentYear && i === currentMonth - 1)
                );
                if (bIsLastPassedMonth) {
                    oColLabel.addStyleClass("borderRightLastMonth");
                    oControlTemplate.addStyleClass("borderRightLastMonth");
                }

                // Se almacena el indice del mes y el año en la columna para recuperar anchos guardados.
                oColumn.data("monthIdx", i);
                oColumn.data("year", sYear);

                // Se aplica el ancho guardado previamente para esta columna si existe.
                const sColKey = "month_" + sYear + "_" + i;
                if (this._savedColWidths && this._savedColWidths[sColKey]) {
                    oColumn.setWidth(this._savedColWidths[sColKey]);
                }

                oTable.insertColumn(oColumn, colIndex + iOffset + (i - iStartIdx));
            }

            // Se restaura el scroll horizontal y se libera el bloqueo de la tabla tras la insercion.
            setTimeout(function () {
                try {
                    const oScrollExt = oTable._getScrollExtension();
                    if (oScrollExt && oScrollExt.getHorizontalScrollbar()) {
                        oScrollExt.getHorizontalScrollbar().scrollLeft = iCurrentScrollLeft;
                    }
                } catch (e) { }
                oTable.setBusy(false);

             
                if (typeof this._attachArrowDelegates === "function") {
                    this._attachArrowDelegates(oTable);
                }
                // Se sincroniza el panel inferior cuando esta visible para que los meses recien abiertos arriba aparezcan tambien debajo
                this._syncPanelMonthsFromMain();
            }.bind(this), 50);
        },

        // Se reconstruyen las columnas dinamicas (anyo/mes) del panel inferior a partir del estado actual de la tabla principal. Se ejecuta solo si el panel esta visible y existe contexto del proveedor activo
        _syncPanelMonthsFromMain: function () {
            const oPanelVBox = this.byId("panelVBox");
            if (!oPanelVBox || !oPanelVBox.getVisible()) return;
            const oPanelModel = this.getView().getModel("panelModel");
            if (!oPanelModel) return;
            const aRows = oPanelModel.getProperty("/rows") || [];
            const oParentRow = aRows.length > 0 ? aRows[0] : {};
            this._renderPanelYearColumns(oParentRow);
        },
        //   Se gestiona el cambio de año en el selector de ejercicio.
        //   Se recarga el modelo del backend (a1 = año seleccionado, a2 = año+1),
        //   se reconstruyen las columnas con los sufijos correctos y se abren los meses.
        onYearChange: async function (oEvent) {
            var sSelectedYear = oEvent.getParameter("selectedItem").getKey();
            var iSelectedYear = parseInt(sSelectedYear, 10);

            if (this._hasPendingChanges === true) { //   solo se guarda si hubo edicion previa
                try {
                    var oRootViewMV = this.getOwnerComponent && this.getOwnerComponent().getRootControl(); //   App view (root del Component)
                    var oAppCtrlMV = oRootViewMV && oRootViewMV.byId && oRootViewMV.byId("app"); //   sap.m.App declarado en App.view.xml
                    var oMainViewMV = oAppCtrlMV && typeof oAppCtrlMV.getCurrentPage === "function" && oAppCtrlMV.getCurrentPage(); //   view Main (pagina actual del App)
                    var oMainControllerMV = oMainViewMV && oMainViewMV.getController(); //   controller Main (con override de onSave que hace POST)
                    if (oMainControllerMV && oMainControllerMV !== this && typeof oMainControllerMV.onSave === "function") { //   defensivo: distinto al this actual y con onSave
                     
                        await oMainControllerMV.onSave(this._previousSelectedYear); //   guardado con el ejercicio anterior, no el seleccionado
                    }
                } catch (errSaveMV) { //   se captura cualquier error para no bloquear el cambio de anio
                    console.error("[onYearChange] Error al ejecutar onSave previo al cambio de anio:", errSaveMV); //   se registra en consola para diagnostico
                }
            }
            // (FIN)

            //   Se actualiza el año seleccionado en yearsModel ANTES de llamar a
            //   initTabModel para que _getSelectedEjercicio() devuelva el valor
            //   correcto y el backend reciba el ejercicio exacto en el header.
            var oYearsModel = this.getView().getModel("yearsModel");
            if (oYearsModel) {
                oYearsModel.setProperty("/selectedYear", String(iSelectedYear));
            }
            //   Se actualiza el seguimiento: a partir de aqui el ano "actual" pasa a ser el
            //   seleccionado, de modo que un proximo cambio de anio guarde con este como previo.
            this._previousSelectedYear = String(iSelectedYear);

            var sTableId = this.getCustomTableId ? this.getCustomTableId() : "TreeTableBasic";
            var oTable = this.byId(sTableId);
            if (!oTable) return;

            //   Se eliminan columnas de meses y ejecutados antes del reload para
            //   evitar columnas huérfanas con bindings obsoletos del año anterior.
            oTable.getColumns()
                .filter(function (c) { return c.data("dynamicMonth") || c.data("ejecutadosColumn"); })
                .forEach(function (c) { oTable.removeColumn(c); });
            this._openedYear = null;

            if (typeof this.initTabModel === "function") { //   defensivo: el detail puede no implementar initTabModel
                this._suppressGlobalLoading = true; //   se activa la supresion antes del reload
                try {
                    await this.initTabModel(); //   reload con dialog suprimido
                } finally {
                    this._suppressGlobalLoading = false; //   se restaura siempre, tambien si initTabModel falla
                }
            }
            // (FIN)

            //   Se calcula el último año del rango leyendo yearsModel como fuente
            //   principal, con fallback a _iYearEnd. Esto permite determinar si el
            //   año seleccionado es el último (1 columna) o no (2 columnas).
            var iYearEnd = iSelectedYear;
            if (oYearsModel) {
                var aYears = oYearsModel.getProperty("/years") || [];
                if (aYears.length > 0) {
                    var iLastFromModel = parseInt(aYears[aYears.length - 1].year, 10);
                    if (!isNaN(iLastFromModel)) iYearEnd = iLastFromModel;
                }
            }
            if (this._iYearEnd) {
                iYearEnd = this._iYearEnd;
            }

            //   Se determina cuántas columnas mostrar:
            //   - Último año del rango → 1 columna (solo a1, no existe a2)
            //   - Cualquier otro año   → 2 columnas (a1 = seleccionado, a2 = siguiente)
            var bIsLastYear = iSelectedYear >= iYearEnd;
            var iHowMany = bIsLastYear ? 1 : 2;

            //   Se reconstruyen las columnas de año con los sufijos correctos.
            //   createYearColumns asigna a1 al primer año e a2 al segundo,
            //   que coincide exactamente con el mapeo Gjahr1/Gjahr2 del backend.
            //   Nunca se crean columnas con sufijo a3 o a4.
            this.createYearColumns(iSelectedYear, iHowMany, sTableId);

            //   Se busca la columna dinámica del año seleccionado (siempre a1)
            //   para abrir su desglose mensual.
            var oYearCol = oTable.getColumns().find(function (oCol) {
                return oCol.data("dynamicYear") === true &&
                    parseInt(oCol.data("year"), 10) === iSelectedYear &&
                    !oCol.data("ejecutadosColumn");
            });

            if (!oYearCol) {

                return;
            }

            //   Se abren los meses con a1 como sufijo porque el backend mapea
            //   siempre el ejercicio seleccionado en Gjahr1 → a1.
            this.onCreateMonthsTable({
                getSource: function () {
                    return {
                        getMetadata: function () {
                            return { getName: function () { return "sap.m.Button"; } };
                        },
                        getText: function () { return String(iSelectedYear); },
                        data: function (sKey) {
                            if (sKey === "subFijoYear") return "a1";
                            if (sKey === "year") return String(iSelectedYear);
                            return null;
                        }
                    };
                }
            });
        },

      
        _findControlGlobally: function (sId) {
            // Se comprueba primero si el control existe en la vista activa para evitar
            // una busqueda global innecesaria en el caso mas comun.
            var oLocal = this.byId(sId);
            if (oLocal) return oLocal;

            // Se recorren todos los elementos registrados en el nucleo de SAPUI5 buscando
            // aquel cuyo identificador coincida exactamente o termine con el sufijo indicado.
            var mElements = sap.ui.getCore().mElements || {};
            var aKeys = Object.keys(mElements);
            for (var i = 0; i < aKeys.length; i++) {
                var sKey = aKeys[i];
                if (sKey === sId || sKey.endsWith("--" + sId)) {
                    return mElements[sKey];
                }
            }
            return null;
        },

        /**
         * Se ejecuta al interactuar con la casilla de verificacion de registros ejecutados.
         * Se marca la variante activa como modificada para habilitar el guardado directo
         * antes de delegar la logica de columnas al manejador interno correspondiente.
         */
     onEjecutadoCheckBoxSelect: function (oEvent) {
            this._markVariantDirty();
            this._handleEjecutado(oEvent.getParameter("selected"));
            setTimeout(function () {
                var oTable = this.getControlTable();
                if (oTable) {
                    this._highlightSinProveedor(oTable);
                    this._applyBlockBorder(oTable);
                }
  
                if (typeof this.colorRows === "function") {
                    this.colorRows();
                }
                //   
            }.bind(this), 300);
        },

        /**
         * Se procesa la visualización u ocultación de la columna de elementos ejecutados históricos.
         * Esta función reescribe la estructura de las columnas en función de si hay un nivel mensual abierto o no.
         */
        _handleEjecutado: function (bSelected) {
            // Se almacena el estado global de la seleccion para que futuras expansiones de años sepan si deben incluir historicos.
            this._bEjecutadoSelected = bSelected;

            // Se recupera la instancia de la TreeTable principal.
            const oTable = this.getControlTable();
            if (!oTable) return;

            // CASO 1: EL USUARIO DESMARCA LA CASILLA (OCULTAR EJECUTADOS)
            if (!bSelected) {
                //     Se eliminan unicamente la columna de ejercicios anteriores y las columnas de meses
                //     pasados, identificadas por su marca isPassedMonth. Los meses actuales y futuros
                //     permanecen visibles. El codigo anterior eliminaba todos los meses dinamicos
                //     lo que provocaba que al desmarcar se cerraran tambien los meses en curso.
                oTable.getColumns()
                    .filter(function (c) { return c.data("isPassedMonth") || c.data("ejecutadosColumn"); })
                    .forEach(function (c) { oTable.removeColumn(c); });

                //     Se conserva _openedYear para que los meses actuales/futuros sigan visibles.
                return;
            }

            // CASO 2: EL USUARIO MARCA LA CASILLA Y YA HABIA UN AÑO DESPLEGADO EN MESES
            if (this._openedYear) {
                const sYear = this._openedYear;

                // Se eliminan los meses actuales de la pantalla para forzar un repintado limpio que incluya la nueva columna de historicos mensuales.
                oTable.getColumns()
                    .filter(function (c) { return c.data("dynamicMonth"); })
                    .forEach(function (c) { oTable.removeColumn(c); });

                // Se busca la columna padre del año que estaba abierto para saber donde volver a insertar los meses.
                const oYearCol = oTable.getColumns().find(function (c) {
                    return this._getColumnLabelText(c) === String(sYear);
                }, this);

                // Si se encontro la columna de ese año se relanza la funcion creadora de meses simulando que el usuario hizo clic en ella.
                if (oYearCol) {
                    const sSubFijo = oYearCol.data("subFijoYear");
                    this.onCreateMonthsTable({
                        getSource: function () {
                            return {
                                getMetadata: function () {
                                    return { getName: function () { return "sap.m.Label"; } };
                                },
                                getText: function () { return String(sYear); },
                                data: function (sKey) {
                                    if (sKey === "subFijoYear") return sSubFijo;
                                    if (sKey === "year") return String(sYear);
                                    return null;
                                }
                            };
                        }
                    });
                }
            }
            // CASO 3: EL USUARIO MARCA LA CASILLA PERO LA TABLA ESTA EN VISTA ANUAL (NINGUN MES EXPANDIDO)
            else {
                // Se barren y eliminan columnas de ejecutados residuales.
                oTable.getColumns()
                    .filter(function (c) { return c.data("ejecutadosColumn"); })
                    .forEach(function (c) { oTable.removeColumn(c); });

                // Se busca la posicion de la primera columna anual dinamica.
                let iInsertIndex = oTable.getColumns().findIndex(function (c) {
                    return c.data("dynamicYear") === true;
                });

                if (iInsertIndex === -1) iInsertIndex = oTable.getColumns().length;

                // Se inserta la columna consolidada anual de historicos en la posicion calculada.
                oTable.insertColumn(this._buildEjecutadosColumn(false, new Date().getFullYear()), iInsertIndex);

                // Se fuerza la apertura del primer año visible.
                const oPrimerAnioCol = oTable.getColumns().find(function (c) {
                    return c.data("dynamicYear") === true && !c.data("ejecutadosColumn");
                });

                if (oPrimerAnioCol) {
                    const sSubFijoPrimero = oPrimerAnioCol.data("subFijoYear");
                    const sYearPrimero = oPrimerAnioCol.data("year");

                    this.onCreateMonthsTable({
                        getSource: function () {
                            return {
                                getMetadata: function () {
                                    return { getName: function () { return "sap.m.Button"; } };
                                },
                                getText: function () { return String(sYearPrimero); },
                                data: function (sKey) {
                                    if (sKey === "subFijoYear") return sSubFijoPrimero;
                                    if (sKey === "year") return String(sYearPrimero);
                                    return null;
                                }
                            };
                        }
                    });
                }
            }
        },


        /**
         * Se gestiona la lógica de las cabeceras pegajosas (sticky) durante el desplazamiento vertical de la tabla.
         */
        _onScrollLike: function (oEvent) {
            // Se evalúa si el sistema debe ignorar este evento de scroll por tratarse de un scroll programático de ajuste interno.
            if (this._ignoreNextScroll) {
                this._ignoreNextScroll = false;
                return;
            }

            const oTable = this.getControlTable();
            const oUiModel = this.getView().getModel("ui");

            // Si la tabla no tiene datos o rangos de grupos procesados, se aborta la lógica de cabeceras flotantes.
            if (!this._aGroupRanges || !this._aGroupRanges.length) {
                oUiModel.setProperty("/showStickyParent", false);
                this._setStickyChild(false);
                return;
            }

            // Se identifican los límites de la porción visible de la tabla en el DOM.
            const iFirstVisible = oEvent.getParameter("firstVisibleRow");
            const iVisibleCount = oTable.getVisibleRowCount();
            const iLastVisible = iFirstVisible + iVisibleCount - 1;

            let oActiveGroup = null;

            // Se recorren los rangos de índices caculados previamente para descubrir qué grupo jerárquico está dominando la parte superior de la tabla.
            for (let i = 0; i < this._aGroupRanges.length; i++) {
                const oGroup = this._aGroupRanges[i];
                // Si la primera fila visible está contenida dentro del inicio y fin de un grupo, ese es nuestro grupo activo.
                if (iFirstVisible >= oGroup.start && iFirstVisible <= oGroup.end) {
                    oActiveGroup = oGroup;
                    break;
                }
            }

            // Si el scroll está en un área sin agrupación definida, se ocultan todos los elementos flotantes.
            if (!oActiveGroup) {
                oUiModel.setProperty("/showStickyParent", false);
                oUiModel.setProperty("/showStickyChild", false);
                return;
            }

            // Se establecen los índices teóricos de dónde deberían estar el padre (agrupador) y su primer hijo en la jerarquía.
            const iParentRow = oActiveGroup.start;
            const iChildRow = oActiveGroup.start + 1;

            // Se evalúa si la fila original del padre o del hijo aún están pintándose en pantalla de manera natural.
            const bParentVisible = iParentRow >= iFirstVisible && iParentRow <= iLastVisible;
            const bChildVisible = iChildRow >= iFirstVisible && iChildRow <= iLastVisible;

            // Si el Padre Original se oculta por el scroll superior (!bParentVisible), se enciende la cabecera flotante simulada para reemplazarlo visualmente.
            oUiModel.setProperty("/showStickyParent", !bParentVisible);
            // La misma regla aplica para el hijo: solo se enciende su versión flotante si él y su padre ya desaparecieron del viewport superior.
            this._setStickyChild(!bChildVisible && !bParentVisible);

            // Se inyectan los datos reales del grupo activo en el modelo UI para que las cabeceras flotantes los muestren mediante Data Binding.
            oUiModel.setProperty("/stickyHeaderData", {
                parent: oActiveGroup.data,
                child: oActiveGroup.data.categories[0],
                path: oActiveGroup.path
            });

            // Se reevalúan los colores de la tabla ya que las cabeceras flotantes pueden alterar la percepción visual del diseño.
            this._applyCabeceraStyle();
        },

        /**
         * Se analiza el modelo de la tabla para definir los rangos de índices de cada grupo de datos.
         * Esto es vital para saber en qué momento encender o apagar las cabeceras flotantes durante el scroll.
         */
        _buildGroupRanges: function (sTableId) {
            const oTable = this.getControlTable();

            // Si la tabla no está lista, se vacía la matriz de rangos de forma preventiva.
            if (!oTable) {
                this._aGroupRanges = [];
                return;
            }

            // Se extrae la longitud total de las filas atadas a la tabla.
            const oBinding = oTable.getBinding("rows");
            const iLength = oBinding.getLength();
            const aRanges = [];
            let oCurrentGroup = null;

            // Se realiza un escaneo completo, fila por fila.
            for (let i = 0; i < iLength; i++) {
                const oCtx = oTable.getContextByIndex(i);
                if (!oCtx) continue;

                const oObj = oCtx.getObject();

                // Se determina el inicio de un nuevo grupo basándose en la existencia de un nodo con array de categorías (subelementos).
                if (oObj && oObj.categories && Array.isArray(oObj.categories)) {
                    // Si ya se estaba procesando un grupo, se cierra indicando que su rango finaliza justo antes de esta nueva fila.
                    if (oCurrentGroup) {
                        oCurrentGroup.end = i - 1;
                        aRanges.push(oCurrentGroup);
                    }
                    // Se inaugura un nuevo objeto de seguimiento de grupo con su índice de inicio.
                    oCurrentGroup = { name: oObj.name, start: i, end: i, data: oObj, path: oCtx.getPath() };
                }
            }

            // Al finalizar el bucle, se cierra el último grupo detectado otorgándole el final de la tabla como su límite.
            if (oCurrentGroup) {
                oCurrentGroup.end = iLength - 1;
                aRanges.push(oCurrentGroup);
            }

            // Se consolidan los rangos analizados en la variable de la clase.
            this._aGroupRanges = aRanges;
        },

        /**
          * Se filtran las categorías recursivamente según una clave específica.
          * Esta función permite buscar un nodo en el árbol y mantener toda su ascendencia y descendencia visible.
          */
        _filterCategories: function (aCategories, sKey) {
            // Se valida que la entrada sea un arreglo válido; de lo contrario, se retorna un arreglo vacío para evitar errores de iteración.
            if (!Array.isArray(aCategories)) return [];

            // Se itera sobre todas las categorías del nivel actual.
            return aCategories.map(function (cat) {
                // Se genera un clon superficial del nodo actual para no mutar el modelo original de datos.
                const oClone = Object.assign({}, cat);
                // Se realiza una llamada recursiva para buscar coincidencias en los niveles inferiores (hijos).
                const aFilteredChildren = this._filterCategories(cat.categories || [], sKey);

                // Se evalúa la coincidencia directa: si el nombre de la categoría actual coincide con la clave buscada.
                if (cat.name === sKey) {
                    // Se conservan todos sus hijos originales, ya que el nodo completo debe mostrarse.
                    oClone.categories = cat.categories || [];
                    return oClone;
                }

                // Se evalúa la coincidencia indirecta: si la categoría actual no coincide, pero tiene hijos que sí lo hacen.
                if (aFilteredChildren.length > 0) {
                    // Se reemplaza la lista de hijos con únicamente aquellos que cumplieron el criterio de búsqueda.
                    oClone.categories = aFilteredChildren;
                    return oClone;
                }

                // Si ni el nodo ni sus hijos coinciden, se retorna nulo para descartarlo.
                return null;
            }.bind(this)).filter(Boolean); // Se filtran y eliminan todos los valores nulos resultantes del map.
        },

        /**
         * Se colapsa un grupo desde la cabecera sticky, actualizando la vista de la tabla.
         * Permite al usuario cerrar un agrupador haciendo clic en la cabecera flotante.
         */
        onCollapseFromHeader: function () {
            const oTable = this.getControlTable();
            const oUiModel = this.getView().getModel("ui");
            // Se recupera la ruta del modelo (path) correspondiente al grupo que está actualmente anclado en la cabecera sticky.
            const sTargetPath = oUiModel.getProperty("/stickyHeaderData/path");

            // Si no hay una ruta válida fijada, se interrumpe la ejecución.
            if (!sTargetPath) {
                return;
            }

            const oBinding = oTable.getBinding("rows");
            const iLength = oBinding.getLength();
            let iCollapsedIndex = null;

            // Se busca la fila exacta dentro de la tabla que corresponde a la ruta del grupo.
            for (let i = 0; i < iLength; i++) {
                const oCtx = oTable.getContextByIndex(i);
                if (oCtx && oCtx.getPath() === sTargetPath) {
                    // Si el grupo está expandido, se procede a colapsarlo.
                    if (oTable.isExpanded(i)) {
                        oTable.collapse(i);
                        iCollapsedIndex = i; // Se guarda el índice para validaciones posteriores.
                    }
                    break;
                }
            }

            // Si no se colapsó nada (por ejemplo, ya estaba cerrado o no se encontró), se aborta.
            if (iCollapsedIndex === null) {
                return;
            }

            // Se utiliza setTimeout para permitir que el motor de renderizado de SAPUI5 procese el colapso antes de recalcular la interfaz.
            setTimeout(function () {
                // Se reconstruyen los rangos de los grupos jerárquicos ya que la topología de la tabla ha cambiado.
                this._buildGroupRanges();
                const iFirstVisible = oTable.getFirstVisibleRow();

                // Se fuerza la actualización de la lógica de cabeceras flotantes (sticky headers) simulando un evento de scroll en la posición actual.
                this._onScrollLike({
                    getParameter: function (sName) {
                        if (sName === "firstVisibleRow") {
                            return iFirstVisible;
                        }
                    }
                });

                let bAnyDetailExpanded = false;
                const oUpdatedBinding = oTable.getBinding("rows");

                // Se verifica si, tras colapsar el nodo, queda algún otro nivel de detalle expandido en toda la tabla.
                if (oUpdatedBinding) {
                    const iUpdatedLength = oUpdatedBinding.getLength();
                    for (let i = 0; i < iUpdatedLength; i++) {
                        if (oTable.isExpanded(i)) {
                            const oCtx = oTable.getContextByIndex(i);
                            const oObj = oCtx && oCtx.getObject();

                            // Si se encuentra al menos un agrupador de detalle abierto, se activa la bandera y se detiene la búsqueda.
                            if (oObj && oObj.categories && oObj.categories[0] && oObj.categories[0].isGroup === true) {
                                bAnyDetailExpanded = true;
                                break;
                            }
                        }
                    }
                }

                // Se obtienen las referencias a las columnas dinámicas.
                const oColMonths = this.byId("colMonths");
                const oColNew = this.byId("colNew");
                const oColCheck1 = this.byId("colCheckBox1");
                const oColCheck2 = this.byId("colCheckBox2");

                // Se ajusta la visibilidad de las columnas accesorias en función de si hay detalles expandidos.
                if (oColMonths) oColMonths.setVisible(bAnyDetailExpanded);
                if (oColNew) oColNew.setVisible(bAnyDetailExpanded);
                if (oColCheck1) oColCheck1.setVisible(bAnyDetailExpanded);
                if (oColCheck2) oColCheck2.setVisible(bAnyDetailExpanded);

                // Si no queda absolutamente nada expandido, se limpia por completo el estado de las cabeceras sticky y los grupos.
                if (!bAnyDetailExpanded) {
                    this._aGroupRanges = [];
                    oUiModel.setProperty("/showStickyAgrupador", false);
                    oUiModel.setProperty("/showStickyParent", false);
                    this._setStickyChild(false);
                }

                // Si ambas cabeceras sticky (padre e hijo) están ocultas, se purgan sus datos del modelo visual para evitar renderizados fantasmas.
                if (!oUiModel.getProperty("/showStickyParent") && !oUiModel.getProperty("/showStickyChild")) {
                    oUiModel.setProperty("/stickyHeaderData", null);
                }
            }.bind(this), 0);
        },
        /*
      * Las vistas hijas ya no necesitan sobrescribir este método.
      */
        getCustomTableId: function () {
            return this._variantConfig ? this._variantConfig.tableId : "";
        },

        /*
            * Localiza la tabla por el id almacenado en la configuración de variante.
            */
        getControlTable: function () {
            var sId = this.getCustomTableId();
            return sId ? this.byId(sId) : null;
        },

       
        _getColumnLabelText: function (oCol) {
            var oLabel = oCol && typeof oCol.getLabel === "function" ? oCol.getLabel() : null;
            if (!oLabel) {
                return "";
            }
            if (typeof oLabel.getText === "function") {
                return oLabel.getText() || "";
            }
            if (typeof oLabel.getItems === "function") {
                var aItems = oLabel.getItems();
                for (var i = 0; i < aItems.length; i++) {
                    if (aItems[i] && typeof aItems[i].getText === "function") {
                        return aItems[i].getText() || "";
                    }
                }
            }
            return "";
        },

        onToggleExpandCollapseAll: function (oEvent) {
            var oTable = this.getControlTable();
            if (!oTable) {
                return;
            }
            var oButton = oEvent && oEvent.getSource ? oEvent.getSource() : null;

            //   Se alterna el estado guardado en el propio controlador.
            this._bAllExpanded = !this._bAllExpanded;

            if (this._bAllExpanded) {
                if (typeof oTable.expandToLevel === "function") {
                    oTable.expandToLevel(99);
                }
                //   Pasada adicional para los desgloses custom de expansión diferida.
                if (typeof this._expandAllCustomNodes === "function") {
                    this._expandAllCustomNodes(oTable);
                }
                if (oButton) {
                    oButton.setIcon("sap-icon://collapse-group");
                    oButton.setTooltip(this.getTranslatedText("colapsarTodo"));
                }
            } else {
                if (typeof oTable.collapseAll === "function") {
                    oTable.collapseAll();
                }
                if (oButton) {
                    oButton.setIcon("sap-icon://expand-group");
                    oButton.setTooltip(this.getTranslatedText("expandirTodo"));
                }
            }

            //   Se reaplican los estilos de fila tras el cambio de expansión.
            setTimeout(function () {
                if (typeof this.colorRows === "function") {
                    this.colorRows();
                }
                if (typeof this._highlightSinProveedor === "function") {
                    this._highlightSinProveedor(oTable);
                }
                if (typeof this._applyBlockBorder === "function") {
                    this._applyBlockBorder(oTable);
                }
             
                if (typeof this._updateCustomColsVisibility === "function") {
                    this._updateCustomColsVisibility();
                }
            }.bind(this), 80);
        },

     
        setupDynamicTreeTable: function (sTableId) {
            // Se localiza la tabla ya sea por el ID proporcionado o mediante el método de obtención predeterminado.
            const oTable = sTableId ? this.byId(sTableId) : this.getControlTable();
            if (!oTable) {
                return; // Se aborta si la tabla no existe en la vista.
            }

            // Se adjunta el evento que detecta cuando el usuario hace scroll vertical.
            if (!this._debouncedHighlight) {
                this._debouncedHighlight = this._debounce(function () {
                    this._highlightSinProveedor(oTable);
                    this._applyBlockBorder(oTable);
                }, 80);
            }

            oTable.attachFirstVisibleRowChanged(function (oEvent) {
                this._onScrollLike(oEvent);
                this._attachArrowDelegates(oTable);
                this._debouncedHighlight();
            }.bind(this));

            //    Se añade listener para recalcular filas cuando la tabla se renderiza
            if (!oTable._rowsUpdatedAttachedForResize) {
                oTable.attachEvent("rowsUpdated", function () {
                    // Se ejecuta el cálculo solo después del primer renderizado completo
                    if (!this._initialRowCalculationDone) {
                        setTimeout(function () {
                            this._calculateDynamicRows();
                            this._initialRowCalculationDone = true;
                        }.bind(this), 100);
                    }
                }.bind(this));
                oTable._rowsUpdatedAttachedForResize = true;
            }
     
            if (!oTable._chapterLevel0Attached) { 
          
                var that = this; 
                var bPaintScheduled = false;
                var fnPaintThrottled = function () {
                    if (bPaintScheduled) return; 
                    bPaintScheduled = true;
                    window.requestAnimationFrame(function () {
                        bPaintScheduled = false;
                        that._paintChapterLevel0(sTableId);
                    });
                };
                oTable.attachEvent("rowsUpdated", fnPaintThrottled);
                oTable.attachEvent("firstVisibleRowChanged", fnPaintThrottled);
                   
                //   Disparo inicial diferido para cubrir el caso en que rowsUpdated 
                //   se haya emitido antes de este attach. 
                setTimeout(function () { this._paintChapterLevel0(sTableId); }.bind(this), 500); // 
                var fnSetupObserver = function () { // 
                    var oDomRoot = oTable.getDomRef(); // 
                    if (!oDomRoot) return; // 
     
                    if (oTable._chapterLevel0Observer) { // 
                        oTable._chapterLevel0Observer.disconnect(); // 
                        oTable._chapterLevel0Observer = null; // 
                    } // 
                    var oObs = new MutationObserver(function () { // 
                        //   Throttle: si ya hay un repaint pendiente, no encolamos otro 
                        if (oTable._chapterLevel0Pending) return; // 
                        oTable._chapterLevel0Pending = true; // 
                        setTimeout(function () { // 
                            oTable._chapterLevel0Pending = false; // 
                            this._paintChapterLevel0(sTableId); // 
                        }.bind(this), 50); // 
                    }.bind(this)); // 
                    oObs.observe(oDomRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] }); // 
                    oTable._chapterLevel0Observer = oObs; // 
                    //   Repaint inmediato tras (re)conectar el observer para 
                    //   garantizar el restablecimiento del naranja/negro en el 
                    //   primer frame de la vista recien mostrada, sin esperar 
                    //   al primer rowsUpdated. 
                    this._paintChapterLevel0(sTableId); // 
                }.bind(this); // 
                //   El DOM puede no existir aun en este punto: se intenta ya y se 
                //   reintenta tras el primer render con onAfterRendering. 
                fnSetupObserver(); // 
                oTable.addEventDelegate({ onAfterRendering: fnSetupObserver }); // 

                var fnZoomRepaint = function () { 
                    if (oTable._chapterLevel0ZoomTimer) {  
                        clearTimeout(oTable._chapterLevel0ZoomTimer); 
                    } // 
                    oTable._chapterLevel0ZoomTimer = setTimeout(function () {  
                        oTable._chapterLevel0ZoomTimer = null; 
                        this._paintChapterLevel0(sTableId);  
                    }.bind(this), 120); // 
                }.bind(this); // 
                window.addEventListener("resize", fnZoomRepaint);  
                oTable._chapterLevel0Attached = true; 
            } 

            //    Se añaden las columnas exclusivas de filas custom al array
            // de ocultación inicial para que no aparezcan vacías al cargar la vista.
            const aColsToHide = [
                "colMonths", "colNew", "colCheckBox1", "colCheckBox2",
                "colProveedor", "colTarifa", "colFechaInicio",
                "colFechaFin", "colNMeses", "colOtros"
            ];
            aColsToHide.forEach(function (colId) {
                if (this.byId(colId)) this.byId(colId).setVisible(false);
            }.bind(this));

            if (!this._arrowDelegate) {
                this._arrowDelegate = {
                    onkeydown: function (oEvent) {
                        this._onInputKeyDown(oEvent);
                    }.bind(this),
                };
            }

            // Se asignan los delegados visuales (colores y teclado) justo después de que la tabla se renderiza por primera vez.
            oTable.addEventDelegate({
                onAfterRendering: function () {
                    // Se seleccionan TODOS los inputs del DOM de la tabla
                    var oDomRef = oTable.getDomRef();
                    if (!oDomRef) return;

                    var aInputs = oDomRef.querySelectorAll("input");
                    aInputs.forEach(function (oInputDom) {
                        // Se evita registrar el mismo listener dos veces
                        if (oInputDom._letterBlockAttached) return;
                        oInputDom._letterBlockAttached = true;

                        oInputDom.addEventListener("keydown", function (oNativeEvent) {
                            // Se permite todo si el input tiene la clase allowLetters
                            if (oInputDom.classList.contains("allowLetters")) return;

                            // Se busca si algún ancestro tiene la clase allowLetters
                            // (por si el input está dentro de un wrapper con esa clase)
                            var oParent = oInputDom.parentElement;
                            var bAllow = false;
                            while (oParent) {
                                if (oParent.classList && oParent.classList.contains("allowLetters")) {
                                    bAllow = true;
                                    break;
                                }
                                oParent = oParent.parentElement;
                            }
                            if (bAllow) return;

                            // Se bloquea la tecla si es una letra
                            var sKey = oNativeEvent.key;
                            if (sKey && sKey.length === 1 && /[a-zA-Z]/.test(sKey)) {
                                oNativeEvent.preventDefault();
                                oNativeEvent.stopImmediatePropagation();
                            }
                        });
                    });
                }.bind(this)
            });

            if (!oTable._rowsDelegateAttached) {

                var thatRD = this;
                var bScrollPaintScheduled = false;
                oTable.attachEvent("rowsUpdated", function () {
                    if (bScrollPaintScheduled) return;
                    bScrollPaintScheduled = true;
                    window.requestAnimationFrame(function () {
                        bScrollPaintScheduled = false;
                        thatRD._attachArrowDelegates(oTable);
                        thatRD._applyCabeceraStyle();
                        thatRD._capScrollbarOvershoot(oTable);
                    });
                });
                //
                oTable._rowsDelegateAttached = true;
            }

            // (INICIO MV) Lazy-attach defensivo: cuando un input toma foco, si por algun motivo no tiene el arrow delegate (caso de filas nuevas creadas tras expansion de desglose o rerenders rapidos donde el rAF queda saltado por el flag `bScrollPaintScheduled`), se le attacha al vuelo. Asi no se queda jamas un input sin navegacion con flechas. Idempotente: `addEventDelegate` precedido por `removeEventDelegate` evita duplicados. (FIN MV)
            if (!oTable._arrowLazyFocusAttached) {
                // (INICIO MV) Listener en `document` en lugar de en el DOM de la tabla: el DOM de la tabla se vacia/recrea en cada re-render, perdiendo el listener. document es persistente y captura focusin gracias a la fase de captura. Se filtra por contencion dentro del DOM CURRENT de la tabla. (FIN MV)
                document.addEventListener("focusin", function (oNativeEvt) {
                    const oCurrentTableDom = oTable.getDomRef();
                    if (!oCurrentTableDom || !oNativeEvt.target || !oCurrentTableDom.contains(oNativeEvt.target)) return;
                        const oTargetDom = oNativeEvt.target;
                        if (!oTargetDom || !oTargetDom.id) return;
                        // (INICIO MV) Intercept para suprimir el flash visual del indicador de celda nativo del TreeTable: si el foco aterriza en `...rows-rowN-colM` (cell container nativo) buscamos el input editable dentro de esa celda y redirigimos el foco hacia el. Se ejecuta SIEMPRE (no solo durante `_navInFlight`) porque tambien en el path sin scroll el handler nativo de sap.ui.table puede mover el foco a la celda contenedor entre nuestros eventos. (FIN MV)
                        const mCell = oTargetDom.id.match(/-rows-row(\d+)-col(\d+)$/);
                        if (mCell) {
                            const iVisRow = parseInt(mCell[1], 10);
                            const iVisCol = parseInt(mCell[2], 10);
                            const aRowsCells = oTable.getRows();
                            if (iVisRow >= 0 && iVisRow < aRowsCells.length) {
                                const oRowR = aRowsCells[iVisRow];
                                const aCellsR = oRowR.getCells();
                                // El index de columna en cell container DOM ID es 0-based incluyendo fixed; getCells() esta alineado pero hay que probar el indice del DOM.
                                const oCellR = aCellsR[iVisCol] || aCellsR[iVisCol + 2]; // fallback por offset de fixed columns
                                if (oCellR) {
                                    const oInputR = thatRD._recursiveGetInput(oCellR);
                                    if (oInputR && oInputR.getFocusDomRef) {
                                        const oDomR = oInputR.getFocusDomRef();
                                        if (oDomR && oDomR !== oTargetDom) {
                                            oDomR.focus();
                                            return;
                                        }
                                    }
                                }
                            }
                        }
                        const sFocusId = oTargetDom.id.replace(/-inner$/, "");
                        const oFocusedCtrl = sap.ui.getCore().byId(sFocusId);
                        if (!oFocusedCtrl || !oFocusedCtrl.isA || !oFocusedCtrl.isA("sap.m.Input")) return;
                        if (!oFocusedCtrl.getEditable || !oFocusedCtrl.getEditable()) return;
                        // (INICIO MV) Si `_arrowDelegate` aun no existe (p.ej. `_attachArrowDelegates` no se ejecuto todavia porque `rowsUpdated` no disparo o el rAF se salto), se crea aqui mismo. Asi el lazy-attach funciona desde la primera interaccion sin depender del orden de inicializacion. (FIN MV)
                        if (!thatRD._arrowDelegate) {
                            thatRD._arrowDelegate = {
                                onkeydown: function (oEvent) {
                                    thatRD._onInputKeyDown(oEvent);
                                }
                            };
                        }
                    const aDel = oFocusedCtrl.aDelegates || [];
                    const bHas = aDel.some(function (d) { return d.oDelegate && d.oDelegate.onkeydown && d.oDelegate === thatRD._arrowDelegate; });
                    if (!bHas) {
                        oFocusedCtrl.removeEventDelegate(thatRD._arrowDelegate);
                        oFocusedCtrl.addEventDelegate(thatRD._arrowDelegate);
                    }
                }, true);
                oTable._arrowLazyFocusAttached = true;
            }

            // Se cierra el panel inferior automaticamente cuando el foco va a una fila distinta de la que abrio el panel. Asi el panel deja de mostrar datos del proveedor anterior en cuanto el usuario navega a otra fila/proveedor
            if (!oTable._panelCloseFocusDelegateAttached) {
                oTable.addEventDelegate({
                    onfocusin: function (oEvent) {
                        if (!this._sCurrentPanelRowUid) return;
                        const oTargetDom = oEvent.target;
                        if (!oTargetDom || typeof oTargetDom.closest !== "function") return;
                        const oRowDom = oTargetDom.closest("[data-sap-ui-rowindex]");
                        if (!oRowDom) return;
                        const iIndex = parseInt(oRowDom.getAttribute("data-sap-ui-rowindex"), 10);
                        if (isNaN(iIndex)) return;
                        const oBindingContext = oTable.getContextByIndex(iIndex);
                        if (!oBindingContext) return;
                        const oRowData = oBindingContext.getObject();
                        if (!oRowData || !oRowData.__uid) return;
                        if (oRowData.__uid === this._sCurrentPanelRowUid) return;
                        this.onClosePanelPress();
                    }.bind(this)
                });
                oTable._panelCloseFocusDelegateAttached = true;
            }
            // Se garantiza la existencia de un modelo de interfaz ('viewModel') para gestionar la cantidad de filas visibles.
            if (!this.getView().getModel("viewModel")) {
                const oViewModel = new sap.ui.model.json.JSONModel({
                    dynamicRowCount: 10
                });
                this.getView().setModel(oViewModel, "viewModel");
            }

            // Se calcula la altura dinámica del Splitter.
            this._calculateSplitterHeight();

            // Listener de resize de ventana registrado una sola vez.
            if (!this._windowResizeHandler) {
                this._windowResizeHandler = function () {
                    this._calculateSplitterHeight();
                }.bind(this);
                window.addEventListener("resize", this._windowResizeHandler);
            }


            if (!this._oHeaderToggleAttached) {
                var oObjectPage = this.byId("objectPageLayout");
                if (oObjectPage) {
                    //   Se usa attachEventOnce en bucle para capturar cada toggle.
                    // Como el evento se dispara cada vez que cambia el estado de la
                    // cabecera, se registra un listener permanente con attachEvent.
                    var fnRecalcAfterToggle = function () {
                        //   Se espera 400ms para que la animacion CSS del
                        // ObjectPageLayout termine antes de medir el DOM.
                        setTimeout(function () {
                            this._calculateSplitterHeight();
                        }.bind(this), 400);
                    }.bind(this);

                    //   Se intentan los dos nombres de evento conocidos del
                    // ObjectPageLayout. Si ninguno existe en esta version de UI5,
                    // se usa MutationObserver sobre el DOM como fallback robusto.
                    try {
                        oObjectPage.attachEvent("_snapHeader", fnRecalcAfterToggle);
                        oObjectPage.attachEvent("_expandHeader", fnRecalcAfterToggle);
                    } catch (e) {
                        //   Fallback: MutationObserver que detecta el cambio de
                        // clase CSS sapUxAPObjectPageLayout-header-forceSnapped que
                        // el ObjectPageLayout añade al colapsar la cabecera.
                    }

                    //   MutationObserver como mecanismo principal y de respaldo.
                    // Observa cambios de clase en el DOM del ObjectPageLayout y
                    // recalcula las dimensiones cuando detecta el snap o el expand.
                    var oObjectPageDom = oObjectPage.getDomRef
                        ? oObjectPage.getDomRef()
                        : null;

                    if (!oObjectPageDom) {
                        //   Si el DOM aun no esta disponible se espera al primer
                        // renderizado para conectar el observer.
                        oObjectPage.addEventDelegate({
                            onAfterRendering: function () {
                                if (this._oHeaderMutationObserver) return;
                                var oDom = oObjectPage.getDomRef();
                                if (!oDom) return;
                                this._connectHeaderObserver(oDom, fnRecalcAfterToggle);
                            }.bind(this)
                        });
                    } else {
                        this._connectHeaderObserver(oObjectPageDom, fnRecalcAfterToggle);
                    }

                    this._oHeaderToggleAttached = true;
                }
            }

            // Se controla el borrado de los filtros nativos de la tabla.
            if (!oTable._filterEmptyAttached) {
                oTable.attachEvent("filter", function (oEvent) {
                    // Si el usuario borra el texto de un filtro (value vacío), se previene el comportamiento nativo y se invoca la lógica manual de restauración.
                    if (!oEvent.getParameter("value")) {
                        oEvent.preventDefault();
                        this.onTreeTableFilter(oEvent);
                    }
                }.bind(this));
                oTable._filterEmptyAttached = true;
            }
            // Se registra el evento de redimensionado de columnas para conservar los anchos
            // de las columnas dinámicas generadas desde el controlador.
            if (!oTable._colResizeAttached) {
                oTable.attachColumnResize(function (oEvent) {
                    const oCol = oEvent.getParameter("column");
                    const sWidth = oEvent.getParameter("width");
                    // Se persiste el ancho únicamente para columnas dinámicas de años, meses o ejecutados.
                    if (oCol.data("dynamicYear") || oCol.data("dynamicMonth") || oCol.data("ejecutadosColumn")) {
                        if (!this._savedColWidths) this._savedColWidths = {};
                        this._savedColWidths[this._getColKey(oCol)] = sWidth;
                        this._markVariantDirty();
                    }
                }.bind(this));
                oTable._colResizeAttached = true;
            }

            // Se registran los atajos de teclado globales (Alt+Plus, Alt+Minus, Alt+S)
            // una única vez por instancia de controlador.
            this._attachKeyboardShortcuts();
        },
    
        _paintChapterLevel0: function (sTableId) { // 
            var oTable = this.byId(sTableId); // 
            if (!oTable) return; // 
            //   Se desconecta el observer durante el repintado para evitar 
            //   bucle infinito: las propias mutaciones que hacemos en class/style 
            //   dispararian otro repaint en cadena. Se reconecta al final. 
            var oObs = oTable._chapterLevel0Observer; // 
            var oDomRoot = oTable.getDomRef(); // 
            if (oObs) oObs.disconnect(); // 
            var sModelName = this.tableModelName; // 
            var sFullTableId = oTable.getId(); // 
            var aRows = oTable.getRows(); // 
  
            aRows.forEach(function (oRow, i) { // 
                //   Se intenta primero con el modelo nombrado y se cae al modelo 
                //   por defecto para evitar null context en bindings tree. 
                var oContext = (sModelName ? oRow.getBindingContext(sModelName) : null) // 
                            || oRow.getBindingContext(); // 
                var sPhPspnr = oContext ? oContext.getProperty("PhPspnr") : null; // 
                var oRowDom = oRow.getDomRef(); // 
                var oFixedRef = oTable.$().find(".sapUiTableCtrlFixed tbody tr[data-sap-ui-rowindex='" + i + "']"); // 
                var oScrollRef = oTable.$().find(".sapUiTableCtrlScroll tbody tr[data-sap-ui-rowindex='" + i + "']"); // 
                var oRowSelRef = jQuery("#" + sFullTableId + "-rowsel" + i); // 
                //   Se limpia la clase antes de re-evaluarla para que al hacer scroll 
                //   la fila pierda el destacado si deja de ser la "D". 
                if (oRowDom) oRowDom.classList.remove("rowChapterLevel0"); // 
                oFixedRef.removeClass("rowChapterLevel0"); // 
                oScrollRef.removeClass("rowChapterLevel0"); // 
                oRowSelRef.removeClass("rowChapterLevel0"); // 
              
                var fnClearInline = function () { // 
                    this.style.removeProperty("background-color"); // 
                    this.style.removeProperty("border-bottom"); // 
                }; // 
       
                oFixedRef.find("td:not(.sapUiTableCellDummy)").each(fnClearInline);  
                oScrollRef.find("td:not(.sapUiTableCellDummy)").each(fnClearInline); 
                oFixedRef.find("td:not(.sapUiTableCellDummy) > *").each(fnClearInline); 
                oScrollRef.find("td:not(.sapUiTableCellDummy) > *").each(fnClearInline); 
                oFixedRef.each(fnClearInline); // 
                oScrollRef.each(fnClearInline); // 
                if (oRowDom) fnClearInline.call(oRowDom); // 
                if (sPhPspnr === "D") { //
             
                    if (oRowDom) oRowDom.classList.add("rowChapterLevel0"); //
                    oFixedRef.addClass("rowChapterLevel0"); //
                    oScrollRef.addClass("rowChapterLevel0"); //
                    oRowSelRef.addClass("rowChapterLevel0"); //
                
                    oFixedRef.find("td:not(.sapUiTableCellDummy)").each(function () { this.style.cssText += ";border-bottom: 2px solid #f3984e !important;"; }); //
                    oScrollRef.find("td:not(.sapUiTableCellDummy)").each(function () { this.style.cssText += ";border-bottom: 2px solid #f3984e !important;"; }); //
                } //
            }); // 
         
            try { this._applyCabeceraStyle(); } catch (e) { /*  defensivo */ } // 
            //   Se reconecta el observer tras el repaint (microtick para que las 
            //   mutaciones de este repaint no entren como nuevas notificaciones). 
            if (oObs && oDomRoot) { // 
                setTimeout(function () { // 
                    oObs.observe(oDomRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] }); // 
                }, 0); // 
            } // 
        },
        
        _connectHeaderObserver: function (oDom, fnCallback) {
            if (this._oHeaderMutationObserver) return;

            this._oHeaderMutationObserver = new MutationObserver(function (aMutations) {
                var bRelevant = aMutations.some(function (oMut) {
                    return oMut.type === "attributes" && oMut.attributeName === "class";
                });
                if (bRelevant) {
                    fnCallback();
                }
            });

            //   Se observan cambios de atributo class en el elemento raiz del
            // ObjectPageLayout y en su hijo directo que contiene la cabecera,
            // ya que SAPUI5 puede añadir la clase de snap en cualquiera de los dos.
            this._oHeaderMutationObserver.observe(oDom, {
                attributes: true,
                attributeFilter: ["class"],
                subtree: false
            });

            //   Se observa tambien el primer hijo directo donde el ObjectPageLayout
            // suele colocar las clases de estado de la cabecera segun la version de UI5.
            if (oDom.firstElementChild) {
                this._oHeaderMutationObserver.observe(oDom.firstElementChild, {
                    attributes: true,
                    attributeFilter: ["class"],
                    subtree: false
                });
            }
        },

        /**
         * Se calcula dinámicamente la cantidad de filas que caben en pantalla según el tamaño de la ventana.
         * Esto evita que la tabla muestre scroll interno innecesario o deje espacios vacíos masivos al final de la vista.
         */
        _calculateDynamicRows: function () {
            const oTable = this.getControlTable();
            if (!oTable || !oTable.getDomRef()) return;

            const oDomRef = oTable.getDomRef();

            // Se toma el VBox superior del splitter como referencia
            // en lugar de la ventana entera, dado que el ObjectPageLayout
            // ya gestiona su propio espacio interno
            const oSplitterPane = oDomRef.closest(".sapUiLoSplitterContent");
            const iAvailablePaneHeight = oSplitterPane
                ? oSplitterPane.getBoundingClientRect().height
                : (window.innerHeight - oDomRef.getBoundingClientRect().top - 50);

            const oScrollContainer = oDomRef.querySelector(".sapUiTableCnt");
            let iScrollbarHeight = 0;
            if (oScrollContainer) {
                iScrollbarHeight = oScrollContainer.offsetHeight - oScrollContainer.clientHeight;
            }

            const oTableHeader = oDomRef.querySelector(".sapUiTableColHdrCnt");
            let iTableHeaderHeight = 0;
            if (oTableHeader) {
                iTableHeaderHeight = oTableHeader.offsetHeight;
            }

            const oToolbar = oDomRef.querySelector(".sapUiTableTbr");
            let iToolbarHeight = 0;
            if (oToolbar) {
                iToolbarHeight = oToolbar.offsetHeight;
            }

            const iAvailableHeight =
                iAvailablePaneHeight -
                iScrollbarHeight -
                iTableHeaderHeight -
                iToolbarHeight;

            let iRowHeight = 32;
            const oFirstRow = oDomRef.querySelector(".sapUiTableTr");
            if (oFirstRow) {
                iRowHeight = oFirstRow.offsetHeight;
            }

            let iRows = Math.floor(iAvailableHeight / iRowHeight);

            const iUsedHeight = iRows * iRowHeight;
            const iRemainingSpace = iAvailableHeight - iUsedHeight;
            const iThreshold = iRowHeight * 0.3;

            if (iRemainingSpace < iThreshold) {
                iRows = iRows - 2;
            } else {
                iRows = iRows - 1;
            }

            if (iRows < 5) iRows = 5;

            // Se protege la escritura contra el caso inicial en que la vista aun no tiene asignado el modelo "viewModel" (sucede al entrar a Corrientes por primera vez, cuando onSplitterResize dispara este calculo antes de que el controlador termine de inicializar el viewModel). Sin esta guarda se producia el TypeError "Cannot read properties of undefined (reading 'setProperty')" en la consola
            const oViewModel = this.getView().getModel("viewModel");
            if (!oViewModel) return;
            oViewModel.setProperty("/dynamicRowCount", iRows);
        },

        _calculateSplitterHeight: function () {
            var oSplitter = this.byId("mainSplitter");
            if (!oSplitter) return;

            var fnCompute = function () {
                var oDom = oSplitter.getDomRef();
                if (!oDom) return;

                // Distancia del borde superior del splitter respecto al top de la ventana
                var iTop = oDom.getBoundingClientRect().top;

                // Altura del footer (OverflowToolbar dentro de sap.m.Page)
                var oFooterDom = document.querySelector(".sapMPageFooter");
                var iFooter = oFooterDom ? oFooterDom.getBoundingClientRect().height : 40;

                var iAvailable = window.innerHeight - iTop - iFooter;
                if (iAvailable < 100) iAvailable = 100;

                oSplitter.setHeight(iAvailable + "px");

                // Tras fijar la altura del splitter se recalculan
                // las filas visibles de la TreeTable en función del panel superior.
                setTimeout(function () {
                    // Se ejecuta la lógica de cálculo matemático para adaptar la tabla al tamaño actual de la ventana.
                    this._calculateDynamicRows();

                    // Listener de resize: si el panel está abierto se recalcula splitter + filas,
                    // de lo contrario solo las filas (splitter height = auto).
                    if (!this._windowResizeHandler) {
                        this._windowResizeHandler = function () {
                            var oPanelLayout = this.byId("panelSplitterLayout");
                            if (oPanelLayout && oPanelLayout.getSize() !== "0px") {
                                this._calculateSplitterHeight();
                            } else {
                                this._calculateDynamicRows();
                            }
                        }.bind(this);
                        window.addEventListener("resize", this._windowResizeHandler);
                    }
                }.bind(this), 50);
            }.bind(this);

            if (oSplitter.getDomRef()) {
                fnCompute();
            } else {
                // El splitter aun no esta en el DOM: se engancha el evento
                oSplitter.addEventDelegate({ onAfterRendering: fnCompute });
            }
        },
    
        _getColKey: function (oCol) {
            // Se genera la clave para la columna de ejercicios anteriores diferenciando
            // si actúa como columna mensual o como columna anual consolidada.
            if (oCol.data("ejecutadosColumn")) {
                return "ejecutados_" + (oCol.data("dynamicMonth") ? "month" : "year");
            }
            // Se genera la clave para columnas de años dinámicos usando el año como discriminador.
            if (oCol.data("dynamicYear")) {
                return "year_" + oCol.data("year");
            }
            // Se genera la clave para columnas de meses usando el año y el índice del mes.
            if (oCol.data("dynamicMonth")) {
                return "month_" + oCol.data("year") + "_" + oCol.data("monthIdx");
            }
            // Se devuelve el identificador nativo del control como fallback.
            return oCol.getId();
        },
          _capScrollbarOvershoot: function (oTable) {
            if (!oTable) return;
            const oDom = oTable.getDomRef();
            if (!oDom) return;
            const oVsb = oDom.querySelector(".sapUiTableVSb");
            if (!oVsb) return;
            const oVsbInner = oVsb.querySelector(".sapUiTableVSbContent");
            if (!oVsbInner) return;
            const oBinding = oTable.getBinding("rows");
            if (!oBinding) return;
            const iTotalRows = oBinding.getLength();
            const iVisibleCount = oTable.getVisibleRowCount();
            const iOverflowRows = Math.max(0, iTotalRows - iVisibleCount);
            // Se detecta la altura real de fila a partir de la primera fila renderizada.
            const aRows = oTable.getRows();
            let iRowH = 27;
            for (let i = 0; i < aRows.length; i++) {
                const oRowDom = aRows[i].getDomRef();
                if (oRowDom && oRowDom.offsetHeight > 0) {
                    iRowH = oRowDom.offsetHeight;
                    break;
                }
            }
            const iProperH = oVsb.clientHeight + iOverflowRows * iRowH;
            if (oVsbInner.offsetHeight !== iProperH) {
                oVsbInner.style.height = iProperH + "px";
            }
        },

        /**
         * Se asignan los delegados de las flechas del teclado a todos los campos de entrada visibles.
         * Permite la navegación tipo "Excel" entre las celdas de la tabla.
         */
        _attachArrowDelegates: function (oTable) {
            // Se valida o crea el objeto delegado para interceptar la pulsación de teclas.
            if (!this._arrowDelegate) {
                this._arrowDelegate = {
                    onkeydown: function (oEvent) {
                        this._onInputKeyDown(oEvent);
                    }.bind(this)
                };
            }

            // Se obtienen únicamente las filas que están dibujadas en el DOM en este instante.
            const aRows = oTable.getRows();

            // (INICIO MV) Walker independiente que NO requiere getDomRef() (a diferencia de `_recursiveGetInput`): el delegate de flechas puede engancharse aunque el DOM del input aun no este renderizado en el primer `rowsUpdated`; cuando la usuaria de hecho enfoque ese input mas tarde, el delegate disparara. Sin esto, en algunas vistas (caso Anticipados) el delegate quedaba sin atacar a ningun input — la navegacion con flechas no funcionaba en absoluto desde el primer foco. (FIN MV)
            const findInputForAttach = function (oControl) {
                if (!oControl) return null;
                if (oControl.getVisible && oControl.getVisible() === false) return null;
                if (oControl.isA && oControl.isA("sap.m.Input")) {
                    if (oControl.getEditable && oControl.getEditable()) return oControl;
                    return null;
                }
                if (oControl.getContent) {
                    const aContent = oControl.getContent();
                    for (let i = 0; i < aContent.length; i++) {
                        const r = findInputForAttach(aContent[i]);
                        if (r) return r;
                    }
                }
                if (oControl.getItems) {
                    const aItems = oControl.getItems();
                    for (let j = 0; j < aItems.length; j++) {
                        const r = findInputForAttach(aItems[j]);
                        if (r) return r;
                    }
                }
                return null;
            };

            // Se itera sobre cada fila y, seguidamente, sobre cada celda que compone la fila.
            aRows.forEach(function (oRow) {
                oRow.getCells().forEach(function (oCell) {
                    // Se utiliza una función recursiva para buscar dentro de la celda si existe un control Input oculto bajo otros layouts (VBox, HBox).
                    const oInput = findInputForAttach(oCell);

                    if (oInput) {
                        // Se elimina el delegado antes de añadirlo para garantizar que no se acumulen disparadores múltiples del mismo evento.
                        oInput.removeEventDelegate(this._arrowDelegate);
                        oInput.addEventDelegate(this._arrowDelegate);
                    }
                }.bind(this));
            }.bind(this));
        },

        /**
         * Se maneja la navegación direccional con las teclas de flecha entre los campos de entrada de la tabla.
         */
        _onInputKeyDown: function (oEvent) {
            const oInput = oEvent.srcControl;
            const iKeyCode = oEvent.keyCode;

            // Se definen constantes booleanas para identificar claramente qué flecha fue presionada.
            const bDown = iKeyCode === 40;
            const bUp = iKeyCode === 38;
            const bRight = iKeyCode === 39;
            const bLeft = iKeyCode === 37;

            // Si la tecla pulsada no es una flecha de navegación, se ignora el evento y se permite el comportamiento por defecto.
            if (!bDown && !bUp && !bRight && !bLeft) return;
                if (bUp && (this._pendingNavSteps || 0) > 0) this._pendingNavSteps = 0;
            else if (bDown && (this._pendingNavSteps || 0) < 0) this._pendingNavSteps = 0;

            // Se recupera la referencia del DOM (HTML nativo) del Input para leer su valor exacto antes de que el framework lo procese.
            const oDomRef = oInput.getFocusDomRef();
            if (!oDomRef) return;

       
            const _bValueIsZero = (function () {
                const sVal = oDomRef.value || "";
                if (!sVal) return true;
                const sNumeric = sVal.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
                const nVal = parseFloat(sNumeric);
                return !isNaN(nVal) && nVal === 0;
            })();
            if (bLeft) {
                const iSelStartL = oDomRef.selectionStart;
                const iSelEndL = oDomRef.selectionEnd;
                const iValLenL = (oDomRef.value || "").length;
                const bAtStart = iSelStartL === 0 && iSelEndL === 0;
                const bFullSelectionL = iSelStartL === 0 && iSelEndL === iValLenL && iValLenL > 0;
                if (!bAtStart && !(bFullSelectionL && _bValueIsZero)) {
                    // Aun queda margen dentro del propio input: se deja que
                    //el navegador mueva el caret o colapse la seleccion sin
                    //saltar de celda. Solo se considera "listo para navegar"
                    //si el caret esta al inicio o si toda la celda con valor
                    //cero esta seleccionada.
                    return;
                }
            }
            if (bRight) {
                const iSelStartR = oDomRef.selectionStart;
                const iSelEndR = oDomRef.selectionEnd;
                const iValLenR = (oDomRef.value || "").length;
                const bAtEnd = iSelStartR === iValLenR && iSelEndR === iValLenR;
                const bFullSelectionR = iSelStartR === 0 && iSelEndR === iValLenR && iValLenR > 0;
                if (!bAtEnd && !(bFullSelectionR && _bValueIsZero)) {
                    // El caret aun no esta al final del texto y, si hay
                    //seleccion total, el valor no es cero: se permite el
                    //desplazamiento natural del cursor para editar cifra
                    //a cifra sin cambiar de celda.
                    return;
                }
            }

           // (INICIO MV) Watchdog: si `_navInFlight` lleva mas de 250ms en true, se asume que el `fnFocus` correspondiente se perdio (p.ej. `rowsUpdated` no disparado porque `setFirstVisibleRow` no cambio nada y el setTimeout backup se descarto). Se fuerza el reset para no quedar bloqueando indefinidamente la navegacion siguiente — sintoma visible: el handler nativo de la tabla se queda con las flechas y mueve el foco a las filas contenedor. (FIN MV)
           if (this._navInFlight && this._navInFlightTs && (Date.now() - this._navInFlightTs) > 250) {
                this._navInFlight = false;
                this._pendingNavSteps = 0;
            }
           if (this._navInFlight) {
                // (INICIO MV) Se descartan completamente las pulsaciones nuevas mientras hay un scroll en vuelo (no se acumulan en `_pendingNavSteps`). Con la tecla mantenida pulsada y la cola activa, `fnFocus` lanzaba un replay sintetico al terminar; ese replay disparaba otro `setFirstVisibleRow` + rerender + fnFocus inmediatamente, encadenando rerenders cada ~120ms y produciendo el "impazzimento" visual del scroll. Sin cola, las pulsaciones extra se pierden y la usuaria controla manualmente el ritmo (1 pulsacion = 1 desplazamiento, despues de que el foco se haya estabilizado). (FIN MV)
                this._pendingNavSteps = 0;
                oEvent.preventDefault();
                oEvent.stopImmediatePropagation();
                // (INICIO MV) Se intenta tambien `stopPropagation` para frenar la propagacion ascendente al sap.ui.table.TreeTable y evitar que su handler nativo de teclado mueva el foco a `...rows-rowN-col0`. Se protege con typeof porque el delegate de SAPUI5 puede entregar un oEvent sin todos los metodos (sintetico durante el replay de `_pendingNavSteps`). (FIN MV)
                if (typeof oEvent.stopPropagation === "function") oEvent.stopPropagation();
                // (INICIO MV) Se anyade `setMarked()` (API interna de SAPUI5) para que la extension de teclado de sap.ui.table considere el evento ya gestionado y NO mueva su foco interno a `...rows-rowN-col0` durante el scroll. Sin esto, en cada flecha vertical aparecia un flash de 100ms en el indicador de celda nativo antes de que `fnFocus` restituyera el foco real. (FIN MV)
                if (typeof oEvent.setMarked === "function") oEvent.setMarked();
                return;
            }

            oEvent.preventDefault();
            oEvent.stopImmediatePropagation();
            // (INICIO MV) Mismo razonamiento: se bloquea la propagacion ascendente al TreeTable para que su navegacion nativa de teclado no compita con la nuestra. (FIN MV)
            if (typeof oEvent.stopPropagation === "function") oEvent.stopPropagation();
            // (INICIO MV) setMarked() para suprimir el flash del indicador de celda de sap.ui.table durante el scroll vertical. (FIN MV)
            if (typeof oEvent.setMarked === "function") oEvent.setMarked();

            const oTable = this.getControlTable();
            if (!oTable) return;

            const oBinding = oTable.getBinding("rows");
            if (!oBinding) return;

            // Se navega hacia arriba en la jerarquía de controles de UI5 buscando el padre que sea estrictamente una fila.
            let oParent = oInput.getParent();
            while (oParent && !oParent.isA("sap.ui.table.Row")) {
                oParent = oParent.getParent();
            }

            // Si no se logra ubicar la fila, se cancela la operación.
            if (!oParent) return;

            // Se obtiene el índice actual de la fila y el contexto de datos vinculado a ella mediante el modelo nombrado.
            const iCurrentRowIndex = oParent.getIndex();
            const oCurrentContext = oParent.getBindingContext(this.tableModelName);
            if (!oCurrentContext) return;
              const sSourcePath = oCurrentContext.getPath();

            // Se recorren las celdas de la fila actual para averiguar en qué índice de columna se encuentra el Input enfocado.
            const aCells = oParent.getCells();
            let iTargetColIndex = -1;
            for (let i = 0; i < aCells.length; i++) {
                // Se utiliza una búsqueda recursiva para confirmar si la celda iterada contiene el Input enfocado.
                if (this._cellContainsInput(aCells[i], oInput)) {
                    iTargetColIndex = i;
                    break;
                }
            }
            if (iTargetColIndex === -1) return;
            //     Se resetea el destino pendiente antes de calcular el nuevo objetivo
            //     para evitar que una navegacion anterior interfiera con la actual.
            this._pendingFocusTarget = null;

            // ── LÓGICA DE NAVEGACIÓN HORIZONTAL (DERECHA / IZQUIERDA) ─────────────────────────────
            if (bLeft || bRight) {
                // (INICIO MV) Se fuerza el reset de `_navInFlight` en el flujo horizontal: la navegacion lateral nunca dispara scroll y no necesita esperar a `rowsUpdated`. Si un movimiento vertical anterior lo dejo en true por accidente (timeout perdido), las flechas izquierda/derecha quedaban bloqueadas hasta refrescar la vista. (FIN MV)
                this._navInFlight = false;
                // Se traduce el índice absoluto de fila a índice relativo a la vista actual para acceder al elemento renderizado.
                const iFirstVisible = oTable.getFirstVisibleRow();
                const iVisibleRowIndex = iCurrentRowIndex - iFirstVisible;

                // Se valida que la fila calculada sea visible en el viewport actual.
                if (iVisibleRowIndex < 0 || iVisibleRowIndex >= oTable.getRows().length) {
                    setTimeout(function () { oInput.focus(); if (oInput.select) oInput.select(); }, 10);
                    return;
                }

                const oRow = oTable.getRows()[iVisibleRowIndex];
                if (!oRow) {
                    setTimeout(function () { oInput.focus(); if (oInput.select) oInput.select(); }, 10);
                    return;
                }

                // Se inicializa el índice de búsqueda horizontal y la referencia al input destino.
                let iNewColIndex = iTargetColIndex;
                let oTargetInput = null;
                // (INICIO MV) Se usa el tamanyo del array `cells` y NO `getColumns().length`: sap.ui.table.Row.getCells() salta las columnas con visible=false, por lo que el indice del array de celdas y el del array de columnas estan desalineados cuando hay columnas ocultas (en Corrientes, p.ej. "Coste Ej. Ajustado"/"Coste Ej. Real"). El fix previo que filtraba `aAllCols[iNewColIndex].getVisible() === false` aplicaba el check a la columna XML equivocada y saltaba celdas validas como "Coste Total" (visible) confundiendola con "Coste Ej. Real" (oculta), provocando que la flecha derecha desde Pendiente saltara directamente a los meses. Las celdas del array `cells` ya estan filtradas por SAPUI5 a columnas visibles, asi que no hace falta volver a comprobarlo. (FIN MV)
                const aRowCells = oRow.getCells();
                const iTotalCols = aRowCells.length;

                while (true) {
                    iNewColIndex = bRight ? iNewColIndex + 1 : iNewColIndex - 1;

                    // Si se alcanza el límite lateral de la tabla, se mantiene el foco en el input actual.
                    if (iNewColIndex < 0 || iNewColIndex >= iTotalCols) {
                        setTimeout(function () { oInput.focus(); if (oInput.select) oInput.select(); }, 10);
                        return;
                    }

                    const oCell = aRowCells[iNewColIndex];
                    if (!oCell) continue;

                    // Se busca un input visible y editable en la celda; `_recursiveGetInput` ya filtra por visible+editable.
                    const oCandidato = this._recursiveGetInput(oCell);
                    if (!oCandidato) continue; // La celda no contiene ningún input editable, se continúa la búsqueda.

                    // (INICIO MV) Se acepta el input solo si esta tambien habilitado (`getEnabled() !== false`); si esta deshabilitado por `modeloBloqueo>/isBlocked` el foco no produciria efecto y la navegacion se quedaria atascada. (FIN MV)
                    if (oCandidato.getEnabled && oCandidato.getEnabled() === false) continue;

                    oTargetInput = oCandidato;
                    break;
                }

                // Se transfiere el foco al input destino encontrado o se devuelve al original si no se halló ninguno.
                if (oTargetInput) {
                    //     Se guarda el input destino en _pendingFocusTarget antes de
                    //     focalizar para que _enviarFilaAlBackend pueda restaurarlo
                    //     tras completar la llamada asincrona sin perder la posicion.
                    this._pendingFocusTarget = oTargetInput;
                    setTimeout(function () {
                        oTargetInput.focus();
                        if (oTargetInput.select) oTargetInput.select();
                    }, 10);
                } else {
                    setTimeout(function () { oInput.focus(); if (oInput.select) oInput.select(); }, 10);
                }
                return;
            }

            let iTargetRowIndex = null;
            let sTargetPath = null;
            let iTargetFinalColIndex = iTargetColIndex;
            let iSearchIndex = iCurrentRowIndex;
            let iSearchSteps = 0;

            // (INICIO MV) Se inspeccionan las filas renderizadas para clasificar la columna actual: (1) si es "custom-only" (editable solo en desglose, caso Agrupador/Descripcion), (2) que valores de TipoInd ("A"/"B"/none) admiten input editable en esa columna. Sirve para descartar filas fuera del viewport cuyo perfil garantiza ausencia de Input editable — eliminando el scroll-restore visible y el "salto al cell container" reportado por la usuaria. Caso real: en Anticipados, las filas Amortizacion (TipoInd="A") solo tienen Inputs editables a partir de las columnas de mes, no en Coste pend / Total; sin este filtro un ArrowDown desde una Inversion en col 4 caia en row Amortizacion sin input, disparaba scroll y luego restore, perdiendo el foco. (FIN MV)
            let bColCustomOnly = false;
            const oColEditableTipoInd = {};
            try {
                let bHasCustomEditable = false;
                let bHasNonCustomEditable = false;
                const aAllRowsForProbe = oTable.getRows();
                for (let pi = 0; pi < aAllRowsForProbe.length; pi++) {
                    const rProbe = aAllRowsForProbe[pi];
                    const ctxProbe = rProbe.getBindingContext(this.tableModelName);
                    if (!ctxProbe) continue;
                    const dProbe = ctxProbe.getObject();
                    if (!dProbe) continue;
                    const cellProbe = rProbe.getCells()[iTargetColIndex];
                    if (!cellProbe) continue;
                    const inputProbe = this._recursiveGetInput(cellProbe);
                    if (!inputProbe) continue;
                    if (dProbe.__isCustom === true) bHasCustomEditable = true;
                    else bHasNonCustomEditable = true;
                    // (INICIO MV) Se registra el TipoInd que SI tiene editable: cualquier valor (incluyendo undefined → clave "_none"). (FIN MV)
                    const sKey = dProbe.TipoInd ? String(dProbe.TipoInd) : "_none";
                    oColEditableTipoInd[sKey] = true;
                }
                bColCustomOnly = bHasCustomEditable && !bHasNonCustomEditable;
            } catch (_) {}
            const bUseTipoIndFilter = Object.keys(oColEditableTipoInd).length > 0;

            while (true) {
                // Se incrementa o decrementa el índice lógico en base a la dirección de la flecha.
                iSearchIndex = bDown ? iSearchIndex + 1 : iSearchIndex - 1;
                iSearchSteps++;

                // Si se alcanza el límite superior o inferior absoluto de la tabla, se cancela el movimiento.
                if (iSearchIndex < 0 || iSearchIndex >= oBinding.getLength()) {
                     this._pendingNavSteps = 0;
                    setTimeout(function () { oInput.focus(); if (oInput.select) oInput.select(); }, 10);
                    return;
                }

                // Se evita un posible bucle infinito limitando la búsqueda a doscientas iteraciones.
                if (iSearchSteps > 200) {
                          this._pendingNavSteps = 0;
                    setTimeout(function () { oInput.focus(); if (oInput.select) oInput.select(); }, 10);
                    return;
                }

                // Se extrae el contexto de la nueva fila candidata.
                const oCtx = oTable.getContextByIndex(iSearchIndex);
                if (!oCtx) continue;

                const oData = oCtx.getObject();
                if (!oData) continue;

                  const iFirstVisCheck = oTable.getFirstVisibleRow();
                const iVisIdxCheck = iSearchIndex - iFirstVisCheck;

                if (iVisIdxCheck >= 0 && iVisIdxCheck < oTable.getRows().length) {
                    const oRowCheck = oTable.getRows()[iVisIdxCheck];
                    if (oRowCheck) {
                        const aCellsCheck = oRowCheck.getCells();
                        const oCellAtCol = aCellsCheck[iTargetColIndex];
                        const oInputAtCol = oCellAtCol ? this._recursiveGetInput(oCellAtCol) : null;

                        // Si en esta fila la columna de origen no tiene un input
                        //editable visible se continua la busqueda hacia arriba o abajo.
                        // (INICIO MV) Se anyade el check de `getEnabled() === false` para no aterrizar en inputs deshabilitados por `modeloBloqueo>/isBlocked`, que dejarian el foco sin efecto y atascarian la navegacion vertical. (FIN MV)
                        if (!oInputAtCol || !oInputAtCol.getVisible() || !oInputAtCol.getEditable() || (oInputAtCol.getEnabled && oInputAtCol.getEnabled() === false)) continue;

                        // Se mantiene la misma columna como objetivo final para que
                        //las fases de scroll/focus busquen el input exactamente
                        //en la columna original.
                        iTargetFinalColIndex = iTargetColIndex;
                    }
                } else {
                    // (INICIO MV) Filas fuera del viewport: se aplica una heuristica por flags de datos para evitar comprometerse a una fila estructural (capitulo/subcapitulo/vacio/OEO root/cabecera de desglose/Resto sin proveedor), que jamas tienen inputs editables en las columnas estandar. Sin este filtro la navegacion vertical hacia filas no renderizadas provocaba un scroll inutil hasta una fila no editable, y luego el foco se devolvia al origen — dejando al usuario con la tabla desplazada sin razon aparente. (FIN MV)
                    // (INICIO MV) Se anyade `Estructura === "C"` como fallback porque en Anticipados/Inmovilizados las filas capitulo/subcapitulo a veces no tienen el flag `isCapitulo`/`isSubcapitulo` propagado (solo Estructura). (FIN MV)
                    if (oData.isCapitulo === true || oData.isSubcapitulo === true || oData.isVacio === true
                        || oData.Estructura === "C" || oData.Estructura === "S"
                        || oData.PhPspnr === "D"
                        || oData.__isHeader === true || oData.__isSinProveedor === true) {
                        continue;
                    }
                    // (INICIO MV) Si la columna actual es "custom-only" (editable solo en desglose, p.ej. Agrupador / Descripcion), se descartan filas no-__isCustom fuera del viewport: en esas columnas un salto a fila PEP siempre acabaria en fallback con scroll restore visible. (FIN MV)
                    if (bColCustomOnly && oData.__isCustom !== true) {
                        continue;
                    }
                    // (INICIO MV) Si la columna no admite input editable en filas con el TipoInd de la candidata (caso Anticipados/Inmovilizados: Amortizacion TipoInd="A" no tiene Input en columnas iniciales), se descarta. Asi se evita commit a una fila que provocaria scroll + restore + perdida de foco al cell container. (FIN MV)
                    if (bUseTipoIndFilter) {
                        const sKeyData = oData.TipoInd ? String(oData.TipoInd) : "_none";
                        if (!oColEditableTipoInd[sKeyData]) {
                            continue;
                        }
                    }
                }

                // Se fija el índice y la ruta de la fila destino y se detiene la búsqueda.
                iTargetRowIndex = iSearchIndex;
                sTargetPath = oCtx.getPath();
                break;
            }

            // A partir de aqui las fases de scroll y focus usaran el indice
            //de columna del input mas cercano encontrado, no el original.
            iTargetColIndex = iTargetFinalColIndex;

            // ── LÓGICA DE SCROLL AUTOMÁTICO ───────────────────────────────────────────────────────
            const iFirstVisible = oTable.getFirstVisibleRow();
            const iVisibleCount = oTable.getVisibleRowCount();
            const iLastVisible = iFirstVisible + iVisibleCount - 1;

            let bNeedsScroll = false;
            let iNewFirstVisible = iFirstVisible;

            // Se determina si la fila de destino se encuentra por debajo de la zona visible.
            if (iTargetRowIndex > iLastVisible) {
                // Se ajusta la posición de inicio para que la fila objetivo aparezca al final de la pantalla.
                iNewFirstVisible = iTargetRowIndex - iVisibleCount + 1;
                bNeedsScroll = true;
            }
            // Se determina si la fila de destino se encuentra por encima de la zona visible.
            else if (iTargetRowIndex < iFirstVisible) {
                // Se ajusta la posición de inicio para que la fila objetivo aparezca en la parte superior.
                iNewFirstVisible = iTargetRowIndex;
                bNeedsScroll = true;
            }

            if (bNeedsScroll) {
                const that = this;
                let bFocused = false;
                // (INICIO MV) Se memoriza la posicion de scroll original antes de mover la tabla, para poder restaurarla si `fnFocus` no encuentra un input editable en la celda destino (caso: la heuristica fuera de viewport acepto una fila `__isCustom` que en la columna actual no tiene Input renderizado, p.ej. columna Agrupador en un desglose distinto al de origen). Sin esta restauracion la tabla se quedaba desplazada de forma visible aunque el foco volviera al origen — el "scroll inutile" reportado por la usuaria. (FIN MV)
                const iOriginalFirstVisible = iFirstVisible;
                // (INICIO MV) Counter de generacion para invalidar `fnFocus` huerfanos. Cuando la usuaria mantiene la flecha pulsada y el watchdog (>250ms) resetea `_navInFlight` antes de que el `fnFocus` de la pulsacion anterior se haya disparado, se produce una race condition: el `fnFocus` viejo se ejecuta cuando ya hay una nueva navegacion en vuelo, intenta restaurar `firstVisibleRow` a un valor obsoleto y/o pone el foco en un input bindeado a otra fila — visualmente el foco "rebota" entre celdas y la tabla scrolla a saltos ("impazzimento"). Con `_navGeneration` cada nueva nav incrementa el counter y los `fnFocus` viejos se auto-cancelan al ver que su `iMyGen !== _navGeneration`. (FIN MV)
                this._navGeneration = (this._navGeneration || 0) + 1;
                const iMyGen = this._navGeneration;
                // (INICIO MV) Se memoriza el ID DOM del input origen para que `fnFocus` aborte si la usuaria movio el foco a otro sitio (p.ej. click con el raton en otra celda) mientras el scroll estaba en vuelo. Sin este check, el `fnFocus` pendiente sobrescribia con el foco al target calculado, deshaciendo el click manual y produciendo el "impazzimento" que la usuaria veia al interactuar con el raton durante el scroll. (FIN MV)
                const sExpectedFocusId = oInput.getFocusDomRef && oInput.getFocusDomRef() ? oInput.getFocusDomRef().id : null;
                // (INICIO MV) Se memoriza target row path + col index ANTES del scroll para que el intercept del cell container nativo (en el lazy focusin listener) pueda encontrar el input destino sin esperar a `fnFocus`. Asi se suprime el flash visual del indicador de celda nativo del TreeTable. (FIN MV)
                this._navTargetPath = sTargetPath;
                this._navTargetColIdx = iTargetColIndex;

                // Se define una función de cierre que ejecutará el enfoque una vez que la tabla termine de desplazarse.
                const fnFocus = function () {
                    // Se utiliza una bandera para evitar que el evento rowsUpdated dispare el enfoque múltiples veces.
                    if (bFocused) return;
                    bFocused = true;
                    // (INICIO MV) Auto-cancelacion si llego otra navegacion mientras esta estaba pendiente: el counter actual ya no coincide con `iMyGen`, asi que esta instancia se descarta sin tocar foco ni scroll. Asi se evita el bounce de foco y los restores de scroll en cascada cuando se mantiene la tecla pulsada. (FIN MV)
                    if (that._navGeneration !== iMyGen) {
                        return;
                    }
                    // (INICIO MV) Abort solo si la usuaria pulso ACTIVAMENTE otro input con el raton durante el scroll: el activeElement debe ser un campo de edicion real (INPUT/TEXTAREA/SELECT) Y fuera del DOM de la tabla. Si es el body o un row container nativo del TreeTable (caso normal durante el rerender) NO se aborta — el fnFocus sigue para restituir el foco al target. Sin esta precision, el foco se "perdia" porque el activeElement durante el rerender era el body o un cell wrapper. (FIN MV)
                    const oCurrentActive = document.activeElement;
                    if (oCurrentActive && oCurrentActive.id && sExpectedFocusId && oCurrentActive.id !== sExpectedFocusId) {
                        const sTag = oCurrentActive.tagName;
                        const bIsEditableTag = sTag === "INPUT" || sTag === "TEXTAREA" || sTag === "SELECT";
                        const oTableDom = oTable.getDomRef();
                        if (bIsEditableTag && oTableDom && !oTableDom.contains(oCurrentActive)) {
                            that._navInFlight = false;
                            return;
                        }
                    }
                       that._navInFlight = false;

                    const aRows = oTable.getRows();
                    let oTargetRow = null;

                    // Se escanean las filas recién dibujadas buscando aquella cuyo contexto coincida con la ruta de destino.
                    for (let i = 0; i < aRows.length; i++) {
                          const oRowContext = aRows[i].getBindingContext(that.tableModelName);

                        if (oRowContext && oRowContext.getPath() === sTargetPath) {
                            oTargetRow = aRows[i];
                            break;
                        }
                    }

                    // Si no se encuentra la fila tras el scroll, se devuelve el foco a la posición inicial como salvaguarda.
                    if (!oTargetRow) {
                        // (INICIO MV) Se anula el scroll: la fila destino no se renderizo y el foco vuelve al origen. (FIN MV)
                        oTable.setFirstVisibleRow(iOriginalFirstVisible);
                        oInput.focus();
                        if (oInput.select) oInput.select();
                        return;
                    }

                    // Se ubica el input dentro de la celda pertinente y se le transfiere el foco.
                    const oCell = oTargetRow.getCells()[iTargetColIndex];
                    const oTargetInput = that._recursiveGetInput(oCell);

                    if (oTargetInput && oTargetInput.getVisible() && oTargetInput.getEditable()) {
                        //     Se guarda el input destino en _pendingFocusTarget para que
                        //     _enviarFilaAlBackend pueda restaurarlo tras la llamada async.
                        that._pendingFocusTarget = oTargetInput;
                        oTargetInput.focus();
                        if (oTargetInput.select) oTargetInput.select();
                        // (INICIO MV) Re-focus defensivo en el siguiente frame: en algunas vistas (p.ej. Anticipados con filas Inversion/Amortizacion) el `onfocusin` interno del TableKeyboardExtension de sap.ui.table reposiciona el foco al contenedor de celda nativo (`...rows-rowN-colM`) justo despues de nuestro `focus()`, perdiendo el Input. Volviendo a llamar `focus()` dentro de un rAF (despues de que todos los handlers internos de la tabla terminan) garantizamos que el Input retiene el foco. (FIN MV)
                        if (typeof window.requestAnimationFrame === "function") {
                            window.requestAnimationFrame(function () {
                                const oDomCheck = oTargetInput.getFocusDomRef && oTargetInput.getFocusDomRef();
                                if (oDomCheck && document.activeElement !== oDomCheck) {
                                    oTargetInput.focus();
                                    if (oTargetInput.select) oTargetInput.select();
                                }
                            });
                        }
                    } else {
                        // (INICIO MV) Se anula el scroll cuando la celda destino no tiene Input editable: el foco regresa al origen sin que la tabla quede desplazada. (FIN MV)
                        oTable.setFirstVisibleRow(iOriginalFirstVisible);
                        // (INICIO MV) Se RE-OBTIENE oTable.getRows() despues del restore: los Row controls del array `aRows` fueron rebindeados durante el scroll temporal y ya no apuntan a las filas correctas. Buscar source por path en `aRows` (snapshot pre-restore) devolvia un Row control que ahora muestra otra fila distinta, y el `oInput.focus()` siguiente disparaba focus sobre un Input rebindeado a la fila equivocada o ya invalido — perdiendo el foco (el "va su e poi torna giu, perdendo il focus" reportado por la usuaria al ArrowUp desde una PEP cerca del top con un capitulo no-editable encima). (FIN MV)
                        const aRowsFresh = oTable.getRows();
                        let oSourceRow = null;
                        for (let j = 0; j < aRowsFresh.length; j++) {
                            const oCtxSrc = aRowsFresh[j].getBindingContext(that.tableModelName);
                            if (oCtxSrc && oCtxSrc.getPath() === sSourcePath) {
                                oSourceRow = aRowsFresh[j];
                                break;
                            }
                        }
                        if (oSourceRow) {
                            const oSrcCell = oSourceRow.getCells()[iTargetColIndex];
                            const oSrcInput = that._recursiveGetInput(oSrcCell);
                            if (oSrcInput && oSrcInput.getVisible() && oSrcInput.getEditable()) {
                                that._pendingFocusTarget = oSrcInput;
                                oSrcInput.focus();
                                if (oSrcInput.select) oSrcInput.select();
                                return;
                            }
                        }
                        // Si tampoco se localiza la fila origen (fuera del viewport),
                        //se mantiene el comportamiento previo como ultimo recurso.
                        oInput.focus();
                        if (oInput.select) oInput.select();
                        //   
                    }
 
                    const iPendingAfter = that._pendingNavSteps || 0;
                    if (iPendingAfter !== 0) {
                        const iKey = iPendingAfter > 0 ? 40 : 38;
                        that._pendingNavSteps = iPendingAfter > 0 ? iPendingAfter - 1 : iPendingAfter + 1;
                        setTimeout(function () {
                            const oFocused = document.activeElement;
                            if (!oFocused) { that._pendingNavSteps = 0; return; }
                            const oCtrl = sap.ui.getCore().byId((oFocused.id || "").replace(/-inner$/, ""));
                            if (!oCtrl) { that._pendingNavSteps = 0; return; }
                            const oSynth = {
                                srcControl: oCtrl,
                                keyCode: iKey,
                                preventDefault: function () {},
                                stopImmediatePropagation: function () {},
                                // (INICIO MV) Se anyade noop para stopPropagation, ahora invocado por la nueva proteccion contra el handler nativo del TreeTable. (FIN MV)
                                stopPropagation: function () {}
                            };
                            that._onInputKeyDown(oSynth);
                        }, 0);
                    }
                    //   
                };

             
                oTable.attachEventOnce("rowsUpdated", function () {
                    fnFocus();
                });
                
                this._navInFlight = true;
                // (INICIO MV) Se registra el timestamp del bloqueo para el watchdog del inicio de `_onInputKeyDown`. (FIN MV)
                this._navInFlightTs = Date.now();
                //
                // (INICIO MV) Se elimina el blur() previo al scroll: ese blur dejaba el foco en `document.body` durante los 120ms que tarda `fnFocus` en restaurarlo, haciendo "desaparecer" visualmente el indicador de foco durante todo el hold de la tecla (la usuaria veia la tabla scrollar sin ver donde estaba el cursor). Como sap.ui.table.TreeTable reusa los Row controls al hacer scroll (cell clones persistentes, solo se rebinda el contexto), el Input fuente normalmente sobrevive al rerender; el foco se mantiene visible y `fnFocus` lo mueve limpiamente al destino cuando termina. (FIN MV)
                // Se instruye físicamente a la tabla para que se mueva a la nueva fila inicial calculada.
                oTable.setFirstVisibleRow(iNewFirstVisible);

                // Se establece un temporizador de respaldo en caso de que el evento rowsUpdated falle o se pierda.
                // (INICIO MV) Se reduce el respaldo de 300ms a 120ms: en sap.ui.table el evento `rowsUpdated` se dispara tipicamente en <50ms tras `setFirstVisibleRow`; 120ms basta como red de seguridad sin penalizar la sensacion de respuesta cuando hay scroll. (FIN MV)
                setTimeout(fnFocus, 120);

            } else {
                // ── ASIGNACIÓN DE FOCO SIN SCROLL ─────────────────────────────────────────────────
                // (INICIO MV) Patron de "shared target + single in-flight setTimeout": en lugar de cancelar setTimeouts viejos via gen check (que con la tecla mantenida pulsada perdia casi todas las pulsaciones y producia bloqueos), cada pulsacion sobrescribe `_noScrollPending` con el ultimo path/columna a focar. Solo un `setTimeout(10)` esta en vuelo a la vez; al dispararse lee el valor actual de `_noScrollPending`, asi siempre se ejecuta la ultima intencion del usuario sin perder ciclos. Resultado: hold ArrowDown se mueve continuamente sin "atascarse". (FIN MV)
                this._noScrollPending = {
                    sPath: sTargetPath,
                    iColIdx: iTargetColIndex,
                    oFallbackInput: oInput,
                    // (INICIO MV) Se memoriza el id DOM del input origen para abortar si la usuaria movio el foco con el raton antes de que el setTimeout dispare. (FIN MV)
                    sExpectedFocusId: oInput.getFocusDomRef && oInput.getFocusDomRef() ? oInput.getFocusDomRef().id : null
                };

                if (!this._noScrollTimer) {
                    this._noScrollTimer = setTimeout(function () {
                        this._noScrollTimer = null;
                        const oPending = this._noScrollPending;
                        this._noScrollPending = null;
                        if (!oPending) return;

                        // (INICIO MV) Abort solo si activeElement es un INPUT/TEXTAREA/SELECT real fuera de la tabla: signo claro de click manual de la usuaria mid-setTimeout. Body/cell wrappers nativos del TreeTable no triggeran abort para no perder el foco durante navegacion normal. (FIN MV)
                        const oCurrentActive = document.activeElement;
                        if (oCurrentActive && oCurrentActive.id && oPending.sExpectedFocusId && oCurrentActive.id !== oPending.sExpectedFocusId) {
                            const sTag = oCurrentActive.tagName;
                            const bIsEditableTag = sTag === "INPUT" || sTag === "TEXTAREA" || sTag === "SELECT";
                            const oTableDom = oTable.getDomRef();
                            if (bIsEditableTag && oTableDom && !oTableDom.contains(oCurrentActive)) {
                                return;
                            }
                        }

                        const aRows = oTable.getRows();
                        let oTargetRow = null;
                        for (let i = 0; i < aRows.length; i++) {
                            const oRowContext = aRows[i].getBindingContext(this.tableModelName);
                            if (oRowContext && oRowContext.getPath() === oPending.sPath) {
                                oTargetRow = aRows[i];
                                break;
                            }
                        }

                        if (!oTargetRow) {
                            if (oPending.oFallbackInput && oPending.oFallbackInput.focus) {
                                oPending.oFallbackInput.focus();
                                if (oPending.oFallbackInput.select) oPending.oFallbackInput.select();
                            }
                            return;
                        }

                        const oCell = oTargetRow.getCells()[oPending.iColIdx];
                        const oTargetInput = this._recursiveGetInput(oCell);

                        if (oTargetInput && oTargetInput.getVisible() && oTargetInput.getEditable()) {
                            this._pendingFocusTarget = oTargetInput;
                            oTargetInput.focus();
                            if (oTargetInput.select) oTargetInput.select();
                            // (INICIO MV) Re-focus defensivo via rAF para vistas donde sap.ui.table reposiciona el foco al cell container tras nuestro focus(). (FIN MV)
                            if (typeof window.requestAnimationFrame === "function") {
                                window.requestAnimationFrame(function () {
                                    const oDomCheck = oTargetInput.getFocusDomRef && oTargetInput.getFocusDomRef();
                                    if (oDomCheck && document.activeElement !== oDomCheck) {
                                        oTargetInput.focus();
                                        if (oTargetInput.select) oTargetInput.select();
                                    }
                                });
                            }
                        } else {
                            if (oPending.oFallbackInput && oPending.oFallbackInput.focus) {
                                oPending.oFallbackInput.focus();
                                if (oPending.oFallbackInput.select) oPending.oFallbackInput.select();
                            }
                        }
                    }.bind(this), 10);
                }
            }
        },

        /**
         * Se verifica recursivamente si un contenedor (celda u otro layout) contiene un determinado campo de entrada.
         * Es necesario porque las celdas de las columnas no suelen contener el Input de forma directa, sino envuelto en contenedores como HBox o VBox.
         */
        _cellContainsInput: function (oCell, oTargetInput) {
            // Caso base: el elemento analizado es directamente el input buscado.
            if (oCell === oTargetInput) return true;

            // Se revisa si el control posee agregaciones del tipo "items" (típico de flexboxes de SAPUI5).
            if (oCell.getItems) {
                const aItems = oCell.getItems();
                for (let i = 0; i < aItems.length; i++) {
                    // Se comprueba el ítem directo y, si no es, se profundiza recursivamente.
                    if (aItems[i] === oTargetInput) return true;
                    if (this._cellContainsInput(aItems[i], oTargetInput)) return true;
                }
            }

            // Se revisa si el control posee agregaciones del tipo "content" (típico de paneles o layouts antiguos).
            if (oCell.getContent) {
                const aContent = oCell.getContent();
                for (let j = 0; j < aContent.length; j++) {
                    if (aContent[j] === oTargetInput) return true;
                    if (this._cellContainsInput(aContent[j], oTargetInput)) return true;
                }
            }

            // Si se agotan las ramas y no se encuentra el Input, se devuelve falso.
            return false;
        },

        /**
                 * Se busca de forma recursiva un control Input editable dentro de una celda.
                 * Esta función es crucial porque las celdas de las tablas suelen envolver sus elementos en layouts contenedores (VBox, HBox).
                 */
        _recursiveGetInput: function (oControl) {
            // Se valida que el control exista antes de intentar procesarlo.
            if (!oControl) return null;

            // (INICIO MV) Se descartan ramas cuyo contenedor padre tenga `visible=false`, ya que en SAPUI5 la propiedad `visible` no se propaga: un Input dentro de un HBox/VBox invisible mantiene su propia `getVisible()=true` aunque su DOM no se renderice. Antes la recursion devolvia esos inputs "fantasma" (caso de las plantillas con varios HBox condicionales como colProveedor/colNMeses) y `focus()` no surtia efecto, dejando la navegacion atascada en la celda origen. (FIN MV)
            if (oControl.getVisible && oControl.getVisible() === false) return null;

            // Caso base: se verifica si el control evaluado es directamente la instancia de entrada buscada.
            if (oControl.isA && oControl.isA("sap.m.Input")) {
                // Se garantiza que el input solo se retorne si está habilitado para la interacción del usuario.
                // (INICIO MV) Se anyade el check de `getDomRef()` para excluir inputs cuyo DOM no esta renderizado (padre HBox/VBox no visible para esta fila). (FIN MV)
                if (oControl.getEditable() && oControl.getDomRef && oControl.getDomRef()) {
                    return oControl;
                }
                // Si el control es un Input no renderizado, no se profundiza en sus hijos.
                return null;
            }

            // Si el control es un contenedor de diseño tradicional (ej. Panel, Page), se escanean sus elementos hijos.
            if (oControl.getContent) {
                const aContent = oControl.getContent();
                for (let i = 0; i < aContent.length; i++) {
                    // Se profundiza en el árbol de la interfaz mediante una llamada recursiva.
                    const res = this._recursiveGetInput(aContent[i]);
                    // Si se halla un input válido en esta rama, se detiene la búsqueda y se propaga hacia arriba.
                    if (res) return res;
                }
            }

            // Si el control es un contenedor de agregación flexible (ej. VBox, HBox, FlexBox), se inspeccionan sus ítems.
            if (oControl.getItems) {
                const aItems = oControl.getItems();
                for (let j = 0; j < aItems.length; j++) {
                    const resIt = this._recursiveGetInput(aItems[j]);
                    if (resIt) return resIt;
                }
            }

            // Si tras explorar todas las ramas no se detecta ningún Input, se retorna un valor nulo.
            return null;
        },

        /**
         * Se construye una lista desplegable de operaciones a partir de las categorías expandibles.
         * Se extraen los datos de la jerarquía compleja para aplanarlos en una lista simple para el selector superior.
         */
        _buildOperacionesCombo: function (aCategories) {
            const aResult = [];

            // Se define una función recursiva interna para navegar por todos los niveles del árbol de datos.
            function recurse(aNodes) {
                // Si la rama no es un arreglo válido, se interrumpe la ejecución para ese nodo.
                if (!Array.isArray(aNodes)) return;

                // Se procesa cada elemento individual del nivel actual.
                aNodes.forEach(function (oNode) {
                    // Se verifica si el nodo está marcado como expandible o si posee hijos reales, lo que lo califica como una "operación" seleccionable.
                    if (oNode.expandible || (Array.isArray(oNode.categories) && oNode.categories.length > 0)) {
                        aResult.push({
                            key: oNode.name,
                            text: oNode.name + " - " + (oNode.currency || "")
                        });
                    }
                    // Si el nodo contiene subdivisiones, se llama a la función de manera recursiva para seguir extrayendo datos.
                    if (Array.isArray(oNode.categories)) {
                        recurse(oNode.categories);
                    }
                });
            }

            // Se inicia el proceso de extracción desde la raíz proporcionada.
            recurse(aCategories);
            return aResult;
        },

        /**
          * Se filtra la TreeTable según la operación seleccionada en el menú desplegable.
          * Este evento aísla un nodo específico (y su línea ascendente/descendente) ocultando el resto de la tabla.
          */
        onOperacionChange: function (oEvent) {
            const oSelectedItem = oEvent.getParameter("selectedItem");
            const oTable = this.getControlTable();
            const oDefaultModel = this.getView().getModel();
            const oUiModel = this.getView().getModel("ui");

            // Se genera una copia de seguridad inicial por única vez para tener el estado completo del árbol antes del filtro.
            if (!this._fullCategoriesBackup) {
                const aOriginal = oDefaultModel.getProperty("/catalog/models/categories");
                this._fullCategoriesBackup = JSON.parse(JSON.stringify(aOriginal));
            }

            // CASO: EL USUARIO LIMPIA EL SELECTOR (NO HAY SELECCIÓN)
            // Se debe restaurar la tabla completa sin perder los datos que el usuario haya podido teclear mientras estaba filtrada.
            if (!oSelectedItem) {
                const aCurrent = oDefaultModel.getProperty("/catalog/models/categories");
                // Se fusionan los datos actuales de la vista reducida con el respaldo original para preservar la edición.
                const aRestored = this._mergeModifications(
                    JSON.parse(JSON.stringify(this._fullCategoriesBackup)),
                    aCurrent
                );

                // Se reinyecta el árbol completo al modelo.
                oDefaultModel.setProperty("/catalog/models/categories", aRestored);

                // Se reinicia la visibilidad estandarizada de las columnas accesorias (ocultas por defecto).
                if (this.byId("colMonths")) this.byId("colMonths").setVisible(false);
                if (this.byId("colNew")) this.byId("colNew").setVisible(false);
                if (this.byId("colCheckBox1")) this.byId("colCheckBox1").setVisible(false);
                if (this.byId("colCheckBox2")) this.byId("colCheckBox2").setVisible(false);

                // Se desactivan las cabeceras pegajosas (sticky) para limpiar la UI.
                if (oUiModel) oUiModel.setProperty("/showStickyParent", false);
                this._setStickyChild(false);

                // Se utiliza setTimeout para asegurar que la tabla colapse todos los nodos después de que el modelo haya sido renderizado.
                setTimeout(function () {
                    oTable.collapseAll();
                    this._refreshAfterToggle(oTable.getId());
                }.bind(this), 0);
                return;
            }

            // CASO: EL USUARIO SELECCIONA UNA OPERACIÓN ESPECÍFICA
            // Se captura la clave primaria del ítem elegido en el desplegable.
            const sKey = oSelectedItem.getKey();

            // Se cuentan los puntos en la nomenclatura para inferir la jerarquía (ej. I.003 es padre, I.003.031 es hijo).
            const iDotCount = (sKey.match(/\./g) || []).length;
            let sParentKey = null;

            // Si tiene múltiples puntos, se deduce la clave de su padre directo quitando la última sección.
            if (iDotCount >= 2) {
                sParentKey = sKey.substring(0, sKey.lastIndexOf("."));
            }

            // Se obtiene el estado actual y se fusiona con la copia completa para no perder ediciones no guardadas antes del filtro.
            const aCurrentList = oDefaultModel.getProperty("/catalog/models/categories");
            const aWorkingCopy = this._mergeModifications(
                JSON.parse(JSON.stringify(this._fullCategoriesBackup)),
                aCurrentList
            );
            const aFilteredRoot = [];

            // Se itera sobre el nivel más alto del árbol consolidado para aplicar las reglas de aislamiento.
            for (let i = 0; i < aWorkingCopy.length; i++) {
                const rootCat = aWorkingCopy[i];
                if (!Array.isArray(rootCat.categories)) {
                    rootCat.categories = [];
                }

                // Sub-Caso 1: El elemento seleccionado es un padre principal directamente anclado a la raíz.
                if (rootCat.name === sKey && !sParentKey) {
                    aFilteredRoot.push(rootCat);
                    continue;
                }

                // Sub-Caso 2: El elemento seleccionado es un nivel profundo (hijo).
                if (sParentKey) {
                    // Se emplea la función auxiliar recursiva para buscar la coincidencia de clave en las ramas.
                    let aFilteredChildren = this._filterCategories(rootCat.categories, sKey);
                    const bIncludeParent = rootCat.name === sParentKey;

                    // Si esta rama en particular no tiene el hijo y no es el padre que lo contiene, se salta (se oculta de la tabla final).
                    if (aFilteredChildren.length === 0 && !bIncludeParent) {
                        continue;
                    }

                    // Si se encontraron hijos válidos, se poda el árbol asignándole únicamente esta descendencia filtrada.
                    if (aFilteredChildren.length > 0) {
                        rootCat.categories = aFilteredChildren;
                    }
                    // Alternativamente, si estamos procesando al padre contenedor, forzamos su filtrado para aligerar la vista.
                    else if (bIncludeParent) {
                        rootCat.categories = this._filterCategories(rootCat.categories, sKey);
                    }

                    aFilteredRoot.push(rootCat);
                }
            }

            // Se aplica el arreglo de nodos ya depurado y filtrado al modelo visual de la tabla.
            oDefaultModel.setProperty("/catalog/models/categories", aFilteredRoot);

            // Se delega a un ciclo asíncrono (setTimeout) la expansión automática de los nodos filtrados.
            setTimeout(function () {
                const oBinding = oTable.getBinding("rows");
                if (!oBinding) return;

                let bAnyDetailExpanded = false;

                // Se colapsa toda la estructura antes de procesar las aperturas calculadas.
                oTable.collapseAll();

                // Se recorren las filas físicas de la tabla que acaba de ser dibujada.
                for (let i = 0; i < oBinding.getLength(); i++) {
                    const oCtx = oTable.getContextByIndex(i);
                    const oObj = oCtx && oCtx.getObject();

                    if (!oObj) continue;

                    // Se evalúa si la fila debe expandirse forzosamente debido al criterio de búsqueda.
                    if (sParentKey) {
                        // Si la fila representa al padre contenedor o al objetivo directo, y permite apertura, se expande.
                        if ((oObj.name === sParentKey || oObj.name === sKey) && oObj.expandible) {
                            oTable.expand(i);

                            // Se verifica si al expandir se han revelado nodos terminales de detalle profundo.
                            if (oObj.name === sKey && Array.isArray(oObj.categories) &&
                                oObj.categories.length > 0 && oObj.categories[0].isGroup === true) {
                                bAnyDetailExpanded = true;
                            }
                        }
                    } else if (sKey) {
                        // Si no había padre, simplemente se evalúa la coincidencia contra la clave primaria general.
                        if (oObj.name === sKey && oObj.expandible === true) {
                            oTable.expand(i);
                            if (Array.isArray(oObj.categories) && oObj.categories.length > 0 &&
                                oObj.categories[0].isGroup === true) {
                                bAnyDetailExpanded = true;
                            }
                        }
                    }
                }

                // Se activan las columnas detalladas (meses, checkboxes) únicamente si la expansión resultó en la muestra de niveles inferiores.
                if (this.byId("colMonths")) this.byId("colMonths").setVisible(bAnyDetailExpanded);
                if (this.byId("colNew")) this.byId("colNew").setVisible(bAnyDetailExpanded);
                if (this.byId("colCheckBox1")) this.byId("colCheckBox1").setVisible(bAnyDetailExpanded);
                if (this.byId("colCheckBox2")) this.byId("colCheckBox2").setVisible(bAnyDetailExpanded);

                // Se blanquea la UI para evitar superposiciones residuales de elementos sticky de la vista anterior.
                if (oUiModel) {
                    oUiModel.setProperty("/showStickyParent", false);
                    oUiModel.setProperty("/showStickyChild", false);
                }

                // Se repasan los estilos de cabecera y el scroll después de alterar drásticamente la tabla.
                this._refreshAfterToggle(oTable.getId());
            }.bind(this), 100);
        },

   
        _mergeModifications: function (aBase, aModified) {
            // Si no hay datos modificados para combinar, se devuelve la base intacta.
            if (!Array.isArray(aModified)) return aBase;

            // Se establece una función de recursión profunda para navegar los árboles base y modificado simultáneamente.
            const mergeRecursive = function (baseArray, modArray) {
                // Se itera sobre cada ítem modificado presente en la pantalla.
                modArray.forEach(function (modItem) {
                    // Se localiza su contraparte exacta en el arreglo base (copia de seguridad).
                    const baseItem = baseArray.find(function (b) {
                        return b.name === modItem.name;
                    });

                    // Si el nodo existe en la base, se procede a inyectarle los valores numéricos tecleados.
                    if (baseItem) {
                        for (let key in modItem) {
                            // Se utiliza una expresión regular estricta para identificar únicamente campos anuales (yYYYY) o mensuales (mYYYY_MM), 
                            // además de las estructuras de objetos anidados de meses.
                            if (/^y\d{4}$/.test(key) || /^m\d{4}_\d+$/.test(key) || key === "months" || key === "monthsData") {
                                // Se transfiere el valor actual sobreescribiendo el antiguo en la base de datos local.
                                baseItem[key] = modItem[key];
                            }
                        }
                        // Se delega a los subniveles (categorías) si ambos nodos los contienen.
                        if (baseItem.categories && modItem.categories) {
                            mergeRecursive(baseItem.categories, modItem.categories);
                        }
                    }
                });
            };

            // Se ejecuta la fusión. Al modificar directamente los objetos mutables de 'aBase', esta contendrá la versión final unificada.
            mergeRecursive(aBase, aModified);
            return aBase;
        },
     
        _computeModelDelta: function (aOriginal, aCurrent, sBasePath) {
            const aDelta = [];
            const sPath = sBasePath || "";

            if (!Array.isArray(aCurrent) || !Array.isArray(aOriginal)) return aDelta;

            const aStructuralKeys = [
                "children", "padre", "isGroup", "expandible", "cabecera",
                "ParentPath", "flag1", "flag2", "flag1Label", "flag2Label",
                "monthsData", "size2",
                "editPhPspnr", "editPost1", "editTasa", "editAmoEje", "editAmoEjeAjus",
                "editAmoEjeReal", "editAmoPen", "editAmoTot", "editPepDest",
                "editTipo", "editPenPlan", "editMonths", "editPend",
                "editCtotPen", "editCtot"
            ];

            for (let i = 0; i < aCurrent.length; i++) {
                const oCur = aCurrent[i];
                const oOri = aOriginal[i] || {};
                const sNode = sPath + "/" + i;

                Object.keys(oCur).forEach(function (sKey) {
                    if (aStructuralKeys.indexOf(sKey) !== -1) return;

                    const vCur = (oCur[sKey] === undefined || oCur[sKey] === null) ? "" : String(oCur[sKey]);
                    const vOri = (oOri[sKey] === undefined || oOri[sKey] === null) ? "" : String(oOri[sKey]);

                    if (vCur !== vOri) {
                        aDelta.push({ path: sNode, key: sKey, value: oCur[sKey] });
                    }
                });

                if (Array.isArray(oCur.children)) {
                    const aChildDelta = this._computeModelDelta(
                        oOri.children || [],
                        oCur.children,
                        sNode + "/children"
                    );
                    aChildDelta.forEach(function (oEntry) { aDelta.push(oEntry); });
                }
            }

            return aDelta;
        },

        /**
         * Se aplica un delta de cambios sobre una copia fresca de los datos originales
         * del servidor para reconstruir el estado exacto en que el usuario guardo
         * la variante sin necesidad de almacenar el modelo completo.
         */
        _applyModelDelta: function (aDelta) {
            const oModel = this.getView().getModel(this.tableModelName);
            if (!oModel) return;

            // Se restauran los datos originales del servidor sin invocar refresh(true)
            // para evitar que el refresco forzado destruya las columnas dinamicas de la tabla
            // mientras la restauracion de columnas estaticas aun no ha finalizado.
            if (this._originalServerData) {
                const aFresh = JSON.parse(JSON.stringify(this._originalServerData));
                oModel.setData(aFresh);
            }

            // Si el delta esta vacio no hay nada que aplicar: la tabla ya muestra
            // los datos originales del servidor despues del setData anterior.
            if (!Array.isArray(aDelta) || aDelta.length === 0) return;

            // Se aplica cada entrada del delta directamente sobre el modelo recien inicializado.
            aDelta.forEach(function (oEntry) {
                oModel.setProperty(oEntry.path + "/" + oEntry.key, oEntry.value);
            });
        },
        /*
              * Se llama desde onInit de cada vista hija para registrar la configuración
              * específica de su tabla antes de que arranque cualquier lógica de variantes.
              */
        initVariantConfig: function (oConfig) {
            if (!oConfig || !oConfig.tableId) {

                return;
            }
            // Se almacena la configuración en una propiedad de instancia privada para
            // que todos los métodos del BaseController la lean sin parámetros extra.
            this._variantConfig = {
                tableId: oConfig.tableId,
                modelName: oConfig.modelName || "",
                storageKey: oConfig.storageKey || oConfig.tableId + "_variants"
            };

            // Se sincroniza tableModelName para que getBind() y los templates XML
            // sigan funcionando exactamente igual que antes.
            this.tableModelName = this._variantConfig.modelName;
        },
      
        _initVariantManagement: function () {
            var sStorageKey = (this._variantConfig && this._variantConfig.storageKey)
                ? this._variantConfig.storageKey
                : "ui5_variants_default";

            this._variantStorageKey = sStorageKey;
            this._bVariantDirty = false;
            // Se resetea la bandera que indica si el delegate ya aplicó la variante,
            // para evitar la doble aplicación entre el delegate y este setTimeout.
            this._bVariantAppliedByDelegate = false;

            this._aVariants = this._loadVariantsFromStorage();

            var sDefaultName = localStorage.getItem(this._variantStorageKey + "_default") || "Estándar";
            var oDefaultVariant = this._aVariants.find(function (v) {
                return v.name === sDefaultName;
            }) || this._aVariants[0];

            this._aVariants.forEach(function (v) { v.isPorDefecto = false; });
            oDefaultVariant.isPorDefecto = true;

            //   currentName guarda el nombre canonico (interno);
            // displayLabel guarda el nombre traducido que se muestra al usuario.
            // Asi las comparaciones contra "Estándar" siguen funcionando aunque
            // la UI este en EN/FR.  
            this.getView().setModel(new sap.ui.model.json.JSONModel({
                currentName: oDefaultVariant.name,
                displayLabel: this._translateVariantName(oDefaultVariant.name)
            }), "variantModel");
            //  

            setTimeout(function () {
                //   Se captura el estado Estándar solo si el delegate no ha aplicado aún
                // una variante con nombre, garantizando que _aVariants[0].state refleje la
                // disposición original de las columnas y no la de la variante activa.
                if (!this._bVariantAppliedByDelegate) {
                    this._aVariants[0].state = this._getCurrentTableState();

                    if (oDefaultVariant.name !== "Estándar" && oDefaultVariant.state) {
                        this._bSuppressDirtyFlag = true;
                        this._applyVariantState(oDefaultVariant.state);
                        this.getView().getModel("variantModel").setProperty("/currentName", oDefaultVariant.name);
                        //   Se traduce el nombre al mostrarlo.  
                        this.getView().getModel("variantModel").setProperty("/displayLabel", this._translateVariantName(oDefaultVariant.name));
                        //  
                    }
                } else {

                    setTimeout(function () {
                        if (this._aVariants[0] && !this._aVariants[0].state) {

                        }
                    }.bind(this), 100);
                }
                this._bSuppressDirtyFlag = false;
            }.bind(this), 500);

            var oTable = this.getControlTable();
            if (oTable && !oTable._variantColumnMoveAttached) {
                oTable.attachColumnMove(function () {
                    this._markVariantDirty();
                }.bind(this));
                oTable._variantColumnMoveAttached = true;
            }
        },

      
        /* Se define la función para marcar la variante como modificada y añadir el asterisco visual. */
        _markVariantDirty: function () {
            // Se ignora la llamada si la supresión temporal está activa o si ya está marcado como sucio.
            if (this._bSuppressDirtyFlag) return;
            if (this._bVariantDirty) return;

            this._bVariantDirty = true;

            const oVModel = this.getView().getModel("variantModel");
            if (!oVModel) return;

            // Se añade el asterisco al nombre visible para indicar cambios pendientes de guardar.
            const sName = oVModel.getProperty("/currentName");
            //   Se traduce el nombre antes de anyadir el marcador de dirty.  
            oVModel.setProperty("/displayLabel", this._translateVariantName(sName) + " *");
            //  
        },

        /**
         * Se elimina el indicador de cambios pendientes y se restaura el nombre limpio.
         */
        _clearVariantDirty: function () {
            this._bVariantDirty = false;
            const oVModel = this.getView().getModel("variantModel");
            if (!oVModel) return;
            //   Se traduce el nombre al restaurarlo tras limpiar dirty.  
            oVModel.setProperty("/displayLabel", this._translateVariantName(oVModel.getProperty("/currentName")));
            //  
        },

        /**
         * Se gestiona el redimensionamiento de columnas realizado por el usuario.
         * Se persiste el nuevo ancho y se marca la variante activa como modificada.
         */
        onColumnResize: function (oEvt) {
            this._markVariantDirty();
        },

        _getCurrentTableState: function () {
            const oTable = this.getControlTable();
            if (!oTable) return null;

            // Se capturan las columnas estaticas en el orden actual de la tabla.
            const aColStates = [];
            oTable.getColumns().forEach(function (oCol) {
                if (oCol.data("dynamicYear") || oCol.data("dynamicMonth") || oCol.data("ejecutadosColumn")) {
                    return;
                }
                aColStates.push({
                    key: this._getVariantColumnKey(oCol),
                    width: oCol.getWidth(),
                    visible: oCol.getVisible()
                });
            }.bind(this));

            // Se capturan las rutas de las filas expandidas.
            const aExpandedPaths = [];
            const oBinding = oTable.getBinding("rows");
            if (oBinding) {
                const iLength = oBinding.getLength();
                for (let i = 0; i < iLength; i++) {
                    if (oTable.isExpanded(i)) {
                        const oCtx = oTable.getContextByIndex(i);
                        if (oCtx) aExpandedPaths.push(oCtx.getPath());
                    }
                }
            }

            // Se capturan las rutas de las filas seleccionadas.
            const aSelectedPaths = [];
            oTable.getSelectedIndices().forEach(function (iIdx) {
                const oCtx = oTable.getContextByIndex(iIdx);
                if (oCtx) aSelectedPaths.push(oCtx.getPath());
            });

            // Se calcula el delta de cambios en las celdas respecto a los datos originales del servidor.
            let aModelDelta = [];
            try {
                const oModel = this.getView().getModel(this.tableModelName);
                if (oModel && this._originalServerData) {
                    aModelDelta = this._computeModelDelta(
                        this._originalServerData,
                        oModel.getData()
                    );
                }
            } catch (e) {
                sap.base.Log.warning("No se pudo calcular el delta del modelo: " + e);
            }

            // Se lee el estado de idEjecutadoCheckBox2 desde la variable interna _bEjecutadoSelected
            // ya que esta variable se mantiene siempre sincronizada con el checkbox por _handleEjecutado
            // y no requiere acceso directo al control que reside en la Main view.
            const bEjecutadoSelected = this._bEjecutadoSelected || false;

            // Se captura el estado de idAjustesCheckBox que pertenece a la vista hija activa.
            const oAjustesCheckBox = this.byId("idAjustesCheckBox");
            const bAjustesSelected = oAjustesCheckBox
                ? oAjustesCheckBox.getSelected()
                : false;

            return {
                columns: aColStates,
                expandedPaths: aExpandedPaths,
                selectedPaths: aSelectedPaths,
                modelDelta: aModelDelta,
                bEjecutadoSelected: bEjecutadoSelected,
                bAjustesSelected: bAjustesSelected,
                // Se incluyen los anchos de las columnas dinámicas de años y meses para que
                // la variante pueda restaurarlos al aplicarse de nuevo.
                dynamicColWidths: this._savedColWidths ? JSON.parse(JSON.stringify(this._savedColWidths)) : {}
            };
        },

       
        _applyVariantState: function (oState) {
            if (!oState) return;
            const oTable = this.getControlTable();
            if (!oTable) return;

            // Se restauran los anchos de las columnas dinámicas guardados en la variante.
            if (oState.dynamicColWidths && typeof oState.dynamicColWidths === "object") {
                this._savedColWidths = JSON.parse(JSON.stringify(oState.dynamicColWidths));
            } else {
                this._savedColWidths = {};
            }

            // CORRECCIÓN CLAVE: Se resetean SIEMPRE las columnas dinámicas a sus anchos
            // predeterminados antes de aplicar los valores guardados de la variante.
            // Sin este reset, las columnas conservan el ancho de la variante anterior
            // aunque la nueva variante no tenga anchos guardados (ej: Estándar).
            oTable.getColumns().forEach(function (oCol) {
                if (oCol.data("dynamicYear") && !oCol.data("ejecutadosColumn")) {
                    oCol.setWidth("8rem");
                } else if (oCol.data("ejecutadosColumn")) {
                    oCol.setWidth("130px");
                }
            }.bind(this));

            // Sobre el reset anterior, se aplican los anchos específicos de la variante.
            if (this._savedColWidths && typeof this._savedColWidths === "object") {
                oTable.getColumns().forEach(function (oCol) {
                    if (!oCol.data("dynamicYear") && !oCol.data("ejecutadosColumn")) return;
                    const sKey = this._getColKey(oCol);
                    if (this._savedColWidths[sKey]) {
                        oCol.setWidth(this._savedColWidths[sKey]);
                    }
                }.bind(this));
            }

            // Se aplican los datos editados en las celdas aplicando el delta sobre
            // los datos originales del servidor.
            if (Array.isArray(oState.modelDelta)) {
                try {
                    this._applyModelDelta(oState.modelDelta);
                } catch (e) {
                    sap.base.Log.warning("No se pudo restaurar el delta del modelo: " + e);
                }
            }

            // Se restaura el estado de idAjustesCheckBox.
            if (typeof oState.bAjustesSelected === "boolean") {
                const oAjustesCheckBox = this.byId("idAjustesCheckBox");
                if (oAjustesCheckBox) {
                    oAjustesCheckBox.setSelected(oState.bAjustesSelected);
                }
                const oVisibleModel = this.getView().getModel("visibleColumn");
                if (oVisibleModel) {
                    oVisibleModel.setProperty("/visible", oState.bAjustesSelected);
                }
            }

            // Se restaura el estado de idEjecutadoCheckBox2.
            if (typeof oState.bEjecutadoSelected === "boolean") {
                if (this._fnSetEjecutadoCheckBox) {
                    this._fnSetEjecutadoCheckBox(oState.bEjecutadoSelected);
                }
                this._bEjecutadoSelected = oState.bEjecutadoSelected;
                this._handleEjecutado(oState.bEjecutadoSelected);
            }

            // Se restauran orden, ancho y visibilidad de las columnas estáticas.
            if (oState.columns && oState.columns.length > 0) {
                const aStaticCols = oTable.getColumns().filter(function (oCol) {
                    return !oCol.data("dynamicYear") && !oCol.data("dynamicMonth") && !oCol.data("ejecutadosColumn");
                });

                const oKeyToCol = {};
                aStaticCols.forEach(function (oCol) {
                    oKeyToCol[this._getVariantColumnKey(oCol)] = oCol;
                }.bind(this));

                aStaticCols.forEach(function (oCol) {
                    oTable.removeColumn(oCol);
                });

                oState.columns.forEach(function (oSaved, iPos) {
                    const oCol = oKeyToCol[oSaved.key];
                    if (oCol) {
                        oCol.setWidth(oSaved.width);
                        oCol.setVisible(oSaved.visible);
                        oTable.insertColumn(oCol, iPos);
                    }
                });
                aStaticCols.forEach(function (oCol) {
                    if (oTable.indexOfColumn(oCol) === -1) {
                        oTable.addColumn(oCol);
                    }
                });
            }
             var oViewForLock = this.getView();
            var oModeloBloqueoActual = oViewForLock.getModel("modeloBloqueo");
            if (oModeloBloqueoActual) {
                var bIsBlockedActual = oModeloBloqueoActual.getProperty("/isBlocked");
                oViewForLock.setModel(new sap.ui.model.json.JSONModel({
                    isBlocked: bIsBlockedActual
                }), "modeloBloqueo");
            }


            // Se restauran las expansiones y selecciones.
            const fnRestoreTreeState = function () {
                const oBinding = oTable.getBinding("rows");
                if (!oBinding) return;

                const iLength = oBinding.getLength();
                oTable.collapseAll();
                oTable.clearSelection();

                const oPathToIndex = {};
                for (let i = 0; i < iLength; i++) {
                    const oCtx = oTable.getContextByIndex(i);
                    if (oCtx) oPathToIndex[oCtx.getPath()] = i;
                }

                if (Array.isArray(oState.expandedPaths)) {
                    oState.expandedPaths.forEach(function (sPath) {
                        const iIdx = oPathToIndex[sPath];
                        if (iIdx !== undefined) oTable.expand(iIdx);
                    });
                }

                if (Array.isArray(oState.selectedPaths) && oState.selectedPaths.length > 0) {
                    setTimeout(function () {
                        const iLengthAfterExpand = oBinding.getLength();
                        for (let i = 0; i < iLengthAfterExpand; i++) {
                            const oCtx = oTable.getContextByIndex(i);
                            if (oCtx && oState.selectedPaths.indexOf(oCtx.getPath()) !== -1) {
                                oTable.addSelectionInterval(i, i);
                            }
                        }
                        this._bSuppressDirtyFlag = false;
                    }.bind(this), 150);
                } else {
                    this._bSuppressDirtyFlag = false;
                }
            }.bind(this);

            setTimeout(fnRestoreTreeState, 100);

            // Se abre automáticamente el primer año con sus meses.
            setTimeout(function () {
                const oTable = this.getControlTable();
                if (!oTable) return;
                if (this._openedYear) return;

                const oPrimerAnioCol = oTable.getColumns().find(function (c) {
                    return c.data("dynamicYear") === true && !c.data("ejecutadosColumn");
                });
                if (!oPrimerAnioCol) return;

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
            }.bind(this), 300);
        },

       
        _getVariantColumnKey: function (oCol) {
            //    La filterProperty es siempre la clave más fiable cuando existe.
            var sFilter = oCol.getFilterProperty && oCol.getFilterProperty();
            if (sFilter) return sFilter;

            var sId = oCol.getId() || "";
            var sSuffix = sId.split("--").pop() || sId;

            //    Si el sufijo tiene formato de ID automático (__columnN) se intenta
            // obtener el texto de la primera etiqueta para garantizar estabilidad entre
            // sesiones independientemente del orden de navegación del usuario.
            if (sSuffix.indexOf("__") === 0) {
                try {
                    var oLabel = oCol.getLabel();
                    var sText = "";
                    if (oLabel) {
                        if (typeof oLabel.getText === "function") {
                            sText = oLabel.getText();
                        }
                        //    Las cabeceras de la TreeTable usan VBox como label;
                        // se busca el primer Label o Text dentro de sus items.
                        if (!sText && typeof oLabel.getItems === "function") {
                            var aItems = oLabel.getItems();
                            for (var i = 0; i < aItems.length; i++) {
                                if (typeof aItems[i].getText === "function") {
                                    sText = aItems[i].getText();
                                    if (sText) break;
                                }
                            }
                        }
                    }
                    if (sText && sText.trim()) {
                        //    Se normaliza el texto eliminando espacios y caracteres
                        // especiales para obtener una clave limpia y comparables.
                        return "lbl__" + sText.trim().replace(/[\s\/\\:{}]/g, "_");
                    }
                } catch (e) {
                    //    Si la extracción falla se usa el ID nativo como último recurso.
                }
            }
            return sSuffix;
        },

        /**
         * Se localiza el TreeTable contenedor a partir de un control descendiente (SearchField).   
         */
        _findHostTreeTable: function (oControl) {
            // Se asciende por la jerarquia de controles hasta encontrar el TreeTable.   
            while (oControl && !(oControl instanceof sap.ui.table.TreeTable)) {
                oControl = oControl.getParent();
            }
            return oControl || null;
        },


        onOperacionSearch: function (oEvent) {
            // Se obtiene el valor desde search (query) o desde la seleccion de una sugerencia.   
            var sQuery = oEvent.getParameter("query");
            if (sQuery === undefined) {
                var oSelected = oEvent.getParameter("selectedItem");
                if (oSelected && typeof oSelected.getText === "function") {
                    sQuery = oSelected.getText();
                } else {
                    sQuery = oEvent.getSource().getValue();
                }
            }
            sQuery = (sQuery || "").trim();

            var oTable = this._findHostTreeTable(oEvent.getSource().getParent());
            if (!oTable) return;
            var oBindingInfo = oTable.getBindingInfo("rows");
            if (!oBindingInfo) return;
            var oModel = oTable.getModel(oBindingInfo.model);
            if (!oModel) return;
            var oBinding = oTable.getBinding("rows");
            if (!oBinding) return;

            // Se mantiene un mapa de respaldo por cada TreeTable para no mezclar estados entre vistas.   
            this._oOperacionSearchBackups = this._oOperacionSearchBackups || {};
            var sTableId = oTable.getId();

            // Si ya habia una busqueda activa se restaura primero el arbol original antes de aplicar la nueva.
            if (this._oOperacionSearchBackups[sTableId]) {
                oModel.setProperty("/", this._oOperacionSearchBackups[sTableId]);
                delete this._oOperacionSearchBackups[sTableId];
            }
            oBinding.filter([]);

            // Si no hay texto la tabla queda restaurada y no se aplica filtrado.
            //   Tras restaurar el arbol original se reaplican las clases de estilo
            // (headerGrayRow, sinProveedorRow, agrupadorTotalRow) y el borde
            // naranja, ya que el re-render del binding las elimina.
            if (!sQuery) {
                setTimeout(function () {
                    this._highlightSinProveedor(oTable);
                    this._applyBlockBorder(oTable);
                    if (typeof this.colorRows === "function") {
                        this.colorRows();
                    }
                }.bind(this), 0);
                return;
            }

            // Se almacena la referencia del arbol original para poder restaurarlo al limpiar la busqueda.   
            var aOriginalRoot = oModel.getProperty("/");
            this._oOperacionSearchBackups[sTableId] = aOriginalRoot;

            var sLower = sQuery.toLowerCase();

            // Se detecta si la consulta coincide exactamente con algun PhPspnr existente en los datos originales.   
            // En ese caso (tipico tras seleccionar una sugerencia) se usa coincidencia exacta para no traer falsos positivos por descripcion.   
            var bExactExists = false;
            (function findExact(aNodes) {
                if (!Array.isArray(aNodes) || bExactExists) return;
                aNodes.forEach(function (oNode) {
                    if (bExactExists) return;
                    if (oNode && oNode.PhPspnr !== undefined && oNode.PhPspnr !== null && String(oNode.PhPspnr).toLowerCase() === sLower) {
                        bExactExists = true;
                        return;
                    }
                    if (oNode && Array.isArray(oNode.children)) findExact(oNode.children);
                });
            })(aOriginalRoot);

            // Se determina si un nodo concreto coincide; en modo exacto solo PhPspnr identico, en modo fuzzy contains sobre PhPspnr o Post1.   
            function matchesNode(oNode) {
                if (!oNode) return false;
                var sCode = (oNode.PhPspnr !== undefined && oNode.PhPspnr !== null) ? String(oNode.PhPspnr).toLowerCase() : "";
                if (bExactExists) {
                    return sCode === sLower;
                }
                if (sCode && sCode.indexOf(sLower) !== -1) return true;
                if (oNode.Post1 && String(oNode.Post1).toLowerCase().indexOf(sLower) !== -1) return true;
                return false;
            }

            // Se construye recursivamente la lista de nodos visibles para un nivel dado.   
            // Los wrappers estructurales (padres con un unico hijo y sin coincidencia propia) se omiten promoviendo a sus hijos al nivel superior.   
            function buildFiltered(aNodes) {
                if (!Array.isArray(aNodes)) return [];
                var aResult = [];
                aNodes.forEach(function (oNode) {
                    if (!oNode) return;
                    var bSelfMatch = matchesNode(oNode);
                    var aOrigChildren = Array.isArray(oNode.children) ? oNode.children : [];
                    var aFilteredChildren = aOrigChildren.length > 0 ? buildFiltered(aOrigChildren) : [];

                    if (aFilteredChildren.length > 0) {
                        if (aOrigChildren.length > 1) {
                            // Padre real (con varios hijos): se muestra con los hijos coincidentes.   
                            if (aFilteredChildren.length === aOrigChildren.length) {
                                // Si no se altera la lista de hijos se reutiliza el nodo original para preservar referencias.   
                                aResult.push(oNode);
                            } else {
                                // Si se filtra la lista de hijos se necesita una copia con la nueva aggregation.   
                                var oCopy = Object.assign({}, oNode);
                                oCopy.children = aFilteredChildren;
                                aResult.push(oCopy);
                            }
                        } else {
                            // Wrapper estructural (un solo hijo): se omite y se promueven los hijos al nivel actual.   
                            aFilteredChildren.forEach(function (oChild) { aResult.push(oChild); });
                        }
                    } else if (bSelfMatch) {
                        // El nodo coincide por si mismo y no tiene descendientes coincidentes: se incluye con sus hijos originales (si los hubiera).   
                        aResult.push(oNode);
                    }
                });
                return aResult;
            }

            var aNewRoot = buildFiltered(aOriginalRoot);
            oModel.setProperty("/", aNewRoot);

            // Se expanden todos los niveles para que los hijos coincidentes sean visibles bajo sus padres reales.
            //   Despues del expand se reaplican las clases de estilo de las filas
            // (headerGrayRow, sinProveedorRow, agrupadorTotalRow) y el borde
            // naranja, porque el re-render provocado por el cambio del modelo
            // y por expandToLevel descarta las clases anadidas dinamicamente.
            if (typeof oTable.expandToLevel === "function") {
                setTimeout(function () {
                    oTable.expandToLevel(99);
                    setTimeout(function () {
                        this._highlightSinProveedor(oTable);
                        this._applyBlockBorder(oTable);
                        if (typeof this.colorRows === "function") {
                            this.colorRows();
                        }
                    }.bind(this), 50);
                }.bind(this), 0);
            }
        },

        /**
         * Se reabre el popover de sugerencias tras pulsar la X de borrado del SearchField.   
         * Sin esto el campo queda enfocado pero sin popover, y un nuevo clic sobre el mismo SearchField   
         * no desencadena ningun evento de focus, por lo que las opciones no reaparecerian.   
         */
        onOperacionLiveChange: function (oEvent) {
            // Solo se actua cuando el campo se vacia (caso tipico tras pulsar la X).   
            var sNewValue = oEvent.getParameter("newValue");
            if (sNewValue !== "") return;

            var oSearchField = oEvent.getSource();
            var that = this;

            // Se difiere la apertura del popover para asegurar que el ciclo de eventos del control de busqueda haya terminado.   
            setTimeout(function () {
                var oFakeEvent = {
                    getSource: function () { return oSearchField; },
                    getParameter: function (sName) { return sName === "suggestValue" ? "" : undefined; }
                };
                that.onOperacionSuggest(oFakeEvent);
            }, 0);
        },

        /**
         * Se rellenan las sugerencias del SearchField con los codigos PhPspnr disponibles en el modelo del TreeTable,   
         * mostrando la descripcion (Post1) como texto adicional para facilitar la identificacion.   
         * Se utiliza un binding sobre un modelo dedicado para evitar invalidaciones masivas (destroy/add)   
         * que provocaban un bucle de renderizado del nucleo de UI5 ("Rendering has been re-started too many times").   
         */
        onOperacionSuggest: function (oEvent) {
            var oSearchField = oEvent.getSource();
            var sValue = (oEvent.getParameter("suggestValue") || "").toLowerCase();

            var oTable = this._findHostTreeTable(oSearchField.getParent());
            if (!oTable) return;

            // Se obtiene el modelo asociado al binding de filas para recorrer la jerarquia de datos.   
            var oBindingInfo = oTable.getBindingInfo("rows");
            if (!oBindingInfo) return;
            var oSourceModel = oTable.getModel(oBindingInfo.model);
            if (!oSourceModel) return;

            // Se inicializa una sola vez el modelo y el binding de la aggregation suggestionItems.   
            // Las actualizaciones posteriores se realizan con un unico setProperty para no invalidar el control multiples veces.   
            var oSuggestModel = oSearchField.getModel("opSugg");
            if (!oSuggestModel) {
                oSuggestModel = new JSONModel({ items: [] });
                oSuggestModel.setSizeLimit(500);
                oSearchField.setModel(oSuggestModel, "opSugg");
                oSearchField.bindAggregation("suggestionItems", {
                    path: "opSugg>/items",
                    template: new SuggestionItem({
                        text: "{opSugg>code}",
                        description: "{opSugg>desc}"
                    }),
                    templateShareable: false
                });
            }

            // Si hay un filtro activo el modelo contiene solo el subarbol filtrado, por lo que se usa el respaldo   
            // para que las sugerencias sigan mostrando todas las opciones disponibles en los datos originales.   
            this._oOperacionSearchBackups = this._oOperacionSearchBackups || {};
            var aData = this._oOperacionSearchBackups[oTable.getId()] || oSourceModel.getProperty("/");

            // Se recorre el arbol de forma recursiva acumulando codigos unicos en cualquier nivel.
            //  Se excluyen las filas de cabecera gris (agrupadores con __isHeader o cabecera
            //  a true, fila "Agrupador" dinamica y la raiz OEO "D") porque no son operaciones
            //  reales sino etiquetas estructurales y no deben aparecer como sugerencia.
              var rLeafCode = /^I\.\d{3}\.\d{3}$/;
            var oSeen = {};
            var aItems = [];
            function isHeaderNode(oNode) {
                return oNode.__isHeader === true
                    || oNode.cabecera === true
                    || oNode.PhPspnr === "Agrupador"
                    || oNode.PhPspnr === "D";
            }
            function collect(aNodes) {
                if (!Array.isArray(aNodes)) return;
                aNodes.forEach(function (oNode) {
                    if (!oNode) return;
                    var sCode = oNode.PhPspnr;
                    if (sCode !== undefined && sCode !== null && sCode !== "" && !oSeen[sCode] && !isHeaderNode(oNode) && rLeafCode.test(String(sCode))) {
                        oSeen[sCode] = true;
                        aItems.push({ code: String(sCode), desc: oNode.Post1 ? String(oNode.Post1) : "" });
                    }
                    if (Array.isArray(oNode.children)) collect(oNode.children);
                });
            }
            collect(aData);

            // Se filtran las sugerencias segun el texto actual y se limita el numero mostrado.   
            var aFiltered = sValue ? aItems.filter(function (oIt) {
                return oIt.code.toLowerCase().indexOf(sValue) !== -1
                    || oIt.desc.toLowerCase().indexOf(sValue) !== -1;
            }) : aItems;

            // Se actualiza el modelo de sugerencias con una unica operacion para evitar bucles de render.   
            oSuggestModel.setProperty("/items", aFiltered.slice(0, 50));

            // Se fuerza la apertura del popover de sugerencias para que el usuario vea las opciones disponibles mientras escribe.   
            if (typeof oSearchField.suggest === "function") {
                oSearchField.suggest();
            }
        },

        /**
         * Se abre el popover de seleccion de variantes.
         * Cuando la variante activa no es la estandar y tiene cambios pendientes
         * se muestra un boton adicional para guardar directamente sin pedir nombre.
         */
        onOpenVariantPopover: function (oEvt) {
            const oSource = oEvt.getSource();
            const oVModel = this.getView().getModel("variantModel");
            const that = this;

            if (this._oVariantPopover) {
                this._oVariantPopover.destroy();
                this._oVariantPopover = null;
            }

            const oList = new sap.m.List({ showSeparators: "None" });

            this._aVariants.forEach(function (oVar) {
                const bActiva = oVar.name === oVModel.getProperty("/currentName");
                const oItem = new sap.m.StandardListItem({
                    //   Se traduce el nombre de la variante por defecto
                    // al mostrarla en el popover; otros nombres pasan tal cual.  
                    title: that._translateVariantName(oVar.name),
                    //  
                    type: "Active",
                    highlight: bActiva ? "Information" : "None"
                });
                oItem.attachPress(function () {
                    that._oVariantPopover.close();
                    that._switchToVariant(oVar);
                });
                oList.addItem(oItem);
            });

            // Se determina si la variante activa es la estandar para decidir si
            // se muestra el boton de guardado directo.
            const sCurrentName = oVModel.getProperty("/currentName");
            const oCurrentVariant = this._aVariants.find(function (v) { return v.name === sCurrentName; });
            const bIsDefault = oCurrentVariant && oCurrentVariant.isDefault;
            const bShowSave = !bIsDefault && this._bVariantDirty;

            const aFooterContent = [];

            // Se anade el boton de guardado directo solo cuando procede.
            if (bShowSave) {
                aFooterContent.push(new sap.m.Button({
                    //   Se traduce via i18n para soportar EN/FR.  
                    text: this.getTranslatedText("btnGuardar"),
                    //  
                    type: "Emphasized",
                    press: function () {
                        that._oVariantPopover.close();

                        // Se sobreescribe el estado de la variante activa con la configuracion actual.
                        const oCurrentState = that._getCurrentTableState();
                        if (oCurrentVariant) {
                            oCurrentVariant.state = oCurrentState;
                        }
                        that._saveVariantsToStorage();
                        //   Se traduce el nombre al mostrarlo.  
                        oVModel.setProperty("/displayLabel", that._translateVariantName(sCurrentName));
                        //  
                        that._bVariantDirty = false;
                    }
                }));
            }

            aFooterContent.push(new sap.m.Button({
                //   Se traduce via i18n para soportar EN/FR.  
                text: this.getTranslatedText("variantSaveAsBtn"),
                //  
                type: bShowSave ? "Default" : "Emphasized",
                press: function () {
                    that._oVariantPopover.close();
                    that.onSaveVariantAs();
                }
            }));

            aFooterContent.push(new sap.m.ToolbarSpacer());

            aFooterContent.push(new sap.m.Button({
                //   Se traduce via i18n para soportar EN/FR.  
                text: this.getTranslatedText("variantManageBtn"),
                //  
                press: function () {
                    that._oVariantPopover.close();
                    that.onManageVariants();
                }
            }));

            const oFooter = new sap.m.Toolbar({ content: aFooterContent });

            this._oVariantPopover = new sap.m.Popover({
                //   Se traduce el titulo del popover via i18n.  
                title: this.getTranslatedText("variantPopoverTitle"),
                //  
                contentWidth: "300px",
                // Se fuerza la apertura hacia abajo porque el boton se ha movido al extremo derecho de la barra y la apertura por defecto quedaria fuera de la pantalla.   
                placement: sap.m.PlacementType.Bottom,
                content: [oList],
                footer: oFooter,
                afterClose: function () {
                    if (that._oVariantPopover) {
                        that._oVariantPopover.destroy();
                        that._oVariantPopover = null;
                    }
                }
            });

            this.getView().addDependent(this._oVariantPopover);
            this._oVariantPopover.openBy(oSource);
        },

        /**
         * Se cambia a la variante seleccionada aplicando su estado guardado a la tabla.
         * Si hay cambios pendientes sin guardar se solicita confirmacion al usuario
         * antes de proceder para evitar la perdida accidental de modificaciones.
         */
        _switchToVariant: function (oVar) {
            var oVModel = this.getView().getModel("variantModel");
            var that = this; //    Se preserva el contexto del controlador.

            if (this._bVariantDirty) {
                sap.m.MessageBox.confirm(
                    //   Se traduce el mensaje via i18n.  
                    this.getTranslatedText("variantUnsavedChanges"),
                    //  
                    {
                        onClose: function (sAction) {
                            if (sAction === sap.m.MessageBox.Action.OK) {
                                //    Aquí 'that' debe tener la referencia al controlador.
                                that._doSwitchToVariant(oVar);
                            }
                        }
                    }
                );
            } else {
                this._doSwitchToVariant(oVar);
            }
        },

        /**
         *    La función ejecuta la lógica técnica del cambio de estado de una variante.
         *    Se encarga de restaurar columnas, datos y delta del modelo.
         */
        _doSwitchToVariant: function (oVar) {
            //    Se obtiene el modelo de variantes
            const oVModel = this.getView().getModel("variantModel");

            //    Se desactiva temporalmente el indicador de cambios pendientes y la propagación de eventos
            this._bVariantDirty = false;
            this._bSuppressDirtyFlag = true;

            //    Determina si la variante es la estándar (sin estado guardado o con nombre Standard/Estándar)
            var bIsStandardVariant = (!oVar.state || oVar.name === "Estándar" || oVar.name === "Standard");

            //    Si hay un método de reset específico en el controlador hijo (ej. Anticipados), se ejecuta
            if (bIsStandardVariant && typeof this._applyStandardReset === "function") {
                this._applyStandardReset();

                //    Se actualiza el modelo de variantes tras el reset manual
                if (oVModel) {
                    oVModel.setProperty("/currentName", oVar.name);
                    //   Se traduce el nombre al mostrarlo.  
                    oVModel.setProperty("/displayLabel", this._translateVariantName(oVar.name));
                    //  
                    oVModel.setProperty("/isDirty", false);
                }

                this._bSuppressDirtyFlag = false;
                return;
            }

            //    Si la variante tiene un estado guardado, se aplica directamente
            if (oVar.state) {
                this._applyVariantState(oVar.state);
            } else if (this._originalServerData) {
                //    Si es estándar pero no hay reset específico, se aplica lógica genérica
                this._savedColWidths = {};
                this._openedYear = null;

                //    Restauración de los datos originales del servidor
                const oModel = this.getView().getModel(this.tableModelName);
                if (oModel) {
                    oModel.setData(JSON.parse(JSON.stringify(this._originalServerData)));
                }

                //    Se eliminan columnas dinámicas de meses o ejecutados que puedan estar abiertas
                const oTableForClose = this.getControlTable();
                if (oTableForClose) {
                    oTableForClose.getColumns()
                        .filter(c => c.data("dynamicMonth") || c.data("ejecutadosColumn"))
                        .forEach(c => oTableForClose.removeColumn(c));
                }

                //    Se restauran anchos predeterminados de columnas dinámicas
                if (oTableForClose) {
                    oTableForClose.getColumns().forEach(oCol => {
                        if (oCol.data("dynamicYear") && !oCol.data("ejecutadosColumn")) {
                            oCol.setWidth("8rem");
                        } else if (oCol.data("ejecutadosColumn")) {
                            oCol.setWidth("130px");
                        }
                    });
                }

                //    Restauración de visibilidad y orden de columnas estáticas usando la primera variante guardada
                const oInitialState = this._aVariants[0] && this._aVariants[0].state;
                if (oInitialState && oInitialState.columns?.length && oTableForClose) {
                    const aStaticCols = oTableForClose.getColumns().filter(oCol =>
                        !oCol.data("dynamicYear") && !oCol.data("dynamicMonth") && !oCol.data("ejecutadosColumn")
                    );

                    const oKeyToCol = {};
                    aStaticCols.forEach(oCol => { oKeyToCol[this._getVariantColumnKey(oCol)] = oCol; });

                    aStaticCols.forEach(oCol => oTableForClose.removeColumn(oCol));

                    oInitialState.columns.forEach((oSaved, iPos) => {
                        const oCol = oKeyToCol[oSaved.key];
                        if (oCol) {
                            oCol.setWidth(oSaved.width);
                            oCol.setVisible(oSaved.visible);
                            oTableForClose.insertColumn(oCol, iPos);
                        }
                    });
                }

                //    Reabre el primer año por defecto tras un breve retardo
                setTimeout(() => {
                    const oTbl = this.getControlTable();
                    if (!oTbl || this._openedYear) return;

                    const oPrimerAnioCol = oTbl.getColumns().find(c => c.data("dynamicYear") && !c.data("ejecutadosColumn"));
                    if (!oPrimerAnioCol) return;

                    this.onCreateMonthsTable({
                        getSource: () => ({
                            getMetadata: () => ({ getName: () => "sap.m.Button" }),
                            getText: () => String(oPrimerAnioCol.data("year")),
                            data: sKey => oPrimerAnioCol.data(sKey)
                        })
                    });
                }, 200);
            }

            //    Actualización final del modelo de variantes con el nombre de la variante activa
            if (oVModel) {
                oVModel.setProperty("/currentName", oVar.name);
                //   Se traduce el nombre al mostrarlo.  
                oVModel.setProperty("/displayLabel", this._translateVariantName(oVar.name));
                //  
            }

            //    Se libera la supresión de eventos tras completar la restauración
            setTimeout(() => { this._bSuppressDirtyFlag = false; }, 100);
        },

        /**
         * Se abre el dialogo para guardar la configuracion actual con un nombre personalizado.
         * Incluye la opcion para definir la variante como estandar al guardar.
         */
        onSaveVariantAs: function () {
            const oVModel = this.getView().getModel("variantModel");
            const that = this;

            //   Se traducen via i18n el placeholder, la casilla,
            // el titulo del dialogo, la etiqueta y los botones.  
            const oInput = new sap.m.Input({
                value: oVModel.getProperty("/currentName"),
                placeholder: this.getTranslatedText("variantNamePlaceholder"),
                width: "100%"
            });

            // Se crea la casilla para definir la variante como estandar al guardar.
            const oCheckDefault = new sap.m.CheckBox({
                text: this.getTranslatedText("variantSetAsDefault"),
                selected: false
            }).addStyleClass("noLabelOverride");

            const oDialog = new sap.m.Dialog({
                title: this.getTranslatedText("variantSaveAsTitle"),
                contentWidth: "320px",
                content: [
                    new sap.m.VBox({
                        renderType: "Bare",
                        items: [
                            new sap.m.Label({
                                text: this.getTranslatedText("variantView"),
                                labelFor: oInput
                            }).addStyleClass("noLabelOverride"),
                            oInput,
                            oCheckDefault
                        ]
                    }).addStyleClass("sapUiSmallMargin")
                ],
                beginButton: new sap.m.Button({
                    text: this.getTranslatedText("btnGuardar"),
                    type: "Emphasized",
                    press: function () {
                        const sName = (oInput.getValue() || "").trim();
                        if (!sName) return;

                        // Se captura el estado actual de la tabla en el momento del guardado.
                        const oCurrentState = that._getCurrentTableState();

                        // Se sobreescribe si ya existe una variante con el mismo nombre.
                        const iExisting = that._aVariants.findIndex(function (v) {
                            return v.name === sName;
                        });
                        if (iExisting >= 0) {
                            that._aVariants[iExisting].state = oCurrentState;
                        } else {
                            that._aVariants.push({
                                name: sName,
                                state: oCurrentState
                            });
                        }

                        // Si el usuario marco la casilla de estandar se actualiza el por defecto.
                        if (oCheckDefault.getSelected()) {
                            that._aVariants.forEach(function (v) { v.isPorDefecto = false; });
                            const oNewVar = that._aVariants.find(function (v) {
                                return v.name === sName;
                            });
                            if (oNewVar) oNewVar.isPorDefecto = true;
                        }

                        that._saveVariantsToStorage();

                        // Se actualiza el nombre activo y se elimina el indicador de cambios.
                        oVModel.setProperty("/currentName", sName);
                        //   Se traduce el nombre al mostrarlo.  
                        oVModel.setProperty("/displayLabel", that._translateVariantName(sName));
                        //  
                        that._bVariantDirty = false;

                        oDialog.close();
                    }
                }),
                endButton: new sap.m.Button({
                    text: this.getTranslatedText("btnCancelar"),
                    press: function () { oDialog.close(); }
                }),
                afterClose: function () { oDialog.destroy(); }
            });
            //  

            this.getView().addDependent(oDialog);
            oDialog.open();
        },


        /**
         * Se abre el dialogo de gestion de variantes con estructura de tabla
         * similar al componente nativo de SAP, incluyendo busqueda, columnas
         * de por defecto y creado por, con posibilidad de eliminar las variantes
         * propias y establecer una como predeterminada.
         */
    
onManageVariants: function () {
            const oVModel = this.getView().getModel("variantModel");
            const that = this;

            // Se crea el modelo interno del dialogo con una copia de las variantes actuales
            // para poder editar sin afectar el estado real hasta que el usuario confirme.
            const aDialogData = this._aVariants.map(function (oVar) {
                return {
                    name: oVar.name,
                    isDefault: oVar.isDefault || false,
                    isPorDefecto: oVar.isPorDefecto || false,
                    //    Se traduce la etiqueta "Usted" via i18n para
                    // soportar EN/FR; "SAP" permanece como nombre propio. Se
                    // usa that (capturado al inicio de onManageVariants) en
                    // vez de this porque dentro de .map(function(){}) el
                    // this no apunta al controlador y rompia la apertura del
                    // dialogo de Gestionar variantes.  
                    createdBy: oVar.isDefault ? "SAP" : that.getTranslatedText("variantCreatedBySelf"),
                    //   
                    ref: oVar
                };
            });

            // Se construye la cabecera de columnas de la tabla de gestion sin la columna
            // de compartimiento ya que la visibilidad publica o privada no es necesaria.
            const oTable = new sap.m.Table({
                showSeparators: "All",
                mode: "None",
                columns: [
                    new sap.m.Column({ width: "2rem" }),
                    //   Se traducen las cabeceras del dialogo de gestion de variantes via i18n para soportar EN/FR.  
                    new sap.m.Column({
                        header: new sap.m.Label({ text: this.getTranslatedText("variantView") })
                    }),
                    new sap.m.Column({
                        header: new sap.m.Label({ text: this.getTranslatedText("variantDefault") }),
                        width: "6rem",
                        hAlign: "Center"
                    }),
                    new sap.m.Column({
                        header: new sap.m.Label({ text: this.getTranslatedText("variantCreatedBy") }),
                        width: "6rem"
                    }),
                    //  
                    new sap.m.Column({ width: "2rem" })
                ]
            });

            // Se define la funcion auxiliar que construye el icono de estrella para cada fila.
            const fnBuildStarIcon = function (oItemRef) {
                const oIcon = new sap.ui.core.Icon({
                    src: "sap-icon://favorite",
                    color: oItemRef.isPorDefecto ? "#0070f2" : "#c0c0c0"
                }).addStyleClass("sapUiTinyMarginTop");

                // Se asigna el handler de pulsacion solo si la variante no es ya la por defecto.
                if (!oItemRef.isPorDefecto) {
                    oIcon.attachPress(function () {
                        aDialogData.forEach(function (v) { v.isPorDefecto = false; });
                        oItemRef.isPorDefecto = true;
                        fnRefreshStarsAndRadios();
                    });
                    oIcon.addStyleClass("sapUiPointer");
                }

                return oIcon;
            };

            // Se define la funcion que actualiza unicamente el color de las estrellas y el
            // estado de los radio buttons sin destruir ni recrear ninguna fila de la tabla.
            const fnRefreshStarsAndRadios = function () {
                oTable.getItems().forEach(function (oRow) {
                    const oItemRef = oRow.data("itemRef");
                    if (!oItemRef) return;

                    const oCells = oRow.getCells();

                    // Se actualiza el color de la estrella y su capacidad de pulsacion.
                    const oStar = oCells[0];
                    if (oStar && oStar.isA("sap.ui.core.Icon")) {
                        oStar.setColor(oItemRef.isPorDefecto ? "#0070f2" : "#c0c0c0");
                        if (oItemRef.isPorDefecto) {
                            oStar.removeStyleClass("sapUiPointer");
                            oStar.detachPress(oStar._fnStarPress);
                            oStar._fnStarPress = null;
                        } else if (!oStar._fnStarPress) {
                            oStar._fnStarPress = function () {
                                aDialogData.forEach(function (v) { v.isPorDefecto = false; });
                                oItemRef.isPorDefecto = true;
                                fnRefreshStarsAndRadios();
                            };
                            oStar.attachPress(oStar._fnStarPress);
                            oStar.addStyleClass("sapUiPointer");
                        }
                    }

                    // Se actualiza el radio button sin recrear la fila.
                    // La columna de por defecto es ahora el indice 2 al haberse eliminado
                    // la columna de compartimiento que ocupaba ese puesto anteriormente.
                    const oRadio = oCells[2];
                    if (oRadio && oRadio.isA("sap.m.RadioButton")) {
                        oRadio.setSelected(oItemRef.isPorDefecto);
                    }
                });
            };

            // Se define la funcion que construye y anade una sola fila a la tabla.
            const fnBuildRow = function (oItem) {
                const oRow = new sap.m.ColumnListItem({
                    cells: [
                        // Se construye la estrella mediante la funcion auxiliar.
                        fnBuildStarIcon(oItem),

                        // Se muestra el nombre de la variante, editable si no es estandar.
                        oItem.isDefault
                            //   Se traduce el nombre de la variante por
                            // defecto al mostrarlo (es no editable). Las propias
                            // del usuario muestran el nombre canonico tal cual.  
                            ? new sap.m.Text({ text: that._translateVariantName(oItem.name) }).addStyleClass("sapMTextBold")
                            //  
                            : new sap.m.Input({
                                value: oItem.name,
                                width: "100%",
                                change: function (oEvt) {
                                    // Se actualiza el nombre directamente en el objeto de datos
                                    // de esta fila sin afectar a las demas filas de la tabla.
                                    oItem.name = oEvt.getParameter("value");
                                }
                            }),

                        // Se muestra el radio button de por defecto.
                        new sap.m.RadioButton({
                            selected: oItem.isPorDefecto,
                            groupName: "variantDefault",
                            select: function () {
                                aDialogData.forEach(function (v) { v.isPorDefecto = false; });
                                oItem.isPorDefecto = true;
                                fnRefreshStarsAndRadios();
                            }
                        }),

                        new sap.m.Text({ text: oItem.createdBy }),

                        // Se muestra el icono de eliminacion solo para las variantes propias.
                        oItem.isDefault
                            ? new sap.m.Text({ text: "" })
                            : new sap.ui.core.Icon({
                                src: "sap-icon://delete",
                                color: "#0070f2",
                                press: function () {
                                    // Se elimina el item del array de datos.
                                    const iIdx = aDialogData.indexOf(oItem);
                                    if (iIdx >= 0) aDialogData.splice(iIdx, 1);

                                    // Se elimina unicamente esta fila de la tabla
                                    // sin recrear ni tocar ninguna otra fila.
                                    oTable.removeItem(oRow);
                                    oRow.destroy();
                                }
                            }).addStyleClass("sapUiTinyMarginTop sapUiPointer")
                    ]
                });

                // Se almacena una referencia directa al objeto de datos en la fila.
                oRow.data("itemRef", oItem);

                return oRow;
            };

            // Se define la funcion que filtra las filas visibles segun la busqueda.
            const fnApplyFilter = function (sQuery) {
                oTable.getItems().forEach(function (oRow) {
                    const oItemRef = oRow.data("itemRef");
                    if (!oItemRef) return;
                    const bVisible = !sQuery ||
                        oItemRef.name.toLowerCase().indexOf(sQuery.toLowerCase()) !== -1;
                    oRow.setVisible(bVisible);
                });
            };

            // Se pintan todas las filas una sola vez al abrir el dialogo.
            aDialogData.forEach(function (oItem) {
                oTable.addItem(fnBuildRow(oItem));
            });

            // Se construye la barra de busqueda superior del dialogo.
            const oSearchField = new sap.m.SearchField({
                //   Se traduce el placeholder via i18n (clave BUSCAR ya existente).  
                placeholder: this.getTranslatedText("BUSCAR"),
                //  
                width: "100%",
                search: function (oEvt) {
                    fnApplyFilter(oEvt.getParameter("query") || "");
                },
                liveChange: function (oEvt) {
                    fnApplyFilter(oEvt.getParameter("newValue") || "");
                }
            });

            //   Se traducen via i18n el titulo del dialogo de
            // gestion y los dos botones (Guardar / Cancelar).  
            const oDialog = new sap.m.Dialog({
                title: this.getTranslatedText("variantManageTitle"),
                resizable: true,
                draggable: true,
                contentWidth: "500px",
                contentHeight: "350px",
                content: [
                    new sap.m.VBox({
                        items: [oSearchField, oTable]
                    })
                ],
                beginButton: new sap.m.Button({
                    text: this.getTranslatedText("btnGuardar"),
                    type: "Emphasized",
                    press: function () {
                        // Se aplican los cambios de nombre y por defecto al array real de variantes.
                        aDialogData.forEach(function (oItem) {
                            const oReal = oItem.ref;
                            if (oReal) {
                                oReal.name = oItem.name;
                                oReal.isPorDefecto = oItem.isPorDefecto;
                            }
                        });

                        // Se eliminan del array real las variantes que el usuario borro en el dialogo.
                        that._aVariants = that._aVariants.filter(function (oVar) {
                            return aDialogData.some(function (oItem) { return oItem.ref === oVar; });
                        });

                        // Se verifica si la variante activa fue eliminada y en ese caso
                        // se cambia automaticamente a la estandar para evitar un estado inconsistente.
                        const sCurrentName = oVModel.getProperty("/currentName");
                        const bCurrentStillExists = that._aVariants.some(function (v) {
                            return v.name === sCurrentName;
                        });
                        if (!bCurrentStillExists) {
                            that._doSwitchToVariant(that._aVariants[0]);
                        }

                        that._saveVariantsToStorage();
                        oDialog.close();
                    }
                }),
                endButton: new sap.m.Button({
                    text: this.getTranslatedText("btnCancelar"),
                    press: function () { oDialog.close(); }
                }),
                afterClose: function () { oDialog.destroy(); }
            });
            //  

            this.getView().addDependent(oDialog);
            oDialog.open();
        },

        /**
         * Se persisten en el almacenamiento local las variantes no estandar.
         */
        _saveVariantsToStorage: function () {
            try {
                const aToSave = this._aVariants.filter(function (v) { return !v.isDefault; });
                // Se guarda tambien el nombre de la variante marcada como por defecto
                // para poder restaurarla automaticamente al recargar la pagina.
                const sDefaultVariant = (this._aVariants.find(function (v) {
                    return v.isPorDefecto;
                }) || {}).name || "Estándar";

                localStorage.setItem(this._variantStorageKey, JSON.stringify(aToSave));
                localStorage.setItem(this._variantStorageKey + "_default", sDefaultVariant);
            } catch (e) {
                sap.base.Log.warning("No se pudo guardar la variante: " + e);
            }
        },

        /**
         * Se recuperan del almacenamiento local las variantes guardadas.
         * Se devuelve siempre la variante estandar en primera posicion.
         */
        _loadVariantsFromStorage: function () {
            const aResult = [{ name: "Estándar", state: null, isDefault: true }];
            try {
                const sRaw = localStorage.getItem(this._variantStorageKey);
                if (sRaw) {
                    const aParsed = JSON.parse(sRaw);
                    if (Array.isArray(aParsed)) {
                        aParsed.forEach(function (v) { aResult.push(v); });
                    }
                }
            } catch (e) {
                sap.base.Log.warning("No se pudieron cargar las variantes: " + e);
            }
            return aResult;
        },
        /**
         * Se instancia un diálogo de mensajes global y se ancla al ciclo de vida de la vista actual.
         */
        /**
         * Se obtiene el controlador de la vista principal (Main).
         * Se sube por la jerarquía del componente para localizar el App controller
         * y desde él se accede a la página activa que contiene el Main controller.
         * Devuelve null si no está disponible (p.ej. durante la inicialización).
         */
        _getMainController: function () {
            try {
                var oRootView = this.getOwnerComponent().getRootControl();
                // oRootView es App.view.xml (XMLView). Dentro hay un sap.m.App con id="app".
                var oAppControl = oRootView && oRootView.byId && oRootView.byId("app");
                if (oAppControl && typeof oAppControl.getCurrentPage === "function") {
                    var oMainView = oAppControl.getCurrentPage();
                    if (oMainView && typeof oMainView.getController === "function") {
                        return oMainView.getController();
                    }
                }
            } catch (e) { /* se ignora: la jerarquía puede no estar lista */ }
            return null;
        },

        /**
         * Convierte el tipo de mensaje usado en createMessageDialog ("Error","Warning","Success","Information")
         * al código de tipo que espera showMessageInMessageView ("E","W","S","I").
         */
        _mapMessageTypeToTipo: function (sType) {
            var mMap = { "Error": "E", "Warning": "W", "Success": "S", "Information": "I" };
            return mMap[sType] || "E";
        },

        /**
         * Muestra un mensaje de error en el MessagePopover del Main.
         * Si el Main no está disponible, usa MessageBox.error como fallback.
         */
        showErrorMessage: function (sText) {
            this._showMessageViaPopover([{ Tipo: "E", Mensaje: sText }], true);
        },

        /**
         * Muestra un mensaje de advertencia en el MessagePopover del Main.
         * Si el Main no está disponible, usa MessageBox.warning como fallback.
         */
        showWarningMessage: function (sText) {
            this._showMessageViaPopover([{ Tipo: "W", Mensaje: sText }], false);
        },

        /**
         * Muestra un mensaje de éxito en el MessagePopover del Main.
         */
        showSuccessMessage: function (sText) {
            this._showMessageViaPopover([{ Tipo: "S", Mensaje: sText }], false);
        },

        /**
         * Envía un array de mensajes {Tipo, Mensaje} al MessagePopover del Main.
         * Si el Main o el método no están disponibles, hace fallback a MessageBox.
         */
        _showMessageViaPopover: function (aMessages, bForceOpen) {
            var oMain = this._getMainController();
            if (oMain && typeof oMain.showMessageInMessageView === "function") {
                oMain.showMessageInMessageView(aMessages, !!bForceOpen);
                return;
            }
            // Fallback: MessageBox para los errores si el Main aún no está disponible
            var aErrors = aMessages.filter(function (m) { return m.Tipo === "E"; });
            if (aErrors.length > 0) {
                sap.m.MessageBox.error(aErrors.map(function (m) { return m.Mensaje; }).join("\n"));
            }
        },

        createMessageDialog: function (options) {
            // Se detectan los diálogos de carga (tipo Information / showIcon false): se mantiene
            // el comportamiento original del spinner de carga sin redirigir al MessagePopover.
            var aMessages = (options && options.messages) || [];
            var bIsLoading = aMessages.length > 0 &&
                aMessages.every(function (m) {
                    return m.type === "Information" && m.showIcon === false;
                });

            if (!bIsLoading) {
                // Se intenta redirigir al MessagePopover del Main controller.
                var oMain = this._getMainController();
                if (oMain && typeof oMain.showMessageInMessageView === "function") {
                    var that = this;
                    var aMapped = aMessages.map(function (m) {
                        return {
                            Tipo: that._mapMessageTypeToTipo(m.type || "Error"),
                            Mensaje: m.text || ""
                        };
                    });
                    // Se abre automáticamente el popover si hay errores o si el título lo indica.
                    var bHasError = aMapped.some(function (m) { return m.Tipo === "E"; });
                    oMain.showMessageInMessageView(aMapped, bHasError);
                    // Se devuelve un objeto dummy para no romper el código que usa el retorno
                    // (el loading dialog sí usa el retorno, pero este bloque ya lo excluye arriba).
                    return { open: function () {}, close: function () {}, destroy: function () {} };
                }
            }

            // Comportamiento original: diálogo de carga o fallback cuando Main no está disponible.
            const mDialog = messageDialog.createDialog(options, this);
            // Se añade como dependiente para asegurar el enrutamiento de modelos y su destrucción automática con la vista.
            this.getView().addDependent(mDialog);
            mDialog.open();
            return mDialog;
        },

        /**
         *   Se traduce el nombre del capitulo activo (this._pestana)
         * al idioma de UI activo para mostrarlo en exports XLSX (nombre de
         * archivo y de pestanya). this._pestana siempre conserva el valor
         * canonico en castellano ("Corrientes"/"Externos"/...) porque ese es
         * el identificador que el backend espera; este helper SOLO se usa
         * cuando hay que mostrar el nombre al usuario.  
         * @param {string} sPestanaId identificador canonico (castellano)
         * @returns {string} nombre traducido (o el id original si no se reconoce)
         */
        _translateCapituloName: function (sPestanaId) {
            if (!sPestanaId) { return ""; }
            var mIdToKey = {
                "Corrientes":    "corrientes",
                "Anticipados":   "anticipados",
                "Diferidos":     "diferidos",
                "Externos":      "externos",
                "Inmovilizados": "inmovilizados"
            };
            var sKey = mIdToKey[sPestanaId];
            return sKey ? this.getTranslatedText(sKey) : sPestanaId;
        },
        //  

        /**
         *   Se traduce el nombre visible de la variante por defecto.
         * El nombre canonico interno es siempre "Estándar" (asi se almacena en
         * localStorage y asi se comparan las variantes en _doSwitchToVariant),
         * pero al mostrarlo en el popover o en el boton del selector se
         * sustituye por la traduccion de la clave variantDefaultName ("Estándar"
         * / "Standard" / "Standard"). Tambien se reconoce el nombre EN heredado
         * "Standard" para retrocompatibilidad con variantes guardadas antes de
         * la migracion i18n. Cualquier otro nombre (variantes de usuario) se
         * devuelve sin cambios.  
         * @param {string} sName nombre canonico de la variante
         * @returns {string} nombre traducido si es la variante por defecto
         */
        _translateVariantName: function (sName) {
            if (sName === "Estándar" || sName === "Standard") {
                return this.getTranslatedText("variantDefaultName");
            }
            return sName;
        },
        //  

        /**
         *   Se construye la fila de cabecera del bloque proveedor con
         * las etiquetas traducidas via i18n. Antes los textos (Agrupador,
         * Descripcion, Ejecutado, etc.) se hardcodeaban en castellano y se
         * duplicaban en 3 puntos distintos del controlador. Centralizando aqui
         * la construccion se evita la divergencia y se soporta EN/FR. Las
         * claves usadas (agrupador, DESCRIPCION, ejecutado, CostEjAjust,
         * CostEjReal, pendiente, total, dbReparto, pendPlanif, proveedor)
         * ya existen en los 4 bundles.  
         * @returns {object} fila lista para insertar como children de un row
         */
        /**
         * Devuelve true si el desglose de la operacion indicada debe usar el modo
         * "Persona / Puesto de trabajo" en lugar de "Descripcion / Proveedor".
         * Aplica SOLO en Corrientes y SOLO cuando el ultimo segmento del codigo de
         * operacion es 031, 032 o 033 (p.ej. I.003.031). Independiente de la obra.
         */
        _isPersonaPuestoOperation: function (sPhPspnr) {
            if (this.tableModelName !== "corrientesModel") return false;
            if (!sPhPspnr) return false;
            var aParts = String(sPhPspnr).split(".");
            var sLast = aParts[aParts.length - 1];
            return sLast === "031" || sLast === "032" || sLast === "033";
        },

        _getProveedorHeaderRow: function (bPersonaPuesto) {
            //   Se incluyen TANTO los campos PhPspnr/Post1/AmoXxx...
            // (usados por las vistas de Corrientes y Externos que enlazan
            // directamente al modelo del registro) COMO los campos
            // _headerXxx (usados por las vistas de Inmovilizados, Diferidos
            // y Anticipados que enlazan a campos auxiliares). Asi un mismo
            // helper sirve para los 5 capitulos sin que falten celdas en
            // ninguna vista; los campos sobrantes en cada caso son inocuos.
            //   Cuando bPersonaPuesto es true (Corrientes, operaciones .031/.032/.033)
            // las etiquetas de Descripcion y Proveedor pasan a "Persona" y
            // "Puesto de trabajo" respectivamente.
            var sAgrup    = this.getTranslatedText("agrupador");
            var sDescrip  = bPersonaPuesto === true ? this.getTranslatedText("persona") : this.getTranslatedText("DESCRIPCION");
            var sEje      = this.getTranslatedText("ejecutado");
            var sPend     = this.getTranslatedText("pendiente");
            var sTot      = this.getTranslatedText("total");
            var sReparto  = this.getTranslatedText("dbReparto");
            var sPenPlan  = this.getTranslatedText("pendPlanif");
            var sProv     = bPersonaPuesto === true ? this.getTranslatedText("puestoTrabajo") : this.getTranslatedText("proveedor");
            var sValResid = this.getTranslatedText("valorResidual");
            var sPctResid = this.getTranslatedText("percValorResidual");
            return {
                __isCustom: true,
                __isHeader: true,
                __isPersonaPuesto: bPersonaPuesto === true,
                cabecera: false, expandible: false, isGroup: false, padre: false,
                // Campos estilo Corrientes/Externos (binding directo)
                PhPspnr: sAgrup,
                Post1: sDescrip,
                AmoEje: sEje,
                AmoEjeAjus: this.getTranslatedText("CostEjAjust"),
                AmoEjeReal: this.getTranslatedText("CostEjReal"),
                AmoPen: sPend,
                AmoTot: sTot,
                Tipo: sReparto,
                PenPlan: sPenPlan,
                Proveedor: sProv,
                FEE: "", NMES: "", Otros: "",
                // Campos estilo Inmovilizados/Diferidos/Anticipados (binding a _headerXxx)
                _headerAgrup:    sAgrup,
                _headerDescr:    sDescrip,
                _headerProv:     sProv,
                _headerEje:      sEje,
                _headerPend:     sPend,
                _headerTot:      sTot,
                _headerReparto:  sReparto,
                _headerPenPlan:  sPenPlan,
                _headerValResid: sValResid,
                _headerPctResid: sPctResid,
                children: []
            };
        },
        //  

        /**
         * Se recuperan los textos traducidos utilizando la clave proporcionada en el archivo de internacionalización (i18n).
         *   Se anyade el parametro opcional aArgs para que ResourceBundle.getText
         * sustituya los placeholders {0}, {1}, ... directamente, evitando el patron
         * anterior basado en .replace(/\{0\}/g, ...). La firma es retrocompatible
         * con las llamadas existentes que solo pasan la clave.  
         *  
         */
        getTranslatedText: function (key, aArgs) {
            // Se extrae la cadena textual del paquete de recursos alojado a nivel global en el componente.
            return this.getGlobalModel("i18n").getResourceBundle().getText(key, aArgs);
        },

        /**
         * Se abre el selector genérico estandarizado pasándole configuración (columnas, título) y los datos en formato JSON.
         */
        openSelectorDialog: function (options, data) {
            // Se comprueba si ya existía una instancia viva para destruirla y evitar memoria fantasma (memory leaks).
            if (this.selectorDialog) {
                this.selectorDialog.destroy();
            }
            // Se crea el diálogo y se le asocia un modelo plano estructurado.
            this.selectorDialog = selectorDialog.createDialog(options, this);
            const oModel = new JSONModel({ data: data });
            this.selectorDialog.setModel(oModel);
            this.getView().addDependent(this.selectorDialog);
            this.selectorDialog.open();
            return this.selectorDialog;
        },

        /**
         * Se recuperan los tramos asociados a una obra específica realizando una llamada al servicio back-end.
         */
        getTramosByObra: async function (obra) {
            // Se ejecuta una petición POST enrutando la carga útil al OData respectivo y adjuntando cabeceras personalizadas.
            return this.post(
                this.getGlobalModel("mainService"),
                "/SelectTramosSet",
                {
                    "NavTramosProy": [],
                    "NavTramosDatos": []
                },
                {
                    headers: {
                        ambito: obra, // Parámetro crítico que define el entorno organizacional.
                        lang: this.getGlobalModel("appData").getData().userData.AplicationLangu,
                    }
                }
            );
        },


        /**
         * Se genera una captura (snapshot) profunda del modelo actual.
         * Sirve como punto de restauración y como punto de referencia para calcular deltas (cambios no guardados).
         */
        _createSnapshot: function () {
            const oModel = this.getView().getModel();
            if (oModel) {
                // Se genera un clon profundo empleando la combinación parse-stringify para evitar paso por referencia.
                this._originalData = JSON.parse(JSON.stringify(oModel.getData()));
            }
        },

        /**
         * Se restauran todos los controles dinámicos y se sobrescriben con la captura original.
         * Anula efectivamente cualquier edición en vivo del usuario que no haya sido persistida (Guardada).
         */
        resetInputs: function () {
            if (!this._originalData) return;
            const oDefaultModel = this.getView().getModel();

            // Se emplea el extensor profundo de jQuery para construir un nuevo objeto limpio e independiente basado en el snapshot.
            const oResetCopy = jQuery.extend(true, {}, this._originalData);
            oDefaultModel.setData(oResetCopy);
            // Se fuerza al motor reactivo de SAPUI5 a repintar todos los binding afectados.
            oDefaultModel.refresh(true);
        },


        /**
         * Se activa la aplicación algorítmica de la inflación o se restauran los valores crudos, tras interactuar con la casilla respectiva en las filas.
         */
        onInflacionCheckBoxSelect: function (oEvent) {
            const oCheckBox = oEvent.getSource();
            // Se identifica la decisión booleana del usuario.
            const bSelected = oCheckBox.getSelected();
            // Se intercepta el contexto atado al renglón de la tabla que alberga este componente específico.
            const oCtx = oCheckBox.getBindingContext();

            if (!oCtx) return;

            const sPath = oCtx.getPath();
            // Si ha decidido activar la inflación para la fila, se dirige el flujo de cálculos.
            if (bSelected) {
                this._applyInflacionToRow(sPath);
            }
            // Si el usuario se retracta, se purga la inflación calculada devolviendo los números originales.
            else {
                this._restoreInflacionRow(sPath);
            }
        },

        /**
         * Se procesan los cambios manuales en el campo genérico de cabecera de la inflación (Header Input).
         * Dispara una re-validación masiva en cascada a todos los renglones implicados.
         */
        oninflacionInputChange: function (oEvent) {
            const oInput = oEvent.getSource();
            // Se parsea y protege la entrada asegurando siempre un valor flotante válido (0 en caso de error o NaN).
            const fValue = parseFloat(oInput.getValue()) || 0;

            // Se actualiza el Input nativo forzando el formato a dos posiciones decimales estrictas.
            oInput.setValue(fValue.toFixed(2));

            const oModel = this.getView().getModel();
            const aCategories = oModel.getProperty("/catalog/models/categories");
            const that = this; // Se retiene el contexto en una variable para sortear los límites de la función recursiva.

            // Función exploradora para revisar cada nodo del árbol.
            const recalculate = function (aNodes) {
                if (!Array.isArray(aNodes)) return;

                aNodes.forEach(function (oNode) {
                    // Si el nodo actual está marcado internamente con el indicador `flag2` (Checkbox de inflación habilitado).
                    if (oNode.flag2 === true) {
                        // Se deduce la ruta vinculante navegando estructuralmente por el modelo.
                        const sPath = that._findPathByNode(oNode, aCategories);
                        if (sPath) {
                            // Secuencia estricta de actualización matemática:
                            // 1. Se retiran los efectos de la inflación vieja (restauración del valor neto).
                            that._restoreInflacionRow(sPath, true);
                            // 2. Se inyecta la inflación nueva recién capturada en la variable 'fValue'.
                            that._applyInflacionToRow(sPath);
                        }
                    }
                    // Desplazamiento recursivo natural.
                    if (Array.isArray(oNode.categories)) {
                        recalculate(oNode.categories);
                    }
                });
            };

            // Se inicia la avalancha de cálculos.
            recalculate(aCategories);
        },

        /**
                * Se aplica la fórmula de inflación al registro asociado (fila).
                * Toma el valor digitado en el campo general y lo multiplica por los valores base.
                */
        _applyInflacionToRow: function (sPath) {
            const oModel = this.getView().getModel();
            const oRow = oModel.getProperty(sPath);

            // Se valida que la ruta proporcionada devuelva un objeto válido.
            if (!oRow) return;

            // Se recupera el valor de inflación ingresado por el usuario en la cabecera.
            const oInputInflacion = this.byId("inflacionInput");
            const fInflacion = parseFloat(oInputInflacion ? oInputInflacion.getValue() : 0) || 0;

            // Se inicializa el objeto global de respaldo si es la primera vez que se aplica inflación.
            if (!this._inflacionOriginals) this._inflacionOriginals = {};
            // Se reserva un espacio específico para la fila actual basado en su ruta de binding.
            if (!this._inflacionOriginals[sPath]) this._inflacionOriginals[sPath] = {};

            const oOriginals = this._inflacionOriginals[sPath];

            // Se itera sobre todas las propiedades del objeto de la fila.
            Object.keys(oRow).forEach(function (sKey) {
                // Se utiliza una expresión regular para actuar solo sobre los campos de datos temporales (Y2025 o M2025_01).
                if (/^y\d{4}$/.test(sKey) || /^m\d{4}_\d+$/.test(sKey)) {
                    // Se parsea el valor original almacenado en el modelo.
                    const fOriginal = parseFloat(oRow[sKey]) || 0;

                    // Si el valor base es cero, se ignora el cálculo (cero por inflación sigue siendo cero).
                    if (fOriginal === 0) return;

                    // Si es la primera vez que se altera este campo, se guarda su valor puro en el respaldo.
                    if (oOriginals[sKey] === undefined) {
                        oOriginals[sKey] = oRow[sKey];
                    }

                    // Se aplica el cálculo de incremento porcentual: Valor * (1 + (Porcentaje / 100)).
                    const fCalculated = fOriginal * (1 + fInflacion / 100);
                    // Se sobrescribe la propiedad en el modelo forzando un formato de dos decimales.
                    oModel.setProperty(sPath + "/" + sKey, fCalculated.toFixed(2));
                }
            });
        },

        /**
         * Se restituyen los montos que existían antes de aplicar cualquier incremento porcentual por inflación.
         * Devuelve la fila a sus valores netos base.
         */
        _restoreInflacionRow: function (sPath, skipDelete) {
            // Se verifica que exista un respaldo previo para esta fila.
            if (!this._inflacionOriginals || !this._inflacionOriginals[sPath]) return;

            const oModel = this.getView().getModel();
            const oOriginals = this._inflacionOriginals[sPath];

            // Se recorren las propiedades respaldadas y se reinyectan al modelo.
            Object.keys(oOriginals).forEach(function (sKey) {
                oModel.setProperty(sPath + "/" + sKey, oOriginals[sKey]);
            });

            // Si no se solicita lo contrario mediante la bandera, se purga la memoria del respaldo para esta fila.
            if (!skipDelete) {
                delete this._inflacionOriginals[sPath];
            }
        },

        /**
         * Se recupera la ubicación jerárquica (ruta de binding) de un nodo específico dentro del árbol.
         */
        _findPathByNode: function (oTargetNode, aCategories, sBasePath) {
            // Se define el punto de partida de la búsqueda si no fue proporcionado en la recursión.
            const basePath = sBasePath || "/catalog/models/categories";

            for (let i = 0; i < aCategories.length; i++) {
                // Se construye la ruta teórica de la iteración actual.
                const sPath = basePath + "/" + i;

                // Si el objeto actual coincide por referencia con el nodo buscado, se devuelve la ruta.
                if (aCategories[i] === oTargetNode) return sPath;

                // Si el objeto posee hijos, se invoca la búsqueda recursiva descendiendo un nivel en la jerarquía.
                if (Array.isArray(aCategories[i].categories)) {
                    const sFound = this._findPathByNode(
                        oTargetNode,
                        aCategories[i].categories,
                        sPath + "/categories"
                    );
                    if (sFound) return sFound;
                }
            }
            // Si el nodo no se encuentra en toda la estructura, se devuelve nulo.
            return null;
        },

        /**
         * Se confirma la persistencia de las modificaciones, volcando el estado actual al snapshot de respaldo (SavedData).
         */
        onSave: function () {
            const oModel = this.getView().getModel();
            const oUiModel = this.getView().getModel("ui");
            const oBundle = this.getView().getModel("i18n").getResourceBundle();

            if (!oModel) return;

            // Se lanza un diálogo nativo de SAPUI5 pidiendo confirmación al usuario antes de sobrescribir.
            MessageBox.confirm(
                oBundle.getText("saveConfirmMessage"),
                {
                    title: oBundle.getText("saveConfirmTitle"),
                    actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                    emphasizedAction: sap.m.MessageBox.Action.OK,
                    onClose: function (oAction) {
                        // Si el usuario acepta, se toma una nueva foto del modelo (snapshot).
                        if (oAction === MessageBox.Action.OK) {
                            this._savedData = JSON.parse(JSON.stringify(oModel.getData()));
                            // Se apaga el modo edición de la interfaz.
                            oUiModel.setProperty("/isEditMode", false);
                            MessageToast.show(oBundle.getText("saveSuccess"));

                            // (INICIO)
                            //   Tras confirmar el dialog "Esta seguro de que desea guardar..."
                            //   se dispara tambien el guardado DEFINITIVO contra el backend
                            //   (POST /GuardarIndirectosSet). Antes este onSave solo hacia
                            //   snapshot local: el POST no se enviaba al confirmar el dialog.
                            //   onSave del Main.controller contiene el POST. El rootView del
                            //   Component es App (no Main), asi que para llegar a Main hay que
                            //   pedirle al sap.m.App (id="app") su pagina actual, que es la
                            //   view Main cargada por la ruta RouteMain. Sin este indireccion
                            //   caiamos siempre en BaseController.onSave (este mismo metodo)
                            //   y por la guarda anti-recursion el POST nunca se enviaba.
                            try {
                                var oRootViewMV = this.getOwnerComponent && this.getOwnerComponent().getRootControl(); //   App view (root del Component)
                                var oAppCtrlMV = oRootViewMV && oRootViewMV.byId && oRootViewMV.byId("app"); //   sap.m.App declarado en App.view.xml
                                var oMainViewMV = oAppCtrlMV && typeof oAppCtrlMV.getCurrentPage === "function" && oAppCtrlMV.getCurrentPage(); //   view Main (pagina actual)
                                var oMainControllerMV = oMainViewMV && oMainViewMV.getController(); //   controller Main (override de onSave con POST)
                                //   Se valida que el controller resuelto NO sea this mismo, para evitar recursion
                                //   si este onSave estuviera siendo llamado desde Main (Main override este metodo).
                                if (oMainControllerMV && oMainControllerMV !== this && typeof oMainControllerMV.onSave === "function") { //   defensivo
                                    oMainControllerMV.onSave(); //   POST /GuardarIndirectosSet con headers del Main
                                }
                            } catch (errPostMV) { //   se captura cualquier error sin romper el snapshot ya hecho
                                console.error("[BaseController.onSave] Error al disparar el POST definitivo:", errPostMV); //   log para diagnostico
                            }
                            // (FIN)
                        }
                    }.bind(this)
                }
            );
        },

        /**
         * Se interrumpe la edición y se restauran los valores por defecto o el último estado guardado.
         */
        onCancelPress: function () {
            const oUiModel = this.getView().getModel("ui");
            const oModel = this.getView().getModel();
            const oBundle = this.getView().getModel("i18n").getResourceBundle();
            const oCurrentData = oModel.getData();

            // Se determina qué versión de los datos servirá como ancla de restauración (la guardada manualmente o la inicial).
            let oReferenceData = this._savedData || this._initialData;
            let bHasChanges = false;

            // Si es la primera vez y no hay referencia, se toma como estado inicial el actual.
            if (!oReferenceData) {
                this._initialData = JSON.parse(JSON.stringify(oCurrentData));
                oReferenceData = this._initialData;
                bHasChanges = true;
            } else {
                // Se comparan las cadenas JSON para determinar si ha habido alguna alteración en la tabla.
                bHasChanges = JSON.stringify(oCurrentData) !== JSON.stringify(oReferenceData);
            }

            // Si los datos son idénticos al respaldo, se informa al usuario y se interrumpe la ejecución.
            if (!bHasChanges) {
                MessageToast.show(oBundle.getText("noChangesToCancel"));
                return;
            }

            // Se solicita confirmación para descartar los cambios volátiles.
            MessageBox.confirm(
                oBundle.getText("cancelConfirmMessage"),
                {
                    actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                    onClose: function (oAction) {
                        // Se eliminan los anchos personalizados guardados para que las columnas dinámicas
                        // vuelvan a su tamaño predeterminado al cancelar los cambios del usuario.
                        this._savedColWidths = {};
                        if (oAction === MessageBox.Action.OK) {
                            // Si se confirma, se reinyecta el clon profundo del respaldo.
                            if (this._savedData) {
                                oModel.setData(JSON.parse(JSON.stringify(this._savedData)));
                            } else {
                                // Fallback: si no había datos salvados, se recarga del archivo local (o de la API según configuración).
                                oModel.loadData("model/Catalog.json");
                            }
                            // Se refresca agresivamente el modelo para obligar a la tabla a repintarse.
                            oModel.refresh(true);
                            oUiModel.setProperty("/isEditMode", false);
                        }
                    }.bind(this)
                }
            );
        },

        /**
         * Se inicializa el evento de filtrado para una fila concreta (generalmente desencadenado por un icono de embudo en la tabla).
         */
        filterTableRow: function (oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext();

            if (!oContext) return;

            // Se deduce la ruta del listado completo de "hermanos" (el array que contiene el objeto actual).
            const sRowPath = oContext.getPath();
            const sSiblingsPath = sRowPath.substring(0, sRowPath.lastIndexOf("/"));
            this._sSiblingsPath = sSiblingsPath;

            const oModel = this.getView().getModel();
            const aSiblings = oModel.getProperty(sSiblingsPath);

            if (!Array.isArray(aSiblings)) return;

            // Se genera un backup parcial exclusivo para este nivel del árbol, pero solo si se cambió de nivel de búsqueda.
            if (this._lastSiblingsPath !== sSiblingsPath) {
                this._aOriginalSiblings = JSON.parse(JSON.stringify(aSiblings));
                this._lastSiblingsPath = sSiblingsPath;
                this._aActiveFilters = {};
            }

            // Se establece sobre qué campo se realizará la búsqueda y se despliega el menú (Popover).
            this._sFilterProperty = oButton.data("filterProp") || "name";
            if (this._openFilterPopover) {
                this._openFilterPopover(oButton);
            }
        },

        /**
           * Se capturan los términos de búsqueda desde el Popover y se actualiza la tabla con los elementos "hermanos" que coincidan.
           */
        onSearchSibling: function (oEvent) {
            const sQuery = oEvent.getParameter("query") || "";
            const oModel = this.getView().getModel();

            if (!this._sSiblingsPath || !this._aOriginalSiblings) return;
            if (!this._aActiveFilters) this._aActiveFilters = {};

            // Se añade o elimina el filtro activo según lo escrito por el usuario.
            if (sQuery) {
                this._aActiveFilters[this._sFilterProperty] = sQuery;
            } else {
                delete this._aActiveFilters[this._sFilterProperty];
            }

            const aFilterKeys = Object.keys(this._aActiveFilters);

            // Si el usuario vació todos los filtros de la caja, se restaura la vista de este nivel desde el backup parcial.
            if (aFilterKeys.length === 0) {
                oModel.setProperty(this._sSiblingsPath, this._aOriginalSiblings);
            } else {
                const aActiveFilters = this._aActiveFilters;

                // Se aplica el filtro múltiple iterando sobre el backup parcial.
                let aFiltered = this._aOriginalSiblings.filter(function (item) {
                    // Los objetos marcados como "cabecera" estructural nunca se ocultan.
                    if (item.cabecera === true) return true;
                    // Se verifica que el elemento cumpla con TODAS las condiciones de búsqueda activas.
                    return aFilterKeys.every(function (sProp) {
                        const sVal = item[sProp];
                        const sFilter = aActiveFilters[sProp];
                        return sVal && String(sVal).toLowerCase().includes(String(sFilter).toLowerCase());
                    });
                });

                // Se verifica si el filtrado dejó resultados reales (omitiendo cabeceras).
                const iRealResults = aFiltered.filter(function (item) {
                    return item.cabecera !== true;
                }).length;

                // Si no hay resultados reales, se purga la lista dejando solo la cabecera para indicar que la tabla está vacía en este nivel.
                if (iRealResults === 0) {
                    aFiltered = aFiltered.filter(function (item) {
                        return item.cabecera === true;
                    });
                }

                // Se aplican los resultados al modelo.
                oModel.setProperty(this._sSiblingsPath, aFiltered);
            }

            // Se cierra el menú flotante tras pulsar Enter/Buscar.
            if (this._pPopover) {
                this._pPopover.then(function (oPopover) {
                    oPopover.close();
                });
            }

            // Se fuerza el recálculo visual para ajustar cabeceras sticky y grupos tras modificar el DOM masivamente.
            setTimeout(function () {
                this._buildGroupRanges();
                this._applyCabeceraStyle();

                const oTable = this.getControlTable();
                if (oTable) {
                    this._onScrollLike({
                        getParameter: function (sName) {
                            if (sName === "firstVisibleRow") {
                                return oTable.getFirstVisibleRow();
                            }
                        }
                    });
                }
            }.bind(this), 50);
        },

        /**
         * Se procesa el clic del embudo de filtrado en la cabecera dinámica de la tabla.
         * Su lógica calcula a qué grupo pertenece la cabecera visible antes de lanzar el menú.
         */
        filterTableCabecera: function (oEvent) {
            oEvent.preventDefault();

            const oButton = oEvent.getSource();
            const oTable = this.getControlTable();
            const iFirstVisible = oTable.getFirstVisibleRow();

            if (!this._aGroupRanges || !this._aGroupRanges.length) return;

            // Se busca el grupo activo basado en la posición actual del scroll vertical.
            let oActiveGroup = null;
            for (let i = 0; i < this._aGroupRanges.length; i++) {
                const oGroup = this._aGroupRanges[i];
                if (iFirstVisible >= oGroup.start && iFirstVisible <= oGroup.end) {
                    oActiveGroup = oGroup;
                    break;
                }
            }

            if (!oActiveGroup) return;

            this._activeGroupStart = oActiveGroup.start;

            // Se asocia la ruta del hijo ("categories") del grupo activo para filtrar a nivel de subelementos.
            const sSiblingsPath = oActiveGroup.path + "/categories";
            this._sSiblingsPath = sSiblingsPath;

            const oModel = this.getView().getModel();
            const aSiblings = oModel.getProperty(sSiblingsPath);

            if (!Array.isArray(aSiblings)) return;

            if (this._lastSiblingsPath !== sSiblingsPath) {
                this._aOriginalSiblings = JSON.parse(JSON.stringify(aSiblings));
                this._lastSiblingsPath = sSiblingsPath;
                this._aActiveFilters = {};
            }

            this._sFilterProperty = oButton.data("filterProp") || "name";
            this._openFilterPopover(oButton);
        },

        /**
         * Se despliega el fragmento emergente (Popover) para introducir los parámetros de búsqueda.
         */
        _openFilterPopover: function (oButton) {
            const oView = this.getView();

            // Si el fragmento no existe en la vista, se carga de forma asíncrona.
            if (!this._pPopover) {
                this._pPopover = sap.ui.core.Fragment.load({
                    id: oView.getId(),
                    name: "zindirect_costs.fragments.PopoverFilter",
                    controller: this
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);

                    // Se vincula un evento para restaurar el valor tipeado anteriormente si se vuelve a abrir el popover.
                    oPopover.attachAfterClose(function () {
                        const oSearchField = sap.ui.core.Fragment.byId(oView.getId(), "searchField");
                        if (oSearchField) {
                            const sActive = (this._aActiveFilters && this._aActiveFilters[this._sFilterProperty]) || "";
                            oSearchField.setValue(sActive);
                        }
                    }.bind(this));

                    return oPopover;
                }.bind(this));
            }

            // Una vez garantizada la promesa, se procede con la apertura.
            this._pPopover.then(function (oPopover) {
                // Si el usuario vuelve a hacer clic, se cierra (comportamiento tipo toggle).
                if (oPopover.isOpen()) {
                    oPopover.close();
                    return;
                }

                // Se setea el texto que el usuario pudo haber buscado antes en esa misma columna.
                const oSearchField = sap.ui.core.Fragment.byId(oView.getId(), "searchField");
                if (oSearchField) {
                    const sActive = (this._aActiveFilters && this._aActiveFilters[this._sFilterProperty]) || "";
                    oSearchField.setValue(sActive);
                }
                oPopover.openBy(oButton);
            }.bind(this));
        },

        /**
         * Se establece la visibilidad de la cabecera dinámica secundaria (el "hijo" sticky) y se conmutan los filtros visuales.
         */
        _setStickyChild: function (bValue) {
            const oUiModel = this.getView().getModel("ui");
            oUiModel.setProperty("/showStickyChild", bValue);

            const oTable = this.getControlTable();
            if (!oTable) return;

            // Si el hijo flotante se activa, se aplican estilos a la tabla y se ocultan los embudos nativos de la cabecera real.
            if (bValue) {
                oTable.addStyleClass("stickyHeaderActive");

                // Se realiza una copia de seguridad de la propiedad de filtro de cada columna nativa y se limpia.
                oTable.getColumns().forEach(function (oCol) {
                    const sFilter = oCol.getFilterProperty();
                    if (sFilter) {
                        oCol.data("savedFilterProperty", sFilter);
                        oCol.setFilterProperty("");
                    }
                });

            } else {
                // Se retira la clase de activación.
                oTable.removeStyleClass("stickyHeaderActive");

                // Se restituyen los iconos de embudo en las columnas donde habían sido ocultados.
                oTable.getColumns().forEach(function (oCol) {
                    const sSaved = oCol.data("savedFilterProperty");
                    if (sSaved) {
                        oCol.setFilterProperty(sSaved);
                        oCol.data("savedFilterProperty", null);
                    }
                });
            }
        },

        /**
         * Se intercepta y procesa el evento de filtrado nativo proveniente de las cabeceras estándar del TreeTable.
         * Ejecuta una evaluación de todo el árbol en crudo para asegurar que si un hijo cumple el filtro, su padre no desaparezca.
         */
        onTreeTableFilter: function (oEvent) {
            // Se previene el comportamiento nativo de filtrado del control para aplicar la lógica personalizada.
            oEvent.preventDefault();

            // Se recoge el valor introducido por el usuario en el campo de filtro de la cabecera.
            const sValue = oEvent.getParameter("value") || "";
            // Se utiliza tableModelName para que el filtrado opere sobre el modelo
            // correcto independientemente de la vista hija que este activa.
            const oModel = this.getView().getModel(this.tableModelName);
            // Se obtiene la instancia de la tabla jerárquica.
            const oTable = this.getControlTable();
            // Se obtiene el modelo de interfaz para gestionar la visibilidad de elementos flotantes.
            const oUiModel = this.getView().getModel("ui");

            // Se identifica la columna sobre la que se ha disparado el filtro.
            const oColumn = oEvent.getParameter("column");
            // Se extrae la propiedad de filtro de la columna o se usa "name" como valor de respaldo.
            const sFilterProperty = (oColumn && oColumn.getFilterProperty())
                ? oColumn.getFilterProperty()
                : "name";

            // Se inicializa el objeto de filtros activos si todavía no existe.
            if (!this._aTreeActiveFilters) {
                this._aTreeActiveFilters = {};
            }

            // Se registra o elimina el filtro activo según si el usuario ha escrito algo o ha borrado el campo.
            if (sValue) {
                this._aTreeActiveFilters[sFilterProperty] = sValue.toLowerCase();
                if (oColumn) oColumn.setFiltered(true);
            } else {
                delete this._aTreeActiveFilters[sFilterProperty];
                if (oColumn) oColumn.setFiltered(false);
            }

            // Se obtienen los datos actuales del modelo para generar el respaldo si aún no existe.
            const aCurrentData = oModel.getData();

            // Se determina si el modelo devuelve un array directo o un objeto envolvente.
            const aRootArray = Array.isArray(aCurrentData) ? aCurrentData : (aCurrentData.results || Object.values(aCurrentData)[0]);

            // Se genera el respaldo profundo del estado original de los datos únicamente la primera vez.
            if (!this._fullTreeBackup) {
                this._fullTreeBackup = JSON.parse(JSON.stringify(aRootArray));
            }

            // Se define la función auxiliar que resetea la visibilidad de columnas y cabeceras flotantes.
            const fnResetUI = function () {
                if (this.byId("colMonths")) this.byId("colMonths").setVisible(false);
                if (this.byId("colNew")) this.byId("colNew").setVisible(false);
                if (this.byId("colCheckBox1")) this.byId("colCheckBox1").setVisible(false);
                if (this.byId("colCheckBox2")) this.byId("colCheckBox2").setVisible(false);
                if (oUiModel) {
                    oUiModel.setProperty("/showStickyParent", false);
                    oUiModel.setProperty("/showStickyChild", false);
                }
                this._setStickyChild(false);
            }.bind(this);

            // Se recogen las claves de todos los filtros activos en este momento.
            const aFilterKeys = Object.keys(this._aTreeActiveFilters);

            // CASO 1: El usuario ha vaciado todos los filtros activos.
            if (aFilterKeys.length === 0) {
                // Se restaura el array completo de datos desde el respaldo profundo.
                const aRestored = JSON.parse(JSON.stringify(this._fullTreeBackup));
                // Se reinyectan los datos originales al modelo de forma compatible con la estructura raíz.
                if (Array.isArray(aCurrentData)) {
                    oModel.setData(aRestored);
                } else {
                    const sRootKey = Object.keys(aCurrentData)[0];
                    const oRestored = {};
                    oRestored[sRootKey] = aRestored;
                    oModel.setData(oRestored);
                }
                fnResetUI();
                // Se colapsa la tabla y se recalculan los rangos y estilos visuales.
                oTable.collapseAll();
                this._buildGroupRanges();
                this._applyCabeceraStyle();
                return;
            }

            const aActiveFilters = this._aTreeActiveFilters;

            // Se define la función que evalúa si un nodo satisface todos los criterios de filtrado activos.
            const fnMatchesAll = function (oNode) {
                return aFilterKeys.every(function (sProp) {
                    return oNode[sProp] != null &&
                        String(oNode[sProp]).toLowerCase().includes(aActiveFilters[sProp]);
                });
            };

            const aFiltered = [];
            let bCasoHijo = false;
            let bDetalleExpanded = false;

            // CASO 2: Hay filtros activos. Se recorre el árbol desde el nivel superior.
            this._fullTreeBackup.forEach(function (oPadre) {

                // Se descarta el nodo si no es un nodo real con estructura jerárquica.
                const bEsNodoReal = oPadre.isGroup === true ||
                    (Array.isArray(oPadre.children) && oPadre.children.length > 0);

                if (!bEsNodoReal) { return; }

                // Sub-Caso A: El propio nodo padre satisface los criterios de búsqueda.
                if (fnMatchesAll(oPadre)) {
                    aFiltered.push(JSON.parse(JSON.stringify(oPadre)));
                    return;
                }

                // Sub-Caso B: Se busca en los nodos hijos directos del padre.
                const aHijosMatchados = [];
                if (Array.isArray(oPadre.children)) {
                    oPadre.children.forEach(function (oHijo) {
                        // Se verifica si el hijo cumple los criterios de filtrado.
                        if (fnMatchesAll(oHijo)) {
                            aHijosMatchados.push(JSON.parse(JSON.stringify(oHijo)));

                            // Se comprueba si el hijo tiene subniveles de detalle expandibles.
                            if (Array.isArray(oHijo.children) &&
                                oHijo.children.length > 0 &&
                                oHijo.children[0].isGroup === true) {
                                bDetalleExpanded = true;
                            }
                        }
                    });
                }

                // Si se encontraron hijos coincidentes, se construye una copia del padre con solo esos hijos.
                if (aHijosMatchados.length > 0) {
                    const oPadreCopia = JSON.parse(JSON.stringify(oPadre));
                    oPadreCopia.children = aHijosMatchados;
                    aFiltered.push(oPadreCopia);
                    bCasoHijo = true;
                }
            });

            // Se blanquea la interfaz y se inyectan los datos filtrados al modelo.
            fnResetUI();

            // Se aplican los datos filtrados al modelo respetando la estructura raíz original.
            if (Array.isArray(aCurrentData)) {
                oModel.setData(aFiltered);
            } else {
                const sRootKey = Object.keys(aCurrentData)[0];
                const oFiltered = {};
                oFiltered[sRootKey] = aFiltered;
                oModel.setData(oFiltered);
            }

            const oBinding = oTable.getBinding("rows");
            if (!oBinding) { return; }

            // Se ajusta la expansión de la tabla según el tipo de resultado obtenido.
            if (bCasoHijo) {
                // Se expande hasta el segundo nivel para mostrar los hijos coincidentes.
                oTable.expandToLevel(2);
                if (this.byId("colMonths")) this.byId("colMonths").setVisible(bDetalleExpanded);
                if (this.byId("colNew")) this.byId("colNew").setVisible(bDetalleExpanded);
                if (this.byId("colCheckBox1")) this.byId("colCheckBox1").setVisible(bDetalleExpanded);
                if (this.byId("colCheckBox2")) this.byId("colCheckBox2").setVisible(bDetalleExpanded);
            } else {
                // Si solo se encontraron padres, se colapsa y se expande solo el primer nivel.
                oTable.collapseAll();
                oTable.expandToLevel(1);
            }

            // Se recalculan los rangos de grupos y los estilos de cabecera.
            this._buildGroupRanges();
            this._applyCabeceraStyle();
        },
          _getCurrencyDecimals: function (sWaers) {
            if (!sWaers) { return null; } //   se aborta si no llega moneda
            var sKey = String(sWaers).toUpperCase().trim(); //   se normaliza a mayusculas para evitar mismatches
            //   Mapa de monedas a 0 decimales. Si Ferrovial introduce mas codigos
            //   internos (ej. JP1, KR1...) se anyaden aqui sin tocar el resto.
            var oZeroDecimalsMap = { //   extensible: anyadir aqui futuros codigos
                "CL1": true, //   codigo interno Ferrovial para peso chileno
                "CLP": true, //   ISO 4217 peso chileno
                "JPY": true, //   ISO 4217 yen japones
                "KRW": true, //   ISO 4217 won surcoreano
                "VND": true, //   ISO 4217 dong vietnamita
                "ISK": true, //   ISO 4217 corona islandesa
                "BIF": true, //   ISO 4217 franco burundes
                "DJF": true, //   ISO 4217 franco yibutiano
                "GNF": true, //   ISO 4217 franco guineano
                "KMF": true, //   ISO 4217 franco comorense
                "RWF": true, //   ISO 4217 franco ruandes
                "UGX": true, //   ISO 4217 chelin ugandes
                "VUV": true, //   ISO 4217 vatu de Vanuatu
                "XAF": true, //   ISO 4217 franco CFA central
                "XOF": true, //   ISO 4217 franco CFA occidental
                "XPF": true, //   ISO 4217 franco CFP
                "PYG": true  //   ISO 4217 guarani paraguayo
            };
            if (oZeroDecimalsMap[sKey] === true) { return 0; } //   override 0 decimales para monedas mapeadas
            return null; //   sin override -> el llamador usa el default
        },

        //     Captura la moneda de la obra (Waers) desde las filas de datos cargadas
        //   y la persiste en appData./Waers. formatDecimales lee de ahi para decidir el
        //   numero de decimales (0 para CLP/CL1 y demas monedas sin decimales). Sin esta
        //   captura /Waers nunca se rellenaba y formatDecimales caia siempre al default de
        //   2 decimales, mostrando decimales en obras chilenas. Todas las filas de una obra
        //   comparten moneda, asi que basta con la primera fila que la traiga.
        _setWaersFromData: function (aResults) {
            if (!Array.isArray(aResults) || aResults.length === 0) { return; }
            var sWaers = "";
            for (var i = 0; i < aResults.length; i++) {
                if (aResults[i] && aResults[i].Waers) {
                    sWaers = aResults[i].Waers;
                    break;
                }
            }
            if (!sWaers) { return; }
            var oAppData = this.getGlobalModel && this.getGlobalModel("appData");
            if (!oAppData) {
                oAppData = sap.ui.getCore().getModel("appData") ||
                    (this.getOwnerComponent && this.getOwnerComponent().getModel("appData"));
            }
            if (oAppData) {
                oAppData.setProperty("/Waers", sWaers);
            }
        },
 

        /**
         *   Traduce la etiqueta del tipo de reparto a partir de su código (key) para
         *   mostrarla en el desplegable de Reparto. Es un formatter de SOLO display: la
         *   lógica de la app sigue trabajando con la key (MAN/LIN/OEO), que es lo que se
         *   bindea en selectedKey y lo que lee onRowInputChange (getSelectedKey). Así se
         *   traduce el texto visible sin tocar la construcción de repartoItems ni el modelo.
         *   Capítulos con items estáticos (Corrientes) ya usan i18n directamente; este
         *   helper cubre los de items dinámicos (Anticipados/Diferidos/Inmovilizados).
         */
        formatRepartoTipo: function (sKey) {
            var oLabels = {
                "MAN": "tipoManual",
                "LIN": "tipoLineal",
                "OEO": "tipoOEO"
            };
            if (sKey && oLabels[sKey]) {
                return this.getTranslatedText(oLabels[sKey]);
            }
            //   Tipo desconocido o vacío: se devuelve el valor original sin romper la celda.
            return sKey || "";
        },

        //     Se elimina la primera definicion duplicada de formatDecimales que usaba
        //     parametros decimalSep y groupSep ya no necesarios, y se mantiene unicamente
        //     esta version que lee el formato directamente desde el CurrencyFormat del usuario.
        formatDecimales: function (numStr, decStr) {

            //     Se retorna vacio si el valor no existe o es nulo.
            if (numStr === null || numStr === undefined || numStr === "") {
                return "";
            }
            // 22/04
            if (typeof numStr === "string") {
                var fTest = parseFloat(numStr.replace(/\./g, "").replace(",", "."));
                if (isNaN(fTest)) {
                    return numStr;
                }
            }
            // 22/04
   var iDec = 2; //
       var iDec = 2; //   valor por defecto si no se reconoce la moneda
            var bRedondeoArriba = false; //   true cuando la moneda no admite decimales (CLP, etc.): se redondea hacia arriba
            try {
                var oAppDataMV = sap.ui.getCore().getModel("appData") ||
                    (this.getOwnerComponent && this.getOwnerComponent().getModel("appData"));
                var sWaers = oAppDataMV ? oAppDataMV.getProperty("/Waers") : null;
                if (sWaers) {
                    var iWaersDec = this._getCurrencyDecimals(sWaers); //   se delega en el helper _getCurrencyDecimals
                    if (iWaersDec !== null && iWaersDec !== undefined) {
                        iDec = iWaersDec; //   override segun moneda
                        if (iWaersDec === 0) { bRedondeoArriba = true; } //   monedas sin decimales: redondeo hacia arriba
                    }
                }
            } catch (e) {
                //   se mantiene iDec=2 si no se puede leer la moneda
            }

            var fVal;

            //     Se usa el valor directamente si ya es de tipo numerico.
            if (typeof numStr === "number") {
                fVal = numStr;
            } else {
                //     Se convierte a float desde string ya que el backend envia
                //     los valores en formato numerico estandar con punto decimal.
                fVal = parseFloat(numStr);
            }

            //     Se retorna vacio si el resultado no es un numero valido.
            if (isNaN(fVal)) {
                return "";
            }

            //       Para monedas sin decimales (CLP/CL1, etc.) el importe se redondea
            //     hacia arriba antes de formatear, segun requisito funcional para obras
            //     chilenas. Math.ceil redondea hacia +infinito (p.ej. 169564.17 -> 169565).
            if (bRedondeoArriba) {
                fVal = Math.ceil(fVal);
            }

            //     Se leen los separadores del CurrencyFormat del usuario para aplicar
            //     el formato regional correcto en lugar de asumir separadores fijos.
            var thousandSeparator = ".";
            var decimalSeparator = ",";
            try {
                var oAppData = sap.ui.getCore().getModel("appData") ||
                    this.getOwnerComponent && this.getOwnerComponent().getModel("appData");
                if (oAppData) {
                    var sCurrencyFormat = oAppData.getProperty("/userData/CurrencyFormat");
                    if (sCurrencyFormat && sCurrencyFormat.length >= 2) {
                        thousandSeparator = sCurrencyFormat.charAt(0);
                        decimalSeparator = sCurrencyFormat.charAt(1);
                    }
                }
            } catch (e) {
                //     Se mantienen los separadores por defecto si el modelo no es accesible.
            }

            //     Se aplica el formato numerico con separadores regionales del usuario.
            var oFmt = sap.ui.core.format.NumberFormat.getFloatInstance({
                minFractionDigits: iDec,
                maxFractionDigits: iDec,
                groupingEnabled: true,
                groupingSeparator: thousandSeparator,
                decimalSeparator: decimalSeparator
            });

            return oFmt.format(fVal);
        },

        /**
         *   Formatter de paso (identidad) para campos de texto editables.
         * Un binding con formatter no escribe de vuelta al modelo (es OneWay de facto),
         * por lo que el modelo conserva el valor previo hasta que el handler de change
         * (onRowInputChange) lo actualiza. Esto evita que el filtro "valor nuevo === valor
         * en modelo" de _enviarFilaAlBackend aborte el guardado temporal de la descripcion
         * (Post1), que con un binding TwoWay quedaba sincronizado antes de tiempo.
         */
        formatPassthrough: function (sValue) {
            return (sValue === null || sValue === undefined) ? "" : sValue;
        },

        /**
         * Se controla el estado de visibilidad de la columna de ajustes actualizando
         * el modelo de visibilidad con el valor booleano recibido directamente del evento.
         * Se marca ademas la variante activa como modificada para habilitar el guardado directo.
         */
        onAjustesCheckBox: function (oEvent) {
            var bSelected = oEvent.getParameter("selected");
            this.getView().getModel("visibleColumn").setProperty("/visible", bSelected);
            this._markVariantDirty();
            setTimeout(function () {
                var oTable = this.getControlTable();
                if (oTable) {
                    this._highlightSinProveedor(oTable);
                    this._applyBlockBorder(oTable);
                }
            }.bind(this), 100);
        },
        /**
                * Se formatea el texto de la versión utilizando el modelo de internacionalización (i18n).
                * Convierte los códigos técnicos de versión en textos legibles para la interfaz de usuario.
                */
        formatTextoVersion: function (sVersion) {
            // Se verifica que el código de versión exista; de lo contrario, se retorna una cadena vacía para evitar errores.
            if (!sVersion) return "";

            // Se obtiene el paquete de recursos de traducciones (ResourceBundle) asociado a la vista actual.
            var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

            // Se evalúa el código de la versión mediante una estructura condicional múltiple.
            switch (sVersion) {
                // Se retorna el texto traducido correspondiente a cada clave predefinida.
                case "MA": return oResourceBundle.getText("Version_MA");
                case "MP": return oResourceBundle.getText("Version_MP");
                case "MO": return oResourceBundle.getText("Version_MO");
                // Si el código no coincide con ninguno de los esperados, se retorna el valor original como mecanismo de respaldo.
                default: return sVersion;
            }
        },
    _initYearsModel: function () {
            // Se leen ambas fechas desde appData como fuente global única.
            var oAppData = this.getGlobalModel("appData").getData();
            var sFreal = oAppData.Freal;
            var sFrealfinobra = oAppData.Frealfinobra;

            // Si alguna de las fechas no está disponible se reintenta tras 500ms
            //  esperando a que el modelo global las haya persistido.
            if (!sFreal || !sFrealfinobra) {
                setTimeout(function () { this._initYearsModel(); }.bind(this), 500);
                return;
            }

            // Se parsean las fechas obtenidas al formato Date de JavaScript.
            var oDateStart = this._parseODataDate(sFreal);
            var oDateEnd = this._parseODataDate(sFrealfinobra);

            //  Se verifica que ambas fechas sean válidas antes de continuar.
            if (!oDateStart || !oDateEnd || isNaN(oDateStart) || isNaN(oDateEnd)) {
                return;
            }

            var iYearStart = oDateStart.getFullYear();
            var iYearEnd = oDateEnd.getFullYear();

            // (INICIO)
            //   Se elimina definitivamente el fallback antiguo (iYearEnd = iYearStart + 2):
            //   cuando Frealfinobra es anterior a Freal NO se fabrica un rango artificial,
            //   sino que se senaliza el error en el Select via ValueState=Error y se colapsa
            //   el rango a un unico ano (el de Freal) para no dejar el selector vacio.
            var bRangoInvalido = iYearEnd < iYearStart; //   rango invalido: fecha fin antes de fecha inicio
            if (bRangoInvalido) { //   se entra solo cuando el rango es invalido
                iYearEnd = iYearStart; //   se colapsa el rango a un unico ano para evitar Select vacio
            } //   fin del bloque de proteccion contra rango invalido
            // (FIN)

            //   Se guardan el ano de inicio y fin para usarlos al crear las columnas dinamicas.
            this._iYearStart = iYearStart;
            this._iYearEnd = iYearEnd;

            //    
            // Se calcula la fecha efectiva utilizada por onCreateMonthsTable para determinar
            // el mes inicial al abrir un anyo. Sin este valor las vistas que delegan en
            // createDynamicYearColumns (Anticipados, Diferidos, Inmovilizados) caian en el
            // fallback "new Date()": como el anyo seleccionado (Freal) raramente coincide
            // con el anyo actual, iStartIdx quedaba forzado a 0 (enero) y todos los meses
            // se marcaban como isPassedMonth, lo que ademas hacia que al desmarcar el
            // checkbox de ejercicios anteriores se cerraran todas las columnas mensuales.
            // Se replica aqui la misma regla de Corrientes/Externos: si el dia de Freal
            // coincide con el de Frealsist se usa Freal tal cual; en caso contrario se
            // suma un dia. Asi todas las vistas hijas comparten el mismo comportamiento.
            var sFrealsist = oAppData.Frealsist;
            var oDateFrealsist = sFrealsist ? this._parseODataDate(sFrealsist) : null;
            var bSameDay = oDateFrealsist && !isNaN(oDateFrealsist.getTime())
                && oDateStart.getDate() === oDateFrealsist.getDate();
            if (bSameDay) {
                this._effectiveDate = oDateStart;
            } else {
                var oDateEffective = new Date(oDateStart);
                oDateEffective.setDate(oDateEffective.getDate() + 1);
                this._effectiveDate = oDateEffective;
            }
            //   

            //   Se construye el array de anos para el selector de ejercicio.
            var aYears = [];
            for (var i = iYearStart; i <= iYearEnd; i++) {
                aYears.push({ year: String(i) }); //   cada entrada lleva el ano como string para el binding
            }

            // (INICIO)
            //   Se formatean ambas fechas en dd/MM/yyyy para mostrarlas en el valueStateText.
            var sFechaInicio = this._formatDateDisplay(oDateStart); //   fecha de inicio formateada (Freal)
            var sFechaFin = this._formatDateDisplay(oDateEnd); //   fecha de fin formateada (Frealfinobra)
            //   Mensaje de error con el nombre exacto del campo junto a su fecha,
            //   en el orden "inicio > fin" para reflejar la inconsistencia detectada.
            var sValueStateText = bRangoInvalido
                ? ("Freal: " + sFechaInicio + " > Frealfinobra: " + sFechaFin)
                : ""; //   en el caso valido no se muestra ningun mensaje
            // (FIN)

            //   Se asigna el modelo de anos a la vista con el primer ano como seleccionado por defecto.
            this.getView().setModel(new sap.ui.model.json.JSONModel({
                years: aYears,
                selectedYear: String(iYearStart),
                // (INICIO)
                //   ValueState=Error cuando Frealfinobra < Freal; None en caso normal.
                valueState: bRangoInvalido ? "Error" : "None", //   estado visual del Select
                valueStateText: sValueStateText //   texto del tooltip de error con campos y fechas
                // (FIN)
            }), "yearsModel");

            // (INICIO)
            //   Se inicializa el seguimiento del ano previo seleccionado. El Select usa
            //   selectedKey con binding bidireccional, por lo que /selectedYear se actualiza
            //   al ano NUEVO antes de que se dispare onYearChange. Para guardar con el ano
            //   donde se hicieron los guardados temporales (el anterior) se rastrea aqui el
            //   valor de partida y se actualiza al final de onYearChange.
            this._previousSelectedYear = String(iYearStart);
            // (FIN)
        },

        /**
            * Se abre el popover de seleccion de rangos mensuales.
            * Se sustituye el CalendarMonthInterval horizontal por un grid 3x4 personalizado
            * con navegacion por año, manteniendo el flujo posterior (onDateSelected →
            * _confirmDateRange → _executeBatchLineal) intacto.
            */
        onOpenRangePicker: function (oEvent, oAnchorControl, oExternalContext) {
            var oAnchor = oAnchorControl || oEvent.getSource();

            // Se intenta resolver el contexto primero desde tableModelName y como
            // fallback desde panelModel (para el caso del panel proveedor). Asi el
            // mismo handler sirve para la TreeTable principal, el bloque proveedor
            // y la tabla del panel sin ramificar la view en handlers separados.
         this._oActiveContext = oExternalContext ||
                oAnchor.getBindingContext(this.tableModelName) ||
                oAnchor.getBindingContext("panelModel");

            if (!this._oRangePopover) {
                this._buildRangePopover();
            }

           //   Se rehidrata el estado interno (_linStart, _linEnd, _linYear) desde el modelo
            // antes de abrir, para que el grid muestre la seleccion previa si existia.
            // Se usa oContext.getModel() en lugar de this.tableModelName para
            // funcionar tambien con panelModel.
            var oModel = this._oActiveContext.getModel();
            var sPath = this._oActiveContext.getPath();
            var dFrom = oModel.getProperty(sPath + "/_linDateFrom");
            var dTo = oModel.getProperty(sPath + "/_linDateTo");

            this._linStart = dFrom ? new Date(dFrom) : null;
            this._linEnd = dTo ? new Date(dTo) : null;

            //   Los limites del rango permitido salen de appData.Freal / Frealfinobra:
            // el horizonte completo del tramo. Asi el LIN cubre desde el mes/año de
            // Freal hasta el mes/año de Frealfinobra (p.ej. 28/02/2014 → 30/11/2017).
            var oBounds = this._getLinRangeBounds();
            var iDefaultYear = oBounds.minDate ? oBounds.minDate.getFullYear() : new Date().getFullYear();
            this._linYear = this._linStart ? this._linStart.getFullYear() : iDefaultYear;

            // Se restringe el año visible a [minYear, maxYear] por si el rango previo cayo fuera.
            if (oBounds.minDate && this._linYear < oBounds.minDate.getFullYear()) {
                this._linYear = oBounds.minDate.getFullYear();
            }
            if (oBounds.maxDate && this._linYear > oBounds.maxDate.getFullYear()) {
                this._linYear = oBounds.maxDate.getFullYear();
            }

            this._refreshRangePopover();
            this._oRangePopover.openBy(oAnchor);
        },

        //   Lee Freal/Frealfinobra de appData y devuelve {minDate, maxDate} con el
        // primer dia del mes inicial y el ultimo dia del mes final. El horizonte permitido
        // del LIN es Freal → Frealfinobra (p.ej. 28/02/2014 → 30/11/2017): el rango completo
        // del tramo, no solo el periodo de obra real. Si alguna fecha no esta disponible
        // ese limite queda como null (sin restriccion).
        // Fallback: si appData.Frealfinobra no se ha persistido todavia, se lee de
        // dashboardModel.NavLsObra[0] directamente.
        _getLinRangeBounds: function () {
            var oAppData;
            try {
                oAppData = this.getGlobalModel("appData").getData();
            } catch (e) {
                oAppData = null;
            }
            var oDashLsObra = null;
            try {
                var oDash = this.getGlobalModel("dashboardModel");
                if (oDash) {
                    oDashLsObra = oDash.getProperty("/NavLsObra/results/0") || null;
                }
            } catch (e) { /* sin dashboardModel: solo se usa appData */ }

            var sIni = (oAppData && oAppData.Freal) || "";
            var sFin = (oAppData && oAppData.Frealfinobra) || (oDashLsObra && oDashLsObra.Frealfinobra) || "";

            var oMin = null;
            var oMax = null;
            if (sIni) {
                var dIni = this._parseODataDate(sIni);
                if (dIni && !isNaN(dIni.getTime())) {
                    oMin = new Date(dIni.getFullYear(), dIni.getMonth(), 1);
                }
            }
            if (sFin) {
                var dFin = this._parseODataDate(sFin);
                if (dFin && !isNaN(dFin.getTime())) {
                    oMax = new Date(dFin.getFullYear(), dFin.getMonth() + 1, 0);
                }
            }
            return { minDate: oMin, maxDate: oMax };
        },

        //   Construye una unica vez el popover con cabecera de año (<, año, >) y un grid
        // 3x4 de meses. Los nombres de mes se obtienen via DateFormat para respetar el
        // locale activo de la app.
        _buildRangePopover: function () {
            var that = this;
            var oMonthFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "MMMM" });
            var aMonthNames = [];
            for (var iM = 0; iM < 12; iM++) {
                var sName = oMonthFormat.format(new Date(2000, iM, 1));
                aMonthNames.push(sName.charAt(0).toUpperCase() + sName.slice(1));
            }

            this._linYearTitle = new sap.m.Title({ text: "", level: "H4" });
            
            this._linPrevBtn = new sap.m.Button({
                icon: "sap-icon://navigation-left-arrow",
                type: "Transparent",
                press: function () {
                    var oB = that._getLinRangeBounds();
                    if (oB.minDate && that._linYear <= oB.minDate.getFullYear()) return;
                    that._linYear--;
                    that._refreshRangePopover();
                }
            });
            this._linNextBtn = new sap.m.Button({
                icon: "sap-icon://navigation-right-arrow",
                type: "Transparent",
                press: function () {
                    var oB = that._getLinRangeBounds();
                    if (oB.maxDate && that._linYear >= oB.maxDate.getFullYear()) return;
                    that._linYear++;
                    that._refreshRangePopover();
                }
            });
            var oHeader = new sap.m.HBox({
                justifyContent: "Center",
                alignItems: "Center",
                items: [this._linPrevBtn, this._linYearTitle, this._linNextBtn]
            }).addStyleClass("sapUiSmallMarginBottom");

            this._linMonthBtns = [];
            for (var i = 0; i < 12; i++) {
                (function (iMonth) {
                    that._linMonthBtns.push(new sap.m.Button({
                        text: aMonthNames[iMonth],
                        width: "6rem",
                        press: function () { that._handleMonthPress(iMonth); }
                    }).addStyleClass("sapUiTinyMargin"));
                })(i);
            }

            var oGrid = new sap.m.VBox({ alignItems: "Center" });
            for (var r = 0; r < 4; r++) {
                oGrid.addItem(new sap.m.HBox({
                    justifyContent: "Center",
                    items: this._linMonthBtns.slice(r * 3, r * 3 + 3)
                }));
            }

            var oContent = new sap.m.VBox({
                alignItems: "Center",
                items: [oHeader, oGrid]
            }).addStyleClass("sapUiSmallMargin");

            this._oRangePopover = new sap.m.ResponsivePopover({
                //   Se traduce el titulo del popover de rango mensual via i18n.  
                title: this.getTranslatedText("selectMonthRangeTitle"),
                //  
                placement: "Bottom",
                contentWidth: "22rem",
                content: [oContent]
            });
            this.getView().addDependent(this._oRangePopover);
        },

        //   Refresca el titulo del año, el resaltado de cada boton de mes y la
        // disponibilidad de las flechas/meses segun los limites del tramo
        // (appData.Freal / Frealfinobra). Los meses fuera de rango quedan disabled.
        _refreshRangePopover: function () {
            this._linYearTitle.setText(String(this._linYear));
            var oBounds = this._getLinRangeBounds();

            //   Las flechas NO usan setEnabled: hacerlo justo despues del click cambia
            // el foco al document.body y ResponsivePopover lo interpreta como "foco
            // fuera del popover" → autoclose. En su lugar se atenuan con una clase CSS
            // y el press handler ya bloquea el incremento si esta fuera de rango.
            var bPrevAllowed = !oBounds.minDate || this._linYear > oBounds.minDate.getFullYear();
            var bNextAllowed = !oBounds.maxDate || this._linYear < oBounds.maxDate.getFullYear();
            this._linPrevBtn[bPrevAllowed ? "removeStyleClass" : "addStyleClass"]("linNavBtnDimmed");
            this._linNextBtn[bNextAllowed ? "removeStyleClass" : "addStyleClass"]("linNavBtnDimmed");

            for (var i = 0; i < 12; i++) {
                var oMonthStart = new Date(this._linYear, i, 1);
                var oMonthEnd = new Date(this._linYear, i + 1, 0);

                // Mes fuera de [minDate, maxDate]: se deshabilita.
                var bAllowed = true;
                if (oBounds.minDate && oMonthEnd < oBounds.minDate) bAllowed = false;
                if (oBounds.maxDate && oMonthStart > oBounds.maxDate) bAllowed = false;

                var bInRange = false;
                if (this._linStart && this._linEnd) {
                    bInRange = oMonthEnd >= this._linStart && oMonthStart <= this._linEnd;
                } else if (this._linStart) {
                    bInRange = oMonthStart.getFullYear() === this._linStart.getFullYear() &&
                               oMonthStart.getMonth() === this._linStart.getMonth();
                }
                this._linMonthBtns[i].setEnabled(bAllowed);
                this._linMonthBtns[i].setType(bInRange ? "Emphasized" : "Default");
            }
        },

        //   Gestor de pulsacion sobre un mes del grid: primer click fija el inicio, segundo
        // cierra el rango, escribe en el modelo y dispara _confirmDateRange (mismo flujo
        // que el CalendarMonthInterval anterior). Si el segundo click es anterior al
        // primero, las fechas se intercambian para mantener Start <= End.
        _handleMonthPress: function (iMonth) {
            var oClicked = new Date(this._linYear, iMonth, 1);

            // Primer click o reinicio tras rango completo: solo se fija el inicio.
            if (!this._linStart || (this._linStart && this._linEnd)) {
                this._linStart = oClicked;
                this._linEnd = null;
                this._refreshRangePopover();
                return;
            }

            // Segundo click: se cierra el rango (ordenando Start/End si hace falta).
            var oStart = oClicked < this._linStart ? oClicked : this._linStart;
            var oEndMonth = oClicked < this._linStart ? this._linStart : oClicked;
            var oEndLastDay = new Date(oEndMonth.getFullYear(), oEndMonth.getMonth() + 1, 0);

            this._linStart = oStart;
            this._linEnd = oEndLastDay;
            this._refreshRangePopover();

         var oModel = this._oActiveContext.getModel();
            var sPath = this._oActiveContext.getPath();
            oModel.setProperty(sPath + "/_linDateFrom", oStart);
            oModel.setProperty(sPath + "/_linDateTo", oEndLastDay);
            oModel.refresh(true);
            this._oRangePopover.close();
            this._confirmDateRange(oStart, oEndLastDay);
        },

        /**
         * Se gestiona la selección de fechas en el calendario sin afectar inmediatamente al backend.
         * Se almacenan las fechas en propiedades temporales para permitir actualización del tooltip.
         */
        onDateSelected: function () {
            var aSelectedDates = this._oCalendar.getSelectedDates();
            if (aSelectedDates.length > 0) {
                var oDateRange = aSelectedDates[0];
                var oStartDate = oDateRange.getStartDate();
                var oEndDate = oDateRange.getEndDate();

                if (oStartDate && oEndDate) {

                    // Se fuerza a que oEndDate sea el último día exacto de ese mes para evitar cálculos erróneos.
                    oEndDate = new Date(oEndDate.getFullYear(), oEndDate.getMonth() + 1, 0);

 //Se usa el modelo del contexto activo en lugar de tableModelName
                    // hardcoded, para soportar tambien panelModel (panel proveedor).
                    var oModel = this._oActiveContext.getModel();
                    var sPath = this._oActiveContext.getPath();
                    oModel.setProperty(sPath + "/_linDateFrom", oStartDate);
                    oModel.setProperty(sPath + "/_linDateTo", oEndDate);
                    oModel.refresh(true);
                    this._oRangePopover.close();

                    this._confirmDateRange(oStartDate, oEndDate);
                }
            }
        },

        /**
         * Se muestra el mensaje de confirmación con fechas formateadas a mes y año.
         * Se añade la lógica de reseteo completo en caso de cancelación.
         */
        _confirmDateRange: function (oStartDate, oEndDate) {

            var oBundle = this.getView().getModel("i18n").getResourceBundle();

            var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                pattern: "MM/yyyy"
            });

            var sFrom = oDateFormat.format(oStartDate);
            var sTo = oDateFormat.format(oEndDate);

            var sMensaje = oBundle.getText("msgConfirmacionLineal", [
                sFrom,
                sTo
            ]);

            sap.m.MessageBox.confirm(sMensaje, {

                // Se gestiona la acción del usuario en el mensaje.
                onClose: function (oAction) {

                    if (oAction === sap.m.MessageBox.Action.OK) {

                        // Se ejecuta la lógica original del batch.
                        this._executeBatchLineal(oStartDate, oEndDate);

                    } else {

                        // Se resetea completamente el estado si el usuario cancela.
                        this._resetLinState();
                    }

                }.bind(this)
            });
        },
        _buildNumericBinding: function (sFullPath) {
            //   Se separa el nombre del modelo de la ruta de la propiedad usando
            //   el caracter ">" como delimitador estándar de SAPUI5.
            var iSep = sFullPath.indexOf(">");
            var sModel = iSep >= 0 ? sFullPath.substring(0, iSep) : undefined;
            var sPath = iSep >= 0 ? sFullPath.substring(iSep + 1) : sFullPath;

            //   Se intenta obtener el número de decimales configurado en el modelo
            //   de dashboard. Si la operación falla por cualquier motivo se aplica
            //   el valor de respaldo de 2 decimales para garantizar la estabilidad.
            var iDecimals = 2;
            try {
                var oDash = this.getView().getModel("dashboardModel") ||
                    this.getGlobalModel("dashboardModel");
                if (oDash) {
                    iDecimals = parseInt(oDash.getProperty("/decimales"), 10) || 2;
                }
            } catch (e) {
                //   Se mantiene el valor de respaldo si el modelo no está accesible.
            }
            var thousandSeparator = ".";
            var decimalSeparator = ",";
            try {
                var oAppData = this.getGlobalModel("appData");
                if (oAppData) {
                    var sCurrencyFormat = oAppData.getProperty("/userData/CurrencyFormat");
                    if (sCurrencyFormat && sCurrencyFormat.length >= 2) {
                        thousandSeparator = sCurrencyFormat.charAt(0);
                        decimalSeparator = sCurrencyFormat.charAt(1);
                    }
                }
            } catch (e) {
                //     Se mantienen los separadores por defecto si el modelo no es accesible.
            }

            var oBindingDef = {
                path: sPath,
                type: new sap.ui.model.type.Float(
                    {
                        minFractionDigits: iDecimals,
                        maxFractionDigits: iDecimals,
                        groupingEnabled: true,
                        //     Se sustituyen los separadores fijos por los del usuario
                        //     para garantizar coherencia con el resto de inputs de la tabla.
                        groupingSeparator: thousandSeparator,
                        decimalSeparator: decimalSeparator
                    },
                    { nullable: true }
                )
            };

            //  Se añade el nombre del modelo al objeto de binding únicamente
            //  cuando fue posible extraerlo de la ruta completa recibida.
            if (sModel) {
                oBindingDef.model = sModel;
            }

            return oBindingDef;
        },

        //  Se expone el formatter toBoolean del modulo model/formatter en el
        //  propio BaseController para que las vistas puedan invocarlo con la
        //  convencion habitual del proyecto ".toBoolean", igual que ocurre con
        //  formatDecimales. Sin este wrapper UI5 no encontraria la funcion al
        //  resolver el binding y el CheckBox seguiria recibiendo el string ""
        //  del backend, lanzando "expected boolean for property selected".
        toBoolean: function (vValue) {
            if (vValue === true) return true;
            if (vValue === false || vValue === null || vValue === undefined) return false;
            if (typeof vValue === "number") return vValue !== 0;
            if (typeof vValue === "string") {
                var sNorm = vValue.trim().toLowerCase();
                return sNorm === "x" || sNorm === "true" || sNorm === "1";
            }
            return false;
        },

        _parseFormattedNumber: function (vValue) {
            //   Se devuelve cero si el valor recibido está vacío o es nulo para
            //   evitar que se escriban valores indefinidos en el modelo de datos.
            if (vValue === null || vValue === undefined || vValue === "") {
                return 0;
            }

            //   Se eliminan los puntos de millar y se reemplaza la coma decimal
            //   por punto para que parseFloat pueda interpretar el valor correctamente.
            var fVal = parseFloat(
                String(vValue).replace(/\./g, "").replace(",", ".")
            );

            //   Se devuelve cero como valor de seguridad si el parseo no produce
            //   un número válido, evitando que NaN se propague al modelo.
            return isNaN(fVal) ? 0 : fVal;
        },

        _getSelectedEjercicio: function () {
            var oYearsModel = this.getView().getModel("yearsModel");
            if (!oYearsModel) {
                return null;
            }
            var sYear = oYearsModel.getProperty("/selectedYear");
            return sYear ? String(sYear) : null;
        },


        _cargarDatosTabla: function () {
            var oAppData = this.getGlobalModel("appData");

            // Obtenemos los datos (cambio el nombre de la variable a "oKpisIndirectos" porque es un objeto)
            var oKpisIndirectos = oAppData.getProperty("/NavKpisIndirectos") || {};

            // Creamos el modelo y metemos el objeto DENTRO DE UN ARRAY [ ]
            var oDatakpiModel = new sap.ui.model.json.JSONModel({
                aKpisIndirectos: [oKpisIndirectos]
            });

            this.getView().setModel(oDatakpiModel, "dataTitle");
        },
        //   Se resetea completamente el estado del flujo LIN para la fila activa.
        //   Se eliminan las fechas seleccionadas y se limpia el tipo de distribución (Select).
        _resetLinState: function () {
            //   Se usa tableModelName para que el reset funcione en cualquier vista hija.
            var oModel = this.getView().getModel(this.tableModelName);
            var sPath = this._oActiveContext.getPath();
            oModel.setProperty(sPath + "/_linDateFrom", null);
            oModel.setProperty(sPath + "/_linDateTo", null);
            oModel.setProperty(sPath + "/Fini", null);
            oModel.setProperty(sPath + "/Ffin", null);
            oModel.setProperty(sPath + "/Tipo", "");
            if (this._oCalendar) {
                this._oCalendar.removeAllSelectedDates();
            }
        },

        getCalendarTooltip: function (dFrom, dTo) {

            //   Se retorna el texto por defecto si alguna de las fechas no esta disponible.
            if (!dFrom || !dTo) {
                //   Se traduce el tooltip por defecto via i18n.  
                return this.getTranslatedText("selectDateRangeTooltip");
                //  
            }

            //   Se normaliza el valor recibido a objeto Date nativo independientemente
            //   de si llego como instancia Date o como cadena de texto parseable.
            var oFrom = dFrom instanceof Date ? dFrom : new Date(dFrom);
            var oTo = dTo instanceof Date ? dTo : new Date(dTo);

            //   Se verifica que ambas fechas resultantes sean validas antes de formatear
            //   para evitar mostrar "Invalid Date" en el tooltip de la interfaz.
            if (isNaN(oFrom.getTime()) || isNaN(oTo.getTime())) {
                //   Se traduce el tooltip por defecto via i18n.  
                return this.getTranslatedText("selectDateRangeTooltip");
                //  
            }

            //   Se instancia el formateador de fecha con el patron dd/MM/yyyy
            //   para presentar el rango en el formato habitual del mercado espanol.
            var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                pattern: "dd/MM/yyyy"
            });

            //   Se devuelve la cadena con el rango de fechas formateado y separado por guion.
            return oDateFormat.format(oFrom) + " - " + oDateFormat.format(oTo);
        },
        //  Se envuelve el handler change de las celdas
        //  mensuales editables para habilitar la entrada de
        //  porcentajes. Cuando el usuario teclea una expresion
        //  con signo % (ej. "50%") y abandona la celda, se
        //  interpreta el valor como porcentaje del campo
        //  AmoPen (Coste pendiente) de la misma fila. El
        //  resultado calculado (AmoPen * pct / 100) sustituye
        //  al valor mostrado antes de delegar en
        //  onRowInputChange, que se encarga del envio al
        //  backend con la logica habitual (filtro de valor no
        //  cambiado, payload sanitizado y restauracion de
        //  foco). Se inspecciona el parametro original del
        //  evento ("newValue" o "value") porque DecimalesInput
        //  ejecuta su attachChange antes que este handler y
        //  elimina el signo % al normalizar el value visible.
        //  Si AmoPen no es un numero valido se interpreta como
        //  cero y el filtro de no-cambio de onRowInputChange
        //  evita un POST redundante.
        //      Se cambia la base del calculo de
        //  porcentaje de PenPlan (Pend. planif.) a "Coste
        //  pendiente" segun el nuevo requisito funcional.
        //  El nombre concreto del campo varia por vista, por
        //  lo que se delega en _getCostePendienteField. El
        //  default devuelve "AmoPen" (Corrientes / Externos);
        //  Anticipados / Diferidos / Inmovilizados sobrescriben
        //  el metodo para devolver "_Pendiente".
        //    
        //      Hook sobrescribible por cada controlador
        //  de vista para indicar el nombre del campo del modelo
        //  que representa "Coste pendiente". Se utiliza desde
        //  onMonthInputChange para calcular porcentajes en las
        //  celdas mensuales editables.
        _getCostePendienteField: function () {
            return "AmoPen";
        },
        //    
        onMonthInputChange: function (oEvent) {
            var oSource = oEvent.getSource();
            var sRawValue = oEvent.getParameter("newValue");
            if (sRawValue === undefined || sRawValue === null) {
                sRawValue = oEvent.getParameter("value");
            }
            sRawValue = sRawValue === undefined || sRawValue === null ? "" : String(sRawValue);

            if (sRawValue.indexOf("%") !== -1) {
                //  Se leen los separadores reales del usuario
                //  para parsear el numero anterior al %
                //  respetando el formato regional.
                var thousandSeparator = ".";
                var decimalSeparator = ",";
                try {
                    var oAppData = this.getGlobalModel("appData");
                    if (oAppData) {
                        var sCurrencyFormat = oAppData.getProperty("/userData/CurrencyFormat");
                        if (sCurrencyFormat && sCurrencyFormat.length >= 2) {
                            thousandSeparator = sCurrencyFormat.charAt(0);
                            decimalSeparator = sCurrencyFormat.charAt(1);
                        }
                    }
                } catch (e) { }

                var sPercentRaw = sRawValue.replace("%", "").trim();
                var sParseable = sPercentRaw
                    .split(thousandSeparator).join("")
                    .split(decimalSeparator).join(".");
                var fPercent = parseFloat(sParseable);

                if (!isNaN(fPercent)) {
                    //  Se localiza el contexto subiendo por
                    //  los padres si el input no posee binding
                    //  directo sobre la fila, mismo patron que
                    //  onRowInputChange.
                    var oContext = oSource.getBindingContext(this.tableModelName);
                    var oParent = oSource;
                    while (!oContext && oParent) {
                        oParent = oParent.getParent();
                        if (oParent && oParent.getBindingContext) {
                            oContext = oParent.getBindingContext(this.tableModelName);
                        }
                    }

                    if (oContext) {
                        //      Se calcula el porcentaje sobre el campo
                        //  "Coste pendiente" en lugar de PenPlan (Pend. planif.)
                        //  segun el nuevo requisito funcional. El nombre del
                        //  campo difiere por vista: Corrientes/Externos usan
                        //  "AmoPen", mientras que Anticipados/Diferidos/Inmovilizados
                        //  usan "_Pendiente". Se delega la resolucion en
                        //  _getCostePendienteField, sobrescribible por cada
                        //  controlador concreto.
                        var sCostePendField = (typeof this._getCostePendienteField === "function")
                            ? this._getCostePendienteField()
                            : "AmoPen";
                        var vCostePend = oContext.getModel().getProperty(oContext.getPath() + "/" + sCostePendField);
                        var sCostePendSap = this._formatToSAPNumber(
                            String(vCostePend !== null && vCostePend !== undefined ? vCostePend : "")
                        );
                        var fCostePend = parseFloat(sCostePendSap);
                        if (isNaN(fCostePend)) {
                            fCostePend = 0;
                        }

                        var fResult = (fCostePend * fPercent) / 100;

                        //   Se delega el formateo del resultado del porcentaje en
                        // formatDecimales (la misma funcion que pinta el resto de
                        // celdas) en lugar de duplicar aqui el calculo de decimales.
                        // Asi el valor calculado coincide EXACTAMENTE con como se
                        // muestra cualquier otra celda: 0 decimales y redondeo hacia
                        // arriba (Math.ceil) para monedas sin decimales (CL1/CLP...),
                        // 2 decimales para el resto.
                        //   Antes se leia oSource._getEffectiveDecimals(), que usa el
                        // modelo appData del PROPIO input. En la sap.ui.table los
                        // inputs de celda se reciclan durante la virtualizacion y en
                        // algunas filas ese modelo no resolvia, cayendo al fallback
                        // decimalNumbers (dashboardModel>/decimales = "02") y pintando
                        // la coma con 2 decimales solo en algunas filas. Ademas usaba
                        // NumberFormat (redondeo normal) en vez del Math.ceil de
                        // formatDecimales, descuadrando el % frente al resto de celdas.
                        // formatDecimales lee /Waers via el componente, de forma estable.
                        var sFormatted = this.formatDecimales(fResult);

                        oSource.setValue(sFormatted);
                        //  Se sincroniza _lastProcessedValue de
                        //  DecimalesInput con el valor calculado
                        //  para que su fallback focusout no vuelva
                        //  a disparar fireChange con newValue vacio.
                        oSource._lastProcessedValue = sFormatted;
                    }
                }
            }

            return this.onRowInputChange(oEvent);
        },

        onRowInputChange: async function (oEvent) {

            let oSource = oEvent.getSource();
            let oContext = oSource.getBindingContext(this.tableModelName) ||
                oSource.getBindingContext("panelModel");

            // Se busca el contexto real subiendo por los padres cuando el control
            // no posee binding directo sobre la fila.
            let oParent = oSource;
            while (!oContext && oParent) {
                oParent = oParent.getParent();
                if (oParent && oParent.getBindingContext) {
              oContext = oParent.getBindingContext(this.tableModelName) ||
                        oParent.getBindingContext("panelModel");
                }
            }

            // Se cancela si no existe contexto valido.
            if (!oContext) return;

            // Se obtiene binding info del value para identificar el campo tecnico.
            var oBI = oSource.getBindingInfo && oSource.getBindingInfo("value");
            var sCampoMod = "";

            if (oBI) {
                if (oBI.parts && oBI.parts[0] && oBI.parts[0].path) {
                    sCampoMod = oBI.parts[0].path;
                } else if (oBI.path) {
                    sCampoMod = oBI.path;
                }
            }

            // ── Caso especial: fila Desglose (nivel 3) recien creada (isNew) ──
            //   Operacion (PhPspnr) y descripcion (Post1) se introducen vacias. El
            //   primer guardado temporal solo se dispara cuando AMBOS estan rellenos y
            //   la operacion respeta el formato del padre (PADRE.NNN, sufijo de 3
            //   digitos). Se delega en un handler dedicado que valida y, si procede,
            //   envia la fila completa con CampoMod="PhPspnr,Post1".
            var oRowEdit = oContext.getObject();
            if (oRowEdit && oRowEdit.isNew === true && oRowEdit.isLevel3 === true &&
                (sCampoMod === "PhPspnr" || sCampoMod === "Post1")) {
                return this._handleNuevaFilaNivel3Change(oSource, oContext, sCampoMod);
            }

            let sNewValue;
            let sValorFormateado;

            if (oSource.isA("sap.m.Select")) {
                sNewValue = oSource.getSelectedKey();

                // Actualizacion del modelo para consistencia visual
                oContext.getModel().setProperty(oContext.getPath() + "/Tipo", sNewValue);

                //     Si el campo modificado es TipoTasa se recalculan los flags de
                // editabilidad que dependen de su valor: editTasa, editCtotPen y editCtot.
                // Esto garantiza que al cambiar TipoTasa en una fila con Estructura=O
                // las columnas %Tasa, Pendiente y Total reflejen inmediatamente la nueva
                // condicion de editabilidad sin necesidad de recargar el modelo.
                if (sCampoMod === "TipoTasa") {
                    const oRowObj = oContext.getObject();
                    const isO = oRowObj && oRowObj.Estructura === "O";
                    const oModel = oContext.getModel();
                    const sBasePath = oContext.getPath();

                    oModel.setProperty(sBasePath + "/editTasa", isO && sNewValue === "X");
                    oModel.setProperty(sBasePath + "/editCtotPen", isO && sNewValue !== "X");
                    oModel.setProperty(sBasePath + "/editCtot", isO && sNewValue !== "X");
                }

                // Caso especial LIN: abre el selector de rango
                if (sNewValue === "LIN") {
                    setTimeout(function () {
                        this.onOpenRangePicker(
                            { getSource: function () { return oSource; } },
                            null,
                            oContext
                        );
                    }.bind(this), 50);
                    return;
                }
                  if (this._isLocalOnlyTipo(oContext)) {
                    return;
                }

                let oRow = oContext.getObject();
                let oPayloadRow = this._sanitizeRowForBackend(oRow);

                oPayloadRow.Tipo = sNewValue;
                this._enviarFilaAlBackend(oContext, oPayloadRow, "Tipo");
                return;
            }

            sNewValue = oSource.getValue();
               //     
               //   Lista de campos que NO deben pasar por _formatToSAPNumber (que convierte
               //   "123" en "123.00000"). Antes solo PhPspnr/Post1/PepDest estaban listados;
               //   las demas String fields del nuevo EntityType DatosIndirectosDesglo
               //   (DESCRIP/AGRUP/Tipo/Waers/Prov/Zui5Descrip/Aut/Gjahr1..3/TipoTasa/Estructura/
               //   CheckInfla/Name/Exp/Descrip/Agrup) tambien deben tratarse como texto para que
               //   al teclear "123" la celda muestre "123" y no "123,00000".
               //    
               var aCamposTexto = [
                   //   Originales (DatosIndirectos legacy)
                   "PhPspnr", "Post1", "PepDest",
                   //   String fields del UI desglose en MAYUSCULA (Corrientes/Externos)
                   "DESCRIP", "AGRUP", "FINI", "FFIN",
                   //   String fields del EntityType DatosIndirectosDesglo (backend)
                   "Descrip", "Agrup", "Name", "Exp", "Tipo", "TipoTasa", "Waers",
                   "CheckInfla", "Estructura", "Gjahr1", "Gjahr2", "Gjahr3",
                   "Prov", "Zui5Descrip", "Aut", "PhPepDest"
               ];
            var bCampoTexto = aCamposTexto.indexOf(sCampoMod) !== -1;
            sValorFormateado = bCampoTexto ? sNewValue : this._formatToSAPNumber(sNewValue);
           

            if (sCampoMod) {
                // Se aplica el filtro de comparacion (valor nuevo vs valor actual
                //en el modelo) tambien a los campos de mes. Originalmente los meses
                //saltaban este filtro y enviaban siempre al backend en cada blur,
                //lo que generaba una chain de llamadas async durante la navegacion
                //rapida con flechas: cada celda atravesada disparaba un POST y la
                //respuesta posterior intentaba restaurar el foco al target capturado
                //al inicio de la llamada, provocando saltos eraticos cuando el
                //usuario habia avanzado varias celdas. Con el filtro activo, una
                //simple navegacion sin edicion no genera ninguna llamada al backend.
                //     
                //   Para las filas del desglose (__isMainEditable / __isNieto) en
                //   Corrientes/Externos se omite el filtro: los Inputs de esas filas son
                //   sap.m.Input planos sin formatter, por lo que el two-way binding ya
                //   ha actualizado el modelo al disparar el "change" y la comparacion
                //   "valor formateado == valor en modelo" siempre da igual, abortando
                //   el envio. Resultado: NINGUN edit de campos del desglose llegaba a
                //   _enviarFilaAlBackend. Sin el filtro, cada cambio de celda dispara
                //   un POST a GuardarTempIndirDesgloSet (mismo comportamiento que el
                //   guardado temporal "normal" del resto de filas).
                var oRowChk = oContext.getObject();
                var bSkipFilterDesglose = oRowChk && oRowChk.__isCustom === true
                    && (oRowChk.__isMainEditable === true || oRowChk.__isNieto === true)
                    && (this._pestana === "Corrientes" || this._pestana === "Externos");
                //    
                if (!bSkipFilterDesglose) { //     se conserva el filtro solo fuera del desglose
                    var sValorActualModelo = oContext.getModel().getProperty(oContext.getPath() + "/" + sCampoMod);
                    var sValorActualNormalizado = bCampoTexto
                        ? String(sValorActualModelo !== null && sValorActualModelo !== undefined ? sValorActualModelo : "")
                        : this._formatToSAPNumber(
                            String(sValorActualModelo !== null && sValorActualModelo !== undefined ? sValorActualModelo : "")
                        );

                    // Si el valor no ha cambiado realmente, abortamos envio
                    if (sValorFormateado === sValorActualNormalizado) {
                        return;
                    }
                }
            }

            // Actualizamos el modelo antes de generar el objeto final
            if (sCampoMod && sValorFormateado !== null && sValorFormateado !== undefined && sValorFormateado !== "") {
                oContext.getModel().setProperty(oContext.getPath() + "/" + sCampoMod, sValorFormateado);
            }

            let oRow = oContext.getObject();
            let oPayloadRow = this._sanitizeRowForBackend(oRow);

            if (sCampoMod && sValorFormateado !== null && sValorFormateado !== undefined && sValorFormateado !== "") {
                oPayloadRow[sCampoMod] = sValorFormateado;
            }

            this._enviarFilaAlBackend(oContext, oPayloadRow, sCampoMod);
        },

        onRepartoChange: function (oEvent) {
            return this.onRowInputChange(oEvent);
        },

       
        _handleNuevaFilaNivel3Change: async function (oSource, oContext, sCampoMod) {
            var oModel = oContext.getModel();
            var sPath = oContext.getPath();
            var oRow = oContext.getObject();

            //   El valor tecleado se vuelca sin formateo numerico (son campos de texto).
            var sTyped = oSource.getValue();
             if (sCampoMod === "PhPspnr") { //  
                var sUpperTyped = sTyped.toUpperCase(); //   se convierte a mayusculas
                if (sTyped !== sUpperTyped) { //   solo se reasigna si hay diferencia para no perder cursor
                    sTyped = sUpperTyped; //  
                    oSource.setValue(sTyped); //   se refleja el cambio en el Input
                }
            }
            oModel.setProperty(sPath + "/" + sCampoMod, sTyped);

            //   Solo se dispone del input de Operacion para senalizar el ValueState
            //   cuando es el campo que se acaba de editar.
            var oOperacionInput = (sCampoMod === "PhPspnr") ? oSource : null;

            var sOperacion = (oModel.getProperty(sPath + "/PhPspnr") || "").trim();
            var sDescripcion = (oModel.getProperty(sPath + "/Post1") || "").trim();
            var sParentCode = oRow.ParentCode || "";

            //   Validacion del formato de la operacion en cuanto haya algo escrito,
            //   para dar feedback inmediato sin esperar a la descripcion.
            if (sOperacion) {
                var sError = this._validarOperacionNivel3(sOperacion, sParentCode);
                if (sError) {
                    if (oOperacionInput) {
                        oOperacionInput.setValueState("Error");
                        oOperacionInput.setValueStateText(sError);
                        oOperacionInput.focus();
                    }
                    return;
                }
                if (oOperacionInput) oOperacionInput.setValueState("None");
            }

            //   No se guarda la fila mientras falte cualquiera de los dos campos.
            if (!sOperacion || !sDescripcion) {
                return;
            }

            //   Contexto completo: la fila se clono del padre en _createLevel3Row, por
            //   lo que _sanitizeRowForBackend produce el payload con todo el contexto.
            var oPayloadRow = this._sanitizeRowForBackend(oRow);
            oPayloadRow.PhPspnr = sOperacion;
            oPayloadRow.Post1 = sDescripcion;
 if (this._pestana && typeof this._callAddIndirectosService === "function") {
                var aOperationToCalcular = [{
                    PhPspnr: sOperacion,
                    Descripcion: sDescripcion
                }];
                try {
                    var responseAdd = await this._callAddIndirectosService(aOperationToCalcular);
                    var aMensajesCalc = (responseAdd.NavMensajes && responseAdd.NavMensajes.results) || [];
                    var aMensajesErrorCalc = aMensajesCalc.filter(function (m) { return m.Tipo === "E"; });
                    if (aMensajesErrorCalc.length > 0) {
                        this.createMessageDialog({
                            title: this.getTranslatedText("ERROR"),
                            textAccept: this.getTranslatedText("ACEPTAR"),
                            messages: aMensajesErrorCalc.map(function (m) {
                                return { text: m.Mensaje || m.Message || m.text || "", type: "Error" };
                            })
                        });
                        return;
                    }
                    //   Se vuelcan los campos calculados (TotalAnho, etc.) sobre la fila
                    // sin tocar children ni flags UI: igual que antes pero ahora se hace
                    // ANTES del guardado temporal, para que el payload del guardado lleve
                    // los datos finales de la operacion ya dada de alta.
                    var aRowsCalc = (responseAdd.NavDatosIndirectos && responseAdd.NavDatosIndirectos.results) || [];
                    var oRowCalc = aRowsCalc.find(function (r) { return r.PhPspnr === sOperacion; });
                    if (oRowCalc) {
                        Object.keys(oRowCalc).forEach(function (sKey) {
                            if (sKey === "children" || sKey === "isNew" || sKey === "isEditable" ||
                                sKey === "editPhPspnr" || sKey === "editPost1" || sKey === "editMonths" ||
                                sKey === "editTipo" || sKey === "isLevel3") {
                                return;
                            }
                            if (oModel.getProperty(sPath + "/" + sKey) !== undefined) {
                                oModel.setProperty(sPath + "/" + sKey, oRowCalc[sKey]);
                            }
                        });
                        oModel.refresh(true);
                    }
                } catch (error) {
                    sap.m.MessageBox.error(
                        "Error al añadir la operación: " + (error.message || error),
                        { title: this.getTranslatedText("ERROR") }
                    );
                    return;
                }
            }

            //   Despues del alta correcta (o cuando no hay pestana definida) se hace el
            // guardado temporal de los campos editables. En la fila nueva CampoMod viaja
            // con los dos campos nuevos por coma.
            var bOk = await this._enviarFilaAlBackend(oContext, oPayloadRow, "PhPspnr,Post1");

            //   Tras el primer guardado correcto la fila deja de ser nueva: la
            //   operacion queda bloqueada (en Corrientes el Input de texto se oculta al
            //   caer isNew; en Externos la editabilidad depende de editPhPspnr) y los
            //   siguientes cambios usan el flujo normal de onRowInputChange.
            if (bOk) {
                oModel.setProperty(sPath + "/isNew", false);
                oModel.setProperty(sPath + "/editPhPspnr", false);
                oModel.setProperty(sPath + "/editPost1", false);
                oModel.setProperty(sPath + "/isEditable", true);
                oModel.refresh(true);
            }
           
        },

        //   Valida que la operacion de una fila nivel 3 respete el formato del padre:
        // debe ser exactamente PADRE + "." + sufijo de 3 digitos (p.ej. I.003.030.001).
        // Devuelve el texto de error traducido si no cumple, o null si es valida.
        _validarOperacionNivel3: function (sOperacion, sParentCode) {
            if (!sParentCode) {
                return this.getTranslatedText("ERROR_FORMATO_INCORRECTO");
            }
            var aParts = sOperacion.split(".");
            var aParentParts = sParentCode.split(".");
            var sPrefijo = sParentCode + ".";

            //   Prefijo y numero de segmentos: el codigo del padre + un segmento mas.
            if (aParts.length !== aParentParts.length + 1 ||
                aParts.slice(0, aParentParts.length).join(".") !== sParentCode) {
                return this.getTranslatedText("ERROR_CODIGO_PREFIJO_INCORRECTO").replace(/\{0\}/g, sPrefijo);
            }

            //   Sufijo: exactamente 3 digitos.
            if (!/^\d{3}$/.test(aParts[aParts.length - 1])) {
                return this.getTranslatedText("ERROR_CODIGO_3_DIGITOS").replace(/\{0\}/g, sPrefijo);
            }

            return null;
        },

            /**
         * Se gestiona el cambio de valores en los campos _Total y _Pendiente de las tablas
         * de Anticipados, Diferidos e Inmovilizados, mapeando estos campos intermedios a
         * los campos reales del modelo según el valor de TipoInd.
         * 
         * Mapeo de campos:
         * - _Total → AmoTot si TipoInd="A" o "B", InvTot si TipoInd="I" o "P"
         * - _Pendiente → AmoPen si TipoInd="A" o "B", InvPen si TipoInd="I" o "P"
         * 
         * @param {sap.ui.base.Event} oEvent - Evento de cambio del input
         */
        onRowInputChangeInversion: async function (oEvent) {
            let oSource = oEvent.getSource();
            let oContext = oSource.getBindingContext(this.tableModelName);
            
            // Se busca el contexto real subiendo por los padres cuando el control
            // no posee binding directo sobre la fila.
            let oParent = oSource;
            while (!oContext && oParent) {
                oParent = oParent.getParent();
                if (oParent && oParent.getBindingContext) {
                    oContext = oParent.getBindingContext(this.tableModelName);
                }
            }
            
            // Se cancela si no existe contexto valido.
            if (!oContext) return;
            
            // Se obtiene binding info del value para identificar el campo intermedio.
            var oBI = oSource.getBindingInfo && oSource.getBindingInfo("value");
            var sIntermediateField = "";
            
            if (oBI) {
                if (oBI.parts && oBI.parts[0] && oBI.parts[0].path) {
                    sIntermediateField = oBI.parts[0].path;
                } else if (oBI.path) {
                    sIntermediateField = oBI.path;
                }
            }
            
            // Se obtiene el valor introducido por el usuario usando getValue()
            let sNewValue = oSource.getValue();
            let sValorFormateado = this._formatToSAPNumber(sNewValue);
            
            // Se valida que el valor sea numérico
            var fValue = parseFloat(sValorFormateado);
            if (isNaN(fValue)) {
                fValue = 0;
            }
            
            // Se obtiene el objeto de datos de la fila
            var oData = oContext.getObject();
            
            // Se obtiene el valor de TipoInd para determinar el mapeo correcto
            var sTipoInd = oData.TipoInd;
            
            if (!sTipoInd) {
                console.warn("TipoInd no definido para la fila en: " + oContext.getPath());
                return;
            }
            
            // Se determina el campo real del modelo según el campo intermedio y TipoInd
            var sRealField = null;
            
            if (sIntermediateField === "_Total") {
                // Mapeo para _Total
                if (sTipoInd === "A" || sTipoInd === "B") {
                    sRealField = "AmoTot";
                } else if (sTipoInd === "I" || sTipoInd === "P") {
                    sRealField = "InvTot";
                }
            } else if (sIntermediateField === "_Pendiente") {
                // Mapeo para _Pendiente
                if (sTipoInd === "A" || sTipoInd === "B") {
                    sRealField = "AmoPen";
                } else if (sTipoInd === "I" || sTipoInd === "P") {
                    sRealField = "InvPen";
                }
            }
            
            // Se valida que se haya determinado un campo real válido
            if (!sRealField) {
                console.warn("No se pudo determinar el campo real para: " + sIntermediateField + " con TipoInd: " + sTipoInd);
                return;
            }
            
            // Se actualiza el modelo antes de generar el objeto final
            if (sRealField && sValorFormateado !== null && sValorFormateado !== undefined && sValorFormateado !== "") {
                oContext.getModel().setProperty(oContext.getPath() + "/" + sRealField, sValorFormateado);
            }
            
         
            let oRow = oContext.getObject();
            let oPayloadRow = this._sanitizeRowForBackend(oRow);

            // Se asegura que el campo real tenga el valor formateado en el payload
            if (sRealField && sValorFormateado !== null && sValorFormateado !== undefined && sValorFormateado !== "") {
                oPayloadRow[sRealField] = sValorFormateado;
            }
            
            // Se envía la fila al backend
            this._enviarFilaAlBackend(oContext, oPayloadRow, sRealField);
        },
            _isLocalOnlyTipo: function (oContext) {
            if (!oContext) return false;
            var oRow = oContext.getObject();
 
            if (oRow && oRow.__isCustom === true) {
                var bIsDesglosePest = this._pestana === "Corrientes" || this._pestana === "Externos";
                var bIsSavableDesglose = oRow.__isMainEditable === true || oRow.__isNieto === true;
                if (bIsDesglosePest && bIsSavableDesglose) {
                    return false;
                }
                return true;
            }
            //    
            var oView = this.getView();
            var oPanelModel = oView && oView.getModel("panelModel");
            if (oPanelModel && oContext.getModel() === oPanelModel) return true;
            return false;
        },
        //   Se añade CampoMod en cabecera para indicar el campo modificado al backend.
        //     Se envia la fila modificada al backend y se restaura el foco
        //     en el input destino si existe navegacion pendiente tipo Excel.
        _enviarFilaAlBackend: async function (oContext, oPayloadRow, sCampoMod) {

          
            this._hasPendingChanges = true; 
     
             var oRowNew = oContext.getObject();
            var bIsNuevoSubcap = oRowNew && oRowNew.isNew === true && oRowNew.isSubcapitulo === true;
            if (bIsNuevoSubcap && sCampoMod && sCampoMod.indexOf("PhPspnr") === -1) {
                sCampoMod = "PhPspnr,Post1," + sCampoMod;
            }


            var sEjercicio = this._getSelectedEjercicio() || new Date().getFullYear().toString();
            var oAppData = this.getGlobalModel("appData").getData();

            //     Se guarda el destino de foco antes de la llamada asincrona.
            var oPendingFocus = this._pendingFocusTarget || null;

        
            var sEndpoint = "/GuardarTempIndirSet";
            var oBody = {
                "NavSelProyecto": [oAppData.tramo],
                "NavDatosIndirectos": [oPayloadRow],
                "NavMensajes": []
            };
            var oExtraHeaders = {};
            var bIsDesglosePest = this._pestana === "Corrientes" || this._pestana === "Externos";
            var bIsDesgloseRow = bIsDesglosePest && oRowNew && oRowNew.__isCustom === true
                && (oRowNew.__isMainEditable === true || oRowNew.__isNieto === true);
            if (bIsDesgloseRow) {
                //   Se obtiene la fila padre (capitulo / operacion) navegando un nivel arriba
                //   en el modelo. ParentPath se rellena con el PhPspnr del padre (17 chars segun metadata).
                var sRowPath = oContext.getPath();
                var sParentPath = sRowPath.replace(/\/children\/\d+$/, "");
                var oParentRow = sParentPath && oContext.getModel().getProperty(sParentPath);
                if (oParentRow && (oParentRow.Psphi || oParentRow.Pspnr)) {
                    var oDesglosePayload = this._buildDesglosePayloadRow(oRowNew, oParentRow, oPayloadRow);
                    sEndpoint = "/GuardarTempIndirDesgloSet";
                   
                    oBody = {
                        "NavSelProyecto": [oAppData.tramo],
                        "NavDatosIndirectosDesglo": oDesglosePayload
                    };
               
                    oExtraHeaders.token = oAppData.EvToken || "";
                    oExtraHeaders.campomod = (sCampoMod || "").toLowerCase();
                    oExtraHeaders.Lang = oAppData.userData.AplicationLangu;
                    //   Se marca el flag para suprimir el header CampoMod (PascalCase) del bloque
                    //   legacy: la spec del nuevo entity usa solo "campomod" minuscula y duplicar
                    //   no aporta nada.
                    oExtraHeaders.__bIsDesgloseFlow = true;
                }
            }
            //    

            //     Se construye el bloque de cabeceras teniendo en cuenta si el flujo es
            //   desglose o legado. Para el desglose se omite CampoMod (PascalCase) porque la
            //   spec usa solo "campomod" minuscula, y se quita la marca tecnica del flag.
            var bIsDesgloseFlowHeader = oExtraHeaders.__bIsDesgloseFlow === true;
            delete oExtraHeaders.__bIsDesgloseFlow; //   no es un header real
            var oHeadersBase = {
                ambito: oAppData.userData.initialNode,
                lang: oAppData.userData.AplicationLangu,
                bloqueado: "",
                decimales: "02",
                ejercicio: sEjercicio,
                pestana: this._pestana || ""
            };
            if (!bIsDesgloseFlowHeader) {
                //   El flujo legado (GuardarTempIndirSet) sigue enviando CampoMod en PascalCase.
                oHeadersBase.CampoMod = sCampoMod || "";
            }
            try {
                const response = await this.post(
                    this.getGlobalModel("mainService"),
                    sEndpoint, //     endpoint dinamico: desglose o legado
                    oBody,     //     body dinamico segun endpoint
                    {
                        noLoading: true,
                        headers: Object.assign(oHeadersBase, oExtraHeaders) //     extras: token/campomod/Lang en desglose
                    }
                );

                try {
                    var aDbgRows = (response && response.NavDatosIndirectos && response.NavDatosIndirectos.results) || [];
                    var aDbgResumen = aDbgRows.map(function (r) {
                        var oRes = { PhPspnr: r.PhPspnr, TipoInd: r.TipoInd, Tipo: r.Tipo };
                        Object.keys(r).forEach(function (k) {
                            if (/^Val\d{3}a[12]$/.test(k) && r[k] !== undefined && r[k] !== null && String(r[k]) !== "0" && String(r[k]) !== "0.00000") {
                                oRes[k] = r[k];
                            }
                        });
                        return oRes;
                    });
                    console.log("[MV-DEBUG fila azul] campo enviado:", sCampoMod, "| filas devueltas:", aDbgRows.length, "| resumen (solo Val* no nulos):", aDbgResumen);
                } catch (e) { /*   Se ignora cualquier error del log de debug para no romper el flujo */ }

                // Errores backend → diálogo, mismo patrón que initCorrienteModel/
                // initExternosModel/initDiferidosModel. Sin esto el usuario edita una
                // celda, el backend rechaza el cambio y no recibe ninguna señal.
                var aMensajes = (response && response.NavMensajes && response.NavMensajes.results) || [];
                var aMensajesError = aMensajes.filter(function (m) { return m.Tipo === "E"; });
                //   bSuccess permite a los llamadores (p.ej. el guardado de la fila
                //   nivel 3 nueva) saber si el backend acepto el cambio: si hay mensajes
                //   de error no se debe considerar consolidada la fila.
                var bSuccess = aMensajesError.length === 0;
                if (aMensajesError.length > 0) {
                    this.createMessageDialog({
                        title: this.getTranslatedText("ERROR"),
                        textAccept: this.getTranslatedText("ACEPTAR"),
                        messages: aMensajesError.map(function (m) {
                            return { text: m.Mensaje || m.Message || m.text || "", type: "Error" };
                        })
                    });
                }

             
                var aUpdatedRows = (response && response.NavDatosIndirectos && response.NavDatosIndirectos.results) || [];
            
                if (aUpdatedRows.length > 0 && (bIsNuevoSubcap || this._shouldMergeTempSaveResponse())) {
                    this._mergeBackendRowsIntoTree(oContext.getModel(), aUpdatedRows);
                }
                 if (bSuccess && bIsNuevoSubcap) {
                    oContext.getModel().setProperty(oContext.getPath() + "/isNew", false);
                }

                if (oPendingFocus && oPendingFocus.getDomRef()) {
                    setTimeout(function () {
                        var oTargetDom = oPendingFocus.getDomRef();
                        var oActiveEl = document.activeElement;
                        if (oActiveEl && oTargetDom && oActiveEl !== oTargetDom &&
                            (oActiveEl.tagName === "INPUT" || oActiveEl.tagName === "TEXTAREA")) {
                            // El usuario ya se ha movido a otro campo editable:
                            //se respeta su posicion actual y no se devuelve el foco.
                            return;
                        }
                        oPendingFocus.focus();
                        if (oPendingFocus.select) oPendingFocus.select();
                    }, 50);
                }

                //     Se limpia el estado de foco pendiente.
                this._pendingFocusTarget = null;

                return bSuccess;

            } catch (error) {


                //     Se limpia tambien en caso de error para evitar inconsistencias.
                this._pendingFocusTarget = null;
                return false;
            }
        },

     
        _shouldMergeTempSaveResponse: function () {
            return true;
        },

        _mergeBackendRowsIntoTree: function (oModel, aBackendRows) {
            if (!oModel || !aBackendRows || aBackendRows.length === 0) return;

            var oRoot = oModel.getData();
            if (!oRoot) return;
            var aRoots = Array.isArray(oRoot) ? oRoot : [oRoot];

            var mNodesByPath = {};
            var walk = function (aNodes) {
                if (!aNodes) return;
                for (var i = 0; i < aNodes.length; i++) {
                    var oNode = aNodes[i];
                    if (!oNode) continue;
                    // Se usa PhPspnr + TipoInd como clave compuesta
                    if (oNode.PhPspnr) {
                        var sKey = oNode.PhPspnr + "_" + (oNode.TipoInd || "");
                        mNodesByPath[sKey] = oNode;
                    }
                    if (oNode.children) walk(oNode.children);
                }
            };
            walk(aRoots);

            aBackendRows.forEach(function (oBackendRow) {
                if (!oBackendRow || !oBackendRow.PhPspnr) return;
                // Se busca usando la clave compuesta PhPspnr + TipoInd
                var sKey = oBackendRow.PhPspnr + "_" + (oBackendRow.TipoInd || "");
                var oLocalNode = mNodesByPath[sKey];
                if (!oLocalNode) return;

                Object.keys(oBackendRow).forEach(function (sKey) {
                    // __metadata viene de OData y no aporta valor en el modelo local.
                    if (sKey === "__metadata") return;
                       if (sKey === "Estructura") return;
                    var sFirst = sKey.charAt(0);
                    if (sFirst >= "A" && sFirst <= "Z") {
                        oLocalNode[sKey] = oBackendRow[sKey];
                    }
                });

                if (oLocalNode.TipoInd === "I" || oLocalNode.TipoInd === "P") {
                    oLocalNode._Ejecutado = oLocalNode.InvEje || "0";
                    oLocalNode._Pendiente = oLocalNode.InvPen || "0";
                    oLocalNode._Total = oLocalNode.InvTot || "0";
                    //   Campos unificados de Valor/% Residual segun TipoInd (ver
                    //   Inmovilizados._addComputedFields). Se recalculan tras el merge para
                    //   que la celda muestre el valor que el backend confirma en el campo
                    //   correcto (Inversion -> ValResidInv/PctjResidInv).
                    oLocalNode._ValResid = oLocalNode.ValResidInv || "0";
                    oLocalNode._PctjResid = oLocalNode.PctjResidInv || "0";
                    oLocalNode._PctjPen = oLocalNode.PctjPenInv || "0";
                } else {
                    oLocalNode._Ejecutado = oLocalNode.AmoEje || "0";
                    oLocalNode._Pendiente = oLocalNode.AmoPen || "0";
                    oLocalNode._Total = oLocalNode.AmoTot || "0";
                    oLocalNode._ValResid = oLocalNode.ValResidAmo || "0";
                    oLocalNode._PctjResid = oLocalNode.PctjResidAmo || "0";
                    oLocalNode._PctjPen = oLocalNode.PctjPenAmo || "0";
                }
            });

            oModel.refresh(true);
        },


        //  Se define una función reutilizable para convertir valores numéricos al formato SAP
        _formatToSAPNumber: function (sValue) {

            //     Se devuelve el valor sin modificar si esta vacio o es nulo.
            if (sValue === null || sValue === undefined || sValue === "") {
                return sValue;
            }

            var sNormalized = sValue.toString();

            //     Se obtienen los separadores reales del formato de moneda del usuario.
            //     Si el modelo no esta disponible se asumen los separadores espanoles por defecto.
            var thousandSeparator = ".";
            var decimalSeparator = ",";

            try {
                var oAppData = this.getGlobalModel("appData");
                if (oAppData) {
                    var sCurrencyFormat = oAppData.getProperty("/userData/CurrencyFormat");
                    if (sCurrencyFormat && sCurrencyFormat.length >= 2) {
                        thousandSeparator = sCurrencyFormat.charAt(0);
                        decimalSeparator = sCurrencyFormat.charAt(1);
                    }
                }
            } catch (e) {
                //     Se mantienen los separadores por defecto si el modelo no es accesible.
            }

            if (sNormalized.indexOf(decimalSeparator) >= 0) {
                var sEscapedThousand = thousandSeparator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                sNormalized = sNormalized.replace(new RegExp(sEscapedThousand, "g"), "");
                sNormalized = sNormalized.replace(decimalSeparator, ".");
            }

            var fParsed = parseFloat(sNormalized);
            if (!isNaN(fParsed)) {
                return fParsed.toFixed(5);
            }

            return sNormalized;
        },

        //   Lista unica de propiedades exclusivas del frontend. Se mantiene aqui para que
        // cualquier flujo que envie filas al backend pueda reutilizarla. Incluye banderas
        // tecnicas y campos calculados que no existen en el EntityType del servicio OData.
        _aFrontendOnlyProps: [
            "__metadata", "children", "parent", "padre", "isEditable",
            "isSubcapitulo", "isCapitulo", "isVacio", "isGroup",
            "expandible", "cabecera", "isNew", "_linDateFrom", "_linDateTo",
            "_Ejecutado", "_Pendiente", "_Total", "_ValResid", "_PctjResid", "_PctjPen", "_isSinProveedor", "expanded",
            "editPhPspnr", "editPost1", "editTasa", "editAmoEje", "editAmoEjeAjus",
            "editAmoEjeReal", "editAmoPen", "editAmoTot", "editPepDest",
            "editTipo", "editPenPlan", "editMonths", "editPend",
            "editCtotPen", "editCtot",
          
            "FINI", "FFIN", "NMES", "FEE", "Otros",
            "ParentCode", "PhPspnrEdited", "Post1Edited",
            "isLevel3",
          
            "TIPO"
        ],

       
        _openOperationsCatalog: async function (oSelectedRow, oContext) {
            this._selectedChapterRow = oSelectedRow;
            this._selectedChapterContext = oContext;

            var oAppData = this.getGlobalModel("appData").getData();
            var oDashModel = this.getGlobalModel("dashboardModel");

            if (!this._busyDialog) {
                this._busyDialog = new sap.m.BusyDialog({
                    text: this.getTranslatedText("CARGANDO_DATOS")
                });
            }
            this._busyDialog.open();

            try {
                var response = await this.post(
                    this.getGlobalModel("mainService"),
                    "/CatalogoIndirectosSet",
                    { "NavDatosCatalogo": [] },
                    {
                        headers: {
                            norma: this.getGlobalModel("normModel").getData().norma || "",
                            ambito: oAppData.userData.initialNode,
                            lang: oAppData.userData.AplicationLangu,
                            pestana: this._pestana || ""
                        }
                    }
                );

                this._busyDialog.close();

                var aCatalogData = response.NavDatosCatalogo?.results || [];
                if (aCatalogData.length === 0) {
                    sap.m.MessageBox.information(
                        "No hay operaciones disponibles para este capítulo",
                        { title: this.getTranslatedText("CATALOGO_OPERACIONES_TITULO") }
                    );
                    return;
                }

                var aOperations = aCatalogData.map(function (item) {
                    return {
                        Code: item.PhPspnr || item.Codigo || "",
                        Description: item.Post1 || item.Descripcion || ""
                    };
                });

                this.getView().setModel(
                    new sap.ui.model.json.JSONModel({ operations: aOperations }),
                    "catalogModel"
                );

                this._openCatalogDialog();

            } catch (error) {
                this._busyDialog.close();
                sap.m.MessageBox.error(
                    this.getTranslatedText("CATALOGO_ERROR_SERVICIO") + "\n" + (error.message || error),
                    { title: this.getTranslatedText("ERROR") }
                );
            }
        },

        _openCatalogDialog: function () {
            if (!this._catalogDialog) {
                this._catalogDialog = sap.ui.xmlfragment(
                    "zindirect_costs.fragments.OperationsCatalogDialog",
                    this
                );
                this.getView().addDependent(this._catalogDialog);
            }
            this._catalogDialog.open();
        },

        onCloseCatalogDialog: function () {
            if (this._catalogDialog) {
                this._catalogDialog.close();
                this._catalogDialog.destroy();
                this._catalogDialog = null;
            }
        },

        //   POST a /AddIndirectosSet para añadir/validar operaciones.
        // pestana viene de this._pestana (Corrientes/Externos lo setean en setInitData).
        _callAddIndirectosService: async function (aOperationsData) {
            var oAppData = this.getGlobalModel("appData").getData();
            var oDashModel = this.getGlobalModel("dashboardModel");

            var versiones = oAppData.NavLtVersiones || [];
            var flagSelectVersion = versiones.find(function (item) {
                return item.Activo === "X";
            });

            var sFreal = "";
            if (oAppData && oAppData.tramo && oAppData.tramo.Freal) {
                sFreal = oAppData.tramo.Freal;
            } else if (oDashModel) {
                sFreal = oDashModel.getProperty("/NavMasterLt/0/Freal");
            }
            if (!sFreal) throw new Error("Fecha real no disponible");

            var oDateStart = this._parseODataDate(sFreal);
            if (!oDateStart || isNaN(oDateStart.getTime())) throw new Error("Fecha real inválida");

            var sEjercicio = oDateStart.getFullYear().toString();
            var sToken = oAppData.EvToken;

            if (!this._busyDialog) {
                this._busyDialog = new sap.m.BusyDialog({
                    text: this.getTranslatedText("CARGANDO_DATOS")
                });
            }
            this._busyDialog.open();

            try {
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
                            pestana: this._pestana || "",
                            token: sToken
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

        //   Handler del boton "Añadir Seleccionados" del fragment del catalogo.
        // Recoge la seleccion, llama al servicio, y al volver inserta las operaciones
        // como hijos del capitulo seleccionado en el arbol.
        onAddSelectedOperations: function () {
            if (!this._catalogDialog) return;

            var oCatalogTable = this._catalogDialog.getContent()[0].getItems()[1];
            if (!oCatalogTable) {
              sap.m.MessageBox.error(this.getTranslatedText("ERROR_TABLA_CATALOGO_NO_ENCONTRADA"));
                return;
            }

            var aSelectedIndices = oCatalogTable.getSelectedIndices();
            if (aSelectedIndices.length === 0) {
               sap.m.MessageBox.warning(this.getTranslatedText("ERROR_DEBE_SELECCIONAR_OPERACION"));
                return;
            }

            var oCatalogModel = this.getView().getModel("catalogModel");
            var aAllOperations = oCatalogModel.getProperty("/operations");
            var aSelectedOperations = [];
            aSelectedIndices.forEach(function (iIndex) {
                if (aAllOperations[iIndex]) aSelectedOperations.push(aAllOperations[iIndex]);
            });

            var aOperationsToAdd = aSelectedOperations.map(function (oOp) {
                return { PhPspnr: oOp.Code, Descripcion: oOp.Description };
            });

            this._callAddIndirectosService(aOperationsToAdd).then(function (response) {
                var aMensajes = response.NavMensajes?.results || [];
                var aMensajesError = aMensajes.filter(function (m) { return m.Tipo === "E"; });
                if (aMensajesError.length > 0) {
                    this.createMessageDialog({
                        title: this.getTranslatedText("ERROR"),
                        textAccept: this.getTranslatedText("ACEPTAR"),
                        messages: aMensajesError.map(function (m) {
                            return { text: m.Mensaje || m.Message || m.text || "", type: "Error" };
                        })
                    });
                    return;
                }

                this.onCloseCatalogDialog();

                var aCreatedOperations = response.NavDatosIndirectos?.results || [];
                if (aCreatedOperations.length > 0) {
                    this._addOperationsToTree(aCreatedOperations);
                    sap.m.MessageToast.show(
                        "Se han añadido " + aCreatedOperations.length + " operación(es) correctamente"
                    );
                }
            }.bind(this)).catch(function (error) {
                sap.m.MessageBox.error(
                    "Error al añadir las operaciones: " + (error.message || error),
                    { title: this.getTranslatedText("ERROR") }
                );
            }.bind(this));
        },

        //   Inserta las operaciones devueltas por el backend como hijos del capitulo
        // seleccionado. Sin duplicacion I/A: una sola fila por operacion.
        _addOperationsToTree: function (aCreatedOperations) {
            if (!this._selectedChapterRow || !aCreatedOperations || aCreatedOperations.length === 0) return;

            var oModel = this.getView().getModel(this.tableModelName);
            if (!this._selectedChapterRow.children) {
                this._selectedChapterRow.children = [];
            }

            aCreatedOperations.forEach(function (oOp) {
                if (!oOp.children) oOp.children = [];
                if (!oOp.Post1 && oOp.Descripcion) oOp.Post1 = oOp.Descripcion;
                oOp.isNew = true;
                oOp.isLevel3 = oOp.PhPspnr && oOp.PhPspnr.split(".").length === 4;
                  oOp.Estructura = "S";
  oOp.isSubcapitulo = true;
                oOp.isCapitulo = false;
                oOp.isEditable = false;
                oOp.isVacio = false;
                  oOp.editPhPspnr = false;
                oOp.editPost1 = false;
                oOp.editTasa = false;
                oOp.editAmoEje = false;
                oOp.editAmoEjeAjus = false;
                oOp.editAmoEjeReal = false;
                oOp.editAmoPen = false;
                oOp.editAmoTot = false;
                oOp.editPepDest = false;
                oOp.editTipo = true;
                oOp.editPenPlan = false;
                oOp.editMonths = true;
                oOp.editPend = false;
                oOp.editCtotPen = false;
                oOp.editCtot = false;
                  //   Computed fields: en modelos sin I/A se usan siempre los Amo*.
                oOp._Ejecutado = oOp.AmoEje || "0";
                oOp._Pendiente = oOp.AmoPen || "0";
                oOp._Total = oOp.AmoTot || "0";
                this._selectedChapterRow.children.push(oOp);
            }.bind(this));

            oModel.refresh(true);
            if (this._markVariantDirty) this._markVariantDirty();
             var sTableIdMV = this.getCustomTableId ? this.getCustomTableId() : "TreeTableBasic";
            var oTableMV = this.byId(sTableIdMV);
            var sParentPathMV = this._selectedChapterContext && this._selectedChapterContext.getPath();
            if (oTableMV && sParentPathMV) {
                var sModelNameMV = this.tableModelName;
                var fnExpandChapterMV = function () {
                    if (fnExpandChapterMV._fired) return;
                    var aRowsMV = oTableMV.getRows();
                    for (var iMV = 0; iMV < aRowsMV.length; iMV++) {
                        var oCtxMV = aRowsMV[iMV].getBindingContext(sModelNameMV);
                        if (oCtxMV && oCtxMV.getPath() === sParentPathMV) {
                            var iIdxMV = aRowsMV[iMV].getIndex();
                            if (iIdxMV >= 0 && !oTableMV.isExpanded(iIdxMV)) {
                                oTableMV.expand(iIdxMV);
                            }
                            fnExpandChapterMV._fired = true;
                            return;
                        }
                    }
                };
                oTableMV.attachEventOnce("rowsUpdated", fnExpandChapterMV);
                setTimeout(fnExpandChapterMV, 200);
            }
        },

        //   Crea UNA fila vacia de nivel 3 (desglose) bajo la operacion nivel 2
        // seleccionada. Sin duplicacion I/A. La nueva fila es editable e isNew=true
        // para que la UI permita rellenarla y luego validar/persistir.
        _createLevel3Row: function (oParentRow, oContext) {
            var oModel = this.getView().getModel(this.tableModelName);
            var sParentCode = oParentRow.PhPspnr;
            var aParentParts = sParentCode.split(".");

            if (aParentParts.length !== 3) {
                sap.m.MessageBox.error(this.getTranslatedText("ERROR_FORMATO_PADRE"));
                return;
            }

            if (!oParentRow.children) oParentRow.children = [];

            var oNewRow = this._sanitizeRowForBackend(oParentRow);

            //   Importes a cero. Decimales (5) para magnitudes y porcentajes/tasa (2).
            Object.keys(oNewRow).forEach(function (sKey) {
                if (/^(Amo|Inv|Vta)(Eje|EjeAjus|EjeReal|Pen|Tot|Unit)$/.test(sKey) ||
                    /^Totala[123]$/.test(sKey) ||
                    /^Val\d{3}a[123]$/.test(sKey) ||
                    sKey === "PenPlan" || sKey === "PlanEjec" || sKey === "PlanResto" ||
                    sKey === "ValResidAmo" || sKey === "ValResidInv") {
                    oNewRow[sKey] = "0.00000";
                } else if (/^Pctj/.test(sKey) || sKey === "Tasa") {
                    oNewRow[sKey] = "0.00";
                }
            });

            //   Operacion (PhPspnr) y descripcion (Post1) se introducen vacias y
            //   editables: las teclea el usuario. Estructura vacia = fila de desglose
            //   (no operacion parent). El padre inmediato de un desglose es la operacion
            //   nivel 2, por eso ParentPath apunta a su PhPspnr. Fini/Ffin nulas (fila
            //   nueva sin fechas) para evitar arrastrar las del padre.
            oNewRow.PhPspnr = "";
            oNewRow.Post1 = "";
            oNewRow.Estructura = "O";
            oNewRow.ParentPath = sParentCode;
            oNewRow.Fini = null;
            oNewRow.Ffin = null;
            if (!oNewRow.Tipo) oNewRow.Tipo = "MAN";

            //   Campos UI-only y banderas de la fila nueva (los elimino del clon
            //   _sanitizeRowForBackend, por eso se vuelven a fijar aqui).
            oNewRow.FEE = "";
            oNewRow.FINI = "";
            oNewRow.FFIN = "";
            oNewRow.NMES = "";
            oNewRow.Otros = "";
            oNewRow._Ejecutado = "0";
            oNewRow._Pendiente = "0";
            oNewRow._Total = "0";
            oNewRow._ValResid = "0";
            oNewRow._PctjResid = "0";
            oNewRow._PctjPen = "0";
            oNewRow.isLevel3 = true;
            oNewRow.isNew = true;
            //   Una fila Desglose recien creada NO es una "operacion parent", por eso
            //   isEditable=false (coherente con lo que pondria Corrientes/Externos.buildTree
            //   sobre una fila con Estructura=""). Los flags granulares edit* replican
            //   lo que aplica buildTree a una fila Estructura="" (isDesglose=true).
            oNewRow.isEditable = false;
            oNewRow.editPhPspnr = true; //   Operacion editable en filas Desglose nuevas
            oNewRow.editPost1 = true; //   Descripcion editable en filas Desglose nuevas
            oNewRow.editTasa = false; //   %Tasa solo editable en Estructura=O con TipoTasa=X
            oNewRow.editAmoEje = false; //   Coste ejecutado no se edita: lo calcula el backend
            oNewRow.editAmoEjeAjus = false; //   Idem: ejecutado ajustado calculado
            oNewRow.editAmoEjeReal = false; //   Idem: ejecutado real calculado
            oNewRow.editAmoPen = true; //   Pendiente editable en filas Desglose
            oNewRow.editAmoTot = true; //   Total editable en filas Desglose
             oNewRow.editPepDest = true;//   PEP destino solo en Estructura=O
            oNewRow.editTipo = true; //   Reparto editable en filas Desglose
            oNewRow.editPenPlan = false; //   Pendiente planificado no se edita
            oNewRow.editMonths = true; //   Columnas mensuales editables en Desglose
            oNewRow.editPend = true; //   Pend a planificar editable en Desglose
            oNewRow.editCtotPen = false; //   Pendiente coste solo en Estructura=O con TipoTasa!=X
            oNewRow.editCtot = false; //   Total coste solo en Estructura=O con TipoTasa!=X
            oNewRow.ParentCode = sParentCode;
            oNewRow.PhPspnrEdited = false;
            oNewRow.Post1Edited = false;
            oNewRow.children = [];
            // (FIN)

            oParentRow.children.push(oNewRow);
            oModel.refresh(true);

            // Se expande el nodo padre para que la nueva fila de nivel 3 sea
            // visible inmediatamente sin que el usuario tenga que pulsar la
            // flecha de expandir.
            var sTableId = this.getCustomTableId ? this.getCustomTableId() : "TreeTableBasic";
            var oTable = this.byId(sTableId);
            var sParentPath = oContext && oContext.getPath();
            if (oTable && sParentPath) {
                var sModelName = this.tableModelName;
                var fnExpandParent = function () {
                    if (fnExpandParent._fired) return;
                    var aRows = oTable.getRows();
                    for (var i = 0; i < aRows.length; i++) {
                        var oCtx = aRows[i].getBindingContext(sModelName);
                        if (oCtx && oCtx.getPath() === sParentPath) {
                            var iIdx = aRows[i].getIndex();
                            if (iIdx >= 0 && !oTable.isExpanded(iIdx)) {
                                oTable.expand(iIdx);
                            }
                            fnExpandParent._fired = true;
                            return;
                        }
                    }
                };
                oTable.attachEventOnce("rowsUpdated", fnExpandParent);
                setTimeout(fnExpandParent, 200);
            }

            var sMessage = this.getTranslatedText("MSG_NUEVA_FILA_NIVEL3").replace(/\{0\}/g, sParentCode);
            sap.m.MessageToast.show(sMessage);
            if (this._markVariantDirty) this._markVariantDirty();
        },

        //   Determina el nivel de una operacion a partir del formato de PhPspnr:
        // "D" o vacio → 0 (cabecera OEO), "XX" → 1 (capitulo), "XX.YY" → 2 (operacion),
        // "XX.YY.ZZ" → 3 (desglose). Compartido por Corrientes/Externos onAddPress.
        // Los detail controllers Anticipados/Diferidos/Inmovilizados tienen su propia
        // copia (preexistente) que coincide; no se eliminan aqui para evitar regresiones.
        _getOperationLevel: function (sPhPspnr) {
            if (!sPhPspnr || sPhPspnr === "D") {
                return 0;
            }
            var aParts = sPhPspnr.split(".");
            return aParts.length - 1;
        },

        //   Devuelve una copia profunda de oRow lista para enviar al backend.
        // Elimina los nombres listados en _aFrontendOnlyProps y cualquier campo
        // cuyo nombre empiece por "__" (banderas de UI). El servicio ZFERR_MASTER_SRV
        // rechaza con 400 cualquier propiedad ajena al EntityType, asi que toda fila
        // saliente debe pasar por aqui antes del POST/DELETE.
        _sanitizeRowForBackend: function (oRow) {
            if (!oRow) return oRow;
            var oClone = JSON.parse(JSON.stringify(oRow));
            var aList = this._aFrontendOnlyProps;
            Object.keys(oClone).forEach(function (sKey) {
                if (aList.indexOf(sKey) !== -1 || sKey.indexOf("__") === 0) {
                    delete oClone[sKey];
                }
            });
                 // El backend exige el literal OData "/Date(ms)/" para Fini/Ffin. Tras una
            // respuesta del servicio, el modelo guarda esas propiedades como Date
            // (deserializacion Edm.DateTime) y JSON.stringify las convierte a ISO,
            // provocando CX_SY_CONVERSION_NO_DATE_TIME en el siguiente guardado.
            ["Fini", "Ffin"].forEach(function (sKey) {
                var vOriginal = oRow[sKey];
                if (vOriginal instanceof Date && !isNaN(vOriginal.getTime())) {
                    oClone[sKey] = "/Date(" + vOriginal.getTime() + ")/";
                } else if (typeof vOriginal === "string" && vOriginal !== ""
                    && !/^\/Date\(\d+\)\/$/.test(vOriginal)) {
                    var oParsed = new Date(vOriginal);
                    if (!isNaN(oParsed.getTime())) {
                        oClone[sKey] = "/Date(" + oParsed.getTime() + ")/";
                    }
                }
            });
            return oClone;
        },

     
        _buildDesglosePayloadRow: function (oRow, oParentRow, oSanitizedPayload) {
            var oPayload = Object.assign({}, oSanitizedPayload || {});

           
            delete oPayload.Proveedor;
            delete oPayload.AGRUP;
            delete oPayload.DESCRIP;
            delete oPayload.FEE;
            delete oPayload.NMES;
            delete oPayload.FINI;
            delete oPayload.FFIN;
            delete oPayload.Otros;
            delete oPayload.months;
            delete oPayload.__isCustom;
            delete oPayload.__isMainEditable;
            delete oPayload.__isNieto;
           
            delete oPayload.Erdat;
            delete oPayload.Updat;
            delete oPayload.Ctime;
            delete oPayload.Aezet;
            delete oPayload.Ernam;
            delete oPayload.Usnaa;
            //    

            //   Se propagan las claves desde la fila padre. Se sobreescribe siempre porque
            //   en filas nuevas (creadas en local) estas claves estan vacias en la fila hija.
            if (oParentRow) {
                if (oParentRow.Psphi) oPayload.Psphi = oParentRow.Psphi;
                if (oParentRow.Version) oPayload.Version = oParentRow.Version;
                if (oParentRow.Pspnr) oPayload.Pspnr = oParentRow.Pspnr;
                if (oParentRow.TipoInd) oPayload.TipoInd = oParentRow.TipoInd;
                oPayload.ParentPath = oParentRow.PhPspnr || "";
            }

         
            oPayload.Posnr = oRow.Posnr || oPayload.Posnr || "000000";

            //   PhPspnr de la fila (no del padre) - el backend lo necesita aunque la clave
            //   sea Posnr porque sirve como identificador de jerarquia.
            if (oRow.PhPspnr) oPayload.PhPspnr = oRow.PhPspnr;

            //   Se renombran campos UI mayusculas -> backend Camel/lowercase. Solo se vuelca
            //   si la fila tiene contenido en el campo UI, asi no se machaca el valor que
            //   pudiera haber llegado del backend en la respuesta anterior.
            var fnCopyCase = function (sFront, sBack) {
                if (oRow[sFront] !== undefined && oRow[sFront] !== null && oRow[sFront] !== "") {
                    oPayload[sBack] = oRow[sFront];
                }
            };
            fnCopyCase("AGRUP", "Agrup");
            fnCopyCase("DESCRIP", "Descrip");
            fnCopyCase("FEE", "Fee");
            fnCopyCase("NMES", "Nmes");

            //   Fini/Ffin: el sanitize ya hace la conversion a "/Date(ms)/" cuando la
            //   propiedad de la fila se llama Fini/Ffin (minuscula). Si en cambio
            //   la fila UI solo tiene FINI/FFIN (mayusculas) se hace la conversion aqui.
            ["FINI", "FFIN"].forEach(function (sFront) {
                var sBack = sFront.charAt(0) + sFront.slice(1).toLowerCase(); // FINI -> Fini
                if (oPayload[sBack]) return; //   ya lo metio el sanitize
                var vVal = oRow[sFront];
                if (!vVal) return;
                if (vVal instanceof Date && !isNaN(vVal.getTime())) {
                    oPayload[sBack] = "/Date(" + vVal.getTime() + ")/";
                } else if (typeof vVal === "string" && !/^\/Date\(\d+\)\/$/.test(vVal)) {
                    var oParsed = new Date(vVal);
                    if (!isNaN(oParsed.getTime())) {
                        oPayload[sBack] = "/Date(" + oParsed.getTime() + ")/";
                    }
                } else if (typeof vVal === "string") {
                    oPayload[sBack] = vVal;
                }
            });

            //   Prov: codigo proveedor (10 chars). En el front se llama Proveedor.
            if (oRow.Proveedor !== undefined && oRow.Proveedor !== null) {
                oPayload.Prov = oRow.Proveedor;
            } else if (oRow.Prov !== undefined) {
                oPayload.Prov = oRow.Prov;
            }

            //   Name y Exp no tienen equivalente UI conocido todavia. Se envian vacios
            //   hasta confirmacion con backend.
            if (oPayload.Name === undefined) oPayload.Name = oRow.Name || "";
            if (oPayload.Exp === undefined) oPayload.Exp = oRow.Exp || "";

          
            var aStringFields = {
                Psphi: 1, Version: 1, Pspnr: 1, Posnr: 1, TipoInd: 1, PhPspnr: 1, ParentPath: 1,
                Agrup: 1, Name: 1, Exp: 1, Descrip: 1, Post1: 1, Tipo: 1, TipoTasa: 1,
                PepDest: 1, PhPepDest: 1, Waers: 1, CheckInfla: 1, Estructura: 1,
                Gjahr1: 1, Gjahr2: 1, Gjahr3: 1, Ernam: 1, Usnaa: 1, Prov: 1, Zui5Descrip: 1, Aut: 1
            };
            Object.keys(oPayload).forEach(function (sKey) {
                var v = oPayload[sKey];
                if ((v === "" || v === null) && !aStringFields[sKey]) {
                    delete oPayload[sKey];
                }
            });

            var aScale2 = ["Nmes", "Tasa", "PctjResidAmo", "PctjResidInv", "PctjPenInv", "PctjPenAmo"];
            aScale2.forEach(function (sKey) {
                var v = oPayload[sKey];
                if (v === undefined || v === null || v === "") return;
                //   Se normaliza el separador decimal a "." (por si el usuario tecleo ",")
                //   y se formatea a 2 decimales con toFixed.
                var sNum = String(v).replace(",", ".");
                var f = parseFloat(sNum);
                if (!isNaN(f)) {
                    oPayload[sKey] = f.toFixed(2);
                }
            });
            //    

            return oPayload;
        },
       
        _mergeBackendDesgloseIntoTree: function (aTree, aDesgloseRows) {
            if (!Array.isArray(aTree) || !Array.isArray(aDesgloseRows) || aDesgloseRows.length === 0) return;

            //   Indice de filas desglose agrupadas por la clave del padre.
            var mByParentKey = {};
            aDesgloseRows.forEach(function (oRow) {
                if (!oRow) return;
                var sKey = (oRow.Psphi || "") + "|" + (oRow.Version || "") + "|" + (oRow.Pspnr || "");
                if (!mByParentKey[sKey]) mByParentKey[sKey] = [];
                mByParentKey[sKey].push(oRow);
            });

        
            var that = this;
            var fnWalk = function (aNodes) {
                if (!aNodes) return;
                //   Se itera sobre una copia snapshot de los children originales para no
                //   incluir las filas desglose que se acaban de anyadir dentro de este mismo
                //   recorrido.
                var aSnapshot = aNodes.slice();
                aSnapshot.forEach(function (oNode) {
                    if (!oNode) return;
                    if (oNode.__isCustom === true) return; //   se omiten las filas desglose
                    var sKey = (oNode.Psphi || "") + "|" + (oNode.Version || "") + "|" + (oNode.Pspnr || "");
                    var aChildren = mByParentKey[sKey];
                    if (aChildren && aChildren.length > 0) {
                        if (!Array.isArray(oNode.children)) oNode.children = [];
                        //   Se prepende la fila gris de cabecera ("Agrupador / Descripcion / ...")
                        //   y la fila vacia __isMainEditable que permite anyadir un nuevo proveedor,
                        //   igual que el flujo manual del "+". Sin esto los nietos del backend
                        //   aparecen "desnudos" pegados a la fila padre.
                        var bPersonaPuesto = (typeof that._isPersonaPuestoOperation === "function")
                            ? that._isPersonaPuestoOperation(oNode.PhPspnr) : false;
                        if (typeof that._getProveedorHeaderRow === "function") {
                            //   Se marca __fromBackendMerge=true para que _snapshotCustomBlocks
                            //   no la duplique al cambiar de pestanya y volver. Sin esto la fila
                            //   se cargaba dos veces (una via merge inicial, otra via restore).
                            var oHeader = that._getProveedorHeaderRow(bPersonaPuesto);
                            oHeader.__fromBackendMerge = true;
                            oNode.children.push(oHeader);
                        }
                        if (typeof that._createEmptyEditableRow === "function") {
                            var oEmptyMain = Object.assign(that._createEmptyEditableRow(), {
                                __isMainEditable: true,
                                __isPersonaPuesto: bPersonaPuesto === true,
                                __fromBackendMerge: true   //     evitar duplicacion al snapshot/restore
                            });
                            oNode.children.push(oEmptyMain);
                        }
                        //   Se anyaden los nietos venidos del backend.
                        aChildren.forEach(function (oRow) {
                            var oNieto = that._mapBackendDesgloseToTreeRow(oRow);
                            oNieto.__fromBackendMerge = true; //     marcador anti-duplicacion
                            oNode.children.push(oNieto);
                        });
                        //   Una vez que el bucket ha "alimentado" un padre se descarta para
                        //   evitar que un nodo descendente con la misma clave reciba un duplicado
                        //   de los mismos desgloses (problema potencial si el arbol tiene niveles
                        //   anidados con misma triple Psphi+Version+Pspnr).
                        delete mByParentKey[sKey];
                       
                    }
                    //   Se recorren los children "originales" (los que estaban antes del merge),
                    //   no los recien anyadidos.
                    if (Array.isArray(oNode.children)) fnWalk(oNode.children);
                });
            };
            fnWalk(aTree);
        },

        //   Mapea una fila tal cual llega de DatosIndirectosDesglo (campos Camel/lower
        //   en backend) a la forma que la view XML espera (campos UI en MAYUSCULAS y
        //   flags tecnicos para el render del bloque editable).
        _mapBackendDesgloseToTreeRow: function (oRow) {
            var oMapped = Object.assign({}, oRow);
            //   Se elimina __metadata de OData para que no contamine el modelo.
            delete oMapped.__metadata;
            //   Case map backend -> UI.
            oMapped.AGRUP = oRow.Agrup || "";
            oMapped.DESCRIP = oRow.Descrip || "";
            oMapped.FEE = oRow.Fee || "";
            oMapped.NMES = oRow.Nmes || "";
            oMapped.FINI = oRow.Fini || "";
            oMapped.FFIN = oRow.Ffin || "";
            oMapped.Proveedor = oRow.Prov || "";
            //   Flags UI: la fila es un "nieto" editable existente (no main editable,
            //   no header). Asi el XML renderiza el bloque editable como en el alta manual.
            oMapped.__isCustom = true;
            oMapped.__isEditable = true;
            oMapped.__isNieto = true;
            oMapped.__isMainEditable = false;
            oMapped.__isHeader = false;
       
            oMapped.__hasProviderRows = false;
            oMapped.__uid = "desglose_" + (oRow.Pspnr || "") + "_" + (oRow.Posnr || "");
            oMapped.cabecera = false;
            oMapped.expandible = false;
            oMapped.isGroup = false;
            oMapped.padre = false;
            if (!Array.isArray(oMapped.children)) oMapped.children = [];
            return oMapped;
        },
        //    

        //   Recorre recursivamente un arbol con campo "children" y elimina in-place los
        // nodos cuya pareja (PhPspnr, TipoInd) coincida con alguna fila de aLinesToDelete.
        // Necesario porque en Corrientes y Externos el modelo es un arbol jerarquico:
        // un splice plano sobre la raiz no encuentra filas anidadas.
        _removeRowsFromTreeByKey: function (aTree, aLinesToDelete) {
            if (!Array.isArray(aTree) || !Array.isArray(aLinesToDelete) || aLinesToDelete.length === 0) {
                return aTree;
            }
            for (var i = aTree.length - 1; i >= 0; i--) {
                var oNode = aTree[i];
                var bMatches = aLinesToDelete.some(function (oLine) {
                    return oNode.PhPspnr === oLine.PhPspnr && oNode.TipoInd === oLine.TipoInd;
                });
                if (bMatches) {
                    aTree.splice(i, 1);
                    continue;
                }
                if (Array.isArray(oNode.children) && oNode.children.length > 0) {
                    this._removeRowsFromTreeByKey(oNode.children, aLinesToDelete);
                }
            }
            return aTree;
        },

        //   Formatter de NMES para el binding de la celda Nº Meses.
        // Devuelve el numero de meses inclusivo entre FINI y FFIN: ene→mar = 3.
        // Acepta formato OData "/Date(ms)/" e ISO "yyyy-MM-dd". Devuelve "" si falta
        // alguna fecha o son invalidas para no mostrar un 0 confuso en la UI.
        formatNMeses: function (sFini, sFfin) {
            if (!sFini || !sFfin) return "";
            var oFini = this._parseODataDate(sFini);
            var oFfin = this._parseODataDate(sFfin);
            if (!oFini || !oFfin || isNaN(oFini.getTime()) || isNaN(oFfin.getTime())) return "";
            var iN = (oFfin.getFullYear() - oFini.getFullYear()) * 12
                + (oFfin.getMonth() - oFini.getMonth()) + 1;
            return iN < 0 ? "" : String(iN);
        },

        //   Recalcula NMES (numero de meses) como diferencia inclusiva entre FINI y FFIN
        // de la fila a la que pertenece oEvent: ene→mar = 3. Si falta alguna fecha o son
        // invalidas, NMES queda en 0. Se acepta formato OData "/Date(ms)/" e ISO "yyyy-MM-dd".
        // Helper compartido por los handlers onFiniDatePickerChange / onFfinDatePickerChange.
        _recalcNMESFromRange: function (oEvent) {
            var oSource = oEvent.getSource();
            var sModelName = this.tableModelName;

            //   Se sube por la cadena de padres hasta encontrar binding context,
            // igual que onRowInputChange: el DatePicker vive dentro de VBox/HBox anidados
            // y no siempre tiene binding context directo.
            var oContext = oSource.getBindingContext(sModelName);
            var oParent = oSource;
            while (!oContext && oParent) {
                oParent = oParent.getParent();
                if (oParent && oParent.getBindingContext) {
                    oContext = oParent.getBindingContext(sModelName);
                }
            }
            if (!oContext) return;

            var oModel = oContext.getModel();
            var sPath = oContext.getPath();
            var oRow = oModel.getProperty(sPath);
            var iN = 0;
            if (oRow && oRow.FINI && oRow.FFIN) {
                var oFini = this._parseODataDate(oRow.FINI);
                var oFfin = this._parseODataDate(oRow.FFIN);
                if (oFini && oFfin && !isNaN(oFini.getTime()) && !isNaN(oFfin.getTime())) {
                    iN = (oFfin.getFullYear() - oFini.getFullYear()) * 12
                        + (oFfin.getMonth() - oFini.getMonth()) + 1;
                    if (iN < 0) iN = 0;
                }
            }
            oModel.setProperty(sPath + "/NMES", iN);
        },

        onFiniDatePickerChange: function (oEvent) {
            this._recalcNMESFromRange(oEvent);
        },

        onFfinDatePickerChange: function (oEvent) {
            this._recalcNMESFromRange(oEvent);
        },
         // Abre el selector mes/año (mismo grid que el rango LIN pero selección simple)
        // anclado al control que dispara el evento. El campo destino (FINI o FFIN) se
        // lee desde data("monthField") del propio control para reutilizar un único handler.
        onOpenMonthYearPicker: function (oEvent) {
            var oSource = oEvent.getSource();
            var sField = oSource.data("monthField");
            if (!sField) return;

            // Permite que controles del panel (panelModel) reutilicen este picker
            // declarando app:monthModel="panelModel" en el XML. Sin override se
            // mantiene el comportamiento original con la tabla principal.
            var sModelName = oSource.data("monthModel") || this.tableModelName;
            var oContext = oSource.getBindingContext(sModelName);
            var oParent = oSource;
            while (!oContext && oParent) {
                oParent = oParent.getParent();
                if (oParent && oParent.getBindingContext) {
                    oContext = oParent.getBindingContext(sModelName);
                }
            }
            if (!oContext) return;

            this._oMonthPickerContext = oContext;
            this._sMonthPickerField = sField;
            // Coloca el final de mes (último día) para FFIN; primer día para FINI.
            this._bMonthPickerEndOfMonth = sField === "FFIN";

            if (!this._oSingleMonthPopover) {
                this._buildSingleMonthPopover();
            }

            // Rehidrata el año visible desde el valor actual del campo.
            var oModel = oContext.getModel();
            var vCurrent = oModel.getProperty(oContext.getPath() + "/" + sField);
            var oCurrent = vCurrent ? this._parseODataDate(vCurrent) : null;
            if (oCurrent && !isNaN(oCurrent.getTime())) {
                this._singleMonthYear = oCurrent.getFullYear();
                this._singleMonthSelected = oCurrent.getMonth();
            } else {
                var oBounds = this._getLinRangeBounds();
                this._singleMonthYear = oBounds.minDate ? oBounds.minDate.getFullYear() : new Date().getFullYear();
                this._singleMonthSelected = -1;
            }

            this._refreshSingleMonthPopover();
            this._oSingleMonthPopover.openBy(oSource);
        },

        // Popover con cabecera (<, año, >) y grid 3x4 de meses para selección simple.
        // Reutiliza _getLinRangeBounds para acotar al horizonte Freal → Frealfinobra.
        _buildSingleMonthPopover: function () {
            var that = this;
            var oMonthFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "MMMM" });
            var aMonthNames = [];
            for (var iM = 0; iM < 12; iM++) {
                var sName = oMonthFormat.format(new Date(2000, iM, 1));
                aMonthNames.push(sName.charAt(0).toUpperCase() + sName.slice(1));
            }

            this._singleMonthTitle = new sap.m.Title({ text: "", level: "H4" });
            this._singleMonthPrevBtn = new sap.m.Button({
                icon: "sap-icon://navigation-left-arrow",
                type: "Transparent",
                press: function () {
                    var oB = that._getLinRangeBounds();
                    if (oB.minDate && that._singleMonthYear <= oB.minDate.getFullYear()) return;
                    that._singleMonthYear--;
                    that._refreshSingleMonthPopover();
                }
            });
            this._singleMonthNextBtn = new sap.m.Button({
                icon: "sap-icon://navigation-right-arrow",
                type: "Transparent",
                press: function () {
                    var oB = that._getLinRangeBounds();
                    if (oB.maxDate && that._singleMonthYear >= oB.maxDate.getFullYear()) return;
                    that._singleMonthYear++;
                    that._refreshSingleMonthPopover();
                }
            });
            var oHeader = new sap.m.HBox({
                justifyContent: "Center",
                alignItems: "Center",
                items: [this._singleMonthPrevBtn, this._singleMonthTitle, this._singleMonthNextBtn]
            }).addStyleClass("sapUiSmallMarginBottom");

            this._singleMonthBtns = [];
            for (var i = 0; i < 12; i++) {
                (function (iMonth) {
                    that._singleMonthBtns.push(new sap.m.Button({
                        text: aMonthNames[iMonth],
                        width: "6rem",
                        press: function () { that._handleSingleMonthPress(iMonth); }
                    }).addStyleClass("sapUiTinyMargin"));
                })(i);
            }

            var oGrid = new sap.m.VBox({ alignItems: "Center" });
            for (var r = 0; r < 4; r++) {
                oGrid.addItem(new sap.m.HBox({
                    justifyContent: "Center",
                    items: this._singleMonthBtns.slice(r * 3, r * 3 + 3)
                }));
            }

            var oContent = new sap.m.VBox({
                alignItems: "Center",
                items: [oHeader, oGrid]
            }).addStyleClass("sapUiSmallMargin");

            this._oSingleMonthPopover = new sap.m.ResponsivePopover({
                placement: "Bottom",
                contentWidth: "22rem",
                showHeader: false,
                content: [oContent]
            });
            this.getView().addDependent(this._oSingleMonthPopover);
        },

        _refreshSingleMonthPopover: function () {
            this._singleMonthTitle.setText(String(this._singleMonthYear));
            var oBounds = this._getLinRangeBounds();

            var bPrevAllowed = !oBounds.minDate || this._singleMonthYear > oBounds.minDate.getFullYear();
            var bNextAllowed = !oBounds.maxDate || this._singleMonthYear < oBounds.maxDate.getFullYear();
            this._singleMonthPrevBtn[bPrevAllowed ? "removeStyleClass" : "addStyleClass"]("linNavBtnDimmed");
            this._singleMonthNextBtn[bNextAllowed ? "removeStyleClass" : "addStyleClass"]("linNavBtnDimmed");

            for (var i = 0; i < 12; i++) {
                var oMonthStart = new Date(this._singleMonthYear, i, 1);
                var oMonthEnd = new Date(this._singleMonthYear, i + 1, 0);

                var bAllowed = true;
                if (oBounds.minDate && oMonthEnd < oBounds.minDate) bAllowed = false;
                if (oBounds.maxDate && oMonthStart > oBounds.maxDate) bAllowed = false;

                var bSelected = this._singleMonthSelected === i;
                this._singleMonthBtns[i].setEnabled(bAllowed);
                this._singleMonthBtns[i].setType(bSelected ? "Emphasized" : "Default");
            }
        },

        // Escribe la fecha resultante en el campo destino y dispara _recalcNMESFromRange
        // como si fuera el change del DatePicker original, para mantener el cálculo de NMES.
        _handleSingleMonthPress: function (iMonth) {
            var oContext = this._oMonthPickerContext;
            var sField = this._sMonthPickerField;
            if (!oContext || !sField) {
                if (this._oSingleMonthPopover) this._oSingleMonthPopover.close();
                return;
            }

            var iDay = this._bMonthPickerEndOfMonth
                ? new Date(this._singleMonthYear, iMonth + 1, 0).getDate()
                : 1;
            // Formato ISO yyyy-MM-dd para coincidir con el valueFormat de los DatePicker previos.
            var sIso = this._singleMonthYear + "-"
                + String(iMonth + 1).padStart(2, "0") + "-"
                + String(iDay).padStart(2, "0");

            oContext.getModel().setProperty(oContext.getPath() + "/" + sField, sIso);

            // Reutiliza _recalcNMESFromRange con un evento sintético: solo necesita getSource()
            // → getBindingContext(this.tableModelName), así que cualquier control con contexto vale.
            //   Como buscaríamos un control con binding context y eso lo provee el propio popover,
            // se llama directamente al helper pasándole un oEvent.getSource() falso que conoce el contexto.
            this._recalcNMESFromRange({
                getSource: function () {
                    return {
                        getBindingContext: function () { return oContext; },
                        getParent: function () { return null; }
                    };
                }
            });

         
            var oRowMV = oContext.getObject();
            var bIsDesgloseSavableMV = oRowMV && oRowMV.__isCustom === true
                && (oRowMV.__isNieto === true || oRowMV.__isMainEditable === true)
                && (this._pestana === "Corrientes" || this._pestana === "Externos");
            if (bIsDesgloseSavableMV) {
                var oPayloadRowMV = this._sanitizeRowForBackend(oRowMV);
                //   Se pasa sField (FINI/FFIN) como CampoMod tal cual. La normalizacion
                //   a Fini/Ffin (capitalizacion backend) la hace _buildDesglosePayloadRow.
                this._enviarFilaAlBackend(oContext, oPayloadRowMV, sField);
            }
            //    

            this._oMonthPickerContext = null;
            this._sMonthPickerField = null;
            this._oSingleMonthPopover.close();
        },


        _executeBatchLineal: async function (oStartDate, oEndDate) {

            var oContext = this._oActiveContext;
            if (!oContext) return;

            var oModel = oContext.getModel();
            var sPath = oContext.getPath();
            var oRowData = oModel.getProperty(sPath);
            if (!oRowData) return;

            // Se construyen Fini y Ffin a partir de los componentes ano/mes en UTC para evitar el desfase del huso horario local.   
            // Fini se ancla siempre al dia 1 del mes inicial seleccionado y Ffin al ultimo dia del mes final (dia 0 del mes siguiente).   
            // De este modo el valor /Date(ms)/ enviado al backend representa el rango "primer mes - ultimo mes" sin perder un dia por la conversion a UTC.   
            var iFiniMs = Date.UTC(oStartDate.getFullYear(), oStartDate.getMonth(), 1);
            var iFfinMs = Date.UTC(oEndDate.getFullYear(), oEndDate.getMonth() + 1, 0);

           
            var sFini = "/Date(" + iFiniMs + ")/";
            var sFfin = "/Date(" + iFfinMs + ")/";

            oModel.setProperty(sPath + "/Fini", sFini);
            oModel.setProperty(sPath + "/Ffin", sFfin);
            oModel.setProperty(sPath + "/Tipo", "LIN");

           oModel.setProperty(sPath + "/_linDateFrom", oStartDate);
            oModel.setProperty(sPath + "/_linDateTo", oEndDate);
              if (this._isLocalOnlyTipo(oContext)) {
                this._markVariantDirty();
                return;
            }

            var oPayloadRow = this._sanitizeRowForBackend(oRowData);
            oPayloadRow.Fini = sFini;
            oPayloadRow.Ffin = sFfin;
            oPayloadRow.Tipo = "LIN";

            // CampoMod fijo
            await this._enviarFilaAlBackend(oContext, oPayloadRow, "Tipo");

            this._markVariantDirty();
        },
        //   Se extrae la logica de envio al backend en un metodo independiente para
        //   evitar que _confirmDateRange reingrese al flujo LIN de onRowInputChange,
        //   lo que provocaba que el calendario se reabriese sin llegar al servidor.

        _parseODataDate: function (sODataDate) {
            if (!sODataDate) return null;

            // Se evalua si la cadena tiene el patron OData /Date(milisegundos)/.
            var oMatch = /\/Date\((\d+)\)\//.exec(sODataDate);
            if (oMatch) {
                return new Date(parseInt(oMatch[1], 10));
            }

            // Se acepta como fallback una cadena de fecha parseable por el constructor nativo.
            return new Date(sODataDate);
        },

        //     Se captura el valor original del input en el momento en que recibe foco.
        //     Esto permite comparar posteriormente si el usuario realmente ha modificado
        //     el valor, evitando depender del modelo que puede estar ya actualizado por el binding.
        _onInputFocusIn: function (oEvent) {
            var oInput = oEvent.getSource();

            try {
                var sCurrentValue = oInput.getValue();

                //     Se normaliza el valor al formato SAP para garantizar comparaciones coherentes.
                oInput._originalValue = this._formatToSAPNumber(
                    String(sCurrentValue !== null && sCurrentValue !== undefined ? sCurrentValue : "")
                );
            } catch (e) {
                //     En caso de error se guarda el valor en bruto como fallback seguro.
                oInput._originalValue = oInput.getValue();
            }
        },

        onToggleCustomExpand: function (oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext(this.tableModelName);
            if (!oContext) return;

            const oRowData = oContext.getObject();
            const sRootPath = oContext.getPath();

            if (oRowData.isGroup || oRowData.cabecera || oRowData.padre) return;
            if (!oRowData.children) oRowData.children = [];

            //   Corrientes: las operaciones .031/.032/.033 usan el desglose en modo
            // "Persona / Puesto de trabajo". El flag se propaga al header y a las filas editables.
            const bPersonaPuesto = this._isPersonaPuestoOperation(oRowData.PhPspnr);

            const oTable = this.getControlTable();

            const fnTriggerExpand = function () {
                if (fnTriggerExpand._fired) return;
                fnTriggerExpand._fired = true;
                this._expandFullBlock(oTable, sRootPath, function () {
                    this._highlightSinProveedor(oTable);
                    this._applyBlockBorder(oTable);
                    //    Se actualiza la visibilidad de las columnas custom
                    // tras expandir el bloque para mostrarlas si estaban ocultas.
                    this._updateCustomColsVisibility();
                }.bind(this));
            }.bind(this);

            //   Se comprueba si ya existe la fila de cabecera del bloque personalizado.
            if (oRowData.children.some(function (c) { return c.__isHeader === true; })) {
                //   Segunda apertura: se inserta una nueva fila editable inmediatamente
                // despues del header gris para que aparezca en la parte superior del bloque.
                const oNuevaEditable = Object.assign(this._createEmptyEditableRow(), {
                    __isMainEditable: true,
                    __isPersonaPuesto: bPersonaPuesto
                });
                const iHeaderIdx = oRowData.children.findIndex(function (c) {
                    return c.__isHeader === true;
                });
                oRowData.children.splice(iHeaderIdx + 1, 0, oNuevaEditable);

                oContext.getModel().refresh(true);
                if (oTable) {
                    oTable.attachEventOnce("rowsUpdated", fnTriggerExpand);
                    setTimeout(fnTriggerExpand, 150);
                }
                return;
            }

          
            const oHeaderRow = this._getProveedorHeaderRow(bPersonaPuesto);
            //


            //   Se crea la fila editable principal para introducir el primer proveedor.
            const oMainEditable = Object.assign(this._createEmptyEditableRow(), {
                __isMainEditable: true,
                __isPersonaPuesto: bPersonaPuesto
            });

            oRowData.children.push(oHeaderRow);
            oRowData.children.push(oMainEditable);
            oRowData.expanded = true;
            oContext.getModel().refresh(true);

            if (oTable) {
                oTable.attachEventOnce("rowsUpdated", fnTriggerExpand);
                setTimeout(fnTriggerExpand, 150);
            }
        },

       
        addRecursoCatalogoAlDesglose: function (oRecurso) {
            if (!oRecurso) {
                return { ok: false, message: this.getTranslatedText("ERROR_SELECCIONE_RECURSO") };
            }

            var oTable = this.getControlTable();
            var aSelectedIndices = oTable ? oTable.getSelectedIndices() : [];
            if (!oTable || !aSelectedIndices || aSelectedIndices.length === 0) {
                return { ok: false, message: this.getTranslatedText("ERROR_SELECCIONE_LINEA") };
            }

            var oContext = oTable.getContextByIndex(aSelectedIndices[0]);
            var oOperationRow = oContext && oContext.getObject();
            if (!oOperationRow) {
                return { ok: false, message: this.getTranslatedText("ERROR_SELECCIONE_LINEA") };
            }

            //   Solo se permite volcar sobre una operacion (nivel 2): ni la OEO, ni un
            //   capitulo (nivel 1), ni otro desglose (nivel 3).
            if (this._getOperationLevel(oOperationRow.PhPspnr) !== 2) {
                return { ok: false, message: this.getTranslatedText("ERROR_RECURSO_SOLO_OPERACION") };
            }

            var sIdRecurso = oRecurso.IdRecurso || "";
            var sPuesto = oRecurso.Puesto || oRecurso.PuestoEs || oRecurso.PuestoEn || oRecurso.PuestoFr || "";
            //   Fee llega como cadena SAP ("3.00000"); se normaliza para que coincida
            //   con lo que produciria una edicion manual de la Tarifa.
            var sFee = this._formatToSAPNumber(String(oRecurso.Fee !== null && oRecurso.Fee !== undefined ? oRecurso.Fee : ""));

            this._insertRecursoDesgloseRow(oOperationRow, oContext, {
                AGRUP: sIdRecurso,
                DESCRIP: sPuesto,
                FEE: sFee
            });

            return { ok: true };
        },
         addRecursosCatalogoAlDesgloseBatch: function (aRecursos, sOperationPath) {
            if (!Array.isArray(aRecursos) || aRecursos.length === 0) {
                return { ok: false, message: this.getTranslatedText("ERROR_SELECCIONE_RECURSO") };
            }

            var oTable = this.getControlTable();
            var oOperationRow;
            var oContext;
            var sRootPath;
            if (sOperationPath) {
                //   Caso VH: la operacion se conoce por path (sin pasar por la seleccion).
                var oModel = oTable && oTable.getModel(this.tableModelName);
                if (!oModel) {
                    return { ok: false, message: this.getTranslatedText("ERROR_AL_CARGAR") };
                }
                oOperationRow = oModel.getProperty(sOperationPath);
                if (!oOperationRow) {
                    return { ok: false, message: this.getTranslatedText("ERROR_SELECCIONE_LINEA") };
                }
                oContext = oTable.getBinding("rows") && oTable.getBinding("rows").getModel
                    ? null
                    : null;
                //   Para el refresh y el expand basta con sRootPath y el model.
                sRootPath = sOperationPath;
            } else {
                //   Caso menu: se usa la fila seleccionada.
                var aSelectedIndices = oTable ? oTable.getSelectedIndices() : [];
                if (!oTable || !aSelectedIndices || aSelectedIndices.length === 0) {
                    return { ok: false, message: this.getTranslatedText("ERROR_SELECCIONE_LINEA") };
                }
                oContext = oTable.getContextByIndex(aSelectedIndices[0]);
                oOperationRow = oContext && oContext.getObject();
                if (!oOperationRow) {
                    return { ok: false, message: this.getTranslatedText("ERROR_SELECCIONE_LINEA") };
                }
                sRootPath = oContext.getPath();
            }
            //   Misma restriccion que el flujo single: solo nivel 2 (operacion).
            if (this._getOperationLevel(oOperationRow.PhPspnr) !== 2) {
                return { ok: false, message: this.getTranslatedText("ERROR_RECURSO_SOLO_OPERACION") };
            }

        
            var that = this;
            //   Corrientes: modo Persona/Puesto para operaciones .031/.032/.033.
            var bPersonaPuesto = this._isPersonaPuestoOperation(oOperationRow.PhPspnr);
            aRecursos.forEach(function (oRecurso) {
                var sIdRecurso = oRecurso.IdRecurso || "";
                var sPuesto = oRecurso.Puesto || oRecurso.PuestoEs || oRecurso.PuestoEn || oRecurso.PuestoFr || "";
                var sFee = that._formatToSAPNumber(String(oRecurso.Fee !== null && oRecurso.Fee !== undefined ? oRecurso.Fee : ""));
                //   Mismo cuerpo que _insertRecursoDesgloseRow pero SIN el
                // refresh/expand final, para acumular todas las inserciones.
                if (!oOperationRow.children) oOperationRow.children = [];
                var bHasHeader = oOperationRow.children.some(function (c) { return c.__isHeader === true; });
                if (!bHasHeader) {
                    //   Se delega la construccion de la cabecera al
                    // helper _getProveedorHeaderRow que traduce via i18n.
                    oOperationRow.children.push(that._getProveedorHeaderRow(bPersonaPuesto));
                    //
                }
                var oNuevaEditable = Object.assign(that._createEmptyEditableRow(), {
                    __isMainEditable: true,
                    __isPersonaPuesto: bPersonaPuesto,
                    AGRUP: sIdRecurso,
                    DESCRIP: sPuesto,
                    FEE: sFee
                });
                var iHeaderIdx = oOperationRow.children.findIndex(function (c) { return c.__isHeader === true; });
                if (iHeaderIdx !== -1) {
                    oOperationRow.children.splice(iHeaderIdx + 1, 0, oNuevaEditable);
                } else {
                    oOperationRow.children.push(oNuevaEditable);
                }
            });

            oOperationRow.expanded = true;
            //   El refresh se hace sobre el model de la tabla (en el caso VH no
            // hay oContext disponible, se toma el model directamente).
            var oRefreshModel = oContext ? oContext.getModel() : (oTable && oTable.getModel(this.tableModelName));
            if (oRefreshModel && oRefreshModel.refresh) oRefreshModel.refresh(true);

            //   Refresh visual y reaplicacion de CSS/visibilidad una sola vez,
            // tras todas las inserciones.
            var fnTriggerExpand = function () {
                if (fnTriggerExpand._fired) return;
                fnTriggerExpand._fired = true;
                that._expandFullBlock(oTable, sRootPath, function () {
                    that._highlightSinProveedor(oTable);
                    that._applyBlockBorder(oTable);
                    that._updateCustomColsVisibility();
                });
            };
            oTable.attachEventOnce("rowsUpdated", fnTriggerExpand);
            setTimeout(fnTriggerExpand, 150);

            if (this._markVariantDirty) this._markVariantDirty();

            return { ok: true, count: aRecursos.length };
        },
         onDescripInputValueHelpRequest: function (oEvent) {
            //   Se obtiene el Input que dispara el evento y se resuelve su binding
            // context contra el modelo del nivel actual (corrientesModel por defecto).
            var oInput = oEvent.getSource();
            var sModelName = this.tableModelName || "corrientesModel";
            var oContext = oInput.getBindingContext(sModelName);
            if (!oContext) return;

            //   Se localiza Main.controller con el mismo patron documentado en este
            // BaseController (linea 1337): el rootView del Component es App, no Main;
            // se pide al sap.m.App (id="app") la pagina actual (Main view).
            var oRootView = this.getOwnerComponent && this.getOwnerComponent().getRootControl();
            var oAppCtrl = oRootView && oRootView.byId && oRootView.byId("app");
            var oMainView = oAppCtrl && typeof oAppCtrl.getCurrentPage === "function" && oAppCtrl.getCurrentPage();
            var oMainController = oMainView && oMainView.getController();
            if (!oMainController || typeof oMainController.onAbrirCatalogoRecursos !== "function") return;

            //   Se memoriza el contexto para que onAddRecursoToDesglose sepa que el
            // dialogo se abrio desde el value-help y debe rellenar la fila actual
            // en vez de crear una nueva.
            oMainController._sDescripVHRowPath = oContext.getPath();
            oMainController._sDescripVHTableModel = sModelName;
            //   Se reutiliza el mismo dialogo existente (no se duplica codigo).
            oMainController.onAbrirCatalogoRecursos();
        },
         _aplicarRecursoAFilaEditable: function (oRecurso, sRowPath, sModelName) {
            //   Validacion: sin recurso seleccionado no hay nada que aplicar.
            if (!oRecurso) {
                return { ok: false, message: this.getTranslatedText("ERROR_SELECCIONE_RECURSO") };
            }
            //   Se resuelve el modelo destino y la fila por path; ambos son
            // obligatorios para poder escribir en la fila correcta.
            var oModel = this.getView().getModel(sModelName);
            if (!oModel) {
                return { ok: false, message: this.getTranslatedText("ERROR_AL_CARGAR") };
            }
            var oRow = oModel.getProperty(sRowPath);
            //   Solo se rellena si la fila sigue siendo editable (defensivo: el
            // usuario podria haber cancelado el modo edicion mientras el dialogo
            // estaba abierto).
            if (!oRow || oRow.__isEditable !== true) {
                return { ok: false, message: this.getTranslatedText("ERROR_SELECCIONE_LINEA") };
            }

            //   Mismo mapeo que addRecursoCatalogoAlDesglose (linea 7748): AGRUP
            // recibe IdRecurso, DESCRIP recibe Puesto (resuelto al idioma activo
            // en _loadCatalogoRecursos), FEE se normaliza a formato SAP igual que
            // una edicion manual de Tarifa.
            var sIdRecurso = oRecurso.IdRecurso || "";
            var sPuesto = oRecurso.Puesto || oRecurso.PuestoEs || oRecurso.PuestoEn || oRecurso.PuestoFr || "";
            var sFee = this._formatToSAPNumber(String(oRecurso.Fee !== null && oRecurso.Fee !== undefined ? oRecurso.Fee : ""));

            //   Se escriben los tres campos visibles del desglose.
            oRow.AGRUP = sIdRecurso;
            oRow.DESCRIP = sPuesto;
            oRow.FEE = sFee;
            //   Se conserva el recurso completo como metadato oculto para no
            // perder los campos restantes (Prctr, PuestoEs/En/Fr, etc.) por si
            // se necesitan en el futuro.
            oRow.__catalogoRecurso = oRecurso;

            //   Se replica la logica de onAgrupadorFieldChange (linea 9888) para
            // que la cabecera "Total Grupo: X" se reagrupe al cambiar AGRUP. Sin
            // esto la cabecera conserva el valor anterior y solo se actualizan
            // los campos de la fila. Solo aplica si el modo agrupador esta activo.
            var sParentPath = sRowPath.replace(/\/children\/\d+$/, "");
            var oRootRow = oModel.getProperty(sParentPath);
            var oHeaderRow = oRootRow && Array.isArray(oRootRow.children)
                ? oRootRow.children.find(function (c) { return c.__isHeader === true; })
                : null;
            var bAgrupadorActive = oHeaderRow && oHeaderRow.__agrupadorActive === true;

            if (bAgrupadorActive && !this._bAgrupadorChanging) {
                this._bAgrupadorChanging = true;
                try {
                    //   Se eliminan los totales obsoletos y se reagrupa desde
                    // cero, exactamente como el handler del cambio manual.
                    oRootRow.children = oRootRow.children.filter(function (c) {
                        return c.__isAgrupadorTotal !== true;
                    });
                    this._reorganizeByAgrupador(oRootRow);
                    oModel.setProperty(sParentPath, oRootRow);
                } finally {
                    this._bAgrupadorChanging = false;
                }
            }

            //   Refresh general del modelo para repintar la fila editable y, si
            // ha habido reagrupacion, la cabecera "Total Grupo".
            oModel.refresh(true);

            //   Si hubo reagrupacion se reexpande el bloque y se reaplica el
            // CSS/visibilidad de columnas custom, mismo cierre que el handler.
            if (bAgrupadorActive) {
                var oTable = this.getControlTable && this.getControlTable();
                if (oTable) {
                    var that = this;
                    var fnExpand = function () {
                        if (fnExpand._fired) return;
                        fnExpand._fired = true;
                        that._expandFullBlock(oTable, sParentPath, function () {
                            that._highlightSinProveedor(oTable);
                            that._applyBlockBorder(oTable);
                            that._updateCustomColsVisibility();
                        });
                    };
                    oTable.attachEventOnce("rowsUpdated", fnExpand);
                    setTimeout(fnExpand, 150);
                }
            }

            //   Se marca la variante como sucia (mismo mecanismo que usa
            // addRecursoCatalogoAlDesglose) para activar el guardado pendiente.
            if (this._markVariantDirty) this._markVariantDirty();

       
            if (sModelName === this.tableModelName
                && (this._pestana === "Corrientes" || this._pestana === "Externos")
                && oRow && oRow.__isCustom === true
                && (oRow.__isMainEditable === true || oRow.__isNieto === true)) {
                var oCtxSaveMV = oModel.createBindingContext(sRowPath);
                if (oCtxSaveMV) {
                    var oPayloadRowMV = this._sanitizeRowForBackend(oRow);
                    //   CampoMod compuesto: los tres campos que el value-help vuelca
                    //   en la fila ("Agrup,Descrip,Fee"). El backend recibira la fila
                    //   completa via _buildDesglosePayloadRow; el header campomod sirve
                    //   solo como indicador del campo modificado, no como filtro.
                    this._enviarFilaAlBackend(oCtxSaveMV, oPayloadRowMV, "Agrup,Descrip,Fee");
                }
            }
            //   (FIN MV)

            return { ok: true };
        },


        //   Inserta una fila editable de desglose (bloque custom) ya rellena con los
        // datos de oValues bajo oOperationRow. Replica la estructura de
        // onToggleCustomExpand (cabecera gris si no existe + fila editable tras ella)
        // para que la fila volcada sea identica a una creada manualmente con el "+".
        _insertRecursoDesgloseRow: function (oOperationRow, oContext, oValues) {
            if (!oOperationRow.children) oOperationRow.children = [];

            var oTable = this.getControlTable();
            var sRootPath = oContext.getPath();

            //   Corrientes: modo Persona/Puesto para operaciones .031/.032/.033.
            var bPersonaPuesto = this._isPersonaPuestoOperation(oOperationRow.PhPspnr);

            //   Cabecera gris del bloque si aun no existe (misma estructura y textos
            //   que onToggleCustomExpand para que las columnas muestren sus titulos).
            var bHasHeader = oOperationRow.children.some(function (c) { return c.__isHeader === true; });
            if (!bHasHeader) {
                //   Se delega la construccion de la cabecera al
                // helper _getProveedorHeaderRow que traduce via i18n.
                oOperationRow.children.push(this._getProveedorHeaderRow(bPersonaPuesto));
                //
            }

            //   Fila editable ya rellena con los datos del recurso.
            var oNuevaEditable = Object.assign(this._createEmptyEditableRow(), {
                __isMainEditable: true,
                __isPersonaPuesto: bPersonaPuesto,
                AGRUP: oValues.AGRUP || "",
                DESCRIP: oValues.DESCRIP || "",
                FEE: oValues.FEE || ""
            });

            //   Se ubica justo despues de la cabecera, en la parte superior del bloque.
            var iHeaderIdx = oOperationRow.children.findIndex(function (c) { return c.__isHeader === true; });
            if (iHeaderIdx !== -1) {
                oOperationRow.children.splice(iHeaderIdx + 1, 0, oNuevaEditable);
            } else {
                oOperationRow.children.push(oNuevaEditable);
            }
            oOperationRow.expanded = true;

            oContext.getModel().refresh(true);

            //   Se expande el bloque y se reaplica el CSS/visibilidad de columnas custom,
            //   igual que onToggleCustomExpand.
            if (oTable) {
                var that = this;
                var fnTriggerExpand = function () {
                    if (fnTriggerExpand._fired) return;
                    fnTriggerExpand._fired = true;
                    that._expandFullBlock(oTable, sRootPath, function () {
                        that._highlightSinProveedor(oTable);
                        that._applyBlockBorder(oTable);
                        that._updateCustomColsVisibility();
                    });
                };
                oTable.attachEventOnce("rowsUpdated", fnTriggerExpand);
                setTimeout(fnTriggerExpand, 150);
            }

            if (this._markVariantDirty) this._markVariantDirty();
        },

        _openProveedorValueStateMessage: function (oInput) {
            if (!oInput) return;
            var self = this;
            setTimeout(function () {
                if (oInput.bIsDestroyed) return;
                if (typeof oInput.openValueStateMessage !== "function") return;
             
                self._removeProveedorValueStateCloser();
                oInput.openValueStateMessage();
                var fnCloseOnOutside = function (oEvt) {
                    if (oInput.bIsDestroyed) {
                        self._removeProveedorValueStateCloser();
                        return;
                    }
                    var oDom = oInput.getDomRef();
                    //   Se ignora el click si cae sobre el propio Input: UI5 ya
                    // gestiona el ciclo focus/blur nativamente en ese caso.
                    if (oDom && oDom.contains(oEvt.target)) return;
                    if (typeof oInput.closeValueStateMessage === "function") {
                        oInput.closeValueStateMessage();
                    }
                    self._removeProveedorValueStateCloser();
                };
                self._fnProveedorValueStateCloser = fnCloseOnOutside;
                document.addEventListener("mousedown", fnCloseOnOutside, true);
            }, 0);
        },

        //   Desregistra el listener mousedown one-shot del popup del
        // valueStateMessage si esta activo. Centralizado para garantizar simetria
        // entre el add y el remove (mismo handler, mismo flag capture).
        _removeProveedorValueStateCloser: function () {
            if (this._fnProveedorValueStateCloser) {
                document.removeEventListener("mousedown", this._fnProveedorValueStateCloser, true);
                this._fnProveedorValueStateCloser = null;
            }
        },


 onEditableRowFieldChange: function (oEvent) {
            const oInput = oEvent.getSource();
            const oContext = oInput.getBindingContext(this.tableModelName);
            if (!oContext) return;

            const oRow = oContext.getObject();
            if (!oRow.__isEditable) return;
            if (oRow.__processing) return;

            //   Se normaliza el codigo de proveedor a MAYUSCULAS para alinear con el
            // backend (que devuelve Lifnr en mayusculas) y garantizar que la deteccion de
            // duplicados case-insensitive funcione desde el primer input.
            const sRawProveedor = (oRow.Proveedor || "").trim();
            //   En modo Persona/Puesto (Corrientes .031/.032/.033) el campo es texto
            // libre ("Puesto de trabajo"), no un codigo de proveedor: no se fuerza a
            // mayusculas para conservar el texto tal cual lo escribe el usuario.
            const sProveedor = oRow.__isPersonaPuesto === true ? sRawProveedor : sRawProveedor.toUpperCase();
            //   Se persiste la version en mayusculas en el modelo para que el Input
            // muestre el codigo normalizado y los mensajes de error lo reflejen.
            if (sProveedor && sProveedor !== oRow.Proveedor) {
                oContext.getModel().setProperty(oContext.getPath() + "/Proveedor", sProveedor);
            }

      
            if (!sProveedor) {
                oContext.getModel().setProperty(oContext.getPath() + "/__proveedorValueState", sap.ui.core.ValueState.None);
                oContext.getModel().setProperty(oContext.getPath() + "/__proveedorValueStateText", "");
                //   Se elimina la fila solo si todos los demas campos relevantes
                // estan vacios. Si la fila tiene datos (AGRUP, FEE, etc.) se conserva
                // para no perder informacion introducida por el usuario.
                if (oRow.__wasFilled && this._isRowEmpty(oRow)) {
                    this._removeEditableRow(oContext, this.getView().getModel(this.tableModelName), oRow);
                }
                return;
            }

         
            const sPath = oContext.getPath();
            const oModel = this.getView().getModel(this.tableModelName);
            //   En modo Persona/Puesto el valor es un puesto de trabajo (texto libre),
            // no un codigo de proveedor: se omite la validacion contra /ProveedoresSet
            // para no marcar el campo en error ni bloquear el alta del desglose.
            if (!oRow.__skipProveedorValidation && oRow.__isPersonaPuesto !== true) {
                const that = this;
                oRow.__processing = true;
                this._validateProveedorLifnr(sProveedor)
                    .then(function (bExists) {
                        delete oRow.__processing;
                        if (!bExists) {
                          
                            oModel.setProperty(sPath + "/__proveedorValueState", sap.ui.core.ValueState.Error);
                            oModel.setProperty(sPath + "/__proveedorValueStateText", that.getTranslatedText("proveedorNoExiste"));
                          
                            that._openProveedorValueStateMessage(oInput);
                            return;
                        }
                        //   Se limpia el estado en el modelo tras una validacion OK.
                        oModel.setProperty(sPath + "/__proveedorValueState", sap.ui.core.ValueState.None);
                        oModel.setProperty(sPath + "/__proveedorValueStateText", "");
                        oRow.__skipProveedorValidation = true;
                        that.onEditableRowFieldChange({ getSource: function () { return oInput; } });
                    });
                return;
            }
            delete oRow.__skipProveedorValidation;

            const sParentPath = sPath.replace(/\/children\/\d+$/, "");
            const sRootRowPath = sParentPath;

            //   Se limpia el ValueState a traves del modelo para evitar que el
            // reciclaje de Input al insertar bloques arrastre el estado a otra fila.
            oModel.setProperty(sPath + "/__proveedorValueState", sap.ui.core.ValueState.None);
            oModel.setProperty(sPath + "/__proveedorValueStateText", "");
            oRow.__wasFilled = true;
            oRow.__processing = true;

            const oRootRowCheck = oModel.getProperty(sRootRowPath);
                const sProveedorUpper = sProveedor.toUpperCase(); //   
            const sCurrentUid = oRow.__uid; //   
            const bDuplicate = oRootRowCheck && Array.isArray(oRootRowCheck.children) &&
                oRootRowCheck.children.some(function (c) {
                if (!c || c.__uid === sCurrentUid) return false; //   
                    //   Bloque ya creado con el mismo proveedor   
                    if (c.__isProviderBlock === true && //   
                        (c.__providerName || "").toUpperCase().trim() === sProveedorUpper) { //   
                        return true; //   
                    } //   
                    //   Otra fila editable hermana con el mismo codigo   
                    if (c.__isEditable === true && //   
                        (c.Proveedor || "").toUpperCase().trim() === sProveedorUpper) { //   
                        return true; //   
                    } //   
                    return false; //   
                });

            if (bDuplicate) {
                //   Se persiste el estado de error en la fila concreta para que tras
                // el refresh del modelo el borde rojo aparezca en la fila duplicada y
                // no se desplace a la nueva fila reciclada por t:Table.
                oModel.setProperty(sPath + "/__proveedorValueState", sap.ui.core.ValueState.Error);
                oModel.setProperty(sPath + "/__proveedorValueStateText", "Ya existe un bloque para este proveedor.");
                oRow.__wasFilled = false;
                delete oRow.__processing;
                oModel.refresh(true);
                //   Se limpia cualquier listener mousedown previo y se cierra el
                // popup del valueStateMessage que pudiera estar abierto: garantiza
                // que el MessageBox modal aparezca sin interferencias del listener
                // global registrado en una ejecucion anterior.
                this._removeProveedorValueStateCloser();
                if (!oInput.bIsDestroyed && typeof oInput.closeValueStateMessage === "function") {
                    oInput.closeValueStateMessage();
                }
                //   Se devuelve el foco al Input que disparo el error tras cerrar el
                // MessageBox y se reabre el popup del valueStateMessage, para que el
                // usuario vea de nuevo el texto del error sin tener que reclicar el
                // Input. Se verifica bIsDestroyed por si t:Table hubiera reciclado el
                // control durante el ciclo de vida del MessageBox.
                var self = this;
                  sap.m.MessageBox.error(this.getTranslatedText("ERROR_PROVEEDOR_BLOQUEADO").replace(/\{0\}/g, sProveedor), {
                    onClose: function () {
                        if (oInput.bIsDestroyed) return;
                        if (typeof oInput.focus === "function") {
                            oInput.focus();
                        }
                        self._openProveedorValueStateMessage(oInput);
                    }
                });
                return;
            }

            const oRootRow = oModel.getProperty(sRootRowPath);
         
            var bIsMainEditableRowMV = oRow && oRow.__isMainEditable === true;
            if (sProveedor && bIsMainEditableRowMV) {
                this._insertProveedorBlock(oRootRow, sProveedor, oRow);
            }
            //   (FIN MV)
            if (oRootRow) this._cleanupEmptyBlocks(oRootRow);
            delete oRow.__processing;

       
            var bIsDesgloseSavableMV = (this._pestana === "Corrientes" || this._pestana === "Externos");
            if (bIsDesgloseSavableMV && oRootRow && Array.isArray(oRootRow.children)) {
                var oNietoContextMV = null;
                var oNietoRowMV = null;
                if (bIsMainEditableRowMV) {
                    //   Main editable -> nieto recien creado: localizar por __providerName.
                    var iNietoIdxMV = -1;
                    for (var iKMV = 0; iKMV < oRootRow.children.length; iKMV++) {
                        var oCMV = oRootRow.children[iKMV];
                        if (oCMV && oCMV.__isNieto === true && oCMV.__providerName === sProveedor) {
                            iNietoIdxMV = iKMV;
                            break;
                        }
                    }
                    if (iNietoIdxMV >= 0) {
                        var sNietoPathMV = sRootRowPath + "/children/" + iNietoIdxMV;
                        oNietoContextMV = oModel.createBindingContext(sNietoPathMV);
                        oNietoRowMV = oNietoContextMV && oNietoContextMV.getObject();
                    }
                } else {
                    //   Fila ya nieto del backend: se guarda la propia (mantiene Posnr real).
                    oNietoContextMV = oContext;
                    oNietoRowMV = oRow;
                }
                if (oNietoRowMV && oNietoContextMV) {
                    var oPayloadRowMV = this._sanitizeRowForBackend(oNietoRowMV);
                    this._enviarFilaAlBackend(oNietoContextMV, oPayloadRowMV, "Prov");
                }
            }
            //   (FIN MV)

            const oTable = this.getControlTable();
            oModel.refresh(true);

            if (oTable) {
                const fnTriggerExpand = function () {
                    if (fnTriggerExpand._fired) return;
                    fnTriggerExpand._fired = true;
                    this._expandFullBlock(oTable, sRootRowPath, function () {
                        this._highlightSinProveedor(oTable);
                        this._applyBlockBorder(oTable);
                        //    Se actualiza la visibilidad de columnas custom tras
                        // reorganizar el árbol por cambio de campo en fila editable.
                        this._updateCustomColsVisibility();
                    }.bind(this));
                }.bind(this);

                oTable.attachEventOnce("rowsUpdated", fnTriggerExpand);
                setTimeout(fnTriggerExpand, 150);
            }
        },

        _createEmptyEditableRow: function () {
            return {
                __isCustom: true,
                __isEditable: true,
                __isMainEditable: false,
                __isNieto: false,
                __isPersonaPuesto: false, //   Modo Persona/Puesto (Corrientes .031/.032/.033); se sobreescribe al crear la fila bajo una operacion especial.
                __hasProviderRows: false, //   Se inicializa a false para mostrar el Input editable por defecto.
                __uid: Date.now() + "_" + Math.random(),
                cabecera: false, expandible: false, isGroup: false, padre: false,
                children: [],
                PhPspnr: "", Post1: "", AmoEje: "", AmoEjeAjus: "", AmoEjeReal: "",
                AmoPen: "", AmoTot: "", Tipo: "MAN", PenPlan: "",
                Proveedor: "",
                FEE: "",
                FINI: "", FFIN: "", _linDateFrom: "", _linDateTo: "",
                Otros: "", months: "",
                AGRUP: "", DESCRIP: "", NMES: ""
            };
        },

        _formatDateDisplay: function (dVal) {
            if (!dVal) return "";
            var oDate = dVal instanceof Date ? dVal : new Date(dVal);
            if (isNaN(oDate.getTime())) return "";
            var oFmt = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "dd/MM/yyyy" });
            return oFmt.format(oDate);
        },
        // Formatter para los inputs de FINI/FFIN del agrupador que ahora muestran
        // únicamente mes y año (en lugar del día) porque el selector es de mes/año.
        // Acepta ISO ("yyyy-MM-dd"), OData "/Date(ms)/" o Date directo.
        _formatMonthYearDisplay: function (dVal) {
            if (!dVal) return "";
            var oDate;
            if (dVal instanceof Date) {
                oDate = dVal;
            } else if (typeof dVal === "string" && /^\/Date\(\d+\)\/$/.test(dVal)) {
                oDate = this._parseODataDate(dVal);
            } else {
                oDate = new Date(dVal);
            }
            if (!oDate || isNaN(oDate.getTime())) return "";
            var oFmt = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "MMM yyyy" });
            var s = oFmt.format(oDate);
            return s.charAt(0).toUpperCase() + s.slice(1);
        },

        /**
         * Se elimina una fila editable vaciada y se limpia el bloque padre si queda vacío.
         */
        _removeEditableRow: function (oContext, oModel, oRow) {
            const sPath = oContext.getPath();
            const sParentPath = sPath.replace(/\/children\/\d+$/, "");

            //   Fix: sRootPath es el padre directo de la fila editable,
            // igual que la correccion aplicada en onEditableRowFieldChange (Bug 1).
            // La doble sustitucion anterior apuntaba al abuelo en rutas anidadas.
            const sRootPath = sParentPath;

            const oParent = oModel.getProperty(sParentPath);
            const oRootRow = oModel.getProperty(sRootPath);

            if (oParent && Array.isArray(oParent.children)) {
                oParent.children = oParent.children.filter(function (c) {
                    return c.__uid !== oRow.__uid;
                });
            }

            this._addRowToMainBlock(oRootRow);
            if (oRootRow) this._cleanupEmptyBlocks(oRootRow);

            const oTable = this.getControlTable();
            oModel.refresh(true);

            if (oTable) {
                const fnTriggerExpand = function () {
                    if (fnTriggerExpand._fired) return;
                    fnTriggerExpand._fired = true;
                    this._expandFullBlock(oTable, sRootPath, function () {
                        this._highlightSinProveedor(oTable);
                        this._applyBlockBorder(oTable);
                        //    Se actualiza la visibilidad de columnas custom tras
                        // eliminar una fila editable para ocultar las columnas si
                        // ya no quedan bloques custom activos en la tabla.
                        this._updateCustomColsVisibility();
                    }.bind(this));
                }.bind(this);

                oTable.attachEventOnce("rowsUpdated", fnTriggerExpand);
                setTimeout(fnTriggerExpand, 150);
            }
        },
        _addRowToMainBlock: function (oRootRow) {
            if (!oRootRow || !Array.isArray(oRootRow.children)) return;

            const bHasEditable = oRootRow.children.some(function (c) {
                return c.__isEditable === true && c.__uid;
            });
            if (bHasEditable) return;

            const oNuevaEditable = Object.assign(this._createEmptyEditableRow(), {
                __isMainEditable: true
            });

            //   La editable se ubica siempre justo después del header, antes que todo lo demás.
            const iHeaderIdx = oRootRow.children.findIndex(function (c) {
                return c.__isHeader === true;
            });
            if (iHeaderIdx !== -1) {
                oRootRow.children.splice(iHeaderIdx + 1, 0, oNuevaEditable);
            } else {
                oRootRow.children.unshift(oNuevaEditable);
            }
        },
        _cleanupEmptyBlocks: function (oNode) {
            if (!oNode || !Array.isArray(oNode.children)) return;

            oNode.children.forEach(function (oChild) {
                this._cleanupEmptyBlocks(oChild);
            }.bind(this));

            oNode.children = oNode.children.filter(function (oChild) {
                if (oChild.__isHeader || oChild.__isMainBlock) return true;
                if (oChild.__isAgrupadorTotal) return true; //   Fix: no se eliminan las filas grises de grupo
                if (oChild.__isSinAgrupador && oNode.__isMainBlock) return true;
                if (oChild.__isCustom) {
                    return this._hasEditableDescendant(oChild);
                }
                return true;
            }.bind(this));
        },


        _hasEditableDescendant: function (oNode) {
            if (!oNode) return false;
            if (oNode.__isEditable) return true;
            if (!Array.isArray(oNode.children)) return false;
            return oNode.children.some(function (c) {
                return this._hasEditableDescendant(c);
            }.bind(this));
        },
        _hasCustomDescendant: function (oNode) {
            if (!oNode) return false;
            if (oNode.__isCustom === true) return true;
            if (!Array.isArray(oNode.children)) return false;
            return oNode.children.some(function (c) {
                return this._hasCustomDescendant(c);
            }.bind(this));
        },
        _cloneEditableRow: function (oRow) {
            const oClone = JSON.parse(JSON.stringify(oRow));

            ["__processing", "__blockCreated", "__agrupadorCreated", "__isCommitted"].forEach(function (k) {
                delete oClone[k];
            });
            oClone.__isCustom = true;
            oClone.__isEditable = true;
            oClone.children = [];
            return oClone;
        },
        _insertProveedorBlock: function (oRootRow, sProveedor, oEditableRow) {
            if (!oRootRow) return;
            if (!oRootRow.children) oRootRow.children = [];

            const oNieto = this._cloneEditableRow(oEditableRow);
            oNieto.__isNieto = true;
            oNieto.__isMainEditable = false;
            oNieto.__isProviderBlock = true;
            oNieto.__providerName = sProveedor;
            oNieto.Proveedor = sProveedor;

            //   Se elimina la fila editable original.
            oRootRow.children = oRootRow.children.filter(function (c) {
                return c.__uid !== oEditableRow.__uid;
            });

            const sAgrup = (oNieto.AGRUP || "").trim();
            const bGroupsExist = oRootRow.children.some(function (c) {
                return c.__isAgrupadorTotal === true;
            });

            if (bGroupsExist && sAgrup) {
                //   Los grupos existen y el nieto tiene AGRUP: se inserta dentro del grupo correcto.
                const iTargetTotal = oRootRow.children.findIndex(function (c) {
                    return c.__isAgrupadorTotal === true &&
                        (c.__agrupadorName || "").trim() === sAgrup;
                });

                if (iTargetTotal !== -1) {
                    //   Se inserta justo despues del header del grupo, antes del resto
                    // de miembros, para que el nuevo proveedor quede como primero
                    // del agrupador.
                    const iInsert = iTargetTotal + 1;
                    oRootRow.children.splice(iInsert, 0, oNieto);
                } else {
                    //   Grupo aún no existente: se sitúa al final, antes de las editables.
                    const iFallback = this._findInsertAfterEditables(oRootRow.children);
                    oRootRow.children.splice(iFallback, 0, oNieto);
                }
            } else {
                //   Ningún grupo activo: posición estándar tras header + editables.
                const iPos = this._findInsertAfterEditables(oRootRow.children);
                oRootRow.children.splice(iPos, 0, oNieto);
            }

            oRootRow.expanded = true;
        },


        _expandAllCustomNodes: function (oTable, iMaxPasses, fnDone) {
            if (iMaxPasses === undefined) iMaxPasses = 10;
            if (iMaxPasses <= 0) {
                setTimeout(function () {
                    this._highlightSinProveedor(oTable);
                    this._applyBlockBorder(oTable);
                }.bind(this), 50);
                if (fnDone) fnDone();
                return;
            }

            const aRows = oTable.getRows();

            for (let i = 0; i < aRows.length; i++) {
                const oCtx = aRows[i].getBindingContext(this.tableModelName);
                if (!oCtx) continue;
                const oData = oCtx.getObject();
                if (oData && oData.__isCustom && oData.expanded &&
                    Array.isArray(oData.children) && oData.children.length > 0) {
                    const iIdx = aRows[i].getIndex();
                    if (!oTable.isExpanded(iIdx)) {
                        oTable.attachEventOnce("rowsUpdated", function () {
                            this._expandAllCustomNodes(oTable, iMaxPasses - 1, fnDone);
                        }.bind(this));
                        oTable.expand(iIdx);
                        return;
                    }
                }
            }

            setTimeout(function () {
                this._highlightSinProveedor(oTable);
                this._applyBlockBorder(oTable);
                if (fnDone) fnDone();
            }.bind(this), 50);
        },

        _expandFullBlock: function (oTable, sRootPath, fnDone) {
            const sModelName = this.tableModelName;
            let iAttempts = 0;

            const fnFindAndExpand = function () {
                const aRows = oTable.getRows();

                for (let i = 0; i < aRows.length; i++) {
                    const oCtx = aRows[i].getBindingContext(sModelName);
                    if (!oCtx || oCtx.getPath() !== sRootPath) continue;

                    const iIdx = aRows[i].getIndex();

                    if (!oTable.isExpanded(iIdx)) {
                        const fnAfterRoot = function () {
                            if (fnAfterRoot._fired) return;
                            fnAfterRoot._fired = true;
                            setTimeout(function () {

                                this._expandCustomLoop(oTable, 15, fnDone, sRootPath);
                            }.bind(this), 50);
                        }.bind(this);

                        oTable.attachEventOnce("rowsUpdated", fnAfterRoot);
                        setTimeout(fnAfterRoot, 200);
                        oTable.expand(iIdx);
                    } else {
                        setTimeout(function () {

                            this._expandCustomLoop(oTable, 15, fnDone, sRootPath);
                        }.bind(this), 50);
                    }
                    return;
                }

                if (iAttempts++ < 30) {
                    setTimeout(fnFindAndExpand, 50);
                } else {
                    if (fnDone) fnDone();
                }
            }.bind(this);

            fnFindAndExpand();
        },

        _expandCustomLoop: function (oTable, iMaxPasses, fnDone, sRootPath) {
            if (iMaxPasses <= 0) {
                if (fnDone) fnDone();
                return;
            }

            const sModelName = this.tableModelName;
            const aRows = oTable.getRows();
            const aNodesToExpand = [];

            for (let i = 0; i < aRows.length; i++) {
                const iIdx = aRows[i].getIndex();
                if (iIdx < 0) continue;

                const oCtx = aRows[i].getBindingContext(sModelName);
                if (!oCtx) continue;

                if (sRootPath && !oCtx.getPath().startsWith(sRootPath + "/")) continue;

                const oData = oCtx.getObject();
                if (!oData) continue;

                const bHasChildren = Array.isArray(oData.children) && oData.children.length > 0;
                if (bHasChildren && !oTable.isExpanded(iIdx)) {
                    aNodesToExpand.push(iIdx);
                }
            }

            if (aNodesToExpand.length === 0) {
                if (fnDone) fnDone();
                return;
            }

            const fnAfterExpand = function () {
                if (fnAfterExpand._fired) return;
                fnAfterExpand._fired = true;
                setTimeout(function () {
                    this._expandCustomLoop(oTable, iMaxPasses - 1, fnDone, sRootPath);
                }.bind(this), 30);
            }.bind(this);

            oTable.attachEventOnce("rowsUpdated", fnAfterExpand);
            setTimeout(fnAfterExpand, 200);

            aNodesToExpand.forEach(function (iIdx) {
                oTable.expand(iIdx);
            });
        },

        _highlightSinProveedor: function (oTable) {
            if (!oTable) return;
            const aRows = oTable.getRows();

            // Se define un helper local que aplica/quita una clase a la fila scrollable, a la fila fixed y al selector, para que el styling sea uniforme entre las columnas fijas y las desplazables
            const fnSyncClassAllParts = function (oRow, sClass, bAdd) {
                if (bAdd) {
                    oRow.addStyleClass(sClass);
                } else {
                    oRow.removeStyleClass(sClass);
                }
                const oFixed = oRow.getDomRef && oRow.getDomRef("fixed");
                const oSel = oRow.getDomRef && oRow.getDomRef("rowselector");
                const oAct = oRow.getDomRef && oRow.getDomRef("rowaction");
                [oFixed, oSel, oAct].forEach(function (oDom) {
                    if (!oDom) return;
                    if (bAdd) oDom.classList.add(sClass);
                    else oDom.classList.remove(sClass);
                });
            };

            aRows.forEach(function (oRow) {
                // Se limpian todas las clases de estilo en ambos lados (fijo y scrollable) antes de re-evaluar
                fnSyncClassAllParts(oRow, "sinProveedorRow", false);
                fnSyncClassAllParts(oRow, "headerGrayRow", false);
                fnSyncClassAllParts(oRow, "agrupadorTotalRow", false);
                fnSyncClassAllParts(oRow, "blockCustomRow", false);

                const oContext = oRow.getBindingContext(this.tableModelName);
                if (oContext) {
                    const oData = oContext.getObject();
                    //    Se aplica amarillo si es bloque principal, bloque de agrupador o fila editable custom
                    if (oData && (oData.__isSinProveedor === true || oData.__isSinAgrupador === true || oData.__isAgrupadorBlock === true)) {
                        fnSyncClassAllParts(oRow, "sinProveedorRow", true);
                    } else if (oData && oData.__isHeader === true) {
                        fnSyncClassAllParts(oRow, "headerGrayRow", true);
                    } else if (oData && oData.__isAgrupadorTotal === true) {
                        //   Fila de cabecera de grupo AGRUP: se aplica blockCustomRow para que herede el gris claro, altura y cuadrícula del bloque, y se mantiene agrupadorTotalRow sólo para la negrita
                        fnSyncClassAllParts(oRow, "blockCustomRow", true);
                        fnSyncClassAllParts(oRow, "agrupadorTotalRow", true);
                    } else if (oData && oData.__isCustom === true) {
                        // Se aplica un gris más claro a las filas custom del bloque (editables, nietos, bloques de proveedor) que quedan bajo la cabecera gris
                        fnSyncClassAllParts(oRow, "blockCustomRow", true);
                    }
                }
            }.bind(this));
        },
        _applyBlockBorder: function (oTable) {
            if (!oTable) return;

            var bIsMainTreeTableInitMV = oTable.hasStyleClass && oTable.hasStyleClass("mainTreeTable"); //   check de scope
            if (!bIsMainTreeTableInitMV && !this._hsbResizeFiredMV) { //   solo en las 3 view non-mainTreeTable, una sola vez
                this._hsbResizeFiredMV = true; //   flag para no disparar mas el resize
                var oTableHsbMV = oTable; //   referencia al table para el setTimeout
                setTimeout(function () { //   delay para dejar al TreeTable terminar el render inicial
                    try {
                        //   Se intenta llamar al metodo interno de SAP UI5 que actualiza
                        //   el thumb del scroll horizontal. Es un API "_" privado pero es
                        //   lo que se invoca internamente cuando el usuario interactua.
                        var oScrollExtHsbMV = oTableHsbMV._getScrollExtension && oTableHsbMV._getScrollExtension(); //   extension de scroll
                        if (oScrollExtHsbMV && typeof oScrollExtHsbMV._updateHorizontalScrollbar === "function") { //   defensivo: API privada
                            oScrollExtHsbMV._updateHorizontalScrollbar(); //   actualiza el thumb sin esperar interaccion
                        }
                        //   Fallback general: dispatch de resize event para forzar a SAP UI5
                        //   a recalcular layout de todas formas, en caso el API interno cambie.
                        window.dispatchEvent(new Event("resize")); //   fuerza recalculo global
                    } catch (eHsbMV) { /*   se ignora si el navegador o SAP UI5 no soporta algo */ }
                }, 300);
            }
            // (FIN)

            var iColEndIndexFixed = -1;
            var iColEndIndexScroll = -1;
            var iFixedCount = oTable.getFixedColumnCount ? oTable.getFixedColumnCount() : 0;
            var aColumns = oTable.getColumns();
            var iVisibleTotal = 0;

            for (var c = 0; c < aColumns.length; c++) {
                if (!aColumns[c].getVisible()) continue;
                iVisibleTotal++;
                if (aColumns[c].getId && aColumns[c].getId().indexOf("colEnd") !== -1) {
                    if (c < iFixedCount) {
                        iColEndIndexFixed = iVisibleTotal;
                    } else {
                        iColEndIndexScroll = iVisibleTotal - iFixedCount;
                    }
                }
            }

            var iFirst = oTable.getFirstVisibleRow();
            var aRows = oTable.getRows();

            for (var i = 0; i < aRows.length; i++) {
                var oCtx = oTable.getContextByIndex(iFirst + i);
                var oDom = aRows[i].getDomRef();
                if (!oDom) continue;

                if (!oCtx) continue;
                var oData = oCtx.getObject();
                if (!oData) continue;

                oDom.querySelectorAll("td").forEach(function (td) {
                    td.style.borderBottom = "";
                    td.style.borderRight = "";
                });
                var oFixed = document.getElementById(oDom.id + "-fixed");
                if (oFixed) {
                    oFixed.querySelectorAll("td").forEach(function (td) {
                        td.style.borderBottom = "";
                        td.style.borderRight = "";
                    });
                }

     
                var bIsMainTreeTableMV = oTable.hasStyleClass && oTable.hasStyleClass("mainTreeTable"); //   flag de scope
                var oDomRefsMV = bIsMainTreeTableMV && aRows[i].getDomRefs ? aRows[i].getDomRefs() : null; //   solo se piden refs si toca
                var oRowSelDomMV = oDomRefsMV && oDomRefsMV.rowSelector; //   celda del checkbox
                var oRowActDomMV = oDomRefsMV && oDomRefsMV.rowAction; //   celda del row action
                //   Reset altura inline antes de evaluar si toca aumentarla (mismo patron
                //   que el reset de border-bottom/right de arriba). Si la fila pasa de tener
                //   borde a no tenerlo, vuelve a su altura por defecto (CSS, 27px en normales).
                if (oRowSelDomMV) { //   defensivo: puede no existir si la fila no se renderiza
                    oRowSelDomMV.style.height = ""; //   reset altura inline
                    oRowSelDomMV.style.maxHeight = ""; //   reset max inline
                }
                if (oRowActDomMV) { //   defensivo
                    oRowActDomMV.style.height = ""; //   reset altura inline
                    oRowActDomMV.style.maxHeight = ""; //   reset max inline
                }
                // (FIN)

                if (oData.__isCustom === true) {
                    if (iColEndIndexScroll > 0) {
                        var aTdsScroll = oDom.querySelectorAll("td");
                        if (aTdsScroll[iColEndIndexScroll - 1]) {
                            aTdsScroll[iColEndIndexScroll - 1].style.setProperty(
                                "border-right", "2px solid #f3984e", "important"
                            );
                        }
                    }
                    if (iColEndIndexFixed > 0 && oFixed) {
                        var aTdsFixed = oFixed.querySelectorAll("td");
                        if (aTdsFixed[iColEndIndexFixed - 1]) {
                            aTdsFixed[iColEndIndexFixed - 1].style.setProperty(
                                "border-right", "2px solid #f3984e", "important"
                            );
                        }
                    }
                }

                var oNextCtx = oTable.getContextByIndex(iFirst + i + 1);
                var oNextData = oNextCtx && oNextCtx.getObject();

                var bCurrentIsEditable = oData.__isEditable === true;
                var bNextIsNotCustom = !oNextData || oNextData.__isCustom !== true;

                  if (bCurrentIsEditable && bNextIsNotCustom) {
                    //   Se excluye la celda dummy (sapUiTableCellDummy) para que
                    //   la linea negra inferior no se extienda al area sobrante
                    //   mas alla de la ultima columna real.
                    oDom.querySelectorAll("td:not(.sapUiTableCellDummy)").forEach(function (td) { //
                        td.style.setProperty("border-bottom", "2px solid #000000", "important");
                    });
                    if (oFixed) {
                        oFixed.querySelectorAll("td:not(.sapUiTableCellDummy)").forEach(function (td) { //
                            td.style.setProperty("border-bottom", "2px solid #000000", "important");
                        });
                    }

    
                    if (oRowSelDomMV) { //   defensivo: skip si el rowsel no esta renderizado
                        oRowSelDomMV.style.setProperty("height", "28px", "important"); //   +1px para igualar td con border
                        oRowSelDomMV.style.setProperty("max-height", "28px", "important"); //   max coherente
                    }
                    if (oRowActDomMV) { //   defensivo: skip si el rowact no esta renderizado
                        oRowActDomMV.style.setProperty("height", "28px", "important"); //   +1px para igualar td con border
                        oRowActDomMV.style.setProperty("max-height", "28px", "important"); //   max coherente
                    }
                 
                }
            }
        },
        _debounce: function (fn, delay) {
            var timer = null;
            return function () {
                var context = this;
                var args = arguments;
                clearTimeout(timer);
                timer = setTimeout(function () {
                    fn.apply(context, args);
                }, delay);
            };
        },

        _updateCustomColsVisibility: function () {
            //    Se obtiene la tabla principal del controlador activo.
            var oTable = this.getControlTable();
            if (!oTable) return;

           
            var bHasCustomRows = false;
            var oModel = this.getView().getModel(this.tableModelName);
            if (oModel) {
                var oData = oModel.getData();
                var aRoots = Array.isArray(oData) ? oData : (oData ? [oData] : []);
                var fnWalk = function (oNode) {
                    if (bHasCustomRows || !oNode) return;
                    if (oNode.__isCustom === true) { bHasCustomRows = true; return; }
                    if (Array.isArray(oNode.children)) {
                        for (var i = 0; i < oNode.children.length && !bHasCustomRows; i++) {
                            fnWalk(oNode.children[i]);
                        }
                    }
                };
                aRoots.forEach(fnWalk);
            }

            //    Se aplica la visibilidad calculada a todas las columnas
            // que pertenecen exclusivamente a filas custom. Si no hay ninguna
            // fila custom activa las columnas se ocultan para no mostrar
            // celdas vacías que confunden al usuario.
            var aCustomColIds = [
                "colProveedor", "colTarifa",
                "colFechaInicio", "colFechaFin",
                "colNMeses", "colOtros"
            ];
            aCustomColIds.forEach(function (sId) {
                var oCol = this.byId(sId);
                if (oCol) oCol.setVisible(bHasCustomRows);
            }.bind(this));
           
            this._reapplyBlockCssAfterLayout();
        },

       
        _reapplyBlockCssAfterLayout: function () {
            var oTable = this.getControlTable();
            if (!oTable) return;
            var that = this;
            var fnReapply = function () {
                if (fnReapply._fired) return;
                fnReapply._fired = true;
                if (typeof that._highlightSinProveedor === "function") {
                    that._highlightSinProveedor(oTable);
                }
                if (typeof that._applyBlockBorder === "function") {
                    that._applyBlockBorder(oTable);
                }
            };
            oTable.attachEventOnce("rowsUpdated", fnReapply);
            setTimeout(fnReapply, 200);
        },

        onTreetableToggleOpenState: function (oEvent) {
            var bExpanded = oEvent.getParameter("expanded");
            var iRowIndex = oEvent.getParameter("rowIndex");

            var oTable = this.getControlTable();
            if (!oTable) return;

            this._buildGroupRanges();
            this._applyCabeceraStyle();

            if (!bExpanded) {
                setTimeout(function () {
                    this._updateCustomColsVisibility();
                    this._highlightSinProveedor(oTable);
                    this._applyBlockBorder(oTable);
                }.bind(this), 50);
                return;
            }

            var oCtx = oTable.getContextByIndex(iRowIndex);
            if (!oCtx) return;

            var oRowData = oCtx.getObject();
            var sRootPath = oCtx.getPath();

            var bIsCustomNode = oRowData && (
                oRowData.__isCustom === true ||
                oRowData.__isMainBlock === true ||
                oRowData.__isSinAgrupador === true ||
                oRowData.__isAgrupadorBlock === true ||
                oRowData.__isProviderBlock === true
            );


            var bHasCustomDescendant = this._hasCustomDescendant(oRowData);

            console.log("bIsCustomNode:", bIsCustomNode, "| bHasCustomDescendant:", bHasCustomDescendant);

            if (!bIsCustomNode && !bHasCustomDescendant) {
                setTimeout(function () {
                    this._highlightSinProveedor(oTable);
                    this._applyBlockBorder(oTable);
                    this._updateCustomColsVisibility();
                }.bind(this), 50);
                return;
            }

            var bFired = false;
            var fnCascade = function () {
                if (bFired) return;
                bFired = true;
                this._expandCustomLoop(
                    oTable,
                    15,
                    function () {
                        this._highlightSinProveedor(oTable);
                        this._applyBlockBorder(oTable);
                        this._updateCustomColsVisibility();
                    }.bind(this),
                    sRootPath
                );
            }.bind(this);

            oTable.attachEventOnce("rowsUpdated", fnCascade);
            setTimeout(fnCascade, 200);
        },
       
        onProveedorRowAddPress: function (oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext(this.tableModelName);
            if (!oContext) return;

            const oRow = oContext.getObject();
            const sProveedor = (oRow.Proveedor || "").trim();
            if (!sProveedor) return;
            //   Se resuelve la operacion (PhPspnr) subiendo por la jerarquia del
            // arbol porque la fila editable desde la que se pulsa el + no la
            // expone directamente, vive en la fila operacion padre.
            const sDescripcion = this._getOperacionFromContext(oContext);

            //   Se inicializa el mapa si es la primera llamada en esta sesion de vista.
            if (!this._mProveedorRows) {
                this._mProveedorRows = {};
            }

            //   Se inicializa el array de filas para este proveedor si aun no existe.
            if (!this._mProveedorRows[sProveedor]) {
                this._mProveedorRows[sProveedor] = [];
            }

            //   Se construye la nueva fila editable asociada al proveedor pulsado.
            const oNuevaFila = {
                Proveedor: sProveedor,
                Post1: "", AmoEje: "", AmoEjeAjus: "", AmoEjeReal: "",
                AmoPen: "", AmoTot: "", Tipo: "MAN", PenPlan: "",
                FEE: "", FINI: "", FFIN: "", NMES: "", Otros: ""
            };

            // Se copian los campos anuales (Totala{N}) y mensuales (Val0{MM}a{N}) de la fila origen al registro nuevo, para que las columnas dinamicas del panel partan de los datos del padre sin requerir llamada al backend
            this._copyYearMonthFieldsFromParent(oRow, oNuevaFila);

            //   Se agrega la nueva fila al historico persistente del proveedor.
            this._mProveedorRows[sProveedor].push(oNuevaFila);

            //   Se sincroniza el flag __hasProviderRows en el modelo de la tabla
            // para que la fila nieto cambie del Input editable al Link clicable.
            const sPath = oContext.getPath();
            const sRootPath = sPath.replace(/\/children\/\d+$/, "");
            const oTableModel = this.getView().getModel(this.tableModelName);
            const oRootRow = oTableModel.getProperty(sRootPath);
            this._syncProviderRowFlags(oRootRow);
            oTableModel.refresh(true);

            const oPanelVBox = this.byId("panelVBox");
            const oPanelLayout = this.byId("panelSplitterLayout");

            //   Se determina si se esta cambiando de proveedor activo o si el panel estaba cerrado.
            const bProveedorDistinto = this._sCurrentProveedor !== sProveedor;
            const bPanelCerrado = !oPanelVBox || !oPanelVBox.getVisible();

            //   Se guarda el proveedor actualmente visible en el panel.
            this._sCurrentProveedor = sProveedor;

            //   Se obtienen todas las filas guardadas para el proveedor activo
            // y se actualiza el modelo del panel con ellas, descartando las del anterior.
            const aFilasProveedor = this._mProveedorRows[sProveedor];

            if (bPanelCerrado || bProveedorDistinto) {
                //   Primera apertura o cambio de proveedor: se recrea el modelo del panel
                // con las filas del proveedor seleccionado y se hace visible el panel.
                const oPanelModel = new sap.ui.model.json.JSONModel({
                    proveedor: sProveedor,
                    // Se incluye la descripción de la fila origen para el título "{Descripcion} - {Proveedor}" del panel
                    descripcion: sDescripcion,
                    rows: aFilasProveedor,
                    rowCount: aFilasProveedor.length
                });
                this.getView().setModel(oPanelModel, "panelModel");

                if (oPanelVBox) oPanelVBox.setVisible(true);

                // Se reconstruyen las columnas dinamicas de anyo/mes en el t:Table del panel a partir de los anyos visibles en la tabla principal, replicando el aspecto del header sin disparar llamadas al backend
                this._renderPanelYearColumns(oRow);

                if (bPanelCerrado && oPanelLayout) {
                    //   Solo se modifica el tamano del splitter si el panel estaba cerrado,
                    // para no alterar el resize manual del usuario entre cambios de proveedor.
                    oPanelLayout.setResizable(true);
                    oPanelLayout.setSize("200px");
                   
                    this._reapplyBlockCssAfterLayout();
                }

                setTimeout(function () {
                    this._calculateSplitterHeight();
                }.bind(this), 30);

            } else {
                //   Mismo proveedor activo: se actualiza el modelo en sitio
                // sin recrearlo para no perder el estado de scroll del panel.
                const oPanelModel = this.getView().getModel("panelModel");
                if (!oPanelModel) return;

                oPanelModel.setProperty("/proveedor", sProveedor);
                // Se actualiza también la descripción para reflejar la fila concreta pulsada                oPanelModel.setProperty("/descripcion", sDescripcion);
                oPanelModel.setProperty("/rows", aFilasProveedor);
                oPanelModel.setProperty("/rowCount", aFilasProveedor.length);
            }

            // Se guarda el __uid de la fila origen del panel para poder sincronizar el título cuando el usuario edita la descripción de esa misma fila
            this._sCurrentPanelRowUid = oRow.__uid || null;
            // Se publica el __uid activo en viewModel para que el binding del boton lupa de la primera celda muestre el estado on/off (Emphasized/Transparent) en la fila correspondiente
            this._syncPanelRowUidToView();
        },

        // Se propaga el valor de this._sCurrentPanelRowUid al viewModel para que las bindings de UI (p.ej. el tipo del boton lupa en la primera celda) reflejen automaticamente que fila esta actualmente mostrando su panel
        _syncPanelRowUidToView: function () {
            const oViewModel = this.getView().getModel("viewModel");
            if (!oViewModel) return;
            oViewModel.setProperty("/currentPanelRowUid", this._sCurrentPanelRowUid || null);
        },

        // Se copian los campos Totala{N} (totales anuales) y Val0{MM}a{N} (valores mensuales) desde la fila origen al registro destino del panelModel. Asi cada fila del panel arranca con los mismos importes que su padre y las columnas dinamicas tienen donde leer sin necesidad de binding al tableModel
        _copyYearMonthFieldsFromParent: function (oParent, oTarget) {
            if (!oParent || !oTarget) return;
            // Se itera sobre todas las claves del padre y solo se copian las que casan con los patrones Totala{N} o Val0{MM}a{N}, para no traspasar campos ajenos
            Object.keys(oParent).forEach(function (sKey) {
                if (/^Totala\d+$/.test(sKey) || /^Val\d{3}a\d+$/.test(sKey)) {
                    oTarget[sKey] = oParent[sKey];
                }
            });
        },

        // Se generan las columnas dinamicas del panel replicando la estructura del header de la tabla principal: primero los meses desplegados y al final la columna anyo clicable. La primera celda mensual incluye el boton flecha que cierra los meses, y la cabecera del anyo es un boton transparente que los reabre. El anyo y el sufijo (a1, a2, ...) se resuelven desde el contexto de la tabla principal (anyo abierto en su defecto el primero del rango) y todos los enlaces van a panelModel sin handler change para no propagar cambios al backend
        _renderPanelYearColumns: function (oParentRow) {
            const oPanelTable = this.byId("idPanelTable");
            if (!oPanelTable) return;

            // Se eliminan las columnas dinamicas previas (anyo, mes y resto) para evitar duplicados al reabrir o cambiar de proveedor
            const aCols = oPanelTable.getColumns();
            for (let i = aCols.length - 1; i >= 0; i--) {
                const oCol = aCols[i];
                if (oCol.data("dynamicYear") === true || oCol.data("dynamicMonth") === true || oCol.data("restoColumn") === true) {
                    oPanelTable.removeColumn(oCol);
                }
            }

            // Se obtienen SOLO las columnas anyo visibles de la tabla principal para replicar exactamente la misma secuencia de anyos en el panel inferior. Antes se replicaban todas las columnas dynamicYear (incluso las ocultas por _aplicarVisibilidadAniosTreeTable), provocando que el panel mostrara hasta 4 anyos cuando la tabla principal solo tenia 2 visibles.
            const oMainTable = this.getControlTable();
            if (!oMainTable) return;
            const aMainYearCols = oMainTable.getColumns().filter(function (c) {
                return c.data("dynamicYear") === true && c.getVisible();
            });
            if (aMainYearCols.length === 0) return;

            // Se anyade una columna anyo del panel por cada columna anyo de la tabla principal, en el mismo orden. Asi el panel mantiene el mismo conjunto de anyos visibles que arriba
            aMainYearCols.forEach(function (oMainCol) {
                const iYr = parseInt(oMainCol.data("year"), 10);
                const sSub = oMainCol.data("subFijoYear");
                if (!iYr || !sSub) return;
                oPanelTable.addColumn(this._buildPanelYearColumn(iYr, sSub));
            }.bind(this));

            // Si la tabla principal tiene un anyo desplegado con sus meses visibles, se insertan los mismos meses en el panel para mantener la alineacion con arriba. Si no hay anyo abierto, el panel queda solo con las columnas de anyo
            if (this._openedYear) {
                const oOpenedCol = aMainYearCols.find(function (c) {
                    return parseInt(c.data("year"), 10) === parseInt(this._openedYear, 10);
                }.bind(this));
                if (oOpenedCol) {
                    const sOpenedSub = oOpenedCol.data("subFijoYear");
                    if (sOpenedSub) {
                        this._insertPanelMonths(parseInt(this._openedYear, 10), sOpenedSub);
                    }
                }
            }

            // Se anyade la columna "Resto" al final del panel para mantener la misma estructura que la tabla principal (anyos visibles + Resto). El input es de solo lectura y se enlaza a panelModel>PlanResto
            oPanelTable.addColumn(this._buildPanelRestoColumn());
        },

        // Se construye la columna "Resto" del panel replicando visualmente la columna Resto de la tabla principal. El valor es de solo lectura y se lee desde panelModel>PlanResto; si la fila del proveedor no contiene PlanResto se mostrara vacio
        _buildPanelRestoColumn: function () {
            const oRestoLabel = new sap.m.VBox({
                width: "100%",
                renderType: "Bare",
                items: [
                    new sap.m.Label({
                        //   Se traduce el header "Resto" via i18n para soportar EN/FR.  
                        text: this.getTranslatedText("colResto"),
                        //  
                        design: "Bold",
                        textAlign: "Center",
                        width: "100%"
                    }).addStyleClass("titleGrande")
                ]
            }).addStyleClass("fullWidthHeader");

            const oRestoTpl = new sap.m.HBox({
                renderType: "Bare",
                justifyContent: "Center",
                alignItems: "Center",
                items: [
                    new sap.m.Input({
                        editable: false,
                        textAlign: "Center",
                        value: "{panelModel>PlanResto}",
                        width: "100%"
                    }).addStyleClass("customYearInput sapUiSizeCompact")
                ]
            }).addStyleClass("yearCell sapUiTinyMarginBegin sapUiTinyMarginEnd");

            const oRestoCol = new sap.ui.table.Column({
                width: "8rem",
                minWidth: 60,
                autoResizable: true,
                hAlign: "Center",
                label: oRestoLabel,
                template: oRestoTpl
            });
            oRestoCol.data("restoColumn", true);
            return oRestoCol;
        },

        // Se construye la columna anyo del panel: header con boton transparente que muestra el numero del anyo (alterna la apertura/cierre de los meses) y celda con Input no editable enlazado a panelModel>Totala{N}
        _buildPanelYearColumn: function (iYear, sSubFijo) {
            const oYearLabel = new sap.m.VBox({
                width: "100%",
                height: "100%",
                renderType: "Bare",
                items: [
                    new sap.m.Button({
                        text: iYear.toString(),
                        type: "Transparent",
                        width: "100%",
                        press: this._onPanelMonthsToggle.bind(this)
                    }).addStyleClass("yearButton").addStyleClass("nopadding")
                        .data("subFijoYear", sSubFijo)
                        .data("year", iYear)
                ]
            }).addStyleClass("fullWidthHeader");

            const oYearTpl = new sap.m.HBox({
                renderType: "Bare",
                justifyContent: "Center",
                alignItems: "Center",
                items: [
                    new sap.m.Input({
                        editable: false,
                        textAlign: "Center",
                        value: "{panelModel>Total" + sSubFijo + "}",
                        width: "100%"
                    }).addStyleClass("customYearInput sapUiSizeCompact")
                ]
            }).addStyleClass("yearCell sapUiTinyMarginBegin sapUiTinyMarginEnd");

            const oYearCol = new sap.ui.table.Column({
                width: "8rem",
                minWidth: 60,
                autoResizable: true,
                label: oYearLabel,
                template: oYearTpl
            });
            oYearCol.data("dynamicYear", true);
            oYearCol.data("year", iYear);
            oYearCol.data("subFijoYear", sSubFijo);
            return oYearCol;
        },

        // Se insertan las columnas mensuales del anyo indicado justo a la izquierda de su columna anyo. La cabecera lleva el texto "mes anyo" (p.ej. "abr 2026") y la primera celda incluye un boton flecha que cierra los meses, replicando el comportamiento del header de la tabla principal. Los Input mensuales son editables pero NO registran handler change para no propagar cambios al backend
        _insertPanelMonths: function (iYear, sSubFijo) {
            const oPanelTable = this.byId("idPanelTable");
            if (!oPanelTable) return;

            // Se localiza la columna anyo correspondiente para usar su indice actual como punto de insercion de los meses
            const oYearCol = oPanelTable.getColumns().find(function (c) {
                return c.data("dynamicYear") === true && c.data("subFijoYear") === sSubFijo;
            });
            if (!oYearCol) return;
            const iYearIdx = oPanelTable.indexOfColumn(oYearCol);

            // Se calcula el mes de inicio aplicando la misma regla que onCreateMonthsTable de la tabla principal: si el anyo coincide con el actual, se arranca en el mes corriente; en otro caso, desde enero
            const oRefDate = this._effectiveDate || new Date();
            const iCurrentYear = oRefDate.getFullYear();
            const iCurrentMonth = oRefDate.getMonth();
            const iStartIdx = (iYear === iCurrentYear) ? iCurrentMonth : 0;

            //   Se generan los nombres abreviados de los meses
            // respetando el idioma activo de UI5 (mismo cambio que en la
            // tabla principal en torno a la linea 1027). Se usa DateFormat
            // para que los headers EN/FR se traduzcan automaticamente y
            // se mantenga la alineacion con la tabla principal.  
            const oPanelMonthFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "MMM" });
            const aMonthNames = [];
            for (let i = 0; i < 12; i++) {
                aMonthNames.push(oPanelMonthFormat.format(new Date(2000, i, 1)));
            }
            //  

            // Se itera desde iStartIdx hasta diciembre insertando cada mes en la posicion del anyo. Tras cada insercion la columna anyo se desplaza hacia la derecha de modo que iYearIdx+iOffset mantiene el orden correcto y la columna anyo termina al final del rango mensual
            let iOffset = 0;
            for (let i = iStartIdx; i < 12; i++) {
                const sNum = (i + 1).toString().length === 1 ? "0" + (i + 1) : (i + 1).toString();
                const sValKey = "Val0" + sNum + sSubFijo;
                const sMonthLabel = aMonthNames[i] + " " + iYear;

                // Se construye el titulo del mes: el primer mes lleva en el header el boton flecha que cierra los meses, los demas solo el Label
                let oTitleControl;
                if (i === iStartIdx) {
                    oTitleControl = new sap.m.HBox({
                        alignItems: "Center",
                        justifyContent: "Center",
                        renderType: "Bare",
                        width: "100%",
                        items: [
                            new sap.m.Label({
                                text: sMonthLabel,
                                design: "Bold",
                                textAlign: "Center"
                            }).addStyleClass("testBold titleGrande"),
                            new sap.m.Button({
                                type: "Transparent",
                                icon: "sap-icon://slim-arrow-right",
                                press: this._onPanelMonthsToggle.bind(this)
                            }).data("year", iYear)
                                .data("subFijoYear", sSubFijo)
                                .addStyleClass("iconOnlyBtn lineHeightArrowIcon")
                        ]
                    }).addStyleClass("monthHeaderHBox");
                } else {
                    oTitleControl = new sap.m.Label({
                        text: sMonthLabel,
                        design: "Bold",
                        textAlign: "Center",
                        width: "100%"
                    }).addStyleClass("testBold titleGrande");
                }

                const oColLabel = new sap.m.VBox({
                    width: "100%",
                    items: [oTitleControl]
                }).addStyleClass("fullWidthHeader");

                // Se construye la celda mensual: Input editable enlazado a panelModel>Val0{MM}a{N}. Se omite el handler change para no llamar al backend (requisito actual del panel)
                const oInput = new sap.m.Input({
                    value: "{panelModel>" + sValKey + "}",
                    editable: true,
                    textAlign: "Center",
                    width: "100%"
                }).addStyleClass("customYearInput sapUiSizeCompact");

                const oTpl = new sap.m.HBox({
                    renderType: "Bare",
                    justifyContent: "Center",
                    alignItems: "Center",
                    items: [oInput]
                }).addStyleClass("sapUiTinyMarginBegin sapUiTinyMarginEnd");

                const oMonthCol = new sap.ui.table.Column({
                    width: "130px",
                    hAlign: "Center",
                    label: oColLabel,
                    template: oTpl
                });
                oMonthCol.data("dynamicMonth", true);
                oMonthCol.data("subFijoYear", sSubFijo);
                oMonthCol.data("year", iYear);
                oMonthCol.data("monthIdx", i);

                oPanelTable.insertColumn(oMonthCol, iYearIdx + iOffset);
                iOffset++;
            }
        },

        // Se alterna la visibilidad de las columnas mensuales del panel. Se invoca tanto desde el boton anyo de la cabecera como desde el boton flecha del primer mes; ambos llevan en data el anyo y el sufijo del rango afectado. Si hay meses visibles para ese sufijo se eliminan; en otro caso se reinsertan con _insertPanelMonths
        _onPanelMonthsToggle: function (oEvent) {
            const oSource = oEvent.getSource();
            const iYear = parseInt(oSource.data("year"), 10);
            const sSubFijo = oSource.data("subFijoYear");
            if (!iYear || !sSubFijo) return;

            const oPanelTable = this.byId("idPanelTable");
            if (!oPanelTable) return;

            const aMonths = oPanelTable.getColumns().filter(function (c) {
                return c.data("dynamicMonth") === true && c.data("subFijoYear") === sSubFijo;
            });

            if (aMonths.length > 0) {
                aMonths.forEach(function (c) { oPanelTable.removeColumn(c); });
            } else {
                this._insertPanelMonths(iYear, sSubFijo);
            }
        },

        //   Cuando el usuario empieza a tipear en el Input editable de Proveedor
        // de la fila editable principal, el panel inferior (que muestra el
        // historico de otro proveedor previamente abierto) deja de ser
        // pertinente y se cierra. Si la entrada termina siendo un proveedor
        // valido, el flujo de _insertProveedorBlock + onProveedorRowAddPress
        // volvera a abrir el panel para el nuevo proveedor.
        onEditableProveedorLiveChange: function () {
            const oPanelVBox = this.byId("panelVBox");
            if (oPanelVBox && oPanelVBox.getVisible()) {
                this.onClosePanelPress();
            }
        },

        //   Recorre la jerarquia del tableModel hacia arriba desde el contexto
        // recibido y devuelve el primer PhPspnr no vacio que no sea "D" (OEO
        // raiz). Se usa para componer el titulo del panel de proveedor con la
        // operacion en lugar de la descripcion de la fila origen.
        _getOperacionFromContext: function (oContext) {
            if (!oContext) return "";
            const oModel = this.getView().getModel(this.tableModelName);
            if (!oModel) return "";
            let sPath = oContext.getPath();
            while (sPath) {
                const oRow = oModel.getProperty(sPath);
                if (oRow) {
                    const sOp = (oRow.PhPspnr || "").trim();
                    if (sOp && sOp !== "D") return sOp;
                }
                const iCut = sPath.lastIndexOf("/children/");
                if (iCut < 0) break;
                sPath = sPath.substring(0, iCut);
            }
            return "";
        },

        //   Se cierra el panel inferior y se restaura el número de filas
        // visibles de la tabla al valor calculado sin offset.
        onClosePanelPress: function () {
            // 1. Se cierra el panel y se deshabilita el resize
            const oPanelLayout = this.byId("panelSplitterLayout");
            if (oPanelLayout) {
                oPanelLayout.setSize("0px");
                oPanelLayout.setResizable(false);
            }

            // 2. Se oculta el VBox y la barra divisoria desaparece
            const oPanelVBox = this.byId("panelVBox");
            if (oPanelVBox) oPanelVBox.setVisible(false);

            // Se limpia el __uid de la fila origen del panel para que el siguiente liveChange de descripción no actualice un título cerrado
            this._sCurrentPanelRowUid = null;
            // Se propaga el null al viewModel para que el boton lupa de todas las filas vuelva al estado Transparent (off) cuando el panel queda cerrado
            this._syncPanelRowUidToView();
            // Se libera tambien el proveedor activo: si el usuario vuelve a pulsar la lupa de una fila cuyo proveedor coincidia con el ultimo mostrado, el flujo de apertura volvera a recrear el panelModel correctamente en lugar de salir por el corto-circuito de proveedor identico con panel cerrado
            this._sCurrentProveedor = null;

            // 3. Se restablece la altura del splitter: la TreeTable vuelve
            //    a ocupar la pantalla como si el splitter no existiera
            const oSplitter = this.byId("mainSplitter");
            if (oSplitter) oSplitter.setHeight("");

            setTimeout(function () {
                this._calculateDynamicRows();
              
                this._reapplyBlockCssAfterLayout();
            }.bind(this), 50);
        },


        onSplitterResize: function () {
            // Cuando el usuario arrastra el divisor interno se recalculan
            // solo las filas (la altura total del splitter no cambia).
            setTimeout(function () {
                this._calculateDynamicRows();
               
                this._reapplyBlockCssAfterLayout();
            }.bind(this), 30);
        },
        //   Se abre el panel inferior mostrando las filas ya guardadas del proveedor
        // de la fila pulsada, sin agregar una nueva fila. Permite visualizar el historico
        // del proveedor sin necesidad de pulsar el boton "+".
        onProveedorRowViewPress: function (oEvent) {
            const oInput = oEvent.getSource();
            const oContext = oInput.getBindingContext(this.tableModelName);
            if (!oContext) return;

            const oRow = oContext.getObject();
            const sProveedor = (oRow.Proveedor || oRow.__providerName || "").trim();
            if (!sProveedor) return;
            //   Se resuelve la operacion (PhPspnr) subiendo por la jerarquia: el
            // boton lupa puede dispararse desde la fila Nieto (bloque proveedor)
            // cuyo PhPspnr esta vacio, asi que se recorre hacia arriba.
            const sDescripcion = this._getOperacionFromContext(oContext);

            if (!this._mProveedorRows) this._mProveedorRows = {};

            const aFilasProveedor = this._mProveedorRows[sProveedor] || [];
            const oPanelVBox = this.byId("panelVBox");
            const oPanelLayout = this.byId("panelSplitterLayout");
            const bPanelAbierto = oPanelVBox && oPanelVBox.getVisible();

            // Toggle: si se vuelve a pulsar la lupa de la misma fila cuyo panel ya esta abierto, se cierra el panel y se libera el indicador on/off para que la lupa vuelva al estado Transparent
            if (bPanelAbierto && oRow.__uid && this._sCurrentPanelRowUid === oRow.__uid) {
                this.onClosePanelPress();
                return;
            }

            //   Fix 3: si el proveedor no tiene filas en el panel se cierra el splitter
            // independientemente de qué proveedor estuviera activo antes.
            if (aFilasProveedor.length === 0) {
                if (bPanelAbierto) {
                    if (oPanelLayout) {
                        oPanelLayout.setSize("0px");
                        oPanelLayout.setResizable(false);
                    }
                    if (oPanelVBox) oPanelVBox.setVisible(false);
                    const oSplitter = this.byId("mainSplitter");
                    if (oSplitter) oSplitter.setHeight("");
                    setTimeout(function () {
                        this._calculateDynamicRows();
                    }.bind(this), 50);
                }
                return;
            }

            // Se actualiza el __uid de la fila activa antes del corto-circuito por proveedor identico, de modo que cuando dos filas distintas comparten el mismo Proveedor el indicador on/off conmute igualmente entre ellas aunque el contenido del panel sea el mismo
            this._sCurrentPanelRowUid = oRow.__uid || null;
            this._syncPanelRowUidToView();

            //   Si el proveedor pulsado ya está activo y el panel está abierto no se hace nada.
            if (bPanelAbierto && this._sCurrentProveedor === sProveedor) return;

            this._sCurrentProveedor = sProveedor;

            const oPanelModel = new sap.ui.model.json.JSONModel({
                proveedor: sProveedor,
                // Se añade la descripción para componer el título "{Descripcion} - {Proveedor}" del panel
                descripcion: sDescripcion,
                rows: aFilasProveedor,
                rowCount: aFilasProveedor.length
            });
            this.getView().setModel(oPanelModel, "panelModel");

            if (oPanelVBox) oPanelVBox.setVisible(true);

            // Se reconstruyen las columnas dinamicas anyo/mes del panel para que la apertura via lupa replique el estado de la tabla principal, igual que ocurre al pulsar el boton + (onProveedorRowAddPress)
            this._renderPanelYearColumns(oRow);

            if (!bPanelAbierto && oPanelLayout) {
                oPanelLayout.setResizable(true);
                oPanelLayout.setSize("200px");
                setTimeout(function () {
                    this._calculateSplitterHeight();
                }.bind(this), 30);
              
                this._reapplyBlockCssAfterLayout();
            }
        },

        //  Se abre el dialog de Busqueda de Proveedores cuando el usuario pulsa
        //  el icono de value help del input Proveedor de la fila nieto. Se
        //  preserva el contexto de la fila origen para que la seleccion posterior
        //  pueda actualizar su campo Proveedor y abrir el panel correspondiente.
        onProveedorValueHelpRequest: function (oEvent) {
            var oInput = oEvent.getSource();
    
            var sModelName = this.tableModelName;
            var oContext = oInput.getBindingContext(sModelName);
            if (!oContext) {
                sModelName = "panelModel";
                oContext = oInput.getBindingContext(sModelName);
            }
            if (!oContext) {
                return;
            }

            //  Se guarda el path en lugar del contexto para no quedarse con una
            //  referencia obsoleta si el binding se recicla entre filas.
            this._sProveedorVHRowPath = oContext.getPath();
            this._sProveedorVHTableModel = sModelName;

            var oView = this.getView();

            if (!this._pBusquedaProveedoresDialog) {
                //  Se inicializa el modelo del dialog vacio antes de cargarlo para
                //  que los bindings de la tabla resuelvan sin avisos al abrirlo
                //  por primera vez.
                var oDialogModel = new sap.ui.model.json.JSONModel({ results: [] });
                oView.setModel(oDialogModel, "busquedaProveedoresModel");

                //  Se crea un modelo independiente proveedoresFiltrosModel para
                //  los tres filtros del dialog (Name1, Lifnr, Stcd1). Mantenerlo
                //  separado de busquedaProveedoresModel permite distinguir con
                //  claridad el estado de los inputs respecto al estado de los
                //  resultados y leer los filtros desde el controller sin recurrir
                //  a Fragment.byId.
                var oFiltrosModel = new sap.ui.model.json.JSONModel({ Name1: "", Lifnr: "", Stcd1: "" });
                oView.setModel(oFiltrosModel, "proveedoresFiltrosModel");

                this._pBusquedaProveedoresDialog = sap.ui.core.Fragment.load({
                    id: oView.getId(),
                    name: "zindirect_costs.fragments.BusquedaProveedoresDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pBusquedaProveedoresDialog.then(function (oDialog) {
                //  Se limpian los filtros y la lista de resultados cada vez que se
                //  abre el dialog para evitar arrastrar el estado de la busqueda
                //  anterior. La lectura de /ProveedoresSet para poblar la tabla
                //  no se ejecuta hasta que el usuario pulse Buscar o haga submit
                //  en alguno de los inputs.
                this._resetBusquedaProveedores();
                oDialog.open();

             
            
            }.bind(this));
        },

        //  Se vacian los tres filtros del modelo proveedoresFiltrosModel y la
        //  tabla de resultados de busquedaProveedoresModel. Al estar los inputs
        //  bindados al modelo, no hace falta limpiarlos uno a uno via
        //  Fragment.byId: basta con resetear las propiedades del modelo y la
        //  vista se actualiza sola.
        _resetBusquedaProveedores: function () {
            var oView = this.getView();
            var oResultadosModel = oView.getModel("busquedaProveedoresModel");
            if (oResultadosModel) {
                oResultadosModel.setProperty("/results", []);
            }
            var oFiltrosModel = oView.getModel("proveedoresFiltrosModel");
            if (oFiltrosModel) {
                oFiltrosModel.setData({ Name1: "", Lifnr: "", Stcd1: "" });
            }
           
            var oVHTable = this.byId("busquedaProveedoresTable");
            if (oVHTable && typeof oVHTable.removeSelections === "function") {
                oVHTable.removeSelections(true);
            }
        },

  
        onBusquedaProveedoresBuscar: function () {
            var oView = this.getView();
            var oFiltrosModel = oView.getModel("proveedoresFiltrosModel");
            var oFiltros = (oFiltrosModel && oFiltrosModel.getData()) || {};

            var sNombre = (oFiltros.Name1 || "").trim();
            var sId = (oFiltros.Lifnr || "").trim();
            var sCif = (oFiltros.Stcd1 || "").trim();

            if (!sNombre && !sId && !sCif) {
                this.createMessageDialog({
                    title: this.getTranslatedText("busquedaProveedoresErrorTitulo"),
                    textAccept: this.getTranslatedText("busquedaProveedoresAceptar"),
                    messages: [{
                        text: this.getTranslatedText("busquedaProveedoresFiltroVacio"),
                        type: "Error"
                    }]
                });
                return;
            }

            this._loadProveedores(oFiltros);
        },

       
        _validateProveedorLifnr: function (sLifnr) {
            var oMainService = this.getGlobalModel("mainService");
            if (!oMainService) return Promise.resolve(false);
            var oHeaders = this._buildProveedoresHeaders({ Lifnr: sLifnr });
            //   La comparacion se hace en mayusculas porque _buildProveedoresHeaders
            // ya normaliza el filtro a uppercase. Sin esto, un Lifnr tipeado en
            // minusculas devolveria registros validos pero el some() fallaria al
            // comparar "btuk" !== "BTUK".
            var sTarget = (sLifnr || "").trim().toUpperCase();
            return this.get(oMainService, "/ProveedoresSet", {
                headers: oHeaders,
                filters: [],
                noLoading: true
            }).then(function (oData) {
                var aResults = (oData && oData.results) ? oData.results : [];
                return aResults.some(function (oRes) {
                    return ((oRes && oRes.Lifnr) || "").trim().toUpperCase() === sTarget;
                });
            }).catch(function () {
                return false;
            });
        },

     
        _loadProveedores: function (oFilterValues) {
            var oView = this.getView();
            var oModel = oView.getModel("busquedaProveedoresModel");
            var oMainService = this.getGlobalModel("mainService");
            if (!oMainService) {
                if (oModel) oModel.setProperty("/results", []);
                return;
            }

            var oHeaders = this._buildProveedoresHeaders(oFilterValues);
            this.get(oMainService, "/ProveedoresSet", { headers: oHeaders, filters: [] })
                .then(function (oData) {
                    var aResults = (oData && oData.results) ? oData.results : [];
                    if (oModel) {
                        oModel.setProperty("/results", aResults);
                    }
                })
                .catch(function () {
                    if (oModel) {
                        oModel.setProperty("/results", []);
                    }
                });
        },

        _buildProveedoresHeaders: function (oFilterValues) {
            var oFV = oFilterValues || {};
            //   Se normaliza a mayusculas porque el backend matchea de forma
            // case-sensitive: si el usuario tipea "acr" no encuentra registros
            // aunque "ACR..." si exista. Aplicado aqui (y no en el input) para
            // beneficiar tanto al dialog como a la validacion silenciosa de Lifnr.
            var sNombre = (oFV.Name1 || "").trim().toUpperCase();
            var sCodigo = (oFV.Lifnr || "").trim().toUpperCase();
            var sCif    = (oFV.Stcd1 || "").trim().toUpperCase();

            var oAppDataModel = this.getGlobalModel("appData");
            var oAppData = (oAppDataModel && oAppDataModel.getData()) || {};
            var oUser = oAppData.userData || {};

            return {
                Ambito: oUser.initialNode || "",
                Lang:   oUser.AplicationLangu || "",
                Nombre: sNombre || "%",
                Codigo: sCodigo || "%",
                Cif:    sCif    || "%"
            };
        },

     
        onBusquedaProveedoresSeleccion: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            if (!oItem) return;

            var oCtx = oItem.getBindingContext("busquedaProveedoresModel");
            if (!oCtx) return;

            this._aplicarProveedorSeleccionado(oCtx.getObject() || {});
        },


        _aplicarProveedorSeleccionado: function (oProveedor) {
       
            var sNuevoProveedor = ((oProveedor && (oProveedor.Lifnr || oProveedor.Name1)) || "").trim().toUpperCase();
            if (!sNuevoProveedor) return;

            var sTableModel = this._sProveedorVHTableModel || this.tableModelName;
            var oTableModel = this.getView().getModel(sTableModel);
            var sPath = this._sProveedorVHRowPath;
            if (!oTableModel || !sPath) return;

           
            if (sTableModel !== "panelModel") {
                var sParentPathDup = sPath.replace(/\/children\/\d+$/, "");
                var oParentRowDup = oTableModel.getProperty(sParentPathDup);
                // Comparacion case-insensitive: bloques previos pueden tener __providerName en otra capitalizacion ("Btum" tipeado a mano vs "BTUM" del value help) y la comparacion estricta no los detectaba como duplicado
                var sNuevoProveedorUpper = sNuevoProveedor.toUpperCase();
                var bDuplicate = oParentRowDup && Array.isArray(oParentRowDup.children) &&
                    oParentRowDup.children.some(function (c) {
                        return c.__isProviderBlock === true && (c.__providerName || "").toUpperCase() === sNuevoProveedorUpper;
                    });
                if (bDuplicate) {
                    //   Se replica el feedback del flujo manual: se escribe el codigo
                    // en el Input de la fila origen y se persiste el ValueState de error
                    // en el modelo para que aparezca el borde rojo bindado, igualando la
                    // experiencia con la del tipeo directo.
                    oTableModel.setProperty(sPath + "/Proveedor", sNuevoProveedor);
                    oTableModel.setProperty(sPath + "/__proveedorValueState", sap.ui.core.ValueState.Error);
              oTableModel.setProperty(sPath + "/__proveedorValueStateText", this.getTranslatedText("ERROR_PROVEEDOR_BLOQUEADO").replace(/\{0\}/g, sNuevoProveedor));
                    sap.m.MessageBox.error(this.getTranslatedText("ERROR_PROVEEDOR_BLOQUEADO").replace(/\{0\}/g, sNuevoProveedor));
                    //   Se deselecciona la fila en la Table del dialog: en modo
                    // SingleSelectMaster un segundo click sobre la misma fila no dispara
                    // selectionChange, lo que impedia al usuario reintentar la misma
                    // seleccion. Limpiando la seleccion el siguiente click vuelve a
                    // disparar el evento.
                    var oVHTable = this.byId("busquedaProveedoresTable");
                    if (oVHTable && typeof oVHTable.removeSelections === "function") {
                        oVHTable.removeSelections(true);
                    }
                    return;
                }
            }

      
            oTableModel.setProperty(sPath + "/Proveedor", sNuevoProveedor);

            //  Se cierra el dialog en ambas ramas antes de cualquier
            //  apertura de panel, para evitar solapes visuales.
            if (this._pBusquedaProveedoresDialog) {
                this._pBusquedaProveedoresDialog.then(function (oDialog) {
                    if (oDialog && oDialog.isOpen()) {
                        oDialog.close();
                    }
                });
            }

            //  Rama panel: la celda Proveedor del panel inferior solo
            //  necesita reflejar el nuevo valor; no hay flags __hasProveedor
            //  que sincronizar ni panel que abrir, por lo que se termina
            //  aqui tras refrescar el binding.
            if (sTableModel === "panelModel") {
                oTableModel.refresh(true);
                return;
            }

            var oRowSel = oTableModel.getProperty(sPath);
            if (oRowSel && oRowSel.__isEditable === true) {
                //   Se marca __skipProveedorValidation para que onEditableRowFieldChange
                // omita la lectura silenciosa contra /ProveedoresSet: el codigo viene del
                // propio dialog (resultado del backend), asi que ya esta validado y un
                // segundo fetch solo introduciria latencia.
                oRowSel.__skipProveedorValidation = true;
                var oFakeMainInput = {
                    getBindingContext: function () {
                        return oTableModel.getContext(sPath);
                    },
                    setValueState: function () { return this; },
                    setValueStateText: function () { return this; }
                };
                this.onEditableRowFieldChange({
                    getSource: function () { return oFakeMainInput; }
                });
                return;
            }
        },

        //  Se cierra el dialog de Busqueda de Proveedores sin aplicar cambios.
        onBusquedaProveedoresCerrar: function () {
            if (!this._pBusquedaProveedoresDialog) return;
            this._pBusquedaProveedoresDialog.then(function (oDialog) {
                if (oDialog && oDialog.isOpen()) {
                    oDialog.close();
                }
            });
        },

        //   Se reorganizan los hijos del nodo raíz agrupándolos por el valor
        // del campo AGRUP. Se insertan filas de totales no editables al inicio
        // de cada grupo y se mantienen el header y las filas editables en su lugar.
        _reorganizeByAgrupador: function (oRootRow) {
            if (!oRootRow || !Array.isArray(oRootRow.children)) return;

            //   Header: siempre arriba, sin alterar.
            const aHeader = oRootRow.children.filter(function (c) {
                return c.__isHeader === true;
            });

       
            const aEditablesNoAgrup = oRootRow.children.filter(function (c) {
                return c.__isMainEditable === true && !(c.AGRUP || "").trim();
            });

            //   Todo lo demás a agrupar: nietos + editables CON AGRUP.
            // Se excluyen header, agrupadorTotal y el main editable sin AGRUP (que se
            //   ha capturado arriba en aEditablesNoAgrup).
            const aToGroup = oRootRow.children.filter(function (c) {
                return (
                    c.__isCustom === true &&
                    c.__isHeader !== true &&
                    c.__isAgrupadorTotal !== true &&
                    !(c.__isMainEditable === true && !(c.AGRUP || "").trim())
                );
            });
            //    

            console.log("[Reorg] aHeader:", aHeader.length,
                "| editablesSinAgrup:", aEditablesNoAgrup.length,
                "| aAgrupar:", aToGroup.length);

            //   Si no hay nada que agrupar no se hace nada.
            if (aToGroup.length === 0) {
                console.warn("[Reorg] No se ha encontrado ninguna fila con AGRUP; se aborta.");
                return;
            }

            const mGroups = {};
            const aOrder = [];
            const aSinAgrup = []; //   Filas sin AGRUP que NO son editables puras

            aToGroup.forEach(function (oFila) {
                const sAgrup = (oFila.AGRUP || "").trim();
                if (!sAgrup) {
                    aSinAgrup.push(oFila);
                    return;
                }
                if (!mGroups[sAgrup]) {
                    mGroups[sAgrup] = [];
                    aOrder.push(sAgrup);
                }
                mGroups[sAgrup].push(oFila);
            });

            aOrder.sort(function (a, b) {
                const nA = parseFloat(a);
                const nB = parseFloat(b);
                if (!isNaN(nA) && !isNaN(nB)) return nA - nB;
                return a.localeCompare(b);
            });

            console.log("[Reorg] Grupos:", aOrder);

            //   Orden final: header, editables sin AGRUP, [fila gris + miembros] y luego las que carecen de AGRUP
            const aNew = [];
            aHeader.forEach(function (h) { aNew.push(h); });
            aEditablesNoAgrup.forEach(function (e) { aNew.push(e); });

            //   Se captura la referencia al controlador en una variable
            // local porque dentro del forEach con function(){} clasica `this` no
            // apunta al controlador (es undefined en strict mode) y rompia la
            // llamada a getTranslatedText en la etiqueta "Total Grupo".  
            var that = this;
            //  
            aOrder.forEach(function (sAgrup) {
                aNew.push({
                    __isCustom: true,
                    __isAgrupadorTotal: true,
                    __agrupadorName: sAgrup,
                    cabecera: false, expandible: false, isGroup: false, padre: false,
                    PhPspnr: sAgrup,
                    AGRUP: sAgrup,
                    //   Se traduce la etiqueta "Total Grupo: X" via i18n con placeholder {0}.  
                    Post1: that.getTranslatedText("totalGrupoLabel", [sAgrup]),  //   Texto visible en la columna Descripción
                    //  
                    AmoEje: "", AmoEjeAjus: "", AmoEjeReal: "",
                    AmoPen: "", AmoTot: "", Tipo: "", PenPlan: "",
                    Proveedor: "", FEE: "", NMES: "", Otros: "",
                    children: []
                });
                mGroups[sAgrup].forEach(function (n) { aNew.push(n); });
            });

            aSinAgrup.forEach(function (n) { aNew.push(n); });

            oRootRow.children = aNew;
        },

        onAgrupadorButtonPress: function (oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext(this.tableModelName);
            if (!oContext) return;

            const sHeaderPath = oContext.getPath();
            const sRootPath = sHeaderPath.replace(/\/children\/\d+$/, "");
            const oModel = this.getView().getModel(this.tableModelName);
            const oRootRow = oModel.getProperty(sRootPath);
            const oHeaderRow = oModel.getProperty(sHeaderPath);
            if (!oRootRow || !oHeaderRow) return;

            const bWasActive = oHeaderRow.__agrupadorActive === true;

            if (bWasActive) {
                //   Se apaga: se eliminan todas las filas grises de grupo
                // y se deja el orden actual sin alterar.
                oHeaderRow.__agrupadorActive = false;
                oRootRow.children = oRootRow.children.filter(function (c) {
                    return c.__isAgrupadorTotal !== true;
                });
                          console.log("[Agrupador] Modo OFF: se han eliminado las filas grises.");
            } else {
                //   Se enciende: se limpian los posibles totales obsoletos y se
                // reorganiza desde cero con los valores AGRUP actuales.
                oHeaderRow.__agrupadorActive = true;
                oRootRow.children = oRootRow.children.filter(function (c) {
                    return c.__isAgrupadorTotal !== true;
                });
                this._reorganizeByAgrupador(oRootRow);
                              console.log("[Agrupador] Modo ON: se han creado los grupos.");
            }

            oModel.setProperty(sHeaderPath, oHeaderRow);
            oModel.setProperty(sRootPath, oRootRow);
            oModel.refresh(true);

            const oTable = this.getControlTable();
            if (oTable) {
                const fnExpand = function () {
                    if (fnExpand._fired) return;
                    fnExpand._fired = true;
                    this._expandFullBlock(oTable, sRootPath, function () {
                        this._highlightSinProveedor(oTable);
                        this._applyBlockBorder(oTable);
                        this._updateCustomColsVisibility();
                    }.bind(this));
                }.bind(this);
                oTable.attachEventOnce("rowsUpdated", fnExpand);
                setTimeout(fnExpand, 150);
            }
        },
        //   Se invoca al change del input AGRUP de una fila editable o nieto.
        // Si el valor cambia, la fila abandona el grupo actual y se reubica
        // en el grupo correcto (o al final si el nuevo AGRUP aún no existe).
        onAgrupadorFieldChange: function (oEvent) {
            if (this._bAgrupadorChanging) return;

            const oInput = oEvent.getSource();
            const oContext = oInput.getBindingContext(this.tableModelName);
            if (!oContext) return;

            const oRow = oContext.getObject();
            if (!oRow.__isCustom || oRow.__isHeader || oRow.__isAgrupadorTotal) return;

            const sPath = oContext.getPath();
            const sParentPath = sPath.replace(/\/children\/\d+$/, "");
            const oModel = this.getView().getModel(this.tableModelName);
            const oRootRow = oModel.getProperty(sParentPath);
            if (!oRootRow || !Array.isArray(oRootRow.children)) return;

         
            var bIsDesgloseSavableMV = oRow && oRow.__isCustom === true
                && (oRow.__isNieto === true || oRow.__isMainEditable === true)
                && (this._pestana === "Corrientes" || this._pestana === "Externos");
            if (bIsDesgloseSavableMV) {
                var oPayloadRowMV = this._sanitizeRowForBackend(oRow);
                this._enviarFilaAlBackend(oContext, oPayloadRowMV, "Agrup");
            }
            //    

            //   Si el modo agrupador no está activo no se hace nada de la reorganizacion.
            const oHeaderRow = oRootRow.children.find(function (c) { return c.__isHeader === true; });
            const bActive = oHeaderRow && oHeaderRow.__agrupadorActive === true;
            if (!bActive) return;

            this._bAgrupadorChanging = true;

            try {
                //   Se limpian los totales obsoletos y se reorganiza desde cero,
                // exactamente como hace el botón. El valor AGRUP modificado
                // ya está actualizado en el modelo a través del binding, por lo que
                // _reorganizeByAgrupador leerá directamente el nuevo valor.
                oRootRow.children = oRootRow.children.filter(function (c) {
                    return c.__isAgrupadorTotal !== true;
                });

                this._reorganizeByAgrupador(oRootRow);

                oModel.setProperty(sParentPath, oRootRow);
                oModel.refresh(true);

            } finally {
                this._bAgrupadorChanging = false;
            }

            const oTable = this.getControlTable();
            if (oTable) {
                const fnExpand = function () {
                    if (fnExpand._fired) return;
                    fnExpand._fired = true;
                    this._expandFullBlock(oTable, sParentPath, function () {
                        this._highlightSinProveedor(oTable);
                        this._applyBlockBorder(oTable);
                        this._updateCustomColsVisibility();
                    }.bind(this));
                }.bind(this);
                oTable.attachEventOnce("rowsUpdated", fnExpand);
                setTimeout(fnExpand, 150);
            }
        },
        //   Devuelve el índice de inserción para filas NO editables,
        // es decir, justo tras el header y tras todas las filas editables existentes.
        // Las editables permanecen siempre arriba, bajo el header.
        _findInsertAfterEditables: function (aChildren) {
            let iPos = 0;
            //   Se salta el header si está presente.
            if (aChildren[iPos] && aChildren[iPos].__isHeader) iPos++;
            //   Se saltan solo las filas de input principal (__isMainEditable).
            // Los nietos también tienen __isEditable=true por _cloneEditableRow,
            // pero NO deben saltarse: el nuevo proveedor debe quedar antes que ellos
            // para aparecer como primero del listado.
            while (iPos < aChildren.length && aChildren[iPos].__isMainEditable === true) {
                iPos++;
            }
            return iPos;
        },
        //   Se recorre el modelo de la tabla y se actualiza el flag __hasProviderRows
        // en todas las filas nieto cuyo proveedor tenga al menos una fila en el panel.
        // Se invoca tras cada operacion que modifica _mProveedorRows.
        _syncProviderRowFlags: function (oRootRow) {
            if (!oRootRow || !Array.isArray(oRootRow.children)) return;

            oRootRow.children.forEach(function (oChild) {
                if (oChild.__isNieto === true && oChild.Proveedor) {
                    const sProveedor = oChild.Proveedor.trim();
                    const aRows = (this._mProveedorRows && this._mProveedorRows[sProveedor]) || [];
                    oChild.__hasProviderRows = aRows.length > 0;
                }
                //   Se aplica recursivamente a los hijos de cada nodo.
                this._syncProviderRowFlags(oChild);
            }.bind(this));
        },
        //   Se verifica si todos los campos relevantes de una fila editable estan vacios.
        // Solo cuando todos los campos esten sin valor se considera la fila eliminable.
        // El campo Proveedor se evalua fuera de esta funcion porque actua como disparador
        // del change, por lo que aqui se comprueba el resto del contexto de la fila.  
        _isRowEmpty: function (oRow) {
            var aCampos = [
                "Post1", "AmoEje", "AmoEjeAjus", "AmoEjeReal",
                "AmoPen", "AmoTot", "PenPlan", "FEE",
                "FINI", "FFIN", "NMES", "Otros",
                "AGRUP", "DESCRIP", "months",
                "_linDateFrom", "_linDateTo"
            ];
            return aCampos.every(function (sCampo) {
                var sVal = (oRow[sCampo] !== undefined && oRow[sCampo] !== null)
                    ? oRow[sCampo].toString().trim()
                    : "";
                //   Se excluyen tambien el valor por defecto de Tipo (MAN) y el cero numerico.  
                return sVal === "" || sVal === "MAN" || sVal === "0";
            });
        },
         exportarVistaCapitulo: function () {
            try {
                //     Se valida la disponibilidad de la librería XLSX (xlsx-js-style) cargada vía CDN en index.html
                if (typeof window.XLSX === "undefined") {
                    sap.m.MessageBox.error(this.getTranslatedText("exportErrorNoLibrary"));
                    return;
                }
                //     Se localiza la TreeTable principal del capítulo via el id declarado por cada controlador
                const sTableId = typeof this.getCustomTableId === "function" ? this.getCustomTableId() : null;
                const oTable = sTableId ? this.byId(sTableId) : null;
                if (!oTable) {
                    sap.m.MessageBox.error(this.getTranslatedText("exportErrorNoTable"));
                    return;
                }
                //     Se filtran las columnas visibles (necesario para localizar los totales anuales y Resto)
                const aVisibleColumns = oTable.getColumns().filter(function (oCol) {
                    return oCol.getVisible();
                });
                if (aVisibleColumns.length === 0) {
                    sap.m.MessageBox.error(this.getTranslatedText("exportErrorNoTable"));
                    return;
                }
                //     Se obtienen las columnas estáticas del capítulo activo (sobrescribible vía _getStaticExportColumns)
                const aStaticColumnsConfig = this._getStaticExportColumns();
                              const oVisibleColumnModel = this.getView().getModel("visibleColumn");
                const bAjustesActive = oVisibleColumnModel && oVisibleColumnModel.getProperty("/visible") === true;
                if (bAjustesActive) {
                    const iAmoEjeIdx = aStaticColumnsConfig.findIndex(function (oCfg) {
                        return oCfg && oCfg.path === "AmoEje";
                    });
                    const aAjustesCols = [
                        { header: "Coste Ejec. Ajustado", path: "AmoEjeAjus" },
                        { header: "Coste Ejec. Real", path: "AmoEjeReal" }
                    ];
                    if (iAmoEjeIdx > -1) {
                        aStaticColumnsConfig.splice(iAmoEjeIdx + 1, 0, aAjustesCols[0], aAjustesCols[1]);
                    } else {
                        aStaticColumnsConfig.push(aAjustesCols[0], aAjustesCols[1]);
                    }
                }
                //     Se recogen los totales anuales, la columna Resto y la columna Ejercicios anteriores
                //   (si está visible por el checkbox correspondiente) desde las visibles para reconstruir
                //   la estructura completa de meses (12 por año), totales, Ejercicios anteriores y Resto.
                const aEjecutadosCols = aVisibleColumns.filter(function (oCol) {
                    return typeof oCol.data === "function" && oCol.data("ejecutadosColumn") === true;
                });
                const aYearCols = aVisibleColumns.filter(function (oCol) {
                    return typeof oCol.data === "function" && oCol.data("dynamicYear") === true;
                });
                const oRestoCol = aVisibleColumns.find(function (oCol) {
                    return typeof oCol.data === "function" && oCol.data("restoColumn") === true;
                });
                //     Etiquetas de mes abreviadas localizadas al idioma activo de UI5 — el año se
                //   concatena en formato 4 dígitos. Antes se usaba un array hardcodeado en español, por
                //   lo que las cabeceras de mes del export no se traducían al cambiar de idioma. Se usa
                //   el mismo DateFormat ("MMM") que las cabeceras de columna de la tabla (ver
                //   createDynamicYearColumns) para que se localicen automáticamente a EN/FR.
                const oMonthFormat = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "MMM" });
                const aMonthLabels = [];
                for (let iMm = 0; iMm < 12; iMm++) {
                    aMonthLabels.push(oMonthFormat.format(new Date(2000, iMm, 1)));
                }
                const aDynamicHeaders = [];
                const aDynamicPaths = [];
                //     Columna(s) Ejercicios anteriores al principio del bloque dinámico (si el checkbox está activo)
                for (let iE = 0; iE < aEjecutadosCols.length; iE++) {
                    const oEjeCol = aEjecutadosCols[iE];
                    aDynamicHeaders.push(this._extractColumnHeader(oEjeCol) || "Ejercicios anteriores");
                    aDynamicPaths.push(this._getColumnExportPath(oEjeCol));
                }
                for (let iY = 0; iY < aYearCols.length; iY++) {
                    const oYearCol = aYearCols[iY];
                    const iYear = oYearCol.data("year");
                    const sSubFijo = oYearCol.data("subFijoYear");
                    if (!sSubFijo) {
                        continue;
                    }
                    //     12 meses para este año: cabecera "<mes> <año>" + path "Val0<MM><subFijo>"
                    for (let iM = 0; iM < 12; iM++) {
                        const sMonthPad = (iM + 1 < 10 ? "0" : "") + (iM + 1);
                        aDynamicHeaders.push(aMonthLabels[iM] + " " + iYear);
                        aDynamicPaths.push("Val0" + sMonthPad + sSubFijo);
                    }
                    //     Total anual del año en curso: cabecera "<año>" + path "Total<subFijo>"
                    aDynamicHeaders.push(String(iYear));
                    aDynamicPaths.push("Total" + sSubFijo);
                }
                //     Columna Resto al final, si está visible en la tabla
                if (oRestoCol) {
                    //   Se traduce la cabecera "Resto" del export XLSX via i18n
                    // (clave colResto ya existente, mismo texto que la columna del UI).  
                    aDynamicHeaders.push(this.getTranslatedText("colResto"));
                    //  
                    aDynamicPaths.push("PlanResto");
                }
                //     Se construyen las cabeceras y los paths combinando estáticas + dinámicas
                const aHeaders = aStaticColumnsConfig.map(function (oCfg) {
                    return oCfg.header;
                }).concat(aDynamicHeaders);
                const aPaths = aStaticColumnsConfig.map(function (oCfg) {
                    return oCfg.path;
                }).concat(aDynamicPaths);
                //     Se aplana el árbol completo del modelo del capítulo activo (this.tableModelName).
                //   Se recogen en paralelo los índices de las filas "secundarias" (desgloses + filas de proveedor)
                //   para aplicarles luego un estilo visual diferenciado (fila más pequeña, fuente menor).
                const oModel = this.getView().getModel(this.tableModelName);
                const aTreeData = oModel ? (oModel.getProperty("/") || []) : [];
                const aRows = [];
                const aDesgloseIndexes = [];
                const aCabeceraIndexes = [];
                this._flattenForExport(aTreeData, aPaths, aRows, aDesgloseIndexes, aCabeceraIndexes);
                //     Se construye el array-of-arrays para SheetJS (cabeceras + filas) y se genera el workbook
                const aSheetData = [aHeaders].concat(aRows);
                const oWorkbook = window.XLSX.utils.book_new();
                const oWorksheet = window.XLSX.utils.aoa_to_sheet(aSheetData);
              
                const aVerticalSepCols = [];
                const iFixedCount = typeof oTable.getFixedColumnCount === "function" ? oTable.getFixedColumnCount() : 0;
                if (iFixedCount > 0) {
                    aVerticalSepCols.push(iFixedCount);
                }
                const bHasBorderRightPend = oTable.getColumns().some(function (oCol) {
                    return this._columnHasBorderRightPend(oCol);
                }.bind(this));
                if (bHasBorderRightPend) {
                    aVerticalSepCols.push(aStaticColumnsConfig.length);
                }
                //    
                this._applyVisualStylesToSheet(oWorksheet, aDesgloseIndexes, aCabeceraIndexes, aVerticalSepCols);
                //     Nombre de pestaña y de archivo: usa _pestana del capítulo activo, con fallback genérico
                //   Se traduce el nombre del capitulo activo para
                // que la pestanya y el archivo XLSX salgan en el idioma del
                // usuario (this._pestana se queda en castellano por compat
                // backend).  
                const sCapituloId = (typeof this._pestana === "string" && this._pestana) ? this._pestana : "Capitulo";
                const sCapitulo = this._translateCapituloName(sCapituloId);
                window.XLSX.utils.book_append_sheet(oWorkbook, oWorksheet, sCapitulo);
                const sFileName = this._buildExportFileName(sCapitulo);
                //  
                window.XLSX.writeFile(oWorkbook, sFileName);
                sap.m.MessageToast.show(this.getTranslatedText("exportSuccess"));
            } catch (oError) {
                //     Se notifica al usuario cualquier error inesperado durante la generación del XLSX
                sap.m.MessageBox.error(
                    this.getTranslatedText("exportErrorGeneric") + ": " + (oError && oError.message ? oError.message : String(oError))
                );
            }
        },

      
        _getStaticExportColumns: function () {
            const sTableId = typeof this.getCustomTableId === "function" ? this.getCustomTableId() : null;
            const oTable = sTableId ? this.byId(sTableId) : null;
            if (!oTable) {
                return [];
            }
            //   Se itera sobre TODAS las columnas en orden natural, incluyendo las del bloque
            //   proveedor aunque estén ocultas (_updateCustomColsVisibility las oculta cuando no hay filas
            //   custom; el usuario quiere verlas siempre en el export porque al cargarse datos del backend
            //   irán siempre pobladas). Las demás columnas ocultas se omiten igual que antes.
            const aAllColumns = oTable.getColumns();
            const aResult = [];
            for (let i = 0; i < aAllColumns.length; i++) {
                const oCol = aAllColumns[i];
                //     Se detiene la iteración en la primera columna dinámica: a partir de ahí se delega
                //   en la generación de meses/totales/Resto en exportarVistaCapitulo.
                if (this._isDynamicColumn(oCol)) {
                    break;
                }
                //     Filtro de visibilidad: se aceptan visibles o columnas marcadas como "siempre exportar"
                //   (bloque proveedor). El resto de ocultas se omite.
                if (!oCol.getVisible() && !this._isAlwaysExportColumn(oCol)) {
                    continue;
                }
                const sHeader = this._resolveColumnHeader(oCol);
                const sPath = this._getColumnExportPath(oCol);
                if (sPath) {
                    aResult.push({ header: sHeader, path: sPath });
                }
            }
          
            return aResult;
        },

        /**
         *   Devuelve true si el capítulo activo presenta la dualidad Inversión/Amortización y por tanto
         *   debe colorear las filas de Amortización ("A") o Provisión ("B") con el fondo azul #E8F0FE.
         *   Default false: no aplica para Corrientes/Externos (que no tienen esta dualidad).
         *   Sobrescribible por los controladores que sí la tienen (Inmovilizados, Anticipados, Diferidos).
         */
        _shouldShowAmortizationStyle: function () {
            return false;
        },

     
        _columnHasBorderRightPend: function (oCol) {
            if (!oCol) {
                return false;
            }
            const oLabel = typeof oCol.getLabel === "function" ? oCol.getLabel() : null;
            if (oLabel && this._controlHasStyleClass(oLabel, "borderRightPend")) {
                return true;
            }
            const oTemplate = typeof oCol.getTemplate === "function" ? oCol.getTemplate() : null;
            if (oTemplate && this._controlHasStyleClass(oTemplate, "borderRightPend")) {
                return true;
            }
            return false;
        },

        /**
         *   Comprueba recursivamente si un control o cualquiera de sus hijos (items/content) tiene
         *   añadida una determinada CSS class. Equivalente a un querySelector(".clase") sobre el subárbol
         *   de controles SAPUI5 antes de la renderización.
         */
        _controlHasStyleClass: function (oControl, sStyleClass) {
            if (!oControl) {
                return false;
            }
            if (typeof oControl.hasStyleClass === "function" && oControl.hasStyleClass(sStyleClass)) {
                return true;
            }
            const aAggregations = ["getItems", "getContent"];
            for (let i = 0; i < aAggregations.length; i++) {
                const fnGetter = oControl[aAggregations[i]];
                if (typeof fnGetter !== "function") {
                    continue;
                }
                const aChildren = fnGetter.call(oControl);
                if (!Array.isArray(aChildren)) {
                    continue;
                }
                for (let j = 0; j < aChildren.length; j++) {
                    if (this._controlHasStyleClass(aChildren[j], sStyleClass)) {
                        return true;
                    }
                }
            }
            return false;
        },

        /**
         *    Identifica si una columna es "dinámica" (mensual, total anual, Resto o Ejercicios anteriores).
         *   Se basa en custom data añadidos por createYearColumns/onCreateMonthsTable/_buildEjecutadosColumn.
         */
        _isDynamicColumn: function (oCol) {
            if (typeof oCol.data !== "function") {
                return false;
            }
            return oCol.data("dynamicMonth") === true
                || oCol.data("dynamicYear") === true
                || oCol.data("restoColumn") === true
                || oCol.data("ejecutadosColumn") === true;
        },

        _resolveColumnHeader: function (oCol) {
            const sFullId = typeof oCol.getId === "function" ? (oCol.getId() || "") : "";
            //     Los ids generados por SAPUI5 incluyen un prefijo de vista (es. "container-...--colTarifa")
            const sLocalId = sFullId.indexOf("--") > -1 ? sFullId.split("--").pop() : sFullId;
            const oIdToHeader = {
                "colProveedor": "Proveedor",
                "colTarifa": "Tarifa",
                "colFechaInicio": "Fecha Inicio",
                "colFechaFin": "Fecha Fin",
                "colNMeses": "Nº Meses",
                "colOtros": "Otros"
            };
            if (oIdToHeader[sLocalId]) {
                return oIdToHeader[sLocalId];
            }
            return this._extractColumnHeader(oCol) || "";
        },

        /**
         *     Identifica las columnas del bloque proveedor que deben aparecer siempre en el export
         *   aunque estén ocultas en el UI (_updateCustomColsVisibility las oculta cuando no hay filas custom,
         *   pero el usuario quiere verlas siempre en el Excel porque al traer datos del backend van a estar
         *   pobladas). Se identifica por el sufijo del id (estable independientemente del prefijo de vista).
         */
        _isAlwaysExportColumn: function (oCol) {
            if (!oCol || typeof oCol.getId !== "function") {
                return false;
            }
            const sFullId = oCol.getId() || "";
            const sLocalId = sFullId.indexOf("--") > -1 ? sFullId.split("--").pop() : sFullId;
            const aAlwaysIds = [
                "colProveedor", "colTarifa", "colFechaInicio",
                "colFechaFin", "colNMeses", "colOtros"
            ];
            return aAlwaysIds.indexOf(sLocalId) > -1;
        },

        /**
         *     Recupera el texto del label de una columna explorando recursivamente sus controles internos
         *   (Label/Title/Text dentro de VBox/HBox). Devuelve cadena vacía si no hay texto resoluble.
         */
        _extractColumnHeader: function (oColumn) {
            const oLabel = typeof oColumn.getLabel === "function" ? oColumn.getLabel() : null;
            if (!oLabel) {
                return "";
            }
            return this._findFirstText(oLabel);
        },

        /**
         *     Búsqueda recursiva del primer texto no vacío en la jerarquía de un control,
         *   inspeccionando text directo y las agregaciones habituales (items, content).
         */
        _findFirstText: function (oControl) {
            if (!oControl) {
                return "";
            }
            if (typeof oControl.getText === "function") {
                const sText = oControl.getText();
                if (sText) {
                    return sText;
                }
            }
            const aAggregations = ["getItems", "getContent"];
            for (let i = 0; i < aAggregations.length; i++) {
                const fnGetter = oControl[aAggregations[i]];
                if (typeof fnGetter !== "function") {
                    continue;
                }
                const aChildren = fnGetter.call(oControl);
                if (!Array.isArray(aChildren)) {
                    continue;
                }
                for (let j = 0; j < aChildren.length; j++) {
                    const sFound = this._findFirstText(aChildren[j]);
                    if (sFound) {
                        return sFound;
                    }
                }
            }
            return "";
        },

       
        _getColumnExportPath: function (oColumn) {
            if (typeof oColumn.data === "function") {
                const sExportPath = oColumn.data("exportPath");
                if (sExportPath) {
                    return sExportPath;
                }
                if (oColumn.data("restoColumn") === true) {
                    return "PlanResto";
                }
                if (oColumn.data("dynamicYear") === true) {
                    const sSubFijo = oColumn.data("subFijoYear");
                    if (sSubFijo) {
                        return "Total" + sSubFijo;
                    }
                }
            }
            const oTemplate = typeof oColumn.getTemplate === "function" ? oColumn.getTemplate() : null;
            if (oTemplate) {
                const sPath = this._findDataBindingPath(oTemplate);
                if (sPath) {
                    return sPath;
                }
            }
            const sFilterProperty = typeof oColumn.getFilterProperty === "function" ? oColumn.getFilterProperty() : "";
            if (sFilterProperty) {
                return sFilterProperty;
            }
            return null;
        },

        /**
         *   Busca recursivamente el primer binding de datos (text/value) sobre this.tableModelName.
         *   Soporta partes de binding como string ("modelo>campo") o como objeto ({model, path}).
         */
        _findDataBindingPath: function (oControl) {
            if (!oControl) {
                return null;
            }
            const aBindingProps = ["text", "value"];
            for (let i = 0; i < aBindingProps.length; i++) {
                if (typeof oControl.getBindingInfo !== "function") {
                    continue;
                }
                const oBindingInfo = oControl.getBindingInfo(aBindingProps[i]);
                if (!oBindingInfo) {
                    continue;
                }
                if (Array.isArray(oBindingInfo.parts) && oBindingInfo.parts.length > 0) {
                    const oFirstPart = oBindingInfo.parts[0];
                    let sPath = null;
                    let sModel = "";
                    if (typeof oFirstPart === "string") {
                        const iSep = oFirstPart.indexOf(">");
                        if (iSep > -1) {
                            sModel = oFirstPart.substring(0, iSep);
                            sPath = oFirstPart.substring(iSep + 1);
                        } else {
                            sPath = oFirstPart;
                        }
                    } else if (oFirstPart && typeof oFirstPart === "object") {
                        sModel = oFirstPart.model || "";
                        sPath = oFirstPart.path || null;
                    }
                    if (sPath && (!sModel || sModel === this.tableModelName)) {
                        return sPath;
                    }
                } else if (oBindingInfo.path) {
                    if (!oBindingInfo.model || oBindingInfo.model === this.tableModelName) {
                        return oBindingInfo.path;
                    }
                }
            }
            const aAggregationGetters = ["getItems", "getContent"];
            for (let i = 0; i < aAggregationGetters.length; i++) {
                const sFn = aAggregationGetters[i];
                if (typeof oControl[sFn] !== "function") {
                    continue;
                }
                const aChildren = oControl[sFn]();
                if (!Array.isArray(aChildren)) {
                    continue;
                }
                for (let j = 0; j < aChildren.length; j++) {
                    const sPath = this._findDataBindingPath(aChildren[j]);
                    if (sPath) {
                        return sPath;
                    }
                }
            }
            return null;
        },

        
        _coerceNumericValue: function (vValue) {
            if (vValue === null || vValue === undefined) {
                return "";
            }
            if (typeof vValue === "number") {
                return vValue;
            }
            if (typeof vValue !== "string") {
                return vValue;
            }
            const sTrimmed = vValue.trim();
            if (sTrimmed === "") {
                return "";
            }
            //     Formato JS estándar: 1234, 1234.56, 0.00000
            if (/^-?\d+(\.\d+)?$/.test(sTrimmed)) {
                const nEng = Number(sTrimmed);
                return isNaN(nEng) ? vValue : nEng;
            }
            //   Formato español con separador de miles (punto) y decimales opcionales (coma): 1.234.567,89
            if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(sTrimmed)) {
                const nEsThousands = Number(sTrimmed.replace(/\./g, "").replace(",", "."));
                return isNaN(nEsThousands) ? vValue : nEsThousands;
            }
            //     Formato español sin separador de miles, solo decimales: 1234,56
            if (/^-?\d+,\d+$/.test(sTrimmed)) {
                const nEsDec = Number(sTrimmed.replace(",", "."));
                return isNaN(nEsDec) ? vValue : nEsDec;
            }
            return vValue;
        },

        _applyVisualStylesToSheet: function (oWorksheet, aDesgloseRowIndexes, aCabeceraRowIndexes, aVerticalSepCols) {
            if (!oWorksheet || !oWorksheet["!ref"] || !window.XLSX || !window.XLSX.utils) {
                return;
            }
            const XLSX = window.XLSX;
            const oRange = XLSX.utils.decode_range(oWorksheet["!ref"]);
            //     Sets rápidos para chequear pertenencia O(1) al iterar las filas
            const oDesgloseSet = {};
            if (Array.isArray(aDesgloseRowIndexes)) {
                for (let i = 0; i < aDesgloseRowIndexes.length; i++) {
                    oDesgloseSet[aDesgloseRowIndexes[i]] = true;
                }
            }
            const oCabeceraSet = {};
            if (Array.isArray(aCabeceraRowIndexes)) {
                for (let i = 0; i < aCabeceraRowIndexes.length; i++) {
                    oCabeceraSet[aCabeceraRowIndexes[i]] = true;
                }
            }
            const sNumFmt = "#,##0.00";
            //    Se dibujan dos clases de líneas separadoras en el cuerpo de la hoja, replicando
            //   las líneas naranjas del UI del TreeTable pero con borde negro fino estándar de Excel:
            //     - Una horizontal debajo de la primera fila de datos (la fila "D" / capítulo raíz).
            //     - Una o varias verticales en las columnas detectadas dinámicamente (clase CSS borderRightPend
            //       en el UI). El array aVerticalSepCols contiene índices ya en sistema de columnas del export.
            const iFirstDataRow = oRange.s.r + 1; // Fila justo después de la cabecera
            const oVerticalSepSet = {};
            if (Array.isArray(aVerticalSepCols)) {
                for (let i = 0; i < aVerticalSepCols.length; i++) {
                    const iCol = aVerticalSepCols[i];
                    if (typeof iCol === "number" && iCol > 0) {
                        oVerticalSepSet[oRange.s.c + iCol] = true;
                    }
                }
            }
            //    
            //     Se recorre toda la matriz y se asigna el estilo correspondiente celda a celda
            for (let R = oRange.s.r; R <= oRange.e.r; R++) {
                const bIsHeader = (R === oRange.s.r);
                const iDataIdx = R - oRange.s.r - 1;
                const bIsDesglose = !bIsHeader && oDesgloseSet[iDataIdx] === true;
                const bIsCabecera = !bIsHeader && oCabeceraSet[iDataIdx] === true;
                const bIsFirstDataRow = (R === iFirstDataRow);
                for (let C = oRange.s.c; C <= oRange.e.c; C++) {
                    const sAddr = XLSX.utils.encode_cell({ r: R, c: C });
                    const bNeedsVerticalBorder = oVerticalSepSet[C] === true;
                    let oCell = oWorksheet[sAddr];
                    if (!oCell) {
                        //     Sólo se crea la celda en blanco cuando va a recibir un estilo visible:
                        //   cabecera, fila cabecera/expandible, fila bajo el separador horizontal, o columna
                        //   bajo el separador vertical. Para el resto, se omite la celda (no hay nada que pintar).
                        if (bIsHeader || bIsCabecera || bIsFirstDataRow || bNeedsVerticalBorder) {
                            oCell = { t: "s", v: "" };
                            oWorksheet[sAddr] = oCell;
                        } else {
                            continue;
                        }
                        //    
                    }
                    let oStyle;
                    if (bIsHeader) {
                        //     Estilo cabecera: fondo naranja, negrita, centrado y borde inferior
                        oStyle = {
                            fill: { patternType: "solid", fgColor: { rgb: "FFC000" } },
                            font: { bold: true, sz: 11, color: { rgb: "000000" } },
                            alignment: { horizontal: "center", vertical: "center", wrapText: true },
                            border: {
                                top: { style: "thin", color: { rgb: "000000" } },
                                bottom: { style: "thin", color: { rgb: "000000" } }
                            }
                        };
                    } else if (bIsCabecera) {
                        //     Estilo fila Amortización/Provisión: fondo azul claro suave (#E8F0FE)
                        //   que replica la CSS class .rowVersionB del UI (style.css ln 1173).
                        oStyle = {
                            fill: { patternType: "solid", fgColor: { rgb: "E8F0FE" } },
                            font: { sz: 11, color: { rgb: "000000" } }
                        };
                    } else if (bIsDesglose) {
                        //     Estilo fila secundaria: fuente reducida, cursiva, color gris suave
                        oStyle = {
                            font: { sz: 9, italic: true, color: { rgb: "595959" } }
                        };
                    } else {
                        //     Estilo normal: tamaño estándar
                        oStyle = { font: { sz: 11 } };
                    }
                    //     Aplicación selectiva de las dos líneas separadoras (sólo en el cuerpo,
                    //   no en la cabecera que ya tiene su propio borde). Se respetan ambos bordes si la celda
                    //   está en la intersección (esquina inferior de la fila "D" y columna dinámica).
                    if (!bIsHeader && (bIsFirstDataRow || bNeedsVerticalBorder)) {
                        const oBorder = {};
                        if (bIsFirstDataRow) {
                            oBorder.bottom = { style: "thin", color: { rgb: "000000" } };
                        }
                        if (bNeedsVerticalBorder) {
                            oBorder.left = { style: "thin", color: { rgb: "000000" } };
                        }
                        oStyle.border = oBorder;
                    }
                    //    
                    //     Formato numérico para celdas Number — duplicado en z y s.numFmt para máxima compatibilidad
                    if (oCell.t === "n") {
                        oCell.z = sNumFmt;
                        oStyle.numFmt = sNumFmt;
                    }
                    oCell.s = oStyle;
                }
            }
            //     Alturas de fila: cabecera más alta para acoger labels en dos líneas, secundarias compactas
            const aRowsMeta = [];
            aRowsMeta[oRange.s.r] = { hpt: 24 };
            for (let i = 0; i < (aDesgloseRowIndexes || []).length; i++) {
                const iSheetRow = oRange.s.r + 1 + aDesgloseRowIndexes[i];
                aRowsMeta[iSheetRow] = { hpt: 13 };
            }
            oWorksheet["!rows"] = aRowsMeta;
            //     Anchos de columna: la primera (Operación) y el resto en wch (unidad de caracteres);
            //   la segunda (Descripción) se fija en píxeles (wpx: 255) para que entren textos largos
            //   habituales en Anticipados/Inmovilizados/Diferidos (p.ej. "Formalización contrato principal").
            const aColsMeta = [];
            for (let C = oRange.s.c; C <= oRange.e.c; C++) {
                if (C === 0) {
                    aColsMeta[C] = { wch: 16 };
                } else if (C === 1) {
                    aColsMeta[C] = { wpx: 200 };
                } else {
                    aColsMeta[C] = { wch: 12 };
                }
            }
            oWorksheet["!cols"] = aColsMeta;
            //    
        },

      
        _flattenForExport: function (aNodes, aPaths, aRowsOut, aDesgloseIndexesOut, aCabeceraIndexesOut) {
            if (!Array.isArray(aNodes)) {
                return;
            }
            for (let i = 0; i < aNodes.length; i++) {
                const oNode = aNodes[i];
                if (!oNode) {
                    continue;
                }
                //     Se identifican las filas técnicas auxiliares del UI que no deben aparecer en el export
                const bSkipNode = oNode.__isHeader === true
                    || oNode.__isSinProveedor === true
                    || oNode.__isAgrupadorBlock === true
                    || oNode.__isAgrupadorTotal === true;
                if (!bSkipNode) {
                    //     Se construye la fila proyectando cada path a través de _resolveCellValue
                    const aRow = aPaths.map(function (sPath) {
                        if (!sPath) {
                            return "";
                        }
                        return this._resolveCellValue(oNode, sPath);
                    }.bind(this));
                    aRowsOut.push(aRow);
                    const iAddedIdx = aRowsOut.length - 1;
                    //     Se registra el índice si la fila es "secundaria" (desglose, editable o custom)
                    if (Array.isArray(aDesgloseIndexesOut)
                        && (oNode.isLevel3 === true || oNode.__isEditable === true || oNode.__isCustom === true)) {
                        aDesgloseIndexesOut.push(iAddedIdx);
                    }
                    //     Se registra el índice si la fila es de Amortización ("A") o Provisión ("B") para
                    //   aplicar el fondo azul suave que replica la CSS class .rowVersionB del UI
                    //   (background-color: #E8F0FE en style.css). Sólo se activa para los capítulos que tienen
                    //   la dualidad Inversión/Amortización (Inmovilizados, Anticipados, Diferidos) mediante el
                    //   método _shouldShowAmortizationStyle() (sobrescribible por capítulo). En Corrientes y
                    //   Externos el método devuelve false (default), evitando teñir las filas indebidamente.
                    if (Array.isArray(aCabeceraIndexesOut)
                        && this._shouldShowAmortizationStyle()
                        && (oNode.TipoInd === "A" || oNode.TipoInd === "B")) {
                        aCabeceraIndexesOut.push(iAddedIdx);
                    }
                }
                //     Se procesan recursivamente los hijos (children) preservando el orden del árbol
                if (Array.isArray(oNode.children) && oNode.children.length > 0) {
                    this._flattenForExport(oNode.children, aPaths, aRowsOut, aDesgloseIndexesOut, aCabeceraIndexesOut);
                }
            }
        },

      
        _resolveCellValue: function (oNode, sPath) {
            //   Overrides específicos para las filas editables del bloque de proveedor
            if (oNode && oNode.__isEditable === true) {
                if (sPath === "PhPspnr") {
                    return this._coerceNumericValue(oNode.AGRUP);
                }
                if (sPath === "Post1") {
                    return this._coerceNumericValue(oNode.DESCRIP);
                }
            }
            if (sPath === "Tipo") {
                return this._resolveRepartoCellValue(oNode);
            }
            if (sPath === "TipoInd") {
                return this._resolveTipoIndCellValue(oNode);
            }
            return this._coerceNumericValue(oNode[sPath]);
        },

       
        _resolveRepartoCellValue: function (oNode) {
            const oTipoLabels = {
                "MAN": "Manual",
                "LIN": "Lineal",
                "OEO": "OEO",
                "INF": "Inflación",
                "PCT": "Porcentaje"
            };
            const sTipo = oNode && typeof oNode.Tipo === "string" ? oNode.Tipo : "";
            if (sTipo && oTipoLabels[sTipo]) {
                return oTipoLabels[sTipo];
            }
            return "Manual";
        },

      
        _resolveTipoIndCellValue: function (oNode) {
            const oLabels = {
                "I": "Inversión",
                "A": "Amortización",
                "P": "Aplicación",
                "B": "Provisión"
            };
            const sTipoInd = oNode && typeof oNode.TipoInd === "string" ? oNode.TipoInd : "";
            if (sTipoInd && oLabels[sTipoInd]) {
                return oLabels[sTipoInd];
            }
            return sTipoInd || "";
        },

        /**
         *   Se construye un nombre de archivo descriptivo con sello temporal:
         *   "Vista_<Capitulo>_YYYYMMDD_HHmm.xlsx".
         */
        _buildExportFileName: function (sCapitulo) {
            const oNow = new Date();
            const fnPad = function (iValue) {
                return String(iValue).padStart(2, "0");
            };
            const sDate = oNow.getFullYear() + fnPad(oNow.getMonth() + 1) + fnPad(oNow.getDate());
            const sTime = fnPad(oNow.getHours()) + fnPad(oNow.getMinutes());
            //   Se traduce el prefijo "Vista" del nombre de archivo via i18n.  
            return this.getTranslatedText("exportFileNameVista") + "_" + sCapitulo + "_" + sDate + "_" + sTime + ".xlsx";
            //  
        },
      exportarPlantillaCarga: function (sScope, mViews) {
            try {
                if (typeof window.XLSX === "undefined") {
                    sap.m.MessageBox.error(this.getTranslatedText("exportErrorNoLibrary"));
                    return;
                }
                const aMonths = this._getPlantillaMonths(sScope);
                const oWorkbook = window.XLSX.utils.book_new();
                //     Resumen primero, para que se abra como pestaña activa al abrir el archivo
                this._appendResumenSheetToWorkbook(oWorkbook);
                //     Capítulos en el orden definido por el spec
                //     Orden cronológico de las pestañas del spec. {key} es la clave interna usada
                //   en _mViews del Main controller (ojo: inmovilizados → "inmov"); {sheetName} es el nombre
                //   que se muestra como pestaña en el XLSX (capitalizado, sin truncar a 31 chars).
                //   Se traducen los nombres de las pestanyas del XLSX
                // usando las claves i18n ya existentes para que coincidan con los
                // tabs visibles en la UI segun el idioma activo.  
                const aCapitulos = [
                    { key: "anticipados", sheetName: this.getTranslatedText("anticipados") },
                    { key: "inmov", sheetName: this.getTranslatedText("inmovilizados") },
                    { key: "corrientes", sheetName: this.getTranslatedText("corrientes") },
                    { key: "diferidos", sheetName: this.getTranslatedText("diferidos") },
                    { key: "externos", sheetName: this.getTranslatedText("externos") }
                ];
                //  
                for (let i = 0; i < aCapitulos.length; i++) {
                    this._appendChapterSheetToWorkbook(oWorkbook, aCapitulos[i], aMonths, mViews);
                }
                //    
                const sFileName = this._buildPlantillaFileName();
                window.XLSX.writeFile(oWorkbook, sFileName);
                sap.m.MessageToast.show(this.getTranslatedText("exportSuccess"));
            } catch (oError) {
                sap.m.MessageBox.error(
                    this.getTranslatedText("exportErrorGeneric") + ": " + (oError && oError.message ? oError.message : String(oError))
                );
            }
        },

     
                _getPlantillaMonths: function (sScope) {
            const aMonthLabels = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
            const aResult = [];
            if (sScope === "all") {
               
                const oAppData = this.getGlobalModel("appData").getData();
                const sIni = oAppData.Freal || (oAppData.tramo && oAppData.tramo.Freal) || "";
                const sFin = oAppData.Frealfinobra || (oAppData.tramo && oAppData.tramo.Frealfinobra) || "";
                     let oIni = sIni ? this._parseODataDate(sIni) : null;
                const oFin = sFin ? this._parseODataDate(sFin) : null;
                //     Se replica el ajuste de fecha efectiva que aplica la TreeTable al abrir un anyo: si el dia de Freal no coincide con el de Frealsist se suma un dia a Freal antes de extraer el mes inicial. Asi el export arranca en el mismo mes que la columna mensual de la UI (en obras con Freal=ultimo dia del mes, el mes real de inicio es el siguiente). Misma logica que en BaseController._effectiveDate.
                if (oIni && !isNaN(oIni.getTime())) {
                    const sFrealsist = oAppData.Frealsist || (oAppData.tramo && oAppData.tramo.Frealsist) || "";
                    const oFrealsist = sFrealsist ? this._parseODataDate(sFrealsist) : null;
                    const bSameDay = oFrealsist && !isNaN(oFrealsist.getTime())
                        && oIni.getDate() === oFrealsist.getDate();
                    if (!bSameDay) {
                        const oIniAdjusted = new Date(oIni);
                        oIniAdjusted.setDate(oIniAdjusted.getDate() + 1);
                        oIni = oIniAdjusted;
                    }
                }
                if (!oIni || isNaN(oIni.getTime()) || !oFin || isNaN(oFin.getTime())) {
                    //   Fallback: si faltan fechas, se devuelven los 12 meses del año en curso de Freal o
                    //   del año actual del sistema como último recurso.
                    const iFallbackYear = (oIni && !isNaN(oIni.getTime()))
                        ? oIni.getFullYear()
                        : new Date().getFullYear();
                    for (let m = 0; m < 12; m++) {
                        aResult.push({ year: iFallbackYear, month: m + 1, label: aMonthLabels[m] + " " + iFallbackYear });
                    }
                    return aResult;
                }
                const iStartYear = oIni.getFullYear();
                const iStartMonth = oIni.getMonth(); // 0-based
                const iEndYear = oFin.getFullYear();
                const iEndMonth = oFin.getMonth(); // 0-based, mes incluido
                let iY = iStartYear;
                let iM = iStartMonth;
                while (iY < iEndYear || (iY === iEndYear && iM <= iEndMonth)) {
                    aResult.push({ year: iY, month: iM + 1, label: aMonthLabels[iM] + " " + iY });
                    iM++;
                    if (iM > 11) { iM = 0; iY++; }
                }
                return aResult;
                //    
            }
            //    se cambia el scope "years" para devolver las columnas mensuales (no los totales anuales) de los 2 anyos visibles, arrancando en el MISMO mes inicial que muestra la TreeTable. Antes se emitia { year, isYearTotal: true } y _flattenPlantillaRows leia "Total<subFijo>", produciendo solo 2 columnas con el agregado anual; el cambio mantiene la rama isYearTotal viva en _flattenPlantillaRows como dead code inocuo por si en el futuro se reutiliza desde otro scope. Para el mes inicial se replica la regla de _effectiveDate (BaseController ~6106): si el dia de Freal no coincide con el de Frealsist se suma un dia a Freal antes de extraer mes/anyo, asi el primer mes del export coincide con el primer mes mensual visible en la TreeTable (en obras con Freal=ultimo dia del mes el mes real arranca en el siguiente). El cierre se fija en diciembre de (iStartYear + 1) para limitar el alcance a 2 anyos naturales coincidiendo con el sentido funcional de la opcion  
            const oAppData = this.getGlobalModel("appData").getData();
            const sFreal = oAppData.Freal || (oAppData.tramo && oAppData.tramo.Freal) || "";
            let oIni = sFreal ? this._parseODataDate(sFreal) : null;
            if (oIni && !isNaN(oIni.getTime())) {
                const sFrealsist = oAppData.Frealsist || (oAppData.tramo && oAppData.tramo.Frealsist) || "";
                const oFrealsist = sFrealsist ? this._parseODataDate(sFrealsist) : null;
                const bSameDay = oFrealsist && !isNaN(oFrealsist.getTime())
                    && oIni.getDate() === oFrealsist.getDate();
                if (!bSameDay) {
                    const oIniAdjusted = new Date(oIni);
                    oIniAdjusted.setDate(oIniAdjusted.getDate() + 1);
                    oIni = oIniAdjusted;
                }
            }
            if (!oIni || isNaN(oIni.getTime())) {
                //   Fallback: si no hay Freal valido se emiten los 12 meses del anyo actual y del siguiente arrancando en enero, evitando devolver array vacio.
                const iFallback = new Date().getFullYear();
                for (let iY = iFallback; iY < iFallback + 2; iY++) {
                    for (let iM = 0; iM < 12; iM++) {
                        aResult.push({ year: iY, month: iM + 1, label: aMonthLabels[iM] + " " + iY });
                    }
                }
                return aResult;
            }
            const iStartYear = oIni.getFullYear();
            const iStartMonth = oIni.getMonth(); // 0-based
            const iEndYear = iStartYear + 1;
            let iY = iStartYear;
            let iM = iStartMonth;
            while (iY < iEndYear || (iY === iEndYear && iM <= 11)) {
                aResult.push({ year: iY, month: iM + 1, label: aMonthLabels[iM] + " " + iY });
                iM++;
                if (iM > 11) { iM = 0; iY++; }
            }
            return aResult;
            //    
        },
        /**
         *   Construye y añade al workbook la hoja "Resumen" con los 6 campos clave del tramo
         *   y la versión activa (replica el screenshot del spec apartado 5.9). Los valores se leen
         *   de appData (tramo + Freal/Frealiniobra/Frealfinobra) y del modelo de versiones.
         */
        _appendResumenSheetToWorkbook: function (oWorkbook) {
            const oAppData = this.getGlobalModel("appData").getData();
            const oTramo = oAppData.tramo || {};
            const sNombreObra = (oAppData.userData && oAppData.userData.descriptionNode) || "";
            const sTramo = oTramo.ProyectoExt || "";
            const sFechaReales = this._formatPlantillaDate(oAppData.Freal || oTramo.Freal);
            const sFechaInicio = this._formatPlantillaDate(oAppData.Frealiniobra || oTramo.Frealiniobra);
            const sFechaFin = this._formatPlantillaDate(oAppData.Frealfinobra || oTramo.Frealfinobra);
            //     Versión activa: se busca el item con Activo === "X" en NavLtVersiones y se formatea
            //   con formatTextoVersion (mismo formatter que el ComboBox del header).
            let sVersion = "";
            const aVersiones = (oAppData.NavLtVersiones || []);
            const oVersionActiva = aVersiones.find(function (v) { return v && v.Activo === "X"; });
            if (oVersionActiva && typeof this.formatTextoVersion === "function") {
                sVersion = this.formatTextoVersion(oVersionActiva.Version) || oVersionActiva.Version || "";
            } else if (oVersionActiva) {
                sVersion = oVersionActiva.Version || "";
            }
            //  AOA: fila 1 = título "COSTES INDIRECTOS", filas 2-7 = pares etiqueta/valor
            const aData = [
                [this.getTranslatedText("plantillaCargaResumenTitle"), ""],
                [this.getTranslatedText("plantillaCargaResumenNombreObra"), sNombreObra],
                [this.getTranslatedText("plantillaCargaResumenTramo"), sTramo],
                [this.getTranslatedText("plantillaCargaResumenFechaReales"), sFechaReales],
                [this.getTranslatedText("plantillaCargaResumenFechaInicio"), sFechaInicio],
                [this.getTranslatedText("plantillaCargaResumenFechaFin"), sFechaFin],
                [this.getTranslatedText("plantillaCargaResumenVersion"), sVersion]
            ];
            const oSheet = window.XLSX.utils.aoa_to_sheet(aData);
            //     Estilo: título en negrita sobre fondo amarillo claro; etiquetas en negrita
            this._applyResumenStyles(oSheet);
            //     Anchos cómodos para que entren etiquetas y valores (Tunel/Tramo/fechas)
            oSheet["!cols"] = [{ wch: 20 }, { wch: 38 }];
            window.XLSX.utils.book_append_sheet(oWorkbook, oSheet, this.getTranslatedText("plantillaCargaSheetResumen"));
        },

        /**
         *    Aplica estilos a la hoja Resumen: fila 1 (título) con fondo amarillo claro + bold;
         *   columna A (etiquetas) en negrita. Replica visualmente el screenshot del spec.
         */
               _applyResumenStyles: function (oSheet) {
            if (!oSheet || !oSheet["!ref"] || !window.XLSX || !window.XLSX.utils) {
                return;
            }
            const XLSX = window.XLSX;
            const oRange = XLSX.utils.decode_range(oSheet["!ref"]);
            for (let R = oRange.s.r; R <= oRange.e.r; R++) {
                for (let C = oRange.s.c; C <= oRange.e.c; C++) {
                    const sAddr = XLSX.utils.encode_cell({ r: R, c: C });
                    let oCell = oSheet[sAddr];
                    if (!oCell) {
                        oCell = { t: "s", v: "" };
                        oSheet[sAddr] = oCell;
                    }
                    if (R === 0) {
                        //     Título "COSTES INDIRECTOS": mismo naranja (#FFC000) + border top/bottom
                        //   negro fino que las cabeceras de las hojas de cada capítulo, para coherencia
                        //   visual entre pestañas.
                        oCell.s = {
                            fill: { patternType: "solid", fgColor: { rgb: "FFC000" } },
                            font: { bold: true, sz: 11 },
                            alignment: { horizontal: "left", vertical: "center" },
                            border: {
                                top: { style: "thin", color: { rgb: "000000" } },
                                bottom: { style: "thin", color: { rgb: "000000" } }
                            }
                        };
                    } else if (C === 0) {
                        //     Etiquetas (columna A): negrita
                        oCell.s = { font: { bold: true, sz: 11 } };
                    } else {
                        oCell.s = { font: { sz: 11 } };
                    }
                }
            }
        },

        /**
         *     Construye y añade la hoja de un capítulo concreto al workbook.
         *   Estructura: cabecera = columnas estáticas (operación, descripción, reparto, fechas, bloque
         *   proveedor según capítulo) + un mes por columna (Valxx<subFijo>). Datos: aplanado del modelo
         *   del controlador del capítulo (this._flattenForExport).
         *   Si el controlador no está inicializado (capítulo no visitado), se exporta sólo la cabecera.
         */
   _appendChapterSheetToWorkbook: function (oWorkbook, oChapter, aMonths, mViews) {
            const sKey = oChapter.key;
            const sSheetName = oChapter.sheetName;
            const oView = mViews && mViews[sKey];
            const oController = oView && typeof oView.getController === "function" ? oView.getController() : null;
            //     Las columnas estáticas se piden al CONTROLLER del capítulo via _getPlantillaStaticColumns()
            //   (overridable por cada controller). Si el controller no existe o no tiene el método (capítulo
             //   nunca visitado y precarga fallida), se cae al default del BaseController.
            const aStaticCols = (oController && typeof oController._getPlantillaStaticColumns === "function")
                ? oController._getPlantillaStaticColumns()
                : this._getPlantillaStaticColumns();
            //     Headers: estáticos + un mes por columna ("ene 2014", "feb 2014", ...)
            const aHeaders = aStaticCols.map(function (oCfg) { return oCfg.header; })
                .concat(aMonths.map(function (oM) { return oM.label; }));
            //     Paths para resolución de valores. Los meses usan "Val0MM" sin subfijo aquí — la
            //   resolución real (con el subfijo del año correspondiente) se hace por fila más abajo,
            //   porque cada año tiene subfijo distinto y el modelo guarda "Val0MMa1", "Val0MMa2", etc.
            const aStaticPaths = aStaticCols.map(function (oCfg) { return oCfg.path; });
            const aSheetData = [aHeaders];
            const aCabeceraIndexes = [];
            const aDesgloseIndexes = [];
            if (oController) {
                const sModelName = oController.tableModelName;
                const oModel = sModelName ? oController.getView().getModel(sModelName) : null;
                const aTreeData = oModel ? (oModel.getProperty("/") || []) : [];
                //     Mapeo año → subfijo desde las columnas dinámicas del TreeTable del capítulo. Permite
                //   resolver Val0<MM><subfijo> por celda mensual sin depender del orden visual de la UI.
                const oYearToSubfijo = this._buildYearToSubfijoMap(oController);
                const aRows = [];
                this._flattenPlantillaRows(oController, aTreeData, aStaticPaths, aMonths, oYearToSubfijo, aRows, aCabeceraIndexes, aDesgloseIndexes);
                for (let i = 0; i < aRows.length; i++) {
                    aSheetData.push(aRows[i]);
                }
            }
            const oSheet = window.XLSX.utils.aoa_to_sheet(aSheetData);
            this._applyPlantillaChapterStyles(oSheet, aStaticCols.length, aCabeceraIndexes, aDesgloseIndexes);
            window.XLSX.utils.book_append_sheet(oWorkbook, oSheet, String(sSheetName || sKey).substring(0, 31));
        },

        /**
         *     Default de columnas estáticas para la pestaña de un capítulo en la Plantilla de carga.
         *   Devuelve un mínimo común (Operación + Descripción) para que un capítulo sin override
         *   produzca al menos una hoja con cabecera. Cada controller de capítulo sobrescribe este
         *   método para devolver su lista específica.
         */
        _getPlantillaStaticColumns: function () {
            //   Se traducen las cabeceras del export XLSX via i18n
            // para que las hojas descargadas reflejen el idioma activo.  
            return [
                { header: this.getTranslatedText("oper"), path: "PhPspnr" },
                { header: this.getTranslatedText("DESCRIPCION"), path: "Post1" }
            ];
            //  
        },

        /**
         *     Recorre las columnas dinámicas del TreeTable de un capítulo y devuelve un mapa
         *   year (número) → subfijo (string, "a1"/"a2"/...). Necesario porque los campos mensuales
         *   en el modelo se llaman "Val0<MM><subfijo>", donde el subfijo varía por año.
         */
        _buildYearToSubfijoMap: function (oController) {
            const oMap = {};
            if (!oController) {
                return oMap;
            }
        
            if (typeof oController.getCustomTableId === "function") {
                const sTableId = oController.getCustomTableId();
                const oTable = sTableId ? oController.byId(sTableId) : null;
                if (oTable) {
                    const aCols = oTable.getColumns();
                    for (let i = 0; i < aCols.length; i++) {
                        const oCol = aCols[i];
                        if (typeof oCol.data !== "function") continue;
                        if (oCol.data("dynamicYear") !== true) continue;
                        if (oCol.data("ejecutadosColumn") === true) continue;
                        const iYear = oCol.data("year");
                        const sSub = oCol.data("subFijoYear");
                        if (iYear && sSub) {
                            oMap[iYear] = sSub;
                        }
                    }
                }
            }
        
            if (Object.keys(oMap).length === 0 && oController._iYearStart && oController._iYearEnd) {
                let iIdx = 0;
                for (let iY = oController._iYearStart; iY <= oController._iYearEnd; iY++) {
                    oMap[iY] = "a" + (iIdx + 1);
                    iIdx++;
                }
            }
            //    
            return oMap;
        },

      
        _flattenPlantillaRows: function (oController, aNodes, aStaticPaths, aMonths, oYearToSubfijo, aRowsOut, aCabeceraIndexesOut, aDesgloseIndexesOut) {
            if (!Array.isArray(aNodes)) {
                return;
            }
            //     Gate del coloreado azzurrino: se respeta _shouldShowAmortizationStyle() del controller
            //   (true en Inmovilizados/Anticipados/Diferidos, false en Corrientes/Externos). Se calcula una
            //   sola vez por capítulo, no por nodo.
            const bShowAmort = (typeof oController._shouldShowAmortizationStyle === "function")
                ? oController._shouldShowAmortizationStyle()
                : false;
            for (let i = 0; i < aNodes.length; i++) {
                const oNode = aNodes[i];
                if (!oNode) continue;
                const bSkipNode = oNode.__isHeader === true
                    || oNode.__isSinProveedor === true
                    || oNode.__isAgrupadorBlock === true
                    || oNode.__isAgrupadorTotal === true;
                if (!bSkipNode) {
                    const aRow = [];
                    //     Valores estáticos: se delega en _resolveCellValue (manejo de PhPspnr→AGRUP,
                    //   Post1→DESCRIP en __isEditable, Reparto, TipoInd, fechas, etc.)
                    for (let s = 0; s < aStaticPaths.length; s++) {
                        const sPath = aStaticPaths[s];
                        if (!sPath) { aRow.push(""); continue; }
                        aRow.push(oController._resolveCellValue(oNode, sPath));
                    }
                    //     Valores dinámicos: cada entrada de aMonths puede ser un MES (con .month)
                    //   o un TOTAL ANUAL (con .isYearTotal === true). Se localiza el subfijo del año en
                    //   ambos casos; el path es Val0<MM><sub> para meses y Total<sub> para year totals.
                    //   Si el nodo no tiene ese año (subfijo desconocido), se deja vacío.
                    for (let m = 0; m < aMonths.length; m++) {
                        const oM = aMonths[m];
                        const sSub = oYearToSubfijo[oM.year];
                       if (!sSub) { aRow.push(0); continue; }
                        let sFieldName;
                        if (oM.isYearTotal === true) {
                            sFieldName = "Total" + sSub;
                        } else {
                            const sMonthPad = (oM.month < 10 ? "0" : "") + oM.month;
                            sFieldName = "Val0" + sMonthPad + sSub;
                        }
                           const vCellValue = oController._coerceNumericValue(oNode[sFieldName]);
                        aRow.push(vCellValue === "" ? 0 : vCellValue);
                    }
                    //    
                    const iAddedIdx = aRowsOut.length;
                    aRowsOut.push(aRow);
                    //     Fila "cabecera azzurrino": Amortización ("A") o Provisión ("B") con opt-in del capítulo.
                    if (Array.isArray(aCabeceraIndexesOut) && bShowAmort
                        && (oNode.TipoInd === "A" || oNode.TipoInd === "B")) {
                        aCabeceraIndexesOut.push(iAddedIdx);
                    }
                    //     Fila "desglose" (fuente reducida + cursiva + gris): bloques proveedor del UI.
                    //   Misma regla que en la Vista del capítulo (_flattenForExport): isLevel3 / __isEditable / __isCustom.
                    if (Array.isArray(aDesgloseIndexesOut)
                        && (oNode.isLevel3 === true || oNode.__isEditable === true || oNode.__isCustom === true)) {
                        aDesgloseIndexesOut.push(iAddedIdx);
                    }
                    //    
                }
                if (Array.isArray(oNode.children) && oNode.children.length > 0) {
                    this._flattenPlantillaRows(oController, oNode.children, aStaticPaths, aMonths, oYearToSubfijo, aRowsOut, aCabeceraIndexesOut, aDesgloseIndexesOut);
                }
            }
        },

        /**
         *    Aplica estilos a una hoja de capítulo de la Plantilla: cabecera en naranja con borde,
         *   separador vertical entre la zona estática y los meses, formato numérico en las celdas Number
         *   y anchos de columna razonables. Más simple que el de la Vista (sin desgloses ni cabeceras
         *   azules — la plantilla es una tabla plana para editar/reimportar).
         */
        _applyPlantillaChapterStyles: function (oSheet, iStaticColCount, aCabeceraRowIndexes, aDesgloseRowIndexes) {
            if (!oSheet || !oSheet["!ref"] || !window.XLSX || !window.XLSX.utils) {
                return;
            }
            const XLSX = window.XLSX;
            const oRange = XLSX.utils.decode_range(oSheet["!ref"]);
            const sNumFmt = "#,##0.00";
            const iSepCol = oRange.s.c + (iStaticColCount || 0);
            //     Sets de índices (sobre filas DE DATOS, 0-based) para detección O(1):
            //     - oCabeceraSet → filas Amortización/Provisión (fondo azzurrino).
            //     - oDesgloseSet → filas de bloque proveedor / desglose (fuente reducida + cursiva + gris).
            //   Misma convención que en la Vista del capítulo.
            const oCabeceraSet = {};
            if (Array.isArray(aCabeceraRowIndexes)) {
                for (let i = 0; i < aCabeceraRowIndexes.length; i++) {
                    oCabeceraSet[aCabeceraRowIndexes[i]] = true;
                }
            }
            const oDesgloseSet = {};
            if (Array.isArray(aDesgloseRowIndexes)) {
                for (let i = 0; i < aDesgloseRowIndexes.length; i++) {
                    oDesgloseSet[aDesgloseRowIndexes[i]] = true;
                }
            }
            for (let R = oRange.s.r; R <= oRange.e.r; R++) {
                const bIsHeader = (R === oRange.s.r);
                const iDataIdx = R - oRange.s.r - 1;
                const bIsCabecera = !bIsHeader && oCabeceraSet[iDataIdx] === true;
                const bIsDesglose = !bIsHeader && oDesgloseSet[iDataIdx] === true;
                for (let C = oRange.s.c; C <= oRange.e.c; C++) {
                    const sAddr = XLSX.utils.encode_cell({ r: R, c: C });
                    let oCell = oSheet[sAddr];
                    const bNeedsSepBorder = (C === iSepCol);
                    if (!oCell) {
                        //     Se crea celda vacía si necesita estilo visible (cabecera, separador o
                        //   fila azzurrino — esta última debe tener fondo completo en todas las columnas).
                        if (bIsHeader || bNeedsSepBorder || bIsCabecera) {
                            oCell = { t: "s", v: "" };
                            oSheet[sAddr] = oCell;
                        } else {
                            continue;
                        }
                    }
                    let oStyle;
                    if (bIsHeader) {
                        //     Cabecera naranja con negrita y borde, igual estilo que la Vista del capítulo
                        oStyle = {
                            fill: { patternType: "solid", fgColor: { rgb: "FFC000" } },
                            font: { bold: true, sz: 11, color: { rgb: "000000" } },
                            alignment: { horizontal: "center", vertical: "center", wrapText: true },
                            border: {
                                top: { style: "thin", color: { rgb: "000000" } },
                                bottom: { style: "thin", color: { rgb: "000000" } }
                            }
                        };
                    } else if (bIsCabecera) {
                        //     Fila Amortización/Provisión: fondo azzurrino (#E8F0FE) que replica la CSS
                        //   class .rowVersionB del UI. Mismo color que en la Vista del capítulo.
                        oStyle = {
                            fill: { patternType: "solid", fgColor: { rgb: "E8F0FE" } },
                            font: { sz: 11, color: { rgb: "000000" } }
                        };
                    } else if (bIsDesglose) {
                        //     Fila secundaria (bloque proveedor / desglose nivel 3): fuente reducida,
                        //   cursiva, color gris suave. Mismo estilo que la Vista del capítulo.
                        oStyle = {
                            font: { sz: 9, italic: true, color: { rgb: "595959" } }
                        };
                    } else {
                        oStyle = { font: { sz: 11 } };
                    }
                    //     Separador vertical entre estáticas y meses
                    if (!bIsHeader && bNeedsSepBorder) {
                        oStyle.border = { left: { style: "thin", color: { rgb: "000000" } } };
                    }
                    if (oCell.t === "n") {
                        oCell.z = sNumFmt;
                        oStyle.numFmt = sNumFmt;
                    }
                    oCell.s = oStyle;
                }
            }
            //     Anchos: Operación 16, Descripción 38, resto 12 (mismo criterio que la Vista)
            const aColsMeta = [];
            for (let C = oRange.s.c; C <= oRange.e.c; C++) {
                if (C === 0) {
                    aColsMeta[C] = { wch: 16 };
                } else if (C === 1) {
                    aColsMeta[C] = { wpx: 200 };
                } else {
                    aColsMeta[C] = { wch: 12 };
                }
            }
            oSheet["!cols"] = aColsMeta;
            //     Alturas de fila: cabecera 22pt + filas desglose 13pt (compactas, replicando
            //   la altura reducida que usa la Vista del capítulo para distinguir visualmente los desgloses).
            const aRowsMeta = [];
            aRowsMeta[oRange.s.r] = { hpt: 22 };
            if (Array.isArray(aDesgloseRowIndexes)) {
                for (let i = 0; i < aDesgloseRowIndexes.length; i++) {
                    const iSheetRow = oRange.s.r + 1 + aDesgloseRowIndexes[i];
                    aRowsMeta[iSheetRow] = { hpt: 13 };
                }
            }
            oSheet["!rows"] = aRowsMeta;
            //    
        },

        /**
         *     Formatea una fecha OData ("/Date(ms)/") al formato dd/MM/YYYY usado en el spec.
         *   Devuelve cadena vacía si la fecha es null/inválida.
         */
        _formatPlantillaDate: function (sODataDate) {
            if (!sODataDate) return "";
            const oDate = this._parseODataDate(sODataDate);
            if (!oDate || isNaN(oDate.getTime())) return "";
            const fnPad = function (v) { return String(v).padStart(2, "0"); };
            return fnPad(oDate.getDate()) + "/" + fnPad(oDate.getMonth() + 1) + "/" + oDate.getFullYear();
        },

        /**
         *     Nombre de archivo para la Plantilla de carga: "Plantilla_carga_YYYYMMDD_HHmm.xlsx"
         */
        _buildPlantillaFileName: function () {
            const oNow = new Date();
            const fnPad = function (v) { return String(v).padStart(2, "0"); };
            const sDate = oNow.getFullYear() + fnPad(oNow.getMonth() + 1) + fnPad(oNow.getDate());
            const sTime = fnPad(oNow.getHours()) + fnPad(oNow.getMinutes());
            //   Se traduce el prefijo "Plantilla_carga" del nombre de archivo via i18n.
            return this.getTranslatedText("exportFileNamePlantilla") + "_" + sDate + "_" + sTime + ".xlsx";
            //
        },

        /**
         * Se engancha el evento nativo "contextmenu" al contenedor DOM de la
         * TreeTable indicada.  Debe llamarse desde onAfterRendering de cada
         * controlador hijo, una sola vez por tabla.
         *
         * @param {string} sTableId - ID local de la TreeTable (p.ej. "TreeTableBasic")
         */
        _attachContextMenuToTable: function (sTableId) {
            var oTable = this.byId(sTableId);
            if (!oTable) {
                return;
            }

            // Se evita registrar el listener más de una vez si el controlador
            // llama a _attachContextMenuToTable varias veces (p.ej. en re-renders).
            if (oTable._ctxMenuListenerAttached) {
                return;
            }
            oTable._ctxMenuListenerAttached = true;

            var oController = this;

            oTable.addEventDelegate({
                onAfterRendering: function () {
                    var oDomRef = oTable.getDomRef();
                    if (!oDomRef || oDomRef._ctxMenuHandlerBound) {
                        return;
                    }
                    oDomRef._ctxMenuHandlerBound = true;

                    oDomRef.addEventListener("contextmenu", function (oNativeEvent) {
                        // Se suprime el menú contextual nativo del navegador.
                        oNativeEvent.preventDefault();
                        oNativeEvent.stopPropagation();

                        // Se localiza el <tr> de la fila más cercano al punto de clic.
                        var oRowTr = oNativeEvent.target.closest("tr[data-sap-ui-rowindex]");
                        if (!oRowTr) {
                            // El clic fue sobre la cabecera u otra zona sin fila de datos.
                            return;
                        }

                        // Se obtiene el índice visual (0-based dentro del viewport).
                        var iDomRowIndex = parseInt(oRowTr.getAttribute("data-sap-ui-rowindex"), 10);
                        if (isNaN(iDomRowIndex)) {
                            return;
                        }

                        // Se convierte a índice absoluto sumando el primer row visible.
                        var iAbsoluteIndex = oTable.getFirstVisibleRow() + iDomRowIndex;

                        // Se obtiene el binding context independientemente del nombre del modelo.
                        var oRowContext = oTable.getContextByIndex(iAbsoluteIndex);
                        if (!oRowContext) {
                            return;
                        }

                        // Se almacena el contexto y el índice para uso de los handlers de acción.
                        oController._oContextMenuRecord = oRowContext;
                        oController._oContextMenuRowIndex = iAbsoluteIndex;

                        // Se abre el menú en la posición del cursor.
                        oController._openContextMenu(oNativeEvent.clientX, oNativeEvent.clientY);
                    });
                }
            });
        },

        /**
         * Se carga el fragmento ContextMenu (sap.m.Menu) la primera vez y se abre
         * posicionado en las coordenadas indicadas del cursor.
         *
         * @param {number} iClientX - Coordenada X del cursor en el viewport
         * @param {number} iClientY - Coordenada Y del cursor en el viewport
         */
        _openContextMenu: function (iClientX, iClientY) {
            var oView = this.getView();
            var oController = this;

            if (!this._pContextMenu) {
                this._pContextMenu = Fragment.load({
                    id: oView.getId() + "--ctxMenu",
                    name: "zindirect_costs.fragments.ContextMenu",
                    controller: this
                }).then(function (oMenu) {
                    oView.addDependent(oMenu);
                    return oMenu;
                });
            }

            this._pContextMenu.then(function (oMenu) {
                // Se crea un elemento DOM invisible para anclar el menú a la posición del cursor.
                var oAnchor = document.getElementById("__ctxMenuAnchor");
                if (!oAnchor) {
                    oAnchor = document.createElement("div");
                    oAnchor.id = "__ctxMenuAnchor";
                    oAnchor.style.position = "fixed";
                    oAnchor.style.width = "1px";
                    oAnchor.style.height = "1px";
                    oAnchor.style.pointerEvents = "none";
                    document.body.appendChild(oAnchor);
                }
                oAnchor.style.left = iClientX + "px";
                oAnchor.style.top = iClientY + "px";

                oMenu.openBy(oAnchor);
            });
        },

        /**
         * Se gestiona la selección de una entrada del menú contextual.
         * Cada clave de ítem dispara la acción correspondiente.
         *
         * @param {sap.ui.base.Event} oEvent - Evento itemSelected del sap.m.Menu
         */
        onContextMenuItemSelected: function (oEvent) {
            var oItem = oEvent.getParameter("item");
            if (!oItem) return;
            var sKey = oItem.getKey();

            switch (sKey) {
                case "addOperation":
                    this._onCtxMenuAddOperation();
                    break;
                case "addDesglose":
                    this._onCtxMenuAddDesglose();
                    break;
                case "delete":
                    this._onCtxMenuDelete();
                    break;
                case "upload":
                    this._onCtxMenuUpload();
                    break;
                case "distribute":
                    this._onCtxMenuDistribute();
                    break;
                default:
                    break;
            }
        },

       
        _attachKeyboardShortcuts: function () {
            if (this._keyboardShortcutsAttached) {
                return;
            }
            this._keyboardShortcutsAttached = true;

            var oController = this;

            this._keyboardShortcutHandler = function (oEvent) {
                // Solo se procesan combinaciones con Alt sin Ctrl ni Meta (Cmd en Mac).
                if (!oEvent.altKey || oEvent.ctrlKey || oEvent.metaKey) {
                    return;
                }

                var sKey = oEvent.key;

                // Alt + "+" o Alt + "Add" (teclado numérico) → Añadir
                if (sKey === "+" || sKey === "Add") {
                    // Se evita que el navegador procese el "+" (p.ej. zoom)
                    oEvent.preventDefault();
                    if (typeof oController.onAddPress === "function") {
                        oController.onAddPress({ getSource: function () { return null; } });
                    }
                    return;
                }

                // Alt + "-" o Alt + "Subtract" (teclado numérico) → Borrar
                if (sKey === "-" || sKey === "Subtract") {
                    oEvent.preventDefault();
                    if (typeof oController.onDeletePress === "function") {
                        oController.onDeletePress();
                    }
                    return;
                }

                // Alt + "s" / Alt + "S" → Guardar (delega en Main.onSave)
                if (sKey === "s" || sKey === "S") {
                    oEvent.preventDefault();
                    var oMain = oController._getMainController();
                    if (oMain && typeof oMain.onSave === "function") {
                        oMain.onSave();
                    }
                    return;
                }
            };

            document.addEventListener("keydown", this._keyboardShortcutHandler, true);
        },

        /**
         * Se elimina el listener de atajos de teclado. Se invoca desde onExit para
         * garantizar que no quedan listeners huérfanos al destruir la vista.
         */
        _detachKeyboardShortcuts: function () {
            if (this._keyboardShortcutHandler) {
                document.removeEventListener("keydown", this._keyboardShortcutHandler, true);
                this._keyboardShortcutHandler = null;
            }
            this._keyboardShortcutsAttached = false;
        },

        /**
         * Se libera el listener de atajos de teclado cuando la vista se destruye.
         */
        onExit: function () {
            this._detachKeyboardShortcuts();
            this._teardownBrowserCloseHandler();
        },

       
        hasUnsavedChanges: function () {
            return this._hasPendingChanges === true;
        },

      
        _setupBrowserCloseHandler: function () {
            if (this._browserCloseHandlerAttached) { return; }
            this._browserCloseHandlerAttached = true;
            this._boundBrowserClose = function (oEvent) {
                if (this._hasPendingChanges === true) {
                    oEvent.preventDefault();
                    oEvent.returnValue = "";
                    return "";
                }
            }.bind(this);
            window.addEventListener("beforeunload", this._boundBrowserClose);
        },

        _teardownBrowserCloseHandler: function () {
            if (this._boundBrowserClose) {
                window.removeEventListener("beforeunload", this._boundBrowserClose);
                this._boundBrowserClose = null;
            }
            this._browserCloseHandlerAttached = false;
        },

        /**
         * Acción "Añadir operaciones": delega en onAddPress del controlador hijo si existe.
         */
        _onCtxMenuAddOperation: function () {
            if (!this._oContextMenuRecord) return;
            var oTable = this.getControlTable();
            if (oTable && this._oContextMenuRowIndex !== undefined) {
                oTable.setSelectedIndex(this._oContextMenuRowIndex);
            }
            if (typeof this.onAddPress === "function") {
                this.onAddPress({ getSource: function () { return null; } });
            }
        },

        /**
         * Acción "Añadir desglose": delega en onAddDesglosePress del controlador hijo si existe,
         * simulando el evento sobre la fila seleccionada del menú contextual.
         */
        _onCtxMenuAddDesglose: function () {
            if (!this._oContextMenuRecord) return;
            if (typeof this.onAddDesglosePress === "function") {
                var oRecord = this._oContextMenuRecord;
                this.onAddDesglosePress({
                    getSource: function () {
                        return {
                            getBindingContext: function () { return oRecord; }
                        };
                    }
                });
            }
        },

        /**
         * Acción "Borrar": selecciona la fila del contexto en la tabla y delega en onDeletePress.
         */
        _onCtxMenuDelete: function () {
            if (!this._oContextMenuRecord) return;
            var oTable = this.getControlTable();
            if (oTable && this._oContextMenuRowIndex !== undefined) {
                oTable.setSelectedIndex(this._oContextMenuRowIndex);
            }
            if (typeof this.onDeletePress === "function") {
                this.onDeletePress();
            }
        },

        /**
         * Acción "Subir": delega en onProcessPress del controlador hijo si existe.
         */
        _onCtxMenuUpload: function () {
            if (typeof this.onProcessPress === "function") {
                this.onProcessPress();
            }
        },

        /**
         * Acción "Repartir": selecciona la fila del contexto y delega en onShortcutPress.
         */
        _onCtxMenuDistribute: function () {
            if (!this._oContextMenuRecord) return;
            var oTable = this.getControlTable();
            if (oTable && this._oContextMenuRowIndex !== undefined) {
                oTable.setSelectedIndex(this._oContextMenuRowIndex);
            }
            if (typeof this.onShortcutPress === "function") {
                this.onShortcutPress();
            }
        },

    });
});

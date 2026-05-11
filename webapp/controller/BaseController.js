sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/model/json/JSONModel",
    "masterindirectos/fragments/MessageDialog.fragment",
    "masterindirectos/fragments/Selector.fragment",
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
    "masterindirectos/utils/ServiceCaller",
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

    return Controller.extend("masterindirectos.controller.BaseController", {
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
       /**
 * Se realiza una petición GET al servidor OData.
 */
        get: async function (oModel, sPath, oParams = {}) {
            this._showLoadingDialog();

            const oAppData = this.getGlobalModel("appData");
            const sToken = oAppData ? oAppData.getProperty("/EvToken") : undefined;

            return new Promise((resolve, reject) => {
                oModel.read(sPath, {
                    ...oParams,
                    headers: {
                        ...oParams.headers,
                        ...(sToken && { token: sToken })
                    },
                    success: function (data) {
                        resolve(data);
                        this._hideLoadingDialog();
                    }.bind(this),
                    error: function (error) {
                        reject(error);
                        this._hideLoadingDialog();
                    }.bind(this),
                });
            });
        },

        /**
       * Limpia las propiedades temporales que no deben enviarse al backend
       * @param {object|array} data - Datos a limpiar
       * @returns {object|array} Datos limpios
       */
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
                    justifyContent: "Center",
                    alignItems: "Center",
                    width: "100%",
                    items: [
                        new sap.m.Text({
                            width: "100%",
                            textAlign: "Center",
                            wrapping: false,
                            text: {
                                parts: [
                                    this.tableModelName + ">InvEjeReal", //   : campo original
                                    "dashboardModel>/decimales",         //   : nº decimales
                                    "appData>/userData/CurrencyFormat"   //   : formato moneda
                                ],
                                formatter: this.formatter.formatDecimales //   : formatter aplicado
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
                        // Campo editable para introducir datos manuales. Se oculta automáticamente si la fila no es de detalle puro.
                        //   Se sustituye el binding de cadena por un objeto de binding con tipo
                        //   sap.ui.model.type.Float construido mediante la funcion auxiliar
                        //   _buildNumericBinding. El tipo gestiona la formateacion en la vista y
                        //   el parseo del valor introducido por el usuario de forma bidireccional,
                        //   eliminando la necesidad de manejar la conversion manualmente.
                        //   Se sustituye el Input anónimo de la columna año por uno que incluye el handler
                        //   centralizado onRowInputChange y los atributos custom necesarios para que dicho
                        //   método identifique el control como perteneciente a una columna dinámica de año.
                        // prueba editabilidad"{= ${" + this.tableModelName + ">/EvBloqueados} !== 'X' }"
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
                        text: "Resto",
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
                        textAlign: "Center",
                        wrapping: false,
                        text: "{" + this.tableModelName + ">PlanResto}",
                        visible: "{= ${" + this.tableModelName + ">expandible} === false || ${" + this.tableModelName + ">isGroup} === true }"
                    }),
                    new masterindirectos.control.DecimalesInput({
                        width: "100%",
                        textAlign: "Center",
                        decimalNumbers: "{dashboardModel>/decimales}",
                        // editable: "{= !${" + this.tableModelName + ">__isSinProveedor} && ${" + this.tableModelName + ">padre} !== true && (${" + this.tableModelName + ">Tipo} === 'MAN' || ${" + this.tableModelName + ">Tipo} === 'PCT' || ${" + this.tableModelName + ">Tipo} === '') }",
                        editable: false,
                        visible: "{= ${" + this.tableModelName + ">expandible} !== false && !${" + this.tableModelName + ">isGroup} }",
                        value: {
                            parts: [
                                this.tableModelName + ">PlanResto",
                                "dashboardModel>/decimales",
                                "appData>/userData/CurrencyFormat"
                            ],
                            formatter: this.formatter.formatDecimales
                        },

                        //   Se registra el handler centralizado de cambio de celda para la columna
                        //   Resto, de forma que el envío al backend se gestione por el mismo flujo
                        //   que el resto de inputs editables de la tabla sin duplicar lógica.
                        change: this.onRowInputChange.bind(this)

                        //   Se marca el control como perteneciente a la columna Resto mediante un
                        //   atributo custom para que onRowInputChange active la rama de sincronización
                        //   del sticky header con la clave /stickyHeaderData/parent/Resto.
                    }).data("restoInput", true)
                        .addStyleClass("borderColYears sapUiSizeCompact"),

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
        /**
*  Se crean las columnas de años utilizando el rango dinámico definido
*  en _initYearsModel (Freal → Frealfinobra).
*  Este método centraliza la lógica para que cualquier controlador hijo
* pueda reutilizarla sin depender de valores hardcodeados.
*/
        /**Se aplica también la lógica de visibilidad (2 años o 1 si es el último)
         *  y se abre automáticamente el detalle mensual del año seleccionado.
         */
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

            for (let i = 0; i < aRows.length; i++) {
                const oRow = aRows[i];
                oRow.removeStyleClass("cabeceracolor");
                oRow.removeStyleClass("cabeceracolor-Group");

                const oCtx = oTable.getContextByIndex(iFirst + i);
                if (!oCtx) continue;
                const oObj = oCtx.getObject();

                if (oObj && oObj.cabecera === true) {
                    oRow.addStyleClass("cabeceracolor");
                    oRow.removeStyleClass("flatCellInput");
                }

                if (oObj && oObj.expandible === true) {
                    oRow.addStyleClass("cabeceracolor-Group");
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
                    name: "masterindirectos.fragments.ActionPopover",
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

            // Se generan los nombres abreviados de los meses en castellano.
            const aMonthNames = [];
            for (let i = 0; i < 12; i++) {
                const date = new Date(new Date().getFullYear(), i, 1);
                aMonthNames.push(date.toLocaleString("es-ES", { month: "short" }));
            }

            // Se obtiene la fecha de referencia efectiva para determinar el mes actual.
            const oRefDate = this._effectiveDate || new Date();
            const currentYear = oRefDate.getFullYear();
            const currentMonth = oRefDate.getMonth();

            // Se calcula el indice de inicio: si ejecutados esta activo se muestran todos los meses desde enero.
            const iStartIdx = (sYear === currentYear && !bShowEjecutado) ? currentMonth : 0;

            // Se localiza la columna del año en la tabla para calcular la posicion de insercion.
            const oYearCol = oTable.getColumns().find(function (c) {
                const lab = c.getLabel();
                const txt = lab.getText ? lab.getText() : (lab.getItems ? lab.getItems()[0].getText() : "");
                return txt === String(sYear);
            });
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

                    // Se utiliza _buildNumericBinding con editable en false para que el tipo Float
                    // parsee correctamente el valor antes de formatearlo.
                    const oInput = new sap.m.Input({
                        width: "100%",
                        value: this._buildNumericBinding(this.tableModelName + ">" + sValKey),
                        textAlign: "Center",
                        editable: false,
                        // enabled: "{modeloBloqueo>/isBlocked}",
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

                        const oInput = new sap.m.Input({
                            width: "100%",
                            value: this._buildNumericBinding(this.tableModelName + ">" + sValKey),
                            textAlign: "Center",
                            editable: {
                                path: this.tableModelName + ">Tipo",
                                formatter: function (sTipo) {
                                    return sTipo !== "OEO";
                                }
                            },
                            change: this.onRowInputChange.bind(this)
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
            }.bind(this), 50);
        },
        //   Se gestiona el cambio de año en el selector de ejercicio.
        //   Se recarga el modelo del backend (a1 = año seleccionado, a2 = año+1),
        //   se reconstruyen las columnas con los sufijos correctos y se abren los meses.
        onYearChange: async function (oEvent) {
            var sSelectedYear = oEvent.getParameter("selectedItem").getKey();
            var iSelectedYear = parseInt(sSelectedYear, 10);

            //   Se actualiza el año seleccionado en yearsModel ANTES de llamar a
            //   initTabModel para que _getSelectedEjercicio() devuelva el valor
            //   correcto y el backend reciba el ejercicio exacto en el header.
            var oYearsModel = this.getView().getModel("yearsModel");
            if (oYearsModel) {
                oYearsModel.setProperty("/selectedYear", String(iSelectedYear));
            }

            var sTableId = this.getCustomTableId ? this.getCustomTableId() : "TreeTableBasic";
            var oTable = this.byId(sTableId);
            if (!oTable) return;

            //   Se eliminan columnas de meses y ejecutados antes del reload para
            //   evitar columnas huérfanas con bindings obsoletos del año anterior.
            oTable.getColumns()
                .filter(function (c) { return c.data("dynamicMonth") || c.data("ejecutadosColumn"); })
                .forEach(function (c) { oTable.removeColumn(c); });
            this._openedYear = null;

            //   Se recarga el modelo contra el backend. El servidor mapea siempre
            //   el ejercicio seleccionado como Gjahr1 → a1 y el siguiente como
            //   Gjahr2 → a2. Nunca se usan a3 ni a4.
            if (typeof this.initTabModel === "function") {
                await this.initTabModel();
            }

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

        /**
         * Se busca un control por su identificador tanto en la vista activa como en el
         * resto de elementos registrados en el nucleo de SAPUI5. Resulta necesario cuando
         * el control pertenece a una vista distinta de la vista hija en uso, como ocurre
         * con idEjecutadoCheckBox2 que reside en la Main view.
         */
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
                    const lab = c.getLabel();
                    const txt = lab.getText ? lab.getText() : (lab.getItems ? lab.getItems()[0].getText() : "");
                    return txt === String(sYear);
                });

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
        /* ───  getCustomTableId() ──────────────────────────────────────────
      * Devuelve el id de tabla registrado por initVariantConfig.
      * Las vistas hijas ya no necesitan sobrescribir este método.
      */
        getCustomTableId: function () {
            return this._variantConfig ? this._variantConfig.tableId : "";
        },

        /* ───  getControlTable() ───────────────────────────────────────────
            * Localiza la tabla por el id almacenado en la configuración de variante.
            */
        getControlTable: function () {
            var sId = this.getCustomTableId();
            return sId ? this.byId(sId) : null;
        },

        /**
            * Se configuran las propiedades y eventos necesarios para el funcionamiento de una TreeTable dinámica.
            * Centraliza la asignación de delegados de teclado, cálculos de tamaño y eventos de scroll.
            */
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

            // Se inicializa el delegado general de eventos de teclado si no existía previamente.
            // (CLINE)    Se incluye onkeypress para bloquear de forma silenciosa la escritura
            // (CLINE)    de caracteres alfabéticos en los campos de entrada numéricos.
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
                oTable.attachEvent("rowsUpdated", function () {
                    this._attachArrowDelegates(oTable);
                    this._highlightSinProveedor(oTable);
                    this._applyBlockBorder(oTable);
                }.bind(this));
                oTable._rowsDelegateAttached = true;
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

            //   Se engancha el evento de expansion y colapso de la cabecera del
            // ObjectPageLayout para recalcular el splitter y las filas visibles.
            // Se usa attachEvent con el nombre interno del evento de snap/expand
            // ya que attachToggleHeaderOnTitleClick no existe como API publica.
            // El ObjectPageLayout emite "_snapHeader" al colapsar y "_expandHeader"
            // al expandir; ambos se interceptan con el mismo handler de recalculo.
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
        },
        //   Se conecta un MutationObserver al DOM del ObjectPageLayout para
        // detectar cuando la cabecera cambia de estado (snap/expand) y recalcular
        // el splitter y las filas visibles. Es el mecanismo mas robusto porque no
        // depende de nombres de eventos internos que pueden cambiar entre versiones
        // de SAPUI5.
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

            this.getView().getModel("viewModel").setProperty("/dynamicRowCount", iRows);
        },

        /**
         * Se calcula dinámicamente la altura del Splitter vertical
         * restando la posición superior del control y el footer
         * de la altura total de la ventana. De este modo el Splitter
         * se adapta a cualquier nivel de zoom sin usar píxeles fijos.
         */
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
                // Lo splitter non è ancora nel DOM: si aggancia l'evento
                oSplitter.addEventDelegate({ onAfterRendering: fnCompute });
            }
        },
        /**
 * Se construye una clave estable que identifica una columna dinámica
 * de forma unívoca para su almacenamiento en el mapa de anchos guardados.
 */
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

            // Se itera sobre cada fila y, seguidamente, sobre cada celda que compone la fila.
            aRows.forEach(function (oRow) {
                oRow.getCells().forEach(function (oCell) {
                    // Se utiliza una función recursiva para buscar dentro de la celda si existe un control Input oculto bajo otros layouts (VBox, HBox).
                    const oInput = this._recursiveGetInput(oCell);

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

            // Se recupera la referencia del DOM (HTML nativo) del Input para leer su valor exacto antes de que el framework lo procese.
            const oDomRef = oInput.getFocusDomRef();
            if (!oDomRef) return;

            // Si se navega horizontalmente, se previene el salto nativo del cursor de texto para que podamos cambiar de celda en su lugar.
            if (bLeft || bRight) oEvent.preventDefault();



            // Se sincroniza el valor del DOM con el control SAPUI5 para evitar la pérdida de datos introducidos parcialmente antes de cambiar de celda.
            const sCurrentDomValue = oDomRef.value;
            oInput.setValue(sCurrentDomValue);
            if (oInput.updateModelProperty) oInput.updateModelProperty(sCurrentDomValue);

            // Se detiene la propagación del evento para que no interfiera con otras funcionalidades nativas del navegador.
            oEvent.preventDefault();
            oEvent.stopImmediatePropagation();

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
                const iTotalCols = oTable.getColumns().length;

                // Se itera en la dirección indicada saltando celdas sin input o con inputs no editables.
                while (true) {
                    iNewColIndex = bRight ? iNewColIndex + 1 : iNewColIndex - 1;

                    // Si se alcanza el límite lateral de la tabla, se mantiene el foco en el input actual.
                    if (iNewColIndex < 0 || iNewColIndex >= iTotalCols) {
                        setTimeout(function () { oInput.focus(); if (oInput.select) oInput.select(); }, 10);
                        return;
                    }

                    const oCell = oRow.getCells()[iNewColIndex];
                    if (!oCell) continue;

                    // Se busca cualquier input visible en la celda ignorando la restricción de editable para detectar su existencia.
                    const oCandidato = this._recursiveGetInput(oCell, true);
                    if (!oCandidato) continue; // La celda no contiene ningún input, se continúa la búsqueda.

                    // Si el input existe y es editable, se establece como destino y se detiene la búsqueda.
                    if (oCandidato.getEditable()) {
                        oTargetInput = oCandidato;
                        break;
                    }
                    // Si el input existe pero no es editable, se salta y se continúa en la misma dirección.
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

            // ── LÓGICA DE NAVEGACIÓN VERTICAL (ARRIBA / ABAJO) ────────────────────────────────────
            let iTargetRowIndex = null;
            let sTargetPath = null;
            let iSearchIndex = iCurrentRowIndex;
            let iSearchSteps = 0;

            // Se busca de forma iterativa la próxima fila válida saltando nodos padre y celdas no editables.
            while (true) {
                // Se incrementa o decrementa el índice lógico en base a la dirección de la flecha.
                iSearchIndex = bDown ? iSearchIndex + 1 : iSearchIndex - 1;
                iSearchSteps++;

                // Si se alcanza el límite superior o inferior absoluto de la tabla, se cancela el movimiento.
                if (iSearchIndex < 0 || iSearchIndex >= oBinding.getLength()) {
                    setTimeout(function () { oInput.focus(); if (oInput.select) oInput.select(); }, 10);
                    return;
                }

                // Se evita un posible bucle infinito limitando la búsqueda a doscientas iteraciones.
                if (iSearchSteps > 200) {
                    setTimeout(function () { oInput.focus(); if (oInput.select) oInput.select(); }, 10);
                    return;
                }

                // Se extrae el contexto de la nueva fila candidata.
                const oCtx = oTable.getContextByIndex(iSearchIndex);
                if (!oCtx) continue;

                const oData = oCtx.getObject();
                if (!oData) continue;

                // Se descartan los nodos raíz marcados como padre ya que no contienen inputs editables.
                if (oData.padre === true) continue;

                // Se verifica si la fila candidata es visible en el viewport actual para poder inspeccionar su input.
                const iFirstVisCheck = oTable.getFirstVisibleRow();
                const iVisIdxCheck = iSearchIndex - iFirstVisCheck;

                if (iVisIdxCheck >= 0 && iVisIdxCheck < oTable.getRows().length) {
                    // La fila es visible en pantalla, se inspecciona directamente si su celda contiene un input editable.
                    const oRowCheck = oTable.getRows()[iVisIdxCheck];
                    if (oRowCheck) {
                        const oCellCheck = oRowCheck.getCells()[iTargetColIndex];
                        // Se busca cualquier input visible ignorando editable para detectar su existencia.
                        const oInputCheck = this._recursiveGetInput(oCellCheck, true);
                        // Si no hay input o no es editable, se salta esta fila y se continúa la búsqueda.
                        if (!oInputCheck || !oInputCheck.getEditable()) continue;
                    }
                }
                // Si la fila no es visible aún porque requiere scroll, se acepta directamente como destino
                // ya que no es posible inspeccionar inputs de filas no renderizadas en el DOM.

                // Se fija el índice y la ruta de la fila destino y se detiene la búsqueda.
                iTargetRowIndex = iSearchIndex;
                sTargetPath = oCtx.getPath();
                break;
            }

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

            // ── ASIGNACIÓN DE FOCO CON SCROLL ─────────────────────────────────────────────────────
            if (bNeedsScroll) {
                const that = this;
                let bFocused = false;

                // Se define una función de cierre que ejecutará el enfoque una vez que la tabla termine de desplazarse.
                const fnFocus = function () {
                    // Se utiliza una bandera para evitar que el evento rowsUpdated dispare el enfoque múltiples veces.
                    if (bFocused) return;
                    bFocused = true;

                    const aRows = oTable.getRows();
                    let oTargetRow = null;

                    // Se escanean las filas recién dibujadas buscando aquella cuyo contexto coincida con la ruta de destino.
                    for (let i = 0; i < aRows.length; i++) {
                        const oRowContext = aRows[i].getBindingContext(this.tableModelName);

                        if (oRowContext && oRowContext.getPath() === sTargetPath) {
                            oTargetRow = aRows[i];
                            break;
                        }
                    }

                    // Si no se encuentra la fila tras el scroll, se devuelve el foco a la posición inicial como salvaguarda.
                    if (!oTargetRow) {
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
                    } else {
                        oInput.focus();
                        if (oInput.select) oInput.select();
                    }
                };

                // Se ata el evento para ejecutar el enfoque en el momento en que la tabla comunica que terminó de renderizar el desplazamiento.
                oTable.attachEventOnce("rowsUpdated", function () {
                    setTimeout(fnFocus, 50);
                });

                // Se instruye físicamente a la tabla para que se mueva a la nueva fila inicial calculada.
                oTable.setFirstVisibleRow(iNewFirstVisible);

                // Se establece un temporizador de respaldo en caso de que el evento rowsUpdated falle o se pierda.
                setTimeout(fnFocus, 300);

            } else {
                // ── ASIGNACIÓN DE FOCO SIN SCROLL ─────────────────────────────────────────────────
                // Se capturan las variables necesarias en el ámbito del closure para evitar pérdidas de referencia.
                const sPath = sTargetPath;
                const iColIdx = iTargetColIndex;

                setTimeout(function () {
                    const aRows = oTable.getRows();
                    let oTargetRow = null;

                    // Se busca la fila objetivo por su ruta de binding utilizando el nombre del modelo correcto.
                    for (let i = 0; i < aRows.length; i++) {
                        const oRowContext = aRows[i].getBindingContext(this.tableModelName);

                        if (oRowContext && oRowContext.getPath() === sPath) {
                            oTargetRow = aRows[i];
                            break;
                        }
                    }

                    // Se devuelve el foco al input original si no se localiza la fila destino.
                    if (!oTargetRow) {
                        oInput.focus();
                        if (oInput.select) oInput.select();
                        return;
                    }

                    // Se extrae el input de la celda destino y se le transfiere el foco.
                    const oCell = oTargetRow.getCells()[iColIdx];
                    const oTargetInput = this._recursiveGetInput(oCell);

                    if (oTargetInput && oTargetInput.getVisible() && oTargetInput.getEditable()) {
                        //     Se guarda el input destino en _pendingFocusTarget para que
                        //     _enviarFilaAlBackend pueda restaurarlo tras la llamada async.
                        that._pendingFocusTarget = oTargetInput;
                        oTargetInput.focus();
                        if (oTargetInput.select) oTargetInput.select();
                    } else {
                        oInput.focus();
                        if (oInput.select) oInput.select();
                    }
                }.bind(this), 10);
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

            // Caso base: se verifica si el control evaluado es directamente la instancia de entrada buscada.
            if (oControl.isA && oControl.isA("sap.m.Input")) {
                // Se garantiza que el input solo se retorne si está habilitado para la interacción del usuario.
                if (oControl.getVisible() && oControl.getEditable()) {
                    return oControl;
                }
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

        /**
         * Se combinan las modificaciones del usuario (tecleadas en la tabla actual) con la estructura base o backup.
         * Evita que se pierdan datos ingresados cuando se aplican o quitan filtros destructivos.
         */
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
        /**
         * Se compara el arbol actual del modelo con el arbol original del servidor
         * y se devuelve unicamente la lista de valores que han cambiado respecto al origen.
         * Cada entrada del delta contiene la ruta de acceso al nodo, la clave del
         * campo modificado y el nuevo valor introducido por el usuario.
         */
        _computeModelDelta: function (aOriginal, aCurrent, sBasePath) {
            const aDelta = [];
            const sPath = sBasePath || "";

            if (!Array.isArray(aCurrent) || !Array.isArray(aOriginal)) return aDelta;

            //     Se anaden editCtotPen y editCtot a las claves estructurales que se
            // ignoran al calcular el delta, ya que son flags de editabilidad exclusivos
            // del frontend y no representan datos modificables por el usuario.
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
        /* ────────────────────────────────────
         * Lee la clave de storage desde _variantConfig en lugar de recibir un parámetro
         * o depender de un valor hardcodeado. El resto de la lógica es idéntica.
         */
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

            this.getView().setModel(new sap.ui.model.json.JSONModel({
                currentName: oDefaultVariant.name,
                displayLabel: oDefaultVariant.name
            }), "variantModel");

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
                        this.getView().getModel("variantModel").setProperty("/displayLabel", oDefaultVariant.name);
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

        /**
         * Se marca la variante activa como modificada y se actualiza el indicador
         * visual anadiendo un asterisco al nombre mostrado en el boton selector.
         * Se omite la marca si el sistema ha suspendido temporalmente la deteccion
         * de cambios durante la restauracion de una variante.
         */
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
            oVModel.setProperty("/displayLabel", sName + " *");
        },

        /**
         * Se elimina el indicador de cambios pendientes y se restaura el nombre limpio.
         */
        _clearVariantDirty: function () {
            this._bVariantDirty = false;
            const oVModel = this.getView().getModel("variantModel");
            if (!oVModel) return;
            oVModel.setProperty("/displayLabel", oVModel.getProperty("/currentName"));
        },

        /**
         * Se gestiona el redimensionamiento de columnas realizado por el usuario.
         * Se persiste el nuevo ancho y se marca la variante activa como modificada.
         */
        onColumnResize: function (oEvt) {
            this._markVariantDirty();
        },

        /**
         * Se captura el estado completo de la tabla incluyendo el orden de las columnas
         * estaticas, sus anchos, su visibilidad, las filas expandidas, las seleccionadas,
         * el delta de cambios realizados por el usuario en las celdas editables y el estado
         * de los controles auxiliares de ejercicios anteriores y ajustes.
         * El estado de idEjecutadoCheckBox2 se lee desde la variable interna _bEjecutadoSelected
         * ya que dicho control reside en la Main view y no es accesible directamente desde aqui.
         */
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

        /**
         * Se aplica un estado de variante guardado a la tabla restaurando el orden,
         * anchos y visibilidad de columnas, los datos editados en las celdas mediante
         * el delta, las filas expandidas y seleccionadas y el estado de los controles
         * auxiliares de ejercicios anteriores y ajustes.
         * Para actualizar visualmente idEjecutadoCheckBox2 se utiliza la retrollamada
         * _fnSetEjecutadoCheckBox inyectada por la Main view al cargar esta vista hija.
         */
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

        /**
        * Se construye una clave estable para identificar una columna dentro de una variante.
        * Los IDs generados por el framework con formato __columnN varían según el orden en que se
        * inicializan las vistas en cada sesión. Para columnas sin filterProperty ni ID explícito
        * se extrae el texto de la etiqueta principal como discriminador invariante entre sesiones.
        */
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

        /**
         * Se filtra el TreeTable construyendo un nuevo arbol con solo las coincidencias y sus padres reales.   
         * Reglas:   
         *   - Si el nodo coincidente tiene hijos (es padre): se muestra junto con sus hijos.   
         *   - Si el nodo coincidente es hijo de un padre real (con varios hijos): se muestra el padre expandido con el hijo encontrado.   
         *   - Si el nodo coincidente no tiene familia (sin hijos y con genitores que solo lo contienen a el como unico hijo): se muestra como fila aislada en raiz.   
         * Se conserva una copia del arbol original para poder restaurarlo cuando se vacia el campo de busqueda.   
         */
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
            if (!sQuery) return;

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
            if (typeof oTable.expandToLevel === "function") {
                setTimeout(function () { oTable.expandToLevel(99); }, 0);
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
            var oSeen = {};
            var aItems = [];
            function collect(aNodes) {
                if (!Array.isArray(aNodes)) return;
                aNodes.forEach(function (oNode) {
                    if (!oNode) return;
                    var sCode = oNode.PhPspnr;
                    if (sCode !== undefined && sCode !== null && sCode !== "" && !oSeen[sCode]) {
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
                    title: oVar.name,
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
                    text: "Guardar",
                    type: "Emphasized",
                    press: function () {
                        that._oVariantPopover.close();

                        // Se sobreescribe el estado de la variante activa con la configuracion actual.
                        const oCurrentState = that._getCurrentTableState();
                        if (oCurrentVariant) {
                            oCurrentVariant.state = oCurrentState;
                        }
                        that._saveVariantsToStorage();
                        oVModel.setProperty("/displayLabel", sCurrentName);
                        that._bVariantDirty = false;
                    }
                }));
            }

            aFooterContent.push(new sap.m.Button({
                text: "Guardar con nombre",
                type: bShowSave ? "Default" : "Emphasized",
                press: function () {
                    that._oVariantPopover.close();
                    that.onSaveVariantAs();
                }
            }));

            aFooterContent.push(new sap.m.ToolbarSpacer());

            aFooterContent.push(new sap.m.Button({
                text: "Gestionar",
                press: function () {
                    that._oVariantPopover.close();
                    that.onManageVariants();
                }
            }));

            const oFooter = new sap.m.Toolbar({ content: aFooterContent });

            this._oVariantPopover = new sap.m.Popover({
                title: "Mis vistas",
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
                    "Existen cambios sin guardar. ¿Desea continuar?",
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
                    oVModel.setProperty("/displayLabel", oVar.name);
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
                oVModel.setProperty("/displayLabel", oVar.name);
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

            const oInput = new sap.m.Input({
                value: oVModel.getProperty("/currentName"),
                placeholder: "Nombre de la vista",
                width: "100%"
            });

            // Se crea la casilla para definir la variante como estandar al guardar.
            const oCheckDefault = new sap.m.CheckBox({
                text: "Definir como estándar",
                selected: false
            }).addStyleClass("noLabelOverride");

            const oDialog = new sap.m.Dialog({
                title: "Guardar vista",
                contentWidth: "320px",
                content: [
                    new sap.m.VBox({
                        renderType: "Bare",
                        items: [
                            new sap.m.Label({
                                text: "Vista",
                                labelFor: oInput
                            }).addStyleClass("noLabelOverride"),
                            oInput,
                            oCheckDefault
                        ]
                    }).addStyleClass("sapUiSmallMargin")
                ],
                beginButton: new sap.m.Button({
                    text: "Guardar",
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
                        oVModel.setProperty("/displayLabel", sName);
                        that._bVariantDirty = false;

                        oDialog.close();
                    }
                }),
                endButton: new sap.m.Button({
                    text: "Cancelar",
                    press: function () { oDialog.close(); }
                }),
                afterClose: function () { oDialog.destroy(); }
            });

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
                    createdBy: oVar.isDefault ? "SAP" : "Usted",
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
                    new sap.m.Column({
                        header: new sap.m.Label({ text: "Vista" })
                    }),
                    new sap.m.Column({
                        header: new sap.m.Label({ text: "Por defecto" }),
                        width: "6rem",
                        hAlign: "Center"
                    }),
                    new sap.m.Column({
                        header: new sap.m.Label({ text: "Creado por" }),
                        width: "6rem"
                    }),
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
                            ? new sap.m.Text({ text: oItem.name }).addStyleClass("sapMTextBold")
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
                placeholder: "Buscar",
                width: "100%",
                search: function (oEvt) {
                    fnApplyFilter(oEvt.getParameter("query") || "");
                },
                liveChange: function (oEvt) {
                    fnApplyFilter(oEvt.getParameter("newValue") || "");
                }
            });

            const oDialog = new sap.m.Dialog({
                title: "Gestionar vistas",
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
                    text: "Guardar",
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
                    text: "Cancelar",
                    press: function () { oDialog.close(); }
                }),
                afterClose: function () { oDialog.destroy(); }
            });

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
        createMessageDialog: function (options) {
            // Se utiliza el fragmento precargado para crear físicamente el control del diálogo.
            const mDialog = messageDialog.createDialog(options, this);
            // Se añade como dependiente para asegurar el enrutamiento de modelos y su destrucción automática con la vista.
            this.getView().addDependent(mDialog);
            mDialog.open();
            return mDialog;
        },

        /**
         * Se recuperan los textos traducidos utilizando la clave proporcionada en el archivo de internacionalización (i18n).
         */
        getTranslatedText: function (key) {
            // Se extrae la cadena textual del paquete de recursos alojado a nivel global en el componente.
            return this.getGlobalModel("i18n").getResourceBundle().getText(key);
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
                    name: "masterindirectos.fragments.PopoverFilter",
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

            //     Se obtiene el numero de decimales con fallback a 2 si no es valido.
            var iDec = parseInt(decStr, 10);
            if (isNaN(iDec)) {
                iDec = 2;
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

            //  Se garantiza que el rango tenga siempre al menos 2 años visibles.
            //  Si Frealfinobra es anterior o igual a Freal se aplica un rango mínimo.
            if (iYearEnd <= iYearStart) {
                iYearEnd = iYearStart + 2;
            }

            // Se guardan el año de inicio y fin para usarlos al crear las columnas dinámicas.
            this._iYearStart = iYearStart;
            this._iYearEnd = iYearEnd;

            //  Se construye el array de años para el selector de ejercicio.
            var aYears = [];
            for (var i = iYearStart; i <= iYearEnd; i++) {
                aYears.push({ year: String(i) });
            }

            // Se asigna el modelo de años a la vista con el primer año como seleccionado por defecto.
            this.getView().setModel(new sap.ui.model.json.JSONModel({
                years: aYears,
                selectedYear: String(iYearStart)
            }), "yearsModel");
        },

        /**
            * Se abre el popover de seleccion de rangos mensuales.
            * Se utiliza CalendarMonthInterval para restringir la seleccion unicamente a meses y años.
            */
        onOpenRangePicker: function (oEvent, oAnchorControl, oExternalContext) {
            var oAnchor = oAnchorControl || oEvent.getSource();

            // Se usa this.tableModelName para que el picker funcione en cualquier vista hija.
            this._oActiveContext = oExternalContext || oAnchor.getBindingContext(this.tableModelName);

            if (!this._oRangePopover) {

                this._oCalendar = new sap.ui.unified.CalendarMonthInterval({
                    intervalSelection: true,
                    select: this.onDateSelected.bind(this)
                });
                this._oRangePopover = new sap.m.ResponsivePopover({
                    title: "Seleccionar Rango Mensual",
                    placement: "Bottom",
                    content: [this._oCalendar]
                });
                this.getView().addDependent(this._oRangePopover);
            }

            // Se obtiene el modelo usando tableModelName en lugar de corrientesModel hardcodeado.
            var oModel = this.getView().getModel(this.tableModelName);
            var sPath = this._oActiveContext.getPath();
            var dFrom = oModel.getProperty(sPath + "/_linDateFrom");
            var dTo = oModel.getProperty(sPath + "/_linDateTo");

            this._oCalendar.removeAllSelectedDates();
            if (dFrom && dTo) {
                this._oCalendar.addSelectedDate(new sap.ui.unified.DateRange({
                    startDate: dFrom,
                    endDate: dTo
                }));
            }
            this._oRangePopover.openBy(oAnchor);
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

                    // Se usa tableModelName para que el handler funcione en cualquier vista hija.
                    var oModel = this.getView().getModel(this.tableModelName);
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
                return "Seleccionar rango de fechas";
            }

            //   Se normaliza el valor recibido a objeto Date nativo independientemente
            //   de si llego como instancia Date o como cadena de texto parseable.
            var oFrom = dFrom instanceof Date ? dFrom : new Date(dFrom);
            var oTo = dTo instanceof Date ? dTo : new Date(dTo);

            //   Se verifica que ambas fechas resultantes sean validas antes de formatear
            //   para evitar mostrar "Invalid Date" en el tooltip de la interfaz.
            if (isNaN(oFrom.getTime()) || isNaN(oTo.getTime())) {
                return "Seleccionar rango de fechas";
            }

            //   Se instancia el formateador de fecha con el patron dd/MM/yyyy
            //   para presentar el rango en el formato habitual del mercado espanol.
            var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                pattern: "dd/MM/yyyy"
            });

            //   Se devuelve la cadena con el rango de fechas formateado y separado por guion.
            return oDateFormat.format(oFrom) + " - " + oDateFormat.format(oTo);
        },
        onRowInputChange: async function (oEvent) {

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

            let sNewValue;
            let sValorFormateado;

            //     Se incluyen editCtotPen y editCtot en la lista de propiedades
            // exclusivas del frontend que deben eliminarse antes de enviar al backend.
            var aFrontendOnlyProps = [
                "__metadata", "children", "parent", "padre", "isEditable",
                "isSubcapitulo", "isCapitulo", "isVacio", "isGroup",
                "expandible", "cabecera", "isNew", "_linDateFrom", "_linDateTo",
                "_Ejecutado", "_Pendiente", "_Total", "_isSinProveedor", "expanded",
                "editPhPspnr", "editPost1", "editTasa", "editAmoEje", "editAmoEjeAjus",
                "editAmoEjeReal", "editAmoPen", "editAmoTot", "editPepDest",
                "editTipo", "editPenPlan", "editMonths", "editPend",
                "editCtotPen", "editCtot"
            ];

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

                let oRow = oContext.getObject();
                let oPayloadRow = JSON.parse(JSON.stringify(oRow));

                aFrontendOnlyProps.forEach(function (sKey) {
                    delete oPayloadRow[sKey];
                });

                oPayloadRow.Tipo = sNewValue;
                this._enviarFilaAlBackend(oContext, oPayloadRow, "Tipo");
                return;
            }

            sNewValue = oSource.getValue();
            sValorFormateado = this._formatToSAPNumber(sNewValue);

            if (sCampoMod) {

                // Identificamos si es un campo de meses (ej: Val001a2024)
                const bIsMesField = /^Val\d{3}a\d+$/.test(sCampoMod);

                // Si NO es un campo de mes, aplicamos el filtro de comparacion para evitar llamadas inutiles
                if (!bIsMesField) {
                    var sValorActualModelo = oContext.getModel().getProperty(oContext.getPath() + "/" + sCampoMod);
                    var sValorActualNormalizado = this._formatToSAPNumber(
                        String(sValorActualModelo !== null && sValorActualModelo !== undefined ? sValorActualModelo : "")
                    );

                    // Si el valor no ha cambiado realmente, abortamos envio
                    if (sValorFormateado === sValorActualNormalizado) {
                        return;
                    }
                }
                // Si ES un campo de mes (bIsMesField === true), saltamos la comparacion y seguimos al envio
            }

            // Actualizamos el modelo antes de generar el objeto final
            if (sCampoMod && sValorFormateado !== null && sValorFormateado !== undefined && sValorFormateado !== "") {
                oContext.getModel().setProperty(oContext.getPath() + "/" + sCampoMod, sValorFormateado);
            }

            let oRow = oContext.getObject();
            let oPayloadRow = JSON.parse(JSON.stringify(oRow));

            aFrontendOnlyProps.forEach(function (sKey) {
                delete oPayloadRow[sKey];
            });

            if (sCampoMod && sValorFormateado !== null && sValorFormateado !== undefined && sValorFormateado !== "") {
                oPayloadRow[sCampoMod] = sValorFormateado;
            }

            this._enviarFilaAlBackend(oContext, oPayloadRow, sCampoMod);
        },

        //   Se añade CampoMod en cabecera para indicar el campo modificado al backend.
        //     Se envia la fila modificada al backend y se restaura el foco
        //     en el input destino si existe navegacion pendiente tipo Excel.
        _enviarFilaAlBackend: async function (oContext, oPayloadRow, sCampoMod) {

            var sEjercicio = this._getSelectedEjercicio() || new Date().getFullYear().toString();
            var oAppData = this.getGlobalModel("appData").getData();

            //     Se guarda el destino de foco antes de la llamada asincrona.
            var oPendingFocus = this._pendingFocusTarget || null;

            try {
                const response = await this.post(
                    this.getGlobalModel("mainService"),
                    "/GuardarTempIndirSet",
                    {
                        "NavSelProyecto": [oAppData.tramo],
                        "NavDatosIndirectos": [oPayloadRow],
                        "NavMensajes": []
                    },
                    {
                        noLoading: true,
                        headers: {
                            ambito: oAppData.userData.initialNode,
                            lang: oAppData.userData.AplicationLangu,
                            bloqueado: "",
                            decimales: "02",
                            ejercicio: sEjercicio,
                            pestana: this._pestana || "Corrientes",
                            CampoMod: sCampoMod || ""
                        }
                    }
                );

                //     Se restaura el foco tras completar la llamada asincrona.
                if (oPendingFocus && oPendingFocus.getDomRef()) {
                    setTimeout(function () {
                        oPendingFocus.focus();
                        if (oPendingFocus.select) oPendingFocus.select();
                    }, 50);
                }

                //     Se limpia el estado de foco pendiente.
                this._pendingFocusTarget = null;

            } catch (error) {


                //     Se limpia tambien en caso de error para evitar inconsistencias.
                this._pendingFocusTarget = null;
            }
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

            //     Se elimina el separador de miles escapandolo para usarlo de forma segura
            //     en la expresion regular sin que el punto actue como comodin.
            var sEscapedThousand = thousandSeparator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            sNormalized = sNormalized.replace(new RegExp(sEscapedThousand, "g"), "");

            //     Se sustituye el separador decimal del usuario por punto estandar SAP.
            sNormalized = sNormalized.replace(decimalSeparator, ".");
            var fParsed = parseFloat(sNormalized);
            if (!isNaN(fParsed)) {
                return fParsed.toFixed(5);
            }

            return sNormalized;
        },
        _executeBatchLineal: async function (oStartDate, oEndDate) {

            var oContext = this._oActiveContext;
            if (!oContext) return;

            var oModel = this.getView().getModel(this.tableModelName);
            var sPath = oContext.getPath();
            var oRowData = oModel.getProperty(sPath);
            if (!oRowData) return;

            //     Se incluyen editCtotPen y editCtot en la lista de propiedades
            // exclusivas del frontend que deben excluirse del payload enviado al backend.
            var aFrontendOnlyProps = [
                "__metadata", "children", "parent", "padre", "isEditable",
                "isSubcapitulo", "isCapitulo", "isVacio", "isGroup",
                "expandible", "cabecera", "isNew", "_linDateFrom", "_linDateTo",
                "_Ejecutado", "_Pendiente", "_Total", "_isSinProveedor", "expanded",
                "editPhPspnr", "editPost1", "editTasa", "editAmoEje", "editAmoEjeAjus",
                "editAmoEjeReal", "editAmoPen", "editAmoTot", "editPepDest",
                "editTipo", "editPenPlan", "editMonths", "editPend",
                "editCtotPen", "editCtot"
            ];

            var oPayloadRow = {};
            Object.keys(oRowData).forEach(function (sKey) {
                if (aFrontendOnlyProps.indexOf(sKey) === -1) {
                    oPayloadRow[sKey] = oRowData[sKey];
                }
            });

            // Se construyen Fini y Ffin a partir de los componentes ano/mes en UTC para evitar el desfase del huso horario local.   
            // Fini se ancla siempre al dia 1 del mes inicial seleccionado y Ffin al ultimo dia del mes final (dia 0 del mes siguiente).   
            // De este modo el valor /Date(ms)/ enviado al backend representa el rango "primer mes - ultimo mes" sin perder un dia por la conversion a UTC.   
            var iFiniMs = Date.UTC(oStartDate.getFullYear(), oStartDate.getMonth(), 1);
            var iFfinMs = Date.UTC(oEndDate.getFullYear(), oEndDate.getMonth() + 1, 0);

            oPayloadRow.Fini = "/Date(" + iFiniMs + ")/";
            oPayloadRow.Ffin = "/Date(" + iFfinMs + ")/";
            oPayloadRow.Tipo = "LIN";

            oModel.setProperty(sPath + "/Fini", oPayloadRow.Fini);
            oModel.setProperty(sPath + "/Ffin", oPayloadRow.Ffin);

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
                    __isMainEditable: true
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

            //   Primera apertura: se crea el header gris con __isCustom: true y con
            // los textos de etiqueta en cada campo para que las columnas del XML muestren
            // los titulos correctos. Sin estos valores los inputs del header aparecen vacios
            // porque el XML hace binding directo sobre los campos del objeto de modelo.
            // Las columnas fijas (PhPspnr, Post1, AmoEje...) usan value="{corrientesModel>campo}"
            // y las columnas custom (colProveedor, colTarifa...) usan value estatico en el XML,
            // por lo que solo las fijas necesitan el texto aqui en el objeto del modelo.
            const oHeaderRow = {
                __isCustom: true,
                __isHeader: true,
                cabecera: false, expandible: false, isGroup: false, padre: false,
                PhPspnr: "Agrupador",
                Post1: "Descripción",
                AmoEje: "Ejecutado",
                AmoEjeAjus: "Coste Ejec. Ajustado",
                AmoEjeReal: "Coste Ejec. Real",
                AmoPen: "Pendiente",
                AmoTot: "Total",
                Tipo: "Reparto",
                PenPlan: "Pend.planif.",
                Proveedor: "Proveedor",
                FEE: "", NMES: "", Otros: "",
                children: []
            };


            //   Se crea la fila editable principal para introducir el primer proveedor.
            const oMainEditable = Object.assign(this._createEmptyEditableRow(), {
                __isMainEditable: true
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



        onEditableRowFieldChange: function (oEvent) {
            const oInput = oEvent.getSource();
            const oContext = oInput.getBindingContext(this.tableModelName);
            if (!oContext) return;

            const oRow = oContext.getObject();
            if (!oRow.__isEditable) return;
            if (oRow.__processing) return;

            const sRawProveedor = (oRow.Proveedor || "").trim();
            const sProveedor = sRawProveedor.length > 0
                ? sRawProveedor.charAt(0).toUpperCase() + sRawProveedor.slice(1)
                : "";

            //   Fix 2: se restablece el ValueState en cuanto el campo se vacía,
            // sin esperar a que el usuario escriba un nuevo valor.
            if (!sProveedor) {
                oInput.setValueState(sap.ui.core.ValueState.None);
                oInput.setValueStateText("");
                //   Se elimina la fila solo si todos los demas campos relevantes
                // estan vacios. Si la fila tiene datos (AGRUP, FEE, etc.) se conserva
                // para no perder informacion introducida por el usuario.  
                if (oRow.__wasFilled && this._isRowEmpty(oRow)) {
                    this._removeEditableRow(oContext, this.getView().getModel(this.tableModelName), oRow);
                }
                return;
            }

            const sPath = oContext.getPath();
            const sParentPath = sPath.replace(/\/children\/\d+$/, "");
            const sRootRowPath = sParentPath;
            const oModel = this.getView().getModel(this.tableModelName);

            oInput.setValueState(sap.ui.core.ValueState.None);
            oRow.__wasFilled = true;
            oRow.__processing = true;

            const oRootRowCheck = oModel.getProperty(sRootRowPath);
            const bDuplicate = oRootRowCheck && Array.isArray(oRootRowCheck.children) &&
                oRootRowCheck.children.some(function (c) {
                    return c.__isProviderBlock === true && c.__providerName === sProveedor;
                });

            if (bDuplicate) {
                sap.m.MessageBox.error("Ya existe un bloque para el proveedor \"" + sProveedor + "\".");
                oInput.setValueState(sap.ui.core.ValueState.Error);
                oInput.setValueStateText("Ya existe un bloque para este proveedor.");
                oRow.__wasFilled = false;
                delete oRow.__processing;
                oModel.refresh(true);
                return;
            }

            const oRootRow = oModel.getProperty(sRootRowPath);
            if (sProveedor) {
                this._insertProveedorBlock(oRootRow, sProveedor, oRow);
            }
            if (oRootRow) this._cleanupEmptyBlocks(oRootRow);
            delete oRow.__processing;

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
                    //   Se inserta tras el último miembro del grupo.
                    let iInsert = iTargetTotal + 1;
                    while (
                        iInsert < oRootRow.children.length &&
                        oRootRow.children[iInsert].__isAgrupadorTotal !== true &&
                        oRootRow.children[iInsert].__isHeader !== true &&
                        oRootRow.children[iInsert].__isEditable !== true
                    ) {
                        iInsert++;
                    }
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

            aRows.forEach(function (oRow) {
                oRow.removeStyleClass("sinProveedorRow");
                oRow.removeStyleClass("headerGrayRow");
                oRow.removeStyleClass("agrupadorTotalRow");

                const oContext = oRow.getBindingContext(this.tableModelName);
                if (oContext) {
                    const oData = oContext.getObject();
                    //    Se aplica amarillo si es bloque principal, bloque de agrupador o fila editable custom
                    if (oData && (oData.__isSinProveedor === true || oData.__isSinAgrupador === true || oData.__isAgrupadorBlock === true)) {
                        oRow.addStyleClass("sinProveedorRow");
                    } else if (oData && oData.__isHeader === true) {
                        oRow.addStyleClass("headerGrayRow");
                    } else if (oData && oData.__isAgrupadorTotal === true) {
                        //   Fila de cabecera de grupo AGRUP con fondo gris claro y negrita
                        oRow.addStyleClass("agrupadorTotalRow");
                    }
                }
            }.bind(this));
        },
        _applyBlockBorder: function (oTable) {
            if (!oTable) return;

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

                if (!oCtx) continue;
                var oData = oCtx.getObject();
                if (!oData) continue;

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
                    oDom.querySelectorAll("td").forEach(function (td) {
                        td.style.setProperty("border-bottom", "2px solid #000000", "important");
                    });
                    if (oFixed) {
                        oFixed.querySelectorAll("td").forEach(function (td) {
                            td.style.setProperty("border-bottom", "2px solid #000000", "important");
                        });
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

            var oBinding = oTable.getBinding("rows");
            if (!oBinding) return;

            //    Se recorre el binding completo buscando al menos una fila
            // con el marcador __isCustom para determinar si hay bloques custom activos.
            var bHasCustomRows = false;
            var iLength = oBinding.getLength();
            for (var i = 0; i < iLength; i++) {
                var oCtx = oTable.getContextByIndex(i);
                if (!oCtx) continue;
                var oObj = oCtx.getObject();
                if (oObj && oObj.__isCustom === true) {
                    bHasCustomRows = true;
                    break;
                }
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
        //   Se guarda el contexto de la fila seleccionada en el viewModel,
        // se activa el panel inferior y se recalcula el número de filas visibles.
        //   Se muestra el panel inferior con la fila padre no editable y una
        // fila hija editable. Se excluye la columna AGRUP del contexto visible.
        //   Se inicializa el mapa persistente de filas por proveedor si aun no existe.
        // El mapa vive en la instancia del controlador y persiste hasta el reload de la pagina.
        // Clave: nombre del proveedor. Valor: array de filas del panel para ese proveedor.
        onProveedorRowAddPress: function (oEvent) {
            const oButton = oEvent.getSource();
            const oContext = oButton.getBindingContext(this.tableModelName);
            if (!oContext) return;

            const oRow = oContext.getObject();
            const sProveedor = (oRow.Proveedor || "").trim();
            if (!sProveedor) return;

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
                    rows: aFilasProveedor,
                    rowCount: aFilasProveedor.length
                });
                this.getView().setModel(oPanelModel, "panelModel");

                if (oPanelVBox) oPanelVBox.setVisible(true);

                if (bPanelCerrado && oPanelLayout) {
                    //   Solo se modifica el tamano del splitter si el panel estaba cerrado,
                    // para no alterar el resize manual del usuario entre cambios de proveedor.
                    oPanelLayout.setResizable(true);
                    oPanelLayout.setSize("200px");
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
                oPanelModel.setProperty("/rows", aFilasProveedor);
                oPanelModel.setProperty("/rowCount", aFilasProveedor.length);
            }
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

            // 3. Se restablece la altura del splitter: la TreeTable vuelve
            //    a ocupar la pantalla como si el splitter no existiera
            const oSplitter = this.byId("mainSplitter");
            if (oSplitter) oSplitter.setHeight("");

            setTimeout(function () {
                this._calculateDynamicRows();
            }.bind(this), 50);
        },


        onSplitterResize: function () {
            // Cuando el usuario arrastra el divisor interno se recalculan
            // solo las filas (la altura total del splitter no cambia).
            setTimeout(function () {
                this._calculateDynamicRows();
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

            if (!this._mProveedorRows) this._mProveedorRows = {};

            const aFilasProveedor = this._mProveedorRows[sProveedor] || [];
            const oPanelVBox = this.byId("panelVBox");
            const oPanelLayout = this.byId("panelSplitterLayout");
            const bPanelAbierto = oPanelVBox && oPanelVBox.getVisible();

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

            //   Si el proveedor pulsado ya está activo y el panel está abierto no se hace nada.
            if (bPanelAbierto && this._sCurrentProveedor === sProveedor) return;

            this._sCurrentProveedor = sProveedor;

            const oPanelModel = new sap.ui.model.json.JSONModel({
                proveedor: sProveedor,
                rows: aFilasProveedor,
                rowCount: aFilasProveedor.length
            });
            this.getView().setModel(oPanelModel, "panelModel");

            if (oPanelVBox) oPanelVBox.setVisible(true);

            if (!bPanelAbierto && oPanelLayout) {
                oPanelLayout.setResizable(true);
                oPanelLayout.setSize("200px");
                setTimeout(function () {
                    this._calculateSplitterHeight();
                }.bind(this), 30);
            }
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

            //   Editables SIN AGRUP: permanecen siempre bajo el header, antes que los grupos.
            const aEditablesNoAgrup = oRootRow.children.filter(function (c) {
                return c.__isEditable === true && !(c.AGRUP || "").trim();
            });

            //   Todo lo demás a agrupar: nietos + editables CON AGRUP.
            // Se excluyen header, agrupadorTotal y editables sin AGRUP.
            const aToGroup = oRootRow.children.filter(function (c) {
                return (
                    c.__isCustom === true &&
                    c.__isHeader !== true &&
                    c.__isAgrupadorTotal !== true &&
                    !(c.__isEditable === true && !(c.AGRUP || "").trim())
                );
            });

            console.log("[Reorg] aHeader:", aHeader.length,
                "| editabiliSenzaAgrup:", aEditablesNoAgrup.length,
                "| daRaggruppare:", aToGroup.length);

            //   Si no hay nada que agrupar no se hace nada.
            if (aToGroup.length === 0) {
                console.warn("[Reorg] Nessuna riga con AGRUP trovata, uscita.");
                return;
            }

            const mGroups = {};
            const aOrder = [];
            const aSinAgrup = []; //   Filas sin AGRUP que NO son editables puras

            aToGroup.forEach(function (oRiga) {
                const sAgrup = (oRiga.AGRUP || "").trim();
                if (!sAgrup) {
                    aSinAgrup.push(oRiga);
                    return;
                }
                if (!mGroups[sAgrup]) {
                    mGroups[sAgrup] = [];
                    aOrder.push(sAgrup);
                }
                mGroups[sAgrup].push(oRiga);
            });

            aOrder.sort(function (a, b) {
                const nA = parseFloat(a);
                const nB = parseFloat(b);
                if (!isNaN(nA) && !isNaN(nB)) return nA - nB;
                return a.localeCompare(b);
            });

            console.log("[Reorg] Gruppi:", aOrder);

            //   Orden final: header, editables sin AGRUP, [fila gris + miembros] y luego las que carecen de AGRUP
            const aNew = [];
            aHeader.forEach(function (h) { aNew.push(h); });
            aEditablesNoAgrup.forEach(function (e) { aNew.push(e); });

            aOrder.forEach(function (sAgrup) {
                aNew.push({
                    __isCustom: true,
                    __isAgrupadorTotal: true,
                    __agrupadorName: sAgrup,
                    cabecera: false, expandible: false, isGroup: false, padre: false,
                    PhPspnr: sAgrup,
                    AGRUP: sAgrup,
                    Post1: "Total Grupo: " + sAgrup,  //   Texto visible en la columna Descripción
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
                console.log("[Agrupador] Modalità OFF: righe grigie rimosse.");
            } else {
                //   Se enciende: se limpian los posibles totales obsoletos y se
                // reorganiza desde cero con los valores AGRUP actuales.
                oHeaderRow.__agrupadorActive = true;
                oRootRow.children = oRootRow.children.filter(function (c) {
                    return c.__isAgrupadorTotal !== true;
                });
                this._reorganizeByAgrupador(oRootRow);
                console.log("[Agrupador] Modalità ON: gruppi creati.");
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

            //   Si el modo agrupador no está activo no se hace nada.
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
            //   Se saltan todas las filas editables consecutivas.
            while (iPos < aChildren.length && aChildren[iPos].__isEditable === true) {
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
    });
});
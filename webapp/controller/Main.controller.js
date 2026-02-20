sap.ui.define(
  [
    "masterindirectos/controller/BaseController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
  ],
  function (BaseController, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return BaseController.extend("masterindirectos.controller.Main", {

      
      /**
       * Inicializa el controlador principal de la aplicación.
       * Se encarga de instanciar los modelos globales de alcance, tramos y estado de la interfaz.
       */
      onInit: async function () {
        // Establece el modelo de alcance inicial con los datos del centro de beneficio y sociedad.
        this.setGlobalModel(
          new JSONModel({
            idNode: "FIDEFERRC5081",
            profitCenter: "C5081",
            profitCenterDescription: "FASE SERVICIO DE MAQUINARIA",
            application: "FIDE",
            hierarchy: "FERR",
            normList: [],
            sites: [],
            status: "V",
            currency: "EUR",
            society: "50",
            idParent: null,
            country: "ES",
            region: "45",
            isSite: true,
            isC2: true,
            isUTE: false,
            isParque: true,
            isTramos: null,
            access: null,
          }),
          "selectedScopeModel",
        );

        // Define el tramo seleccionado por defecto para la carga inicial.
        this.setGlobalModel(
          new JSONModel({
            Proyecto: "00010813",
            ProyectoExt: "P.5081",
            Descripcion: "PARQUE DE MAQUINARIA SESEÑA ()",
            Prctr: "C5081",
            Tramos: "",
          }),
          "tramoSelectedModel",
        );

        // Carga la lista maestra de proyectos y tramos disponibles en la aplicación.
        this.setGlobalModel(
          new JSONModel([
            {
              Proyecto: "00010813",
              ProyectoExt: "P.5081",
              Descripcion: "PARQUE DE MAQUINARIA SESEÑA ()",
              Prctr: "C5081",
              Tramos: "",
            },
            {
              Proyecto: "00010826",
              ProyectoExt: "1.5081",
              Descripcion: "PARQUE DE MAQUINARIA SESEÑA TRAMO 1",
              Prctr: "C5081",
              Tramos: "X",
            },
            {
              Proyecto: "00010827",
              ProyectoExt: "2.5081",
              Descripcion: "PARQUE DE MAQUINARIA SESEÑA TRAMO 2",
              Prctr: "C5081",
              Tramos: "X",
            },
            {
              Proyecto: "00010828",
              ProyectoExt: "3.5081",
              Descripcion: "PARQUE DE MAQUINARIA SESEÑA TRAMO 3",
              Prctr: "C5081",
              Tramos: "X",
            },
            {
              Proyecto: "00010829",
              ProyectoExt: "4.5081",
              Descripcion: "PARQUE DE MAQUINARIA SESEÑA TRAMO 4",
              Prctr: "C5081",
              Tramos: "X",
            },
            {
              Proyecto: "00010830",
              ProyectoExt: "5.5081",
              Descripcion: "PARQUE DE MAQUINARIA SESEÑA TRAMO 5",
              Prctr: "C5081",
              Tramos: "X",
            },
            {
              Proyecto: "00010831",
              ProyectoExt: "6.5081",
              Descripcion: "PARQUE DE MAQUINARIA SESEÑA TRAMO 6",
              Prctr: "C5081",
              Tramos: "X",
            },
            {
              Proyecto: "00010832",
              ProyectoExt: "7.5081",
              Descripcion: "PARQUE DE MAQUINARIA SESEÑA TRAMO 7",
              Prctr: "C5081",
              Tramos: "X",
            },
            {
              Proyecto: "00010833",
              ProyectoExt: "8.5081",
              Descripcion: "PARQUE DE MAQUINARIA SESEÑA TRAMO 8",
              Prctr: "C5081",
              Tramos: "X",
            },
            {
              Proyecto: "00010834",
              ProyectoExt: "9.5081",
              Descripcion: "PARQUE DE MAQUINARIA SESEÑA TRAMO 9",
              Prctr: "C5081",
              Tramos: "X",
            },
            {
              Proyecto: "00010835",
              ProyectoExt: "A.5081",
              Descripcion: "PARQUE DE MAQUINARIA SESEÑA TRAMO 10",
              Prctr: "C5081",
              Tramos: "X",
            },
            {
              Proyecto: "00010836",
              ProyectoExt: "B.5081",
              Descripcion: "PARQUE DE MAQUINARIA SESEÑA TRAMO 11",
              Prctr: "C5081",
              Tramos: "X",
            },
            {
              Proyecto: "00010837",
              ProyectoExt: "C.5081",
              Descripcion: "PARQUE DE MAQUINARIA SESEÑA TRAMO 12",
              Prctr: "C5081",
              Tramos: "X",
            },
            {
              Proyecto: "00010598",
              ProyectoExt: "P.3ER",
              Descripcion: "INTEGRATOR SERVICES L3 HAL",
              Prctr: "C3ER",
              Tramos: "",
            },
            {
              Proyecto: "00010599",
              ProyectoExt: "1.3ER",
              Descripcion: "N2 CAR PARK",
              Prctr: "C3ER",
              Tramos: "X",
            },
            {
              Proyecto: "00010609",
              ProyectoExt: "2.3ER",
              Descripcion: "BRAVO",
              Prctr: "C3ER",
              Tramos: "X",
            },
          ]),
          "tramosModel",
        );

        this._bNodeExpanded = false;

        // Inicializa el modelo UI para controlar la visibilidad de cabeceras fijas y datos sticky.
        this.getView().setModel(
          new sap.ui.model.json.JSONModel({
            showStickyAgrupador: false,
            showStickyParent: false,
            showStickyChild: false,
            stickyHeaderData: {
              parent: {
                name: "",
                currency: "",
                amount: "",
                pricepending: "",
                pricetotal: "",
                size: "",
                last: "",
                months: "",
                pend: "",
                flag1: false,
                flag2: false
              },
              child: {
                name: "",
                currency: "",
                amount: "",
                pricepending: "",
                pricetotal: "",
                size: "",
                last: "",
                months: "",
                pend: "",
                flag1: false,
                flag2: false
              }
            },
            operacionesCombo: [],
            isEditMode: false,
            dynamicRowCount: 10
          }),
          "ui"
        );
        this.getView().getModel("ui").setProperty("/isEditMode", true);


        // Modelo para los indicadores numéricos superiores.
        var oModel = new sap.ui.model.json.JSONModel({
          data: [
            {
              title: "112.083,28",
              title2: "0,00",
              title3: "106.212,51",
              title4: "5.870,77",
            },
          ],
        });
        this.getView().setModel(oModel, "dataTitle");

        // Carga el modelo de datos principal desde el JSON externo.
        var oDataModel = new sap.ui.model.json.JSONModel("model/models.json");
        this.getView().setModel(oDataModel, "data");
        this._mViews = {};


        // INICIAMOS LA CONFIGURACION BASICA DE LA APLICACION CARGANDO LOS DATOS DEL USUARIO, LOS TRAMOS Y EL ACCESO

        const userConfig = await this.getUserConfig()
        const userInsite = await this.getUserInsite(userConfig);
        // delete userInsite.userData.userParameters;
        const userData = {
          ...userInsite.userData,
          ...userConfig
        }
        delete userData.userParameters;
        const appDataModel = new JSONModel({
          userData: userData,
          tramo: null
        });
        this.setGlobalModel(appDataModel, "appData");
        const tramo = await this.getTramos(userData);
        delete tramo.__metadata;
        appDataModel.setProperty("/tramo", tramo);

        const dashBoardData = await this.getDashboardData();
        const dashboardModel = new JSONModel({
          kpi: dashBoardData.NavKpisIndirectos.results,
          resumen: dashBoardData.NavResumenIndirectos.results
        });

        this.setGlobalModel(dashboardModel, "dashboardModel");

        this._showView("dashboard");
      },
      
      getDashboardData: async function () {
        return this.post(this.getGlobalModel("mainService"), "/AccesoIndirectosSet", {
          NavSelProyecto: [
            this.getGlobalModel("appData").getData().tramo
          ],
          NavMensajes: [],
          NavKpisIndirectos: [],
          NavResumenIndirectos: [],
        }, {
          headers: {
            ambito: this.getGlobalModel("appData").getData().userData.initialNode,
            lang: this.getGlobalModel("appData").getData().userData.AplicationLangu,
            norma: this.getGlobalModel("normModel").getData().norma || "",
          }
        }).then(function (response) {
          return response;
        }.bind(this));
      },

      getUserConfig: async function () {
        return this.post(this.getGlobalModel("mainService"), "/ConfigLoadSet", {
          NavEscenario1: [],
          NavEscenario2: [],
          NavEscenario3: [],
          NavLoadAmount: [],
          NavLoadDate: [],
          NavLoadLang: [],
          NavLoadUserConfig: []
        }).then(function (response) {

          if (response.NavLoadUserConfig.results.length > 0) {
            const userConfig = response.NavLoadUserConfig.results[0];

            return userConfig;
          }
        }.bind(this));

      },

      getUserInsite: async function (user) {
        let url = this.getEndpointData().urlInsite;
        return this.callExternalService(url + "/security/userLogin", "GET", {
          loginUser: user.User,
          idLanguage: user.AplicationLangu
        })
      },


      getTramos: async function (userData) {
        return new Promise((resolve, reject) => {

          this.getTramosByObra(userData.initialNode).then((response) => {

            if (response.NavTramosDatos.results.length > 0) {
              const norm = response.NavTramosDatos.results[0].Norma;
              const normModel = new JSONModel({
                norma: norm
              });
              this.setGlobalModel(normModel, "normModel");
            }

            if (response.NavTramosProy.results.length > 1) {

              this.openSelectorDialog({
                title: "Selecciona un tramo",
                columns: [
                  { label: "Tramo", property: "ProyectoExt" },
                  { label: "Descripción", property: "Descripcion" }
                ],

                onAccept: function (selectedItems) {
                  resolve(selectedItems[0]);
                }

              }, response.NavTramosProy.results);

            } else {
              resolve(response.NavTramosProy.results[0]);
            }

          }).catch(err => {
            reject(err);
          });

        });
      },



      /**
       * Alterna la visibilidad de la barra lateral de acciones.
       */
      onToggleSideBar: function () {
        var oSideBar = this.byId("sideActionToolbar");
        oSideBar.setVisible(!oSideBar.getVisible());
      },

      /**
       * Maneja el evento de selección en las pestañas para cargar la vista correspondiente.
       */
      onTabSelect: function (oEvent) {
        var sNewKey = oEvent.getParameter("key");
        var oIconTabBar = this.byId("itb");

        var sCurrentKey = this._lastSelectedKey || oIconTabBar.getSelectedKey();

        // Reinicia le columnas al salir de "corrientes"
        if (sCurrentKey === "corrientes" && sNewKey !== "corrientes") {
          this._resetCorrientesColumns();
        }

        // Comprueba si se está abandonando la vista "corrientes"
        if (sCurrentKey === "corrientes" && this._mViews["corrientes"]) {
          var oCorrientesController = this._mViews["corrientes"].getController();

          if (oCorrientesController.hasUnsavedChanges && oCorrientesController.hasUnsavedChanges()) {

            MessageBox.confirm("Hay cambios sin guardar. ¿Está seguro de que desea descartarlos?", {
              actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
              onClose: function (oAction) {
                if (oAction === MessageBox.Action.OK) {
                  if (oCorrientesController.resetInputs) {
                    oCorrientesController.resetInputs();
                  }

                  this._lastSelectedKey = sNewKey;
                  this._showView(sNewKey);
                } else {
                  oIconTabBar.setSelectedKey(sCurrentKey);
                }
              }.bind(this)
            });
            return;
          }
        }

        this._lastSelectedKey = sNewKey;
        this._showView(sNewKey);
      },

      // NUEVA FUNCIÓN POR AÑADIR
      _resetCorrientesColumns: function () {
        if (this._mViews["corrientes"]) {
          var oCorrientesController = this._mViews["corrientes"].getController();

          // Oculta las columnas
          var oColMonths = oCorrientesController.byId("colMonths");
          var oColNew = oCorrientesController.byId("colNew");

          if (oColMonths) oColMonths.setVisible(false);
          if (oColNew) oColNew.setVisible(false);

          // Restablece el modelo de IU si es necesario
          var oUiModel = oCorrientesController.getView().getModel("ui");
          if (oUiModel) {
            oUiModel.setProperty("/showStickyParent", false);
            oUiModel.setProperty("/showStickyChild", false);
          }
        }
      },

      /**
       * Inyecta dinámicamente la vista seleccionada en el contenedor de contenido.
       * Utiliza una caché interna (_mViews) para no volver a crear vistas ya instanciadas.
       */
      _showView: async function (sKey) {
        var oContainer = this.byId("tabContent");
        oContainer.removeAllItems();
        var oComp = this.getOwnerComponent();

        if (!this._mViews[sKey]) {
          this._mViews[sKey] = await oComp.runAsOwner(() =>
            sap.ui.xmlview({
              height: "100%",
              layoutData: new sap.m.FlexItemData({
                growFactor: 1
              }),
              viewName: "masterindirectos.view.DetailsViews." + this._mapKeyToView(sKey),
            })
          );
        }

        oContainer.addItem(this._mViews[sKey]);
      },

      /**
       * Mapea las claves de las pestañas con los nombres físicos de las vistas XML.
       */
      _mapKeyToView: function (sKey) {
        return {
          dashboard: "Dashboard",
           anticipados: "Anticipados",
          diferidos: "Diferidos",
          corrientes: "Corrientes",
          inmov: "Inmovilizados",
          externos: "Externos",
        }[sKey];
      },

      /**
       * Abre el diálogo de selección de alcance (Scope Selector) de manera asíncrona.
       * Gestiona la actualización de los modelos globales tras la selección del usuario.
       */
      getUserScopes: async function () {
        const appData = this.getGlobalModel("appData").getData();
        let url = this.getEndpointData().urlInsite;
        return this.callExternalService(url + "/security/userScopes", "GET", {
          loadAll: false,
          idUser: appData.userData.idUser,
          applicationCode: "FIDE",
          onlyStandard: false,
          idLanguage: appData.userData.AplicationLangu,
          erpNode: ""
        }).then(async function (response) {
          return {
            children: response.userNodeList
          }
        }.bind(this))

      },

      openScopeSelector: async function () {
         const userScopes = await this.getUserScopes();
        this.setGlobalModel(new JSONModel(userScopes), "scopeSelectorModel");

        const allTramos = await this.getTramosByObra();
        this.setGlobalModel(new JSONModel(allTramos.NavTramosProy.results), "allTramosModel");

        if (!this.oScopeSelectorView) {
          const oComp = this.getOwnerComponent();
          this.oScopeSelectorView = await oComp.runAsOwner(() =>
            sap.ui.core.mvc.XMLView.create({
              viewName: "masterindirectos.view.DialogsViews.ScopeSelector",
              viewData: {
                callback: function (oSelectedScope, tramoSelected) {
                  // Actualiza el modelo de alcance global con la nueva selección.
                  if (oSelectedScope) {
                    this.setGlobalModel(
                      new JSONModel(oSelectedScope),
                      "selectedScopeModel",
                    );
                  }
                  // Actualiza el tramo seleccionado basándose en la selección del diálogo.
                  if (tramoSelected) {
                    const selectedTramoModel =
                      this.getGlobalModel("tramoSelectedModel");
                    const tramosModel = this.getGlobalModel("tramosModel");
                    const tramoData = tramosModel
                      .getData()
                      .find((tramo) => tramo.ProyectoExt === tramoSelected);
                    selectedTramoModel.setData(tramoData);
                  } else {
                    // Si no hay tramo específico, busca el tramo por defecto del Centro de Beneficio.
                    const tramosModel = this.getGlobalModel("tramosModel");
                    const defaultTramo = tramosModel
                      .getData()
                      .filter(
                        (tramo) => tramo.Prctr === oSelectedScope.profitCenter,
                      )[0];
                    const selectedTramoModel =
                      this.getGlobalModel("tramoSelectedModel");
                    if (defaultTramo) {
                      selectedTramoModel.setData(defaultTramo);
                    } else {
                      selectedTramoModel.setData({});
                    }
                  }
                }.bind(this),
                close: function () {
                  this._oScopeSelectorDialog.close();
                  this._oScopeSelectorDialog.destroy();
                  this.oScopeSelectorView = null;
                }.bind(this),
              },
            }),
          );

          this._oScopeSelectorDialog = this.oScopeSelectorView.getContent()[0];
          this.getView().addDependent(this.oScopeSelectorView);
        }

        this._oScopeSelectorDialog.open();

      }


    });
  },
);


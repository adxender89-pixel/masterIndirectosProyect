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


        //Creo modelo de diferidos
        //this.setGlobalModel(new sap.ui.model.json.JSONModel(), "diferidosModel");
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

        this._showView("dashboard");
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
                callback: async function (oSelectedScope, tramoSelected) {
                  // Actualiza el modelo de alcance global con la nueva selección.
                  if (oSelectedScope) {
                    this.getGlobalModel("appData").setProperty("/userData/initialNode", oSelectedScope.profitCenter);
                    this.getGlobalModel("appData").setProperty("/userData/descriptionNode", oSelectedScope.profitCenterDescription);
                  }
                  // Actualiza el tramo seleccionado basándose en la selección del diálogo.
                  if (tramoSelected) {
                    delete tramoSelected.__metadata;
                    this.getGlobalModel("appData").setProperty("/tramo", tramoSelected);
                  } else {
                    // Si no hay tramo específico, busca el tramo por defecto.
                    const tramosModel = this.getGlobalModel("allTramosModel");
                    let defaultTramo = null;
                    defaultTramo = tramosModel
                      .getData()
                      .filter(
                        (tramo) => tramo.Prctr === oSelectedScope.profitCenter,
                      )[0];
                    delete defaultTramo.__metadata;
                    this.getGlobalModel("appData").setProperty("/tramo", defaultTramo);
                  }
                  // Si se ha seleccionado una obra específica, se actualiza el modelo de la aplicacion con la norma correspondiente a esa obra.
                  const tramosByObra = await this.getTramosByObra(oSelectedScope.profitCenter);
                  if (tramosByObra.NavTramosDatos.results.length > 0) {
                    const norm = tramosByObra.NavTramosDatos.results[0].Norma;
                    this.getGlobalModel("normModel").setProperty("/norma", norm);
                  }
                  this.setUserScopeData();
                }.bind(this),
                cancel: function () { },
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

      },

      setUserScopeData: function () {
        const appData = this.getGlobalModel("appData").getData();
        const userConfig = appData.userData;
        this.callExternalService(this.getEndpointData().urlInsite + "/menu/mainMenu", "GET", {
          idUser: userConfig.idUser,
          loginUser: userConfig.User,
          idLanguageApp: userConfig.AplicationLangu,
          idLanguage: userConfig.Langu,
          erpNode: userConfig.initialNode,
          erpCountry: null,
          erpRegion: null,
          idHierarchy: "FERR",
          idApplication: "FIDE"
        }).then(function (response) {
          //obtener la vista del icon tab bar para actualizar los datos
          const oIconTabBar = this.getView().byId("itb");
          const currentKey = oIconTabBar.getSelectedKey();
          const currentView = this._mViews[currentKey];
          if (currentView && currentView.getController().setInitData) {
            currentView.getController().setInitData();
          }

        }.bind(this));
      }


    });
  },
);


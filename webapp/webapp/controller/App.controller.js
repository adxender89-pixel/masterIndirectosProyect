sap.ui.define(
    [
        "sap/ui/core/mvc/Controller"
    ],
    function(BaseController) {
      "use strict";
  
      return BaseController.extend("masterindirectos.controller.App", {
        onInit: function() {
          // Aplica el modo compacto a la vista raíz
    this.getView().addStyleClass("sapUiSizeCompact");
    
    // Si usas sap.ui.table (t:TreeTable), puedes forzar el modo condensado
    //this.getView().addStyleClass("sapUiSizeCondensed");
        }
      });
    }
  );
  
sap.ui.define(["sap/ui/core/Control"], function (Control) {
  "use strict";
  return Control.extend("masterindirectos.control.GraphicBar", {
    metadata: {
      properties: {
        data: { type: "any", defaultValue: [] },
        grouped: { type: "boolean", defaultValue: true },
        barThickness: { type: "int", defaultValue: 15 },
        borderRadius: { type: "int", defaultValue: 0 },
        width: { type: "sap.ui.core.CSSSize", defaultValue: "100%" },
        height: { type: "sap.ui.core.CSSSize", defaultValue: "100%" }
      },
      aggregations: {
        layoutData: { type: "sap.ui.core.LayoutData", multiple: false }
      }
    },

    init: function () {

    },

    renderer: function (oRm, oControl) {
      oRm.write('<canvas class="barras" id="' + oControl.getId() + '-barChart" />');
    },

    onAfterRendering: function () {
      const data = this.getData();
      if (!data || data.length === 0) {
        return;
      }
      new Chart(document.getElementById(this.getId() + "-barChart"), {
        type: 'bar',
        data: {
          labels: data.labelsData,
          datasets: data.datasetsData.map((dataset, index) => ({
            label: data.labelsBar[index],
            data: dataset[0],
            backgroundColor: ["rgba(255, 220, 160, 0.9)", "rgba(210, 160, 0, 0.95)", "rgba(255, 190, 0, 0.95)"][index],
            grouped: this.getGrouped(),
            barThickness: this.getBarThickness(),
            borderRadius: this.getBorderRadius(),
            order: index + 1
          }))
        },
        options: {
          indexAxis: "y",   // horizontal
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom" },
            tooltip: {
              callbacks: {
                label: ctx =>
                  `${ctx.dataset.label}: ${ctx.raw.toLocaleString("es-ES")} €`
              }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              grid: { color: "rgba(0,0,0,0.1)" },
              ticks: {
                callback: v => v.toLocaleString("es-ES")
              }
            },
            y: {
              grid: { display: false }
            }
          }
        }
      });
    }



  });
});
sap.ui.define(["sap/ui/core/Control"], function (Control) {
    "use strict";
    return Control.extend("masterindirectos.control.GraphicBar", {
        metadata: {
            properties: {
                data: { type: "any", defaultValue: [] },
                labels: { type: "any", defaultValue: [] }
            },
            aggregations: {
                layoutData: { type: "sap.ui.core.LayoutData", multiple: false }
            }
        },


        init: function () {

        },

        renderer: function (oRm, oControl) {
            oRm.write('<canvas id="' + oControl.getId() + '-pie" ');
            oRm.write('style="height:100%; width:100%;" ');
            oRm.write("></canvas>");
        },

        onAfterRendering: function () {
            this.data = this.getData().data;
            if (!this.data || this.data.length === 0) {
                return;
            }

            const centerText = {
                id: "centerText",
                afterDraw: function (chart) {
                    const ctx = chart.ctx;
                    const data = this.data;
                    const total = data.reduce((a, b) => a + b, 0);
                    if (!total) return;
                    const meta = chart.getDatasetMeta(0);

                    meta.data.forEach((arc, i) => {
                        const value = data[i];
                        const percent = Math.round((value / total) * 100);
                        if (percent === 0) return;

                        const angle = (arc.startAngle + arc.endAngle) / 2;
                        const radius = (arc.outerRadius + arc.innerRadius) / 2;

                        const x = arc.x + Math.cos(angle) * radius;
                        const y = arc.y + Math.sin(angle) * radius;

                        ctx.save();
                        ctx.fillStyle = "#000";
                        ctx.font = "bold 12px Arial";
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(percent + "%", x, y);
                        ctx.restore();
                    });
                }.bind(this)
            };
            new Chart(document.getElementById(this.getId() + "-pie"), {
                type: "pie",
                data: {
                    labels: this.getLabels(),
                    datasets: [{
                        data: this.data,
                        backgroundColor: ["#D4A100", "#FFE0A3"],
                        borderWidth: 2,
                        borderColor: "#fff"
                    }]
                },
                options: {
                    plugins: {
                        legend: {
                            display: true,
                            position: "right",
                            labels: {
                                boxWidth: 15,
                                padding: 5
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: ctx =>
                                    `${ctx.label}: ${ctx.raw.toLocaleString("es-ES")} €`
                            }
                        }
                    }
                },
                plugins: [centerText]
            });
        }



    });
});
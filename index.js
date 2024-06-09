var toitsSorted = [];
var toitsYear = [];
var countType = [];
var selectedYear = 2019;
var statGroups = [];

// marges
const margin = { top: 50, right: 50, bottom: 30, left: 50 };

// Barplot
// conteneur du barplot
const barContainer = d3.select("#barplot");
const barWidth = parseInt(barContainer.style("width"));
const barHeight = parseInt(barContainer.style("height"));
const barInnerWidth = barWidth - margin.left - margin.right;
const barInnerHeight = barHeight - margin.top - margin.bottom;

// svg du barplot
const barsvg = barContainer.append("svg")
    .attr("width", barWidth)
    .attr("height", barHeight);

// g du barplot
const barg = barsvg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// echelle x du barplot
var barx = d3.scaleBand()

// echelle y du barplot
var bary = d3.scaleLinear()

// Boxplot
// Conteneur du boxplot
const boxContainer = d3.select("#boxplot");

// conteneur du boxplot
const boxWidth = parseInt(boxContainer.style("width"));
const boxHeight = parseInt(boxContainer.style("height"));
const boxInnerWidth = boxWidth - margin.left - margin.right;
const boxInnerHeight = boxHeight - margin.top - margin.bottom;

const boxMaxLower = 800;
const boxMinUpper = 2000;
const boxBreakHeight = 0.3;
const boxBreakWidth = 15;

// svg du boxplot
const boxsvg = boxContainer.append("svg")
    .attr("width", boxWidth)
    .attr("height", boxHeight);

// g du boxplot
const boxg = boxsvg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

// echelle x du boxpot
var boxx = d3.scaleBand()

// echelles y du boxplot
var boxyLower = d3.scaleLinear()
var boxyUpper = d3.scaleLinear()

document.addEventListener("DOMContentLoaded", function (event) {
    Promise.all([
        d3.json("data/toit_vert.geojson"),
        d3.json("data/bat_horsol.geojson"),
        d3.json("data/lac_rhone_arve.geojson"),
        d3.json("data/communes.geojson")
    ]).then(function (data) {
        toits = data[0];
        batiments = data[1];
        lacFleuves = data[2];
        communes = data[3];

        // Sélectionne le bouton radio de l'année 2019
        document.getElementById("button2019").checked = true;

        // ordonner toits selon type
        toitsSorted = d3.sort(toits.features, (d) => d.properties.NOMEN_CLAS);

        // toits à dessiner
        toitsYear = toitsSorted.filter(feature => feature.properties.ANNEE <= selectedYear);

        // Compte les types de batiments
        count_types();

        // Dessine la carte
        draw_map();

        // Dessine l'histogramme pour les types de batiments
        draw_barplot();

        // Dessine les box plots
        draw_boxplot();
    });
});

function count_types() {
    countType = Object.fromEntries(d3.rollup(
        toitsYear,
        D => D.length,
        d => d.properties.NOMEN_CLAS
    ));
}

function draw_map() {
    // Conteneur de la carte
    const container = d3.select("#map");

    const maxZoom = 20;

    // Zoom event
    const zoom = d3.zoom()
        .scaleExtent([1, maxZoom])
        .on("zoom", zoomed);

    // Dimensions de la carte
    const width = parseInt(container.style("width"));
    const height = parseInt(container.style("height"));

    // Ajout du SVG au conteneur map
    const svg = container.append("svg")
        .attr("width", width)
        .attr("height", height)
        .call(zoom);

    const g = svg.append("g");

    // Projection
    const projection = d3.geoMercator().fitExtent([[0, 0], [width, height]], toits);

    // Génératuer de path, dessine la carte à partir des points
    pathGenerator = d3.geoPath().projection(projection)

    // Dessine les élements de la carte
    // fond de carte
    g.append("rect")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("fill", "white");

    // communes
    g.append('path')
        .datum(communes)
        .attr('d', pathGenerator)
        .attr('fill', '#eee')
        .attr('stroke', '#222')
        .attr('stroke-width', 0.08)
        .attr('id', 'communes')

    // lac et fleuves
    g.append('path')
        .datum(lacFleuves)
        .attr('d', pathGenerator)
        .attr('fill', '#B0E0E6')
        .attr('stroke', 'none')
        .attr('id', 'lacFleuves')

    // batiments
    g.append('path')
        .datum(batiments)
        .attr('d', pathGenerator)
        .attr('fill', '#666')
        .attr('stroke', 'none')
        .attr('id', 'batiments')

    // toits
    g.selectAll('path')
        .data(toitsYear)
        .enter()
        .append('path')
        .attr('d', pathGenerator)
        .attr('fill', function (d) { return set_color(d.properties.NOMEN_CLAS, d.properties.ANNEE) })
        .attr('stroke', 'none')
        .classed('toits', true)
        .on('mouseover', function (event, d) {
            if (d.properties.ANNEE <= selectedYear) {
                highlight_type(d.properties.NOMEN_CLAS);
            }
        })

        .on('mouseout', function (event, d) {
            if (d.properties.ANNEE <= selectedYear) {
                reset_colors();
            }
        });

    const baseFontSize = 10;
    const minFontSize = 5;
    const maxZoomText = 10;

    g.selectAll("text")
        .data(communes.features)
        .enter()
        .append("text")
        .attr("x", function (d) { return pathGenerator.centroid(d)[0]; })
        .attr("y", function (d) { return pathGenerator.centroid(d)[1]; })
        .attr("text-anchor", "middle")
        .attr("font-size", baseFontSize + "px")
        .attr("fill", "rgba(0, 0, 0, 0.7)")
        .style("pointer-events", "none")
        .text(function (d) { return d.properties.name; });

    // Fonction de zoom
    function zoomed({ transform }) {
        g.attr("transform", transform);

        // taille du nom des communes
        const scaleFactor = d3.scaleSqrt()
            .domain([1, maxZoomText])
            .range([baseFontSize, minFontSize]);
        g.selectAll("text").attr("font-size", scaleFactor(transform.k) + "px");

        // affiche ou non les noms des communes
        if (transform.k > maxZoomText) {
            g.selectAll("text").attr("display", "none");
        } else {
            g.selectAll("text").attr("display", "block");
        }
    }
}

function draw_barplot() {
    // Echelle x du barplot
    barx = d3.scaleBand()
        .domain(Object.keys(countType))
        .range([0, barInnerWidth])
        .padding(0.1);

    // Echelle y du barplot
    bary = d3.scaleLinear()
        .domain([0, d3.max(Object.values(countType))])
        .range([barInnerHeight, 0]);

    // Ajout des barres
    barg.selectAll("rect")
        .data(Object.entries(countType))
        .enter()
        .append("rect")
        .attr("x", d => barx(d[0]))
        .attr("y", d => bary(d[1]))
        .attr("width", barx.bandwidth())
        .attr("height", d => barInnerHeight - bary(d[1]))
        .attr("fill", d => set_color(d[0], 0))
        .attr("class", "bar")
        // interactivité avec la souris
        .on("mouseover", function (event, d) {
            tooltip.attr('x', barx(d[0]) + barx.bandwidth() / 2)
                .attr('y', bary(d[1]) - 5)
                .text(d[1]);

            highlight_type(d[0]);
        })
        .on("mouseout", function () {
            tooltip.text("");
            reset_colors();
        });


    // Tooltip
    const tooltip = barg.append("text")
        .attr("class", "tooltip")
        .attr("fill", "black")
        .style("text-anchor", "middle")
        .style("pointer-events", "none");


    // Ajout de l'axe des x
    barg.append("g")
        .attr("transform", `translate(0,${barInnerHeight})`)
        .call(d3.axisBottom(barx))
        .selectAll("text")
        .attr("dy", "0.35em")
        .attr("font-size", "0.6vw");


    // Ajout de l'axe des y
    barg.append("g")
        .call(d3.axisLeft(bary));

    // Ajout du titre au barplot
    barsvg.append("text")
        .attr("x", barWidth / 2)
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "0.9vw")
        .attr("font-weight", "bold")
        .text("Nombre de toits végétalisés selon le type d'usage des bâtiments");
}

// Met à jour le barplot en fonction de l'annee
function update_barplot() {
    barg.selectAll(".bar")
        .data(Object.entries(countType))
        .transition()
        .duration(200)
        .attr("x", d => barx(d[0]))
        .attr("y", d => bary(d[1]))
        .attr("width", barx.bandwidth())
        .attr("height", d => barInnerHeight - bary(d[1]))
        .attr("fill", d => set_color(d[0], 0))
        .attr("class", "bar")
}

function draw_boxplot() {
    // Calculer les quantiles pour chaque type de toit
    var toitsGroups = d3.group(toitsYear, d => d.properties.NOMEN_CLAS);
    toitsGroups.forEach((group) => {
        const shapeAreas = group.map(d => d.properties.SHAPE_AREA).sort(d3.ascending);

        statGroups.push({
            q1: d3.quantile(shapeAreas, 0.25),
            median: d3.quantile(shapeAreas, 0.5),
            q3: d3.quantile(shapeAreas, 0.75),
            min: d3.min(shapeAreas),
            max: d3.max(shapeAreas),
            type: group.map(d => d.properties.NOMEN_CLAS)[0]
        });
    });

    // Echelle de x
    boxx = d3.scaleBand()
        .domain(statGroups.map(d => d.type))
        .range([0, boxInnerWidth])
        .padding(0.1);

    // Echelle de y
    boxyLower = d3.scaleLinear()
        .domain([0, boxMaxLower])
        .range([boxInnerHeight, boxInnerHeight * boxBreakHeight]);

    boxyUpper = d3.scaleLinear()
        .domain([boxMinUpper, d3.max(statGroups, d => d.max)])
        .range([boxInnerHeight * boxBreakHeight - boxBreakWidth, 0]);

    // Ajout de la ligne de min à max
    // bas
    boxg.selectAll("minMaxLineLower")
        .data(statGroups)
        .enter()
        .append("line")
        .attr("class", "minMaxLineLower")
        .attr("x1", function (d) { return (boxx(d.type) + boxx.bandwidth() / 2) })
        .attr("x2", function (d) { return (boxx(d.type)) + boxx.bandwidth() / 2 })
        .attr("y1", function (d) { return (boxyLower(d.min)) })
        .attr("y2", function (d) { return (boxyLower(d3.min([d.max, boxMaxLower]))) })
        .attr("stroke", "black")
        .style("width", 60)

    // haut
    boxg.selectAll("minMaxLineUpper")
        .data(statGroups)
        .enter()
        .append("line")
        .attr("class", "minMaxLineUpper")
        .attr("x1", function (d) { return (boxx(d.type) + boxx.bandwidth() / 2) })
        .attr("x2", function (d) { return (boxx(d.type)) + boxx.bandwidth() / 2 })
        .attr("y1", function (d) { return (boxyUpper(boxMinUpper)) })
        .attr("y2", function (d) { return (boxyUpper(d3.max([d.max, boxMinUpper]))) })
        .attr("stroke", "black")
        .style("width", 60)

    // Ajout des lignes de cassure
    // bas
    boxg.selectAll("breakLineLower")
        .data(statGroups)
        .enter()
        .append("line")
        .attr("class", "breakLineLower")
        .attr("x1", function (d) { return (boxx(d.type) + boxx.bandwidth() * 0.25) })
        .attr("x2", function (d) { return (boxx(d.type) + boxx.bandwidth() * 0.75) })
        .attr("y1", function (d) { return (boxyLower(boxMaxLower) + 2) })
        .attr("y2", function (d) { return (boxyLower(boxMaxLower) - 2) })
        .attr("stroke", d => d.max > boxMinUpper ? "black" : "none")
        .style("width", 60)

    // haut
    boxg.selectAll("breakLineUpper")
        .data(statGroups)
        .enter()
        .append("line")
        .attr("class", "breakLineUpper")
        .attr("x1", function (d) { return (boxx(d.type) + boxx.bandwidth() * 0.25) })
        .attr("x2", function (d) { return (boxx(d.type) + boxx.bandwidth() * 0.75) })
        .attr("y1", function (d) { return (boxyUpper(boxMinUpper) + 2) })
        .attr("y2", function (d) { return (boxyUpper(boxMinUpper) - 2) })
        .attr("stroke", d => d.max > boxMinUpper ? "black" : "none")
        .style("width", 60)

    // Ajout des boites
    boxg.selectAll("box")
        .data(statGroups)
        .enter()
        .append("rect")
        .attr("class", "box")
        .attr("x", function (d) { return (boxx(d.type)) })
        .attr("y", function (d) { return (boxyLower(d.q3)) })
        .attr("height", function (d) { return (boxyLower(d.q1) - boxyLower(d.q3)) })
        .attr("width", boxx.bandwidth())
        .attr("stroke", "none")
        .attr("fill", d => set_color(d.type, 0))
        .on("mouseover", function (event, d) {
            tooltip.attr('x', boxx(d.type) + boxx.bandwidth() / 2)
                .attr('y', boxyLower(d.median) - 5)
                .text(d3.format(".0f")(d.median));

            highlight_type(d.type);
        })
        .on("mouseout", function () {
            tooltip.text("");
            reset_colors();
        });

    // Ajout des lignes medianes
    boxg.selectAll("medianLines")
        .data(statGroups)
        .enter()
        .append("line")
        .attr("class", "medianLine")
        .attr("x1", function (d) { return (boxx(d.type)) })
        .attr("x2", function (d) { return (boxx(d.type) + boxx.bandwidth()) })
        .attr("y1", function (d) { return (boxyLower(d.median)) })
        .attr("y2", function (d) { return (boxyLower(d.median)) })
        .attr("stroke", "black")
        .style("width", 60)

    // Ajout de l'axe des x
    boxg.append("g")
        .attr("transform", `translate(0,${boxInnerHeight})`)
        .call(d3.axisBottom(boxx))
        .selectAll("text")
        .attr("dy", "0.35em")
        .attr("font-size", "0.6vw")

    // Ajout de l'axe des y
    // bas
    boxg.append("g")
        .call(d3.axisLeft(boxyLower));

    // haut
    boxg.append("g")
        .call((d3.axisLeft(boxyUpper))
            .ticks(3));

    const tooltip = boxg.append("text")
        .attr("class", "tooltip")
        .attr("fill", "black")
        .style("text-anchor", "middle")
        .style("pointer-events", "none");

    // Ajout du titre au boxplot
    boxsvg.append("text")
        .attr("x", boxWidth / 2)
        .attr("y", margin.top / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "0.9vw")
        .attr("font-weight", "bold")
        .html("Surface occupée (en m&sup2;) par les toits végétalisés selon le type d'usage des bâtiments");
}

// Mets à jour le boxplot
function update_boxplot() {
    console.log(statGroups);

    // ligne de min à max
    // bas
    boxg.selectAll(".minMaxLineLower")
        .data(statGroups)
        .transition()
        .duration(200)
        .attr("x1", d => boxx(d.type) + boxx.bandwidth() / 2)
        .attr("x2", d => boxx(d.type) + boxx.bandwidth() / 2)
        .attr("y1", d => boxyLower(d.min))
        .attr("y2", d => boxyLower(d3.min([d.max, boxMaxLower])));

    // haut
    boxg.selectAll(".minMaxLineUpper")
        .data(statGroups)
        .transition()
        .duration(200)
        .attr("x1", d => boxx(d.type) + boxx.bandwidth() / 2)
        .attr("x2", d => boxx(d.type) + boxx.bandwidth() / 2)
        .attr("y1", d => boxyUpper(boxMinUpper))
        .attr("y2", d => boxyUpper(d3.max([d.max, boxMinUpper])));

    // lignes de cassure
    // bas
    boxg.selectAll(".breakLineLower")
        .data(statGroups)
        .transition()
        .duration(200)
        .attr("x1", d => boxx(d.type) + boxx.bandwidth() * 0.25)
        .attr("x2", d => boxx(d.type) + boxx.bandwidth() * 0.75)
        .attr("y1", d => boxyLower(boxMaxLower) + 2)
        .attr("y2", d => boxyLower(boxMaxLower) - 2)
        .attr("stroke", d => d.max > boxMinUpper ? "black" : "none");

    // haut
    boxg.selectAll(".breakLineUpper")
        .data(statGroups)
        .transition()
        .duration(200)
        .attr("x1", d => boxx(d.type) + boxx.bandwidth() * 0.25)
        .attr("x2", d => boxx(d.type) + boxx.bandwidth() * 0.75)
        .attr("y1", d => boxyUpper(boxMinUpper) + 2)
        .attr("y2", d => boxyUpper(boxMinUpper) - 2)
        .attr("stroke", d => d.max > boxMinUpper ? "black" : "none");

    // boites
    boxg.selectAll(".box")
        .data(statGroups)
        .transition()
        .duration(200)
        .attr("x", d => boxx(d.type))
        .attr("y", d => boxyLower(d.q3))
        .attr("height", d => boxyLower(d.q1) - boxyLower(d.q3))
        .attr("width", boxx.bandwidth())
        .attr("fill", d => set_color(d.type, 0));

    // medianes
    boxg.selectAll(".medianLine")
        .data(statGroups)
        .transition()
        .duration(200)
        .attr("x1", d => boxx(d.type))
        .attr("x2", d => boxx(d.type) + boxx.bandwidth())
        .attr("y1", d => boxyLower(d.median))
        .attr("y2", d => boxyLower(d.median));
}

// Met en avant un type de toit, les autres types sont mis en gris
function highlight_type(type) {
    // toits sur la carte
    d3.selectAll('.toits')
        .attr('fill', function (d) {
            return d.properties.NOMEN_CLAS === type ? set_color(type, d.properties.ANNEE) : '#666';
        });

    // barplot
    d3.selectAll('.bar')
        .attr('fill', function (d) {
            return d[0] === type ? set_color(type, 0) : '#d3d3d3';
        });

    // boxlot
    d3.selectAll('.box')
        .attr('fill', function (d) {
            return d.type === type ? set_color(type, 0) : '#d3d3d3';
        });
}

// Remet les couleurs par défaut
function reset_colors() {
    // toits sur la carte
    d3.selectAll('.toits')
        .attr('fill', function (d) { return set_color(d.properties.NOMEN_CLAS, d.properties.ANNEE); });

    // barplot
    d3.selectAll('.bar')
        .attr('fill', function (d) { return set_color(d[0], 0); });

    // boxlot
    d3.selectAll('.box')
        .attr('fill', function (d) { return set_color(d.type, 0); });
}

// Choisir la couleur en fonction de NOMEN_CLAS
function set_color(type, year) {

    if (year <= selectedYear) {
        if (type == "Habitation") {
            return '#377eb8'
        }
        else if (type == "Activité") {
            return '#e41a1c'
        }
        else if (type == "Equipement collectif") {
            return '#4daf4a'
        }
        else if (type == "Mixte logements et activités") {
            return '#984ea3'
        }
        else if (type == "Autre") {
            return '#ff7f00'
        }
    }
    return 'none';
}

// Ecouteur d'evenement sur le bouton radio
document.querySelectorAll('input[name="yearButton"]').forEach(function (radio) {
    radio.addEventListener('change', function () {
        selectedYear = this.value;

        // Filtrer les toits en fonction de l'annee
        toitsYear = toitsSorted.filter(feature => feature.properties.ANNEE <= selectedYear);
        count_types();

        // Calculer les quantiles pour chaque type de toit
        statGroups = [];
        var toitsGroups = d3.group(toitsYear, d => d.properties.NOMEN_CLAS);
        toitsGroups.forEach((group) => {
            const shapeAreas = group.map(d => d.properties.SHAPE_AREA).sort(d3.ascending);

            statGroups.push({
                q1: d3.quantile(shapeAreas, 0.25),
                median: d3.quantile(shapeAreas, 0.5),
                q3: d3.quantile(shapeAreas, 0.75),
                min: d3.min(shapeAreas),
                max: d3.max(shapeAreas),
                type: group.map(d => d.properties.NOMEN_CLAS)[0]
            });
        });

        // Mettre à jour le barplot
        update_barplot();

        // Mettre à jour le boxplot
        update_boxplot();

        // Mettre à jour les couleurs des toits
        d3.selectAll('.toits')
            .attr('fill', function (d) { return set_color(d.properties.NOMEN_CLAS, d.properties.ANNEE); });
    });
});
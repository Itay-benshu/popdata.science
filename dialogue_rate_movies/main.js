
// Config
var MOVIES = ['Fight Club', 'Scott Pilgrim', 'Guardians of the Galaxy', 'Pulp Fiction', 'Birdman']
var VIDEO_MINIMIZED_WIDTH = 100;
var VIDEO_MINIMIZED_HEIGHT = 80;
var VIDEO_MAXIMIZED_WIDTH = 600;
var VIDEO_MAXIMIZED_HEIGHT = 300;
var TRANSITION_DURATION = 3000;

// Global variables
var width;
var height;
var margin;
var maxX;
var maxY;
var xScale;
var yScale;
var carouselMovie;
var plottedMovie;

// Initializes carousel
// Adjusts some variables for mobile display
$(document).ready(function() { 
    for (movie in MOVIES) {
        $('.glide__slides').append('<li class="glide__slide"><div class="posterContainer"><img class="poster" src="/post/work1/plot_data/{}/poster.jpg"></img></div></li>'.replace('{}', MOVIES[movie]))
    }
    if (window.innerWidth < 800) {
      perView = 1;
      VIDEO_MINIMIZED_WIDTH /= 2;
      VIDEO_MINIMIZED_HEIGHT /= 2;
      VIDEO_MAXIMIZED_WIDTH /= 2;
      VIDEO_MAXIMIZED_HEIGHT /= 2;
    }
    else {
      perView = 5;
    }
     glide = new Glide('.glide',
     {type: 'carousel',
      perView: perView,
      focusAt: 'center',
      dragThreshold:false,
      swipeThreshold:false,
     animationDuration:250}).mount()

     glide.on('move.after', function() {
       carouselMovie = MOVIES[glide.index]
     })
     
    // Listening to movie changes via an interval to throttle calls to showGraph
    window.setInterval(function() {
        if (carouselMovie != plottedMovie) {
            plottedMovie = carouselMovie;
            movieChosen(carouselMovie);
        }
    }, 1000);
})

// This is triggered by the on-change event of the movie carousel
function movieChosen(movie) {
    d3.json('/post/work1/plot_data/{0}/out.json'.replace('{0}', movie)).then(
                                                        function(data) { 
                                                          $('svg').remove();
                                                          showGraph(data)
                                                        });      
}

// Plots the entire graph for a specific movie chosen, post data loading.
function showGraph(data) {
  $('.container, .overlay').css("width", '100%')
  $('.container, .overlay').css("height", '400')
  
  // 2. Use the margin convention practice
  margin = {top: 50, right: 25, bottom: 50, left: 50}
    , width = (window.innerWidth - margin.left - margin.right) // Use the window's width
    , height = $('.container').height() - margin.top - margin.bottom; // Use the window's height

  // The number of datapoints
  var n = data['line_x'].length 
  maxX = Math.max(...data['line_x'])
  maxY = Math.max(...data['line_y'])
  
  // X scale
  xScale = d3.scaleLinear()
      .domain([0, maxX]) // input
      .range([0, width]); // output

  // Y scale
  yScale = d3.scaleLinear()
      .domain([0, maxY]) // input
      .range([height*0.8, height*0.2]); // output

  // d3 line generator
  var line = d3.line()
      .x(function(d, i) { return xScale(i); }) // set the x values for the line generator
      .y(function(d) { return yScale(d); }) // set the y values for the line generator
      .curve(d3.curveMonotoneX) // apply smoothing to the line

  // Our key data is the y points, sampled every one minute
  var dataset = data['line_y']

  // Initializing extrema points array, calculating mean
  var points = data['extrema_x'].map(function(val, idx) {
    return {x: val, y:data['extrema_y'][idx]}  
  })
  var dataMean = data['line_y'].reduce((a,b) => a + b, 0) / data['line_y'].length
  
  // Add the SVG to the page
  var svg = d3.select(".container").append("svg")
    .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  // Add the x axis - using x scale
  svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(xScale)); // Create an axis component with d3.axisBottom
    
  // Add the y axis - using y scale
  svg.append("g")
      .attr("class", "y axis")
      .call(d3.axisLeft(yScale)); // Create an axis component with d3.axisLeft

  // Append the path, bind the data, and call the line generator
  curve = svg.append("path")
      .datum(dataset) // Binds data to the line
      .attr("class", "line")
      .attr('stroke', data['color'])// Assign a class for styling
      .attr("d", line); // Calls the line generator with the assigned data
    
  // Line-draw animation trick using dasharray and dashoffset
    var length = curve.node().getTotalLength();
    curve.attr("stroke-dasharray", length + " " + length)
     .attr("stroke-dashoffset", length)
     .transition()
       .duration(TRANSITION_DURATION)
       .attr("stroke-dashoffset", 0);
  
  // Add text label for the y axis
  svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("y", 0 - margin.left)
      .attr("x",0 - (height / 2))
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .text("Words");  
    
  // Add text label for the x axis
  svg.append("text")             
  .attr("transform",
        "translate(" + (width/2) + " ," + 
                       (height + margin.top - 15) + ")")
  .style("text-anchor", "middle")
  .text("Timeline (Minutes)");
    
    // Wait for transition to end then draw extrema points
    window.setTimeout(function() { drawExtremas(svg, points, dataMean, data) }, TRANSITION_DURATION)  
  }

function drawExtremas(svg, points, dataMean, data) {
 // Add a line to each point of interest, either going up (maxima) or going down (minima)
  svg.selectAll(".dot")
    .data(points)
    .enter().append("line")
    .attr("class", "previewLine")
    .attr("x1", function(d) { return xScale(d['x']) })
    .attr("y1", function(d) { return yScale(d['y']) })
    .attr("x2", function(d) { return xScale(d['x']) })
    .attr("y2", function(d) { return yScale(d['y']) - 50 * (d['y'] > dataMean ? 1 : -1) })
    .attr('stroke', data['color'])


  // Add a video element at the end of each line
  svg.selectAll(".dot")
    .data(points)
    .enter().append("foreignObject")
  .attr('onmouseover', 'raiseElement(this)')
  .attr('onclick', 'toggleVideo(this, event); return false')
  .attr('class', 'extremaVideoContainer')
  .attr("x", function(d) { return xScale(d['x']) - VIDEO_MINIMIZED_WIDTH / 2 })
  .attr("y", function(d) { return yScale(d['y']) - (d['y'] > dataMean ? 95 : -45) })
  .attr("original-x", function(d) { return xScale(d['x'])  - VIDEO_MINIMIZED_WIDTH / 2 })
  .attr("original-y", function(d) { return yScale(d['y']) - (d['y'] > dataMean ? 95 : -45) })
  .append("xhtml:div")
  .style("font", "14px 'Helvetica Neue'")
  .html(function(d, i) {
    var content =`
            <video preload=auto class='extremaVideo' src='{0}'></video>
        `.replace('{0}', data['path'] + '/' + d['x'] + '.mp4');
    return content;})
  
   // Add the points themselves on the graph
    svg.selectAll(".dot")
      .data(points)
    .enter().append("circle") // Uses the enter().append() method
      .attr("class", "dot") // Assign a class for styling
      .attr("cx", function(d) { return xScale(d['x']) })
      .attr("cy", function(d) { return yScale(d['y']) })
      .attr("r", 5)
      .attr('fill', data['color'])
    .attr('stroke', data['color'])
}

var raised;
function raiseElement(elem){
    if (raised != elem) {
        d3.select(elem).raise();
        raised = elem;
    }
}

// This function toggles the video playing and handles positioning and resizing
function toggleVideo(elem, e) {
    if ($(elem).hasClass('playing')) {
        closeVideo(elem);
    }
    else {
        openVideo(elem);
    }
    e.stopPropagation();
}

function openVideo(elem) {
    $(elem).find('video')[0].play() 
    $(elem).attr('x', xScale(maxX / 2) - VIDEO_MAXIMIZED_WIDTH / 2)
    $(elem).attr('y', yScale(maxY / 2) - VIDEO_MAXIMIZED_HEIGHT / 2)
    $(elem).addClass('playing')
    $('.overlay').addClass('active')
}

function closeVideo(elem){
    $('.overlay').removeClass('active')
    $(elem).removeClass('playing')
    window.setTimeout(function() { $(elem).find('video')[0].pause() });
    $(elem).attr('x', $(elem).attr('original-x'))
    $(elem).attr('y', $(elem).attr('original-y'))
}

function overlayClicked() {
    elem = $('foreignObject').last();
    closeVideo(elem);
}